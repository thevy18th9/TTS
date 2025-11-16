# 🎤 Multi-Language Text-to-Speech API & Frontend

A complete web application for converting text to speech in multiple languages using Google TTS, featuring a beautiful React frontend and Node.js backend with news search integration.

## ✨ Features

### 🎤 **NEW: Voice Search & News Reading**
- 🎯 **Speech-to-Text** - Voice recognition in multiple languages
- 🔍 **Smart News Search** - Automatic news search based on voice input
- 📰 **Real-time News** - Fetch latest news from multiple sources
- 🔊 **Auto TTS** - Automatically read found news to user
- ⌨️ **Keyboard Shortcuts** - Ctrl+M for voice search

### 🌍 **Multi-Language Support**
- 🇺🇸 **English** - Natural English speech
- 🇻🇳 **Tiếng Việt** - Vietnamese speech with proper pronunciation
- 🇯🇵 **日本語** - Japanese speech synthesis
- 🇰🇷 **한국어** - Korean speech generation
- 🇨🇳 **中文** - Chinese text-to-speech
- 🇫🇷 **Français** - French voice synthesis
- 🇩🇪 **Deutsch** - German speech generation
- 🇪🇸 **Español** - Spanish voice synthesis

### 🎯 **Key Features**
- ⚡ **Fast Generation** - Google TTS for quick processing
- 🎯 **High Quality** - Natural-sounding voices
- 🔊 **Audio Player** - Play, pause, stop, and download
- 💾 **Easy Download** - Save audio as MP3 files
- 📱 **Responsive Design** - Works on desktop and mobile
- 🌐 **Bilingual UI** - Interface adapts to selected language
- ♿ **Accessibility** - Voice search for visually impaired users

## 🏗️ Project Structure

```
TTS/
├── english-tts-api/          # FastAPI Backend
│   ├── main_simple.py        # Main API server (Google TTS)
│   ├── main.py              # Alternative server (Coqui TTS)
│   ├── requirements.txt     # Python dependencies
│   └── output/              # Generated audio files
├── tts-frontend/            # React Frontend
│   ├── src/
│   │   ├── App.tsx          # Main React component
│   │   └── App.css          # Custom styles
│   └── package.json         # Node.js dependencies
└── README.md               # This file
```

## 🚀 Quick Start

### Prerequisites
- Python 3.10+
- Node.js 16+
- npm or yarn
- Microphone (for voice search)

### 1. Backend Setup (News TTS API with Voice Search)

```bash
# Navigate to backend directory
cd english-tts-api

# Create virtual environment
python3 -m venv venv

# Activate virtual environment
# On macOS/Linux:
source venv/bin/activate
# On Windows:
# venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run the news TTS server with voice search
python main_news.py

# OR use the convenient script
../start_news.sh
```

The API will be available at `http://localhost:8000`

### 2. Frontend Setup (React)

```bash
# Navigate to frontend directory
cd tts-frontend

# Install dependencies
npm install

# Start development server
npm start
```

The frontend will be available at `http://localhost:3000`

## 🎤 Voice Search Usage

### How to Use Voice Search
1. **Open the app** in your browser
2. **Click "Start Voice Search"** button (or press Ctrl+M)
3. **Speak your query** (e.g., "Đọc tin tức thể thao")
4. **System will automatically**:
   - Convert speech to text
   - Search for relevant news
   - Read the news to you

### Example Voice Commands
- 🏆 **Sports**: "Đọc tin tức thể thao", "Sports news"
- 💰 **Economy**: "Tin tức kinh tế", "Economy news"  
- 💻 **Technology**: "Tin tức công nghệ", "AI news"
- 🎓 **Education**: "Tin tức giáo dục", "Education"
- 🏥 **Health**: "Tin tức y tế", "Health news"
- 📰 **General**: "Tin tức tổng hợp", "News today"

### Browser Requirements
- ✅ Chrome (recommended)
- ✅ Edge
- ✅ Safari (iOS 14.5+)
- ❌ Firefox (limited support)

## 📖 API Documentation

### Endpoints

#### Health Check
- **GET** `/` - Returns API status
- **Response**: `{"status": "English TTS API ready (Google TTS)"}`

#### Text-to-Speech Synthesis
- **POST** `/synthesize` - Convert text to speech
- **Parameters**:
  - `text` (string): Text to convert (max 2000 characters)
  - `language` (string): Language code (en, vi, ja, ko, zh, fr, de, es)
  - `voice_model` (string): Voice model to use
- **Response**: Audio file (WAV format)

#### News Search
- **POST** `/search-news` - Search for news articles
- **Parameters**:
  - `query` (string): Search query
  - `language` (string): Language preference (vi, en)
  - `max_articles` (int): Maximum articles to return
- **Response**: JSON with news text

#### News Sources
- **GET** `/news-sources` - Get available news sources
- **Response**: JSON with available news sources

### Example Usage

**Using curl:**
```bash
curl -X POST "http://localhost:8000/synthesize" \
     -F "text=Hello, this is a test" \
     -F "language=en" \
     --output speech.mp3
```

**Using JavaScript:**
```javascript
const formData = new FormData();
formData.append('text', 'Xin chào, tôi là Jenifer!');
formData.append('language', 'vi');

const response = await fetch('http://localhost:8000/synthesize', {
  method: 'POST',
  body: formData
});

const audioBlob = await response.blob();
const audioUrl = URL.createObjectURL(audioBlob);
```

## 🎨 Frontend Features

### Language Selection
- Dropdown with flag icons and native language names
- Automatic UI translation based on selected language
- Placeholder text adapts to chosen language

### Audio Controls
- ▶️ **Play/Pause** - Control audio playback
- ⏹️ **Stop** - Stop and reset audio
- ⬇️ **Download** - Save audio file locally
- 🔄 **Regenerate** - Create new audio with same text

### User Experience
- Real-time character counter (200 max)
- Progress indicators during generation
- Error handling with user-friendly messages
- Responsive design for all screen sizes

## 🛠️ Technical Details

### Backend (FastAPI)
- **Framework**: FastAPI 0.104.1
- **TTS Engine**: Google Text-to-Speech (gTTS)
- **Server**: Uvicorn with auto-reload
- **CORS**: Enabled for frontend integration

### Frontend (React)
- **Framework**: React 18 with TypeScript
- **UI Library**: Material-UI (MUI) v5
- **HTTP Client**: Axios
- **Styling**: Custom CSS with gradients and animations

### Dependencies

**Backend:**
```
fastapi==0.104.1
uvicorn[standard]==0.24.0
gtts==2.4.0
python-multipart==0.0.6
```

**Frontend:**
```
@mui/material
@emotion/react
@emotion/styled
@mui/icons-material
axios
```

## 🌐 Supported Languages

| Language | Code | Flag | Example |
|----------|------|------|---------|
| English | `en` | 🇺🇸 | "Hello, how are you?" |
| Tiếng Việt | `vi` | 🇻🇳 | "Xin chào, bạn khỏe không?" |
| 日本語 | `ja` | 🇯🇵 | "こんにちは、元気ですか？" |
| 한국어 | `ko` | 🇰🇷 | "안녕하세요, 어떻게 지내세요?" |
| 中文 | `zh` | 🇨🇳 | "你好，你好吗？" |
| Français | `fr` | 🇫🇷 | "Bonjour, comment allez-vous ?" |
| Deutsch | `de` | 🇩🇪 | "Hallo, wie geht es dir?" |
| Español | `es` | 🇪🇸 | "Hola, ¿cómo estás?" |

## 🔧 Configuration

### Environment Variables
No environment variables required - the application works out of the box!

### Customization
- **Audio Quality**: Modify `slow=False` in `main_simple.py` for faster generation
- **Text Limit**: Change `200` character limit in both frontend and backend
- **Languages**: Add more languages by updating the `languages` array in `App.tsx`

## 🐛 Troubleshooting

### Common Issues

1. **Port already in use**
   ```bash
   # Kill processes on ports 3000 and 8000
   lsof -ti:3000 | xargs kill -9
   lsof -ti:8000 | xargs kill -9
   ```

2. **CORS errors**
   - Ensure backend is running on port 8000
   - Check that CORS is enabled in FastAPI

3. **Audio not playing**
   - Check browser console for errors
   - Ensure audio format is supported (MP3)

4. **Language not working**
   - Verify language code is correct
   - Check Google TTS supports the language

## 📝 License

This project is open source and available under the MIT License.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📞 Support

If you encounter any issues or have questions:
1. Check the troubleshooting section
2. Review the API documentation
3. Open an issue on GitHub

---

**Made with ❤️ using Node.js, React, and Google TTS**
