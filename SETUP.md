# 🚀 WhatsApp AI Support Agent — Complete Setup Guide
## From Zero to Live Demo in ~2 Hours

---

## WHAT YOU'RE BUILDING

```
Customer WhatsApp → Meta Cloud API → Your Server (Node.js)
                                           ↓
                                    Intent Detection
                                           ↓
                              Order DB / Claude AI
                                           ↓
                              Reply → WhatsApp → Customer
```

---

## STEP 1: Install Prerequisites (10 minutes)

### Install Node.js
```bash
# Check if you have it
node --version   # Need v18+

# If not, download from nodejs.org
# Or use nvm (recommended):
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18
```

### Clone and install project
```bash
# Navigate to where you want the project
cd ~/Desktop

# Install dependencies
cd whatsapp-ai-agent
npm install

# Copy environment template
cp .env.example .env
```

---

## STEP 2: Get API Keys (30 minutes)

### 2a. Anthropic (Claude) API Key
1. Go to **console.anthropic.com**
2. Sign up / Log in
3. Click "API Keys" → "Create Key"
4. Copy the key → paste in `.env` as `ANTHROPIC_API_KEY`
5. Add $5 credit to start (enough for thousands of messages)

### 2b. Meta WhatsApp Cloud API
This is the slightly involved part — follow carefully:

**Create Meta Developer App:**
1. Go to **developers.facebook.com**
2. Click "My Apps" → "Create App"
3. Choose "Business" type
4. Give it a name (e.g., "D2C Support Demo")
5. Click "Add Product" → find "WhatsApp" → click "Set Up"

**Get Phone Number ID:**
1. In your app, go to WhatsApp → API Setup
2. You'll see a "From" phone number — this is your test number
3. Copy the **Phone Number ID** (a long number like 123456789012345)
4. Paste in `.env` as `WHATSAPP_PHONE_NUMBER_ID`

**Get Access Token:**
1. On the same page, click "Generate token" (temporary) to test
2. For permanent token: Business Settings → System Users → Create → Generate Token
3. Paste in `.env` as `WHATSAPP_TOKEN`

**Add your phone as test recipient:**
1. In API Setup, under "To" — add your personal WhatsApp number
2. Click "Send message" to test — you should receive a WhatsApp

### 2c. Set Webhook Verify Token
- Open `.env` 
- Set `WEBHOOK_VERIFY_TOKEN=anyrandomstring123` (you choose this)

---

## STEP 3: Test Locally (5 minutes)

```bash
# Fill in your .env file first, then:
npm run test

# You'll see an interactive chat in your terminal
# Try: "hi", "order 1002", "return karna hai"
```

Expected output:
```
You: mera order 1002 kahan hai
[Intent: order_tracking]

🤖 Riya's Boutique:
🎉 Khushkhabri! Aapka order #1002 aaj deliver hoga!
⏰ Expected: Today by 7pm
📦 Courier: XpressBees
```

---

## STEP 4: Deploy to Internet (20 minutes)

Your server needs a public HTTPS URL for Meta's webhook.
**Render.com is the best option** — free tier, auto HTTPS.

### Deploy to Render (recommended)
```bash
# 1. Push your code to GitHub
git init
git add .
git commit -m "Initial commit"
# Create a new repo on github.com, then:
git remote add origin https://github.com/YOUR_USERNAME/whatsapp-ai-agent.git
git push -u origin main

# 2. Go to render.com
# Click "New +" → "Web Service"
# Connect your GitHub repo
# Settings:
#   Build command: npm install
#   Start command: node src/index.js
#   Environment: Node

# 3. Add environment variables in Render dashboard
# (same keys as your .env file)

# 4. Deploy! Render gives you a URL like:
# https://whatsapp-ai-agent.onrender.com
```

### Alternative: Railway ($5/month, faster deploys)
```bash
npm install -g @railway/cli
railway login
railway init
railway up
# Get URL from Railway dashboard
```

---

## STEP 5: Connect Webhook to Meta (10 minutes)

1. Go to **developers.facebook.com** → Your App → WhatsApp → Configuration
2. Under "Webhook", click "Edit"
3. **Callback URL**: `https://your-render-url.onrender.com/webhook`
4. **Verify Token**: same as `WEBHOOK_VERIFY_TOKEN` in your .env
5. Click "Verify and Save"
6. Under "Webhook fields", subscribe to: **messages**
7. ✅ Done! Messages now flow to your server.

---

## STEP 6: Test End-to-End

1. Send a WhatsApp message to your test number
2. Check your Render logs (render.com → your service → Logs)
3. You should see the message arrive and a reply sent

---

## FOR THE YES2026 DEMO (No WhatsApp API needed!)

You have 2 options for the summit demo:

### Option A: Use the test script (easiest)
```bash
npm run test
# Hand your laptop to the founder
# They type messages, they see AI replies
```

### Option B: Screen share on phone
- Run the test script
- Open a screen sharing app
- Show your terminal on your phone screen
- As they watch, type their "What would my customers ask?" messages

### Option C: WhatsApp QR demo
- Get your Render URL live before the summit
- Set up the actual WhatsApp webhook
- Generate QR code at: wa.me/+91YOURDEMOPHONENUMBER
- Print 20 cards, hand them out, let founders scan and try it

---

## FOLDER STRUCTURE

```
whatsapp-ai-agent/
├── src/
│   ├── index.js                 ← Main server
│   ├── routes/
│   │   ├── webhook.js           ← WhatsApp webhook
│   │   └── dashboard.js         ← Analytics API
│   ├── services/
│   │   ├── claudeService.js     ← AI brain (Claude)
│   │   ├── whatsappService.js   ← Send/receive messages
│   │   └── messageHandler.js   ← Orchestrator
│   └── config/
│       ├── brands.js            ← Brand configs
│       └── demoOrders.js       ← Demo order data
├── demo/
│   └── test-agent.js           ← Local test (no WhatsApp needed)
├── .env.example                 ← Copy to .env
├── package.json
└── SETUP.md                    ← This file
```

---

## COST BREAKDOWN

| Item | Cost |
|------|------|
| Render.com hosting | Free (or $7/mo for always-on) |
| Anthropic API | ~₹0.08 per conversation (20 messages) |
| Meta WhatsApp API | Free for customer-initiated (first 24h) |
| **Total for demo (1000 conversations)** | **~₹80–100** |

At 100 paying customers on ₹2,499/mo plan:
- Revenue: ₹2,49,900/mo
- AI cost: ~₹800–2,000/mo  
- Hosting: ~₹600/mo
- **Gross margin: ~98%**

---

## ADDING A REAL BRAND (when you get your first customer)

1. Open `src/config/brands.js`
2. Add a new entry following the template
3. Fill in: return policy, product catalog, tone, couriers
4. Get their WhatsApp Business API number
5. Set up their webhook
6. Done — their customers now get AI support

---

## TROUBLESHOOTING

**"Missing environment variables" on startup**
→ Check .env file exists and all values are filled

**Webhook verification fails**
→ Make sure WEBHOOK_VERIFY_TOKEN in .env matches what you entered in Meta dashboard

**AI not responding in Hinglish**
→ Check brand.language is set to 'hinglish' in brands.js

**"Could not parse message payload"**
→ Normal for delivery receipts — not a real error

**Claude API error**
→ Check ANTHROPIC_API_KEY is correct and has credits

---

## NEXT STEPS (after the demo works)

1. **Add Shopify integration** — replace demoOrders.js with real Shopify API calls
2. **Add Delhivery/Shiprocket tracking** — real courier tracking
3. **Build a web dashboard** — React frontend to show analytics to brand owners
4. **Multi-brand support** — separate WhatsApp numbers per brand
5. **Voice support** — WhatsApp audio message transcription + response
