# Changelog

All notable changes to the IoT Nursing Station Dashboard project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Week 3 Planning
- Server-Sent Events (SSE) real-time streaming
- Frontend dashboard with real-time updates
- Mock sensor implementation
- Full end-to-end testing

## [0.2.0] - 2025-11-22 - Week 2 Backend APIs Complete

### Added - Week 2 Backend APIs (19 REST Endpoints)

#### Authentication API (3 endpoints)
- POST /api/v1/auth/login - User authentication with JWT tokens
- POST /api/v1/auth/refresh - Refresh expired access tokens
- POST /api/v1/auth/logout - Invalidate refresh tokens

#### User Management API (4 endpoints)
- GET /api/v1/users - List all users (admin only)
- POST /api/v1/users - Create new user (admin only)
- PUT /api/v1/users/:employee_id/status - Enable/disable user (admin only)
- POST /api/v1/users/password-reset-request - Initiate password reset

#### Patient Management API (5 endpoints)
- GET /api/v1/patients - List all active patients with latest readings
- GET /api/v1/patients/:patient_id - Get patient details with thresholds
- POST /api/v1/patients - Create new patient record (intake only)
- PUT /api/v1/patients/:patient_id - Update patient information
- POST /api/v1/patients/:patient_id/discharge - Discharge patient and unassign sensor

#### Sensor Data API (3 endpoints)
- POST /api/v1/sensors/data - Ingest sensor readings with automatic alert generation
- POST /api/v1/sensors/alert - Receive button press and sensor offline alerts
- GET /api/v1/sensors/:sensor_id/readings - Get historical readings with pagination

#### Alert Management API (4 endpoints)
- GET /api/v1/alerts - List alerts with filtering (patient_id, acknowledged status)
- PATCH /api/v1/alerts/:alert_id/acknowledge - Acknowledge alert with user tracking
- GET /api/v1/patients/:patient_id/thresholds - Get patient alert thresholds
- PUT /api/v1/patients/:patient_id/thresholds - Update patient alert thresholds

#### Backend Infrastructure
- authController.js - JWT authentication with bcrypt password hashing
- userController.js - User CRUD with role-based authorization
- patientController.js - Patient lifecycle management
- sensorController.js - Sensor data ingestion with automatic threshold checking
- alertController.js - Alert management and threshold configuration
- Authentication middleware with JWT verification and role checking
- Error handling middleware with standardized error codes
- Audit logging for all state-changing operations (HIPAA compliance)
- Winston logger with file and console transports
- Database connection pooling with health checks

#### Testing & Quality
- Comprehensive smoke test script (test-api.sh) with 26 automated tests
- Color-coded test output (green pass, red fail)
- Unique test data generation to prevent conflicts on repeated runs
- 100% test pass rate across all implemented APIs
- JSON response validation and error code verification

#### Documentation
- Week 2 Progress Review meeting documentation (Week2ProgressReview.md)
- All personas (CTO, Architect, Backend Dev, Frontend Dev, Test Expert, DevOps)
- Risk assessment and mitigation strategies
- Action items and next phase planning
- Technical demos and validation results

### Added - Week 1 Docker Infrastructure
- Docker containerization for all services (database, backend, frontend)
- docker-compose.yml for orchestrating three-container architecture
- MySQL database container with automatic schema initialization
- Backend Dockerfile with Node.js 18 Alpine base
- Frontend Dockerfile with multi-stage build (Node.js build + nginx serving)
- Nginx reverse proxy configuration for API requests
- Database DDL scripts for automatic schema creation (01-schema.sql)
- Database seed data placeholder script (02-seed-data.sql)
- DOCKER.md comprehensive documentation
- Health checks for all containers
- Docker networking configuration (iot-network bridge)
- Persistent volume for database data
- .env.example for Docker Compose environment variables
- Complete database schema with 7 tables:
  - users (authentication and roles)
  - patients (patient demographics)
  - sensors (IoT device management)
  - sensor_readings (time-series vital signs data)
  - alert_thresholds (per-patient configurable thresholds)
  - alerts (triggered alerts and acknowledgments)
  - audit_logs (HIPAA compliance audit trail)
- Stored procedures for efficient dashboard queries
- Database indexes optimized for time-series queries
- CTO directive review meeting documentation

### Changed
- Updated InitialRequirements.md to include non-functional containerization requirements
- Updated implementation/README.md to recommend Docker as primary setup method
- Updated .gitignore to include docker-compose.override.yml
- Backend database connection now fails fast in containerized environment (to be implemented)

### Technical Decisions
- **Deployment**: Docker Compose for orchestration
- **Database Initialization**: Automatic via mounted init scripts
- **Frontend Serving**: Nginx in production mode with reverse proxy
- **Container Networking**: Bridge network for service-to-service communication
- **Development Workflow**: Flexible - can use local dev servers or containers

### Architecture Updates
- Three-container architecture: database, backend, frontend
- Each service isolated in dedicated container
- Services communicate via Docker network by container name
- External access via port mapping (80 for frontend, 3000 for backend, 3306 for database)

## [0.1.0] - 2025-11-22 - Week 1 Complete

### Added
- Initial project structure
- System architecture documentation (SystemArchitecture.md)
- Complete API contract specification (APIContract.md)
- Initial requirements documentation (InitialRequirements.md)
- Backend framework (Node.js + Express + MySQL)
  - Express server with middleware stack
  - JWT authentication middleware
  - Error handling middleware
  - Winston logger configuration
  - MySQL connection pool setup
- Frontend framework (React + TypeScript + Vite + Bootstrap)
  - React 18 with TypeScript
  - Vite build configuration
  - Bootstrap 5 styling
  - React Router setup
  - Authentication context (AuthContext)
  - API client with Axios and JWT interceptors
  - Complete TypeScript type definitions
  - Protected routes configuration
  - Login and Dashboard page placeholders
- Mock sensors framework structure
  - Package.json with dependencies
  - README with architecture plan
- GitHub Copilot personas for team collaboration
  - copilot-instructions.md (project-wide guidelines)
  - copilot-persona-architect.md
  - copilot-persona-senior-backend.md
  - copilot-persona-senior-ui.md
  - copilot-persona-product-owner.md
  - copilot-persona-test-automation.md
- Week 1 progress review documentation

### Technical Stack Decisions
- **Frontend**: React 18, TypeScript, Vite, Bootstrap 5, Chart.js, React Router, Axios
- **Backend**: Node.js 18+, Express 4, MySQL 8, JWT, bcrypt, Winston, Helmet, CORS
- **Database**: MySQL 8 with encryption at rest
- **Real-time**: Server-Sent Events (SSE) for streaming sensor data
- **Testing**: Jest, Supertest for backend; Mock sensor framework for integration
- **Security**: HIPAA-compliant with JWT, bcrypt, RBAC, audit logging

### Verified
- Backend server starts successfully on port 3000
- Frontend builds without TypeScript errors
- Frontend dev server starts on port 5173
- Mock sensor framework runs successfully
- All dependencies install without critical issues

---

## Version History

- **Unreleased**: Docker containerization implementation (Week 1, post-CTO review)
- **0.1.0**: Initial framework and architecture (Week 1 baseline)

---

## Notes

### Week 1 Achievements
- All Week 1 deliverables completed on schedule
- Architecture and API contracts approved by Product Owner
- Docker containerization added same day as CTO directive
- Team ready to begin Week 2 implementation

### Week 2 Achievements
- **All backend APIs implemented and tested (100% complete)**
- **19 REST endpoints across 5 API categories**
- **26 automated smoke tests with 100% pass rate**
- Automatic alert threshold checking on sensor data ingestion
- Role-based access control for all protected endpoints
- Comprehensive audit logging for HIPAA compliance
- JWT authentication with refresh token support
- Patient lifecycle management (admission, updates, discharge)
- Alert acknowledgment workflow with user tracking
- Configurable per-patient alert thresholds

### Next Phase (Week 3)
- Build login page UI (React component)
- Build dashboard layout UI (patient cards, real-time display)
- Implement API service layer (Axios client)
- Implement MockSensor class for testing
- Add Server-Sent Events (SSE) for real-time streaming
- Implement EventSource client in frontend
- Create event broadcaster service in backend
- End-to-end integration testing

---

**Maintained by**: Architect
**Last Updated**: November 22, 2025
