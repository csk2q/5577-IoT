#!/bin/bash

# Test script for Threshold Configuration API
# Tests: Login, Get Thresholds, Update Thresholds

BASE_URL="http://localhost:3000/api/v1"
PATIENT_ID="P-2025-001"

echo "============================================"
echo "Testing Threshold Configuration API"
echo "============================================"
echo ""

# Step 1: Login as admin
echo "1. Logging in as admin..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "employee_id": "100001",
    "password": "password123"
  }')

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.data.token')

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ Login failed"
  echo "$LOGIN_RESPONSE" | jq '.'
  exit 1
fi

echo "✅ Login successful"
echo "Token: ${TOKEN:0:20}..."
echo ""

# Step 2: Get current thresholds
echo "2. Getting current thresholds for patient $PATIENT_ID..."
GET_RESPONSE=$(curl -s -X GET "$BASE_URL/patients/$PATIENT_ID/thresholds" \
  -H "Authorization: Bearer $TOKEN")

echo "$GET_RESPONSE" | jq '.'
echo ""

# Step 3: Update thresholds
echo "3. Updating thresholds for patient $PATIENT_ID..."
UPDATE_RESPONSE=$(curl -s -X PUT "$BASE_URL/patients/$PATIENT_ID/thresholds" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "heart_rate": {
      "lower_limit": 55,
      "upper_limit": 110
    },
    "blood_oxygen": {
      "lower_limit": 88,
      "upper_limit": 100
    },
    "temperature": {
      "lower_limit": 36.0,
      "upper_limit": 38.0
    }
  }')

echo "$UPDATE_RESPONSE" | jq '.'

if echo "$UPDATE_RESPONSE" | jq -e '.success' > /dev/null; then
  echo "✅ Thresholds updated successfully"
else
  echo "❌ Failed to update thresholds"
  exit 1
fi
echo ""

# Step 4: Verify the update
echo "4. Verifying updated thresholds..."
VERIFY_RESPONSE=$(curl -s -X GET "$BASE_URL/patients/$PATIENT_ID/thresholds" \
  -H "Authorization: Bearer $TOKEN")

echo "$VERIFY_RESPONSE" | jq '.'

# Check if the values match
HR_LOWER=$(echo "$VERIFY_RESPONSE" | jq -r '.data.thresholds.heart_rate.lower_limit')
HR_UPPER=$(echo "$VERIFY_RESPONSE" | jq -r '.data.thresholds.heart_rate.upper_limit')

if [ "$HR_LOWER" = "55" ] && [ "$HR_UPPER" = "110" ]; then
  echo "✅ Threshold values verified correctly"
else
  echo "❌ Threshold values don't match expected values"
  exit 1
fi

echo ""
echo "============================================"
echo "✅ All tests passed!"
echo "============================================"
