#!/bin/bash

# Vietnamese TTS Project Startup Script
echo "🎤 Starting Vietnamese TTS Project with Multiple Voice Models..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to check if port is in use
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Function to kill process on port
kill_port() {
    local port=$1
    local pids=$(lsof -ti:$port)
    if [ ! -z "$pids" ]; then
        echo -e "${YELLOW}🔍 Killing existing processes on port $port...${NC}"
        echo $pids | xargs kill -9
        sleep 2
    fi
}

# Check and clean up ports
echo -e "${BLUE}🔍 Checking ports...${NC}"
if check_port 8000; then
    echo -e "${YELLOW}⚠️  Port 8000 is in use${NC}"
    kill_port 8000
fi

if check_port 3000; then
    echo -e "${YELLOW}⚠️  Port 3000 is in use${NC}"
    kill_port 3000
fi

# Start Backend API
echo -e "${BLUE}🚀 Starting Vietnamese TTS Backend API...${NC}"
cd english-tts-api

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo -e "${YELLOW}📦 Creating virtual environment...${NC}"
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install dependencies if needed
if [ ! -f "venv/.deps_installed" ]; then
    echo -e "${YELLOW}📦 Installing dependencies...${NC}"
    pip install fastapi uvicorn[standard] gtts requests
    touch venv/.deps_installed
fi

# Start the Vietnamese TTS API
echo -e "${GREEN}🎯 Starting Vietnamese TTS API on port 8000...${NC}"
python main_vietnamese.py &
BACKEND_PID=$!

# Wait for backend to start
sleep 3

# Check if backend is running
if ! check_port 8000; then
    echo -e "${RED}❌ Failed to start backend API${NC}"
    exit 1
fi

# Start Frontend
echo -e "${BLUE}🌐 Starting React Frontend...${NC}"
cd ../tts-frontend

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Installing frontend dependencies...${NC}"
    npm install
fi

# Start React development server
echo -e "${GREEN}🎯 Starting React app on port 3000...${NC}"
npm start &
FRONTEND_PID=$!

# Wait for frontend to start
sleep 5

# Check if frontend is running
if ! check_port 3000; then
    echo -e "${RED}❌ Failed to start frontend${NC}"
    kill $BACKEND_PID 2>/dev/null
    exit 1
fi

# Success message
echo ""
echo -e "${GREEN}🎉 Vietnamese TTS Project started successfully!${NC}"
echo -e "${BLUE}📊 Service Information:${NC}"
echo -e "   Backend PID: $BACKEND_PID"
echo -e "   Frontend PID: $FRONTEND_PID"
echo -e "   Frontend URL: ${GREEN}http://localhost:3000${NC}"
echo -e "   Backend URL: ${GREEN}http://localhost:8000${NC}"
echo -e "   API Docs: ${GREEN}http://localhost:8000/docs${NC}"
echo ""
echo -e "${YELLOW}🎤 Available Voice Models:${NC}"
echo -e "   - google_male: Nam (Mặc định) - Giọng nam tự nhiên"
echo -e "   - google_female: Nữ - Giọng nữ mềm mại"
echo -e "   - google_slow: Chậm rãi - Giọng chậm, dễ nghe"
echo -e "   - google_news: Tin tức - Giọng phát thanh viên"
echo ""
echo -e "${BLUE}💡 To stop the project, run: ./stop.sh${NC}"
echo -e "${BLUE}💡 Or press Ctrl+C in this terminal${NC}"

# Keep script running
wait
