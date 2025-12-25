const express = require('express');
const cors = require('cors');
const axios = require('axios');
const xml2js = require('xml2js');

const app = express();
const PORT = 8001;

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
    message: 'Smart News Reader AI API',
    version: '1.0.0',
    endpoints: {
      'GET /health': 'Health check',
      'POST /search-news': 'Search news articles',
      'POST /synthesize': 'Text-to-speech (mock)',
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

// TTS endpoint - using Web Speech API simulation
app.post('/synthesize', (req, res) => {
  try {
    const { text, voice = 'vi-female' } = req.body;
    
    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: 'Text is required' });
    }
    
    console.log(`TTS request: "${text.substring(0, 50)}..." with voice: ${voice}`);
    
    // Simulate TTS processing time
    const processingTime = Math.min(text.length * 10, 2000); // Max 2 seconds
    
    setTimeout(() => {
      // Create a mock audio URL that frontend can use
      const audioId = require('crypto').createHash('md5').update(text + voice).digest('hex').substring(0, 12);
      const mockAudioUrl = `http://localhost:8001/audio/${audioId}`;
      
      res.json({
        success: true,
        audioUrl: mockAudioUrl,
        duration: Math.ceil(text.length / 10), // Estimate duration
        voice: voice,
        text: text,
        timestamp: new Date().toISOString()
      });
    }, processingTime);
    
  } catch (error) {
    console.error('TTS error:', error.message);
    res.status(500).json({ 
      error: 'TTS synthesis failed',
      details: error.message 
    });
  }
});

// Mock audio endpoint - serves a simple beep sound
app.get('/audio/:audioId', (req, res) => {
  const { audioId } = req.params;
  
  // Create a simple audio file (1 second of silence with a beep)
  const fs = require('fs');
  const path = require('path');
  
  // Create a simple WAV file (1 second, 44.1kHz, 16-bit, mono)
  const sampleRate = 44100;
  const duration = 1; // 1 second
  const numSamples = sampleRate * duration;
  const buffer = Buffer.alloc(44 + numSamples * 2); // WAV header + samples
  
  // WAV header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + numSamples * 2, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // Mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(numSamples * 2, 40);
  
  // Generate a simple tone (440Hz A note)
  const frequency = 440;
  for (let i = 0; i < numSamples; i++) {
    const sample = Math.sin(2 * Math.PI * frequency * i / sampleRate) * 0.3;
    const sample16 = Math.round(sample * 32767);
    buffer.writeInt16LE(sample16, 44 + i * 2);
  }
  
  res.set({
    'Content-Type': 'audio/wav',
    'Content-Length': buffer.length,
    'Cache-Control': 'public, max-age=3600'
  });
  
  res.send(buffer);
});

// Mock STT endpoint
app.post('/stt', (req, res) => {
  res.json({ message: 'STT not implemented yet' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
