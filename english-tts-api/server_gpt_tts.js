const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = 8003; // Different port

// Middleware
app.use(cors());
app.use(express.json());

// OpenAI API configuration
const OPENAI_API_KEY = 'sk-135f171d166587f6fadee2742914d8e716ad6c08dd03e51e'; // Your API key
const OPENAI_API_BASE_URL = 'https://api.openai.com/v1';

// NewsAPI configuration
const NEWS_API_KEY = 'pub_37a7b73799e8418989078b2b13cc815c';
const NEWS_API_BASE_URL = 'https://newsdata.io/api/1/news';

// Language mapping for NewsAPI
const LANGUAGE_MAPPING = {
  'vi': 'vi',
  'en': 'en', 
  'zh': 'zh'
};

// Voice mapping for OpenAI TTS
const VOICE_MAPPING = {
  'vi-female': 'nova',     // Nova voice for Vietnamese
  'vi-male': 'onyx',       // Onyx voice for Vietnamese
  'en-female': 'nova',     // Nova voice for English
  'en-male': 'onyx',       // Onyx voice for English
  'zh-female': 'nova',     // Nova voice for Chinese
  'zh-male': 'onyx'        // Onyx voice for Chinese
};

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Smart News Reader AI API with GPT-4o-mini TTS',
    version: '3.0.0',
    endpoints: {
      'GET /health': 'Health check',
      'POST /search-news': 'Search news articles',
      'POST /synthesize': 'Text-to-speech with GPT-4o-mini',
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
    
    // Build NewsAPI URL
    const params = new URLSearchParams({
      apikey: NEWS_API_KEY,
      language: LANGUAGE_MAPPING[language] || 'en',
      size: Math.min(limit, 50) // NewsAPI max is 50
    });
    
    // Add query if provided - use more flexible search
    if (query && query.trim()) {
      // Clean and optimize query for better results
      const cleanQuery = query.trim()
        .replace(/[^\w\s\u00C0-\u1EF9]/g, '') // Remove special chars but keep Vietnamese
        .replace(/\s+/g, ' ') // Replace multiple spaces with single space
        .substring(0, 100); // Limit query length
      
      if (cleanQuery.length > 0) {
        params.append('q', cleanQuery);
      }
    }
    
    const apiUrl = `${NEWS_API_BASE_URL}?${params.toString()}`;
    console.log(`Calling NewsAPI: ${apiUrl}`);
    
    // Fetch from NewsAPI
    let response, data;
    
    try {
      response = await axios.get(apiUrl);
      data = response.data;
      
      if (data.status !== 'success') {
        throw new Error(`NewsAPI error: ${data.status}`);
      }
    } catch (error) {
      console.error('NewsAPI request failed:', error.message);
      // Return empty results if API fails
      return res.json({
        articles: [],
        total: 0,
        query: query,
        timestamp: new Date().toISOString(),
        error: 'NewsAPI temporarily unavailable'
      });
    }
    
    // Transform NewsAPI response to our format
    const articles = (data.results || []).map(article => ({
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
    
    // If no results with query, try without query to get latest news
    if (articles.length === 0 && query && query.trim()) {
      console.log('No results with query, trying without query...');
      
      const fallbackParams = new URLSearchParams({
        apikey: NEWS_API_KEY,
        language: LANGUAGE_MAPPING[language] || 'en',
        size: Math.min(limit, 50)
      });
      
      const fallbackUrl = `${NEWS_API_BASE_URL}?${fallbackParams.toString()}`;
      
      try {
        const fallbackResponse = await axios.get(fallbackUrl);
        const fallbackData = fallbackResponse.data;
        
        if (fallbackData.status === 'success' && fallbackData.results) {
          const fallbackArticles = fallbackData.results.map(article => ({
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
          
          const limitedFallback = fallbackArticles.slice(0, limit);
          console.log(`Found ${limitedFallback.length} fallback articles`);
          
          return res.json({
            articles: limitedFallback,
            total: limitedFallback.length,
            query: query,
            timestamp: new Date().toISOString(),
            note: 'Showing latest news (no results for your query)'
          });
        }
      } catch (fallbackError) {
        console.error('Fallback request failed:', fallbackError.message);
      }
    }
    
    // Limit results
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

// TTS endpoint using OpenAI GPT-4o-mini TTS
app.post('/synthesize', async (req, res) => {
  try {
    const { text, voice = 'vi-female' } = req.body;
    
    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: 'Text is required' });
    }
    
    console.log(`TTS request: "${text.substring(0, 50)}..." with voice: ${voice}`);
    
    // Get voice from mapping
    const openaiVoice = VOICE_MAPPING[voice] || VOICE_MAPPING['vi-female'];
    
    // OpenAI TTS API endpoint
    const openaiUrl = `${OPENAI_API_BASE_URL}/audio/speech`;
    
    // Request payload for OpenAI TTS
    const payload = {
      model: "tts-1", // Use tts-1 model (faster and cheaper)
      input: text,
      voice: openaiVoice,
      response_format: "mp3",
      speed: 1.0
    };
    
    try {
      // Call OpenAI TTS API
      const response = await axios.post(openaiUrl, payload, {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        responseType: 'arraybuffer'
      });
      
      // Get audio data
      const audioBuffer = Buffer.from(response.data);
      
      // Set response headers
      res.set({
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.length,
        'Cache-Control': 'public, max-age=3600'
      });
      
      // Send audio data directly
      res.send(audioBuffer);
      
      console.log(`TTS completed for voice: ${voice}, audio size: ${audioBuffer.length} bytes`);
      
    } catch (openaiError) {
      const errorData = openaiError.response?.data;
      let errorMessage = 'OpenAI TTS API failed';
      
      if (errorData) {
        try {
          const errorText = typeof errorData === 'string' ? errorData : JSON.stringify(errorData);
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error?.message || errorJson.message || errorMessage;
        } catch (parseError) {
          errorMessage = typeof errorData === 'string' ? errorData : JSON.stringify(errorData);
        }
      }
      
      console.error('OpenAI TTS API error:', errorMessage);
      
      // Return error response
      return res.status(500).json({
        success: false,
        error: 'OpenAI TTS API failed',
        details: errorMessage,
        voice: voice,
        text: text,
        timestamp: new Date().toISOString()
      });
    }
    
  } catch (error) {
    console.error('TTS error:', error.message);
    res.status(500).json({ 
      error: 'TTS synthesis failed',
      details: error.message 
    });
  }
});

// Mock STT endpoint
app.post('/stt', (req, res) => {
  res.json({ message: 'STT not implemented yet' });
});

app.listen(PORT, () => {
  console.log(`GPT-4o-mini TTS Server running on http://localhost:${PORT}`);
  console.log(`OpenAI API Key: ${OPENAI_API_KEY.substring(0, 10)}...`);
});
