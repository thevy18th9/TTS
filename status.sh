#!/bin/bash

echo "📊 TTS Project Status Check"
echo "=========================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to check service status
check_service() {
    local port=$1
    local service_name=$2
    local url=$3
    
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null ; then
        echo -e "${GREEN}✅ $service_name is running${NC}"
        echo -e "   Port: ${BLUE}$port${NC}"
        echo -e "   URL: ${BLUE}$url${NC}"
        
        # Get PID
        local pid=$(lsof -ti:$port)
        echo -e "   PID: ${BLUE}$pid${NC}"
        
        # Test if service responds
        if curl -s "$url" > /dev/null 2>&1; then
            echo -e "   Status: ${GREEN}Responding${NC}"
        else
            echo -e "   Status: ${YELLOW}Running but not responding${NC}"
        fi
        return 0
    else
        echo -e "${RED}❌ $service_name is not running${NC}"
        echo -e "   Port: ${BLUE}$port${NC} (available)"
        return 1
    fi
}

echo ""
echo -e "${BLUE}🔍 Checking services...${NC}"
echo ""

# Check Backend
echo -e "${YELLOW}📡 Backend API (FastAPI)${NC}"
check_service 8000 "Backend API" "http://localhost:8000"
echo ""

# Check Frontend
echo -e "${YELLOW}🌐 Frontend Web (React)${NC}"
check_service 3000 "Frontend Web" "http://localhost:3000"
echo ""

# Check API Documentation
echo -e "${YELLOW}📚 API Documentation${NC}"
if lsof -Pi :8000 -sTCP:LISTEN -t >/dev/null ; then
    if curl -s "http://localhost:8000/docs" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ API Docs available${NC}"
        echo -e "   URL: ${BLUE}http://localhost:8000/docs${NC}"
    else
        echo -e "${YELLOW}⚠️  Backend running but docs not accessible${NC}"
    fi
else
    echo -e "${RED}❌ API Docs not available (backend not running)${NC}"
fi
echo ""

# Check audio output directory
echo -e "${YELLOW}🎵 Audio Output Directory${NC}"
if [ -d "english-tts-api/output" ]; then
    local file_count=$(find english-tts-api/output -name "*.wav" -o -name "*.mp3" | wc -l)
    echo -e "${GREEN}✅ Output directory exists${NC}"
    echo -e "   Path: ${BLUE}english-tts-api/output${NC}"
    echo -e "   Audio files: ${BLUE}$file_count${NC}"
else
    echo -e "${YELLOW}⚠️  Output directory not found${NC}"
fi
echo ""

# System resources
echo -e "${YELLOW}💻 System Resources${NC}"
echo -e "   CPU Usage: ${BLUE}$(top -l 1 | grep "CPU usage" | awk '{print $3}' | cut -d% -f1)%${NC}"
echo -e "   Memory: ${BLUE}$(top -l 1 | grep "PhysMem" | awk '{print $2}')${NC}"
echo ""

# Quick actions
echo -e "${BLUE}🚀 Quick Actions${NC}"
echo -e "   Start project: ${GREEN}./start.sh${NC}"
echo -e "   Stop project:  ${RED}./stop.sh${NC}"
echo -e "   Check status:  ${YELLOW}./status.sh${NC}"
echo ""

# Overall status
backend_running=$(lsof -Pi :8000 -sTCP:LISTEN -t >/dev/null && echo "yes" || echo "no")
frontend_running=$(lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null && echo "yes" || echo "no")

if [ "$backend_running" = "yes" ] && [ "$frontend_running" = "yes" ]; then
    echo -e "${GREEN}🎉 TTS Project is fully operational!${NC}"
elif [ "$backend_running" = "yes" ] || [ "$frontend_running" = "yes" ]; then
    echo -e "${YELLOW}⚠️  TTS Project is partially running${NC}"
else
    echo -e "${RED}❌ TTS Project is not running${NC}"
fi
