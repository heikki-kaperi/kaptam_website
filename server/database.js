/**
 * SQLite Database Module using sql.js
 * Handles cart storage and retrieval
 * sql.js is a pure JavaScript SQLite implementation (no native compilation needed)
 */

const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

let db;
const DB_PATH = path.join(__dirname, 'data', 'carts.db');

// Initialize database
async function init() {
  const SQL = await initSqlJs();

  // Load existing database or create new one
  try {
    if (fs.existsSync(DB_PATH)) {
      const fileBuffer = fs.readFileSync(DB_PATH);
      db = new SQL.Database(fileBuffer);
      console.log('Database loaded from file');
    } else {
      db = new SQL.Database();
      console.log('New database created');
    }
  } catch (err) {
    console.error('Error loading database, creating new one:', err);
    db = new SQL.Database();
  }

  // Create carts table if it doesn't exist
  db.run(`
    CREATE TABLE IF NOT EXISTS carts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      items TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT,
      controller TEXT DEFAULT 'controller',
      additionalInfo TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )
  `);

  // Create index on code for faster lookups
  db.run(`CREATE INDEX IF NOT EXISTS idx_carts_code ON carts(code)`);

  // Save to file
  saveDatabase();

  console.log('Database initialized');

  // Clean up expired carts (older than 30 days)
  cleanupExpiredCarts();
}

// Save database to file
function saveDatabase() {
  if (!db) return;

  try {
    const data = db.export();
    const buffer = Buffer.from(data);

    // Ensure data directory exists
    const dataDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    fs.writeFileSync(DB_PATH, buffer);
  } catch (err) {
    console.error('Error saving database:', err);
  }
}

// Save new cart
function saveCart(cartData) {
  const stmt = db.prepare(`
    INSERT INTO carts (code, items, name, email, controller, additionalInfo, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run([
    cartData.code,
    cartData.items,
    cartData.name,
    cartData.email,
    cartData.controller,
    cartData.additionalInfo,
    cartData.createdAt,
    cartData.updatedAt
  ]);

  stmt.free();
  saveDatabase();

  return { changes: 1 };
}

// Get cart by code
function getCartByCode(code) {
  const stmt = db.prepare('SELECT * FROM carts WHERE code = ?');
  stmt.bind([code]);

  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }

  stmt.free();
  return null;
}

// Update existing cart
function updateCart(cartData) {
  const stmt = db.prepare(`
    UPDATE carts
    SET items = ?,
        name = ?,
        email = ?,
        controller = ?,
        additionalInfo = ?,
        updatedAt = ?
    WHERE code = ?
  `);

  stmt.run([
    cartData.items,
    cartData.name,
    cartData.email,
    cartData.controller,
    cartData.additionalInfo,
    cartData.updatedAt,
    cartData.code
  ]);

  stmt.free();
  saveDatabase();

  return { changes: db.getRowsModified() };
}

// Delete cart by code
function deleteCart(code) {
  const stmt = db.prepare('DELETE FROM carts WHERE code = ?');
  stmt.run([code]);
  stmt.free();
  saveDatabase();

  return { changes: db.getRowsModified() };
}

// Clean up carts older than 30 days
function cleanupExpiredCarts() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const cutoffDate = thirtyDaysAgo.toISOString();

  const stmt = db.prepare('DELETE FROM carts WHERE createdAt < ?');
  stmt.run([cutoffDate]);
  stmt.free();

  const changes = db.getRowsModified();
  if (changes > 0) {
    console.log(`Cleaned up ${changes} expired cart(s)`);
    saveDatabase();
  }
}

// Get all carts (for admin purposes)
function getAllCarts() {
  const results = [];
  const stmt = db.prepare('SELECT * FROM carts ORDER BY createdAt DESC');

  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }

  stmt.free();
  return results;
}

// Close database connection
function close() {
  if (db) {
    saveDatabase();
    db.close();
  }
}

module.exports = {
  init,
  saveCart,
  getCartByCode,
  updateCart,
  deleteCart,
  cleanupExpiredCarts,
  getAllCarts,
  close
};
