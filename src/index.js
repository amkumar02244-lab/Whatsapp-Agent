// src/index.js
// ============================================================
// MAIN SERVER
// Express app that handles:
// - WhatsApp webhook (incoming messages)
// - Dashboard API (analytics)
// - Health checks
// ============================================================

require('dotenv').config();
const express = require('express');
const rateLimit = require('express-rate-limit');

const webhookRouter   = require('./routes/webhook');
const dashboardRouter = require('./routes/dashboard');
const apiRouter       = require('./routes/api');

const app  = express();
const PORT = process.env.PORT || 3000;

// Trust the first proxy (Railway)
app.set('trust proxy', 1);

// ---- MIDDLEWARE ----
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Simple CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Rate limiting — prevent abuse
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100,                  // max 100 requests per minute
  message: 'Too many requests',
});
app.use('/webhook', limiter);

// ---- PRIVACY POLICY (For Meta Verification) ----
app.get('/privacy', (req, res) => {
  res.send(`
    <html>
      <head><title>Privacy Policy</title></head>
      <body>
        <h1>Privacy Policy for Riya's Boutique Test</h1>
        <p>This is a test application. We do not store, share, or sell any personal data.</p>
        <p>If you have questions, please contact the administrator.</p>
      </body>
    </html>
  `);
});

// ---- ROUTES ----
app.use('/webhook',   webhookRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api', apiRouter);

// Root — basic info page
app.get('/', (req, res) => {
  res.json({
    name: 'WhatsApp AI Support Agent',
    description: 'AI-powered customer support for Indian D2C brands',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      webhook:   'POST /webhook',
      verify:    'GET  /webhook',
      dashboard: 'GET  /api/dashboard',
      health:    'GET  /api/dashboard/health',
    }
  });
});

// ---- STARTUP CHECKS ----
function checkEnvironment() {
  const required = ['OPENROUTER_API_KEY'];
  const missing  = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.error('\n❌ Missing environment variables:', missing.join(', '));
    console.error('📋 Copy .env.example to .env and fill in the values\n');
    process.exit(1);
  }

  console.log('\n✅ Core environment variables present');
  console.log(`📂 Database directory: ${process.env.DATABASE_DIR || 'C:/Users/amank/OneDrive/Desktop/Ecommerce/ecommerce-backend/data'} (configured via DATABASE_DIR)`);

  const whatsappRequired = ['WHATSAPP_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'WEBHOOK_VERIFY_TOKEN'];
  const whatsappMissing  = whatsappRequired.filter(key => !process.env[key]);

  if (whatsappMissing.length > 0) {
    console.log('⚠️  WhatsApp Webhook keys missing:', whatsappMissing.join(', '));
    console.log('👉 Live WhatsApp channel is inactive. React Web Chat Demo remains active.\n');
  } else {
    console.log('✅ WhatsApp Meta API keys present. Live webhook channel is active.\n');
  }
}

// ---- START SERVER ----
app.listen(PORT, () => {
  console.log('\n🚀 WhatsApp AI Support Agent');
  console.log('================================');
  checkEnvironment();
  console.log(`🌐 Server running on port ${PORT}`);
  console.log(`📡 Webhook endpoint: POST /webhook`);
  console.log(`📊 Dashboard: GET /api/dashboard`);
  console.log(`🏥 Health check: GET /api/dashboard/health`);
  console.log('================================\n');
});

module.exports = app;
