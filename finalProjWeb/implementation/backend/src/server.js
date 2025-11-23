require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet()); // Security headers

// CORS configuration with detailed logging
const allowedOrigins = [
  'http://localhost:5173', // Vite dev server
  'http://localhost:8080', // Docker nginx
  'http://127.0.0.1:8080', // Docker nginx alternate
];

app.use(cors({ 
  origin: function(origin, callback) {
    logger.info(`CORS request from origin: ${origin || 'none'}`);
    // Allow requests with no origin (like mobile apps, curl, Postman)
    if (!origin) {
      logger.info('CORS: Allowing request with no origin');
      return callback(null, true);
    }
    if (allowedOrigins.indexOf(origin) !== -1 || (process.env.CORS_ORIGIN && origin === process.env.CORS_ORIGIN)) {
      logger.info(`CORS: Allowing origin ${origin}`);
      callback(null, true);
    } else {
      logger.warn(`CORS: Blocking origin ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true 
}));

app.use(compression()); // Compress responses
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging with more details
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    origin: req.get('origin') || 'none',
    userAgent: req.get('user-agent'),
    timestamp: new Date().toISOString()
  });
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/v1/auth', require('./routes/authRoutes'));
app.use('/api/v1/users', require('./routes/userRoutes'));
app.use('/api/v1/patients', require('./routes/patientRoutes'));
app.use('/api/v1/sensors', require('./routes/sensorRoutes'));
app.use('/api/v1/alerts', require('./routes/alertRoutes').alertRoutes);
app.use('/api/v1/stream', require('./routes/sseRoutes').router);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Endpoint not found'
    }
  });
});

// Error handler (must be last)
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
});

module.exports = app;
