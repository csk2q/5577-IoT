#!/bin/bash

# IoT Nursing Station Dashboard - API Smoke Test
# Tests all implemented API endpoints
# Usage: ./test-api.sh

BASE_URL="http://localhost:3000/api/v1"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Helper function to print test results
print_test() {
    local test_name=$1
    local status=$2
    
    if [ "$status" = "PASS" ]; then
        echo -e "${GREEN}✓${NC} $test_name"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}✗${NC} $test_name"
        ((TESTS_FAILED++))
    fi
}

# Helper function to extract JSON field
get_json_field() {
    echo "$1" | python3 -c "import sys, json; print(json.load(sys.stdin)$2)" 2>/dev/null || echo ""
}

echo -e "${YELLOW}======================================${NC}"
echo -e "${YELLOW}IoT Dashboard API Smoke Test${NC}"
echo -e "${YELLOW}======================================${NC}\n"

# ============================================================================
# Authentication API Tests
# ============================================================================
echo -e "${YELLOW}Testing Authentication API...${NC}\n"

# Test 1: Health check
echo "Test 1: Health Check"
RESPONSE=$(curl -s "http://localhost:3000/health")
if echo "$RESPONSE" | grep -q '"success":true'; then
    print_test "Health check endpoint" "PASS"
else
    print_test "Health check endpoint" "FAIL"
fi

# Test 2: Admin login
echo "Test 2: Admin Login"
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"employee_id": "100001", "password": "password123"}')

ADMIN_TOKEN=$(get_json_field "$LOGIN_RESPONSE" "['data']['token']")
if [ -n "$ADMIN_TOKEN" ]; then
    print_test "Admin login" "PASS"
else
    print_test "Admin login" "FAIL"
    echo "$LOGIN_RESPONSE"
fi

# Test 3: Nurse login
echo "Test 3: Nurse Login"
NURSE_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"employee_id": "200001", "password": "password123"}')

NURSE_TOKEN=$(get_json_field "$NURSE_RESPONSE" "['data']['token']")
if [ -n "$NURSE_TOKEN" ]; then
    print_test "Nurse login" "PASS"
else
    print_test "Nurse login" "FAIL"
fi

# Test 4: Intake login
echo "Test 4: Intake Login"
INTAKE_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"employee_id": "300001", "password": "password123"}')

INTAKE_TOKEN=$(get_json_field "$INTAKE_RESPONSE" "['data']['token']")
if [ -n "$INTAKE_TOKEN" ]; then
    print_test "Intake login" "PASS"
else
    print_test "Intake login" "FAIL"
fi

# Test 5: Invalid credentials
echo "Test 5: Invalid Credentials"
INVALID_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"employee_id": "100001", "password": "wrongpassword"}')

if echo "$INVALID_RESPONSE" | grep -q 'AUTH_INVALID_CREDENTIALS'; then
    print_test "Invalid credentials rejection" "PASS"
else
    print_test "Invalid credentials rejection" "FAIL"
fi

# Test 6: Token refresh
echo "Test 6: Token Refresh"
REFRESH_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/refresh" \
    -H "Content-Type: application/json" \
    -d "{\"token\": \"$ADMIN_TOKEN\"}")

NEW_TOKEN=$(get_json_field "$REFRESH_RESPONSE" "['data']['token']")
if [ -n "$NEW_TOKEN" ]; then
    print_test "Token refresh" "PASS"
else
    print_test "Token refresh" "FAIL"
fi

# Test 7: Logout
echo "Test 7: Logout"
LOGOUT_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/logout" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $NURSE_TOKEN" \
    -d "{\"token\": \"$NURSE_TOKEN\"}")

if echo "$LOGOUT_RESPONSE" | grep -q '"success":true'; then
    print_test "Logout" "PASS"
else
    print_test "Logout" "FAIL"
fi

# ============================================================================
# User Management API Tests (Admin only)
# ============================================================================
echo -e "\n${YELLOW}Testing User Management API...${NC}\n"

# Test 8: Get all users (Admin)
echo "Test 8: Get All Users (Admin)"
USERS_RESPONSE=$(curl -s -X GET "$BASE_URL/users?limit=5" \
    -H "Authorization: Bearer $ADMIN_TOKEN")

if echo "$USERS_RESPONSE" | grep -q '"employee_id":"100001"'; then
    print_test "Get all users (admin)" "PASS"
else
    print_test "Get all users (admin)" "FAIL"
fi

# Test 9: Get users (Nurse - should fail)
echo "Test 9: Get Users (Nurse - Unauthorized)"
# Get fresh nurse token since we logged out
NURSE_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"employee_id": "200001", "password": "password123"}')
NURSE_TOKEN=$(get_json_field "$NURSE_RESPONSE" "['data']['token']")

UNAUTH_RESPONSE=$(curl -s -X GET "$BASE_URL/users" \
    -H "Authorization: Bearer $NURSE_TOKEN")

if echo "$UNAUTH_RESPONSE" | grep -q 'AUTH_INSUFFICIENT_PERMISSIONS'; then
    print_test "Authorization check (nurse blocked)" "PASS"
else
    print_test "Authorization check (nurse blocked)" "FAIL"
fi

# Test 10: Create user
echo "Test 10: Create New User"
# Use timestamp to ensure unique employee ID (must be exactly 6 digits)
UNIQUE_EMP_ID="$(date +%H%M%S)"
CREATE_USER_RESPONSE=$(curl -s -X POST "$BASE_URL/users" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -d "{
        \"employee_id\": \"$UNIQUE_EMP_ID\",
        \"password\": \"testpassword123\",
        \"role\": \"nurse\",
        \"first_name\": \"Test\",
        \"last_name\": \"User\",
        \"email\": \"test.user@hospital.com\"
    }")

NEW_USER_ID=$(get_json_field "$CREATE_USER_RESPONSE" "['data']['user_id']")
if [ -n "$NEW_USER_ID" ]; then
    print_test "Create new user" "PASS"
else
    print_test "Create new user" "FAIL"
fi

# Test 11: Update user status
echo "Test 11: Update User Status"
if [ -n "$NEW_USER_ID" ]; then
    STATUS_RESPONSE=$(curl -s -X PATCH "$BASE_URL/users/$NEW_USER_ID/status" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        -d '{"status": "disabled"}')
    
    if echo "$STATUS_RESPONSE" | grep -q '"status":"disabled"'; then
        print_test "Update user status" "PASS"
    else
        print_test "Update user status" "FAIL"
    fi
else
    print_test "Update user status" "SKIP"
fi

# Test 12: Password reset
echo "Test 12: Password Reset Request"
RESET_RESPONSE=$(curl -s -X POST "$BASE_URL/users/2/password-reset" \
    -H "Authorization: Bearer $ADMIN_TOKEN")

if echo "$RESET_RESPONSE" | grep -q '"success":true'; then
    print_test "Password reset request" "PASS"
else
    print_test "Password reset request" "FAIL"
fi

# ============================================================================
# Patient Management API Tests
# ============================================================================
echo -e "\n${YELLOW}Testing Patient Management API...${NC}\n"

# Test 13: Get all patients
echo "Test 13: Get All Patients"
PATIENTS_RESPONSE=$(curl -s -X GET "$BASE_URL/patients?limit=5" \
    -H "Authorization: Bearer $NURSE_TOKEN")

if echo "$PATIENTS_RESPONSE" | grep -q '"patient_id":"P-2025-001"'; then
    print_test "Get all patients" "PASS"
else
    print_test "Get all patients" "FAIL"
fi

# Test 14: Get specific patient
echo "Test 14: Get Patient Detail"
PATIENT_RESPONSE=$(curl -s -X GET "$BASE_URL/patients/P-2025-001" \
    -H "Authorization: Bearer $NURSE_TOKEN")

if echo "$PATIENT_RESPONSE" | grep -q '"alert_thresholds"'; then
    print_test "Get patient detail with thresholds" "PASS"
else
    print_test "Get patient detail with thresholds" "FAIL"
fi

# Test 15: Create patient (Intake)
echo "Test 15: Create New Patient (Intake)"
# Use timestamp to ensure unique patient ID
UNIQUE_PATIENT_ID="P-TEST-$(date +%H%M%S)"
CREATE_PATIENT_RESPONSE=$(curl -s -X POST "$BASE_URL/patients" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $INTAKE_TOKEN" \
    -d "{
        \"patient_id\": \"$UNIQUE_PATIENT_ID\",
        \"name\": \"Test Patient\",
        \"room_number\": \"999Z\"
    }")

if echo "$CREATE_PATIENT_RESPONSE" | grep -q "\"patient_id\":\"$UNIQUE_PATIENT_ID\""; then
    print_test "Create new patient (intake)" "PASS"
    CREATED_PATIENT=true
else
    print_test "Create new patient (intake)" "FAIL"
    CREATED_PATIENT=false
fi

# Test 16: Update patient room
echo "Test 16: Update Patient Room"
if [ "$CREATED_PATIENT" = true ]; then
    UPDATE_RESPONSE=$(curl -s -X PATCH "$BASE_URL/patients/$UNIQUE_PATIENT_ID" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $NURSE_TOKEN" \
        -d '{"room_number": "998Z"}')
    
    if echo "$UPDATE_RESPONSE" | grep -q '"room_number":"998Z"'; then
        print_test "Update patient room" "PASS"
    else
        print_test "Update patient room" "FAIL"
    fi
else
    print_test "Update patient room" "SKIP"
fi

# Test 17: Discharge patient
echo "Test 17: Discharge Patient"
if [ "$CREATED_PATIENT" = true ]; then
    DISCHARGE_RESPONSE=$(curl -s -X PATCH "$BASE_URL/patients/$UNIQUE_PATIENT_ID/status" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $NURSE_TOKEN" \
        -d '{"status": "discharged"}')
    
    if echo "$DISCHARGE_RESPONSE" | grep -q '"status":"discharged"'; then
        print_test "Discharge patient" "PASS"
    else
        print_test "Discharge patient" "FAIL"
    fi
else
    print_test "Discharge patient" "SKIP"
fi

# Test 18: Patient not found
echo "Test 18: Get Non-existent Patient"
NOT_FOUND_RESPONSE=$(curl -s -X GET "$BASE_URL/patients/P-9999-999" \
    -H "Authorization: Bearer $NURSE_TOKEN")

if echo "$NOT_FOUND_RESPONSE" | grep -q 'PATIENT_NOT_FOUND'; then
    print_test "Patient not found error" "PASS"
else
    print_test "Patient not found error" "FAIL"
fi

# ============================================================================
# Sensor Data API Tests
# ============================================================================
echo -e "\n${YELLOW}Testing Sensor Data API...${NC}\n"

# Test 19: Ingest sensor data
echo "Test 19: Ingest Sensor Data"
INGEST_RESPONSE=$(curl -s -X POST "$BASE_URL/sensors/data" \
    -H "Content-Type: application/json" \
    -d '{
        "sensor_id": "ESP32-VS-001",
        "oxygen_level": 97.5,
        "heart_rate": 75,
        "temperature": 36.8
    }')

if echo "$INGEST_RESPONSE" | grep -q '"reading_id"'; then
    print_test "Ingest sensor data" "PASS"
else
    print_test "Ingest sensor data" "FAIL"
fi

# Test 20: Get sensor readings
echo "Test 20: Get Sensor Readings"
READINGS_RESPONSE=$(curl -s -X GET "$BASE_URL/sensors/ESP32-VS-001/readings?limit=5" \
    -H "Authorization: Bearer $NURSE_TOKEN")

if echo "$READINGS_RESPONSE" | grep -q '"readings"'; then
    print_test "Get sensor readings" "PASS"
else
    print_test "Get sensor readings" "FAIL"
fi

# Test 21: Send button press alert
echo "Test 21: Send Button Press Alert"
BUTTON_ALERT_RESPONSE=$(curl -s -X POST "$BASE_URL/sensors/alert" \
    -H "Content-Type: application/json" \
    -d '{
        "sensor_id": "ESP32-VS-001",
        "alert_type": "button_pressed"
    }')

if echo "$BUTTON_ALERT_RESPONSE" | grep -q '"alert_id"'; then
    print_test "Send button press alert" "PASS"
else
    print_test "Send button press alert" "FAIL"
fi

# Test 22: Invalid sensor data
echo "Test 22: Invalid Sensor Data"
INVALID_SENSOR_RESPONSE=$(curl -s -X POST "$BASE_URL/sensors/data" \
    -H "Content-Type: application/json" \
    -d '{
        "sensor_id": "ESP32-VS-001",
        "heart_rate": 500
    }')

if echo "$INVALID_SENSOR_RESPONSE" | grep -q 'INVALID_SENSOR_DATA'; then
    print_test "Invalid sensor data rejection" "PASS"
else
    print_test "Invalid sensor data rejection" "FAIL"
fi

# ============================================================================
# Alert Management API Tests
# ============================================================================
echo -e "\n${YELLOW}Testing Alert Management API...${NC}\n"

# Test 23: Get all alerts
echo "Test 23: Get All Alerts"
ALERTS_RESPONSE=$(curl -s -X GET "$BASE_URL/alerts?acknowledged=false" \
    -H "Authorization: Bearer $NURSE_TOKEN")

if echo "$ALERTS_RESPONSE" | grep -q '"items"'; then
    print_test "Get all alerts" "PASS"
    # Extract an alert ID for acknowledgment test
    ALERT_ID=$(echo "$ALERTS_RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data['data']['items'][0]['alert_id'] if len(data['data']['items']) > 0 else '')" 2>/dev/null || echo "")
else
    print_test "Get all alerts" "FAIL"
fi

# Test 24: Acknowledge alert
echo "Test 24: Acknowledge Alert"
if [ -n "$ALERT_ID" ]; then
    ACK_RESPONSE=$(curl -s -X PATCH "$BASE_URL/alerts/$ALERT_ID/acknowledge" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $NURSE_TOKEN" \
        -d '{"acknowledged": true}')
    
    if echo "$ACK_RESPONSE" | grep -q '"acknowledged":true'; then
        print_test "Acknowledge alert" "PASS"
    else
        print_test "Acknowledge alert" "FAIL"
    fi
else
    print_test "Acknowledge alert" "SKIP"
fi

# Test 25: Get patient thresholds
echo "Test 25: Get Patient Thresholds"
THRESHOLDS_RESPONSE=$(curl -s -X GET "$BASE_URL/patients/P-2025-001/thresholds" \
    -H "Authorization: Bearer $NURSE_TOKEN")

if echo "$THRESHOLDS_RESPONSE" | grep -q '"thresholds"'; then
    print_test "Get patient thresholds" "PASS"
else
    print_test "Get patient thresholds" "FAIL"
fi

# Test 26: Update patient thresholds
echo "Test 26: Update Patient Thresholds"
UPDATE_THRESHOLDS_RESPONSE=$(curl -s -X PUT "$BASE_URL/patients/P-2025-001/thresholds" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $NURSE_TOKEN" \
    -d '{
        "heart_rate": {
            "lower_limit": 55,
            "upper_limit": 105
        }
    }')

if echo "$UPDATE_THRESHOLDS_RESPONSE" | grep -q '"thresholds"'; then
    print_test "Update patient thresholds" "PASS"
else
    print_test "Update patient thresholds" "FAIL"
fi

# ============================================================================
# Summary
# ============================================================================
echo -e "\n${YELLOW}======================================${NC}"
echo -e "${YELLOW}Test Summary${NC}"
echo -e "${YELLOW}======================================${NC}"
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Failed: $TESTS_FAILED${NC}"
TOTAL=$((TESTS_PASSED + TESTS_FAILED))
echo "Total: $TOTAL"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "\n${GREEN}All tests passed! ✓${NC}\n"
    exit 0
else
    echo -e "\n${RED}Some tests failed! ✗${NC}\n"
    exit 1
fi
