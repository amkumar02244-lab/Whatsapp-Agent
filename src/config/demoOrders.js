// src/config/demoOrders.js
// ============================================================
// DEMO ORDER DATABASE
// In production, this gets replaced by live Shopify API calls.
// For the YES2026 demo, these are fake orders that look real.
// ============================================================

const demoOrders = {
  // Format: order number → order details
  '1001': {
    orderId: '#1001',
    customer: { name: 'Priya Sharma', phone: '9876543210' },
    product: 'Anarkali Kurta Set (Red, Size M)',
    amount: 1499,
    paymentMethod: 'UPI',
    status: 'delivered',
    placedOn: '2 June 2026',
    deliveredOn: '5 June 2026',
    courier: 'Delhivery',
    trackingId: 'DELY123456789',
    trackingUrl: 'https://www.delhivery.com/track/DELY123456789',
    address: 'Banjara Hills, Hyderabad',
  },
  '1002': {
    orderId: '#1002',
    customer: { name: 'Anjali Reddy', phone: '9876543211' },
    product: 'Cotton Palazzo Set (Pink, Size L)',
    amount: 999,
    paymentMethod: 'COD',
    status: 'out_for_delivery',
    placedOn: '6 June 2026',
    estimatedDelivery: 'Today by 7pm',
    courier: 'XpressBees',
    trackingId: 'XB987654321',
    trackingUrl: 'https://www.xpressbees.com/track/XB987654321',
    address: 'Madhapur, Hyderabad',
  },
  '1003': {
    orderId: '#1003',
    customer: { name: 'Meera Nair', phone: '9876543212' },
    product: 'Festive Lehenga Set (Red & Gold, Size S)',
    amount: 3499,
    paymentMethod: 'Card',
    status: 'processing',
    placedOn: '7 June 2026',
    estimatedShipBy: '9 June 2026',
    estimatedDelivery: '11-13 June 2026',
    courier: null,
    trackingId: null,
    address: 'Jubilee Hills, Hyderabad',
  },
  '1004': {
    orderId: '#1004',
    customer: { name: 'Sunita Verma', phone: '9876543213' },
    product: 'Silk Dupatta (Gold)',
    amount: 599,
    paymentMethod: 'UPI',
    status: 'shipped',
    placedOn: '5 June 2026',
    estimatedDelivery: '8-9 June 2026',
    courier: 'Shiprocket',
    trackingId: 'SR456789012',
    trackingUrl: 'https://shiprocket.co/tracking/SR456789012',
    address: 'Secunderabad',
  },
  '1005': {
    orderId: '#1005',
    customer: { name: 'Kavitha Kumar', phone: '9876543214' },
    product: 'Cotton Palazzo Set (White, Size M)',
    amount: 999,
    paymentMethod: 'COD',
    status: 'returned',
    placedOn: '28 May 2026',
    returnReason: 'Size issue',
    returnStatus: 'Refund processed',
    refundAmount: 999,
    refundDate: '4 June 2026',
    address: 'LB Nagar, Hyderabad',
  },
};

// Status messages in Hinglish for each order state
const statusMessages = {
  processing: (order) => `📦 Aapka order ${order.orderId} abhi process ho raha hai.\n\n🗓️ Expected ship by: ${order.estimatedShipBy}\n📍 Estimated delivery: ${order.estimatedDelivery}\n\nShip hone pe tracking link bhejenge! 😊`,

  shipped: (order) => `🚚 Aapka order ${order.orderId} ship ho gaya hai!\n\n📦 Courier: ${order.courier}\n🔍 Tracking ID: ${order.trackingId}\n📍 Estimated delivery: ${order.estimatedDelivery}\n\nTrack here 👉 ${order.trackingUrl}`,

  out_for_delivery: (order) => `🎉 Khushkhabri! Aapka order ${order.orderId} aaj deliver hoga!\n\n⏰ Expected: ${order.estimatedDelivery}\n📦 Courier: ${order.courier}\n\nDelivery partner call kar sakta hai — phone reachable rakhein! 📱`,

  delivered: (order) => `✅ Aapka order ${order.orderId} deliver ho gaya tha!\n\n📅 Delivered on: ${order.deliveredOn}\n\nHumein umeed hai aapko product pasand aaya hoga! 💕\nKoi problem ho to reply karein — hum help karenge.`,

  returned: (order) => `🔄 Order ${order.orderId} return processed hai.\n\n💰 Refund: ₹${order.refundAmount}\n✅ Refund date: ${order.refundDate}\n📍 Refund method: Original payment method\n\nKoi aur help chahiye? 😊`,
};

function normalizePhone(phone) {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  return digits.length > 10 ? digits.slice(-10) : digits;
}

function formatDate(isoString) {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  } catch (e) {
    return isoString;
  }
}

function formatDatePlusDays(isoString, days) {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    d.setDate(d.getDate() + days);
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  } catch (e) {
    return '';
  }
}

function getOrderStatus(orderNumber, customerPhone) {
  try {
    const csvStore = require('../utils/csvStore');
    const orders = csvStore.loadOrders();
    const orderItems = csvStore.loadOrderItems();
    const products = csvStore.loadProducts();
    const users = csvStore.loadUsers();

    let matchedOrder = null;

    // 1. Search by Order Number / UUID / User ID / Phone Number
    if (orderNumber) {
      const cleanId = orderNumber.replace('#', '').trim().toLowerCase();
      
      // A. Try exact match or prefix match on Order ID
      matchedOrder = orders.find(o => 
        o.id.toLowerCase() === cleanId || 
        o.id.toLowerCase().startsWith(cleanId)
      );

      // B. Try match on User ID if not found by Order ID
      if (!matchedOrder) {
        matchedOrder = orders.find(o => 
          o.user_id.toLowerCase() === cleanId || 
          o.user_id.toLowerCase().startsWith(cleanId)
        );
      }

      // C. Try match on Phone Number
      if (!matchedOrder) {
        const queryPhone = normalizePhone(cleanId);
        if (queryPhone && queryPhone.length >= 10) {
          const matchedUsers = users.filter(u => normalizePhone(u.phone) === queryPhone);
          const userIds = matchedUsers.map(u => u.id);
          if (userIds.length > 0) {
            const userOrders = orders.filter(o => userIds.includes(o.user_id));
            if (userOrders.length > 0) {
              userOrders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
              matchedOrder = userOrders[0];
            }
          }
        }
      }
    }

    // 2. If not found by ID, try looking up by customer's phone number
    if (!matchedOrder && customerPhone) {
      const normalizedQueryPhone = normalizePhone(customerPhone);
      if (normalizedQueryPhone) {
        // Find users matching this phone number
        const matchedUsers = users.filter(u => normalizePhone(u.phone) === normalizedQueryPhone);
        const userIds = matchedUsers.map(u => u.id);
        
        if (userIds.length > 0) {
          // Get all orders for these users
          const userOrders = orders.filter(o => userIds.includes(o.user_id));
          
          if (userOrders.length > 0) {
            // Sort by created_at descending (most recent first)
            userOrders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            matchedOrder = userOrders[0];
          }
        }
      }
    }

    // 3. If found in CSV database, build the dynamic order object
    if (matchedOrder) {
      const orderUser = users.find(u => u.id === matchedOrder.user_id);
      const userName = orderUser ? `${orderUser.first_name} ${orderUser.last_name || ''}`.trim() : 'Customer';
      const userPhone = orderUser ? orderUser.phone : '';

      // Get items for this order
      const items = orderItems.filter(item => item.order_id === matchedOrder.id);
      const itemDetails = items.map(item => {
        const product = products.find(p => p.id === item.product_id);
        const name = product ? product.name : 'Boutique Purchase';
        return `${name} (x${item.quantity})`;
      });

      const formattedOrder = {
        orderId: '#' + matchedOrder.id.slice(0, 8), // Display shorter ID prefix
        fullOrderId: matchedOrder.id,
        customer: { name: userName, phone: userPhone },
        product: itemDetails.join(', ') || 'E-commerce Purchase',
        amount: parseFloat(matchedOrder.total_amount) || 0,
        paymentMethod: 'Online',
        status: matchedOrder.status || 'pending',
        placedOn: formatDate(matchedOrder.created_at),
        estimatedShipBy: formatDatePlusDays(matchedOrder.created_at, 2),
        estimatedDelivery: formatDatePlusDays(matchedOrder.created_at, 5),
        deliveredOn: matchedOrder.status === 'delivered' ? formatDate(matchedOrder.updated_at || matchedOrder.created_at) : null,
        courier: matchedOrder.status === 'shipped' || matchedOrder.status === 'delivered' ? 'Delhivery' : null,
        trackingId: matchedOrder.status === 'shipped' || matchedOrder.status === 'delivered' ? 'DELY' + matchedOrder.id.slice(0, 8).toUpperCase() : null,
        trackingUrl: matchedOrder.status === 'shipped' || matchedOrder.status === 'delivered' ? `https://www.delhivery.com/track/DELY${matchedOrder.id.slice(0, 8).toUpperCase()}` : null,
        address: 'Your Registered Address',
      };

      const messageFunc = statusMessages[formattedOrder.status];
      const message = messageFunc ? messageFunc(formattedOrder) : `Order ${formattedOrder.orderId} ki status: ${formattedOrder.status}`;
      return { order: formattedOrder, message };
    }
  } catch (error) {
    console.error('Error loading order from CSV database:', error.message);
  }

  // 4. FALLBACK: search in static demoOrders
  if (orderNumber) {
    const cleanId = orderNumber.replace('#', '').trim();
    const order = demoOrders[cleanId];
    if (order) {
      const messageFunc = statusMessages[order.status];
      const message = messageFunc ? messageFunc(order) : `Order ${order.orderId} ki status: ${order.status}`;
      return { order, message };
    }
  }

  return null;
}

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function placeNewOrder({ customerName, customerPhone, productName, size, color, quantity, address }) {
  const csvStore = require('../utils/csvStore');
  const DATA_DIR = process.env.DATABASE_DIR || 'C:/Users/amank/OneDrive/Desktop/Ecommerce/ecommerce-backend/data';
  
  const orderId = crypto.randomUUID();
  const userId = crypto.randomUUID();
  const qty = parseInt(quantity) || 1;
  
  // Find product details
  const products = csvStore.loadProducts();
  const product = products.find(p => 
    p.name.toLowerCase().includes(productName.toLowerCase()) || 
    productName.toLowerCase().includes(p.name.toLowerCase())
  ) || products[0]; // Fallback to first if not found, to be safe in demo
  
  const totalAmount = (product ? product.price : 1499) * qty;
  const now = new Date().toISOString();
  
  // Create user record in users.csv if not exists
  const users = csvStore.loadUsers();
  let existingUser = users.find(u => normalizePhone(u.phone) === normalizePhone(customerPhone));
  let finalUserId = userId;
  
  if (existingUser) {
    finalUserId = existingUser.id;
  } else {
    // Append to users.csv
    const first = customerName.split(' ')[0] || 'Customer';
    const last = customerName.split(' ').slice(1).join(' ') || '';
    const userRow = `${userId},${first},${last},${normalizePhone(customerPhone)}@demo.com,,customer,True,True,${customerPhone},,${now},${now}`;
    appendRowToCSV(path.join(DATA_DIR, 'users.csv'), userRow);
  }
  
  // Append to orders.csv
  const orderRow = `${orderId},${finalUserId},${totalAmount},processing,${now},${now}`;
  appendRowToCSV(path.join(DATA_DIR, 'orders.csv'), orderRow);
  
  // Append to order_items.csv
  const itemId = crypto.randomUUID();
  const itemRow = `${itemId},${orderId},${product.id},${qty},${product.price},${now},${now}`;
  appendRowToCSV(path.join(DATA_DIR, 'order_items.csv'), itemRow);
  
  // Also add to static demoOrders for fallback
  const shortId = orderId.slice(0, 8);
  demoOrders[shortId] = {
    orderId: '#' + shortId,
    fullOrderId: orderId,
    customer: { name: customerName, phone: customerPhone },
    product: `${product.name} (${color || 'As shown'}, Size ${size || 'M'}) (x${qty})`,
    amount: totalAmount,
    paymentMethod: 'COD',
    status: 'processing',
    placedOn: formatDate(now),
    estimatedShipBy: formatDatePlusDays(now, 2),
    estimatedDelivery: formatDatePlusDays(now, 5),
    address: address,
  };
  
  return demoOrders[shortId];
}

function appendRowToCSV(filePath, row) {
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    const hasNewline = content.endsWith('\n') || content.endsWith('\r');
    const lineToWrite = hasNewline ? row : '\n' + row;
    fs.appendFileSync(filePath, lineToWrite, 'utf8');
  } else {
    fs.writeFileSync(filePath, row, 'utf8');
  }
}

module.exports = { demoOrders, getOrderStatus, placeNewOrder };
