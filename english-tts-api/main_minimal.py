from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import logging
import feedparser
import asyncio
from datetime import datetime
from pydantic import BaseModel
from typing import List, Dict, Any
import hashlib
import re

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Smart News Reader AI",
    description="AI-powered multilingual news reader",
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

# News sources
NEWS_SOURCES = {
    "vi": [
        {"name": "VnExpress", "url": "https://vnexpress.net/rss"},
        {"name": "Tuổi Trẻ", "url": "https://tuoitre.vn/rss"},
    ],
    "en": [
        {"name": "BBC News", "url": "https://feeds.bbci.co.uk/news/rss.xml"},
        {"name": "CNN", "url": "http://rss.cnn.com/rss/edition.rss"},
    ],
    "zh": [
        {"name": "BBC Chinese", "url": "https://www.bbc.com/zhongwen/simp/rss.xml"},
    ]
}

class SearchRequest(BaseModel):
    query: str
    language: str = "vi"
    limit: int = 10

class SearchResponse(BaseModel):
    articles: List[Dict[str, Any]]
    total: int
    query: str
    timestamp: str

async def fetch_news_from_source(source: Dict[str, Any], query: str = "") -> List[Dict[str, Any]]:
    """Fetch news from a single RSS source"""
    articles = []
    
    try:
        feed = feedparser.parse(source["url"])
        
        for entry in feed.entries[:5]:  # Limit to 5 articles per source
            title = entry.get('title', '').strip()
            description = entry.get('description', '').strip()
            link = entry.get('link', '')
            published = entry.get('published_parsed', None)
            
            if published:
                published_date = datetime(*published[:6])
            else:
                published_date = datetime.now()
            
            # Extract image from content
            image_url = ""
            if hasattr(entry, 'content'):
                for content in entry.content:
                    if content.type == 'text/html':
                        img_match = re.search(r'<img[^>]+src="([^"]+)"', content.value)
                        if img_match:
                            image_url = img_match.group(1)
                            break
            
            if not image_url:
                image_url = "https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=400&h=250&fit=crop"
            
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
async def synthesize_speech():
    """Mock TTS endpoint"""
    return {"message": "TTS not implemented yet"}

@app.post("/stt")
async def speech_to_text():
    """Mock STT endpoint"""
    return {"message": "STT not implemented yet"}

if __name__ == "__main__":
    uvicorn.run(
        "main_minimal:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
