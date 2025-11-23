# Code Review Session - IoT Nursing Station Dashboard

**Date:** November 23, 2025  
**Participants:** Architect, Senior Developers, Development Team  
**Duration:** 90 minutes  
**Focus:** Best practices, architecture, code quality, SSE real-time updates

---

## Meeting Agenda

### 1. Architecture Review (20 minutes)
- System architecture overview
- Technology stack decisions
- Data flow and real-time communication strategy
- Security implementation

### 2. Backend Code Review (25 minutes)
- API design and RESTful practices
- Database schema and queries
- Server-Sent Events (SSE) implementation
- Error handling and logging
- Security (JWT, CORS, authentication)

### 3. Frontend Code Review (25 minutes)
- Component architecture
- State management
- Real-time data handling (SSE/EventSource)
- Type safety (TypeScript)
- Error boundaries and error handling

### 4. Current Issues & Solutions (15 minutes)
- SSE connection stability issues
- Real-time data not updating on dashboard
- Root cause analysis and proposed fixes

### 5. Action Items & Next Steps (5 minutes)

---

## 1. Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (Client)                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  React Frontend (TypeScript)                             │  │
│  │  - Role-based routing (Admin/Intake/Nurse)              │  │
│  │  - Real-time dashboard (SSE)                             │  │
│  │  - Bootstrap UI components                               │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                    HTTP/SSE  │  localhost:3000
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    Backend API (Node.js/Express)                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  REST API                    │  SSE Stream               │  │
│  │  - Authentication (JWT)      │  - Sensor readings        │  │
│  │  - User management           │  - Alert notifications    │  │
│  │  - Patient management        │  - Connection management  │  │
│  │  - Sensor data ingestion     │  - Heartbeat              │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    MySQL Database                                │
│  - Users (authentication)                                        │
│  - Patients (demographics)                                       │
│  - Sensors (device management)                                   │
│  - Sensor_readings (time-series data)                           │
│  - Alerts (threshold violations)                                │
│  - Alert_thresholds (patient-specific limits)                   │
└─────────────────────────────────────────────────────────────────┘
```

### Technology Stack
- **Frontend:** React 18, TypeScript, React Router, Bootstrap, Vite
- **Backend:** Node.js 18, Express.js, MySQL2
- **Database:** MySQL 8.0
- **Real-time:** Server-Sent Events (SSE)
- **Authentication:** JWT tokens
- **Deployment:** Docker Compose

---

## 2. Backend Code Review

### 2.1 API Structure

**Location:** `implementation/backend/src/`

```
src/
├── server.js                 # Express app setup, middleware, routing
├── config/
│   └── database.js          # MySQL connection pool
├── controllers/             # Business logic
│   ├── authController.js
│   ├── userController.js
│   ├── patientController.js
│   ├── sensorController.js
│   └── alertController.js
├── middleware/
│   ├── auth.js              # JWT verification
│   └── errorHandler.js
├── routes/                  # Route definitions
│   ├── authRoutes.js
│   ├── userRoutes.js
│   ├── patientRoutes.js
│   ├── sensorRoutes.js
│   ├── alertRoutes.js
│   └── sseRoutes.js         # SSE streaming endpoint
└── utils/
    └── logger.js            # Winston logger
```

### 2.2 Key Review Points

#### ✅ **Strengths:**
1. **Clear separation of concerns** - Controllers, routes, middleware properly separated
2. **JWT authentication** - Secure token-based auth with role-based access control
3. **Database connection pooling** - Efficient MySQL connection management
4. **Comprehensive logging** - Winston logger with structured logging
5. **Input validation** - Request validation in controllers
6. **CORS configuration** - Properly configured for Docker/dev environments

#### ⚠️ **Areas for Improvement:**

##### A. SSE Implementation Issues

**File:** `implementation/backend/src/routes/sseRoutes.js`

**Current Issue:**
```javascript
// Line 24-43
router.get('/sensor-data', (req, res) => {
  // CORS headers added recently
  const origin = req.get('origin');
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  
  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); 
  
  // Store client connection
  clients.set(clientId, res);
  // ...
});
```

**Problems:**
1. **No authentication** - SSE endpoint is completely open, no JWT verification
2. **CORS handling** - Manual CORS headers instead of using middleware
3. **No cleanup on error** - If broadcast fails, dead connections may accumulate
4. **No connection limits** - Unlimited clients can connect

**Recommended Fix:**
```javascript
// Add authentication middleware
const { verifyToken } = require('../middleware/auth');

router.get('/sensor-data', verifyToken, (req, res) => {
  // Limit concurrent connections per user
  const userConnections = Array.from(clients.values())
    .filter(c => c.userId === req.user.user_id);
  
  if (userConnections.length >= MAX_CONNECTIONS_PER_USER) {
    return res.status(429).json({ error: 'Too many connections' });
  }
  
  // CORS should be handled by global middleware, not here
  
  // SSE setup...
  const clientId = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  
  clients.set(clientId, {
    response: res,
    userId: req.user.user_id,
    connectedAt: new Date()
  });
  
  // Cleanup on ANY error
  const cleanup = () => {
    clients.delete(clientId);
    logger.info(`SSE client disconnected: ${clientId}`);
  };
  
  req.on('close', cleanup);
  res.on('error', cleanup);
  res.on('finish', cleanup);
  
  // Rest of implementation...
});
```

##### B. Database Query Optimization

**File:** `implementation/backend/src/controllers/patientController.js`

**Current Issue:**
```javascript
// Line 52-62 - Multiple queries in a row
const [patients] = await db.query(
  `SELECT 
    p.patient_id,
    p.patient_identifier as patient_id,  // ⚠️ Overwriting patient_id!
    CONCAT(p.first_name, ' ', p.last_name) as name,
    p.room_number,
    s.sensor_identifier as sensor_id,
    p.status,
    p.created_at
   FROM patients p
   LEFT JOIN sensors s ON s.patient_id = p.patient_id AND s.status = 'active'
   ${whereClause}
   ORDER BY ${sortMap[sortColumn]} ASC
   LIMIT ? OFFSET ?`,
  [...queryParams, parseInt(limit), offset]
);
```

**Problems:**
1. **Column name collision** - `patient_identifier` aliased as `patient_id` overwrites `p.patient_id`
2. **No indexes mentioned** - Performance concerns for large datasets
3. **String concatenation** - SQL injection risk if sortMap not validated properly

**Recommended Fix:**
```javascript
const [patients] = await db.query(
  `SELECT 
    p.patient_id as id,                      // Use clear naming
    p.patient_identifier,
    CONCAT(p.first_name, ' ', p.last_name) as name,
    p.room_number,
    s.sensor_identifier as sensor_id,
    p.status,
    p.created_at,
    sr.heart_rate,                          // Include latest reading
    sr.oxygen_level,
    sr.temperature,
    sr.timestamp as last_reading_time
   FROM patients p
   LEFT JOIN sensors s ON s.patient_id = p.patient_id AND s.status = 'active'
   LEFT JOIN LATERAL (
     SELECT heart_rate, oxygen_level, temperature, timestamp
     FROM sensor_readings
     WHERE sensor_id = s.sensor_id
     ORDER BY timestamp DESC
     LIMIT 1
   ) sr ON true
   ${whereClause}
   ORDER BY ${sortMap[sortColumn]} ASC
   LIMIT ? OFFSET ?`,
  [...queryParams, parseInt(limit), offset]
);
```

##### C. Error Handling Consistency

**Current Issue:** Error handling varies across controllers

**Example inconsistencies:**
```javascript
// Some controllers:
catch (error) {
  logger.error('Get patients error:', error);
  res.status(500).json({...});
}

// Others:
catch (err) {
  console.error('Error:', err);  // ⚠️ Using console.error
  res.status(500).json({...});
}
```

**Recommended:** 
- Use consistent error logger (Winston)
- Implement centralized error handling middleware
- Return structured error responses

---

## 3. Frontend Code Review

### 3.1 Component Structure

**Location:** `implementation/frontend/src/`

```
src/
├── main.tsx                 # App entry point
├── App.tsx                  # Root component
├── components/
│   ├── ErrorBoundary.tsx    # Error boundary wrapper
│   └── PatientCard.tsx      # Patient vital signs card
├── contexts/
│   └── AuthContext.tsx      # Authentication state
├── hooks/
│   └── useSSE.ts            # Server-Sent Events hook
├── pages/
│   ├── LoginPage.tsx
│   ├── DashboardPage.tsx    # Nurse dashboard
│   ├── AdminDashboardPage.tsx
│   └── IntakeDashboardPage.tsx
├── routes/
│   └── AppRoutes.tsx        # React Router setup
├── services/
│   └── api.ts               # API client (Axios)
└── types/
    └── index.ts             # TypeScript definitions
```

### 3.2 Key Review Points

#### ✅ **Strengths:**
1. **TypeScript throughout** - Full type safety
2. **Functional components with hooks** - Modern React patterns
3. **Context API for auth** - Clean state management
4. **Error boundaries** - Graceful error handling
5. **Custom hooks** - Reusable SSE logic in `useSSE`
6. **Bootstrap components** - Consistent UI

#### ⚠️ **Areas for Improvement:**

##### A. SSE Hook - Dependency Issues

**File:** `implementation/frontend/src/hooks/useSSE.ts`

**Critical Issue:**
```typescript
// Lines 136-250
const connect = useCallback(() => {
  // ... connection logic
}, [
  url,
  enabled,
  onSensorReading,      // ⚠️ Function prop - changes every render!
  onAlertTriggered,     // ⚠️ Function prop - changes every render!
  onAlertAcknowledged,  // ⚠️ Function prop - changes every render!
  onSensorStatus,       // ⚠️ Function prop - changes every render!
  onConnected,          // ⚠️ Function prop - changes every render!
  onError,              // ⚠️ Function prop - changes every render!
  reconnectInterval,
]);

// Line 287-295
useEffect(() => {
  if (enabled) {
    connect();
  }
  return () => {
    disconnect();
  };
}, [enabled, url]);  // ⚠️ connect() not in deps but called!
```

**Problems:**
1. **useCallback dependencies** - Callback props cause `connect` to be recreated every render
2. **useEffect missing dependency** - `connect` called but not in dependency array
3. **Infinite reconnect loop** - Constant disconnection/reconnection visible in logs

**Root Cause:** The hook is passed inline arrow functions from DashboardPage:
```typescript
// DashboardPage.tsx
const { connectionState } = useSSE({
  url: '/stream/sensor-data',
  enabled: true,
  onSensorReading: (event) => {  // ⚠️ New function every render
    setSensorData((prev) => {
      const newMap = new Map(prev);
      newMap.set(event.data.sensor_id, {...});
      return newMap;
    });
  },
  onAlertTriggered: (event) => {  // ⚠️ New function every render
    // ...
  },
  // ...
});
```

**Recommended Fix - Option 1: Use Refs for Callbacks:**
```typescript
export function useSSE(options: UseSSEOptions) {
  const {
    url,
    enabled = true,
    reconnectInterval = 3000,
  } = options;
  
  // Store callbacks in refs to avoid recreation
  const callbacksRef = useRef({
    onSensorReading: options.onSensorReading,
    onAlertTriggered: options.onAlertTriggered,
    onAlertAcknowledged: options.onAlertAcknowledged,
    onSensorStatus: options.onSensorStatus,
    onConnected: options.onConnected,
    onError: options.onError,
  });
  
  // Update refs when callbacks change
  useEffect(() => {
    callbacksRef.current = {
      onSensorReading: options.onSensorReading,
      onAlertTriggered: options.onAlertTriggered,
      onAlertAcknowledged: options.onAlertAcknowledged,
      onSensorStatus: options.onSensorStatus,
      onConnected: options.onConnected,
      onError: options.onError,
    };
  });
  
  const connect = useCallback(() => {
    // ... setup EventSource
    
    eventSource.onmessage = (event) => {
      const parsedEvent = JSON.parse(event.data);
      
      switch (parsedEvent.type) {
        case 'sensor_reading':
          callbacksRef.current.onSensorReading?.(parsedEvent);
          break;
        // ... other cases using callbacksRef.current
      }
    };
    
  }, [url, enabled, reconnectInterval]); // Only stable dependencies
  
  useEffect(() => {
    if (enabled) {
      connect();
    }
    return () => disconnect();
  }, [enabled, connect, disconnect]); // Now safe to include
}
```

**Recommended Fix - Option 2: Use Custom Event Emitter:**
```typescript
// Create an EventEmitter for SSE events
class SSEEventEmitter extends EventTarget {
  emitSensorReading(data: SSESensorReadingEvent) {
    this.dispatchEvent(new CustomEvent('sensor_reading', { detail: data }));
  }
  // ... other emit methods
}

// In component:
const sseEmitter = useMemo(() => new SSEEventEmitter(), []);

useEffect(() => {
  const handleSensorReading = (e: CustomEvent) => {
    setSensorData(/* ... */);
  };
  
  sseEmitter.addEventListener('sensor_reading', handleSensorReading);
  return () => sseEmitter.removeEventListener('sensor_reading', handleSensorReading);
}, [sseEmitter]);

useSSE({
  url: '/stream/sensor-data',
  emitter: sseEmitter,  // Pass emitter instead of callbacks
});
```

##### B. Dashboard Component Performance

**File:** `implementation/frontend/src/pages/DashboardPage.tsx`

**Issue:** Large component with multiple concerns

```typescript
// 350+ lines in one component
const DashboardPage = () => {
  // State management (8+ useState)
  // SSE connection
  // Data fetching
  // Event handlers
  // Rendering logic
  // ...
};
```

**Recommended:** Split into smaller components
```typescript
// DashboardPage.tsx - Orchestration only
const DashboardPage = () => {
  return (
    <DashboardLayout>
      <DashboardHeader />
      <PatientGrid />
    </DashboardLayout>
  );
};

// PatientGrid.tsx - Data management
const PatientGrid = () => {
  const patients = usePatientData();
  const realtimeData = useRealtimeSensorData();
  // ...
};

// useRealtimeSensorData.ts - Custom hook
export function useRealtimeSensorData() {
  const [sensorData, setSensorData] = useState(new Map());
  
  useSSE({
    url: '/stream/sensor-data',
    onSensorReading: useCallback((event) => {
      setSensorData(prev => {
        const newMap = new Map(prev);
        newMap.set(event.data.sensor_id, event.data);
        return newMap;
      });
    }, []),
  });
  
  return sensorData;
}
```

##### C. Type Safety Improvements

**File:** `implementation/frontend/src/types/index.ts`

**Current:** Types are defined but not fully utilized

**Recommendations:**
1. **Strict null checks** - Enable `strictNullChecks` in tsconfig.json
2. **Discriminated unions** for API responses
3. **Branded types** for IDs to prevent mixing patient_id and sensor_id

```typescript
// Current
export interface Patient {
  patient_id: string;
  name: string;
  room_number: string;
  sensor_id?: string;  // ⚠️ Optional but critical
  // ...
}

// Recommended
type PatientId = string & { readonly __brand: 'PatientId' };
type SensorId = string & { readonly __brand: 'SensorId' };

export interface Patient {
  patient_id: PatientId;
  name: string;
  room_number: string;
  sensor: {                    // Nested object instead of optional string
    id: SensorId;
    status: 'active' | 'inactive';
  } | null;
  latest_reading: SensorReading | null;
}
```

---

## 4. Current Issues & Root Cause Analysis

### Issue #1: SSE Connection Not Stable

**Symptoms:**
- Browser DevTools shows multiple "cancelled" requests
- Connection status stuck on "Connecting..."
- No real-time data updates on dashboard
- Backend logs show rapid connect/disconnect cycles

**Root Cause:**
1. **Frontend:** `useSSE` hook has dependency array issues causing infinite reconnection loop
2. **Backend:** No authentication on SSE endpoint (separate issue)
3. **Network:** CORS headers manually added instead of using middleware

**Evidence:**
```
# Backend logs show:
info: SSE client connected: 1763914419548-ezt2ui2rz
info: SSE client disconnected: 1763914419548-ezt2ui2rz  # <1ms later!
info: SSE client connected: 1763914508288-1agc6tyl1
info: SSE client disconnected: 1763914508288-1agc6tyl1  # <10ms later!
```

**Solution Priority:**
1. **HIGH:** Fix useSSE hook dependencies (use refs for callbacks)
2. **MEDIUM:** Add authentication to SSE endpoint
3. **LOW:** Clean up CORS handling

### Issue #2: Patient Data Not Showing Latest Readings

**Symptoms:**
- Patient cards show "Offline" status
- No vital signs displayed even though sensors are sending data

**Root Cause:** API doesn't include latest sensor readings in patient list endpoint

**Solution:**
- Join with `sensor_readings` table to get latest reading per patient
- Use LATERAL join or subquery for performance

---

## 5. Best Practices Recommendations

### 5.1 Code Organization

**Current:** Monolithic files (350+ line components)

**Recommendation:**
- **Feature-based structure** instead of type-based
- **Maximum 200 lines per file** as guideline
- **Co-locate related code** (component + hook + styles)

```
src/
├── features/
│   ├── auth/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── services/
│   │   └── types/
│   ├── dashboard/
│   │   ├── components/
│   │   │   ├── DashboardPage.tsx
│   │   │   ├── PatientGrid.tsx
│   │   │   └── PatientCard.tsx
│   │   ├── hooks/
│   │   │   ├── usePatientData.ts
│   │   │   └── useRealtimeSensorData.ts
│   │   └── types/
│   └── patients/
│       └── ...
└── shared/
    ├── components/
    ├── hooks/
    └── utils/
```

### 5.2 Testing Strategy

**Current:** No tests mentioned

**Recommendation:**
1. **Unit tests** for utilities and hooks
2. **Integration tests** for API endpoints
3. **E2E tests** for critical user flows

```javascript
// Example: useSSE.test.ts
describe('useSSE', () => {
  it('should connect to SSE endpoint on mount', () => {
    // ...
  });
  
  it('should handle disconnection and reconnect', () => {
    // ...
  });
  
  it('should not reconnect when callbacks change', () => {
    // This test would fail with current implementation!
  });
});
```

### 5.3 Security Hardening

**Current Issues:**
- SSE endpoint has no authentication
- No rate limiting
- No input sanitization in some controllers

**Recommendations:**
1. **Add JWT verification to SSE endpoint**
2. **Implement rate limiting** (express-rate-limit)
3. **Add request validation** using Joi or Zod
4. **Sanitize all user inputs** before database queries
5. **Enable HTTPS** in production (nginx reverse proxy)

### 5.4 Performance Optimization

**Database:**
- Add indexes on frequently queried columns
- Consider read replicas for sensor data queries
- Implement connection pooling limits

**Frontend:**
- Implement virtual scrolling for large patient lists
- Memoize expensive computations (useMemo)
- Code splitting by route (React.lazy)
- Consider React Query for data fetching/caching

**SSE:**
- Implement backpressure handling
- Add heartbeat mechanism (already done)
- Clean up stale connections periodically

### 5.5 Logging & Monitoring

**Current:** Basic Winston logging

**Recommendations:**
1. **Structured logging** with correlation IDs
2. **Different log levels** for environments
3. **APM tool** (e.g., New Relic, DataDog) for production
4. **Error tracking** (e.g., Sentry)
5. **Metrics** - Connection count, response times, error rates

---

## 6. Action Items

### Immediate (This Sprint):
- [ ] **Fix SSE hook dependencies** - Use refs for callbacks
- [ ] **Add authentication to SSE endpoint** - JWT verification
- [ ] **Include latest readings in patient API** - LATERAL join
- [ ] **Add unit tests for useSSE hook**

### Short-term (Next Sprint):
- [ ] **Refactor DashboardPage** - Split into smaller components
- [ ] **Add TypeScript strict mode** - Enable strictNullChecks
- [ ] **Implement error boundary** for SSE failures
- [ ] **Add database indexes** for performance
- [ ] **Add API integration tests**

### Long-term (Backlog):
- [ ] **Migrate to feature-based structure**
- [ ] **Add E2E tests** (Playwright/Cypress)
- [ ] **Implement caching layer** (Redis)
- [ ] **Add monitoring/APM**
- [ ] **Performance optimization** (virtual scrolling, code splitting)

---

## 7. Discussion Questions for Team

1. **Architecture:** Should we consider WebSockets instead of SSE for bidirectional communication?
2. **State Management:** Is Context API sufficient or should we introduce Redux/Zustand?
3. **Testing:** What's our target code coverage percentage?
4. **Database:** Do we need to plan for horizontal scaling?
5. **Security:** What's our strategy for handling PII/PHI compliance (HIPAA)?
6. **Deployment:** What's our CI/CD pipeline strategy?
7. **Monitoring:** Which APM and error tracking tools should we use?

---

## 8. References & Resources

### Documentation
- [Server-Sent Events Specification](https://html.spec.whatwg.org/multipage/server-sent-events.html)
- [React Hooks Best Practices](https://react.dev/reference/react)
- [Express.js Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)

### Similar Projects
- [Real-time monitoring dashboard patterns](https://grafana.com/docs/)
- [Healthcare IoT reference architecture](https://docs.microsoft.com/en-us/azure/architecture/solution-ideas/articles/remote-patient-monitoring)

---

**Next Steps:**
1. Schedule 90-minute code review session
2. Share this document with all participants 24 hours before meeting
3. Have each developer review their respective areas
4. Prioritize action items based on team discussion
5. Assign owners and deadlines for immediate fixes
