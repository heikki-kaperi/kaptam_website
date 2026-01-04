const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);

const app = express();
const PORT = 3000;

// Database configuration
const dbConfig = {
  host: 'localhost',
  user: 'your_username',
  password: 'your_password',
  database: 'kaptam_reservations',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Create connection pool
const pool = mysql.createPool(dbConfig);

// Session store
const sessionStore = new MySQLStore({}, pool);

// Middleware
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(session({
  key: 'kaptam_session',
  secret: 'change-this-to-a-random-secret-key-in-production',
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24, // 24 hours
    httpOnly: true,
    secure: false // Set to true if using HTTPS
  }
}));

// Generate unique cart code
function generateCartCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  code += '-';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Check if code exists
async function isCodeUnique(code) {
  const [rows] = await pool.query('SELECT id FROM reservations WHERE code = ?', [code]);
  return rows.length === 0;
}

// Get unique code
async function getUniqueCode() {
  let code;
  let isUnique = false;
  let attempts = 0;
  const maxAttempts = 10;

  while (!isUnique && attempts < maxAttempts) {
    code = generateCartCode();
    isUnique = await isCodeUnique(code);
    attempts++;
  }

  if (!isUnique) {
    throw new Error('Could not generate unique code');
  }

  return code;
}

// ============================================
// PUBLIC API ENDPOINTS (for frontend)
// ============================================

// Submit new reservation
app.post('/api/cart/submit', async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { items, name, email, controller, additionalInfo, date } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ message: 'Cart is empty' });
    }

    if (!name) {
      return res.status(400).json({ message: 'Name is required' });
    }

    await connection.beginTransaction();

    // Generate unique code
    const code = await getUniqueCode();

    // Insert reservation
    const [result] = await connection.query(
      `INSERT INTO reservations (code, name, email, controller, additional_info, visit_date, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [code, name, email || null, controller, additionalInfo || null, date || null]
    );

    const reservationId = result.insertId;

    // Insert items
    for (const item of items) {
      await connection.query(
        `INSERT INTO reservation_items (reservation_id, game_id, game_name, game_image, game_type) 
         VALUES (?, ?, ?, ?, ?)`,
        [reservationId, item.id, item.name, item.image, item.type]
      );
    }

    await connection.commit();

    res.json({ 
      success: true, 
      code,
      message: 'Reservation submitted successfully' 
    });

  } catch (error) {
    await connection.rollback();
    console.error('Error submitting reservation:', error);
    res.status(500).json({ message: 'Failed to submit reservation' });
  } finally {
    connection.release();
  }
});

// Load reservation by code
app.get('/api/cart/:code', async (req, res) => {
  try {
    const { code } = req.params;

    // Get reservation
    const [reservations] = await pool.query(
      'SELECT * FROM reservations WHERE code = ?',
      [code]
    );

    if (reservations.length === 0) {
      return res.status(404).json({ message: 'Reservation not found' });
    }

    const reservation = reservations[0];

    // Get items
    const [items] = await pool.query(
      'SELECT game_id as id, game_name as name, game_image as image, game_type as type FROM reservation_items WHERE reservation_id = ?',
      [reservation.id]
    );

    res.json({
      name: reservation.name,
      email: reservation.email,
      controller: reservation.controller,
      additionalInfo: reservation.additional_info,
      date: reservation.visit_date,
      items
    });

  } catch (error) {
    console.error('Error loading reservation:', error);
    res.status(500).json({ message: 'Failed to load reservation' });
  }
});

// Update existing reservation
app.put('/api/cart/:code', async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { code } = req.params;
    const { items, name, email, controller, additionalInfo, date } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ message: 'Cart is empty' });
    }

    if (!name) {
      return res.status(400).json({ message: 'Name is required' });
    }

    await connection.beginTransaction();

    // Get reservation
    const [reservations] = await connection.query(
      'SELECT id FROM reservations WHERE code = ?',
      [code]
    );

    if (reservations.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Reservation not found' });
    }

    const reservationId = reservations[0].id;

    // Update reservation
    await connection.query(
      `UPDATE reservations 
       SET name = ?, email = ?, controller = ?, additional_info = ?, visit_date = ?, updated_at = NOW()
       WHERE id = ?`,
      [name, email || null, controller, additionalInfo || null, date || null, reservationId]
    );

    // Delete old items
    await connection.query('DELETE FROM reservation_items WHERE reservation_id = ?', [reservationId]);

    // Insert new items
    for (const item of items) {
      await connection.query(
        `INSERT INTO reservation_items (reservation_id, game_id, game_name, game_image, game_type) 
         VALUES (?, ?, ?, ?, ?)`,
        [reservationId, item.id, item.name, item.image, item.type]
      );
    }

    await connection.commit();

    res.json({ 
      success: true, 
      code,
      message: 'Reservation updated successfully' 
    });

  } catch (error) {
    await connection.rollback();
    console.error('Error updating reservation:', error);
    res.status(500).json({ message: 'Failed to update reservation' });
  } finally {
    connection.release();
  }
});

// ============================================
// ADMIN API ENDPOINTS (protected)
// ============================================

// Middleware to check if user is logged in
function requireAuth(req, res, next) {
  if (req.session && req.session.adminId) {
    return next();
  }
  res.status(401).json({ message: 'Unauthorized' });
}

// Admin login
app.post('/api/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password required' });
    }

    // Get admin user
    const [users] = await pool.query(
      'SELECT * FROM admin_users WHERE username = ?',
      [username]
    );

    if (users.length === 0) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    const user = users[0];

    // Check password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    // Set session
    req.session.adminId = user.id;
    req.session.adminUsername = user.username;

    res.json({ 
      success: true,
      username: user.username,
      message: 'Login successful' 
    });

  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ message: 'Login failed' });
  }
});

// Admin logout
app.post('/api/admin/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ message: 'Logout failed' });
    }
    res.json({ success: true, message: 'Logged out successfully' });
  });
});

// Check auth status
app.get('/api/admin/check', requireAuth, (req, res) => {
  res.json({ 
    authenticated: true,
    username: req.session.adminUsername 
  });
});

// Get all reservations
app.get('/api/admin/reservations', requireAuth, async (req, res) => {
  try {
    const [reservations] = await pool.query(
      `SELECT r.*, 
              COUNT(ri.id) as item_count
       FROM reservations r
       LEFT JOIN reservation_items ri ON r.id = ri.reservation_id
       GROUP BY r.id
       ORDER BY r.created_at DESC`
    );

    res.json(reservations);

  } catch (error) {
    console.error('Error fetching reservations:', error);
    res.status(500).json({ message: 'Failed to fetch reservations' });
  }
});

// Get single reservation with items
app.get('/api/admin/reservations/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    // Get reservation
    const [reservations] = await pool.query(
      'SELECT * FROM reservations WHERE id = ?',
      [id]
    );

    if (reservations.length === 0) {
      return res.status(404).json({ message: 'Reservation not found' });
    }

    const reservation = reservations[0];

    // Get items
    const [items] = await pool.query(
      'SELECT * FROM reservation_items WHERE reservation_id = ?',
      [id]
    );

    res.json({
      ...reservation,
      items
    });

  } catch (error) {
    console.error('Error fetching reservation:', error);
    res.status(500).json({ message: 'Failed to fetch reservation' });
  }
});

// Update reservation (admin)
app.put('/api/admin/reservations/:id', requireAuth, async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { id } = req.params;
    const { name, email, controller, additionalInfo, date, items } = req.body;

    await connection.beginTransaction();

    // Update reservation
    await connection.query(
      `UPDATE reservations 
       SET name = ?, email = ?, controller = ?, additional_info = ?, visit_date = ?, updated_at = NOW()
       WHERE id = ?`,
      [name, email || null, controller, additionalInfo || null, date || null, id]
    );

    if (items) {
      // Delete old items
      await connection.query('DELETE FROM reservation_items WHERE reservation_id = ?', [id]);

      // Insert new items
      for (const item of items) {
        await connection.query(
          `INSERT INTO reservation_items (reservation_id, game_id, game_name, game_image, game_type) 
           VALUES (?, ?, ?, ?, ?)`,
          [id, item.game_id, item.game_name, item.game_image, item.game_type]
        );
      }
    }

    await connection.commit();

    res.json({ 
      success: true,
      message: 'Reservation updated successfully' 
    });

  } catch (error) {
    await connection.rollback();
    console.error('Error updating reservation:', error);
    res.status(500).json({ message: 'Failed to update reservation' });
  } finally {
    connection.release();
  }
});

// Delete reservation
app.delete('/api/admin/reservations/:id', requireAuth, async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { id } = req.params;

    await connection.beginTransaction();

    // Delete items first (foreign key constraint)
    await connection.query('DELETE FROM reservation_items WHERE reservation_id = ?', [id]);

    // Delete reservation
    await connection.query('DELETE FROM reservations WHERE id = ?', [id]);

    await connection.commit();

    res.json({ 
      success: true,
      message: 'Reservation deleted successfully' 
    });

  } catch (error) {
    await connection.rollback();
    console.error('Error deleting reservation:', error);
    res.status(500).json({ message: 'Failed to delete reservation' });
  } finally {
    connection.release();
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});