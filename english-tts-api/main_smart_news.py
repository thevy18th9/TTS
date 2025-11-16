from fastapi import FastAPI, Form, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os
import logging
import feedparser
import re
import json
import asyncio
from datetime import datetime, timedelta
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import requests
import aiohttp
import sqlite3
from pathlib import Path
import hashlib
import whisper
from TTS.api import TTS
import io
import base64

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Smart News Reader AI",
    description="AI-powered multilingual news reader with real-time STT, news retrieval, and TTS",
    version="2.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variables
tts_model = None
whisper_model = None
db_path = "smart_news.db"

# Enhanced news sources with real-time APIs
NEWS_SOURCES = {
    'vnexpress': {
        'rss_url': 'https://vnexpress.net/rss/tin-moi-nhat.rss',
        'api_url': 'https://vnexpress.net/rss/tin-moi-nhat.rss',
        'name': 'VnExpress',
        'language': 'vi',
        'category': 'general'
    },
    'tuoitre': {
        'rss_url': 'https://tuoitre.vn/rss/tin-moi-nhat.rss',
        'api_url': 'https://tuoitre.vn/rss/tin-moi-nhat.rss',
        'name': 'Tuổi Trẻ',
        'language': 'vi',
        'category': 'general'
    },
    'thanhnien': {
        'rss_url': 'https://thanhnien.vn/rss/home.rss',
        'api_url': 'https://thanhnien.vn/rss/home.rss',
        'name': 'Thanh Niên',
        'language': 'vi',
        'category': 'general'
    },
    'dantri': {
        'rss_url': 'https://dantri.com.vn/rss/tin-moi-nhat.rss',
        'api_url': 'https://dantri.com.vn/rss/tin-moi-nhat.rss',
        'name': 'Dân Trí',
        'language': 'vi',
        'category': 'general'
    },
    'vietnamnet': {
        'rss_url': 'https://vietnamnet.vn/rss/tin-moi-nhat.rss',
        'api_url': 'https://vietnamnet.vn/rss/tin-moi-nhat.rss',
        'name': 'VietnamNet',
        'language': 'vi',
        'category': 'general'
    },
    'bbc': {
        'rss_url': 'https://feeds.bbci.co.uk/news/rss.xml',
        'api_url': 'https://feeds.bbci.co.uk/news/rss.xml',
        'name': 'BBC News',
        'language': 'en',
        'category': 'international'
    },
    'cnn': {
        'rss_url': 'https://rss.cnn.com/rss/edition.rss',
        'api_url': 'https://rss.cnn.com/rss/edition.rss',
        'name': 'CNN',
        'language': 'en',
        'category': 'international'
    },
    'reuters': {
        'rss_url': 'https://feeds.reuters.com/reuters/topNews',
        'api_url': 'https://feeds.reuters.com/reuters/topNews',
        'name': 'Reuters',
        'language': 'en',
        'category': 'international'
    },
    'guardian': {
        'rss_url': 'https://www.theguardian.com/world/rss',
        'api_url': 'https://www.theguardian.com/world/rss',
        'name': 'The Guardian',
        'language': 'en',
        'category': 'international'
    }
}

# Pydantic models
class NewsArticle(BaseModel):
    id: str
    title: str
    description: str
    content: str
    link: str
    published: str
    source: str
    language: str
    category: str
    image_url: Optional[str] = None
    audio_url: Optional[str] = None
    read_count: int = 0

class SearchRequest(BaseModel):
    query: str
    language: Optional[str] = 'auto'
    max_articles: int = 10
    real_time: bool = True

class TTSRequest(BaseModel):
    text: str
    language: str = 'vi'
    voice_model: str = 'coqui_vn_female'
    streaming: bool = False

class HistoryItem(BaseModel):
    id: str
    query: str
    articles: List[NewsArticle]
    timestamp: str
    language: str
    duration: Optional[int] = None

# Database setup
def init_database():
    """Initialize SQLite database for history and caching"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Create tables
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS articles (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT,
            content TEXT,
            link TEXT,
            published TEXT,
            source TEXT,
            language TEXT,
            category TEXT,
            image_url TEXT,
            audio_url TEXT,
            read_count INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS search_history (
            id TEXT PRIMARY KEY,
            query TEXT NOT NULL,
            language TEXT,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            article_count INTEGER,
            duration INTEGER
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS article_history (
            search_id TEXT,
            article_id TEXT,
            FOREIGN KEY (search_id) REFERENCES search_history (id),
            FOREIGN KEY (article_id) REFERENCES articles (id)
        )
    ''')
    
    conn.commit()
    conn.close()

def get_article_id(article_data: dict) -> str:
    """Generate unique ID for article"""
    content = f"{article_data.get('title', '')}{article_data.get('link', '')}"
    return hashlib.md5(content.encode()).hexdigest()

def save_article(article: NewsArticle):
    """Save article to database"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    cursor.execute('''
        INSERT OR REPLACE INTO articles 
        (id, title, description, content, link, published, source, language, category, image_url, audio_url, read_count)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        article.id, article.title, article.description, article.content,
        article.link, article.published, article.source, article.language,
        article.category, article.image_url, article.audio_url, article.read_count
    ))
    
    conn.commit()
    conn.close()

def get_search_history(limit: int = 50) -> List[HistoryItem]:
    """Get search history"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT sh.id, sh.query, sh.language, sh.timestamp, sh.article_count, sh.duration,
               a.id, a.title, a.description, a.content, a.link, a.published, a.source, a.language, a.category, a.image_url, a.audio_url, a.read_count
        FROM search_history sh
        LEFT JOIN article_history ah ON sh.id = ah.search_id
        LEFT JOIN articles a ON ah.article_id = a.id
        ORDER BY sh.timestamp DESC
        LIMIT ?
    ''', (limit,))
    
    rows = cursor.fetchall()
    conn.close()
    
    # Group by search_id
    history_dict = {}
    for row in rows:
        search_id = row[0]
        if search_id not in history_dict:
            history_dict[search_id] = {
                'id': search_id,
                'query': row[1],
                'language': row[2],
                'timestamp': row[3],
                'article_count': row[4],
                'duration': row[5],
                'articles': []
            }
        
        if row[6]:  # article data exists
            article = NewsArticle(
                id=row[6],
                title=row[7],
                description=row[8],
                content=row[9],
                link=row[10],
                published=row[11],
                source=row[12],
                language=row[13],
                category=row[14],
                image_url=row[15],
                audio_url=row[16],
                read_count=row[17]
            )
            history_dict[search_id]['articles'].append(article)
    
    return [HistoryItem(**item) for item in history_dict.values()]

async def fetch_real_time_news(query: str, language: str = 'vi', max_articles: int = 10) -> List[NewsArticle]:
    """Fetch real-time news from multiple sources"""
    articles = []
    
    # Determine sources based on language
    if language == 'vi':
        sources = ['vnexpress', 'tuoitre', 'thanhnien', 'dantri', 'vietnamnet']
    else:
        sources = ['bbc', 'cnn', 'reuters', 'guardian']
    
    # Fetch from all sources concurrently
    async with aiohttp.ClientSession() as session:
        tasks = []
        for source in sources:
            task = fetch_from_source(session, source, query)
            tasks.append(task)
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        for result in results:
            if isinstance(result, list):
                articles.extend(result)
    
    # Remove duplicates and limit
    seen_titles = set()
    unique_articles = []
    for article in articles:
        if article.title not in seen_titles and len(article.title) > 10:
            seen_titles.add(article.title)
            unique_articles.append(article)
            if len(unique_articles) >= max_articles:
                break
    
    return unique_articles

async def fetch_from_source(session: aiohttp.ClientSession, source_key: str, query: str) -> List[NewsArticle]:
    """Fetch articles from a specific source"""
    if source_key not in NEWS_SOURCES:
        return []
    
    source = NEWS_SOURCES[source_key]
    articles = []
    
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }
        
        async with session.get(source['api_url'], headers=headers, timeout=10) as response:
            if response.status == 200:
                content = await response.text()
                feed = feedparser.parse(content)
                
                for entry in feed.entries[:5]:  # Limit per source
                    title = entry.get('title', '').strip()
                    description = entry.get('description', '').strip()
                    link = entry.get('link', '').strip()
                    published = entry.get('published', '').strip()
                    
                    # Clean HTML from description
                    clean_desc = re.sub(r'<[^>]+>', '', description)
                    
                    # Filter by query if provided
                    if query and query.lower() not in title.lower() and query.lower() not in clean_desc.lower():
                        continue
                    
                    if len(title) > 5:  # Valid article
                        article_id = get_article_id({'title': title, 'link': link})
                        
                        article = NewsArticle(
                            id=article_id,
                            title=title,
                            description=clean_desc[:200] + "..." if len(clean_desc) > 200 else clean_desc,
                            content=clean_desc,
                            link=link,
                            published=published,
                            source=source['name'],
                            language=source['language'],
                            category=source['category'],
                            image_url=None  # Could be extracted from entry
                        )
                        
                        articles.append(article)
                        save_article(article)
                        
    except Exception as e:
        logger.error(f"Error fetching from {source_key}: {e}")
    
    return articles

def detect_language(text: str) -> str:
    """Auto-detect language from text"""
    try:
        # Simple language detection based on character patterns
        vietnamese_chars = len([c for c in text if ord(c) > 127 and c in 'àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ'])
        chinese_chars = len([c for c in text if '\u4e00' <= c <= '\u9fff'])
        
        if vietnamese_chars > 0:
            return 'vi'
        elif chinese_chars > 0:
            return 'zh'
        else:
            return 'en'
    except:
        return 'vi'  # Default to Vietnamese

@app.on_event("startup")
async def startup_event():
    """Initialize models and database on startup"""
    global tts_model, whisper_model
    
    try:
        logger.info("Initializing Smart News Reader AI...")
        
        # Initialize database
        init_database()
        
        # Initialize TTS model
        logger.info("Loading TTS model...")
        tts_model = TTS(
            model_name="tts_models/multilingual/multi-dataset/xtts_v2",
            progress_bar=False,
            gpu=False
        )
        
        # Initialize Whisper for STT
        logger.info("Loading Whisper model...")
        whisper_model = whisper.load_model("base")
        
        logger.info("Smart News Reader AI ready!")
        
    except Exception as e:
        logger.error(f"Failed to initialize: {e}")
        raise e

@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "status": "Smart News Reader AI ready",
        "version": "2.0.0",
        "features": ["STT", "Real-time News", "TTS", "History", "Multi-language"]
    }

@app.post("/search-news")
async def search_news(request: SearchRequest):
    """Search for real-time news with history tracking"""
    try:
        # Auto-detect language if not specified
        if request.language == 'auto':
            detected_lang = detect_language(request.query)
        else:
            detected_lang = request.language
        
        # Fetch real-time news
        articles = await fetch_real_time_news(request.query, detected_lang, request.max_articles)
        
        # Save to history
        search_id = hashlib.md5(f"{request.query}{datetime.now()}".encode()).hexdigest()
        
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO search_history (id, query, language, article_count)
            VALUES (?, ?, ?, ?)
        ''', (search_id, request.query, detected_lang, len(articles)))
        
        # Link articles to search
        for article in articles:
            cursor.execute('''
                INSERT INTO article_history (search_id, article_id)
                VALUES (?, ?)
            ''', (search_id, article.id))
        
        conn.commit()
        conn.close()
        
        return {
            "query": request.query,
            "detected_language": detected_lang,
            "articles": [article.dict() for article in articles],
            "search_id": search_id,
            "timestamp": datetime.now().isoformat(),
            "total_found": len(articles)
        }
        
    except Exception as e:
        logger.error(f"Error searching news: {e}")
        raise HTTPException(status_code=500, detail=f"Error searching news: {e}")

@app.post("/synthesize")
async def synthesize_speech(request: TTSRequest):
    """Synthesize speech with streaming support"""
    try:
        if tts_model is None:
            raise HTTPException(status_code=503, detail="TTS model not loaded")
        
        # Ensure output directory exists
        output_dir = "output"
        os.makedirs(output_dir, exist_ok=True)
        
        # Generate unique filename
        text_hash = hashlib.md5(request.text.encode()).hexdigest()[:8]
        output_file = os.path.join(output_dir, f"smart_news_{text_hash}.wav")
        
        logger.info(f"Synthesizing: '{request.text[:50]}...' in {request.language}")
        
        # Synthesize speech
        tts_model.tts_to_file(
            text=request.text,
            file_path=output_file,
            speaker_wav=None,
            language=request.language,
            split_sentences=True
        )
        
        logger.info(f"Speech synthesized: {output_file}")
        
        if request.streaming:
            # Return streaming response
            def generate():
                with open(output_file, "rb") as f:
                    while True:
                        chunk = f.read(1024)
                        if not chunk:
                            break
                        yield chunk
            
            return StreamingResponse(
                generate(),
                media_type="audio/wav",
                headers={"Content-Disposition": "inline; filename=speech.wav"}
            )
        else:
            # Return file response
            return FileResponse(
                path=output_file,
                media_type="audio/wav",
                filename="speech.wav"
            )
            
    except Exception as e:
        logger.error(f"Error synthesizing speech: {e}")
        raise HTTPException(status_code=500, detail=f"Error synthesizing speech: {e}")

@app.post("/stt")
async def speech_to_text(audio_file: bytes = Form(...)):
    """Convert speech to text using Whisper"""
    try:
        if whisper_model is None:
            raise HTTPException(status_code=503, detail="Whisper model not loaded")
        
        # Save uploaded audio temporarily
        temp_file = "temp_audio.wav"
        with open(temp_file, "wb") as f:
            f.write(audio_file)
        
        # Transcribe using Whisper
        result = whisper_model.transcribe(temp_file)
        
        # Clean up temp file
        os.remove(temp_file)
        
        return {
            "text": result["text"],
            "language": result.get("language", "unknown"),
            "confidence": result.get("confidence", 0.0)
        }
        
    except Exception as e:
        logger.error(f"Error in speech-to-text: {e}")
        raise HTTPException(status_code=500, detail=f"Error in speech-to-text: {e}")

@app.get("/history")
async def get_history(limit: int = 50):
    """Get search history"""
    try:
        history = get_search_history(limit)
        return {
            "history": [item.dict() for item in history],
            "total": len(history)
        }
    except Exception as e:
        logger.error(f"Error getting history: {e}")
        raise HTTPException(status_code=500, detail=f"Error getting history: {e}")

@app.get("/news-sources")
async def get_news_sources():
    """Get available news sources"""
    return {
        "sources": NEWS_SOURCES,
        "total": len(NEWS_SOURCES),
        "languages": ["vi", "en", "zh"],
        "categories": ["general", "international"]
    }

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket for real-time updates"""
    await websocket.accept()
    try:
        while True:
            # Keep connection alive
            await asyncio.sleep(1)
            await websocket.send_json({"status": "connected"})
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected")

if __name__ == "__main__":
    uvicorn.run(
        "main_smart_news:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
