const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticateJWT, authorize } = require('../middleware/auth');

/**
 * User Management Routes
 * Base path: /api/v1/users
 * All routes require admin role
 */

// GET /api/v1/users - List all users
router.get('/', authenticateJWT, authorize('admin'), userController.getUsers);

// POST /api/v1/users - Create new user
router.post('/', authenticateJWT, authorize('admin'), userController.createUser);

// PATCH /api/v1/users/:user_id/status - Update user status
router.patch('/:user_id/status', authenticateJWT, authorize('admin'), userController.updateUserStatus);

// POST /api/v1/users/:user_id/password-reset - Trigger password reset
router.post('/:user_id/password-reset', authenticateJWT, authorize('admin'), userController.resetPassword);

module.exports = router;
