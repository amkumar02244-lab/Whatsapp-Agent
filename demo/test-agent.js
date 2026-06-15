// demo/test-agent.js
// ============================================================
// LOCAL TEST SCRIPT
// Test the AI brain without needing WhatsApp or Meta setup.
// Just run: node demo/test-agent.js
// ============================================================

require('dotenv').config({ path: '../.env' });
const { generateResponse, detectIntent } = require('../src/services/claudeService');
const { getBrandById } = require('../src/config/brands');
const { getOrderStatus } = require('../src/config/demoOrders');
const readline = require('readline');

const brand = getBrandById('demo');

console.log('\n🤖 WhatsApp AI Support Agent — Local Test Mode');
console.log('================================================');
console.log(`Brand: ${brand.name}`);
console.log('Type messages as if you\'re a customer.');
console.log('Type "quit" to exit, "clear" to reset conversation.\n');
console.log('Try these messages:');
console.log('  - "hi"');
console.log('  - "mera order 1002 kahan hai"');
console.log('  - "return karna hai"');
console.log('  - "lehenga ka price kya hai"');
console.log('  - "I want to talk to a human"');
console.log('================================================\n');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const customerId = 'test_customer_' + Date.now();

function prompt() {
  rl.question('You: ', async (input) => {
    const msg = input.trim();

    if (!msg) { prompt(); return; }
    if (msg.toLowerCase() === 'quit') { console.log('👋 Goodbye!'); rl.close(); return; }
    if (msg.toLowerCase() === 'clear') {
      const { clearConversationHistory } = require('../src/services/claudeService');
      clearConversationHistory(customerId, brand.id);
      console.log('🗑️  Conversation cleared\n');
      prompt();
      return;
    }

    // Detect intent
    const intent = detectIntent(msg);
    console.log(`[Intent: ${intent.intent}]`);

    // Check for order data
    let orderContext = null;
    if (intent.intent === 'order_tracking' && intent.orderNumber) {
      const orderData = getOrderStatus(intent.orderNumber);
      if (orderData) {
        console.log(`\n🤖 ${brand.name}: ${orderData.message}\n`);
        prompt();
        return;
      }
      orderContext = { searched: intent.orderNumber, found: false };
    }

    // Generate AI response
    process.stdout.write('🤖 Thinking...');
    const start = Date.now();

    try {
      const { reply, needsEscalation, inputTokens, outputTokens } = await generateResponse(
        msg, brand, customerId, orderContext
      );

      process.stdout.write('\r');
      console.log(`\n🤖 ${brand.name}:\n${reply}`);
      console.log(`\n[${Date.now() - start}ms | ${inputTokens} in / ${outputTokens} out tokens${needsEscalation ? ' | 🚨 ESCALATE' : ''}]\n`);
    } catch (err) {
      console.error('\n❌ Error:', err.message);
    }

    prompt();
  });
}

prompt();
