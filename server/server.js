/**
 * Kaptam Reservation System - Server
 * Handles cart reservations with SQLite database and email notifications
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const rateLimit = require('express-rate-limit');
const db = require('./database');
const emailService = require('./emailService');
const auth = require('./auth');

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const SITE_URL = process.env.SITE_URL || 'http://localhost:5500';
const MAX_RESERVATIONS_PER_DATE = parseInt(process.env.MAX_RESERVATIONS_PER_DATE) || 6;
const MAX_ITEMS_PER_RESERVATION = parseInt(process.env.MAX_ITEMS_PER_RESERVATION) || 20;

// ==========================================
// Middleware
// ==========================================

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);

    // In development, allow any origin
    if (NODE_ENV === 'development') {
      return callback(null, true);
    }

    // In production, only allow specific origins
    const allowedOrigins = [
      'https://kaptam.fi',
      'http://kaptam.fi',
      'https://www.kaptam.fi',
      'http://www.kaptam.fi'
    ];

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
};

app.use(cors(corsOptions));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.RATE_LIMIT_MAX || 100, // limit each IP
  message: { message: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Initialize database
try {
  db.initialize();
} catch (error) {
  console.error('Failed to initialize database. Exiting...');
  process.exit(1);
}

// ==========================================
// Utility Functions
// ==========================================

/**
 * Generate a unique 6-character alphanumeric code
 */
function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing chars: 0, O, 1, I
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Generate a unique code that doesn't exist in database
 */
function generateUniqueCode() {
  let code;
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    code = generateCode();
    if (!db.codeExists(code)) {
      return code;
    }
    attempts++;
  }

  throw new Error('Failed to generate unique code after ' + maxAttempts + ' attempts');
}

// ==========================================
// Public API Routes
// ==========================================

/**
 * GET /api/health
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: NODE_ENV
  });
});

/**
 * GET /api/dates/availability
 * Get reservation counts by date to check availability
 */
app.get('/api/dates/availability', (req, res) => {
  try {
    const countsByDate = db.getReservationCountByDate();
    res.json(countsByDate);
  } catch (error) {
    console.error('Error getting date availability:', error);
    res.status(500).json({ message: 'Failed to get date availability' });
  }
});

/**
 * POST /api/cart/submit
 * Create a new reservation
 */
app.post('/api/cart/submit', async (req, res) => {
  try {
    const { items, name, email, controller, additionalInfo, date } = req.body;

    // Validation
    if (!items || items.length === 0) {
      return res.status(400).json({ message: 'Cart is empty' });
    }

    if (items.length > MAX_ITEMS_PER_RESERVATION) {
      return res.status(400).json({
        message: `Maximum ${MAX_ITEMS_PER_RESERVATION} items allowed per reservation`
      });
    }

    if (!name || name.trim() === '') {
      return res.status(400).json({ message: 'Name is required' });
    }

    if (!controller) {
      return res.status(400).json({ message: 'Controller preference is required' });
    }

    // Check date availability if date is provided
    if (date) {
      const dateReservations = db.getReservationsByDate(date);
      if (dateReservations.length >= MAX_RESERVATIONS_PER_DATE) {
        return res.status(400).json({
          message: `This date is fully booked. Maximum ${MAX_RESERVATIONS_PER_DATE} reservations allowed.`
        });
      }
    }

    // Generate unique code
    const code = generateUniqueCode();

    // Save to database
    const reservation = {
      code,
      items: JSON.stringify(items),
      name: name.trim(),
      email: email ? email.trim() : null,
      controller,
      additionalInfo: additionalInfo ? additionalInfo.trim() : null,
      date: date || null,
      createdAt: new Date().toISOString()
    };

    db.createReservation(reservation);

    // Send emails (don't fail if email fails)
    try {
      // Send to admin always
      await emailService.sendAdminNotification(reservation);

      // Send to user only if email provided
      if (email && email.trim() !== '') {
        await emailService.sendUserConfirmation(reservation);
      }
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
      // Continue - reservation is saved
    }

    res.json({
      success: true,
      code,
      message: 'Reservation created successfully'
    });

  } catch (error) {
    console.error('Error creating reservation:', error);
    res.status(500).json({ message: 'Failed to create reservation' });
  }
});

/**
 * GET /api/cart/:code
 * Retrieve a reservation by code
 */
app.get('/api/cart/:code', (req, res) => {
  try {
    const { code } = req.params;

    if (!code || code.length !== 6) {
      return res.status(400).json({ message: 'Invalid code format' });
    }

    const reservation = db.getReservationByCode(code.toUpperCase());

    if (!reservation) {
      return res.status(404).json({ message: 'Reservation not found' });
    }

    // Parse items JSON
    reservation.items = JSON.parse(reservation.items);

    res.json(reservation);

  } catch (error) {
    console.error('Error retrieving reservation:', error);
    res.status(500).json({ message: 'Failed to retrieve reservation' });
  }
});

/**
 * PUT /api/cart/:code
 * Update an existing reservation
 */
app.put('/api/cart/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const { items, name, email, controller, additionalInfo, date } = req.body;

    if (!code || code.length !== 6) {
      return res.status(400).json({ message: 'Invalid code format' });
    }

    // Check if reservation exists
    const existing = db.getReservationByCode(code.toUpperCase());
    if (!existing) {
      return res.status(404).json({ message: 'Reservation not found' });
    }

    // Validation
    if (!items || items.length === 0) {
      return res.status(400).json({ message: 'Cart is empty' });
    }

    if (items.length > MAX_ITEMS_PER_RESERVATION) {
      return res.status(400).json({
        message: `Maximum ${MAX_ITEMS_PER_RESERVATION} items allowed per reservation`
      });
    }

    if (!name || name.trim() === '') {
      return res.status(400).json({ message: 'Name is required' });
    }

    if (!controller) {
      return res.status(400).json({ message: 'Controller preference is required' });
    }

    // Check date availability if date changed
    if (date && date !== existing.date) {
      const dateReservations = db.getReservationsByDate(date);
      if (dateReservations.length >= MAX_RESERVATIONS_PER_DATE) {
        return res.status(400).json({
          message: `This date is fully booked. Maximum ${MAX_RESERVATIONS_PER_DATE} reservations allowed.`
        });
      }
    }

    // Update reservation
    const reservation = {
      code: code.toUpperCase(),
      items: JSON.stringify(items),
      name: name.trim(),
      email: email ? email.trim() : null,
      controller,
      additionalInfo: additionalInfo ? additionalInfo.trim() : null,
      date: date || null,
      updatedAt: new Date().toISOString()
    };

    db.updateReservation(reservation);

    // Send update emails
    try {
      await emailService.sendAdminNotification(reservation, true);

      if (email && email.trim() !== '') {
        await emailService.sendUserConfirmation(reservation, true);
      }
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
    }

    res.json({
      success: true,
      code: code.toUpperCase(),
      message: 'Reservation updated successfully'
    });

  } catch (error) {
    console.error('Error updating reservation:', error);
    res.status(500).json({ message: 'Failed to update reservation' });
  }
});

// ==========================================
// Admin Authentication Routes
// ==========================================

/**
 * POST /api/admin/login
 * Admin login - returns JWT token
 */
app.post('/api/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required'
      });
    }

    // Verify credentials
    const isValid = await auth.verifyAdminCredentials(username, password);

    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Generate token
    const token = auth.generateToken(username);

    res.json({
      success: true,
      token,
      username,
      message: 'Login successful'
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed'
    });
  }
});

/**
 * POST /api/admin/verify
 * Verify if token is still valid
 */
app.post('/api/admin/verify', (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Token is required'
      });
    }

    const decoded = auth.verifyToken(token);

    if (!decoded) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }

    res.json({
      success: true,
      valid: true,
      username: decoded.username
    });

  } catch (error) {
    console.error('Token verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Verification failed'
    });
  }
});

// ==========================================
// Protected Admin Routes
// ==========================================

/**
 * GET /api/admin/reservations
 * Get all reservations (paginated)
 */
app.get('/api/admin/reservations', auth.authenticateAdmin, (req, res) => {
  try {
    const { date, limit = 50, offset = 0 } = req.query;

    const options = {
      date: date || undefined,
      limit: parseInt(limit),
      offset: parseInt(offset)
    };

    const reservations = db.getAllReservations(options);

    // Parse items JSON for each reservation
    reservations.forEach(reservation => {
      reservation.items = JSON.parse(reservation.items);
    });

    res.json({
      success: true,
      reservations,
      count: reservations.length
    });

  } catch (error) {
    console.error('Error getting reservations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get reservations'
    });
  }
});

/**
 * GET /api/admin/reservations/:code
 * Get a specific reservation by code
 */
app.get('/api/admin/reservations/:code', auth.authenticateAdmin, (req, res) => {
  try {
    const { code } = req.params;

    const reservation = db.getReservationByCode(code.toUpperCase());

    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: 'Reservation not found'
      });
    }

    reservation.items = JSON.parse(reservation.items);

    res.json({
      success: true,
      reservation
    });

  } catch (error) {
    console.error('Error getting reservation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get reservation'
    });
  }
});

/**
 * DELETE /api/admin/reservations/:code
 * Delete a reservation
 */
app.delete('/api/admin/reservations/:code', auth.authenticateAdmin, (req, res) => {
  try {
    const { code } = req.params;

    const existing = db.getReservationByCode(code.toUpperCase());
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Reservation not found'
      });
    }

    db.deleteReservation(code.toUpperCase());

    res.json({
      success: true,
      message: 'Reservation deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting reservation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete reservation'
    });
  }
});

/**
 * GET /api/admin/statistics
 * Get reservation statistics
 */
app.get('/api/admin/statistics', auth.authenticateAdmin, (req, res) => {
  try {
    const stats = db.getStatistics();
    const dateCountsByDate = db.getReservationCountByDate();

    res.json({
      success: true,
      statistics: {
        ...stats,
        reservationsByDate: dateCountsByDate
      }
    });

  } catch (error) {
    console.error('Error getting statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get statistics'
    });
  }
});

// ==========================================
// Error Handling
// ==========================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found'
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    message: NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// ==========================================
// Server Start
// ==========================================

app.listen(PORT, () => {
  console.log('==========================================');
  console.log('Kaptam Reservation Server');
  console.log('==========================================');
  console.log(`Environment: ${NODE_ENV}`);
  console.log(`Port: ${PORT}`);
  console.log(`Site URL: ${SITE_URL}`);
  console.log(`Max reservations per date: ${MAX_RESERVATIONS_PER_DATE}`);
  console.log(`Max items per reservation: ${MAX_ITEMS_PER_RESERVATION}`);
  console.log('==========================================');
  console.log('Server is running and ready to accept requests');
  console.log('==========================================');
});

// ==========================================
// Graceful Shutdown
// ==========================================

process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  db.close();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  db.close();
  process.exit(0);
});
