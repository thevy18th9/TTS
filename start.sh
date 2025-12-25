#!/bin/bash

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Change to project directory
cd "$SCRIPT_DIR" || {
    echo "❌ Error: Cannot change to project directory: $SCRIPT_DIR"
    exit 1
}

echo "🚀 Starting TTS Project..."
echo "📁 Project directory: $SCRIPT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to check if port is in use
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null ; then
        echo -e "${RED}❌ Port $1 is already in use${NC}"
        return 1
    else
        echo -e "${GREEN}✅ Port $1 is available${NC}"
        return 0
    fi
}

# Check ports
echo -e "${BLUE}🔍 Checking ports...${NC}"
check_port 8004
check_port 3000

# Kill existing processes if needed
echo -e "${YELLOW}🧹 Cleaning up existing processes...${NC}"
lsof -ti:8004 | xargs kill -9 2>/dev/null || true
lsof -ti:3000 | xargs kill -9 2>/dev/null || true

# Wait a moment
sleep 2

# Start Backend (Node.js server on port 8004)
echo -e "${BLUE}📡 Starting Backend API (Node.js)...${NC}"
cd "$SCRIPT_DIR/english-tts-api" || {
    echo -e "${RED}❌ Error: Cannot find english-tts-api directory${NC}"
    exit 1
}

# Check if node_modules exists, if not install dependencies
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Installing backend dependencies...${NC}"
    npm install
fi

node server_web_tts.js &
BACKEND_PID=$!

# Wait for backend to start
echo -e "${YELLOW}⏳ Waiting for backend to start...${NC}"
sleep 5

# Check if backend is running
if curl -s http://localhost:8004/health > /dev/null; then
    echo -e "${GREEN}✅ Backend started successfully${NC}"
else
    echo -e "${RED}❌ Backend failed to start${NC}"
    kill $BACKEND_PID 2>/dev/null
    exit 1
fi

# Start Frontend
echo -e "${BLUE}🌐 Starting Frontend...${NC}"
cd "$SCRIPT_DIR/tts-frontend" || {
    echo -e "${RED}❌ Error: Cannot find tts-frontend directory${NC}"
    exit 1
}

# Check if node_modules exists, if not install dependencies
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Installing frontend dependencies...${NC}"
    npm install
fi

npm start &
FRONTEND_PID=$!

# Wait for frontend to start
echo -e "${YELLOW}⏳ Waiting for frontend to start...${NC}"
sleep 10

echo -e "${GREEN}🎉 TTS Project started successfully!${NC}"
echo -e "${BLUE}📊 Service Information:${NC}"
echo -e "   Backend PID: ${GREEN}$BACKEND_PID${NC}"
echo -e "   Frontend PID: ${GREEN}$FRONTEND_PID${NC}"
echo -e "   Frontend URL: ${GREEN}http://localhost:3000${NC}"
echo -e "   Backend URL: ${GREEN}http://localhost:8004${NC}"
echo -e "   Health Check: ${GREEN}http://localhost:8004/health${NC}"
echo ""
echo -e "${YELLOW}💡 To stop the project, run: ./stop.sh${NC}"
echo -e "${YELLOW}💡 Or press Ctrl+C in this terminal${NC}"

# Keep script running
wait
