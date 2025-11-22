const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateJWT } = require('../middleware/auth');

/**
 * Authentication Routes
 * Base path: /api/v1/auth
 */

// POST /api/v1/auth/login - Login user
router.post('/login', authController.login);

// POST /api/v1/auth/logout - Logout user (requires authentication)
router.post('/logout', authenticateJWT, authController.logout);

// POST /api/v1/auth/refresh - Refresh JWT token
router.post('/refresh', authController.refresh);

module.exports = router;
