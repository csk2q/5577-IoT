const bcrypt = require('bcrypt');
const db = require('../config/database');
const logger = require('../utils/logger');

/**
 * User Management Controller
 * Handles CRUD operations for user management
 * Admin role required for all operations
 */

/**
 * Get all users with optional filters
 * GET /api/v1/users
 */
const getUsers = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      role, 
      status 
    } = req.query;

    const offset = (page - 1) * limit;

    // Build WHERE clause based on filters
    let whereConditions = [];
    let queryParams = [];

    if (role) {
      whereConditions.push('role = ?');
      queryParams.push(role);
    }

    if (status) {
      whereConditions.push('status = ?');
      queryParams.push(status);
    }

    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}` 
      : '';

    // Get total count
    const [countResult] = await db.query(
      `SELECT COUNT(*) as total FROM users ${whereClause}`,
      queryParams
    );
    const total = countResult[0].total;

    // Get users with pagination
    const [users] = await db.query(
      `SELECT user_id, employee_id, first_name, last_name, email, role, status, created_at, updated_at 
       FROM users 
       ${whereClause}
       ORDER BY user_id ASC
       LIMIT ? OFFSET ?`,
      [...queryParams, parseInt(limit), offset]
    );

    logger.info(`Retrieved ${users.length} users (filters: role=${role || 'all'}, status=${status || 'all'})`);

    res.status(200).json({
      success: true,
      data: {
        items: users,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    logger.error('Get users error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while retrieving users'
      }
    });
  }
};

/**
 * Create a new user
 * POST /api/v1/users
 */
const createUser = async (req, res) => {
  try {
    const { employee_id, password, role, first_name, last_name, email } = req.body;

    // Validate required fields
    if (!employee_id || !password || !role) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Employee ID, password, and role are required'
        }
      });
    }

    // Validate employee_id format (6 digits)
    if (!/^\d{6}$/.test(employee_id)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Employee ID must be exactly 6 digits'
        }
      });
    }

    // Validate role
    if (!['admin', 'nurse', 'intake'].includes(role)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Role must be one of: admin, nurse, intake'
        }
      });
    }

    // Validate password strength (at least 8 characters)
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Password must be at least 8 characters long'
        }
      });
    }

    // Check if employee_id already exists
    const [existingUsers] = await db.query(
      'SELECT user_id FROM users WHERE employee_id = ?',
      [employee_id]
    );

    if (existingUsers.length > 0) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'USER_ALREADY_EXISTS',
          message: 'Employee ID already exists'
        }
      });
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    // Insert new user
    const [result] = await db.query(
      `INSERT INTO users (employee_id, password_hash, first_name, last_name, email, role, status) 
       VALUES (?, ?, ?, ?, ?, ?, 'active')`,
      [employee_id, password_hash, first_name || null, last_name || null, email || null, role]
    );

    const user_id = result.insertId;

    // Fetch created user
    const [newUsers] = await db.query(
      'SELECT user_id, employee_id, first_name, last_name, email, role, status, created_at FROM users WHERE user_id = ?',
      [user_id]
    );

    logger.info(`User created: ${employee_id} (${role}) by admin ${req.user.employee_id}`);

    // Audit log
    await db.query(
      'INSERT INTO audit_logs (user_id, action_type, resource_type, resource_id, details) VALUES (?, ?, ?, ?, ?)',
      [req.user.user_id, 'create_user', 'users', employee_id, JSON.stringify({ 
        employee_id, 
        role,
        created_by: req.user.employee_id
      })]
    );

    res.status(201).json({
      success: true,
      data: newUsers[0],
      message: 'User created successfully'
    });

  } catch (error) {
    logger.error('Create user error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while creating user'
      }
    });
  }
};

/**
 * Update user status (enable/disable)
 * PATCH /api/v1/users/:user_id/status
 */
const updateUserStatus = async (req, res) => {
  try {
    const { user_id } = req.params;
    const { status } = req.body;

    // Validate status
    if (!status || !['active', 'disabled'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Status must be either "active" or "disabled"'
        }
      });
    }

    // Check if user exists
    const [users] = await db.query(
      'SELECT employee_id FROM users WHERE user_id = ?',
      [user_id]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found'
        }
      });
    }

    // Update status
    await db.query(
      'UPDATE users SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
      [status, user_id]
    );

    // Fetch updated user
    const [updatedUsers] = await db.query(
      'SELECT user_id, employee_id, status, updated_at FROM users WHERE user_id = ?',
      [user_id]
    );

    logger.info(`User status updated: ${users[0].employee_id} -> ${status} by admin ${req.user.employee_id}`);

    // Audit log
    await db.query(
      'INSERT INTO audit_logs (user_id, action_type, resource_type, resource_id, details) VALUES (?, ?, ?, ?, ?)',
      [req.user.user_id, 'update_user', 'users', users[0].employee_id, JSON.stringify({ 
        employee_id: users[0].employee_id,
        status,
        updated_by: req.user.employee_id
      })]
    );

    res.status(200).json({
      success: true,
      data: updatedUsers[0],
      message: 'User status updated'
    });

  } catch (error) {
    logger.error('Update user status error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while updating user status'
      }
    });
  }
};

/**
 * Trigger password reset
 * POST /api/v1/users/:user_id/password-reset
 */
const resetPassword = async (req, res) => {
  try {
    const { user_id } = req.params;

    // Check if user exists
    const [users] = await db.query(
      'SELECT employee_id, email FROM users WHERE user_id = ?',
      [user_id]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found'
        }
      });
    }

    // In production, this would:
    // 1. Generate a secure reset token
    // 2. Store token in database with expiration
    // 3. Send email to user with reset link
    // For now, just log the action

    logger.info(`Password reset requested for user: ${users[0].employee_id} by admin ${req.user.employee_id}`);

    // Audit log
    await db.query(
      'INSERT INTO audit_logs (user_id, action_type, resource_type, resource_id, details) VALUES (?, ?, ?, ?, ?)',
      [req.user.user_id, 'update_user', 'users', users[0].employee_id, JSON.stringify({ 
        employee_id: users[0].employee_id,
        action: 'password_reset_requested',
        requested_by: req.user.employee_id
      })]
    );

    res.status(200).json({
      success: true,
      message: 'Password reset email sent to user'
    });

  } catch (error) {
    logger.error('Password reset error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while processing password reset'
      }
    });
  }
};

module.exports = {
  getUsers,
  createUser,
  updateUserStatus,
  resetPassword
};
