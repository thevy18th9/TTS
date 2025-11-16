#!/usr/bin/env python3

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import feedparser
import hashlib
from datetime import datetime
from typing import List, Dict, Any
import re

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.post("/search-news")
async def search_news(request: dict):
    """Search news from RSS feeds"""
    query = request.get("query", "")
    language = request.get("language", "vi")
    limit = request.get("limit", 10)
    
    # News sources
    sources = {
        "vi": [
            {"name": "VnExpress", "url": "https://vnexpress.net/rss"},
            {"name": "Tuổi Trẻ", "url": "https://tuoitre.vn/rss"},
        ],
        "en": [
            {"name": "BBC News", "url": "https://feeds.bbci.co.uk/news/rss.xml"},
            {"name": "CNN", "url": "http://rss.cnn.com/rss/edition.rss"},
        ]
    }
    
    all_articles = []
    
    for source in sources.get(language, sources["vi"]):
        try:
            feed = feedparser.parse(source["url"])
            
            for entry in feed.entries[:5]:
                title = entry.get('title', '').strip()
                description = entry.get('description', '').strip()
                link = entry.get('link', '')
                
                # Extract image
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
                    "published": datetime.now().isoformat(),
                    "url": link,
                    "language": language,
                    "category": "General"
                }
                
                # Filter by query
                if query:
                    query_lower = query.lower()
                    if (query_lower in title.lower() or 
                        query_lower in description.lower()):
                        all_articles.append(article)
                else:
                    all_articles.append(article)
                    
        except Exception as e:
            print(f"Error fetching from {source['name']}: {e}")
    
    # Limit results
    limited_articles = all_articles[:limit]
    
    return {
        "articles": limited_articles,
        "total": len(limited_articles),
        "query": query,
        "timestamp": datetime.now().isoformat()
    }

@app.post("/synthesize")
async def synthesize():
    return {"message": "TTS not implemented"}

@app.post("/stt")
async def stt():
    return {"message": "STT not implemented"}

if __name__ == "__main__":
    print("Starting server on http://localhost:8001")
    uvicorn.run(app, host="0.0.0.0", port=8001)
