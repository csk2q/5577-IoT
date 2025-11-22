const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const logger = require('../utils/logger');

/**
 * Authentication Controller
 * Handles user login, logout, and token refresh
 */

/**
 * Login user and generate JWT token
 * POST /api/v1/auth/login
 */
const login = async (req, res) => {
  try {
    const { employee_id, password } = req.body;

    // Validate input
    if (!employee_id || !password) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Employee ID and password are required'
        }
      });
    }

    // Query user from database
    const [users] = await db.query(
      'SELECT user_id, employee_id, password_hash, role, status FROM users WHERE employee_id = ?',
      [employee_id]
    );

    if (users.length === 0) {
      logger.warn(`Login attempt failed: User not found (${employee_id})`);
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_INVALID_CREDENTIALS',
          message: 'Invalid employee ID or password'
        }
      });
    }

    const user = users[0];

    // Check if user is disabled
    if (user.status === 'disabled') {
      logger.warn(`Login attempt by disabled user: ${employee_id}`);
      return res.status(403).json({
        success: false,
        error: {
          code: 'USER_DISABLED',
          message: 'User account is disabled'
        }
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      logger.warn(`Login attempt failed: Invalid password (${employee_id})`);
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_INVALID_CREDENTIALS',
          message: 'Invalid employee ID or password'
        }
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        user_id: user.user_id,
        employee_id: user.employee_id,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    // Log successful login
    logger.info(`User logged in successfully: ${employee_id} (${user.role})`);

    // Audit log entry
    await db.query(
      'INSERT INTO audit_logs (user_id, action_type, resource_type, details) VALUES (?, ?, ?, ?)',
      [user.user_id, 'login', 'users', JSON.stringify({ employee_id, message: 'User logged in' })]
    );

    // Return token and user info
    res.status(200).json({
      success: true,
      data: {
        token,
        expiresIn: 28800, // 8 hours in seconds
        user: {
          user_id: user.user_id,
          employee_id: user.employee_id,
          role: user.role
        }
      }
    });

  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred during login'
      }
    });
  }
};

/**
 * Logout user (token blacklisting would be implemented here)
 * POST /api/v1/auth/logout
 */
const logout = async (req, res) => {
  try {
    const { token } = req.body;

    // In a production system, add token to blacklist/revocation list
    // For now, just log the logout event
    if (req.user) {
      logger.info(`User logged out: ${req.user.employee_id}`);
      
      // Audit log entry
      await db.query(
        'INSERT INTO audit_logs (user_id, action_type, resource_type, details) VALUES (?, ?, ?, ?)',
        [req.user.user_id, 'logout', 'users', JSON.stringify({ employee_id: req.user.employee_id, message: 'User logged out' })]
      );
    }

    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });

  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred during logout'
      }
    });
  }
};

/**
 * Refresh JWT token
 * POST /api/v1/auth/refresh
 */
const refresh = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Token is required'
        }
      });
    }

    // Verify the old token (even if expired, we need its payload)
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET, { ignoreExpiration: true });
    } catch (error) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_TOKEN_INVALID',
          message: 'Invalid token'
        }
      });
    }

    // Check if user still exists and is active
    const [users] = await db.query(
      'SELECT user_id, employee_id, role, status FROM users WHERE user_id = ?',
      [decoded.user_id]
    );

    if (users.length === 0 || users[0].status === 'disabled') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'USER_DISABLED',
          message: 'User account is no longer active'
        }
      });
    }

    const user = users[0];

    // Generate new token
    const newToken = jwt.sign(
      {
        user_id: user.user_id,
        employee_id: user.employee_id,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    logger.info(`Token refreshed for user: ${user.employee_id}`);

    res.status(200).json({
      success: true,
      data: {
        token: newToken,
        expiresIn: 28800 // 8 hours in seconds
      }
    });

  } catch (error) {
    logger.error('Token refresh error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred during token refresh'
      }
    });
  }
};

module.exports = {
  login,
  logout,
  refresh
};
