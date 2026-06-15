// src/services/messageHandler.js
// ============================================================
// MESSAGE HANDLER — THE ORCHESTRATOR
// This is the core flow controller:
// Message comes in → detect intent → lookup order if needed
// → call Claude → send reply → log everything
// ============================================================

const { generateResponse, detectIntent } = require('./claudeService');
const { sendTextMessage, sendButtonMessage, markAsRead, sendImageMessage } = require('./whatsappService');
const { getBrandByPhoneId } = require('../config/brands');
const { getOrderStatus } = require('../config/demoOrders');
const NodeCache = require('node-cache');

// Rate limiter — max 5 messages per customer per minute
const rateLimitCache = new NodeCache({ stdTTL: 60 });

// Escalation tracker — brands that need human follow-up
const escalationQueue = [];

// ---- MAIN HANDLER ----
async function handleIncomingMessage(parsedMessage) {
  const { messageId, phoneNumberId, customerPhone, customerName, text } = parsedMessage;

  console.log(`\n📨 Message from ${customerName} (${customerPhone}): "${text}"`);

  // 1. Get the brand config for this WhatsApp number
  const brand = getBrandByPhoneId(phoneNumberId);
  console.log(`🏪 Brand: ${brand.name}`);

  // 2. Rate limit check
  const rateLimitKey = `rl_${customerPhone}`;
  const msgCount = rateLimitCache.get(rateLimitKey) || 0;
  if (msgCount > 10) {
    console.log(`⚠️ Rate limit hit for ${customerPhone}`);
    return; // Silently drop — don't annoy customer with error
  }
  rateLimitCache.set(rateLimitKey, msgCount + 1);

  // 3. Mark as read immediately (shows blue ticks)
  await markAsRead(phoneNumberId, messageId);

  // 4. Handle greeting with quick-reply buttons
  const intent = detectIntent(text);
  console.log(`🎯 Intent detected: ${intent.intent}`);

  if (intent.intent === 'greeting') {
    await sendButtonMessage(phoneNumberId, customerPhone, brand.greeting, [
      { id: 'track_order', title: '📦 Track Order' },
      { id: 'return_exchange', title: '🔄 Return/Exchange' },
      { id: 'product_info', title: '👗 Product Info' },
    ]);
    return;
  }

  // 5. Handle direct escalation request
  if (intent.intent === 'escalate') {
    await sendTextMessage(phoneNumberId, customerPhone, brand.escalationMessage);
    addToEscalationQueue(customerPhone, customerName, text, brand.name);
    return;
  }

  // 6. Order tracking — try to get real order data first
  let orderContext = null;
  if (intent.intent === 'order_tracking' || intent.intent === 'order_tracking_no_id') {
    const orderData = getOrderStatus(intent.orderNumber, customerPhone);
    if (orderData) {
      // We found the order — send direct status message
      await sendTextMessage(phoneNumberId, customerPhone, orderData.message);
      console.log(`✅ Order status sent directly for customer ${customerPhone}`);
      return;
    } else if (intent.intent === 'order_tracking') {
      // Order ID provided but not found
      orderContext = { searched: intent.orderNumber, found: false };
    }
  }

  if (intent.intent === 'order_tracking_no_id') {
    const reply = "Aapka order track karne ke liye please apna *Order Number* type karein (e.g., *1002* ya *#1002*). 😊";
    await sendTextMessage(phoneNumberId, customerPhone, reply);
    logInteraction({
      brand: brand.name,
      customer: customerPhone,
      message: text,
      intent: intent.intent,
      reply: reply,
      responseTimeMs: 50,
      escalated: false,
    });
    return;
  }

  // 7. Generate AI response for everything else
  console.log('🤖 Generating AI response...');
  const startTime = Date.now();

  const { reply, needsEscalation, inputTokens, outputTokens } = await generateResponse(
    text,
    brand,
    customerPhone,
    orderContext
  );

  const responseTime = Date.now() - startTime;
  console.log(`⚡ AI response generated in ${responseTime}ms | Tokens: ${inputTokens}in/${outputTokens}out`);

  let replyText = reply;
  let imageUrl = null;

  // Process order placement
  const orderRegex = /\[CREATE_ORDER\]:\s*(\{.*?\})/i;
  const orderMatch = replyText.match(orderRegex);
  if (orderMatch) {
    try {
      const orderParams = JSON.parse(orderMatch[1]);
      const { placeNewOrder } = require('../config/demoOrders');
      const newOrder = placeNewOrder({
        ...orderParams,
        customerPhone: orderParams.customerPhone || customerPhone,
        customerName: orderParams.customerName || customerName || 'Customer'
      });
      if (newOrder) {
        replyText = replyText.replace(orderRegex, '').trim() + 
          `\n\n🎉 *Order Confirmed!*\n` +
          `📦 Order ID: *#${newOrder.orderId}*\n` +
          `💰 Total Amount: *₹${newOrder.amount}*\n` +
          `🚚 Estimated Delivery: *${newOrder.estimatedDelivery}*`;
      }
    } catch (err) {
      console.error('Failed to create order from AI tag:', err.message);
      replyText = replyText.replace(orderRegex, '').trim();
    }
  }

  // Process image requests
  const imageRegex = /\[IMAGE\]:\s*(https?:\/\/\S+)/i;
  const imageMatch = replyText.match(imageRegex);
  if (imageMatch) {
    imageUrl = imageMatch[1];
    replyText = replyText.replace(imageRegex, '').trim();
  }

  // 8. Send the reply
  if (imageUrl) {
    try {
      await sendImageMessage(phoneNumberId, customerPhone, imageUrl, replyText);
      console.log(`✅ Image reply sent to ${customerPhone}`);
    } catch (err) {
      console.warn('Failed to send image message, falling back to text:', err.message);
      await sendTextMessage(phoneNumberId, customerPhone, replyText);
      console.log(`✅ Text fallback sent to ${customerPhone}`);
    }
  } else {
    await sendTextMessage(phoneNumberId, customerPhone, replyText);
    console.log(`✅ Reply sent to ${customerPhone}`);
  }

  // 9. If escalation needed, notify the brand owner
  if (needsEscalation) {
    addToEscalationQueue(customerPhone, customerName, text, brand.name);
    console.log(`🚨 Escalation queued for ${customerPhone}`);
  }

  // 10. Log for analytics
  logInteraction({
    brand: brand.name,
    customer: customerPhone,
    message: text,
    intent: intent.intent,
    reply: reply,
    responseTimeMs: responseTime,
    escalated: needsEscalation,
    tokens: { input: inputTokens, output: outputTokens },
  });
}

// ---- WEB CHAT HANDLER (for React web frontend) ----
async function handleWebChatMessage(brandId, customerPhone, customerName, text, apiKey = null, provider = 'openrouter') {
  console.log(`\n💻 Web Chat Message from ${customerName} (${customerPhone}) for brand ${brandId}: "${text}"`);

  // 1. Get the brand config
  const { getBrandById } = require('../config/brands');
  const brand = getBrandById(brandId);
  console.log(`🏪 Brand: ${brand.name}`);

  // 2. Rate limit check
  const rateLimitKey = `rl_${customerPhone}`;
  const msgCount = rateLimitCache.get(rateLimitKey) || 0;
  if (msgCount > 15) {
    console.log(`⚠️ Rate limit hit for ${customerPhone}`);
    return { reply: "Aap bahut tezi se message bhej rahe hain. Please thoda slow karein! ⏳", intent: 'rate_limited' };
  }
  rateLimitCache.set(rateLimitKey, msgCount + 1);

  // 3. Detect intent
  const intent = detectIntent(text);
  console.log(`🎯 Intent detected: ${intent.intent}`);

  // 4. Handle greeting with buttons
  if (intent.intent === 'greeting') {
    const reply = brand.greeting;
    const buttons = [
      { id: 'track_order', title: '📦 Track Order' },
      { id: 'return_exchange', title: '🔄 Return/Exchange' },
      { id: 'product_info', title: '👗 Product Info' },
    ];
    
    // Log for analytics
    logInteraction({
      brand: brand.name,
      customer: customerPhone,
      message: text,
      intent: intent.intent,
      reply: reply,
      responseTimeMs: 50,
      escalated: false,
    });

    return { reply, buttons, intent: intent.intent };
  }

  // 5. Handle escalation
  if (intent.intent === 'escalate') {
    addToEscalationQueue(customerPhone, customerName, text, brand.name);
    
    logInteraction({
      brand: brand.name,
      customer: customerPhone,
      message: text,
      intent: intent.intent,
      reply: brand.escalationMessage,
      responseTimeMs: 50,
      escalated: true,
    });

    return { reply: brand.escalationMessage, intent: intent.intent, needsEscalation: true };
  }

  // 6. Order tracking - mock/live db lookup
  let orderContext = null;
  if (intent.intent === 'order_tracking' || intent.intent === 'order_tracking_no_id') {
    const orderData = getOrderStatus(intent.orderNumber, customerPhone);
    if (orderData) {
      logInteraction({
        brand: brand.name,
        customer: customerPhone,
        message: text,
        intent: intent.intent,
        reply: orderData.message,
        responseTimeMs: 100,
        escalated: false,
      });
      return { reply: orderData.message, intent: intent.intent };
    } else if (intent.intent === 'order_tracking') {
      orderContext = { searched: intent.orderNumber, found: false };
    }
  }

  if (intent.intent === 'order_tracking_no_id') {
    const reply = "Aapka order track karne ke liye please apna *Order Number* type karein (e.g., *1002* ya *#1002*). 😊";
    logInteraction({
      brand: brand.name,
      customer: customerPhone,
      message: text,
      intent: intent.intent,
      reply: reply,
      responseTimeMs: 50,
      escalated: false,
    });
    return { reply, intent: intent.intent };
  }

  // 7. Generate response using OpenRouter
  console.log('🤖 Generating AI response for web chat...');
  const startTime = Date.now();

  const response = await generateResponse(
    text,
    brand,
    customerPhone,
    orderContext,
    apiKey,
    provider
  );

  const responseTime = Date.now() - startTime;
  console.log(`⚡ AI response generated in ${responseTime}ms`);

  const { reply, needsEscalation, modelUsed } = response;

  let replyText = reply;
  let imageUrl = null;

  // Process order placement
  const orderRegex = /\[CREATE_ORDER\]:\s*(\{.*?\})/i;
  const orderMatch = replyText.match(orderRegex);
  if (orderMatch) {
    try {
      const orderParams = JSON.parse(orderMatch[1]);
      const { placeNewOrder } = require('../config/demoOrders');
      const newOrder = placeNewOrder({
        ...orderParams,
        customerPhone: orderParams.customerPhone || customerPhone,
        customerName: orderParams.customerName || customerName || 'Customer'
      });
      if (newOrder) {
        replyText = replyText.replace(orderRegex, '').trim() + 
          `\n\n🎉 *Order Confirmed!*\n` +
          `📦 Order ID: *#${newOrder.orderId}*\n` +
          `💰 Total Amount: *₹${newOrder.amount}*\n` +
          `🚚 Estimated Delivery: *${newOrder.estimatedDelivery}*`;
      }
    } catch (err) {
      console.error('Failed to create order from AI tag:', err.message);
      replyText = replyText.replace(orderRegex, '').trim();
    }
  }

  // Process image requests
  const imageRegex = /\[IMAGE\]:\s*(https?:\/\/\S+)/i;
  const imageMatch = replyText.match(imageRegex);
  if (imageMatch) {
    imageUrl = imageMatch[1];
    replyText = replyText.replace(imageRegex, '').trim();
  }

  if (needsEscalation) {
    addToEscalationQueue(customerPhone, customerName, text, brand.name);
  }

  // Log for analytics
  logInteraction({
    brand: brand.name,
    customer: customerPhone,
    message: text,
    intent: intent.intent,
    reply: replyText,
    responseTimeMs: responseTime,
    escalated: needsEscalation,
    modelUsed: modelUsed,
  });

  return {
    reply: replyText,
    imageUrl: imageUrl,
    needsEscalation,
    modelUsed,
    intent: intent.intent
  };
}

// ---- ESCALATION QUEUE ----
function addToEscalationQueue(customerPhone, customerName, lastMessage, brandName) {
  const item = {
    id: Date.now(),
    customerPhone,
    customerName,
    lastMessage,
    brandName,
    timestamp: new Date().toISOString(),
    status: 'pending',
  };
  escalationQueue.push(item);

  // In production: send WhatsApp alert to brand owner here
  // For demo: just log it
  console.log(`\n🚨 ESCALATION NEEDED:
    Brand: ${brandName}
    Customer: ${customerName} (${customerPhone})
    Last message: "${lastMessage}"
    Time: ${item.timestamp}\n`);

  return item;
}

function getEscalationQueue() {
  return escalationQueue;
}

// ---- ANALYTICS LOGGER ----
const analyticsLog = [];

function logInteraction(data) {
  analyticsLog.push({ ...data, timestamp: new Date().toISOString() });
  // Keep only last 1000 interactions in memory
  if (analyticsLog.length > 1000) analyticsLog.shift();
}

function getAnalytics(brandName = null) {
  const data = brandName
    ? analyticsLog.filter(l => l.brand === brandName)
    : analyticsLog;

  const total = data.length;
  const escalated = data.filter(d => d.escalated).length;
  const avgResponseTime = total > 0
    ? Math.round(data.reduce((sum, d) => sum + (d.responseTimeMs || 0), 0) / total)
    : 0;

  const intentBreakdown = data.reduce((acc, d) => {
    acc[d.intent] = (acc[d.intent] || 0) + 1;
    return acc;
  }, {});

  return {
    total,
    aiResolved: total - escalated,
    escalated,
    resolutionRate: total > 0 ? Math.round(((total - escalated) / total) * 100) : 0,
    avgResponseTimeMs: avgResponseTime,
    intentBreakdown,
    recentInteractions: data.slice(-10),
  };
}

module.exports = {
  handleIncomingMessage,
  handleWebChatMessage,
  getEscalationQueue,
  getAnalytics,
};
