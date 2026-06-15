// src/services/claudeService.js
// ============================================================
// AI SERVICE — OpenRouter FREE tier with multi-model fallback
// When one model hits 50/day limit → auto-switches to next
// Total free capacity: 50 × 5 models = 250 requests/day FREE
// ============================================================

const axios = require('axios');
const NodeCache = require('node-cache');

const conversationCache = new NodeCache({ stdTTL: 86400 });

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const KEY = process.env.OPENROUTER_API_KEY;

// ---- FREE MODEL QUEUE ----
// All completely free. Tried in order.
// If one hits rate limit (429) → automatically tries next one.
// 50 req/day each × 5 models = 250 free conversations/day
const FREE_MODELS = [
  'google/gemma-4-31b-it:free',           // Best — 140+ langs, 256K context
  'google/gemma-4-26b-a4b-it:free',       // Also excellent, slightly faster
  'qwen/qwen3-next-80b-a3b-instruct:free', // Strong multilingual reasoning
  'meta-llama/llama-3.3-70b-instruct:free', // Very good Hinglish
  'meta-llama/llama-3.2-3b-instruct:free', // Fast fallback
];

// Track which model we're currently using
let currentModelIndex = 0;

function getCurrentModel() {
  return FREE_MODELS[currentModelIndex];
}

// Move to next model when rate limited
function switchToNextModel() {
  currentModelIndex = (currentModelIndex + 1) % FREE_MODELS.length;
  console.log(`⚠️  Rate limited — switching to: ${FREE_MODELS[currentModelIndex]}`);
  return FREE_MODELS[currentModelIndex];
}

// ---- SYSTEM PROMPT ----
function buildSystemPrompt(brand) {
  const representativeName = brand.id === 'demo' ? 'Riya' : 'Priya';
  return `You are a warm, sweet, and helpful young woman named "${representativeName}", working as the customer service coordinator and brand representative for "${brand.name}" (an Indian ${brand.category} brand).

## YOUR IDENTITY & PERSONA
- You are an actual girl chatting on WhatsApp. Speak with a friendly, warm, empathetic, and sweet vibe—exactly like a real young woman.
- Use cute and expressive emojis naturally (e.g., 🥺, ✨, 💕, 🌸, 😊, 🙈, 🚚, 📦, 💖).
- Keep replies SHORT and crisp — under 100-150 words. This is WhatsApp, not an email!

## LANGUAGE & GRAMMAR RULES (CRITICAL FOR HINGLISH/HINDI)
- Detect the customer's language and MATCH it exactly (Hinglish/Hindi or English).
- **FEMININE VERB INFLECTIONS (MANDATORY)**: Since you are a girl, you MUST always use feminine verb endings and inflections in Hindi/Hinglish. Never use masculine forms for yourself.
  - ✅ Use: "Main check kar**ti** hoon", "sakti hoon", "bata**ti** hoon", "soch**ti** hoon", "kar**ti** hoon", "aa rahi hoon".
  - ❌ Never use: "Main check kar**ta** hoon", "sakta hoon", "bata**ta** hoon", "kar**ta** hoon", "aa raha hoon".
- **NATURAL CASUAL SLANG**: Feel free to use natural, friendly words and chat fillers like "dear", "sweetie", "yaar", "hanji", "toh", "hiii" (with multiple i's), "ek second", "oh acha", "koi baat nahi sweetie".
- **AVOID ROBOTIC FORMALITIES**: Never say "Dear Customer", "We apologize for the inconvenience", "As per our policy", or sound like a template. Be conversational.
  - ✅ Say: "Aww, extremely sorry dear! Ek second, main abhi track karti hoon aapka order... 💕"
  - ❌ Say: "We apologize for the delay. Your order status is being retrieved."

## PRODUCT IMAGE SHARING RULES
- Whenever the customer inquires about a product, asks to see what it looks like, or places an order, you MUST append the exact product image URL to your message using the following format on a separate line at the end:
  [IMAGE]: <imageUrl>
  (Ensure this is on its own line. Do not write markdown tags or links for the image, just write [IMAGE]: followed by the URL.)

## DIRECT ORDER PLACEMENT FLOW
- You can place orders directly for the customer! Guide them through the ordering process by asking for the following details step-by-step:
  1. Product Name (must match a product in the catalog)
  2. Size (e.g. S, M, L, XL) and Color (default to "As shown")
  3. Quantity (default to 1)
  4. Customer's Full Name
  5. Complete Delivery Address
  6. Phone Number (use their phone number or ask if they want to use a different one)
- Once the customer has provided all details and explicitly confirmed they want to order, you MUST append this special tag at the very end of your response on a new line:
  [CREATE_ORDER]: {"customerName": "...", "customerPhone": "...", "productName": "...", "size": "...", "color": "...", "quantity": 1, "address": "..."}
  (Replace the placeholders with the gathered details. Ensure the JSON is valid and written on a single line.)

## RETURN POLICY
${brand.returnPolicy}

## PRODUCTS
${brand.products.map(p =>
  `- ${p.name}: ₹${p.price} | Sizes: ${p.sizes.join(', ')} | Colors: ${p.colors.join(', ')} | ${p.inStock ? '✅ In Stock' : '❌ Out of Stock'} | Image: ${p.imageUrl || 'No image'}`
).join('\n')}

## SHIPPING
- Free above ₹${brand.shipping.freeAbove}
- Standard: ₹${brand.shipping.standardCharge}
- Delivery: ${brand.shipping.estimatedDays}
- COD: ${brand.shipping.codAvailable ? `Yes (+₹${brand.shipping.codCharge})` : 'No'}

## FAQs
${brand.faqs.map(f => `Q: ${f.q}\nA: ${f.a}`).join('\n\n')}

## ESCALATION
If customer is very angry, demands legal action, or the issue is too complex:
Say "${brand.escalationMessage}" and add [ESCALATE] at the end.

## FORMAT
- Use *bold* for key info (like order status, size, prices).
- Keep it friendly, sweet, and highly conversational.`;
}

// ---- CONVERSATION MEMORY ----
function getHistory(customerId, brandId) {
  return conversationCache.get(`${customerId}_${brandId}`) || [];
}
function saveHistory(customerId, brandId, history) {
  conversationCache.set(`${customerId}_${brandId}`, history.slice(-20));
}
function clearConversationHistory(customerId, brandId) {
  conversationCache.del(`${customerId}_${brandId}`);
}

// ---- CALL ONE MODEL ----
async function callModel(model, messages, apiKey = null, provider = 'openrouter') {
  // Determine key/token
  let token = apiKey;
  if (!token) {
    if (provider === 'groq') {
      token = process.env.GROQ_API_KEY || process.env.GROK_API_KEY;
    } else if (provider === 'grok') {
      token = process.env.GROK_API_KEY || process.env.XAI_API_KEY;
    } else {
      token = KEY;
    }
  }

  // Auto-detect Groq by key format (starts with gsk_)
  const isGroq = provider === 'groq' || (token && token.startsWith('gsk_'));
  const isGrok = !isGroq && (provider === 'grok' || model.startsWith('grok-'));

  let url;
  let targetModel;
  
  if (isGroq) {
    url = 'https://api.groq.com/openai/v1/chat/completions';
    targetModel = 'llama-3.3-70b-versatile';
  } else if (isGrok) {
    url = 'https://api.x.ai/v1/chat/completions';
    targetModel = 'grok-2';
  } else {
    url = OPENROUTER_URL;
    targetModel = model;
  }

  const response = await axios.post(
    url,
    {
      model: targetModel,
      messages: messages,
      max_tokens: 400,
      temperature: 0.7,
    },
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...((!isGrok && !isGroq) && {
          'HTTP-Referer': 'https://your-app.com',
          'X-Title': 'D2C WhatsApp Support Agent',
        })
      },
      timeout: 30000
    }
  );
  return response.data.choices[0].message.content;
}

// ---- MAIN FUNCTION — with auto-fallback ----
async function generateResponse(customerMessage, brand, customerId, orderContext = null, apiKey = null, provider = 'openrouter') {
  const history = getHistory(customerId, brand.id);

  let messageToSend = customerMessage;
  if (orderContext) {
    messageToSend = `[ORDER DATA]: ${JSON.stringify(orderContext)}\nCustomer: ${customerMessage}`;
  }

  const messages = [
    { role: 'system', content: buildSystemPrompt(brand) },
    ...history,
    { role: 'user', content: messageToSend }
  ];

  // Direct Groq / Grok provider execution route
  const brandProvider = brand.provider || (brand.model === 'groq' ? 'groq' : (brand.model === 'grok' ? 'grok' : null));
  const activeRouteProvider = (provider === 'groq' || provider === 'grok') ? provider : brandProvider;
  
  const effectiveKey = apiKey || (activeRouteProvider === 'groq' ? process.env.GROQ_API_KEY : (activeRouteProvider === 'grok' ? process.env.GROK_API_KEY || process.env.XAI_API_KEY : null));
  const isGroq = activeRouteProvider === 'groq' || (effectiveKey && effectiveKey.startsWith('gsk_'));
  const isGrok = !isGroq && (activeRouteProvider === 'grok');

  if (isGroq || isGrok) {
    const activeProvider = isGroq ? 'groq' : 'grok';
    const activeModel = isGroq ? 'llama-3.3-70b-versatile' : 'grok-2';
    const displayModel = isGroq ? 'Groq (Llama-3.3)' : 'Grok-2';
    const fallbackModel = isGroq ? 'Local Simulation (Groq Fallback)' : 'Local Simulation (Grok Fallback)';
    
    console.log(`🤖 Using direct ${isGroq ? 'Groq' : 'xAI Grok'} API...`);
    try {
      const replyText = await callModel(activeModel, messages, apiKey, activeProvider);

      // Save history
      saveHistory(customerId, brand.id, [
        ...history,
        { role: 'user', content: messageToSend },
        { role: 'assistant', content: replyText }
      ]);

      const needsEscalation = replyText.includes('[ESCALATE]');
      return {
        reply: replyText.replace('[ESCALATE]', '').trim(),
        needsEscalation,
        modelUsed: displayModel,
      };
    } catch (error) {
      console.error(`Direct ${isGroq ? 'Groq' : 'Grok'} API call failed:`, error.message);
      // Fallback to local simulation if key fails or is missing
      const sim = generateLocalSimulationResponse(customerMessage, brand);
      return {
        reply: sim.reply,
        needsEscalation: sim.needsEscalation,
        modelUsed: fallbackModel,
        error: error.message
      };
    }
  }

  // Try each model — move to next if rate limited
  let attempts = 0;
  while (attempts < FREE_MODELS.length) {
    const model = getCurrentModel();
    try {
      console.log(`🤖 Using model: ${model}`);
      const replyText = await callModel(model, messages, apiKey);

      // Save history
      saveHistory(customerId, brand.id, [
        ...history,
        { role: 'user', content: messageToSend },
        { role: 'assistant', content: replyText }
      ]);

      const needsEscalation = replyText.includes('[ESCALATE]');
      return {
        reply: replyText.replace('[ESCALATE]', '').trim(),
        needsEscalation,
        modelUsed: model,
      };

    } catch (error) {
      if (error.response?.status === 429) {
        // Rate limited — try next model
        switchToNextModel();
        attempts++;
        continue;
      }
      // Other error — return local simulation response
      console.warn(`[Simulation Mode] OpenRouter call failed: ${error.message}. Invoking rule-based fallback...`);
      const sim = generateLocalSimulationResponse(customerMessage, brand);
      return {
        reply: sim.reply,
        needsEscalation: sim.needsEscalation,
        modelUsed: 'Local Simulation (Offline)',
        error: error.message
      };
    }
  }

  // All models exhausted
  console.warn('[Simulation Mode] All free models exhausted. Invoking rule-based fallback...');
  const sim = generateLocalSimulationResponse(customerMessage, brand);
  return {
    reply: sim.reply,
    needsEscalation: sim.needsEscalation,
    modelUsed: 'Local Simulation (Offline)',
    error: 'all_models_rate_limited'
  };
}

// ---- INTENT DETECTOR — zero API calls ----
function detectIntent(message) {
  const msg = message.trim().toLowerCase();
  
  // Try to find UUID or hex prefix
  const uuidMatch = msg.match(/#?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/);
  if (uuidMatch) {
    return { intent: 'order_tracking', orderNumber: uuidMatch[1] };
  }
  const hexPrefixMatch = msg.match(/^#?([0-9a-f]{8})$/);
  if (hexPrefixMatch) {
    return { intent: 'order_tracking', orderNumber: hexPrefixMatch[1] };
  }

  // If the message is just a 3-6 digit number (optionally prefixed with #), treat it as an order tracking request
  const standaloneOrderMatch = msg.match(/^#?(\d{3,6})$/);
  if (standaloneOrderMatch) {
    return { intent: 'order_tracking', orderNumber: standaloneOrderMatch[1] };
  }

  if (msg.match(/track|kahan|kab|status|deliver|where is|when will|pata karo/) || (msg.includes('order') && !msg.match(/place|create|buy|book|karna|karne|want to|buy|want/))) {
    const uuidInText = msg.match(/#?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/);
    if (uuidInText) return { intent: 'order_tracking', orderNumber: uuidInText[1] };

    const hexInText = msg.match(/\b([0-9a-f]{8})\b/);
    if (hexInText) return { intent: 'order_tracking', orderNumber: hexInText[1] };

    const orderMatch = msg.match(/#?(\d{3,6})/);
    if (orderMatch) return { intent: 'order_tracking', orderNumber: orderMatch[1] };
    
    if (msg.match(/track|status|kahan|delivery|kab|where/)) {
      return { intent: 'order_tracking_no_id' };
    }
  }
  if (msg.match(/return|refund|wapas|vapas|exchange|size issue|wrong|damaged|defective|cancel/))
    return { intent: 'return_refund' };
  if (msg.match(/^(hi|hello|hey|namaste|namaskar|hlo|hii|good morning|👋|hy)$/i))
    return { intent: 'greeting' };
  if (msg.match(/price|cost|kitna|available|stock|size|color|fabric|material|design|rate/))
    return { intent: 'product_inquiry' };
  if (msg.match(/human|agent|person|manager|baat karna|real person/))
    return { intent: 'escalate' };
  return { intent: 'general' };
}

// ---- LOCAL RULE-BASED SIMULATOR (Demos without API keys or Internet) ----
function generateLocalSimulationResponse(text, brand) {
  const query = text.toLowerCase().trim();

  // 1. Greeting check
  if (query.match(/^(hi|hello|hey|namaste|namaskar|hlo|hii|good morning|👋|hy)$/)) {
    return {
      reply: brand.greeting,
      needsEscalation: false
    };
  }

  // 2. Escalation check
  if (query.match(/human|agent|person|manager|baat karna|real person|angry|complaint|cheat|fraud|court/)) {
    return {
      reply: brand.escalationMessage,
      needsEscalation: true
    };
  }

  // 3. Product catalog check
  const products = brand.products || [];
  const matchingProducts = [];
  const queryWords = query.split(/\s+/).map(w => w.replace(/[^a-z]/g, '')).filter(w => w.length > 3);
  
  for (const p of products) {
    const pName = p.name.toLowerCase();
    const pCategory = (p.category || '').toLowerCase();
    const words = pName.split(' ').concat(pCategory.split(' '));
    const keywords = words.filter(w => w.length > 3).map(w => w.replace(/[^a-z]/g, ''));
    
    const matchesKeyword = keywords.some(kw => queryWords.some(qw => qw.startsWith(kw) || kw.startsWith(qw)));
    if (query.includes(pName) || query.includes(pCategory) || matchesKeyword) {
      matchingProducts.push(p);
    }
  }

  if (matchingProducts.length > 0) {
    // Check if there is an exact or very close match to a single product name
    const exactMatch = matchingProducts.find(p => query === p.name.toLowerCase() || query.includes(p.name.toLowerCase()));
    
    if (exactMatch || matchingProducts.length === 1) {
      const activeProduct = exactMatch || matchingProducts[0];
      return {
        reply: `👗 *${activeProduct.name}* details:\n\n` +
               `💰 *Price*: ₹${activeProduct.price}\n` +
               `🎨 *Colors*: ${activeProduct.colors.join(', ')}\n` +
               `📏 *Sizes*: ${activeProduct.sizes.join(', ')}\n` +
               `📦 *Status*: ${activeProduct.inStock ? '✅ In Stock' : '❌ Out of stock'}\n\n` +
               `${activeProduct.inStock ? 'Aap ise direct order kar sakte hain! Aapko kaunsa size chahiye? 😊' : 'Hum jaldi hi stock refresh karenge. Koi aur item check karna hai?' }`,
        needsEscalation: false
      };
    }

    // Otherwise, list the matching options
    const listItems = matchingProducts.slice(0, 6).map(p => `- *${p.name}*: ₹${p.price} (${p.inStock ? 'In Stock' : 'Out of Stock'})`).join('\n');
    return {
      reply: `Humare paas ye products milenge:\n\n${listItems}\n\n` +
             `Aapko kis item ke details chahiye? Aap uska full name type karke puch sakte hain! 😊`,
      needsEscalation: false
    };
  }


  // 4. Returns check
  if (query.match(/return|refund|wapas|vapas|exchange|cancel/)) {
    return {
      reply: `🔄 *${brand.name} Return Policy*:\n` +
             `- Returns accepted within *7 days* of delivery.\n` +
             `- Product must be unused, unwashed, with original tags.\n` +
             `- Pickup from your doorstep is *Free*.\n` +
             `- Refund original payment method par *5-7 business days* mein credit ho jayega.\n` +
             `- Exchange also available for size/color.`,
      needsEscalation: false
    };
  }

  // 5. FAQ check
  const faqs = brand.faqs || [];
  for (const faq of faqs) {
    const faqQ = faq.q.toLowerCase();
    const keywords = ['international', 'payment', 'cancel', 'photo', 'color', 'track'];
    const matchedKeyword = keywords.find(kw => query.includes(kw) && faqQ.includes(kw));
    if (matchedKeyword) {
      return {
        reply: `ℹ️ *FAQ Answer*:\n\n${faq.a}`,
        needsEscalation: false
      };
    }
  }

  // 6. Shipping & COD check
  if (query.match(/ship|delivery|charge|cod|cash on delivery|cost/)) {
    return {
      reply: `🚚 *Shipping & Delivery Info*:\n\n` +
             `- Charges: ₹${brand.shipping.standardCharge} (₹${brand.shipping.freeAbove} se upar ke orders par *FREE*).\n` +
             `- Delivery time: ${brand.shipping.estimatedDays}.\n` +
             `- *COD (Cash on Delivery)*: Available hai (+₹${brand.shipping.codCharge} transaction charges).`,
      needsEscalation: false
    };
  }

  // 7. Generic Hinglish chatbot fallback
  const repName = brand.id === 'demo' ? 'Riya' : 'Priya';
  return {
    reply: `Hii! 💕 Main ${brand.name} se ${repName} baat kar rahi hoon. Kaise help kar sakti hoon aapki? 😊\n\n` +
           `Aap mujhse ye sab details puch sakte hain:\n` +
           `- Order status track karne ke liye type karein: *"1002"*\n` +
           `- Product details ke liye: *"lehenga ka price"* ya *"palazzo"*\n` +
           `- Return policy ke liye: *"return karna hai"*\n` +
           `- Human support agent ke liye type: *"agent"* ya *"talk to human"*\n\n` +
           `Aapko kis baare mein help chahiye dear? 🥰`,
    needsEscalation: false
  };
}

// ---- STATUS — see which model is active ----
function getModelStatus() {
  return {
    currentModel: getCurrentModel(),
    allModels: FREE_MODELS,
    freeRequestsPerModel: 50,
    totalFreePerDay: FREE_MODELS.length * 50,
  };
}

module.exports = {
  generateResponse,
  detectIntent,
  getConversationHistory: getHistory,
  clearConversationHistory,
  getModelStatus,
};