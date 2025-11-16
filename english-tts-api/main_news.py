from fastapi import FastAPI, Form, HTTPException, Request
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os
import logging
import requests
import feedparser
from datetime import datetime
import re
from TTS.api import TTS
from pydantic import BaseModel
from typing import Optional, List
import json

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="News TTS API",
    description="A REST API for searching news and converting to speech using TTS",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variable to store the TTS model
tts_model = None

# News sources configuration
NEWS_SOURCES = {
    'vnexpress': {
        'rss_url': 'https://vnexpress.net/rss/tin-moi-nhat.rss',
        'name': 'VnExpress',
        'language': 'vi'
    },
    'tuoitre': {
        'rss_url': 'https://tuoitre.vn/rss/tin-moi-nhat.rss',
        'name': 'Tuổi Trẻ',
        'language': 'vi'
    },
    'thanhnien': {
        'rss_url': 'https://thanhnien.vn/rss/home.rss',
        'name': 'Thanh Niên',
        'language': 'vi'
    },
    'dantri': {
        'rss_url': 'https://dantri.com.vn/rss/tin-moi-nhat.rss',
        'name': 'Dân Trí',
        'language': 'vi'
    },
    'vietnamnet': {
        'rss_url': 'https://vietnamnet.vn/rss/tin-moi-nhat.rss',
        'name': 'VietnamNet',
        'language': 'vi'
    },
    'bbc': {
        'rss_url': 'http://feeds.bbci.co.uk/news/rss.xml',
        'name': 'BBC News',
        'language': 'en'
    },
    'cnn': {
        'rss_url': 'http://rss.cnn.com/rss/edition.rss',
        'name': 'CNN',
        'language': 'en'
    },
    'reuters': {
        'rss_url': 'https://feeds.reuters.com/reuters/topNews',
        'name': 'Reuters',
        'language': 'en'
    },
    'guardian': {
        'rss_url': 'https://www.theguardian.com/world/rss',
        'name': 'The Guardian',
        'language': 'en'
    }
}

# Pydantic models
class TextInput(BaseModel):
    text: str

class NewsSearchRequest(BaseModel):
    query: str
    language: str = 'vi'
    max_articles: int = 5

class NewsArticle(BaseModel):
    title: str
    description: str
    link: str
    published: str
    source: str

@app.on_event("startup")
async def startup_event():
    """Initialize the TTS model on startup"""
    global tts_model
    try:
        logger.info("Loading TTS model...")
        # Initialize TTS model for CPU only with optimized settings
        tts_model = TTS(
            model_name="tts_models/en/ljspeech/speaker_adaptation", 
            progress_bar=False,
            gpu=False  # Force CPU only
        )
        logger.info("TTS model loaded successfully!")
        logger.info("News TTS API is ready to serve requests")
    except Exception as e:
        logger.error(f"Failed to load TTS model: {str(e)}")
        raise e

@app.get("/")
async def root():
    """Health check endpoint"""
    return {"status": "News TTS API ready"}

def fetch_news_from_rss(source_key: str, query: str = None) -> List[NewsArticle]:
    """Fetch news articles from RSS feed"""
    if source_key not in NEWS_SOURCES:
        return []
    
    source = NEWS_SOURCES[source_key]
    articles = []
    
    try:
        feed = feedparser.parse(source['rss_url'])
        
        for entry in feed.entries[:10]:  # Limit to 10 articles
            title = entry.get('title', '')
            description = entry.get('description', '')
            link = entry.get('link', '')
            published = entry.get('published', '')
            
            # Filter by query if provided
            if query:
                query_lower = query.lower()
                if not (query_lower in title.lower() or query_lower in description.lower()):
                    continue
            
            article = NewsArticle(
                title=title,
                description=description,
                link=link,
                published=published,
                source=source['name']
            )
            articles.append(article)
            
    except Exception as e:
        logger.error(f"Error fetching news from {source_key}: {str(e)}")
    
    return articles

def search_news_by_keywords(query: str, language: str = 'vi') -> str:
    """Search news by keywords and return formatted text"""
    query_lower = query.lower()
    
    # Determine relevant sources based on language
    if language == 'vi':
        sources = ['vnexpress', 'tuoitre', 'thanhnien', 'dantri', 'vietnamnet']
    else:
        sources = ['bbc', 'cnn', 'reuters', 'guardian']
    
    all_articles = []
    
    # Fetch articles from all relevant sources with query filter
    for source in sources:
        articles = fetch_news_from_rss(source, query)
        all_articles.extend(articles)
    
    # If no articles found with query, try broader search
    if not all_articles:
        for source in sources:
            articles = fetch_news_from_rss(source)
            # Filter articles by keywords in title or description
            filtered_articles = []
            for article in articles:
                if (query_lower in article.title.lower() or 
                    query_lower in article.description.lower() or
                    any(keyword in article.title.lower() or keyword in article.description.lower() 
                        for keyword in query_lower.split())):
                    filtered_articles.append(article)
            all_articles.extend(filtered_articles)
    
    # If still no articles, get latest news
    if not all_articles:
        for source in sources:
            articles = fetch_news_from_rss(source)
            all_articles.extend(articles[:2])  # Get 2 latest from each source
    
    # Remove duplicates and limit to 8 articles
    seen_titles = set()
    unique_articles = []
    for article in all_articles:
        if article.title not in seen_titles:
            seen_titles.add(article.title)
            unique_articles.append(article)
            if len(unique_articles) >= 8:
                break
    
    if not unique_articles:
        return f"Không tìm thấy tin tức liên quan đến '{query}'. Vui lòng thử từ khóa khác."
    
    # Format articles into readable text
    news_text = f"📰 Tin tức về '{query}' từ {len(unique_articles)} nguồn:\n\n"
    
    # Group by source for better organization
    sources_found = {}
    for article in unique_articles:
        if article.source not in sources_found:
            sources_found[article.source] = []
        sources_found[article.source].append(article)
    
    for source_name, articles in sources_found.items():
        news_text += f"🔹 {source_name}:\n"
        for i, article in enumerate(articles, 1):
            news_text += f"   {i}. {article.title}\n"
            # Clean description (remove HTML tags)
            clean_desc = re.sub(r'<[^>]+>', '', article.description)
            clean_desc = clean_desc[:200] + "..." if len(clean_desc) > 200 else clean_desc
            news_text += f"      {clean_desc}\n"
            news_text += f"      📅 {article.published}\n\n"
    
    news_text += f"📊 Tổng cộng: {len(unique_articles)} bài viết từ {len(sources_found)} nguồn tin tức."
    
    return news_text

@app.post("/search-news")
async def search_news(request: NewsSearchRequest):
    """Search for news articles based on query"""
    try:
        news_text = search_news_by_keywords(request.query, request.language)
        return {
            "query": request.query,
            "language": request.language,
            "news_text": news_text,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Error searching news: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error searching news: {str(e)}")

@app.post("/synthesize")
async def synthesize_speech(request: Request, text: Optional[str] = Form(None), language: Optional[str] = Form('vi'), voice_model: Optional[str] = Form('google_vn_male')):
    """
    Synthesize speech from text input.
    Accepts either JSON with 'text' field or form data with 'text' field.
    """
    global tts_model
    
    if tts_model is None:
        raise HTTPException(status_code=503, detail="TTS model not loaded")
    
    # Get text from either JSON input or form data
    input_text = None
    
    # Check if it's form data first
    if text:
        input_text = text
    else:
        # Try to parse as JSON
        try:
            body = await request.json()
            if isinstance(body, dict) and 'text' in body:
                input_text = body['text']
        except Exception as e:
            logger.error(f"Error parsing request: {str(e)}")
            raise HTTPException(status_code=400, detail="Invalid request format. Please provide text as JSON {'text': 'your text'} or form data")
    
    if not input_text:
        raise HTTPException(status_code=400, detail="No text provided")
    
    if not input_text.strip():
        raise HTTPException(status_code=400, detail="Empty text provided")
    
    # Limit text length for faster processing
    if len(input_text) > 2000:
        raise HTTPException(status_code=400, detail="Text too long. Please keep it under 2000 characters for faster processing.")
    
    try:
        # Ensure output directory exists
        output_dir = "output"
        os.makedirs(output_dir, exist_ok=True)
        
        # Define output file path
        output_file = os.path.join(output_dir, "output.wav")
        
        logger.info(f"Synthesizing speech for text: '{input_text[:50]}...'")
        
        # Synthesize speech with optimized settings for speed and quality
        tts_model.tts_to_file(
            text=input_text, 
            file_path=output_file,
            speaker_wav=None,  # Use default voice
            split_sentences=True,  # Split long text into sentences
            use_cuda=False  # Force CPU
        )
        
        logger.info(f"Speech synthesized successfully. Saved to: {output_file}")
        
        # Return the audio file
        return FileResponse(
            path=output_file,
            media_type="audio/wav",
            filename="output.wav"
        )
        
    except Exception as e:
        logger.error(f"Error synthesizing speech: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error synthesizing speech: {str(e)}")

@app.get("/news-sources")
async def get_news_sources():
    """Get available news sources"""
    return {
        "sources": NEWS_SOURCES,
        "total": len(NEWS_SOURCES)
    }

if __name__ == "__main__":
    uvicorn.run(
        "main_news:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
