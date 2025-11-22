const mysql = require('mysql2/promise');
const logger = require('../utils/logger');

// Database connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 10,
  waitForConnections: true,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

// Test connection (non-blocking for development)
pool.getConnection()
  .then(connection => {
    logger.info('Database connection established');
    connection.release();
  })
  .catch(err => {
    logger.warn('Database connection failed (continuing without database):', err.message);
    logger.warn('Application will start but database operations will fail until connection is established');
  });

module.exports = pool;
