from fastapi import FastAPI, Form, HTTPException, Request
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
whisper_model = None
db_path = "smart_news.db"

# Enhanced news sources with real-time APIs
NEWS_SOURCES = {
    "vi": [
        {
            "name": "VnExpress",
            "url": "https://vnexpress.net/rss",
            "api_key": None
        },
        {
            "name": "Tuổi Trẻ",
            "url": "https://tuoitre.vn/rss",
            "api_key": None
        },
        {
            "name": "Thanh Niên",
            "url": "https://thanhnien.vn/rss",
            "api_key": None
        }
    ],
    "en": [
        {
            "name": "BBC News",
            "url": "https://feeds.bbci.co.uk/news/rss.xml",
            "api_key": None
        },
        {
            "name": "CNN",
            "url": "http://rss.cnn.com/rss/edition.rss",
            "api_key": None
        },
        {
            "name": "Reuters",
            "url": "https://feeds.reuters.com/reuters/topNews",
            "api_key": None
        }
    ],
    "zh": [
        {
            "name": "BBC Chinese",
            "url": "https://www.bbc.com/zhongwen/simp/rss.xml",
            "api_key": None
        },
        {
            "name": "Xinhua",
            "url": "http://www.xinhuanet.com/rss.xml",
            "api_key": None
        }
    ]
}

# Pydantic models
class SearchRequest(BaseModel):
    query: str
    language: str = "vi"
    limit: int = 10

class SearchResponse(BaseModel):
    articles: List[Dict[str, Any]]
    total: int
    query: str
    timestamp: str

class TTSRequest(BaseModel):
    text: str
    language: str = "vi"
    voice_model: str = "default"
    speed: Optional[float] = 1.0
    pitch: Optional[float] = 1.0

class STTRequest(BaseModel):
    audio_data: str  # base64 encoded audio
    language: str = "vi"

class STTResponse(BaseModel):
    text: str
    confidence: float
    language: str

class HistoryItem(BaseModel):
    id: str
    title: str
    content: str
    language: str
    timestamp: str
    url: Optional[str] = None

# Database functions
def init_db():
    """Initialize SQLite database"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS history (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            language TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            url TEXT
        )
    ''')
    
    conn.commit()
    conn.close()

def save_to_history(item: HistoryItem):
    """Save article to history"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    cursor.execute('''
        INSERT OR REPLACE INTO history (id, title, content, language, timestamp, url)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (item.id, item.title, item.content, item.language, item.timestamp, item.url))
    
    conn.commit()
    conn.close()

def get_history(limit: int = 50) -> List[HistoryItem]:
    """Get reading history"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT id, title, content, language, timestamp, url
        FROM history
        ORDER BY timestamp DESC
        LIMIT ?
    ''', (limit,))
    
    rows = cursor.fetchall()
    conn.close()
    
    return [HistoryItem(
        id=row[0],
        title=row[1],
        content=row[2],
        language=row[3],
        timestamp=row[4],
        url=row[5]
    ) for row in rows]

# News fetching functions
async def fetch_news_from_source(source: Dict[str, Any], query: str = "") -> List[Dict[str, Any]]:
    """Fetch news from a single RSS source"""
    articles = []
    
    try:
        # Parse RSS feed
        feed = feedparser.parse(source["url"])
        
        for entry in feed.entries[:10]:  # Limit to 10 articles per source
            # Clean and process article data
            title = entry.get('title', '').strip()
            description = entry.get('description', '').strip()
            link = entry.get('link', '')
            published = entry.get('published_parsed', None)
            
            # Convert published date
            if published:
                published_date = datetime(*published[:6])
            else:
                published_date = datetime.now()
            
            # Get image from content or use default
            image_url = ""
            if hasattr(entry, 'content'):
                for content in entry.content:
                    if content.type == 'text/html':
                        # Extract image from HTML content
                        img_match = re.search(r'<img[^>]+src="([^"]+)"', content.value)
                        if img_match:
                            image_url = img_match.group(1)
                            break
            
            # If no image found, use a default based on category
            if not image_url:
                image_url = f"https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=400&h=250&fit=crop"
            
            article = {
                "id": hashlib.md5(f"{title}{link}".encode()).hexdigest()[:12],
                "title": title,
                "description": description,
                "image": image_url,
                "source": source["name"],
                "published": published_date.isoformat(),
                "url": link,
                "language": "vi" if "vnexpress" in source["url"] or "tuoitre" in source["url"] else "en",
                "category": "General"
            }
            
            # Filter by query if provided
            if query:
                query_lower = query.lower()
                if (query_lower in title.lower() or 
                    query_lower in description.lower()):
                    articles.append(article)
            else:
                articles.append(article)
                
    except Exception as e:
        logger.error(f"Error fetching from {source['name']}: {e}")
    
    return articles

async def search_news_real_time(query: str, language: str = "vi", limit: int = 10) -> SearchResponse:
    """Search news from multiple sources in real-time"""
    all_articles = []
    
    # Get sources for the specified language
    sources = NEWS_SOURCES.get(language, NEWS_SOURCES["vi"])
    
    # Fetch from all sources concurrently
    tasks = [fetch_news_from_source(source, query) for source in sources]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    # Combine all articles
    for result in results:
        if isinstance(result, list):
            all_articles.extend(result)
    
    # Sort by published date (newest first)
    all_articles.sort(key=lambda x: x.get('published', ''), reverse=True)
    
    # Limit results
    limited_articles = all_articles[:limit]
    
    return SearchResponse(
        articles=limited_articles,
        total=len(limited_articles),
        query=query,
        timestamp=datetime.now().isoformat()
    )

# API Endpoints
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

@app.post("/search-news", response_model=SearchResponse)
async def search_news(request: SearchRequest):
    """Search for news articles"""
    try:
        logger.info(f"Searching news for query: {request.query} in language: {request.language}")
        result = await search_news_real_time(
            query=request.query,
            language=request.language,
            limit=request.limit
        )
        return result
    except Exception as e:
        logger.error(f"Error searching news: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/synthesize")
async def synthesize_speech(
    text: str = Form(...),
    language: str = Form("vi"),
    voice_model: str = Form("default"),
    speed: float = Form(1.0),
    pitch: float = Form(1.0)
):
    """Synthesize speech from text (mock implementation)"""
    try:
        # For now, return a simple audio file or error
        # In production, this would use a real TTS service
        logger.info(f"Synthesizing speech for text: {text[:50]}...")
        
        # Create a simple audio response (mock)
        audio_data = b"RIFF\x00\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00\x44\xac\x00\x00\x88X\x01\x00\x02\x00\x10\x00data\x00\x00\x00\x00"
        
        return StreamingResponse(
            io.BytesIO(audio_data),
            media_type="audio/wav",
            headers={"Content-Disposition": "attachment; filename=speech.wav"}
        )
    except Exception as e:
        logger.error(f"Error synthesizing speech: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/stt", response_model=STTResponse)
async def speech_to_text(request: STTRequest):
    """Convert speech to text using Whisper"""
    try:
        if not whisper_model:
            raise HTTPException(status_code=500, detail="Whisper model not loaded")
        
        # Decode base64 audio
        audio_data = base64.b64decode(request.audio_data)
        
        # Save temporary audio file
        temp_file = "temp_audio.wav"
        with open(temp_file, "wb") as f:
            f.write(audio_data)
        
        # Transcribe using Whisper
        result = whisper_model.transcribe(temp_file, language=request.language)
        
        # Clean up temp file
        os.remove(temp_file)
        
        return STTResponse(
            text=result["text"].strip(),
            confidence=0.9,  # Whisper doesn't provide confidence scores
            language=request.language
        )
    except Exception as e:
        logger.error(f"Error in speech-to-text: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/history")
async def get_reading_history(limit: int = 50):
    """Get reading history"""
    try:
        history = get_history(limit)
        return {"history": [item.dict() for item in history]}
    except Exception as e:
        logger.error(f"Error getting history: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/history")
async def save_article_to_history(item: HistoryItem):
    """Save article to reading history"""
    try:
        save_to_history(item)
        return {"status": "saved", "id": item.id}
    except Exception as e:
        logger.error(f"Error saving to history: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Startup event
@app.on_event("startup")
async def startup_event():
    """Initialize models and database on startup"""
    global whisper_model
    
    try:
        logger.info("Initializing Smart News Reader AI...")
        
        # Initialize database
        init_db()
        logger.info("Database initialized")
        
        # Load Whisper model (smaller model for faster startup)
        logger.info("Loading Whisper model...")
        whisper_model = whisper.load_model("base")
        logger.info("Whisper model loaded successfully")
        
        logger.info("Smart News Reader AI is ready!")
        
    except Exception as e:
        logger.error(f"Failed to initialize: {e}")
        raise e

if __name__ == "__main__":
    uvicorn.run(
        "main_simple_news:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
