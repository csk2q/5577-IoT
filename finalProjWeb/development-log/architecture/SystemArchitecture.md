# System Architecture Document
**Project:** IoT Nursing Station Dashboard  
**Version:** 1.0  
**Date:** November 22, 2025  
**Author:** Architect  
**Status:** Draft for Review

---

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [System Overview](#system-overview)
3. [Architecture Principles](#architecture-principles)
4. [System Components](#system-components)
5. [Technology Stack](#technology-stack)
6. [Data Architecture](#data-architecture)
7. [Security Architecture](#security-architecture)
8. [Real-time Data Flow](#real-time-data-flow)
9. [Deployment Architecture](#deployment-architecture)
10. [Scalability Considerations](#scalability-considerations)
11. [Risk Mitigation](#risk-mitigation)

---

## Executive Summary

This document defines the technical architecture for the IoT Nursing Station Dashboard, a real-time patient monitoring system that collects vital signs data from ESP32 sensors and presents it to healthcare professionals through a web interface.

**Key Architectural Decisions:**
- **Frontend:** React with TypeScript and Bootstrap for responsive, type-safe UI
- **Backend:** Node.js with Express for scalable API services
- **Database:** MySQL with encryption for HIPAA-compliant data storage
- **Real-time Communication:** Server-Sent Events (SSE) for efficient data streaming
- **Security:** Multi-layered approach with JWT authentication, encryption, and audit logging

**Target Metrics:**
- Support 30 patients concurrently (MVP), scalable to 100+
- Real-time updates every 5 seconds with <500ms latency
- 99.9% uptime during operation
- HIPAA-compliant data handling

---

## System Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     IoT Nursing Station System                   │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────┐                                ┌──────────────┐
│  ESP32 Sensors   │                                │  Healthcare  │
│  (External)      │                                │  Professionals│
│                  │                                │              │
│  - Heart Rate    │                                │  - Nurses    │
│  - Blood O2      │                                │  - Admins    │
│  - Alert Button  │                                │  - Intake    │
│  - RGB LED       │                                │              │
└────────┬─────────┘                                └──────┬───────┘
         │                                                  │
         │ HTTP POST (JSON)                                │ HTTPS
         │ Every 5 seconds                                 │
         ▼                                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Web Application                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐   │
│  │              Frontend (Client-Side)                     │   │
│  │  ┌──────────────────────────────────────────────────┐  │   │
│  │  │  React + TypeScript + Bootstrap                   │  │   │
│  │  │                                                    │  │   │
│  │  │  Components:                                       │  │   │
│  │  │  • Login / Authentication                          │  │   │
│  │  │  • Patient Dashboard (Grid)                        │  │   │
│  │  │  • Patient Card (with Spark Graphs)                │  │   │
│  │  │  • Admin User Management                           │  │   │
│  │  │  • Patient Intake Form                             │  │   │
│  │  │  • Alert Configuration                             │  │   │
│  │  │                                                    │  │   │
│  │  │  State Management: React Context + Custom Hooks   │  │   │
│  │  └──────────────────────────────────────────────────┘  │   │
│  │                                                          │   │
│  │  ┌──────────────────────────────────────────────────┐  │   │
│  │  │  Real-time Data Layer                             │  │   │
│  │  │  • SSE Client (EventSource)                       │  │   │
│  │  │  • Data Buffer (Last 20 Readings)                 │  │   │
│  │  │  • Alert Detection Logic                          │  │   │
│  │  └──────────────────────────────────────────────────┘  │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                                  │
│                            │                                     │
│                            │ HTTPS                               │
│                            │ REST API / SSE                      │
│                            ▼                                     │
│  ┌────────────────────────────────────────────────────────┐   │
│  │              Backend (Server-Side)                      │   │
│  │  ┌──────────────────────────────────────────────────┐  │   │
│  │  │  Node.js + Express                                │  │   │
│  │  │                                                    │  │   │
│  │  │  API Layer:                                        │  │   │
│  │  │  • Authentication Endpoints                        │  │   │
│  │  │  • User Management API                             │  │   │
│  │  │  • Patient Management API                          │  │   │
│  │  │  • Sensor Data Ingestion API                       │  │   │
│  │  │  • Alert Configuration API                         │  │   │
│  │  │  • SSE Streaming Endpoint                          │  │   │
│  │  │                                                    │  │   │
│  │  │  Middleware:                                       │  │   │
│  │  │  • JWT Authentication                              │  │   │
│  │  │  • Role-Based Access Control (RBAC)               │  │   │
│  │  │  • Input Validation & Sanitization                │  │   │
│  │  │  • Audit Logging                                   │  │   │
│  │  │  • Error Handling                                  │  │   │
│  │  └──────────────────────────────────────────────────┘  │   │
│  │                                                          │   │
│  │  ┌──────────────────────────────────────────────────┐  │   │
│  │  │  Service Layer                                    │  │   │
│  │  │  • Authentication Service                         │  │   │
│  │  │  • User Service                                   │  │   │
│  │  │  • Patient Service                                │  │   │
│  │  │  • Sensor Service                                 │  │   │
│  │  │  • Alert Service                                  │  │   │
│  │  │  • Notification Service                           │  │   │
│  │  └──────────────────────────────────────────────────┘  │   │
│  │                                                          │   │
│  │  ┌──────────────────────────────────────────────────┐  │   │
│  │  │  Data Access Layer                                │  │   │
│  │  │  • Repository Pattern                             │  │   │
│  │  │  • Connection Pooling                             │  │   │
│  │  │  • Query Optimization                             │  │   │
│  │  └──────────────────────────────────────────────────┘  │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                                  │
│                            │                                     │
│                            │ SQL + Encryption                    │
│                            ▼                                     │
│  ┌────────────────────────────────────────────────────────┐   │
│  │              Database Layer                             │   │
│  │  ┌──────────────────────────────────────────────────┐  │   │
│  │  │  MySQL Database (Encrypted at Rest)              │  │   │
│  │  │                                                    │  │   │
│  │  │  Tables:                                           │  │   │
│  │  │  • users                                           │  │   │
│  │  │  • patients                                        │  │   │
│  │  │  • sensors                                         │  │   │
│  │  │  • sensor_readings (time-series data)             │  │   │
│  │  │  • alert_thresholds                                │  │   │
│  │  │  • alerts                                          │  │   │
│  │  │  • audit_logs                                      │  │   │
│  │  │                                                    │  │   │
│  │  │  Indexes: Optimized for time-series queries       │  │   │
│  │  └──────────────────────────────────────────────────┘  │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                  External Test Framework                          │
│  ┌────────────────────────────────────────────────────────┐     │
│  │  Mock Sensor Framework                                  │     │
│  │  • Simulates ESP32 sensor behavior                      │     │
│  │  • Configurable scenarios (normal, critical, offline)   │     │
│  │  • Load testing (1-100+ sensors)                        │     │
│  │  • NOT part of production deployment                    │     │
│  └────────────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────────┘
```

---

## Architecture Principles

### 1. Separation of Concerns
- **Presentation Layer (Frontend):** UI components, user interaction, data visualization
- **Business Logic Layer (Backend Services):** Authentication, authorization, data processing, alert detection
- **Data Access Layer:** Database queries, connection management, caching
- **Data Storage Layer:** Persistent storage with encryption

### 2. Scalability
- Stateless backend services enable horizontal scaling
- Connection pooling for efficient database access
- SSE for efficient one-way real-time communication (vs bidirectional WebSockets)
- Database indexing optimized for time-series queries

### 3. Security-First Design
- HIPAA compliance at every layer
- Defense in depth: multiple security layers
- Principle of least privilege for user roles
- Comprehensive audit logging

### 4. Maintainability
- Clear separation between layers
- Consistent coding patterns and conventions
- Comprehensive documentation
- Type safety with TypeScript

### 5. Testability
- Mockable external dependencies (sensors)
- Unit tests for business logic
- Integration tests for API endpoints
- E2E tests for critical workflows

---

## System Components

### Frontend Components

#### 1. Authentication Module
- **Login Component:** Employee ID + password authentication
- **Session Management:** JWT token storage and refresh
- **Route Guards:** Role-based route protection
- **Logout:** Session cleanup and token invalidation

#### 2. Nurse Dashboard Module
- **Dashboard Container:** Grid layout management
- **Patient Card Component:** Individual patient display with:
  - Patient info (name, room, ID)
  - Current readings (O2, heart rate)
  - Spark line graphs (last 20 readings)
  - Alert indicators
- **Sorting Controls:** Room number, name, patient ID
- **Real-time Updates:** SSE integration for live data
- **Alert Emphasis:** Visual highlighting for critical patients

#### 3. Admin Module
- **User List:** Display all system users
- **User Management:** Create, disable, enable users
- **Password Reset:** Trigger password reset emails

#### 4. Patient Intake Module
- **Intake Form:** Collect patient and sensor information
- **Validation:** Ensure sensor availability and data integrity

#### 5. Configuration Module
- **Alert Threshold Settings:** Per-patient O2 and heart rate limits

### Backend Components

#### 1. Authentication Service
- Login/logout functionality
- JWT token generation and validation
- Password hashing (bcrypt)
- Session management

#### 2. User Service
- User CRUD operations
- Role management
- Password reset workflow

#### 3. Patient Service
- Patient registration
- Patient-sensor association
- Patient data retrieval

#### 4. Sensor Service
- Sensor data ingestion from ESP32 devices
- Sensor status tracking
- Offline detection (15-second timeout)

#### 5. Alert Service
- Threshold comparison
- Alert generation and storage
- Alert notification

#### 6. Real-time Streaming Service
- SSE connection management
- Active client tracking
- Selective data broadcasting

---

## Technology Stack

### Frontend
| Component | Technology | Justification |
|-----------|-----------|---------------|
| Framework | React 18+ | Component-based, efficient rendering, large ecosystem |
| Language | TypeScript | Type safety, better IDE support, fewer runtime errors |
| CSS Framework | Bootstrap 5 | Rapid development, responsive grid, professional components |
| Charts | Chart.js or Recharts | Lightweight, smooth animations, real-time capable |
| HTTP Client | Axios | Promise-based, interceptors for auth, error handling |
| State Management | React Context + useReducer | Built-in, sufficient for app complexity |
| Build Tool | Vite | Fast development server, optimized builds |

### Backend
| Component | Technology | Justification |
|-----------|-----------|---------------|
| Runtime | Node.js 18+ LTS | Non-blocking I/O, excellent for real-time apps |
| Framework | Express 4+ | Minimal, flexible, well-documented |
| Language | JavaScript (ES6+) | Native Node.js support, team familiarity |
| Authentication | jsonwebtoken | JWT standard implementation |
| Password Hashing | bcrypt | Industry standard, secure salt+hash |
| Validation | express-validator | Request validation middleware |
| Database Driver | mysql2 | Promise-based, connection pooling, prepared statements |
| Environment Config | dotenv | Standard environment variable management |
| Logging | winston | Structured logging, multiple transports |

### Database
| Component | Technology | Justification |
|-----------|-----------|---------------|
| RDBMS | MySQL 8+ | ACID compliance, mature, excellent time-series support |
| Encryption | MySQL encryption at rest | Built-in, HIPAA-compliant |
| Connection Pooling | mysql2 pool | Efficient connection reuse |

### Testing
| Component | Technology | Justification |
|-----------|-----------|---------------|
| Backend Testing | Jest + Supertest | Standard Node.js testing, API testing |
| Frontend Testing | Jest + React Testing Library | Component testing, user-centric |
| E2E Testing | Playwright or Cypress | Full workflow testing |
| Mock Framework | Custom Node.js service | Simulate ESP32 sensors |
| Load Testing | Artillery or K6 | Performance validation |

---

## Data Architecture

### Database Schema

```sql
-- Users table
CREATE TABLE users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id VARCHAR(6) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('nurse', 'admin', 'intake') NOT NULL,
    status ENUM('active', 'disabled') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_employee_id (employee_id),
    INDEX idx_role_status (role, status)
) ENGINE=InnoDB;

-- Patients table
CREATE TABLE patients (
    patient_id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    room_number VARCHAR(20) NOT NULL,
    sensor_id VARCHAR(50) UNIQUE NOT NULL,
    status ENUM('active', 'discharged') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_room_number (room_number),
    INDEX idx_sensor_id (sensor_id),
    INDEX idx_status (status)
) ENGINE=InnoDB;

-- Sensors table
CREATE TABLE sensors (
    sensor_id VARCHAR(50) PRIMARY KEY,
    status ENUM('online', 'offline', 'error') DEFAULT 'offline',
    last_reading_time TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_status (status),
    INDEX idx_last_reading (last_reading_time)
) ENGINE=InnoDB;

-- Sensor readings (time-series data)
CREATE TABLE sensor_readings (
    reading_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    sensor_id VARCHAR(50) NOT NULL,
    timestamp TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP(3),
    oxygen_level DECIMAL(5,2) NOT NULL,  -- 0.00 to 100.00
    heart_rate INT NOT NULL,              -- beats per minute
    FOREIGN KEY (sensor_id) REFERENCES sensors(sensor_id) ON DELETE CASCADE,
    INDEX idx_sensor_timestamp (sensor_id, timestamp DESC),
    INDEX idx_timestamp (timestamp)
) ENGINE=InnoDB;

-- Alert thresholds (per-patient configuration)
CREATE TABLE alert_thresholds (
    threshold_id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id VARCHAR(50) NOT NULL,
    metric_type ENUM('oxygen_level', 'heart_rate') NOT NULL,
    lower_limit DECIMAL(10,2) NOT NULL,
    upper_limit DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE,
    UNIQUE KEY unique_patient_metric (patient_id, metric_type),
    INDEX idx_patient_id (patient_id)
) ENGINE=InnoDB;

-- Alerts table
CREATE TABLE alerts (
    alert_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    patient_id VARCHAR(50) NOT NULL,
    sensor_id VARCHAR(50) NOT NULL,
    alert_type ENUM('button_pressed', 'vitals_critical', 'sensor_offline') NOT NULL,
    metric_type ENUM('oxygen_level', 'heart_rate', 'none') DEFAULT 'none',
    metric_value DECIMAL(10,2) NULL,
    threshold_exceeded ENUM('upper', 'lower', 'none') DEFAULT 'none',
    acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_by INT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    acknowledged_at TIMESTAMP NULL,
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE,
    FOREIGN KEY (sensor_id) REFERENCES sensors(sensor_id) ON DELETE CASCADE,
    FOREIGN KEY (acknowledged_by) REFERENCES users(user_id) ON DELETE SET NULL,
    INDEX idx_patient_timestamp (patient_id, timestamp DESC),
    INDEX idx_acknowledged (acknowledged),
    INDEX idx_timestamp (timestamp)
) ENGINE=InnoDB;

-- Audit logs (HIPAA compliance)
CREATE TABLE audit_logs (
    log_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id VARCHAR(100) NULL,
    ip_address VARCHAR(45) NULL,
    user_agent TEXT NULL,
    details JSON NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL,
    INDEX idx_user_timestamp (user_id, timestamp DESC),
    INDEX idx_action (action),
    INDEX idx_timestamp (timestamp)
) ENGINE=InnoDB;
```

### Data Retention Strategy

**MVP (30-day retention):**
- Keep all sensor readings for 30 days
- Archive older data to cold storage (future enhancement)
- Maintain audit logs indefinitely (compliance requirement)

**Future Considerations:**
- Aggregate older data (hourly/daily averages)
- Implement data archival process
- Consider time-series optimized storage (TimescaleDB extension)

---

## Security Architecture

### Authentication Flow

```
┌─────────────┐                                      ┌─────────────┐
│   Client    │                                      │   Server    │
│  (Browser)  │                                      │  (Backend)  │
└──────┬──────┘                                      └──────┬──────┘
       │                                                     │
       │  POST /api/auth/login                              │
       │  { employee_id, password }                         │
       │────────────────────────────────────────────────────>│
       │                                                     │
       │                                    Validate credentials
       │                                    (bcrypt compare)
       │                                                     │
       │                                    Generate JWT token
       │                                    (expires in 8 hours)
       │                                                     │
       │  200 OK                                            │
       │  { token, user: { id, role, employee_id } }       │
       │<────────────────────────────────────────────────────│
       │                                                     │
  Store token                                               │
  (localStorage)                                            │
       │                                                     │
       │  GET /api/patients                                 │
       │  Authorization: Bearer <token>                     │
       │────────────────────────────────────────────────────>│
       │                                                     │
       │                                    Verify JWT token
       │                                    Check role permissions
       │                                                     │
       │  200 OK                                            │
       │  { patients: [...] }                               │
       │<────────────────────────────────────────────────────│
       │                                                     │
```

### Role-Based Access Control (RBAC)

| Role | Permissions |
|------|-------------|
| **nurse** | • View patient dashboard<br>• View patient data<br>• Configure alert thresholds<br>• Acknowledge alerts |
| **admin** | • All nurse permissions<br>• Create/disable/enable users<br>• Trigger password resets<br>• View audit logs |
| **intake** | • Add new patients<br>• Assign sensors to patients<br>• View patient list |

### Security Layers

**Layer 1: Transport Security**
- HTTPS/TLS 1.3 for all communications
- HTTP Strict Transport Security (HSTS) headers

**Layer 2: Authentication**
- JWT tokens with 8-hour expiration
- Secure password hashing with bcrypt (cost factor: 12)
- Session invalidation on logout

**Layer 3: Authorization**
- Role-based middleware checks on all protected routes
- Resource-level permission validation

**Layer 4: Input Validation**
- All inputs validated and sanitized
- Parameterized SQL queries (prevent SQL injection)
- XSS protection headers

**Layer 5: Data Protection**
- MySQL encryption at rest
- Sensitive data excluded from logs
- PII/PHI handling per HIPAA guidelines

**Layer 6: Audit & Monitoring**
- All data access logged with user, timestamp, action
- Failed authentication attempts tracked
- Anomaly detection for suspicious patterns

---

## Real-time Data Flow

### Sensor Data Ingestion Flow

```
┌──────────────┐
│  ESP32       │
│  Sensor      │
└──────┬───────┘
       │
       │ Every 5 seconds
       │ POST /api/sensors/data
       │ {
       │   sensor_id: "SENSOR_001",
       │   oxygen_level: 97.5,
       │   heart_rate: 72,
       │   timestamp: "2025-11-22T10:30:15.123Z"
       │ }
       ▼
┌────────────────────────────────────────┐
│  Backend API                            │
│  ┌──────────────────────────────────┐  │
│  │ 1. Validate sensor_id            │  │
│  │ 2. Validate data ranges          │  │
│  │ 3. Update sensor status (online) │  │
│  │ 4. Store reading in database     │  │
│  │ 5. Check alert thresholds        │  │
│  │ 6. Generate alerts if needed     │  │
│  │ 7. Broadcast to SSE clients      │  │
│  └──────────────────────────────────┘  │
└────────────────────────────────────────┘
       │
       │ SSE Broadcast
       ▼
┌────────────────────────────────────────┐
│  Connected Clients                      │
│  ┌──────────────────────────────────┐  │
│  │ Receive new reading               │  │
│  │ Update patient card               │  │
│  │ Update spark line graph           │  │
│  │ Show alert if threshold exceeded  │  │
│  └──────────────────────────────────┘  │
└────────────────────────────────────────┘
```

### Server-Sent Events (SSE) Architecture

**Why SSE over WebSockets?**
- Unidirectional data flow (server → client only)
- Simpler protocol, less overhead
- Automatic reconnection built-in
- HTTP/2 multiplexing support
- No need for client-to-server real-time communication

**SSE Implementation:**

```javascript
// Server-side (simplified)
app.get('/api/stream/sensor-data', authenticateJWT, roleCheck('nurse'), (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  const clientId = generateClientId();
  connectedClients.set(clientId, res);
  
  // Send initial connection confirmation
  res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);
  
  // Cleanup on disconnect
  req.on('close', () => {
    connectedClients.delete(clientId);
  });
});

// Broadcast new sensor data to all connected clients
function broadcastSensorData(sensorReading) {
  const data = JSON.stringify({
    type: 'sensor_reading',
    data: sensorReading
  });
  
  connectedClients.forEach((clientRes) => {
    clientRes.write(`data: ${data}\n\n`);
  });
}
```

```typescript
// Client-side (simplified)
const eventSource = new EventSource('/api/stream/sensor-data', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

eventSource.onmessage = (event) => {
  const { type, data } = JSON.parse(event.data);
  
  if (type === 'sensor_reading') {
    updatePatientCard(data);
  }
};

eventSource.onerror = (error) => {
  console.error('SSE connection error:', error);
  // Automatic reconnection handled by EventSource
};
```

---

## Deployment Architecture

### Development Environment
```
┌─────────────────────────────────────────┐
│  Developer Workstation                   │
│  • Frontend: npm run dev (Vite)         │
│  • Backend: npm run dev (nodemon)       │
│  • Database: Local MySQL                │
│  • Mock Sensors: Local Node.js          │
└─────────────────────────────────────────┘
```

### Production Environment (Future)
```
┌───────────────────────────────────────────────────┐
│  Load Balancer (HTTPS)                            │
└────────────────┬──────────────────────────────────┘
                 │
        ┌────────┴────────┐
        │                 │
        ▼                 ▼
┌───────────────┐  ┌───────────────┐
│ App Server 1  │  │ App Server 2  │
│ (Node.js)     │  │ (Node.js)     │
└───────┬───────┘  └───────┬───────┘
        │                  │
        └────────┬─────────┘
                 │
                 ▼
        ┌────────────────┐
        │  MySQL Server  │
        │  (Primary)     │
        └────────────────┘
                 │
                 ▼
        ┌────────────────┐
        │  MySQL Server  │
        │  (Replica)     │
        └────────────────┘
```

---

## Scalability Considerations

### Current Capacity (MVP)
- **Patients:** 30 concurrent
- **Data Rate:** 30 sensors × 5 seconds = 6 readings/second
- **Database Writes:** ~520,000 readings/day
- **SSE Connections:** Up to 50 concurrent nurse sessions

### Scaling Strategies

**Horizontal Scaling:**
- Add more Node.js instances behind load balancer
- Stateless design enables easy scaling
- Session state in JWT tokens (no server-side session storage)

**Database Optimization:**
- Connection pooling (already implemented)
- Read replicas for reporting queries
- Partitioning sensor_readings table by date

**Caching:**
- Redis for active patient data (future enhancement)
- In-memory caching of alert thresholds
- Client-side caching with ETags

**Performance Targets:**
| Metric | Target |
|--------|--------|
| API Response Time | < 200ms (p95) |
| SSE Data Latency | < 500ms |
| Database Query Time | < 50ms (p95) |
| Page Load Time | < 2 seconds |

---

## Risk Mitigation

### Technical Risks

**Risk 1: Real-time Performance Degradation**
- **Mitigation:** Load testing with 100+ mock sensors, performance monitoring, database query optimization
- **Fallback:** Reduce update frequency, implement data throttling

**Risk 2: Database Growth**
- **Mitigation:** 30-day retention policy, data archival process, table partitioning
- **Monitoring:** Database size alerts, query performance tracking

**Risk 3: SSE Connection Stability**
- **Mitigation:** Automatic reconnection, heartbeat mechanism, connection timeout handling
- **Fallback:** Polling mode for unstable connections

**Risk 4: Security Breach**
- **Mitigation:** Multi-layer security, regular security audits, penetration testing
- **Response Plan:** Incident response procedures, audit log analysis

**Risk 5: Sensor Offline Detection Delays**
- **Mitigation:** 15-second timeout threshold, immediate alert generation
- **Monitoring:** Sensor status dashboard for staff

### Operational Risks

**Risk 6: Data Loss**
- **Mitigation:** Database backups (daily), transaction logs, replica servers
- **Recovery:** Point-in-time recovery capability

**Risk 7: System Downtime**
- **Mitigation:** High availability architecture, health check endpoints, monitoring
- **Target:** 99.9% uptime (< 9 hours downtime/year)

---

## Next Steps

### Week 1 Deliverables
1. ✅ This architecture document
2. 🔄 API contract specification (in progress)
3. 🔄 Database schema implementation
4. 🔄 Security implementation guide

### For Review
- [ ] Product Owner: Approve overall architecture approach
- [ ] Backend Developer: Validate database schema and API design
- [ ] UI Developer: Confirm frontend architecture and API contracts
- [ ] Test Automation Expert: Review mock sensor integration points

---

**Document Status:** Ready for Team Review  
**Next Review:** End of Week 1  
**Approval Required From:** Product Owner, Technical Team

---

*This document is a living document and will be updated as the project evolves.*
