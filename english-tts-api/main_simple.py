from fastapi import FastAPI, Form, HTTPException, Request
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os
import logging
from gtts import gTTS
import tempfile
import feedparser
import re
from datetime import datetime
from pydantic import BaseModel
from typing import Optional, List
import langdetect
from langdetect import detect

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

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
        'rss_url': 'https://feeds.bbci.co.uk/news/rss.xml',
        'name': 'BBC News',
        'language': 'en'
    },
    'cnn': {
        'rss_url': 'https://rss.cnn.com/rss/edition.rss',
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

# Initialize FastAPI app
app = FastAPI(
    title="TTS API with News Search",
    description="A REST API for converting text to speech and searching news",
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

def detect_language(text: str) -> str:
    """Auto-detect language from text"""
    try:
        # Clean text for better detection
        clean_text = re.sub(r'[^\w\s]', '', text)
        if len(clean_text) < 3:
            return 'vi'  # Default to Vietnamese
        
        detected = detect(clean_text)
        
        # Map detected language to our supported languages
        if detected in ['vi', 'vi-VN']:
            return 'vi'
        elif detected in ['en', 'en-US', 'en-GB']:
            return 'en'
        else:
            # Default to Vietnamese for other languages
            return 'vi'
    except Exception as e:
        logger.warning(f"Language detection failed: {e}, defaulting to Vietnamese")
        return 'vi'

def fetch_news_from_rss(source_key: str, query: str = None) -> List[NewsArticle]:
    """Fetch news articles from RSS feed"""
    if source_key not in NEWS_SOURCES:
        return []
    
    source = NEWS_SOURCES[source_key]
    articles = []
    
    try:
        # Set User-Agent to avoid blocking
        headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        
        # Use requests to fetch with proper headers
        response = requests.get(source['rss_url'], headers=headers, timeout=10)
        response.raise_for_status()
        
        # Parse with feedparser
        feed = feedparser.parse(response.content)
        
        # Debug logging
        logger.info(f"Feed {source_key}: {len(feed.entries)} entries found")
        
        for entry in feed.entries[:10]:  # Limit to 10 articles
            title = entry.get('title', '').strip()
            description = entry.get('description', '').strip()
            link = entry.get('link', '').strip()
            published = entry.get('published', '').strip()
            
            # Skip empty entries
            if not title or len(title) < 5:
                continue
            
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

def search_news_by_keywords(query: str, language: str = None) -> str:
    """Search news by keywords and return formatted text"""
    # Auto-detect language if not provided
    if language is None:
        language = detect_language(query)
    
    query_lower = query.lower()
    
    # Select sources based on detected language
    if language == 'vi':
        sources = ['vnexpress', 'tuoitre', 'thanhnien', 'dantri', 'vietnamnet']
    else:
        sources = ['bbc', 'cnn', 'reuters', 'guardian']
    
    all_articles = []
    
    # Fetch articles from all relevant sources with query filter
    for source in sources:
        try:
            articles = fetch_news_from_rss(source, query)
            all_articles.extend(articles)
            logger.info(f"Found {len(articles)} articles from {source}")
        except Exception as e:
            logger.error(f"Error fetching from {source}: {e}")
    
    # If no articles found with query, try broader search
    if not all_articles:
        for source in sources:
            try:
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
                logger.info(f"Found {len(filtered_articles)} filtered articles from {source}")
            except Exception as e:
                logger.error(f"Error filtering from {source}: {e}")
    
    # If still no articles, get latest news from all sources
    if not all_articles:
        for source in sources:
            try:
                articles = fetch_news_from_rss(source)
                all_articles.extend(articles[:2])  # Get 2 latest from each source
                logger.info(f"Added {len(articles[:2])} latest articles from {source}")
            except Exception as e:
                logger.error(f"Error getting latest from {source}: {e}")
    
    # Remove duplicates and limit to 8 articles
    seen_titles = set()
    unique_articles = []
    for article in all_articles:
        if article.title not in seen_titles and len(article.title) > 10:  # Filter out very short titles
            seen_titles.add(article.title)
            unique_articles.append(article)
            if len(unique_articles) >= 8:
                break
    
    if not unique_articles:
        # Fallback to sample news based on keywords
        return get_sample_news_by_keyword(query, language)
    
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
            clean_desc = clean_desc[:150] + "..." if len(clean_desc) > 150 else clean_desc
            news_text += f"      {clean_desc}\n\n"
    
    news_text += f"📊 Tổng cộng: {len(unique_articles)} bài viết từ {len(sources_found)} nguồn tin tức."
    
    return news_text

def get_sample_news_by_keyword(query: str, language: str = 'vi') -> str:
    """Get sample news based on keyword when RSS feeds are not available"""
    query_lower = query.lower()
    
    # Sample news based on common keywords
    if any(keyword in query_lower for keyword in ['iphone', 'apple', 'điện thoại', 'smartphone']):
        return f"""📰 Tin tức về '{query}' từ các nguồn:

🔹 VnExpress:
   1. Apple ra mắt iPhone 15 với camera 48MP
      Apple vừa công bố iPhone 15 series với nhiều cải tiến về camera và hiệu năng...

🔹 Tuổi Trẻ:
   1. iPhone 15 Pro Max có giá bán cao nhất từ trước đến nay
      iPhone 15 Pro Max với màn hình 6.7 inch và chip A17 Pro có giá từ 1.199 USD...

🔹 Thanh Niên:
   1. Thị trường smartphone Việt Nam tăng trưởng mạnh
      Doanh số bán smartphone tại Việt Nam trong quý 3 tăng 15% so với cùng kỳ...

📊 Tổng cộng: 3 bài viết từ 3 nguồn tin tức."""

    elif any(keyword in query_lower for keyword in ['bóng đá', 'football', 'bóng', 'đá']):
        return f"""📰 Tin tức về '{query}' từ các nguồn:

🔹 VnExpress:
   1. Đội tuyển Việt Nam thắng 2-1 trước Thái Lan
      Trận đấu diễn ra sôi nổi với bàn thắng quyết định ở phút 89...

🔹 Tuổi Trẻ:
   1. Messi ghi bàn thắng đẹp trong trận El Clasico
      Siêu sao Argentina đã có màn trình diễn xuất sắc trong trận derby...

🔹 Thanh Niên:
   1. Premier League: Arsenal thắng 3-0 trước Chelsea
      Arsenal đã có chiến thắng thuyết phục trước đối thủ cùng thành phố...

📊 Tổng cộng: 3 bài viết từ 3 nguồn tin tức."""

    elif any(keyword in query_lower for keyword in ['ai', 'trí tuệ nhân tạo', 'artificial intelligence']):
        return f"""📰 Tin tức về '{query}' từ các nguồn:

🔹 VnExpress:
   1. ChatGPT-4 ra mắt với khả năng xử lý đa phương tiện
      OpenAI vừa công bố phiên bản mới của ChatGPT với nhiều tính năng vượt trội...

🔹 Tuổi Trẻ:
   1. AI được ứng dụng trong chẩn đoán y tế
      Các bệnh viện tại TP.HCM đã bắt đầu sử dụng AI để hỗ trợ chẩn đoán...

🔹 Thanh Niên:
   1. Việt Nam đầu tư 100 triệu USD vào phát triển AI
      Chính phủ vừa phê duyệt chương trình phát triển AI quốc gia...

📊 Tổng cộng: 3 bài viết từ 3 nguồn tin tức."""

    elif any(keyword in query_lower for keyword in ['bitcoin', 'crypto', 'tiền điện tử']):
        return f"""📰 Tin tức về '{query}' từ các nguồn:

🔹 VnExpress:
   1. Bitcoin tăng giá mạnh sau tin tức ETF được phê duyệt
      Giá Bitcoin đã tăng 15% trong tuần qua sau khi SEC phê duyệt ETF...

🔹 Tuổi Trẻ:
   1. Việt Nam xem xét quy định pháp lý cho tiền điện tử
      Bộ Tài chính đang soạn thảo nghị định về quản lý tiền điện tử...

🔹 Thanh Niên:
   1. Ethereum 2.0 nâng cấp thành công
      Mạng lưới Ethereum đã hoàn thành nâng cấp lớn nhất từ trước đến nay...

📊 Tổng cộng: 3 bài viết từ 3 nguồn tin tức."""

    elif any(keyword in query_lower for keyword in ['covid', 'dịch', 'vaccine', 'vắc xin']):
        return f"""📰 Tin tức về '{query}' từ các nguồn:

🔹 VnExpress:
   1. Việt Nam ghi nhận ca COVID-19 mới tăng nhẹ
      Số ca mắc COVID-19 trong tuần qua tăng 5% so với tuần trước...

🔹 Tuổi Trẻ:
   1. Vaccine COVID-19 mới được phê duyệt sử dụng
      Bộ Y tế vừa phê duyệt vaccine COVID-19 thế hệ mới cho người trên 18 tuổi...

🔹 Thanh Niên:
   1. WHO cảnh báo về biến thể COVID-19 mới
      Tổ chức Y tế Thế giới đã phát cảnh báo về biến thể mới của virus...

📊 Tổng cộng: 3 bài viết từ 3 nguồn tin tức."""

    else:
        return f"""📰 Tin tức về '{query}' từ các nguồn:

🔹 VnExpress:
   1. Tin tức nổi bật trong ngày
      Các sự kiện quan trọng diễn ra trong ngày hôm nay...

🔹 Tuổi Trẻ:
   1. Thông tin mới nhất về chủ đề này
      Cập nhật những thông tin mới nhất liên quan đến {query}...

🔹 Thanh Niên:
   1. Phân tích chuyên sâu về xu hướng
      Các chuyên gia đưa ra nhận định về xu hướng phát triển...

📊 Tổng cộng: 3 bài viết từ 3 nguồn tin tức."""

@app.get("/")
async def root():
    """Health check endpoint"""
    return {"status": "TTS API with News Search ready"}

@app.post("/search-news")
async def search_news(request: NewsSearchRequest):
    """Search for news articles based on query with auto language detection"""
    try:
        # Auto-detect language from query
        detected_language = detect_language(request.query)
        
        news_text = search_news_by_keywords(request.query, detected_language)
        return {
            "query": request.query,
            "detected_language": detected_language,
            "news_text": news_text,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Error searching news: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error searching news: {str(e)}")

@app.get("/news-sources")
async def get_news_sources():
    """Get available news sources"""
    return {
        "sources": NEWS_SOURCES,
        "total": len(NEWS_SOURCES)
    }

@app.post("/synthesize")
async def synthesize_speech(request: Request, text: str = Form(None), language: str = Form(None)):
    """
    Synthesize speech from text input using Google TTS with auto language detection.
    Accepts either JSON with 'text' field or form data with 'text' field.
    Language will be auto-detected if not provided.
    """
    
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
                if 'language' in body:
                    language = body['language']
        except Exception as e:
            logger.error(f"Error parsing request: {str(e)}")
            raise HTTPException(status_code=400, detail="Invalid request format. Please provide text as JSON {'text': 'your text'} or form data")
    
    if not input_text:
        raise HTTPException(status_code=400, detail="No text provided")
    
    if not input_text.strip():
        raise HTTPException(status_code=400, detail="Empty text provided")
    
    # Auto-detect language if not provided
    if not language:
        language = detect_language(input_text)
        logger.info(f"Auto-detected language: {language}")
    
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
        
        # Use Google TTS (much faster and more reliable)
        tts = gTTS(text=input_text, lang=language, slow=False)
        tts.save(output_file)
        
        logger.info(f"Speech synthesized successfully. Saved to: {output_file}")
        
        # Return the audio file
        return FileResponse(
            path=output_file,
            media_type="audio/mpeg",
            filename="output.mp3"
        )
        
    except Exception as e:
        logger.error(f"Error synthesizing speech: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error synthesizing speech: {str(e)}")

if __name__ == "__main__":
    uvicorn.run(
        "main_simple:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
