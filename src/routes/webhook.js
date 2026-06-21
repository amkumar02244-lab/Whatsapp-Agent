// src/routes/webhook.js
// ============================================================
// WEBHOOK ROUTES
// Two endpoints Meta requires:
// GET /webhook  — verification challenge (one-time setup)
// POST /webhook — incoming messages (every message)
// ============================================================

const express = require('express');
const router = express.Router();
const { parseIncomingMessage } = require('../services/whatsappService');
const { handleIncomingMessage } = require('../services/messageHandler');

// ---- GET /webhook — Meta Verification ----
// Meta calls this once when you set up your webhook URL
// Must respond with the challenge string to prove you own the server
router.get('/', (req, res) => {
  const mode      = req.query['hub.mode'];
  const token     = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  console.log(`\n🔍 Webhook verification attempt | mode: ${mode} | token: ${token}`);

  if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
    console.log('✅ Webhook verified successfully!');
    res.status(200).send(challenge);
  } else {
    console.error('❌ Webhook verification failed — token mismatch');
    res.sendStatus(403);
  }
});

// ---- POST /webhook — Incoming Messages ----
// Meta calls this for every message, status update, etc.
// CRITICAL: Must respond with 200 within 5 seconds
// Process the message asynchronously AFTER sending 200
router.post('/', async (req, res) => {
  // Respond immediately — Meta will retry if we don't
  res.sendStatus(200);

  console.log('\n📥 INCOMING WEBHOOK PAYLOAD:');
  console.log(JSON.stringify(req.body, null, 2));

  try {
    const body = req.body;

    // Ignore non-message events (delivery receipts, etc.)
    // body.object is 'whatsapp' for WhatsApp Cloud API, 'instagram' for Instagram DMs
    if (body.object !== 'whatsapp' && body.object !== 'instagram') return;
    if (!body.entry?.[0]?.changes?.[0]?.value?.messages && !body.entry?.[0]?.messaging) return;

    // Parse the incoming message
    const parsedMessage = parseIncomingMessage(body);
    if (!parsedMessage) {
      console.log('⚠️ Could not parse message payload');
      return;
    }

    // Process asynchronously — don't block
    handleIncomingMessage(parsedMessage).catch(err => {
      console.error('❌ Message handling error:', err.message);
    });

  } catch (error) {
    console.error('❌ Webhook POST error:', error.message);
  }
});

module.exports = router;
