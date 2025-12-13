/**
 * Kaptam Cart Server
 * Express server for handling shopping cart submissions
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const database = require('./database');
const email = require('./email');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: ['http://127.0.0.1:5500', 'http://localhost:5500', 'http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT'],
  credentials: true
}));
app.use(express.json());

// Generate cart code (format: K4PT-XXXX)
function generateCartCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluded confusing chars: I, O, 0, 1
  let code = 'K';
  for (let i = 0; i < 3; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  code += '-';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Submit new cart
app.post('/api/cart/submit', async (req, res) => {
  try {
    const { items, name, email: userEmail, controller, additionalInfo } = req.body;

    // Validation
    if (!items || items.length === 0) {
      return res.status(400).json({ message: 'Cart is empty' });
    }
    if (!name || name.trim() === '') {
      return res.status(400).json({ message: 'Name is required' });
    }

    // Generate unique code
    let code;
    let attempts = 0;
    do {
      code = generateCartCode();
      attempts++;
    } while (database.getCartByCode(code) && attempts < 10);

    if (attempts >= 10) {
      return res.status(500).json({ message: 'Failed to generate unique code' });
    }

    // Save to database
    const cartData = {
      code,
      items: JSON.stringify(items),
      name: name.trim(),
      email: userEmail ? userEmail.trim() : null,
      controller: controller || 'controller',
      additionalInfo: additionalInfo ? additionalInfo.trim() : null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    database.saveCart(cartData);

    // Send emails
    const siteUrl = process.env.SITE_URL || 'http://127.0.0.1:5500';
    const modifyLink = `${siteUrl}/en/checkout.html?code=${code}`;

    // Send to admin
    await email.sendOrderNotification({
      ...cartData,
      items,
      modifyLink
    });

    // Send to user if email provided
    if (userEmail) {
      await email.sendUserConfirmation({
        ...cartData,
        items,
        modifyLink
      });
    }

    res.json({ success: true, code });

  } catch (error) {
    console.error('Error submitting cart:', error);
    res.status(500).json({ message: 'Failed to submit order' });
  }
});

// Get cart by code
app.get('/api/cart/:code', (req, res) => {
  try {
    const { code } = req.params;
    const cart = database.getCartByCode(code.toUpperCase());

    if (!cart) {
      return res.status(404).json({ message: 'Cart not found. Please check your code.' });
    }

    // Check if expired (30 days)
    const createdAt = new Date(cart.createdAt);
    const now = new Date();
    const daysDiff = (now - createdAt) / (1000 * 60 * 60 * 24);

    if (daysDiff > 30) {
      return res.status(410).json({ message: 'This cart code has expired (older than 30 days)' });
    }

    res.json({
      code: cart.code,
      items: JSON.parse(cart.items),
      name: cart.name,
      email: cart.email,
      controller: cart.controller,
      additionalInfo: cart.additionalInfo,
      createdAt: cart.createdAt
    });

  } catch (error) {
    console.error('Error getting cart:', error);
    res.status(500).json({ message: 'Failed to retrieve cart' });
  }
});

// Update existing cart
app.put('/api/cart/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const { items, name, email: userEmail, controller, additionalInfo } = req.body;

    // Check if cart exists
    const existingCart = database.getCartByCode(code.toUpperCase());
    if (!existingCart) {
      return res.status(404).json({ message: 'Cart not found' });
    }

    // Validation
    if (!items || items.length === 0) {
      return res.status(400).json({ message: 'Cart is empty' });
    }
    if (!name || name.trim() === '') {
      return res.status(400).json({ message: 'Name is required' });
    }

    // Update in database
    const cartData = {
      code: code.toUpperCase(),
      items: JSON.stringify(items),
      name: name.trim(),
      email: userEmail ? userEmail.trim() : null,
      controller: controller || 'controller',
      additionalInfo: additionalInfo ? additionalInfo.trim() : null,
      updatedAt: new Date().toISOString()
    };

    database.updateCart(cartData);

    // Send update notification emails
    const siteUrl = process.env.SITE_URL || 'http://127.0.0.1:5500';
    const modifyLink = `${siteUrl}/en/checkout.html?code=${code.toUpperCase()}`;

    // Send to admin
    await email.sendOrderUpdateNotification({
      ...cartData,
      items,
      modifyLink
    });

    // Send to user if email provided
    if (userEmail) {
      await email.sendUserUpdateConfirmation({
        ...cartData,
        items,
        modifyLink
      });
    }

    res.json({ success: true, code: code.toUpperCase() });

  } catch (error) {
    console.error('Error updating cart:', error);
    res.status(500).json({ message: 'Failed to update order' });
  }
});

// Initialize database and start server
async function startServer() {
  await database.init();

  app.listen(PORT, () => {
    console.log(`Kaptam Cart Server running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
