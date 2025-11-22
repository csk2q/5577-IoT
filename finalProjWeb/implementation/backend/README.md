# Backend - IoT Nursing Station API

Node.js + Express backend for the IoT Nursing Station Dashboard.

## Directory Structure

```
backend/
├── src/
│   ├── config/          # Configuration files
│   │   └── database.js  # MySQL connection pool
│   ├── controllers/     # Request handlers
│   ├── middleware/      # Express middleware
│   │   ├── auth.js      # JWT authentication
│   │   └── errorHandler.js
│   ├── models/          # Data access layer (repositories)
│   ├── routes/          # API route definitions
│   ├── services/        # Business logic
│   ├── utils/           # Utility functions
│   │   └── logger.js    # Winston logger
│   ├── validators/      # Input validation
│   └── server.js        # Express app entry point
├── tests/               # Test files
├── logs/                # Application logs (production)
├── .env.example         # Environment variables template
└── package.json         # Dependencies and scripts
```

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file:
```bash
cp .env.example .env
```

3. Configure database in `.env`:
```
DB_HOST=localhost
DB_USER=nursestation
DB_PASSWORD=your_password
DB_NAME=nursestation_db
```

4. Run database migrations:
```bash
npm run db:migrate
```

5. Start development server:
```bash
npm run dev
```

## API Documentation

See `/development-log/architecture/APIContract.md` for complete API specification.

## Development Guidelines

### Adding a New Endpoint

1. **Create route** in `src/routes/`
2. **Create controller** in `src/controllers/`
3. **Create service** (if needed) in `src/services/`
4. **Create model/repository** (if needed) in `src/models/`
5. **Add validation** in `src/validators/`
6. **Write tests** in `tests/`

### Code Style

- Use async/await for asynchronous operations
- Always use try-catch blocks for error handling
- Use prepared statements for all database queries
- Log errors with appropriate context
- Return consistent JSON responses

### Example Controller Pattern

```javascript
const service = require('../services/example.service');
const logger = require('../utils/logger');

exports.getExample = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await service.getById(id);
    
    if (!result) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'RESOURCE_NOT_FOUND',
          message: 'Resource not found'
        }
      });
    }
    
    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    logger.error('Error in getExample:', err);
    next(err);
  }
};
```

## Testing

Run tests:
```bash
npm test
```

Watch mode:
```bash
npm run test:watch
```

## Database Management

### Run Migrations
```bash
npm run db:migrate
```

### Seed Database
```bash
npm run db:seed
```

## Next Steps for Backend Developer

1. Implement authentication endpoints (`/api/v1/auth`)
2. Implement user management endpoints (`/api/v1/users`)
3. Implement patient management endpoints (`/api/v1/patients`)
4. Implement sensor data ingestion (`/api/v1/sensors`)
5. Implement alert management (`/api/v1/alerts`)
6. Implement SSE streaming (`/api/v1/stream`)
7. Write comprehensive tests for all endpoints

---

**Assigned to:** Senior Backend Developer
