const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATABASE_DIR || 'C:/Users/amank/OneDrive/Desktop/Ecommerce/ecommerce-backend/data';

console.log(`[CSV STORE] Initialized. Data directory: ${DATA_DIR}`);

// Helper to parse a single CSV line, handling quotes and commas inside quotes
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

// Generic CSV file reader
function readCSV(fileName) {
  const filePath = path.join(DATA_DIR, fileName);
  if (!fs.existsSync(filePath)) {
    console.warn(`[CSV STORE] File not found: ${filePath}`);
    return [];
  }
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length < 2) return [];

    const headers = parseCSVLine(lines[0]);
    const records = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = values[index] !== undefined ? values[index] : '';
      });
      records.push(obj);
    }
    return records;
  } catch (error) {
    console.error(`[CSV STORE] Error reading ${fileName}:`, error.message);
    return [];
  }
}

// Load products and map to AI agent structure
function loadProducts() {
  const rawProducts = readCSV('products.csv');
  return rawProducts
    .filter(p => (p.is_active || '').toLowerCase().trim() === 'true')
    .map(p => {
      // Default sizes and colors since they are not separate columns in products.csv
      // But we can extract them if they are in description or title
      return {
        id: p.id,
        name: p.name,
        description: p.description || '',
        price: parseFloat(p.price) || 0,
        sizes: ['S', 'M', 'L', 'XL'],
        colors: ['As shown'],
        inStock: parseInt(p.stock || 0) > 0,
        imageUrl: p.image_url || '',
        brand: p.brand || '',
        sku: p.sku || '',
        category: p.category || ''
      };
    });
}

// Load all orders
function loadOrders() {
  return readCSV('orders.csv');
}

// Load order items
function loadOrderItems() {
  return readCSV('order_items.csv');
}

// Load users
function loadUsers() {
  return readCSV('users.csv');
}

module.exports = {
  loadProducts,
  loadOrders,
  loadOrderItems,
  loadUsers
};
