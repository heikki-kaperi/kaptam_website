/**
 * Database operations using better-sqlite3
 * Handles reservations with improved error handling and date tracking
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || './data/reservations.db';
let db;

/**
 * Initialize database and create tables
 */
function initialize() {
  try {
    // Ensure directory exists
    const dbDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
      console.log(`Created database directory: ${dbDir}`);
    }

    // Open database connection
    db = new Database(DB_PATH);
    console.log(`Database opened at: ${DB_PATH}`);

    // Enable WAL mode for better concurrency
    db.pragma('journal_mode = WAL');

    // Create reservations table
    const createReservationsTable = `
      CREATE TABLE IF NOT EXISTS reservations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        items TEXT NOT NULL,
        name TEXT NOT NULL,
        email TEXT,
        controller TEXT NOT NULL,
        additionalInfo TEXT,
        date TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT
      )
    `;

    db.exec(createReservationsTable);

    // Create indexes for faster lookups
    db.exec('CREATE INDEX IF NOT EXISTS idx_code ON reservations(code)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_date ON reservations(date)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_createdAt ON reservations(createdAt)');

    console.log('Database tables and indexes created successfully');

    // Clean up old reservations
    cleanupOldReservations();

    return true;
  } catch (error) {
    console.error('Database initialization failed:', error);
    throw error;
  }
}

/**
 * Create a new reservation
 */
function createReservation(reservation) {
  try {
    const stmt = db.prepare(`
      INSERT INTO reservations (code, items, name, email, controller, additionalInfo, date, createdAt)
      VALUES (@code, @items, @name, @email, @controller, @additionalInfo, @date, @createdAt)
    `);

    const result = stmt.run(reservation);
    console.log(`Reservation created: ${reservation.code}`);
    return result;
  } catch (error) {
    console.error('Error creating reservation:', error);
    throw error;
  }
}

/**
 * Get reservation by code
 */
function getReservationByCode(code) {
  try {
    const stmt = db.prepare('SELECT * FROM reservations WHERE code = ?');
    return stmt.get(code.toUpperCase());
  } catch (error) {
    console.error('Error getting reservation by code:', error);
    throw error;
  }
}

/**
 * Update an existing reservation
 */
function updateReservation(reservation) {
  try {
    const stmt = db.prepare(`
      UPDATE reservations
      SET items = @items,
          name = @name,
          email = @email,
          controller = @controller,
          additionalInfo = @additionalInfo,
          date = @date,
          updatedAt = @updatedAt
      WHERE code = @code
    `);

    const result = stmt.run(reservation);
    console.log(`Reservation updated: ${reservation.code}`);
    return result;
  } catch (error) {
    console.error('Error updating reservation:', error);
    throw error;
  }
}

/**
 * Get all reservations (for admin purposes)
 * Optional filters: date, limit, offset
 */
function getAllReservations(options = {}) {
  try {
    let query = 'SELECT * FROM reservations';
    const params = [];

    // Filter by date if provided
    if (options.date) {
      query += ' WHERE date = ?';
      params.push(options.date);
    }

    // Order by creation date
    query += ' ORDER BY createdAt DESC';

    // Pagination
    if (options.limit) {
      query += ' LIMIT ?';
      params.push(options.limit);

      if (options.offset) {
        query += ' OFFSET ?';
        params.push(options.offset);
      }
    }

    const stmt = db.prepare(query);
    return stmt.all(...params);
  } catch (error) {
    console.error('Error getting all reservations:', error);
    throw error;
  }
}

/**
 * Get count of reservations by date
 * Returns an object with dates as keys and counts as values
 */
function getReservationCountByDate() {
  try {
    const stmt = db.prepare(`
      SELECT date, COUNT(*) as count
      FROM reservations
      WHERE date IS NOT NULL
      GROUP BY date
    `);

    const results = stmt.all();

    // Convert to object for easier lookup
    const countsByDate = {};
    results.forEach(row => {
      countsByDate[row.date] = row.count;
    });

    return countsByDate;
  } catch (error) {
    console.error('Error getting reservation count by date:', error);
    throw error;
  }
}

/**
 * Get reservations for a specific date
 */
function getReservationsByDate(date) {
  try {
    const stmt = db.prepare('SELECT * FROM reservations WHERE date = ? ORDER BY createdAt ASC');
    return stmt.all(date);
  } catch (error) {
    console.error('Error getting reservations by date:', error);
    throw error;
  }
}

/**
 * Delete a reservation by code
 */
function deleteReservation(code) {
  try {
    const stmt = db.prepare('DELETE FROM reservations WHERE code = ?');
    const result = stmt.run(code.toUpperCase());

    if (result.changes > 0) {
      console.log(`Reservation deleted: ${code}`);
    }

    return result;
  } catch (error) {
    console.error('Error deleting reservation:', error);
    throw error;
  }
}

/**
 * Clean up old reservations (older than specified retention days)
 */
function cleanupOldReservations() {
  try {
    const retentionDays = parseInt(process.env.RESERVATION_RETENTION_DAYS) || 60;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    const cutoffDateISO = cutoffDate.toISOString();

    const stmt = db.prepare('DELETE FROM reservations WHERE createdAt < ?');
    const result = stmt.run(cutoffDateISO);

    if (result.changes > 0) {
      console.log(`Cleaned up ${result.changes} old reservation(s) (older than ${retentionDays} days)`);
    }

    return result.changes;
  } catch (error) {
    console.error('Error cleaning up old reservations:', error);
    return 0;
  }
}

/**
 * Get total reservation count
 */
function getReservationCount() {
  try {
    const stmt = db.prepare('SELECT COUNT(*) as count FROM reservations');
    const result = stmt.get();
    return result.count;
  } catch (error) {
    console.error('Error getting reservation count:', error);
    throw error;
  }
}

/**
 * Get database statistics
 */
function getStatistics() {
  try {
    const totalCount = getReservationCount();
    const dateCount = db.prepare('SELECT COUNT(DISTINCT date) as count FROM reservations WHERE date IS NOT NULL').get().count;
    const withEmail = db.prepare('SELECT COUNT(*) as count FROM reservations WHERE email IS NOT NULL AND email != ""').get().count;
    const needsController = db.prepare('SELECT COUNT(*) as count FROM reservations WHERE controller = "yes"').get().count;

    return {
      totalReservations: totalCount,
      uniqueDates: dateCount,
      withEmail: withEmail,
      needsController: needsController
    };
  } catch (error) {
    console.error('Error getting statistics:', error);
    throw error;
  }
}

/**
 * Check if a code exists
 */
function codeExists(code) {
  try {
    const stmt = db.prepare('SELECT 1 FROM reservations WHERE code = ? LIMIT 1');
    return !!stmt.get(code.toUpperCase());
  } catch (error) {
    console.error('Error checking if code exists:', error);
    throw error;
  }
}

/**
 * Close database connection
 */
function close() {
  if (db) {
    try {
      db.close();
      console.log('Database connection closed');
    } catch (error) {
      console.error('Error closing database:', error);
    }
  }
}

module.exports = {
  initialize,
  createReservation,
  getReservationByCode,
  updateReservation,
  getAllReservations,
  getReservationCountByDate,
  getReservationsByDate,
  deleteReservation,
  cleanupOldReservations,
  getReservationCount,
  getStatistics,
  codeExists,
  close
};
