#!/bin/bash

echo "🧠 Starting Smart News Reader AI"
echo "=================================================="

# Check if virtual environment exists
if [ ! -d "english-tts-api/venv" ]; then
    echo "❌ Virtual environment not found. Please run setup first."
    exit 1
fi

# Install new dependencies
echo "📦 Installing new dependencies..."
cd english-tts-api
source venv/bin/activate

# Install additional packages
pip install aiohttp==3.9.1 websockets==12.0 openai-whisper==20231117

echo "🔧 Starting Smart News Reader Backend..."
python main_smart_news.py &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

# Wait for backend to start
sleep 8

# Check if backend is running
if curl -s http://localhost:8000/ > /dev/null; then
    echo "✅ Backend started successfully"
else
    echo "❌ Backend failed to start"
    exit 1
fi

cd ..

# Start frontend
echo "🌐 Starting Frontend..."
cd tts-frontend
npm start &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"

# Wait for frontend to start
sleep 15

# Check if frontend is running
if curl -s http://localhost:3000/ > /dev/null; then
    echo "✅ Frontend started successfully"
else
    echo "❌ Frontend failed to start"
    exit 1
fi

echo ""
echo "🎉 Smart News Reader AI is ready!"
echo "=================================="
echo "🌐 Frontend: http://localhost:3000"
echo "🔧 Backend: http://localhost:8000"
echo ""
echo "🎯 New Features:"
echo "   • 🎤 Real-time Speech-to-Text (Whisper)"
echo "   • 📰 Real-time News Retrieval"
echo "   • 🔊 Advanced TTS (Coqui XTTS)"
echo "   • 📚 Reading History & Caching"
echo "   • 🌐 Multi-language Support (VI/EN/ZH)"
echo "   • ⚡ WebSocket Real-time Updates"
echo "   • ♿ Full Accessibility Support"
echo ""
echo "🎮 Try these features:"
echo "   • Say 'iPhone' to search latest iPhone news"
echo "   • Say 'bóng đá' for Vietnamese sports news"
echo "   • Use voice commands: 'Read tech news'"
echo "   • Check History panel for past searches"
echo "   • Toggle Dark/Light mode"
echo ""
echo "Press Ctrl+C to stop all services"

# Keep script running
wait
