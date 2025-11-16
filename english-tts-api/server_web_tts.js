const express = require('express');
const cors = require('cors');
const axios = require('axios');
const googleTTS = require('google-tts-api');
const RSSParser = require('rss-parser');
const rssParser = new RSSParser({ timeout: 10000 });
const { Readability } = require('@mozilla/readability');
const { JSDOM } = require('jsdom');

const app = express();
const PORT = 8004; // Different port

// Middleware
app.use(cors());
app.use(express.json());

// NewsAPI configuration
const NEWS_API_KEY = 'pub_37a7b73799e8418989078b2b13cc815c';
const NEWS_API_BASE_URL = 'https://newsdata.io/api/1/news';

// Language mapping for NewsAPI
const LANGUAGE_MAPPING = {
  'vi': 'vi',
  'en': 'en', 
  'zh': 'zh'
};

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Smart News Reader AI API with Web Speech TTS',
    version: '4.0.0',
    endpoints: {
      'GET /health': 'Health check',
      'POST /search-news': 'Search news articles',
      'POST /synthesize': 'Text-to-speech with Web Speech API',
      'POST /stt': 'Speech-to-text (mock)'
    }
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Search news using NewsAPI
app.post('/search-news', async (req, res) => {
  try {
    const { query, language = 'vi', limit = 10 } = req.body;
    
    console.log(`Searching news for query: "${query}" in language: ${language}`);
    
    // Use original query exactly as provided - don't modify it
    const originalQuery = query ? query.trim() : '';
    
    if (!originalQuery) {
      return res.status(400).json({ 
        error: 'Query is required',
        articles: [],
        total: 0,
        query: '',
        timestamp: new Date().toISOString()
      });
    }

    // Build API request with exact query (URL encode properly)
    // NewsAPI size must be between 1-10 for free tier, max 50 for paid
    const validSize = Math.min(Math.max(limit, 1), 10); // Use valid size (1-10)
    
    const params = new URLSearchParams({
      apikey: NEWS_API_KEY,
      language: LANGUAGE_MAPPING[language] || 'en',
      size: validSize
    });
    
    // Add query parameter - NewsAPI expects 'q' parameter
    if (originalQuery) {
      params.append('q', originalQuery);
    }
    
    const apiUrl = `${NEWS_API_BASE_URL}?${params.toString()}`;
    console.log(`Calling NewsAPI with query: "${originalQuery}"`);
    console.log(`API URL: ${apiUrl.replace(NEWS_API_KEY, 'API_KEY_HIDDEN')}`);
    
    let response, data;
    try {
      const resp = await axios.get(apiUrl, { 
        timeout: 15000,
        headers: {
          'Accept': 'application/json'
        }
      });
      
      console.log(`NewsAPI response status: ${resp.status}`);
      console.log(`NewsAPI response data keys:`, Object.keys(resp.data || {}));
      
        if (resp.data && resp.data.status === 'success' && Array.isArray(resp.data.results)) {
          data = resp.data;
          response = resp;
        console.log(`✅ Found ${data.results.length} results for query: "${originalQuery}"`);
        
        // Log first few titles for debugging
        if (data.results.length > 0) {
          console.log(`Sample titles:`, data.results.slice(0, 3).map(r => r.title));
        }
      } else {
        console.warn(`⚠️ NewsAPI returned status: ${resp.data?.status}, results: ${resp.data?.results?.length || 0}`);
        console.warn(`Response:`, JSON.stringify(resp.data).substring(0, 200));
        data = { results: [] };
        }
      } catch (err) {
      console.error(`❌ NewsAPI error for query "${originalQuery}":`, err.message);
      if (err.response) {
        console.error(`Response status: ${err.response.status}`);
        console.error(`Response data:`, err.response.data);
      }
      data = { results: [] };
    }

    if (!data) {
      // try RSS aggregator fallback
      const rssArticles = await fetchFromRSS({ query, language, limit });
      return res.json({
        articles: rssArticles,
        total: rssArticles.length,
        query,
        timestamp: new Date().toISOString(),
        note: 'Results from RSS fallback'
      });
    }
    
    // Transform NewsAPI response to our format
    let articles = (data.results || []).map(article => ({
      id: article.article_id || require('crypto').createHash('md5').update(article.title + article.link).digest('hex').substring(0, 12),
      title: article.title || '',
      description: article.description || '',
      image: article.image_url || 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=400&h=250&fit=crop',
      source: article.source_id || 'Unknown',
      published: article.pubDate || new Date().toISOString(),
      url: article.link || '',
      language: language,
      category: article.category ? article.category[0] : 'General'
    }));

    // Always try RSS in parallel for better results, especially for Vietnamese
    let rssArticles = [];
    if (originalQuery && originalQuery.trim()) {
      try {
        rssArticles = await fetchFromRSS({ query: originalQuery, language, limit: limit * 2 });
        console.log(`RSS found ${rssArticles.length} articles for query: "${originalQuery}"`);
      } catch (rssErr) {
        console.warn('RSS fetch error:', rssErr.message);
      }
    }
    
    // Sort NewsAPI articles by relevance to query
    if (query && query.trim() && articles.length > 0) {
      const normalize = (s) => (s || '')
        .toString()
        .toLowerCase()
        .normalize('NFKD')
        .replace(/\p{Diacritic}+/gu, '');
      
      const originalQueryNorm = normalize(originalQuery);
      const queryTokens = originalQueryNorm.split(/\s+/).filter(t => t.length > 1);
      
      const scoreArticle = (a) => {
        const hayTitle = normalize(a.title);
        const hayDesc = normalize(a.description);
        let score = 0;
        
        // Exact phrase match (case-insensitive) gets highest priority
        if (hayTitle.includes(originalQueryNorm)) score += 50;
        if (hayDesc.includes(originalQueryNorm)) score += 25;
        
        // Also check original query (with diacritics) for Vietnamese
        if (a.title.toLowerCase().includes(originalQuery.toLowerCase())) score += 40;
        if (a.description.toLowerCase().includes(originalQuery.toLowerCase())) score += 20;
        
        // Token-based scoring
        const titleTokens = queryTokens.filter(t => hayTitle.includes(t));
        const descTokens = queryTokens.filter(t => hayDesc.includes(t));
        
        // Bonus if all tokens found in title
        if (titleTokens.length === queryTokens.length && queryTokens.length > 0) score += 30;
        // Bonus if all tokens found in description
        if (descTokens.length === queryTokens.length && queryTokens.length > 0) score += 15;
        
        // Individual token matches
        score += titleTokens.length * 5;
        score += descTokens.length * 2;
        
        return score;
      };

      // Score and sort NewsAPI articles
      articles = articles
        .map(a => ({ ...a, _score: scoreArticle(a), _source: 'newsapi' }))
        .sort((a, b) => {
          if (b._score !== a._score) return b._score - a._score;
          return new Date(b.published) - new Date(a.published);
        })
        .map(({ _score, _source, ...rest }) => rest);
      
      console.log(`✅ Sorted ${articles.length} NewsAPI articles by relevance`);
    }
    
    // Combine and prioritize: RSS articles first (usually better match for Vietnamese), then NewsAPI
    let allArticles = [];
    
    // Add RSS articles first (they usually match better for Vietnamese queries)
    if (rssArticles.length > 0) {
      allArticles = [...rssArticles];
      console.log(`Using ${rssArticles.length} RSS articles (better match for Vietnamese)`);
    }
    
    // Add NewsAPI articles that aren't duplicates
    const rssUrls = new Set(rssArticles.map(a => a.url));
    const uniqueNewsAPI = articles.filter(a => !rssUrls.has(a.url));
    allArticles = [...allArticles, ...uniqueNewsAPI];
    
    // If we have good RSS results, prefer them; otherwise use all
    if (rssArticles.length >= 3) {
      // If RSS has good results, use RSS + unique NewsAPI
      articles = allArticles.slice(0, limit);
    } else if (articles.length > 0) {
      // Use NewsAPI results if RSS doesn't have enough
      articles = articles.slice(0, limit);
    } else {
      // Use whatever we have
      articles = allArticles.slice(0, limit);
    }
    
    // Final limit
    const limitedArticles = articles.slice(0, limit);
    
    console.log(`Found ${limitedArticles.length} articles`);
    
    res.json({
      articles: limitedArticles,
      total: limitedArticles.length,
      query: query,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error searching news:', error.message);
    res.status(500).json({ 
      error: 'Failed to search news',
      details: error.message 
    });
  }
});

// RSS Fallback Aggregator
async function fetchFromRSS({ query = '', language = 'vi', limit = 10 }) {
  try {
    const rssFeeds = [
      // VnExpress
      'https://vnexpress.net/rss/tin-moi-nhat.rss',
      'https://vnexpress.net/rss/thoi-su.rss',
      // Tuổi Trẻ
      'https://tuoitre.vn/rss/tin-moi-nhat.rss',
      // Thanh Niên
      'https://thanhnien.vn/rss/home.rss',
      // Zing News
      'https://zingnews.vn/rss/tin-moi-nhat.rss',
      // Dân Trí
      'https://dantri.com.vn/rss/tin-moi-nhat.rss'
    ];

    const normalize = (s) => (s || '')
      .toString()
      .toLowerCase()
      .normalize('NFKD')
      .replace(/\p{Diacritic}+/gu, '');

    const disasterKeywords = ['bão','bao','áp thấp','ap thap','mưa bão','mua bao','mưa lớn','mua lon','lũ','lu','lũ quét','lu quet','gió mạnh','gio manh'];
    const centralVN = ['miền trung','mien trung','quảng bình','quang binh','quảng trị','quang tri','thừa thiên huế','thua thien hue','đà nẵng','da nang','quảng nam','quang nam','quảng ngãi','quang ngai','bình định','binh dinh','phú yên','phu yen','khánh hòa','khanh hoa','ninh thuận','ninh thuan'];

    const qNorm = normalize(query);
    const qTokens = qNorm.split(/\s+/).filter(t => t.length > 1);
    const originalQueryLower = query.toLowerCase();

    const articles = [];
    for (const feed of rssFeeds) {
      try {
        const parsed = await rssParser.parseURL(feed);
        for (const item of parsed.items || []) {
          const title = item.title || '';
          const desc = (item.contentSnippet || item.content || '').toString();
          const textNorm = normalize(`${title} ${desc}`);
          const titleLower = title.toLowerCase();
          const descLower = desc.toLowerCase();
          
          // Check for exact phrase match first (with and without diacritics)
          const hasExactMatch = titleLower.includes(originalQueryLower) || 
                               descLower.includes(originalQueryLower) ||
                               textNorm.includes(qNorm);
          
          // Check for token matches
          const matchTokens = qTokens.filter(t => textNorm.includes(t));
          const hasTokenMatch = qTokens.length > 0 && matchTokens.length > 0;
          
          // Require at least some match
          if (!hasExactMatch && !hasTokenMatch) continue;
          
          // Score the match quality
          let matchScore = 0;
          if (hasExactMatch) matchScore += 10;
          if (titleLower.includes(originalQueryLower)) matchScore += 5;
          if (matchTokens.length === qTokens.length) matchScore += 3;
          matchScore += matchTokens.length;

          // domain filter if query implies storm/region
          const impliesStorm = disasterKeywords.some(k => qNorm.includes(normalize(k)));
          const impliesCentral = centralVN.some(k => qNorm.includes(normalize(k)));
          if (impliesStorm || impliesCentral) {
            const hasDisaster = disasterKeywords.some(k => textNorm.includes(normalize(k)));
            const hasCentral = centralVN.some(k => textNorm.includes(normalize(k)));
            if (!(hasDisaster && hasCentral)) continue;
          }

          articles.push({
            id: require('crypto').createHash('md5').update((item.link || title)).digest('hex').substring(0, 12),
            title: title,
            description: desc.substring(0, 240),
            image: '',
            source: (parsed.title || 'rss').toString(),
            published: item.isoDate || new Date().toISOString(),
            url: item.link || '',
            language: language,
            category: 'General',
            _matchScore: matchScore
          });
        }
      } catch (e) {
        // ignore individual feed errors
      }
    }

    // Deduplicate by url
    const seen = new Set();
    const deduped = articles.filter(a => {
      const key = a.url;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Sort by match score first, then recency
    deduped.sort((a, b) => {
      const scoreA = a._matchScore || 0;
      const scoreB = b._matchScore || 0;
      if (scoreB !== scoreA) return scoreB - scoreA;
      return new Date(b.published).getTime() - new Date(a.published).getTime();
    });

    // Remove _matchScore before returning
    return deduped.slice(0, limit).map(({ _matchScore, ...rest }) => rest);
  } catch (err) {
    return [];
  }
}

// TTS endpoint - Google TTS (returns MP3)
app.post('/synthesize', async (req, res) => {
  try {
    const { text, voice = 'vi' } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: 'Text is required' });
    
    // Limit text length (max 1500 chars to reduce chunks and timeout risk)
    const maxLength = 1500;
    const trimmedText = text.trim().substring(0, maxLength);
    
    // language detection from voice
    const lang = voice.startsWith('zh') ? 'zh-CN' : voice.startsWith('en') ? 'en-US' : 'vi-VN';
    console.log(`TTS (Google) request: lang=${lang}, text length=${trimmedText.length}`);

    // Split text into larger chunks (500 chars) to reduce number of requests
    const parts = trimmedText
      .replace(/\s+/g, ' ')
      .split(/(?<=[.!?…\n])\s+/)
      .reduce((acc, p) => {
        if (p.length <= 500) {
          acc.push(p);
        } else {
          // Split long sentences into 500 char chunks
          for (let i = 0; i < p.length; i += 500) {
            acc.push(p.slice(i, i + 500));
          }
        }
        return acc;
      }, [])
      .filter(Boolean);

    console.log(`Split into ${parts.length} chunks`);

    const urls = parts.map(p => googleTTS.getAudioUrl(p, { lang, slow: false }));

    // Fetch chunks with retry logic and longer timeout
    const fetchWithRetry = async (url, retries = 2) => {
      for (let i = 0; i <= retries; i++) {
        try {
          const response = await axios.get(url, { 
            responseType: 'arraybuffer', 
            timeout: 30000, // 30 second timeout (increased from 10s)
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          });
          return Buffer.from(response.data);
        } catch (err) {
          if (i === retries) {
            console.warn(`Failed to fetch chunk after ${retries + 1} attempts: ${err.message}`);
            return Buffer.alloc(0);
          }
          // Wait before retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
      }
      return Buffer.alloc(0);
    };

    // Fetch all chunks in parallel (but with retry logic)
    const buffers = await Promise.all(urls.map(url => fetchWithRetry(url)));
    
    // Filter out empty buffers and concatenate
    const validBuffers = buffers.filter(b => b.length > 0);
    if (validBuffers.length === 0) {
      throw new Error('Failed to fetch any audio chunks from Google TTS');
    }
    
    // Log success rate
    const successRate = ((validBuffers.length / parts.length) * 100).toFixed(1);
    console.log(`Successfully fetched ${validBuffers.length}/${parts.length} chunks (${successRate}%)`);
    
    const out = Buffer.concat(validBuffers);

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', out.length);
    return res.send(out);
  } catch (error) {
    console.error('Google TTS error:', error.message);
    // Always use Google TTS - return error instead of fallback
    res.status(500).json({ 
      error: 'Failed to generate speech with Google TTS',
      details: error.message 
    });
  }
});

// Fetch full article content - extract only main body content
app.post('/fetch-article', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }
    
    console.log(`Fetching article content from: ${url}`);
    
    try {
      // Fetch the article HTML
      const response = await axios.get(url, {
        timeout: 10000, // 10 second timeout
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      // Use Readability to extract only main content (removes header, footer, sidebar, etc.)
      // Suppress CSS parsing warnings (not critical for content extraction)
      const originalConsoleError = console.error;
      const originalConsoleWarn = console.warn;
      
      console.error = (...args) => {
        const msg = args[0]?.toString() || '';
        if (!msg.includes('Could not parse CSS stylesheet') && 
            !msg.includes('Error loading stylesheet')) {
          originalConsoleError.apply(console, args);
        }
      };
      
      console.warn = (...args) => {
        const msg = args[0]?.toString() || '';
        if (!msg.includes('Could not parse CSS stylesheet') && 
            !msg.includes('Error loading stylesheet')) {
          originalConsoleWarn.apply(console, args);
        }
      };
      
      const dom = new JSDOM(response.data, { 
        url: url,
        resources: 'usable',
        runScripts: 'outside-only',
        virtualConsole: new (require('jsdom').VirtualConsole)().sendTo(console, { omitJSDOMErrors: true })
      });
      
      const reader = new Readability(dom.window.document);
      const article = reader.parse();
      
      // Restore console methods
      console.error = originalConsoleError;
      console.warn = originalConsoleWarn;
      
      let title = '';
      let bodyContent = '';
      
      if (article) {
        // Extract title
        title = (article.title || '').trim();
        
        // Extract only body text content
        if (article.textContent) {
          // Split into sentences and take only meaningful paragraphs
          let text = article.textContent
            .replace(/\s+/g, ' ') // Normalize whitespace
            .trim();
          
          // Remove common noise patterns more aggressively
          const noisePatterns = [
            /đăng ký/gi,
            /đăng nhập/gi,
            /chia sẻ/gi,
            /like\s+fanpage/gi,
            /follow\s+us/gi,
            /subscribe/gi,
            /cookie/gi,
            /privacy\s+policy/gi,
            /terms\s+of\s+service/gi,
            /quảng cáo/gi,
            /advertisement/gi,
            /bình luận/gi,
            /comments?/gi,
            /tin\s+liên\s+quan/gi,
            /bài\s+viết\s+liên\s+quan/gi,
            /related\s+articles?/gi,
            /xem\s+thêm/gi,
            /read\s+more/gi,
            /video\s+liên\s+quan/gi,
            /related\s+videos?/gi
          ];
          
          noisePatterns.forEach(pattern => {
            text = text.replace(pattern, ' ');
          });
          
          // Split into sentences and filter out very short ones (likely noise)
          const sentences = text.split(/[.!?…]\s+/).filter(s => {
            const trimmed = s.trim();
            return trimmed.length > 20 && // At least 20 characters
                   !trimmed.match(/^[A-Z\s]+$/) && // Not all caps (likely headers)
                   !trimmed.match(/^\d+$/); // Not just numbers
          });
          
          // Take first reasonable amount of sentences (body content)
          bodyContent = sentences
            .slice(0, 30) // Limit to first 30 sentences
            .join('. ')
            .replace(/\s+/g, ' ')
            .trim();
          
          console.log(`Extracted title: ${title.length} chars, body: ${bodyContent.length} chars`);
        }
      }
      
      if (!bodyContent) {
        // Fallback: try to find main content areas manually
        const doc = dom.window.document;
        
        // Common article content selectors
        const contentSelectors = [
          'article',
          '[role="article"]',
          '.article-content',
          '.post-content',
          '.entry-content',
          '.content',
          'main article',
          '#main-content',
          '.main-content'
        ];
        
        let mainContent = null;
        for (const selector of contentSelectors) {
          const element = doc.querySelector(selector);
          if (element) {
            mainContent = element;
            break;
          }
        }
        
        if (mainContent) {
          // Remove unwanted elements
          const unwanted = mainContent.querySelectorAll('header, footer, nav, aside, .sidebar, .advertisement, .ad, script, style, .social-share, .comments');
          unwanted.forEach(el => el.remove());
          
          let text = mainContent.textContent
            .replace(/\s+/g, ' ')
            .trim();
          
          // Apply same filtering as above
          const sentences = text.split(/[.!?…]\s+/).filter(s => {
            const trimmed = s.trim();
            return trimmed.length > 20 && 
                   !trimmed.match(/^[A-Z\s]+$/) && 
                   !trimmed.match(/^\d+$/);
          });
          
          bodyContent = sentences
            .slice(0, 30)
            .join('. ')
            .replace(/\s+/g, ' ')
            .trim();
        } else {
          // Last resort: use body but remove header/footer/nav
          const body = doc.body;
          if (body) {
            const unwanted = body.querySelectorAll('header, footer, nav, aside, .sidebar, .advertisement, .ad, script, style');
            unwanted.forEach(el => el.remove());
            
            let text = body.textContent
              .replace(/\s+/g, ' ')
              .trim();
            
            const sentences = text.split(/[.!?…]\s+/).filter(s => {
              const trimmed = s.trim();
              return trimmed.length > 20 && 
                     !trimmed.match(/^[A-Z\s]+$/) && 
                     !trimmed.match(/^\d+$/);
            });
            
            bodyContent = sentences
              .slice(0, 30)
              .join('. ')
              .replace(/\s+/g, ' ')
              .trim();
          }
        }
        
        // If still no body content, use description from article if available
        if (!bodyContent && article && article.excerpt) {
          bodyContent = article.excerpt.trim();
        }
      }
      
      // Final cleanup
      bodyContent = bodyContent
        .replace(/\s+/g, ' ')
        .trim();
      
      // Limit body content length (keep title separate)
      if (bodyContent.length > 3000) {
        bodyContent = bodyContent.substring(0, 3000) + '...';
      }
      
      // Combine title and body (only if we have body)
      const finalContent = bodyContent 
        ? (title ? `${title}. ${bodyContent}` : bodyContent)
        : title || '';
      
      if (!finalContent || finalContent.length < 50) {
        console.warn('Extracted content too short, might not be valid article content');
      }
      
      res.json({
        success: true,
        content: finalContent,
        title: title,
        body: bodyContent,
        url: url,
        length: finalContent.length
      });
      
    } catch (fetchError) {
      console.error('Error fetching article:', fetchError.message);
      res.status(500).json({
        error: 'Failed to fetch article content',
        details: fetchError.message
      });
    }
    
  } catch (error) {
    console.error('Fetch article error:', error.message);
    res.status(500).json({ 
      error: 'Failed to process request',
      details: error.message 
    });
  }
});

// Mock STT endpoint
app.post('/stt', (req, res) => {
  res.json({ message: 'STT not implemented yet' });
});

app.listen(PORT, () => {
  console.log(`Web Speech TTS Server running on http://localhost:${PORT}`);
  console.log('Using browser Web Speech API for TTS');
});
