#!/bin/bash

###############################################################################
# 5-Sensor Demo Script for CTO Presentation
# 
# Starts 5 mock sensors simulating different patient conditions:
# - 2 normal patients (stable vitals)
# - 2 warning patients (threshold violations)
# - 1 critical patient (severe threshold violations)
#
# Usage: ./demo-5-sensors.sh [start|stop|status]
###############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
MOCK_SENSORS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI_PATH="$MOCK_SENSORS_DIR/src/cli.js"
PID_DIR="$MOCK_SENSORS_DIR/.pids"
INTERVAL=5000  # 5 seconds between readings

# Create PID directory if it doesn't exist
mkdir -p "$PID_DIR"

###############################################################################
# Sensor Configurations
###############################################################################

# Normal Patients (2)
SENSOR_1_ID="ESP32-VS-001"  # Robert Anderson - Room 101A
SENSOR_1_BEHAVIOR="normal"
SENSOR_1_NAME="Robert Anderson (Normal)"

SENSOR_2_ID="ESP32-VS-006"  # Linda Jackson - Room 103B
SENSOR_2_BEHAVIOR="pressure-cycling"
SENSOR_2_NAME="Linda Jackson (Pressure Cycling - 10s on / 5s off)"

# Warning Patients (2)
SENSOR_3_ID="ESP32-VS-002"  # Mary Thompson - Room 101B
SENSOR_3_BEHAVIOR="warning"
SENSOR_3_NAME="Mary Thompson (Warning)"

SENSOR_4_ID="ESP32-VS-007"  # William White - Room 104A
SENSOR_4_BEHAVIOR="elevated-hr"  # Elevated heart rate
SENSOR_4_NAME="William White (Elevated HR)"

# Critical Patient (1)
SENSOR_5_ID="ESP32-VS-003"  # James Wilson - Room 102A
SENSOR_5_BEHAVIOR="critical"
SENSOR_5_NAME="James Wilson (Critical)"

###############################################################################
# Functions
###############################################################################

print_header() {
    echo ""
    echo -e "${BLUE}======================================${NC}"
    echo -e "${BLUE}  IoT Dashboard - 5-Sensor Demo${NC}"
    echo -e "${BLUE}======================================${NC}"
    echo ""
}

start_sensor() {
    local sensor_id="$1"
    local behavior="$2"
    local name="$3"
    local pid_file="$PID_DIR/${sensor_id}.pid"

    # Check if already running
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if kill -0 "$pid" 2>/dev/null; then
            echo -e "${YELLOW}⚠${NC}  $name already running (PID: $pid)"
            return
        fi
    fi

    # Start sensor in background
    echo -e "${GREEN}▶${NC}  Starting: $name"
    echo -e "   Sensor: $sensor_id | Behavior: $behavior | Interval: ${INTERVAL}ms"
    
    nohup node "$CLI_PATH" start \
        --sensor-id "$sensor_id" \
        --behavior "$behavior" \
        --interval "$INTERVAL" \
        > "$PID_DIR/${sensor_id}.log" 2>&1 &
    
    local pid=$!
    echo "$pid" > "$pid_file"
    echo -e "   ${GREEN}✓${NC} Started (PID: $pid)"
    echo ""
}

stop_sensor() {
    local sensor_id="$1"
    local name="$2"
    local pid_file="$PID_DIR/${sensor_id}.pid"

    if [ ! -f "$pid_file" ]; then
        echo -e "${YELLOW}⚠${NC}  $name not running"
        return
    fi

    local pid=$(cat "$pid_file")
    if kill -0 "$pid" 2>/dev/null; then
        echo -e "${RED}■${NC}  Stopping: $name (PID: $pid)"
        kill "$pid"
        rm "$pid_file"
        echo -e "   ${GREEN}✓${NC} Stopped"
    else
        echo -e "${YELLOW}⚠${NC}  $name PID file exists but process not running"
        rm "$pid_file"
    fi
}

check_sensor_status() {
    local sensor_id="$1"
    local name="$2"
    local pid_file="$PID_DIR/${sensor_id}.pid"

    if [ ! -f "$pid_file" ]; then
        echo -e "${RED}○${NC}  $name: ${RED}Not Running${NC}"
        return 1
    fi

    local pid=$(cat "$pid_file")
    if kill -0 "$pid" 2>/dev/null; then
        # Get log tail to see if it's actually sending data
        local last_log=$(tail -n 1 "$PID_DIR/${sensor_id}.log" 2>/dev/null || echo "")
        echo -e "${GREEN}●${NC}  $name: ${GREEN}Running${NC} (PID: $pid)"
        if [ -n "$last_log" ]; then
            echo "   Latest: $last_log"
        fi
        return 0
    else
        echo -e "${YELLOW}○${NC}  $name: ${YELLOW}Stopped${NC} (stale PID file)"
        rm "$pid_file"
        return 1
    fi
}

###############################################################################
# Main Commands
###############################################################################

start_all() {
    print_header
    echo -e "${GREEN}Starting 5-sensor demo...${NC}"
    echo ""
    
    echo -e "${BLUE}Normal Patients (2):${NC}"
    start_sensor "$SENSOR_1_ID" "$SENSOR_1_BEHAVIOR" "$SENSOR_1_NAME"
    start_sensor "$SENSOR_2_ID" "$SENSOR_2_BEHAVIOR" "$SENSOR_2_NAME"
    
    echo -e "${BLUE}Warning Patients (2):${NC}"
    start_sensor "$SENSOR_3_ID" "$SENSOR_3_BEHAVIOR" "$SENSOR_3_NAME"
    start_sensor "$SENSOR_4_ID" "$SENSOR_4_BEHAVIOR" "$SENSOR_4_NAME"
    
    echo -e "${BLUE}Critical Patient (1):${NC}"
    start_sensor "$SENSOR_5_ID" "$SENSOR_5_BEHAVIOR" "$SENSOR_5_NAME"
    
    echo -e "${GREEN}======================================${NC}"
    echo -e "${GREEN}All sensors started!${NC}"
    echo ""
    echo "Monitor dashboard at: http://localhost:8080"
    echo "View logs: ls -la $PID_DIR/*.log"
    echo ""
    echo "To stop: $0 stop"
    echo ""
}

stop_all() {
    print_header
    echo -e "${RED}Stopping 5-sensor demo...${NC}"
    echo ""
    
    stop_sensor "$SENSOR_1_ID" "$SENSOR_1_NAME"
    stop_sensor "$SENSOR_2_ID" "$SENSOR_2_NAME"
    stop_sensor "$SENSOR_3_ID" "$SENSOR_3_NAME"
    stop_sensor "$SENSOR_4_ID" "$SENSOR_4_NAME"
    stop_sensor "$SENSOR_5_ID" "$SENSOR_5_NAME"
    
    echo ""
    echo -e "${GREEN}All sensors stopped!${NC}"
    echo ""
}

show_status() {
    print_header
    echo -e "${BLUE}Sensor Status:${NC}"
    echo ""
    
    local running_count=0
    
    check_sensor_status "$SENSOR_1_ID" "$SENSOR_1_NAME" && ((running_count++)) || true
    check_sensor_status "$SENSOR_2_ID" "$SENSOR_2_NAME" && ((running_count++)) || true
    check_sensor_status "$SENSOR_3_ID" "$SENSOR_3_NAME" && ((running_count++)) || true
    check_sensor_status "$SENSOR_4_ID" "$SENSOR_4_NAME" && ((running_count++)) || true
    check_sensor_status "$SENSOR_5_ID" "$SENSOR_5_NAME" && ((running_count++)) || true
    
    echo ""
    echo -e "${BLUE}Summary:${NC} $running_count/5 sensors running"
    echo ""
    
    if [ "$running_count" -eq 5 ]; then
        echo -e "${GREEN}✓${NC} All sensors operational"
    elif [ "$running_count" -eq 0 ]; then
        echo -e "${YELLOW}⚠${NC} No sensors running. Start with: $0 start"
    else
        echo -e "${YELLOW}⚠${NC} Some sensors not running. Restart with: $0 stop && $0 start"
    fi
    echo ""
}

###############################################################################
# Main Script
###############################################################################

case "${1:-}" in
    start)
        start_all
        ;;
    stop)
        stop_all
        ;;
    status)
        show_status
        ;;
    restart)
        stop_all
        sleep 2
        start_all
        ;;
    *)
        echo "Usage: $0 {start|stop|status|restart}"
        echo ""
        echo "Commands:"
        echo "  start   - Start all 5 demo sensors"
        echo "  stop    - Stop all demo sensors"
        echo "  status  - Check sensor status"
        echo "  restart - Stop and start all sensors"
        echo ""
        echo "Demo Sensors:"
        echo "  - 2 Normal patients (stable vitals)"
        echo "  - 2 Warning patients (threshold violations)"
        echo "  - 1 Critical patient (severe violations)"
        echo ""
        exit 1
        ;;
esac

exit 0
