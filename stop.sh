#!/bin/bash

echo "🛑 Stopping TTS Project..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to kill process on port
kill_port() {
    local port=$1
    local service_name=$2
    
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null ; then
        echo -e "${YELLOW}🔍 Stopping $service_name on port $port...${NC}"
        lsof -ti:$port | xargs kill -9 2>/dev/null
        sleep 1
        
        # Check if still running
        if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null ; then
            echo -e "${RED}❌ Failed to stop $service_name${NC}"
            return 1
        else
            echo -e "${GREEN}✅ $service_name stopped successfully${NC}"
            return 0
        fi
    else
        echo -e "${BLUE}ℹ️  $service_name is not running on port $port${NC}"
        return 0
    fi
}

# Stop Backend
kill_port 8000 "Backend API"

# Stop Frontend  
kill_port 3000 "Frontend Web"

# Additional cleanup
echo -e "${YELLOW}🧹 Cleaning up any remaining processes...${NC}"

# Kill any remaining python processes related to our project
pkill -f "main_simple.py" 2>/dev/null || true

# Kill any remaining node processes related to our project
pkill -f "react-scripts" 2>/dev/null || true

# Wait a moment
sleep 2

# Final check
echo -e "${BLUE}🔍 Final status check...${NC}"
if lsof -Pi :8000,3000 -sTCP:LISTEN -t >/dev/null ; then
    echo -e "${RED}❌ Some services are still running${NC}"
    echo -e "${YELLOW}💡 You may need to manually kill them:${NC}"
    echo -e "   lsof -ti:8000,3000 | xargs kill -9"
    exit 1
else
    echo -e "${GREEN}✅ All TTS services stopped successfully!${NC}"
    echo -e "${BLUE}📊 Cleanup complete${NC}"
fi

echo ""
echo -e "${GREEN}🎉 TTS Project stopped!${NC}"
echo -e "${YELLOW}💡 To start again, run: ./start.sh${NC}"
