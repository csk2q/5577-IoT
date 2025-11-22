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

// Test connection
// In containerized environment with health checks, database will always be available
// If connection fails, it's a critical error that should stop the application
pool.getConnection()
  .then(connection => {
    logger.info('Database connection established successfully');
    connection.release();
  })
  .catch(err => {
    logger.error('Failed to connect to database:', err.message);
    logger.error('Database connection is required. Exiting...');
    process.exit(1);
  });

module.exports = pool;
