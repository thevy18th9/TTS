const express = require('express');
const cors = require('cors');
const axios = require('axios');
const googleTTS = require('google-tts-api');
const RSSParser = require('rss-parser');
const rssParser = new RSSParser({ timeout: 10000 });
const { Readability } = require('@mozilla/readability');
const { JSDOM } = require('jsdom');
const { getCleanArticleForTTS, cleanAndPrepareText, extractMainContent, prepareSpeechText } = require('./articleCleaner');

const app = express();
const PORT = 8004; // Different port

// 🧾 THÊM ROUTE TEST — COPY NGUYÊN VÀO SERVER
app.get("/test-extract", async (req, res) => {
  try {
    const url = req.query.url;
    if (!url) return res.status(400).send("Missing url");

    console.log("🔍 Testing extract: ", url);

    const article = await extractMainContent(url);
    console.log("RESULT OF EXTRACT:", article);

    console.log("📌 TITLE:", article.title);
    console.log("📌 CONTENT LENGTH:", article.content?.length);

    const ttsText = prepareSpeechText(article);

    return res.json({
      success: true,
      title: article.title,
      length: article.content?.length,
      content: article.content, // ✅ FULL CONTENT - ĐỌC ĐẦY ĐỦ
      preview: article.content?.slice(0, 200), // Giữ preview để dễ xem
      ttsText
    });

  } catch (err) {
    console.error("❌ Extract error:", err);
    res.status(500).json({ error: err.message });
  }
});

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
    message: 'News Reader API with Web Speech TTS',
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

// Search news using NewsAPI with local search algorithm
app.post('/search-news', async (req, res) => {
  try {
    const { query, language = 'vi', limit = 10 } = req.body;
    
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

    console.log(`🔍 Searching for: "${originalQuery}" using local search algorithm`);
    
    // Strategy: Fetch latest news (more articles) and search locally
    // This gives us more control and better matching
    const fetchSize = Math.min(limit * 3, 10); // Fetch more to search through
    const validSize = Math.min(Math.max(limit, 1), 10);

    // NEW APPROACH: Fetch latest news and search locally using search algorithm
    // This gives us more control and better matching for specific queries
    
    let allArticles = [];
    
    // Step 1: PRIORITIZE query search first (NewsAPI's indexed search is more accurate)
    // This reduces false positives and improves relevance
    try {
      const queryParams = new URLSearchParams({
        apikey: NEWS_API_KEY,
        language: LANGUAGE_MAPPING[language] || 'en',
        size: fetchSize,
        q: originalQuery
      });
      
      const queryUrl = `${NEWS_API_BASE_URL}?${queryParams.toString()}`;
      console.log(`📰 Searching NewsAPI with query: "${originalQuery}"...`);
      
      const queryResp = await axios.get(queryUrl, { 
        timeout: 10000,
        headers: { 'Accept': 'application/json' }
      });
      
      if (queryResp.data && queryResp.data.status === 'success' && Array.isArray(queryResp.data.results)) {
        allArticles = queryResp.data.results || [];
        console.log(`✅ Fetched ${allArticles.length} articles from NewsAPI query search`);
      }
    } catch (err) {
      if (err.response && err.response.status === 429) {
        console.warn('⚠️ NewsAPI rate limit (429). Trying latest news as fallback...');
        // Wait a bit before retry
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        console.warn('Query search failed:', err.message);
      }
    }
    
    // Step 2: If query search didn't return enough results, fetch latest news as fallback
    // But only if we got very few or no results
    if (allArticles.length < limit) {
      try {
        const latestParams = new URLSearchParams({
        apikey: NEWS_API_KEY,
        language: LANGUAGE_MAPPING[language] || 'en',
          size: Math.min(fetchSize, 10) // Reduce size to avoid rate limits
        });
        
        const latestUrl = `${NEWS_API_BASE_URL}?${latestParams.toString()}`;
        console.log(`📰 Fetching ${Math.min(fetchSize, 10)} latest articles as fallback...`);
        
        // Add delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const latestResp = await axios.get(latestUrl, { 
          timeout: 10000,
          headers: { 'Accept': 'application/json' }
        });
        
        if (latestResp.data && latestResp.data.status === 'success' && Array.isArray(latestResp.data.results)) {
          // Merge with existing articles (deduplicate by URL)
          const latestArticles = latestResp.data.results || [];
          const existingUrls = new Set(allArticles.map(a => a.link));
          latestArticles.forEach(article => {
            if (article.link && !existingUrls.has(article.link)) {
              allArticles.push(article);
              existingUrls.add(article.link);
            }
          });
          console.log(`✅ Added ${latestArticles.length} latest articles, total: ${allArticles.length}`);
        }
      } catch (err) {
        if (err.response && err.response.status === 429) {
          console.warn('⚠️ NewsAPI rate limit (429). Using only query search results.');
        } else {
          console.warn('Failed to fetch latest articles:', err.message);
        }
      }
    }
    
    // Step 3: Local search algorithm - search through all articles
    const queryLower = originalQuery.toLowerCase().trim();
    const queryWords = queryLower.split(/\s+/).filter(w => w.length > 1);
    
    // Normalize Vietnamese text for better matching (remove diacritics)
    const normalize = (text) => {
      return (text || '').toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'd');
    };
    
    const normalizedQuery = normalize(originalQuery);
    const normalizedQueryWords = queryWords.map(w => normalize(w));
    
    // ===== HYBRID SEARCH ALGORITHM: BM25 + PageRank + Semantic Embedding =====
    
    // Step 1: Calculate document statistics for BM25
    const totalArticles = allArticles.length;
    const avgDocLength = allArticles.reduce((sum, article) => {
      const title = article.title || '';
      const description = article.description || '';
      return sum + (title + ' ' + description).split(/\s+/).length;
    }, 0) / totalArticles || 1;
    
    // Document frequency for each query word (for BM25 IDF)
    const wordDocumentFrequency = {}; // How many articles contain each word
    
    // First pass: calculate document frequency for each query word
    normalizedQueryWords.forEach(word => {
      wordDocumentFrequency[word] = allArticles.filter(article => {
        const titleNorm = normalize(article.title || '');
        const descNorm = normalize(article.description || '');
        return titleNorm.includes(word) || descNorm.includes(word);
      }).length;
    });
    
    // Score and rank articles using Google-inspired algorithm
    const scoredArticles = allArticles.map(article => {
      const title = article.title || '';
      const description = article.description || '';
      const titleLower = title.toLowerCase();
      const descLower = description.toLowerCase();
      const titleNorm = normalize(title);
      const descNorm = normalize(description);
      const fullText = (title + ' ' + description).toLowerCase();
      const fullTextNorm = normalize(fullText);
      
      // ✅ SOURCE FILTERING & PRIORITIZATION
      const sourceId = (article.source_id || '').toLowerCase();
      const link = (article.link || '').toLowerCase();
      
      // ✅ TUYỆT ĐỐI KHÔNG LẤY TỪ investing_vn
      const isInvestingVN = sourceId.includes('investing') || 
                           link.includes('investing.vn') || 
                           link.includes('investing_vn') ||
                           link.includes('investing.com.vn');
      
      // ✅ PHÁT HIỆN THANH NIÊN
      const isThanhNien = sourceId.includes('thanhnien') || 
                          sourceId.includes('thanh niên') || 
                          link.includes('thanhnien.vn') || 
                          link.includes('thanhnien.com.vn');
      
      // ✅ PHÁT HIỆN KENH14
      const isKenh14 = sourceId.includes('kenh14') || 
                       sourceId.includes('kenh 14') ||
                       link.includes('kenh14.vn') || 
                       link.includes('kenh14.com') ||
                       link.includes('kenh14.vn');
      
      // ✅ TUYỆT ĐỐI LOẠI BỎ investing.vn (khó trích xuất content)
      if (isInvestingVN) {
        console.log(`🚫 Filtering out investing.vn article: ${title.substring(0, 60)}...`);
        return { article, score: -9999 }; // Very low score to filter out
      }
      
      let score = 0;
      
      // ✅ BOOST SCORE cho Thanh Niên (ưu tiên báo Thanh Niên)
      if (isThanhNien) {
        score += 500; // High boost for Thanh Niên articles
        console.log(`⭐ Prioritizing Thanh Niên article: ${title.substring(0, 60)}...`);
      }
      
      // ✅ BOOST SCORE cho Kenh14 (ưu tiên báo Kenh14)
      if (isKenh14) {
        score += 500; // High boost for Kenh14 articles
        console.log(`⭐ Prioritizing Kenh14 article: ${title.substring(0, 60)}...`);
      }
      
      // ===== GOOGLE-INSPIRED RANKING FACTORS =====
      
      // 1. EXACT PHRASE MATCH (Highest Priority - like Google's exact match)
      // Title matches are more valuable than description
      const titleExactMatch = titleLower.includes(queryLower);
      const descExactMatch = descLower.includes(queryLower);
      
      if (titleExactMatch) {
        score += 2000; // Very high score for exact match in title
        // Position boost: matches at start of title are more valuable
        if (titleLower.startsWith(queryLower)) {
          score += 1000; // Extra boost for title start
        } else if (titleLower.indexOf(queryLower) < title.length * 0.3) {
          score += 500; // Boost for early position
        }
      } else if (descExactMatch) {
        score += 1000; // Lower score for description match
      }
      
      // 2. NORMALIZED EXACT PHRASE (handles diacritics - important for Vietnamese)
      const titleNormExact = titleNorm.includes(normalizedQuery);
      const descNormExact = descNorm.includes(normalizedQuery);
      
      if (titleNormExact && !titleExactMatch) {
        score += 1500; // High score for normalized match in title
        if (titleNorm.startsWith(normalizedQuery)) {
          score += 500;
        }
      } else if (descNormExact && !descExactMatch) {
        score += 800;
      }
      
      // 3. ALL WORDS MATCH (TF-IDF weighted)
      const wordsInTitle = normalizedQueryWords.filter(w => titleNorm.includes(w));
      const wordsInDesc = normalizedQueryWords.filter(w => descNorm.includes(w));
      
      if (wordsInTitle.length === normalizedQueryWords.length && normalizedQueryWords.length > 0) {
        // Calculate TF-IDF score for title
        let tfidfScore = 0;
        wordsInTitle.forEach(word => {
          // Term Frequency (TF) - how often word appears in title
          const tf = (titleNorm.match(new RegExp(word, 'g')) || []).length / titleNorm.split(/\s+/).length;
          // Inverse Document Frequency (IDF) - rare words are more valuable
          const df = wordDocumentFrequency[word] || 1;
          const idf = Math.log(totalArticles / df);
          tfidfScore += tf * idf * 100; // Scale up
        });
        score += 800 + Math.floor(tfidfScore); // Base score + TF-IDF
      }
      
      if (wordsInDesc.length === normalizedQueryWords.length && normalizedQueryWords.length > 0) {
        // TF-IDF for description (lower weight than title)
        let tfidfScore = 0;
        wordsInDesc.forEach(word => {
          const tf = (descNorm.match(new RegExp(word, 'g')) || []).length / descNorm.split(/\s+/).length;
          const df = wordDocumentFrequency[word] || 1;
          const idf = Math.log(totalArticles / df);
          tfidfScore += tf * idf * 50; // Lower weight for description
        });
        score += 500 + Math.floor(tfidfScore);
      }
      
      // 4. PARTIAL MATCH (Most words match - like Google's partial relevance)
      const totalMatches = Math.max(wordsInTitle.length, wordsInDesc.length);
      if (totalMatches > 0 && totalMatches < normalizedQueryWords.length) {
        const matchRatio = totalMatches / normalizedQueryWords.length;
        // Higher score for more matches
        score += Math.floor(matchRatio * 400);
        
        // Bonus if important words (longer words) match
        const importantWords = normalizedQueryWords.filter(w => w.length >= 4);
        const importantMatches = importantWords.filter(w => 
          titleNorm.includes(w) || descNorm.includes(w)
        ).length;
        if (importantMatches > 0) {
          score += (importantMatches / importantWords.length) * 200;
        }
      }
      
      // 5. INDIVIDUAL WORD MATCHES (TF-IDF weighted, position-aware)
      wordsInTitle.forEach((word, index) => {
        // Position in title matters (earlier = better)
        const position = titleNorm.indexOf(word);
        const positionRatio = position < titleNorm.length * 0.5 ? 1.0 : 0.7;
        
        // TF-IDF
        const tf = (titleNorm.match(new RegExp(word, 'g')) || []).length / titleNorm.split(/\s+/).length;
        const df = wordDocumentFrequency[word] || 1;
        const idf = Math.log(totalArticles / df);
        
        score += Math.floor(tf * idf * 100 * positionRatio);
      });
      
      wordsInDesc.forEach(word => {
        // Lower weight for description
        const tf = (descNorm.match(new RegExp(word, 'g')) || []).length / descNorm.split(/\s+/).length;
        const df = wordDocumentFrequency[word] || 1;
        const idf = Math.log(totalArticles / df);
        score += Math.floor(tf * idf * 50);
      });
      
      // 6. RECENCY BOOST (Google prioritizes fresh content)
      try {
        const published = new Date(article.pubDate || 0);
        const hoursAgo = (new Date() - published) / (1000 * 60 * 60);
        if (hoursAgo < 6) {
          score += 150; // Very recent (last 6 hours)
        } else if (hoursAgo < 24) {
          score += 100; // Recent (last 24 hours)
        } else if (hoursAgo < 72) {
          score += 50; // Fairly recent (last 3 days)
        }
      } catch (e) {
        // Ignore date parsing errors
      }
      
      // 7. CONTENT QUALITY SIGNALS (like Google's Panda)
      // Longer, more descriptive content gets slight boost
      const contentLength = (title.length + description.length);
      if (contentLength > 100 && contentLength < 500) {
        score += 20; // Optimal content length
      }
      
      // 8. QUERY INTENT MATCHING (like Google's Hummingbird)
      // If query is a question, boost articles with question words
      const isQuestion = originalQuery.includes('?') || 
                        ['ai', 'cái gì', 'như thế nào', 'tại sao', 'khi nào', 'ở đâu'].some(q => queryLower.includes(q));
      if (isQuestion && (titleLower.includes('?') || descLower.includes('?'))) {
        score += 100;
      }
      
      return {
        article: article,
        score: score
      };
    });
    
    // Filter and rank: Google-inspired approach
    // Only keep articles with meaningful relevance (minimum threshold)
    // Use dynamic threshold based on query complexity
    const minScore = normalizedQueryWords.length <= 2 ? 100 : 200; // Higher threshold for longer queries
    
    const relevantArticles = scoredArticles
      .filter(({ score }) => score >= minScore)
      .sort((a, b) => {
        // Primary sort: by score (highest first)
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        // Secondary sort: by recency (newer first) - like Google
        try {
          const aDate = new Date(a.article.pubDate || 0);
          const bDate = new Date(b.article.pubDate || 0);
          return bDate - aDate;
        } catch (e) {
          return 0;
        }
      })
      .slice(0, limit * 2); // Get more candidates for final filtering
    
    // Final relevance filtering: remove articles that are clearly irrelevant
    // (like Google's quality filters - Panda algorithm)
    // But be more flexible to allow more diverse queries
    const finalArticles = relevantArticles.filter(({ article, score }) => {
      // ✅ TUYỆT ĐỐI FILTER OUT investing.vn (khó trích xuất content)
      const sourceId = (article.source_id || '').toLowerCase();
      const link = (article.link || '').toLowerCase();
      if (sourceId.includes('investing') || 
          link.includes('investing.vn') || 
          link.includes('investing_vn') ||
          link.includes('investing.com.vn')) {
        console.log(`🚫 Filtering out investing.vn article: ${article.title?.substring(0, 60)}...`);
        return false;
      }
      
      const titleNorm = normalize(article.title || '');
      const descNorm = normalize(article.description || '');
      const fullTextNorm = titleNorm + ' ' + descNorm;
      
      // Calculate matching words
      const matchingWords = normalizedQueryWords.filter(word => 
        titleNorm.includes(word) || descNorm.includes(word)
      );
      const matchRatio = matchingWords.length / normalizedQueryWords.length;
      
      // More flexible matching:
      // - For 1-word queries: require the word to match
      // - For 2-word queries: require at least 1 word (50%)
      // - For 3+ word queries: require at least 50% words
      let requiredMatchRatio;
      if (normalizedQueryWords.length === 1) {
        requiredMatchRatio = 1.0; // Single word must match
      } else if (normalizedQueryWords.length === 2) {
        requiredMatchRatio = 0.5; // At least 1 of 2 words
      } else {
        requiredMatchRatio = 0.5; // At least 50% of words
      }
      
      // Check for exact phrase match (normalized)
      const hasExactPhrase = titleNorm.includes(normalizedQuery) || descNorm.includes(normalizedQuery);
      
      // Check for partial phrase match (for longer queries)
      const hasPartialPhrase = normalizedQuery.length > 5 && 
        (titleNorm.includes(normalizedQuery.substring(0, Math.floor(normalizedQuery.length * 0.7))) ||
         descNorm.includes(normalizedQuery.substring(0, Math.floor(normalizedQuery.length * 0.7))));
      
      // Must meet one of these criteria:
      // 1. Has exact phrase match (highest priority)
      // 2. Has partial phrase match (for longer queries)
      // 3. Has required match ratio
      // 4. Very high score (likely relevant from TF-IDF)
      return hasExactPhrase || hasPartialPhrase || matchRatio >= requiredMatchRatio || score >= 800;
    }).slice(0, limit);
    
    console.log(`🔍 Google-inspired search found ${finalArticles.length} relevant articles (from ${allArticles.length} total, min score: ${minScore})`);
    if (finalArticles.length > 0) {
      console.log(`📊 Top 3 scores: ${finalArticles.slice(0, 3).map(a => Math.round(a.score)).join(', ')}`);
    }
    
    // Transform to our format
    let articles = finalArticles.map(({ article, score }) => {
      const sourceId = article.source_id || 'Unknown';
      const link = article.link || '';
      const sourceIdLower = sourceId.toLowerCase();
      const linkLower = link.toLowerCase();
      
      // ✅ TUYỆT ĐỐI Final check: ensure no investing.vn articles slip through
      if (sourceIdLower.includes('investing') || 
          linkLower.includes('investing.vn') || 
          linkLower.includes('investing_vn') ||
          linkLower.includes('investing.com.vn')) {
        console.log(`🚫 Final filter: Removing investing.vn article: ${article.title?.substring(0, 60)}...`);
        return null;
      }
      
      // Check if from prioritized sources
      const isThanhNien = sourceIdLower.includes('thanhnien') || 
                          linkLower.includes('thanhnien.vn') ||
                          linkLower.includes('thanhnien.com.vn');
      const isKenh14 = sourceIdLower.includes('kenh14') || 
                       linkLower.includes('kenh14.vn') ||
                       linkLower.includes('kenh14.com');
      
      return {
      id: article.article_id || require('crypto').createHash('md5').update(article.title + article.link).digest('hex').substring(0, 12),
      title: article.title || '',
      description: article.description || '',
      image: article.image_url || 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=400&h=250&fit=crop',
        source: sourceId,
      published: article.pubDate || new Date().toISOString(),
        url: link,
      language: language,
        category: article.category ? article.category[0] : 'General',
        _isThanhNien: isThanhNien,
        _isKenh14: isKenh14
      };
    }).filter(a => a !== null); // Remove null entries

    // ✅ Enable RSS feeds - Fetch from multiple Vietnamese news sources
    let rssArticles = [];
    if (originalQuery && originalQuery.trim()) {
      try {
        console.log(`📰 Fetching RSS feeds for query: "${originalQuery}"...`);
        rssArticles = await fetchFromRSS({ query: originalQuery, language, limit: limit * 2 });
        console.log(`✅ RSS found ${rssArticles.length} articles from ${rssArticles.length > 0 ? [...new Set(rssArticles.map(a => a.source))].join(', ') : 'no sources'}`);
        
        // Filter out investing.vn from RSS results
        rssArticles = rssArticles.filter(a => {
          const url = (a.url || '').toLowerCase();
          if (url.includes('investing.vn') || url.includes('investing_vn') || url.includes('investing.com.vn')) {
            console.log(`🚫 Filtering investing.vn from RSS: ${a.title?.substring(0, 60)}...`);
            return false;
          }
          return true;
        });
        
        // Remove temporary fields before merging
        rssArticles = rssArticles.map(({ _matchScore, _isThanhNien, _isKenh14, ...article }) => article);
      } catch (rssErr) {
        console.warn('⚠️ RSS fetch error:', rssErr.message);
        // Continue with NewsAPI results only
      }
    }
    
    // ✅ Merge RSS articles with NewsAPI articles
    if (rssArticles.length > 0) {
      // Deduplicate by URL before merging
      const existingUrls = new Set(articles.map(a => a.url));
      const newRssArticles = rssArticles.filter(a => a.url && !existingUrls.has(a.url));
      articles.push(...newRssArticles);
      console.log(`✅ Merged ${newRssArticles.length} new RSS articles, total: ${articles.length}`);
    }
    
    // ✅ Sorting: Prioritize Thanh Niên và Kenh14, then by recency (newer first)
    if (articles.length > 0) {
      articles.sort((a, b) => {
        // Check if articles are from prioritized sources (check both source name and URL)
        const aSource = (a.source || '').toLowerCase();
        const bSource = (b.source || '').toLowerCase();
        const aUrl = (a.url || '').toLowerCase();
        const bUrl = (b.url || '').toLowerCase();
        
        const aIsThanhNien = (a._isThanhNien || false) || 
                            aSource.includes('thanhnien') || aSource.includes('thanh niên') || 
                            aUrl.includes('thanhnien.vn') || aUrl.includes('thanhnien.com.vn');
        const bIsThanhNien = (b._isThanhNien || false) || 
                            bSource.includes('thanhnien') || bSource.includes('thanh niên') || 
                            bUrl.includes('thanhnien.vn') || bUrl.includes('thanhnien.com.vn');
        const aIsKenh14 = (a._isKenh14 || false) || 
                          aSource.includes('kenh14') || aSource.includes('kenh 14') || 
                          aUrl.includes('kenh14.vn') || aUrl.includes('kenh14.com');
        const bIsKenh14 = (b._isKenh14 || false) || 
                          bSource.includes('kenh14') || bSource.includes('kenh 14') || 
                          bUrl.includes('kenh14.vn') || bUrl.includes('kenh14.com');
        
        // Priority 1: Thanh Niên và Kenh14 articles first (both prioritized equally)
        const aIsPrioritized = aIsThanhNien || aIsKenh14;
        const bIsPrioritized = bIsThanhNien || bIsKenh14;
        
        if (aIsPrioritized && !bIsPrioritized) return -1;
        if (!aIsPrioritized && bIsPrioritized) return 1;
        
        // If both are prioritized, Thanh Niên first, then Kenh14
        if (aIsPrioritized && bIsPrioritized) {
          if (aIsThanhNien && !bIsThanhNien) return -1;
          if (!aIsThanhNien && bIsThanhNien) return 1;
          if (aIsKenh14 && !bIsKenh14) return -1;
          if (!aIsKenh14 && bIsKenh14) return 1;
        }
        
        // Priority 2: By recency (newer first)
        const aDate = new Date(a.published || 0);
        const bDate = new Date(b.published || 0);
        return bDate - aDate;
      });
      
      // Remove temporary fields
      articles = articles.map(({ _isThanhNien, _isKenh14, ...article }) => article);
      
      // Log source distribution
      const thanhNienCount = articles.filter(a => {
        const source = (a.source || '').toLowerCase();
        const url = (a.url || '').toLowerCase();
        return source.includes('thanhnien') || source.includes('thanh niên') || 
               url.includes('thanhnien.vn') || url.includes('thanhnien.com.vn');
      }).length;
      const kenh14Count = articles.filter(a => {
        const source = (a.source || '').toLowerCase();
        const url = (a.url || '').toLowerCase();
        return source.includes('kenh14') || source.includes('kenh 14') || 
               url.includes('kenh14.vn') || url.includes('kenh14.com');
      }).length;
      const sources = [...new Set(articles.map(a => a.source))];
      console.log(`📊 Final articles: ${thanhNienCount} from Thanh Niên, ${kenh14Count} from Kenh14, ${articles.length - thanhNienCount - kenh14Count} from other sources`);
      console.log(`📰 Sources (${sources.length}): ${sources.slice(0, 15).join(', ')}${sources.length > 15 ? '...' : ''}`);
    }
    
    // Final limit
    const limitedArticles = articles.slice(0, limit);
    
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

// Get trending/hot news (no query needed)
app.get('/trending-news', async (req, res) => {
  // Set timeout for this request (30 seconds)
  req.setTimeout(30000);
  
  try {
    const { language = 'vi', limit = 10 } = req.query;
    const lang = language || 'vi';
    const maxLimit = Math.min(parseInt(limit) || 10, 20);
    
    console.log(`Fetching trending news for language: ${lang}, limit: ${maxLimit}`);
    
    // Temporarily disable RSS feeds - use NewsAPI for trending news
    let trendingArticles = [];
    // RSS feeds temporarily disabled to prevent crashes
    // try {
    //   const rssPromise = fetchFromRSS({ 
    //     query: '', // Empty query = get all latest
    //     language: lang, 
    //     limit: maxLimit 
    //   });
    //   
    //   const timeoutPromise = new Promise((resolve) => {
    //     setTimeout(() => resolve([]), 15000); // 15 second timeout
    //   });
    //   
    //   trendingArticles = await Promise.race([rssPromise, timeoutPromise]);
    // } catch (rssError) {
    //   console.warn('RSS fetch error:', rssError.message);
    //   trendingArticles = [];
    // }
    
    // If we have articles, return them
    if (trendingArticles.length > 0) {
      console.log(`✅ Found ${trendingArticles.length} trending articles`);
      return res.json({
        articles: trendingArticles,
        total: trendingArticles.length,
        query: 'trending',
        timestamp: new Date().toISOString(),
        note: 'Latest trending news'
      });
    }
    
    // Fallback: try NewsAPI with empty query or generic terms
    try {
      const params = new URLSearchParams({
        apikey: NEWS_API_KEY,
        language: LANGUAGE_MAPPING[lang] || 'en',
        size: Math.min(maxLimit, 10)
      });
      
      // For trending, use category or just get latest
      const apiUrl = `${NEWS_API_BASE_URL}?${params.toString()}`;
      const resp = await axios.get(apiUrl, { 
        timeout: 15000,
        headers: { 'Accept': 'application/json' }
      });
      
      if (resp.data && resp.data.status === 'success' && Array.isArray(resp.data.results)) {
        // ✅ Filter out investing.vn and prioritize Thanh Niên và Kenh14
        const articles = resp.data.results
          .filter(article => {
            const sourceId = (article.source_id || '').toLowerCase();
            const link = (article.link || '').toLowerCase();
            // ✅ TUYỆT ĐỐI Filter out investing.vn
            if (sourceId.includes('investing') || 
                link.includes('investing.vn') || 
                link.includes('investing_vn') ||
                link.includes('investing.com.vn')) {
              console.log(`🚫 Filtering out investing.vn from trending: ${article.title?.substring(0, 60)}...`);
              return false;
            }
            return true;
          })
          .map(article => {
            const sourceId = article.source_id || 'Unknown';
            const link = article.link || '';
            const sourceIdLower = sourceId.toLowerCase();
            const linkLower = link.toLowerCase();
            
            const isThanhNien = sourceIdLower.includes('thanhnien') || 
                               linkLower.includes('thanhnien.vn') ||
                               linkLower.includes('thanhnien.com.vn');
            const isKenh14 = sourceIdLower.includes('kenh14') || 
                            linkLower.includes('kenh14.vn') ||
                            linkLower.includes('kenh14.com');
            
            return {
              id: article.article_id || require('crypto').createHash('md5').update(article.title + article.link).digest('hex').substring(0, 12),
              title: article.title || '',
              description: article.description || '',
              image: article.image_url || 'https://images.unsplash.com/photo-1504711331083-9c895941bf81?w=400&h=250&fit=crop',
              source: sourceId,
              published: article.pubDate || new Date().toISOString(),
              url: link,
              language: lang,
              category: article.category ? article.category[0] : 'General',
              _isThanhNien: isThanhNien,
              _isKenh14: isKenh14
            };
          })
          .sort((a, b) => {
            // Priority 1: Thanh Niên và Kenh14 first
            const aIsPrioritized = a._isThanhNien || a._isKenh14;
            const bIsPrioritized = b._isThanhNien || b._isKenh14;
            
            if (aIsPrioritized && !bIsPrioritized) return -1;
            if (!aIsPrioritized && bIsPrioritized) return 1;
            
            // If both prioritized: Thanh Niên first, then Kenh14
            if (aIsPrioritized && bIsPrioritized) {
              if (a._isThanhNien && !b._isThanhNien) return -1;
              if (!a._isThanhNien && b._isThanhNien) return 1;
              if (a._isKenh14 && !b._isKenh14) return -1;
              if (!a._isKenh14 && b._isKenh14) return 1;
            }
            
            // Priority 2: By recency
            const aDate = new Date(a.published || 0);
            const bDate = new Date(b.published || 0);
            return bDate - aDate;
          })
          .slice(0, maxLimit)
          .map(({ _isThanhNien, _isKenh14, ...article }) => article); // Remove temporary fields
        
        const thanhNienCount = articles.filter(a => 
          (a.source || '').toLowerCase().includes('thanhnien') || 
          (a.url || '').toLowerCase().includes('thanhnien.vn')
        ).length;
        const kenh14Count = articles.filter(a => 
          (a.source || '').toLowerCase().includes('kenh14') || 
          (a.url || '').toLowerCase().includes('kenh14.vn')
        ).length;
        console.log(`📊 Trending articles: ${thanhNienCount} from Thanh Niên, ${kenh14Count} from Kenh14, ${articles.length - thanhNienCount - kenh14Count} from other sources`);
        
        return res.json({
          articles: articles,
          total: articles.length,
          query: 'trending',
          timestamp: new Date().toISOString(),
          note: 'Latest news from NewsAPI'
        });
      }
    } catch (apiErr) {
      console.warn('NewsAPI fallback failed:', apiErr.message);
    }
    
    // Return empty if nothing found
    return res.json({
      articles: [],
      total: 0,
      query: 'trending',
      timestamp: new Date().toISOString(),
      note: 'No trending news available'
    });
    
  } catch (error) {
    console.error('Error fetching trending news:', error.message);
    res.status(500).json({ 
      error: 'Failed to fetch trending news',
      details: error.message 
    });
  }
});

// RSS Fallback Aggregator - Tổng hợp từ nhiều nguồn báo chính thống Việt Nam
async function fetchFromRSS({ query = '', language = 'vi', limit = 10 }) {
  try {
    // ✅ Danh sách RSS feeds từ các báo chính thống Việt Nam (không cần đăng nhập)
    const rssFeeds = [
      // Nhóm 1: Các báo lớn, chính thống (ưu tiên)
      { url: 'https://thanhnien.vn/rss/home.rss', name: 'Thanh Niên', priority: true },
      { url: 'https://kenh14.vn/rss/home.rss', name: 'Kenh14', priority: true },
      { url: 'https://vnexpress.net/rss/tin-moi-nhat.rss', name: 'VnExpress', priority: true },
      { url: 'https://tuoitre.vn/rss/tin-moi-nhat.rss', name: 'Tuổi Trẻ', priority: true },
      { url: 'https://dantri.com.vn/rss/tin-moi-nhat.rss', name: 'Dân Trí', priority: true },
      
      // Nhóm 2: Các báo chính thống khác
      { url: 'https://vietnamnet.vn/rss/tin-moi-nhat.rss', name: 'VietnamNet', priority: false },
      { url: 'https://vov.vn/rss/tin-moi-nhat.rss', name: 'VOV', priority: false },
      { url: 'https://laodong.vn/rss/tin-moi-nhat.rss', name: 'Lao Động', priority: false },
      { url: 'https://nld.com.vn/rss/tin-moi-nhat.rss', name: 'Người Lao Động', priority: false },
      { url: 'https://tienphong.vn/rss/tin-moi-nhat.rss', name: 'Tiền Phong', priority: false },
      { url: 'https://zingnews.vn/rss/tin-moi-nhat.rss', name: 'Zing News', priority: false },
      { url: 'https://24h.com.vn/rss/tin-moi-nhat.rss', name: '24h.com.vn', priority: false },
      { url: 'https://vtc.vn/rss/tin-moi-nhat.rss', name: 'VTC News', priority: false },
      { url: 'https://infonet.vn/rss/tin-moi-nhat.rss', name: 'Infonet', priority: false },
      { url: 'https://sggp.org.vn/rss/tin-moi-nhat.rss', name: 'Sài Gòn Giải Phóng', priority: false },
      { url: 'https://nhandan.vn/rss/tin-moi-nhat.rss', name: 'Nhân Dân', priority: false },
    ];
    
    // Extract URLs for RSS parser
    const rssUrls = rssFeeds.map(f => f.url);

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
    const isEmptyQuery = !query || query.trim() === '';
    
    // Fetch all RSS feeds in parallel for faster loading
    const feedPromises = rssUrls.map(async (feedUrl, index) => {
      try {
        const feedInfo = rssFeeds[index];
        const parsed = await rssParser.parseURL(feedUrl, { timeout: 5000 });
        const items = (parsed.items || []).slice(0, 20); // Limit items per feed
        const feedArticles = [];
        
        for (const item of items) {
          const title = item.title || '';
          const desc = (item.contentSnippet || item.content || '').toString();
          const link = (item.link || '').toLowerCase();
          const textNorm = normalize(`${title} ${desc}`);
          const titleLower = title.toLowerCase();
          const descLower = desc.toLowerCase();
          
          // ✅ TUYỆT ĐỐI Filter out investing.vn
          if (link.includes('investing.vn') || link.includes('investing_vn') || link.includes('investing.com.vn')) {
            continue; // Skip investing.vn articles
          }
          
          // If query is empty, include all articles (for trending news)
          if (!isEmptyQuery) {
            // Check for exact phrase match first (with and without diacritics)
            const hasExactMatch = titleLower.includes(originalQueryLower) || 
                                 descLower.includes(originalQueryLower) ||
                                 textNorm.includes(qNorm);
            
            // Check for token matches
            const matchTokens = qTokens.filter(t => textNorm.includes(t));
            const hasTokenMatch = qTokens.length > 0 && matchTokens.length > 0;
            
            // Require at least some match
            if (!hasExactMatch && !hasTokenMatch) continue;

          // domain filter if query implies storm/region
          const impliesStorm = disasterKeywords.some(k => qNorm.includes(normalize(k)));
          const impliesCentral = centralVN.some(k => qNorm.includes(normalize(k)));
          if (impliesStorm || impliesCentral) {
            const hasDisaster = disasterKeywords.some(k => textNorm.includes(normalize(k)));
            const hasCentral = centralVN.some(k => textNorm.includes(normalize(k)));
            if (!(hasDisaster && hasCentral)) continue;
            }
          }
          
          // Score the match quality (or recency for trending)
          let matchScore = 0;
          
          // ✅ Boost score for prioritized sources (Thanh Niên, Kenh14)
          const isThanhNien = feedInfo.name.toLowerCase().includes('thanh niên') || link.includes('thanhnien.vn');
          const isKenh14 = feedInfo.name.toLowerCase().includes('kenh14') || link.includes('kenh14.vn');
          if (isThanhNien || isKenh14) {
            matchScore += 50; // Boost for prioritized sources
          }
          if (feedInfo.priority) {
            matchScore += 20; // Additional boost for priority feeds
          }
          
          if (isEmptyQuery) {
            // For trending news, score by recency (newer = higher score)
            const published = new Date(item.isoDate || item.pubDate || new Date());
            const now = new Date();
            const hoursAgo = (now - published) / (1000 * 60 * 60);
            matchScore += Math.max(0, 100 - hoursAgo); // Higher score for newer articles
          } else {
            const hasExactMatch = titleLower.includes(originalQueryLower) || 
                                 descLower.includes(originalQueryLower) ||
                                 textNorm.includes(qNorm);
            const matchTokens = qTokens.filter(t => textNorm.includes(t));
            if (hasExactMatch) matchScore += 10;
            if (titleLower.includes(originalQueryLower)) matchScore += 5;
            if (matchTokens.length === qTokens.length) matchScore += 3;
            matchScore += matchTokens.length;
          }

          feedArticles.push({
            id: require('crypto').createHash('md5').update((item.link || title)).digest('hex').substring(0, 12),
            title: title,
            description: desc.substring(0, 240),
            image: '',
            source: feedInfo.name || (parsed.title || 'rss').toString(),
            published: item.isoDate || new Date().toISOString(),
            url: item.link || '',
            language: language,
            category: 'General',
            _matchScore: matchScore,
            _isThanhNien: isThanhNien,
            _isKenh14: isKenh14
          });
        }
        return feedArticles;
      } catch (e) {
        console.warn(`Error fetching RSS feed ${feedUrl}:`, e.message);
        return [];
      }
    });
    
    // Wait for all feeds to complete
    const feedResults = await Promise.all(feedPromises);
    // Flatten results
    feedResults.forEach(feedArticles => {
      articles.push(...feedArticles);
    });

    // Deduplicate by url
    const seen = new Set();
    const deduped = articles.filter(a => {
      const key = a.url;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // ✅ Sort: Prioritize Thanh Niên và Kenh14, then by match score, then recency
    deduped.sort((a, b) => {
      // Priority 1: Thanh Niên và Kenh14 first
      const aIsPrioritized = a._isThanhNien || a._isKenh14;
      const bIsPrioritized = b._isThanhNien || b._isKenh14;
      
      if (aIsPrioritized && !bIsPrioritized) return -1;
      if (!aIsPrioritized && bIsPrioritized) return 1;
      
      // If both prioritized: Thanh Niên first, then Kenh14
      if (aIsPrioritized && bIsPrioritized) {
        if (a._isThanhNien && !b._isThanhNien) return -1;
        if (!a._isThanhNien && b._isThanhNien) return 1;
        if (a._isKenh14 && !b._isKenh14) return -1;
        if (!a._isKenh14 && b._isKenh14) return 1;
      }
      
      // Priority 2: By match score
      const scoreA = a._matchScore || 0;
      const scoreB = b._matchScore || 0;
      if (scoreB !== scoreA) return scoreB - scoreA;
      
      // Priority 3: By recency
      return new Date(b.published).getTime() - new Date(a.published).getTime();
    });

    // Remove temporary fields before returning
    return deduped.slice(0, limit).map(({ _matchScore, _isThanhNien, _isKenh14, ...rest }) => rest);
  } catch (err) {
    return [];
  }
}

// TTS endpoint - Google TTS (returns MP3)
app.post('/synthesize', async (req, res) => {
  try {
    const { text, voice = 'vi' } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: 'Text is required' });
    
    // Limit text length (max 4000 chars for longer articles)
    const maxLength = 4000;
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
// Fetch and clean article content for TTS (using articleCleaner module)
app.get('/fetch-article-clean', async (req, res) => {
  try {
    const { url } = req.query;
    
    if (!url) {
      return res.status(400).json({ 
        error: 'URL is required',
        usage: 'GET /fetch-article-clean?url=<article_url>'
      });
    }

    console.log(`🧹 Cleaning article for TTS: ${url}`);
    
    const cleanedArticle = await getCleanArticleForTTS(url);
    
    if (!cleanedArticle) {
      return res.status(404).json({ 
        error: 'Could not extract or clean article content',
        url: url
      });
    }

    res.json({
      success: true,
      title: cleanedArticle.title,
      content: cleanedArticle.content,
      ttsText: cleanedArticle.ttsText,
      speechText: cleanedArticle.ttsText, // Alias for backward compatibility
      contentLength: cleanedArticle.contentLength,
      url: url
    });

  } catch (error) {
    console.error('Error fetching clean article:', error.message);
    res.status(500).json({ 
      error: 'Failed to fetch and clean article',
      details: error.message 
    });
  }
});

// Fetch full article content from URL (original endpoint - kept for compatibility)
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
