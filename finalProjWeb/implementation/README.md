# IoT Nursing Station - Implementation

This directory contains all implementation code for the IoT Nursing Station Dashboard project.

## Project Structure

```
implementation/
├── backend/           # Node.js + Express API server
├── frontend/          # React + TypeScript web application
├── mock-sensors/      # Test automation - mock sensor framework
└── shared/            # Shared types and utilities
```

## Quick Start

### Prerequisites
- Node.js 18+ LTS
- MySQL 8+
- npm or yarn

### Backend Setup
```bash
cd backend
npm install
cp .env.example .env
# Configure .env with your database credentials
npm run dev
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

### Mock Sensors Setup
```bash
cd mock-sensors
npm install
npm start
```

## Development Workflow

1. **Backend Developer**: Start with `backend/` - implement API endpoints per APIContract.md
2. **Frontend Developer**: Start with `frontend/` - implement UI components
3. **Test Automation Expert**: Start with `mock-sensors/` - build sensor simulator

## Environment Variables

### Backend (.env)
```
NODE_ENV=development
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=nursestation
DB_PASSWORD=your_password
DB_NAME=nursestation_db
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=8h
```

### Frontend (.env)
```
VITE_API_BASE_URL=http://localhost:3000/api/v1
```

## Documentation

- System Architecture: `/development-log/architecture/SystemArchitecture.md`
- API Contracts: `/development-log/architecture/APIContract.md`
- Requirements: `/development-log/InitialRequirements.md`

## Testing

Each subdirectory has its own test suite:
- Backend: `cd backend && npm test`
- Frontend: `cd frontend && npm test`
- Mock Sensors: `cd mock-sensors && npm test`

## Team Assignments

- **Architect**: System design, code reviews, cross-team coordination
- **Backend Developer**: `backend/` implementation
- **Frontend Developer**: `frontend/` implementation
- **Test Automation Expert**: `mock-sensors/` implementation
- **Product Owner**: Requirements validation, acceptance testing

---

**Last Updated**: November 22, 2025
