# API Contract Specification
**Project:** IoT Nursing Station Dashboard  
**Version:** 1.0  
**Date:** November 22, 2025  
**Author:** Architect (with Backend Developer input)  
**Status:** Draft for Review

---

## Table of Contents
1. [Overview](#overview)
2. [General API Conventions](#general-api-conventions)
3. [Authentication APIs](#authentication-apis)
4. [User Management APIs](#user-management-apis)
5. [Patient Management APIs](#patient-management-apis)
6. [Sensor Data APIs](#sensor-data-apis)
7. [Alert Management APIs](#alert-management-apis)
8. [Real-time Streaming API](#real-time-streaming-api)
9. [Error Codes](#error-codes)
10. [Data Models](#data-models)

---

## Overview

This document defines the contract between the frontend and backend systems. All endpoints follow RESTful principles with JSON payloads.

**Base URL:** `https://api.nursestation.local/api/v1`

**Authentication:** JWT Bearer tokens in Authorization header

---

## General API Conventions

### Request Headers
```
Content-Type: application/json
Authorization: Bearer <JWT_TOKEN>
```

### Response Format
All API responses follow this structure:

**Success Response:**
```json
{
  "success": true,
  "data": { /* response data */ },
  "message": "Optional success message"
}
```

**Error Response:**
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": { /* optional error details */ }
  }
}
```

### HTTP Status Codes
- `200 OK` - Successful GET, PUT, PATCH
- `201 Created` - Successful POST (resource created)
- `204 No Content` - Successful DELETE
- `400 Bad Request` - Invalid input
- `401 Unauthorized` - Missing or invalid authentication
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `409 Conflict` - Resource conflict (e.g., duplicate sensor assignment)
- `500 Internal Server Error` - Server error

### Pagination
For list endpoints, pagination follows this pattern:

**Request:**
```
GET /api/v1/patients?page=1&limit=20
```

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [ /* array of items */ ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "totalPages": 3
    }
  }
}
```

---

## Authentication APIs

### POST /auth/login
Authenticate user and receive JWT token.

**Request:**
```json
{
  "employee_id": "123456",
  "password": "securePassword123"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 28800,
    "user": {
      "user_id": 42,
      "employee_id": "123456",
      "role": "nurse"
    }
  }
}
```

**Error Responses:**
- `401 Unauthorized` - Invalid credentials
- `403 Forbidden` - User disabled

---

### POST /auth/logout
Invalidate current session (token blacklisting).

**Request:**
```json
{
  "token": "current_jwt_token"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

### POST /auth/refresh
Refresh JWT token before expiration.

**Request:**
```json
{
  "token": "current_jwt_token"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "token": "new_jwt_token",
    "expiresIn": 28800
  }
}
```

---

## User Management APIs

**Authorization:** Admin role required for all endpoints in this section.

### GET /users
List all users in the system.

**Query Parameters:**
- `page` (optional, default: 1)
- `limit` (optional, default: 50)
- `role` (optional, filter: "nurse" | "admin" | "intake")
- `status` (optional, filter: "active" | "disabled")

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "user_id": 1,
        "employee_id": "123456",
        "role": "nurse",
        "status": "active",
        "created_at": "2025-11-01T08:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 12,
      "totalPages": 1
    }
  }
}
```

---

### POST /users
Create a new user.

**Request:**
```json
{
  "employee_id": "654321",
  "password": "temporaryPassword123",
  "role": "nurse"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "user_id": 43,
    "employee_id": "654321",
    "role": "nurse",
    "status": "active",
    "created_at": "2025-11-22T10:30:00Z"
  },
  "message": "User created successfully"
}
```

**Error Responses:**
- `400 Bad Request` - Invalid employee_id format or weak password
- `409 Conflict` - Employee ID already exists

---

### PATCH /users/:user_id/status
Enable or disable a user.

**Request:**
```json
{
  "status": "disabled"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "user_id": 43,
    "status": "disabled",
    "updated_at": "2025-11-22T10:35:00Z"
  },
  "message": "User status updated"
}
```

---

### POST /users/:user_id/password-reset
Trigger password reset email.

**Request:** (empty body)

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Password reset email sent to user"
}
```

---

## Patient Management APIs

**Authorization:** Nurse, Admin, or Intake role required.

### GET /patients
List all active patients.

**Query Parameters:**
- `page` (optional, default: 1)
- `limit` (optional, default: 100)
- `status` (optional, default: "active", values: "active" | "discharged")
- `sort` (optional, default: "room_number", values: "room_number" | "name" | "patient_id")

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "patient_id": "P12345",
        "name": "John Doe",
        "room_number": "101A",
        "sensor_id": "SENSOR_001",
        "status": "active",
        "created_at": "2025-11-20T14:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 100,
      "total": 28,
      "totalPages": 1
    }
  }
}
```

---

### GET /patients/:patient_id
Get detailed information for a specific patient.

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "patient_id": "P12345",
    "name": "John Doe",
    "room_number": "101A",
    "sensor_id": "SENSOR_001",
    "status": "active",
    "created_at": "2025-11-20T14:00:00Z",
    "alert_thresholds": {
      "oxygen_level": {
        "lower_limit": 90.0,
        "upper_limit": 100.0
      },
      "heart_rate": {
        "lower_limit": 60,
        "upper_limit": 100
      }
    },
    "latest_reading": {
      "oxygen_level": 97.5,
      "heart_rate": 72,
      "timestamp": "2025-11-22T10:30:15Z"
    }
  }
}
```

---

### POST /patients
Add a new patient (Intake role required).

**Request:**
```json
{
  "patient_id": "P67890",
  "name": "Jane Smith",
  "room_number": "102B",
  "sensor_id": "SENSOR_015"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "patient_id": "P67890",
    "name": "Jane Smith",
    "room_number": "102B",
    "sensor_id": "SENSOR_015",
    "status": "active",
    "created_at": "2025-11-22T10:40:00Z"
  },
  "message": "Patient added successfully"
}
```

**Error Responses:**
- `400 Bad Request` - Missing required fields
- `409 Conflict` - Patient ID or Sensor ID already in use

---

### PATCH /patients/:patient_id
Update patient information.

**Request:**
```json
{
  "room_number": "103A"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "patient_id": "P67890",
    "room_number": "103A",
    "updated_at": "2025-11-22T10:45:00Z"
  },
  "message": "Patient updated successfully"
}
```

---

### PATCH /patients/:patient_id/status
Discharge a patient.

**Request:**
```json
{
  "status": "discharged"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "patient_id": "P67890",
    "status": "discharged",
    "updated_at": "2025-11-22T11:00:00Z"
  },
  "message": "Patient discharged"
}
```

---

## Sensor Data APIs

### POST /sensors/data
Ingest sensor reading from ESP32 device (called by sensors, not frontend).

**Request:**
```json
{
  "sensor_id": "SENSOR_001",
  "oxygen_level": 97.5,
  "heart_rate": 72,
  "timestamp": "2025-11-22T10:30:15.123Z"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "reading_id": 123456,
    "sensor_id": "SENSOR_001",
    "stored_at": "2025-11-22T10:30:15.150Z"
  }
}
```

**Error Responses:**
- `400 Bad Request` - Invalid data format or out-of-range values
- `404 Not Found` - Sensor not registered

---

### POST /sensors/alert
Receive alert from ESP32 device (button press or LED trigger).

**Request:**
```json
{
  "sensor_id": "SENSOR_001",
  "alert_type": "button_pressed",
  "timestamp": "2025-11-22T10:30:20.000Z"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "alert_id": 789,
    "patient_id": "P12345",
    "alert_type": "button_pressed",
    "timestamp": "2025-11-22T10:30:20.000Z"
  }
}
```

---

### GET /sensors/:sensor_id/readings
Get recent readings for a specific sensor (for graphs).

**Query Parameters:**
- `limit` (optional, default: 20, max: 100) - Number of recent readings
- `since` (optional) - ISO timestamp to get readings after this time

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "sensor_id": "SENSOR_001",
    "readings": [
      {
        "reading_id": 123456,
        "oxygen_level": 97.5,
        "heart_rate": 72,
        "timestamp": "2025-11-22T10:30:15Z"
      },
      {
        "reading_id": 123455,
        "oxygen_level": 97.3,
        "heart_rate": 73,
        "timestamp": "2025-11-22T10:30:10Z"
      }
    ]
  }
}
```

---

## Alert Management APIs

**Authorization:** Nurse or Admin role required.

### GET /alerts
Get active alerts.

**Query Parameters:**
- `patient_id` (optional) - Filter by patient
- `acknowledged` (optional, default: false) - Filter by acknowledgment status
- `limit` (optional, default: 50)

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "alert_id": 789,
        "patient_id": "P12345",
        "patient_name": "John Doe",
        "sensor_id": "SENSOR_001",
        "alert_type": "vitals_critical",
        "metric_type": "oxygen_level",
        "metric_value": 88.5,
        "threshold_exceeded": "lower",
        "acknowledged": false,
        "timestamp": "2025-11-22T10:30:20Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 3,
      "totalPages": 1
    }
  }
}
```

---

### PATCH /alerts/:alert_id/acknowledge
Acknowledge an alert.

**Request:**
```json
{
  "acknowledged": true
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "alert_id": 789,
    "acknowledged": true,
    "acknowledged_by": 42,
    "acknowledged_at": "2025-11-22T10:35:00Z"
  },
  "message": "Alert acknowledged"
}
```

---

### GET /patients/:patient_id/thresholds
Get alert thresholds for a patient.

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "patient_id": "P12345",
    "thresholds": {
      "oxygen_level": {
        "threshold_id": 1,
        "lower_limit": 90.0,
        "upper_limit": 100.0
      },
      "heart_rate": {
        "threshold_id": 2,
        "lower_limit": 60,
        "upper_limit": 100
      }
    }
  }
}
```

---

### PUT /patients/:patient_id/thresholds
Update alert thresholds for a patient.

**Request:**
```json
{
  "oxygen_level": {
    "lower_limit": 88.0,
    "upper_limit": 100.0
  },
  "heart_rate": {
    "lower_limit": 55,
    "upper_limit": 105
  }
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "patient_id": "P12345",
    "thresholds": {
      "oxygen_level": {
        "threshold_id": 1,
        "lower_limit": 88.0,
        "upper_limit": 100.0,
        "updated_at": "2025-11-22T10:40:00Z"
      },
      "heart_rate": {
        "threshold_id": 2,
        "lower_limit": 55,
        "upper_limit": 105,
        "updated_at": "2025-11-22T10:40:00Z"
      }
    }
  },
  "message": "Thresholds updated successfully"
}
```

---

## Real-time Streaming API

### GET /stream/sensor-data
Server-Sent Events (SSE) endpoint for real-time sensor data.

**Authorization:** Nurse or Admin role required (JWT in query param or header)

**Connection:**
```javascript
const eventSource = new EventSource('/api/v1/stream/sensor-data?token=<JWT_TOKEN>');
```

**Event Types:**

#### Event: connected
Sent immediately upon connection.

```json
{
  "type": "connected",
  "message": "Real-time stream connected"
}
```

#### Event: sensor_reading
Sent when new sensor data arrives (every ~5 seconds per sensor).

```json
{
  "type": "sensor_reading",
  "data": {
    "sensor_id": "SENSOR_001",
    "patient_id": "P12345",
    "oxygen_level": 97.5,
    "heart_rate": 72,
    "timestamp": "2025-11-22T10:30:15Z"
  }
}
```

#### Event: sensor_status
Sent when sensor goes online/offline.

```json
{
  "type": "sensor_status",
  "data": {
    "sensor_id": "SENSOR_001",
    "patient_id": "P12345",
    "status": "offline",
    "timestamp": "2025-11-22T10:30:35Z"
  }
}
```

#### Event: alert_triggered
Sent when alert is generated.

```json
{
  "type": "alert_triggered",
  "data": {
    "alert_id": 789,
    "patient_id": "P12345",
    "patient_name": "John Doe",
    "alert_type": "vitals_critical",
    "metric_type": "oxygen_level",
    "metric_value": 88.5,
    "threshold_exceeded": "lower",
    "timestamp": "2025-11-22T10:30:20Z"
  }
}
```

#### Event: heartbeat
Sent every 30 seconds to keep connection alive.

```json
{
  "type": "heartbeat",
  "timestamp": "2025-11-22T10:30:00Z"
}
```

---

## Error Codes

| Code | Message | Description |
|------|---------|-------------|
| `AUTH_INVALID_CREDENTIALS` | Invalid employee ID or password | Login failed |
| `AUTH_TOKEN_EXPIRED` | JWT token has expired | Token needs refresh |
| `AUTH_TOKEN_INVALID` | Invalid or malformed token | Re-authentication required |
| `AUTH_INSUFFICIENT_PERMISSIONS` | Insufficient permissions | User lacks required role |
| `USER_DISABLED` | User account is disabled | Contact admin |
| `USER_NOT_FOUND` | User not found | Invalid user_id |
| `USER_ALREADY_EXISTS` | Employee ID already exists | Duplicate employee_id |
| `PATIENT_NOT_FOUND` | Patient not found | Invalid patient_id |
| `PATIENT_ALREADY_EXISTS` | Patient ID already exists | Duplicate patient_id |
| `SENSOR_NOT_FOUND` | Sensor not found | Invalid sensor_id |
| `SENSOR_ALREADY_ASSIGNED` | Sensor already assigned to another patient | Conflict |
| `INVALID_INPUT` | Invalid input data | Validation failed |
| `INVALID_SENSOR_DATA` | Sensor data out of valid range | Data validation failed |
| `DATABASE_ERROR` | Database operation failed | Server error |
| `INTERNAL_ERROR` | Internal server error | Unexpected error |

---

## Data Models

### User
```typescript
interface User {
  user_id: number;
  employee_id: string;  // 6 digits
  role: 'nurse' | 'admin' | 'intake';
  status: 'active' | 'disabled';
  created_at: string;   // ISO 8601
  updated_at: string;   // ISO 8601
}
```

### Patient
```typescript
interface Patient {
  patient_id: string;
  name: string;
  room_number: string;
  sensor_id: string;
  status: 'active' | 'discharged';
  created_at: string;
  updated_at: string;
}
```

### SensorReading
```typescript
interface SensorReading {
  reading_id: number;
  sensor_id: string;
  oxygen_level: number;  // 0.00 - 100.00
  heart_rate: number;    // bpm
  timestamp: string;     // ISO 8601
}
```

### Alert
```typescript
interface Alert {
  alert_id: number;
  patient_id: string;
  sensor_id: string;
  alert_type: 'button_pressed' | 'vitals_critical' | 'sensor_offline';
  metric_type?: 'oxygen_level' | 'heart_rate' | 'none';
  metric_value?: number;
  threshold_exceeded?: 'upper' | 'lower' | 'none';
  acknowledged: boolean;
  acknowledged_by?: number;  // user_id
  timestamp: string;
  acknowledged_at?: string;
}
```

### AlertThreshold
```typescript
interface AlertThreshold {
  threshold_id: number;
  patient_id: string;
  metric_type: 'oxygen_level' | 'heart_rate';
  lower_limit: number;
  upper_limit: number;
  created_at: string;
  updated_at: string;
}
```

---

## Next Steps

### For Backend Developer
- [ ] Implement all endpoints according to this specification
- [ ] Add input validation middleware
- [ ] Implement error handling with proper error codes
- [ ] Write API documentation with examples
- [ ] Create Postman/Insomnia collection for testing

### For Frontend Developer
- [ ] Review API contracts and provide feedback
- [ ] Create TypeScript interfaces matching data models
- [ ] Implement API service layer (axios wrapper)
- [ ] Build error handling and user feedback mechanisms
- [ ] Implement SSE client with reconnection logic

### For Test Automation Expert
- [ ] Design mock sensor API calls
- [ ] Create test scenarios for all endpoints
- [ ] Implement integration tests
- [ ] Test SSE connection stability

---

**Document Status:** Ready for Implementation  
**Review Required From:** Backend Developer, Frontend Developer  
**Next Update:** End of Week 1

---

*This specification is subject to change based on implementation feedback and evolving requirements.*
