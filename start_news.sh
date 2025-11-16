#!/bin/bash

# Start News TTS API with voice search functionality
echo "🎤 Starting News TTS API with Voice Search..."

# Navigate to the API directory
cd english-tts-api

# Activate virtual environment
source venv/bin/activate

# Install additional dependencies if needed
echo "📦 Installing additional dependencies..."
pip install feedparser requests

# Start the news API server
echo "🚀 Starting News TTS API server..."
python main_news.py
