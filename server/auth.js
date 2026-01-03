/**
 * Authentication middleware and utilities
 * JWT-based authentication for admin endpoints
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '24h';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;

/**
 * Verify admin credentials
 */
async function verifyAdminCredentials(username, password) {
  try {
    // Check if admin credentials are configured
    if (!ADMIN_PASSWORD_HASH) {
      throw new Error('Admin credentials not configured. Run setup-admin script.');
    }

    // Check username
    if (username !== ADMIN_USERNAME) {
      return false;
    }

    // Verify password
    const isValid = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);
    return isValid;
  } catch (error) {
    console.error('Error verifying admin credentials:', error);
    return false;
  }
}

/**
 * Generate JWT token
 */
function generateToken(username) {
  return jwt.sign(
    { username, role: 'admin' },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
}

/**
 * Verify JWT token
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

/**
 * Authentication middleware
 * Protects admin routes
 */
function authenticateAdmin(req, res, next) {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: 'No authorization header provided'
      });
    }

    // Extract token (format: "Bearer TOKEN")
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : authHeader;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    // Verify token
    const decoded = verifyToken(token);

    if (!decoded) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }

    // Attach user info to request
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication failed'
    });
  }
}

/**
 * Hash a password
 * Used by setup script
 */
async function hashPassword(password) {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
}

/**
 * Generate a random JWT secret
 * Used by setup script
 */
function generateJWTSecret() {
  return require('crypto').randomBytes(64).toString('hex');
}

module.exports = {
  verifyAdminCredentials,
  generateToken,
  verifyToken,
  authenticateAdmin,
  hashPassword,
  generateJWTSecret
};
