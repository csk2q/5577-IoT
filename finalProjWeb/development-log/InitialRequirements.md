# Initial Requirements Review Meeting
**Date:** November 22, 2025  
**Project:** IoT Nursing Station Dashboard  
**Attendees:**
- Product Owner
- Architect
- Senior UI Developer
- Senior Backend Developer
- Test Automation Expert

---

## Meeting Opening

**Product Owner:** Good morning, everyone. Thank you for joining this initial requirements review. Today I'll be presenting the requirements for our IoT Nursing Station Dashboard project. This is a hospital nurse station application that will monitor patient health using IoT sensors. Let me walk you through what we're building and why.

---

## Requirements Presentation

**Product Owner:** Here's the overview: We're creating a web-based dashboard for nurses to monitor patient vital signs in real-time. The system will collect data from ESP32 sensors that measure blood oxygen levels and heart rate. Patients can also trigger alerts using a digital button, which will be displayed both on the web interface and through an RGB LED indicator.

The key components are:
- **Web Interface** with encrypted login credentials
- **SQL database** with encrypted storage, linked to live monitoring tables and graphs
- **ESP32 sensors** for data collection (Note: sensor implementation is NOT part of our scope)

Let me go through the user scenarios...

### User Scenarios Overview

**Product Owner:** We have three user roles:

1. **Nurses** - Primary users who monitor patient data
2. **System Admins** - Manage users and system security
3. **Patient Intake Administrators** - Add new patients to the system

All users authenticate with a 6-digit employee ID and password.

---

## Detailed User Scenarios

**Product Owner:** Let me walk through each scenario:

**Scenario 1-3: Authentication**
- All three user types need secure login
- Employee ID: 6 digits
- Password authentication
- Role-based access control

**Scenario 4: Nurse Dashboard Access**
- Only nurses can access the patient monitoring dashboard
- This is the core feature of the application

**Scenario 5: System Admin Functions**
The admin interface needs to support:
- Creating new users
- Disabling users
- Re-enabling disabled users
- Sending password reset emails

**Scenario 6: Patient Intake**
Patient intake specialists need a form to collect:
- Patient name
- Patient ID
- Sensor ID (assigned to patient)
- Room number

**Scenario 7: Real-time Dashboard**
The core nurse dashboard displays:
- Grid layout of patient cards
- Each card shows: patient name, current blood oxygen reading, current heart rate
- Spark line graphs showing last 20 readings for each metric
- Default ordering by room number

**Scenario 8: Dashboard Sorting**
Nurses can reorder the dashboard by:
- Room number (default)
- Patient name
- Patient ID

**Scenario 9: Alert Thresholds**
Nurses can configure alert levels:
- Upper and lower limits for oxygen levels
- Upper and lower limits for heart rate
- When measurements exceed range, patient card is visually emphasized

---

## Team Discussion

### Architect's Questions

**Architect:** Thank you for the comprehensive overview. I have several architectural questions:

First, regarding real-time data: What's the expected frequency of sensor readings? You mentioned "last 20 readings" - how often do these come in?

**Product Owner:** Good question. The sensors send data approximately every 5 seconds. So the last 20 readings would represent roughly 1 minute and 40 seconds of data.

**Architect:** Understood. And how many patients do we need to support simultaneously?

**Product Owner:** Initially, we should support at least 20-30 patients per nursing station. However, I'd like the system to be scalable to handle 50-100 patients without major rework.

**Architect:** Excellent. Now, about the alert system - when a patient triggers the button or vital signs exceed thresholds, you mentioned RGB LED indicators. Are those LEDs on the sensor hardware itself?

**Product Owner:** Yes, the RGB LED is part of the sensor hardware. The sensor code is not our responsibility - we just need to receive alert notifications from the sensors and display them in the dashboard.

**Architect:** Perfect, that clarifies the boundary. One more thing - you mentioned encrypted credentials and encrypted database. Do we have specific compliance requirements? HIPAA, for example?

**Product Owner:** Yes, we must be HIPAA-compliant. All patient data must be encrypted at rest and in transit. Authentication must use secure password hashing, and we need audit logging for access to patient data.

**Architect:** Understood. That will inform our security architecture significantly.

---

### Senior Backend Developer's Questions

**Senior Backend Developer:** I have questions about the data model and API requirements.

For the sensor data - are we storing every single reading that comes in every 5 seconds, or do we aggregate after a certain period?

**Product Owner:** Store everything initially. We'll need the granular data for the real-time graphs. We can discuss data retention and archival strategies later.

**Senior Backend Developer:** Understood. And for the password reset functionality - should the system actually send emails, or just generate reset tokens?

**Product Owner:** It should send actual emails. We'll need to integrate with the hospital's email system, but for the MVP, using a standard SMTP service is fine.

**Senior Backend Developer:** Got it. One more - when a nurse sets alert thresholds for oxygen and heart rate, are those thresholds global for all patients, or per-patient?

**Product Owner:** Oh, excellent question. They should be per-patient. Different patients may have different normal ranges based on their conditions.

**Senior Backend Developer:** That makes sense but adds complexity. I'll account for that in the schema design.

---

### Senior UI Developer's Questions

**Senior UI Developer:** I have questions about the user experience and visual design.

You mentioned the patient cards should be "emphasized" when alerts trigger. What kind of emphasis are you looking for? Color change, border, animation?

**Product Owner:** I'm open to suggestions, but I'm thinking a strong visual indicator - perhaps a red border with a subtle pulse animation, and maybe moving the card to the top of the grid temporarily?

**Senior UI Developer:** That sounds good. I'd suggest red for critical alerts, yellow for warnings. We can prototype a few options.

About the real-time graphs showing the last 20 readings - should these be updating smoothly as new data comes in, or is it okay if they update every 5 seconds in a more discrete way?

**Product Owner:** Smooth updates would be ideal for the user experience. We want nurses to see trends developing in real-time.

**Senior UI Developer:** Understood. I'll use a chart library that supports smooth transitions. 

One more thing - you mentioned Bootstrap is our CSS framework. Are there any specific design guidelines or color schemes from the hospital we need to follow?

**Product Owner:** Not at this stage. Use professional, clean design with good contrast for readability. Healthcare settings can have challenging lighting conditions, so visibility is key.

**Senior UI Developer:** Perfect. I'll focus on high contrast and clarity.

---

### Test Automation Expert's Questions

**Test Automation Expert:** I need to understand the sensor behavior so I can build an accurate mock framework.

You said sensors send data every 5 seconds. What happens if a sensor goes offline? How should the system detect that?

**Product Owner:** Good question. If we don't receive data from a sensor for 15 seconds (three missed readings), we should consider it offline and alert the nurse.

**Test Automation Expert:** Understood. And for the patient alert button - when pressed, what data does the sensor send?

**Product Owner:** The sensor sends an alert event with the sensor ID, timestamp, and alert type. The alert type could be "button_pressed" for manual alerts, or "vitals_critical" for automated threshold violations.

**Test Automation Expert:** Perfect. And what are realistic ranges for the vital signs?
- Blood oxygen: Normal is 95-100%, concerning below 90%
- Heart rate: Normal is 60-100 bpm, concerning below 60 or above 100

**Product Owner:** Exactly right. Those are good baseline ranges, but remember nurses can customize per patient.

**Test Automation Expert:** Got it. I'll build the mock framework to simulate:
- Normal readings within healthy ranges
- Gradual deterioration scenarios
- Sudden critical events
- Sensors going offline and coming back online
- Multiple sensors operating simultaneously

**Product Owner:** That's perfect. We'll need those scenarios for thorough testing.

---

### Architecture Discussion

**Architect:** Based on what I've heard, let me propose a high-level architecture for validation:

**Frontend:**
- React with TypeScript and Bootstrap
- Real-time updates using Server-Sent Events (SSE)
- Responsive grid layout for patient cards
- Chart.js or Recharts for the spark line graphs

**Backend:**
- Node.js with Express
- RESTful API for CRUD operations
- SSE endpoint for real-time sensor data streaming
- MySQL database with proper encryption
- bcrypt for password hashing
- JWT tokens for session management

**Database Schema (conceptual):**
- Users table (employee_id, password_hash, role, status)
- Patients table (patient_id, name, room_number, sensor_id)
- Sensors table (sensor_id, status, last_reading_time)
- SensorReadings table (reading_id, sensor_id, timestamp, oxygen_level, heart_rate)
- AlertThresholds table (patient_id, metric_type, lower_limit, upper_limit)
- Alerts table (alert_id, patient_id, timestamp, alert_type, acknowledged)
- AuditLog table (log_id, user_id, action, timestamp, details)

**Security:**
- HTTPS only
- Password hashing with bcrypt
- JWT tokens with expiration
- Database encryption at rest
- Input validation and sanitization
- Role-based access control middleware

Does this align with your vision?

**Product Owner:** Yes, that sounds solid. I particularly like the separation of concerns and the comprehensive audit logging for HIPAA compliance.

**Senior Backend Developer:** I agree with the architecture. I'd suggest we use connection pooling for MySQL to handle the real-time data load, and we should index the SensorReadings table by sensor_id and timestamp for efficient queries.

**Senior UI Developer:** The frontend approach looks good. I'd recommend React Context API for managing user authentication state and a custom hook for handling the SSE connection. We'll need to be careful about performance with 30-50 patients updating every 5 seconds.

**Architect:** Excellent points. We'll optimize the SSE payload to only send changed data, and we can implement virtual scrolling if we exceed 50 patients.

**Test Automation Expert:** This architecture gives me clear integration points for my mock framework. I'll create a mock sensor service that can connect to the backend API and simulate the real sensor behavior.

---

## Clarifications and Edge Cases

**Senior UI Developer:** What should happen if the nurse's browser loses connection to the server? Should we show a "connection lost" warning?

**Product Owner:** Absolutely. That's critical. Show a prominent warning banner and attempt to reconnect automatically.

**Senior Backend Developer:** What about user sessions? How long should a nurse stay logged in before requiring re-authentication?

**Product Owner:** For security, let's say 8 hours maximum, or 30 minutes of inactivity. But display a warning before automatic logout.

**Architect:** For the patient intake process - what happens if someone tries to assign a sensor ID that's already assigned to another patient?

**Product Owner:** Good catch. The system should prevent that and show an error message. A sensor can only be assigned to one patient at a time.

**Test Automation Expert:** Should I create mock scenarios for multiple nurses accessing the system simultaneously?

**Product Owner:** Yes, that's a real-world scenario. We need to ensure the system handles concurrent access properly.

---

## Risk Discussion

**Architect:** I want to flag a few technical risks:

1. **Real-time Performance:** Streaming data for 30-50 patients every 5 seconds could strain the server and client browsers. We'll need load testing.

2. **Database Growth:** Storing readings every 5 seconds means 17,280 readings per patient per day. We'll need a data retention and archival strategy.

3. **Security Complexity:** HIPAA compliance adds significant complexity to authentication, authorization, and audit logging.

**Product Owner:** These are valid concerns. For the MVP, let's plan for:
- 30 patients maximum
- 30-day data retention (we can archive older data)
- Basic HIPAA compliance with plans to have a full security audit before production deployment

**Architect:** That's reasonable. We'll build with scalability in mind so we can handle growth.

---

## Timeline and Priorities

**Product Owner:** Let me outline the priorities for the MVP:

**Phase 1 - Core Infrastructure (Weeks 1-2):**
- Database schema and backend API foundation
- User authentication and role-based access
- Mock sensor framework for testing

**Phase 2 - Dashboard Basics (Weeks 3-4):**
- Nurse dashboard with patient cards
- Display current readings (numbers only, no graphs yet)
- Basic alert highlighting

**Phase 3 - Real-time Features (Weeks 5-6):**
- Server-Sent Events implementation
- Real-time data updates
- Spark line graphs for last 20 readings

**Phase 4 - Administration (Week 7):**
- System admin user management interface
- Patient intake interface
- Alert threshold configuration

**Phase 5 - Polish & Testing (Week 8):**
- Security hardening
- Performance optimization
- Comprehensive testing with mock sensors
- Bug fixes and refinements

Does this timeline seem achievable?

**Architect:** It's aggressive but doable if we stay focused and don't add scope. We'll need clear communication and quick decision-making.

**Senior Backend Developer:** I can have the API and database ready by end of Week 2 if we start immediately.

**Senior UI Developer:** I'll need the API contracts defined early so I can build the UI in parallel. Can we have a detailed API spec by end of Week 1?

**Architect:** Yes, I'll work with the Backend Developer to document the API contracts by end of Week 1.

**Test Automation Expert:** I'll have basic mock sensors ready by end of Week 1 so development can proceed without waiting for real hardware.

**Product Owner:** Excellent. Let's commit to this plan.

---

## Summary

### Project Overview
Building an IoT Nursing Station Dashboard to monitor patient vital signs (blood oxygen, heart rate) in real-time using ESP32 sensors. The system must support secure authentication, role-based access, real-time data visualization, and HIPAA-compliant data handling.

### Key Requirements
1. **Three user roles:** Nurses (monitor patients), System Admins (manage users), Patient Intake (add patients)
2. **Secure authentication:** 6-digit employee ID + password, HIPAA-compliant encryption
3. **Real-time dashboard:** Grid of patient cards with current readings and spark line graphs (last 20 readings)
4. **Configurable alerts:** Per-patient thresholds for oxygen and heart rate with visual emphasis
5. **Administration:** User management, patient intake, alert configuration
6. **Data refresh:** Sensor readings every 5 seconds, support 20-30 patients (scalable to 50-100)

### Technical Decisions
- **Frontend:** React + TypeScript + Bootstrap
- **Backend:** Node.js + Express + MySQL
- **Real-time:** Server-Sent Events (SSE)
- **Security:** HTTPS, bcrypt, JWT, encrypted database, audit logging
- **Charts:** Chart.js or Recharts for spark line graphs
- **Testing:** Mock sensor framework to simulate ESP32 devices

### Risks Identified
1. Real-time performance with 30-50 patients
2. Database growth (17,280+ readings per patient per day)
3. HIPAA compliance complexity

### Mitigation Strategies
- MVP limited to 30 patients
- 30-day data retention initially
- Load testing with mock sensors
- Security audit before production

---

## Action Items

### Architect
- [ ] **Week 1:** Create detailed system architecture document with component diagrams
- [ ] **Week 1:** Define API contracts and data models in collaboration with Backend Developer
- [ ] **Week 1:** Document security architecture for HIPAA compliance
- [ ] **Week 1:** Set up project repository structure and development environment guidelines
- [ ] **Ongoing:** Review code and ensure architectural consistency

### Senior Backend Developer
- [ ] **Week 1:** Design MySQL database schema with encryption strategy
- [ ] **Week 1:** Collaborate with Architect on API contract definition
- [ ] **Week 1:** Set up Node.js project with Express, MySQL connection pooling
- [ ] **Week 1-2:** Implement authentication API (login, logout, session management)
- [ ] **Week 1-2:** Implement user management API for system admin
- [ ] **Week 2:** Implement patient management API
- [ ] **Week 2:** Implement sensor data ingestion and storage API
- [ ] **Week 3:** Implement SSE endpoint for real-time data streaming
- [ ] **Week 4:** Implement alert threshold configuration API
- [ ] **Ongoing:** Write unit and integration tests for all endpoints

### Senior UI Developer
- [ ] **Week 1:** Review API contracts and provide feedback
- [ ] **Week 1:** Set up React + TypeScript + Bootstrap project structure
- [ ] **Week 1-2:** Implement authentication UI (login page, role-based routing)
- [ ] **Week 2-3:** Implement nurse dashboard grid layout with patient cards
- [ ] **Week 3:** Implement basic patient card component with current readings
- [ ] **Week 3-4:** Integrate SSE for real-time data updates
- [ ] **Week 4:** Implement spark line graphs using Chart.js/Recharts
- [ ] **Week 4:** Implement dashboard sorting (room, name, patient ID)
- [ ] **Week 5:** Implement alert visual emphasis and animations
- [ ] **Week 6-7:** Implement system admin UI and patient intake UI
- [ ] **Week 7:** Implement alert threshold configuration UI
- [ ] **Ongoing:** Ensure responsive design and accessibility

### Test Automation Expert
- [ ] **Week 1:** Design mock sensor framework architecture
- [ ] **Week 1:** Implement basic mock sensor that sends data every 5 seconds
- [ ] **Week 1:** Create mock scenarios: normal, warning, critical, offline
- [ ] **Week 2:** Implement configurable mock sensor fleet (10, 30, 50 sensors)
- [ ] **Week 2:** Add support for button press alerts and threshold violations
- [ ] **Week 3:** Create test suite for backend API endpoints
- [ ] **Week 4:** Create integration tests for SSE streaming
- [ ] **Week 5:** Create E2E tests for critical user workflows
- [ ] **Week 6:** Implement load testing with 50+ concurrent mock sensors
- [ ] **Week 7:** Create test documentation and usage guide
- [ ] **Week 8:** Execute comprehensive test suite and report results

### Product Owner
- [ ] **Week 1:** Review and approve system architecture document
- [ ] **Week 1:** Review and approve API contracts
- [ ] **Week 2:** Review authentication UI and provide feedback
- [ ] **Week 3:** Review dashboard prototype and provide feedback
- [ ] **Week 4:** Review real-time data updates and graphs
- [ ] **Week 5:** Review alert system behavior
- [ ] **Week 6:** Review admin and intake interfaces
- [ ] **Week 7:** Conduct user acceptance testing
- [ ] **Week 8:** Final review and approval for MVP release
- [ ] **Ongoing:** Make priority decisions and clarify requirements as needed

### All Team Members
- [ ] **Week 1:** Set up development environment
- [ ] **Week 1:** Review and understand API contracts
- [ ] **Ongoing:** Daily standups to sync progress and blockers
- [ ] **Ongoing:** Update project documentation
- [ ] **Week 8:** Prepare for MVP demo and deployment

---

## Next Meeting
**Date:** End of Week 1  
**Purpose:** Review architecture document, API contracts, and initial progress  
**Attendees:** Full team

---

**Meeting Adjourned**

*Notes compiled by: Project Team*  
*Date: November 22, 2025*
