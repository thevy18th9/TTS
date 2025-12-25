# 📊 TIMELINE - SEQUENCE DIAGRAMS

## 🔍 SD-01: Search News by Text

### Timeline (Chronological order from top to bottom):

| # | Y Position | Message | From | To | Type |
|---|------------|---------|------|-----|------|
| 1 | 180 | Enter search keyword | User | Frontend | Synchronous |
| 2 | 230 | POST /search-news {query, language, limit} | Frontend | Backend | Synchronous |
| 3 | 280 | GET /api/1/news ?apikey=...&q=query&language=vi | Backend | NewsData.io API | Synchronous (External) |
| 4 | 350 | Response: articles[] | NewsData.io API | Backend | Return (External) |
| 5 | 380-420 | Process and sort articles (BM25 algorithm, deduplication) | Backend | Backend | Self-call |
| 6 | 450 | Response: {articles, total, query} | Backend | Frontend | Return |
| 7 | 480-520 | Display news list | Frontend | Frontend | Self-call |
| 8 | 540-580 | (Optional) Auto-read first article | Frontend | Frontend | Self-call (Optional) |

### Activation Boxes (Active period):

- **Frontend**: From message 1 (y=180) to message 8 (y=580) → y: 150-600
- **Backend**: From message 2 (y=230) to message 6 (y=450) → y: 200-600
- **NewsData.io API**: From message 3 (y=280) to message 4 (y=350) → y: 250-450

---

## 🎤 SD-02: Search News by Voice (STT)

### Timeline (Chronological order from top to bottom):

| # | Y Position | Message | From | To | Type |
|---|------------|---------|------|-----|------|
| 1 | 930 | Press microphone button | User | Frontend | Synchronous |
| 2 | 980 | Initialize SpeechRecognition recognition.start() | Frontend | Browser (Web Speech API) | Synchronous |
| 3 | 1000-1020 | Request microphone permission | Browser | Browser | Self-call |
| 4 | 1050 | Speak search keyword | User | Browser | Synchronous |
| 5 | 1080-1100 | Recognize speech (Speech-to-Text) | Browser | Browser | Self-call |
| 6 | 1120 | onresult: text transcript | Browser | Frontend | Callback |
| 7 | 1140-1160 | Display text in search bar | Frontend | Frontend | Self-call |
| 8 | 1180-1200 | Automatically call handleSearch(query) | Frontend | Frontend | Self-call |
| 9 | 1220 | POST /search-news {query, language, limit} | Frontend | Backend | Synchronous |
| 10 | 1250 | GET /api/1/news | Backend | NewsData.io API | Synchronous (External) |
| 11 | 1280 | Response: articles[] | NewsData.io API | Backend | Return (External) |
| 12 | 1310 | Response: {articles, total} | Backend | Frontend | Return |
| 13 | 1330-1350 | Display search results | Frontend | Frontend | Self-call |

### Activation Boxes (Active period):

- **Frontend**: From message 1 (y=930) to message 13 (y=1350) → y: 100-450 (relative to y=850)
- **Browser**: From message 2 (y=980) to message 6 (y=1120) → y: 150-350 (relative to y=850)
- **Backend**: From message 9 (y=1220) to message 12 (y=1310) → y: 300-450 (relative to y=850)

---

## 🔊 SD-03: Auto-Read News (TTS)

### Timeline (Chronological order from top to bottom):

| # | Y Position | Message | From | To | Type |
|---|------------|---------|------|-----|------|
| 1 | 1580 | Click "Listen" on article | User | Frontend | Synchronous |
| 2 | 1630 | GET /fetch-article-clean?url=... | Frontend | Backend | Synchronous |
| 3 | 1680 | Call getCleanArticleForTTS(url) | Backend | ArticleCleaner Module | Synchronous |
| 4 | 1730 | Call extractMainContent(url) | ArticleCleaner | Puppeteer | Synchronous |
| 5 | 1750-1770 | Launch browser and navigate to URL | Puppeteer | Puppeteer | Self-call |
| 6 | 1790-1810 | Extract HTML content | Puppeteer | Puppeteer | Self-call |
| 7 | 1830 | Return {title, content} | Puppeteer | ArticleCleaner | Return |
| 8 | 1850-1870 | cleanText(content) Remove SAPO, ads, noise | ArticleCleaner | ArticleCleaner | Self-call |
| 9 | 1890-1910 | prepareSpeechText({title, content}) | ArticleCleaner | ArticleCleaner | Self-call |
| 10 | 1930 | Return {title, content, ttsText} | ArticleCleaner | Backend | Return |
| 11 | 1980 | Response: {ttsText, title, content} | Backend | Frontend | Return |
| 12 | 2030 | POST /synthesize {text, voice, language} | Frontend | Backend | Synchronous |
| 13 | 2050-2070 | Split text into chunks (500 chars) | Backend | Backend | Self-call |
| 14 | 2100 | Call Google TTS for each chunk | Backend | Google TTS API | Synchronous (External) |
| 15 | 2130 | Return audio chunks (MP3) | Google TTS API | Backend | Return (External) |
| 16 | 2150-2170 | Concatenate audio chunks | Backend | Backend | Self-call |
| 17 | 2200 | Response: audio blob (MP3) | Backend | Frontend | Return |
| 18 | 2220-2240 | Create audio URL: URL.createObjectURL(blob) | Frontend | Frontend | Self-call |
| 19 | 2260-2280 | Play audio in AudioPlayer | Frontend | Frontend | Self-call |
| 20 | 2300-2320 | Listen to news | User | User | Self-call |

### Activation Boxes (Active period):

- **Frontend**: From message 1 (y=1580) to message 19 (y=2280) → y: 150-650 (relative to y=1500)
- **Backend**: From message 2 (y=1630) to message 17 (y=2200) → y: 200-650 (relative to y=1500)
- **ArticleCleaner**: From message 3 (y=1680) to message 10 (y=1930) → y: 250-600 (relative to y=1500)
- **Puppeteer**: From message 4 (y=1730) to message 7 (y=1830) → y: 300-500 (relative to y=1500)
- **Google TTS API**: From message 14 (y=2100) to message 15 (y=2130) → y: 500-600 (relative to y=1500)

---

## 📐 Timeline Usage Guide

### How to Read Timeline:

1. **Y Position**: Vertical position (from top to bottom) of message on diagram
   - Smaller number = higher (occurs earlier)
   - Larger number = lower (occurs later)

2. **Message**: Description of action/message

3. **From → To**: Source and destination of message

4. **Type**:
   - **Synchronous**: Synchronous message (waits for response)
   - **Return**: Return message (response)
   - **Self-call**: Calls itself (internal operation)
   - **External**: Calls external system
   - **Callback**: Callback from external system

### How to Arrange in Draw.io:

1. **Open SequenceDiagrams.drawio file in draw.io**

2. **Select each message and adjust Y position**:
   - Select message
   - Drag up/down to place correctly on timeline
   - Or edit Y position in Properties panel

3. **Adjust Activation Boxes**:
   - Activation box must start from first incoming message
   - Activation box must end at last outgoing message
   - Adjust `y` and `height` of activation box

4. **Check order**:
   - Messages must be in order from top to bottom
   - No overlapping messages
   - Return messages must be after corresponding request messages

---

## ✅ Adjustment Checklist

### SD-01:
- [ ] Message 1 at y=180
- [ ] Message 2 at y=230
- [ ] Message 3 at y=280
- [ ] Message 4 at y=350
- [ ] Message 5 at y=380-420 (self-call)
- [ ] Message 6 at y=450
- [ ] Message 7 at y=480-520 (self-call)
- [ ] Message 8 at y=540-580 (self-call, optional)

### SD-02:
- [ ] Message 1 at y=930
- [ ] Message 2 at y=980
- [ ] Message 3 at y=1000-1020 (self-call)
- [ ] Message 4 at y=1050
- [ ] Message 5 at y=1080-1100 (self-call)
- [ ] Message 6 at y=1120
- [ ] Message 7 at y=1140-1160 (self-call)
- [ ] Message 8 at y=1180-1200 (self-call)
- [ ] Message 9 at y=1220
- [ ] Message 10 at y=1250
- [ ] Message 11 at y=1280
- [ ] Message 12 at y=1310
- [ ] Message 13 at y=1330-1350 (self-call)

### SD-03:
- [ ] Message 1 at y=1580
- [ ] Message 2 at y=1630
- [ ] Message 3 at y=1680
- [ ] Message 4 at y=1730
- [ ] Message 5 at y=1750-1770 (self-call)
- [ ] Message 6 at y=1790-1810 (self-call)
- [ ] Message 7 at y=1830
- [ ] Message 8 at y=1850-1870 (self-call)
- [ ] Message 9 at y=1890-1910 (self-call)
- [ ] Message 10 at y=1930
- [ ] Message 11 at y=1980
- [ ] Message 12 at y=2030
- [ ] Message 13 at y=2050-2070 (self-call)
- [ ] Message 14 at y=2100
- [ ] Message 15 at y=2130
- [ ] Message 16 at y=2150-2170 (self-call)
- [ ] Message 17 at y=2200
- [ ] Message 18 at y=2220-2240 (self-call)
- [ ] Message 19 at y=2260-2280 (self-call)
- [ ] Message 20 at y=2300-2320 (self-call)

---

## 💡 Notes

1. **Y Position is absolute**: Y values in table are absolute positions on canvas
2. **Relative Position**: Activation boxes use relative position to lifeline parent
3. **Self-call messages**: Can have multiple points (Array as points) to create curved line
4. **Return messages**: Usually placed right after corresponding request message
5. **External messages**: Drawn with dashed line (dashed=1)

---

## 🔧 Y Position Calculation Formula

### For SD-01 (Base Y = 100):
- Message Y = Base Y + startSize (20) + offset
- Example: Message 1 = 100 + 20 + 60 = 180

### For SD-02 (Base Y = 850):
- Message Y = Base Y + startSize (20) + offset
- Example: Message 1 = 850 + 20 + 60 = 930

### For SD-03 (Base Y = 1500):
- Message Y = Base Y + startSize (20) + offset
- Example: Message 1 = 1500 + 20 + 60 = 1580

### Spacing between messages:
- **Normal**: 50 pixels
- **Self-call**: 20 pixels (shorter)
- **Return after request**: 70 pixels (to have space)
