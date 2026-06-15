// src/config/brands.js
// ============================================================
// BRAND CONFIGURATION
// Each brand gets their own AI "brain" — return policy,
// product catalog, tone, couriers, and FAQ knowledge base.
// For the demo, we use "Riya's Boutique" as a sample brand.
// In production, each paying customer gets their own config.
// ============================================================

const brands = {

  // ---- DEMO BRAND (for YES2026 summit demo) ----
  demo: {
    id: 'demo',
    name: "Riya's Boutique",
    category: 'fashion',
    language: 'hinglish', // hinglish | english | hindi
    tone: 'friendly',     // friendly | formal | casual

    // WhatsApp number linked to this brand
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,

    // Return & refund policy — AI learns this
    returnPolicy: `
      - Returns accepted within 7 days of delivery
      - Product must be unused, unwashed, with original tags
      - Free pickup from your doorstep
      - Refund processed in 5-7 business days to original payment method
      - Exchange available for size/color — same or higher value only
      - Sale items: exchange only, no refund
      - Damaged or defective items: full refund + return shipping covered by us
    `,

    // Couriers used — AI can look up tracking
    couriers: ['Delhivery', 'Shiprocket', 'XpressBees', 'BlueDart'],

    // Product catalog — for product questions
    get products() {
      try {
        const csvStore = require('../utils/csvStore');
        return csvStore.loadProducts();
      } catch (err) {
        console.error('Error loading products from CSV:', err);
        return [];
      }
    },

    // Shipping info
    shipping: {
      freeAbove: 599,
      standardCharge: 79,
      estimatedDays: '3-5 business days',
      expressAvailable: false,
      codAvailable: true,
      codCharge: 49,
    },

    // Frequently asked questions
    faqs: [
      { q: 'Do you ship internationally?', a: 'Currently we ship only within India. International shipping coming soon!' },
      { q: 'What payment methods do you accept?', a: 'UPI, Cards (Visa/Mastercard), Net Banking, and Cash on Delivery (COD).' },
      { q: 'How do I track my order?', a: 'Once shipped, you get a tracking link on WhatsApp and SMS automatically.' },
      { q: 'Can I cancel my order?', a: 'Orders can be cancelled within 2 hours of placing. After that, wait for delivery and then return.' },
      { q: 'Are the colors accurate in photos?', a: 'We try our best! Colors may vary slightly due to screen settings. Check product description for fabric details.' },
    ],

    // Greeting message
    greeting: "Hii! 💕 Main Riya's Boutique se Riya baat kar rahi hoon. Kaise help kar sakti hoon aapki? 😊\n\n1️⃣ Order track karein 📦\n2️⃣ Return/Exchange 🔄\n3️⃣ Product info 👗\n4️⃣ Human se baat karein 👩‍💼",

    // Escalation trigger — hand off to human
    escalationTriggers: ['angry', 'frustrated', 'lawsuit', 'consumer court', 'fraud', 'cheat', 'refund stuck'],
    escalationMessage: "Aapki baat samajh aa gayi. Main abhi humare senior support executive ko connect kar raha hoon. 2 minutes mein aapse contact karenge. 🙏",
  },

  // ---- TEMPLATE FOR REAL CUSTOMER ONBOARDING ----
  // When a real D2C brand signs up, you create a config like this
  template: {
    id: '',          // unique brand ID
    name: '',        // brand name
    category: '',    // fashion | beauty | food | electronics | home
    language: 'hinglish',
    tone: 'friendly',
    phoneNumberId: '',
    returnPolicy: '', // paste their return policy here
    couriers: [],
    products: [],
    shipping: {},
    faqs: [],
    greeting: '',
    escalationTriggers: [],
    escalationMessage: '',
  }
};

const fs = require('fs');
const path = require('path');
const CUSTOM_BRANDS_FILE = path.join(__dirname, 'customBrands.json');

// Helper to load custom brands from file
function loadCustomBrands() {
  try {
    if (fs.existsSync(CUSTOM_BRANDS_FILE)) {
      const data = fs.readFileSync(CUSTOM_BRANDS_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading custom brands:', error.message);
  }
  return {};
}

// Helper to save custom brands to file
function writeCustomBrands(data) {
  try {
    fs.writeFileSync(CUSTOM_BRANDS_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.error('Error saving custom brands:', error.message);
  }
}

const customBrands = loadCustomBrands();
Object.assign(brands, customBrands);

// Ensure the demo brand products are always loaded dynamically from CSV
Object.defineProperty(brands.demo, 'products', {
  get() {
    try {
      const csvStore = require('../utils/csvStore');
      return csvStore.loadProducts();
    } catch (err) {
      console.error('Error loading products from CSV:', err);
      return [];
    }
  },
  configurable: true,
  enumerable: true
});


// Get brand config by phone number ID (for routing incoming messages)
function getBrandByPhoneId(phoneNumberId) {
  return Object.values(brands).find(b => b.phoneNumberId === phoneNumberId) || brands.demo;
}

// Get brand by ID
function getBrandById(id) {
  return brands[id] || brands.demo;
}

function addOrUpdateCustomBrand(brandData) {
  const brandId = brandData.id;
  const formattedBrand = {
    id: brandId,
    name: brandData.name,
    category: brandData.category || 'general',
    language: brandData.language || 'hinglish',
    tone: brandData.tone || 'friendly',
    phoneNumberId: brandData.phoneNumberId || brandId,
    returnPolicy: brandData.returnPolicy || '- Returns accepted within 7 days.\n- Must be unused.',
    couriers: brandData.couriers || ['Delhivery', 'BlueDart'],
    products: brandData.products || [],
    shipping: brandData.shipping || { freeAbove: 599, standardCharge: 79, estimatedDays: '3-5 days', codAvailable: true, codCharge: 49 },
    faqs: brandData.faqs || [],
    greeting: brandData.greeting || `Namaste! Welcome to ${brandData.name}. How can we help you today?`,
    escalationTriggers: brandData.escalationTriggers || ['angry', 'human'],
    escalationMessage: brandData.escalationMessage || 'We are connecting you to a senior support agent shortly.',
    model: brandData.model || 'google/gemma-4-31b-it:free',
    modelName: brandData.modelName || '',
    orders: brandData.orders || '?',
    notes: brandData.notes || '',
    status: brandData.status || 'warm'
  };

  customBrands[brandId] = formattedBrand;
  writeCustomBrands(customBrands);
  brands[brandId] = formattedBrand;
  return formattedBrand;
}

function removeCustomBrand(id) {
  if (customBrands[id]) {
    delete customBrands[id];
    writeCustomBrands(customBrands);
  }
  if (brands[id]) {
    delete brands[id];
  }
}

module.exports = {
  brands,
  getBrandByPhoneId,
  getBrandById,
  addOrUpdateCustomBrand,
  removeCustomBrand
};
