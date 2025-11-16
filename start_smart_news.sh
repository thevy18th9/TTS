#!/bin/bash

echo "🚀 Starting Smart News Reader AI System..."

# Check if backend is running
if ! curl -s http://localhost:8000/ > /dev/null; then
    echo "🔧 Starting Backend..."
    cd english-tts-api
    source venv/bin/activate
    python main_simple.py &
    BACKEND_PID=$!
    echo "Backend PID: $BACKEND_PID"
    cd ..
    sleep 5
else
    echo "✅ Backend already running"
fi

# Check if frontend is running
if ! curl -s http://localhost:3000/ > /dev/null; then
    echo "🔧 Starting Frontend..."
    cd tts-frontend
    npm start &
    FRONTEND_PID=$!
    echo "Frontend PID: $FRONTEND_PID"
    cd ..
    sleep 10
else
    echo "✅ Frontend already running"
fi

echo ""
echo "🎉 Smart News Reader AI is ready!"
echo "🌐 Frontend: http://localhost:3000"
echo "🔧 Backend: http://localhost:8000"
echo ""
echo "🎯 Features:"
echo "   • Voice Search with Auto Language Detection"
echo "   • Real-time News from Multiple Sources"
echo "   • Dark/Light Mode Toggle"
echo "   • Accessibility Features"
echo "   • Keyboard Shortcuts (F1-F4)"
echo ""
echo "Press Ctrl+C to stop all services"
