# 📊 CLASS DIAGRAM - SMART NEWS READER AI

## 📋 Tổng Quan

Biểu đồ lớp (Class Diagram) mô tả cấu trúc tĩnh của hệ thống, bao gồm các classes, interfaces, attributes, methods và relationships giữa chúng.

---

## 📦 PACKAGE: Frontend (React)

### 1. App (React Component)

**Loại**: React Functional Component  
**Mô tả**: Component chính của ứng dụng, quản lý layout và điều phối các components con

**Props**: Không có props (root component)

**State** (từ useSmartNewsReader hook):
- darkMode, language, sidebarOpen, accessibilityOpen
- searchQuery, isSearching, isListening, sttText
- news, currentArticleIndex
- audioState
- ttsText, selectedVoice, ttsRate, ttsPitch
- history
- isRealTime, screenReaderMode, soundCues, largeTextMode, showShortcuts

**Methods**:
- `handleKeyPress(event: KeyboardEvent): void` - Xử lý keyboard shortcuts

**Relationships**:
- **Uses** → Header, Sidebar, NewsGrid, AudioPlayer, AccessibilityPanel (Dependency)
- **Uses** → useSmartNewsReader hook (Dependency)

---

### 2. Header (React Component)

**Loại**: React Functional Component  
**Mô tả**: Component hiển thị thanh navigation, search bar, language selector, theme toggle

**Props**:
- `darkMode: boolean`
- `language: string`
- `searchQuery: string`
- `isListening: boolean`
- `isSearching: boolean`
- `setDarkMode(dark: boolean): void`
- `setLanguage(lang: string): void`
- `setSearchQuery(query: string): void`
- `onToggleListening(): void`
- `onSearch(): void`
- `onAccessibilityOpen(): void`
- `onSidebarToggle(): void`
- `sidebarOpen: boolean`

**Methods**: Không có methods riêng (presentational component)

**Relationships**:
- **Used by** → App (Dependency)

---

### 3. Sidebar (React Component)

**Loại**: React Functional Component  
**Mô tả**: Component hiển thị tools panel với STT/TTS controls, history, settings

**Props**:
- `open: boolean`
- `darkMode: boolean`
- `isListening: boolean`
- `sttText: string`
- `ttsText: string`
- `selectedVoice: string`
- `ttsRate: number`
- `ttsPitch: number`
- `history: HistoryItem[]`
- `isRealTime: boolean`
- `audioState: AudioState`
- `onToggleListening(): void`
- `onTTS(): void`
- `setTtsText(text: string): void`
- `setSelectedVoice(voice: string): void`
- `setTtsRate(v: number): void`
- `setTtsPitch(v: number): void`
- `setIsRealTime(realTime: boolean): void`

**Methods**: Không có methods riêng (presentational component)

**Relationships**:
- **Uses** → HistoryItem, AudioState (Dependency)
- **Used by** → App (Dependency)

---

### 4. NewsGrid (React Component)

**Loại**: React Functional Component  
**Mô tả**: Component hiển thị danh sách tin tức dạng grid với article cards

**Props**:
- `darkMode: boolean`
- `searchQuery: string`
- `setSearchQuery(query: string): void`
- `isListening: boolean`
- `isSearching: boolean`
- `onToggleListening(): void`
- `onSearch(): void`
- `news: NewsArticle[]`
- `onListen(article: NewsArticle): void`
- `audioState: AudioState`

**Methods**: Không có methods riêng (presentational component)

**Relationships**:
- **Uses** → NewsArticle, AudioState (Dependency)
- **Used by** → App (Dependency)

---

### 5. AudioPlayer (React Component)

**Loại**: React Functional Component  
**Mô tả**: Floating audio player với playback controls (play/pause/stop/next)

**Props**:
- `darkMode: boolean`
- `audioState: AudioState`
- `onTogglePlayPause(): void`
- `onStop(): void`
- `onClose(): void`
- `onNext(): void` (optional)
- `hasNext?: boolean` (optional)

**Methods**: Không có methods riêng (presentational component)

**Relationships**:
- **Uses** → AudioState (Dependency)
- **Used by** → App (Dependency)

---

### 6. AccessibilityPanel (React Component)

**Loại**: React Functional Component  
**Mô tả**: Drawer panel với accessibility settings (screen reader, sound cues, large text, shortcuts)

**Props**:
- `open: boolean`
- `onClose(): void`
- `darkMode: boolean`
- `screenReaderMode: boolean`
- `setScreenReaderMode(enabled: boolean): void`
- `soundCues: boolean`
- `setSoundCues(enabled: boolean): void`
- `largeTextMode: boolean`
- `setLargeTextMode(enabled: boolean): void`
- `showShortcuts: boolean`
- `setShowShortcuts(enabled: boolean): void`

**Methods**: Không có methods riêng (presentational component)

**Relationships**:
- **Used by** → App (Dependency)

---

### 7. useSmartNewsReader (Custom Hook)

**Loại**: React Custom Hook  
**Mô tả**: Hook quản lý toàn bộ state và business logic của ứng dụng

**State**:
- UI State: `darkMode`, `language`, `sidebarOpen`, `accessibilityOpen`
- Search State: `searchQuery`, `isSearching`, `isListening`, `sttText`
- News State: `news: NewsArticle[]`, `currentSearch`, `currentArticleIndex`
- Audio State: `audioState: AudioState`
- TTS State: `ttsText`, `selectedVoice`, `ttsRate`, `ttsPitch`, `voices: VoiceOption[]`
- History: `history: HistoryItem[]`
- Settings: `isRealTime`, `screenReaderMode`, `soundCues`, `largeTextMode`, `showShortcuts`

**Methods**:
- `handleSearch(query: string): Promise<void>` - Tìm kiếm tin tức
- `handleListen(article: NewsArticle): Promise<void>` - Đọc tin tức
- `handleNext(): Promise<void>` - Đọc bài tiếp theo
- `toggleListening(): void` - Bật/tắt STT
- `handleTTS(): Promise<void>` - Tạo TTS từ text
- `togglePlayPause(): void` - Play/pause audio
- `stopAudio(): void` - Dừng audio
- `closePlayer(): void` - Đóng audio player
- `loadHistory(): Promise<void>` - Tải lịch sử
- `clearHistory(): Promise<void>` - Xóa lịch sử
- Các setters cho state

**Relationships**:
- **Uses** → APIService (Dependency)
- **Uses** → NewsArticle, AudioState, HistoryItem (Dependency)
- **Uses** → Web Speech API (External Dependency)
- **Used by** → App (Dependency)

---

### 8. APIService (Service Class)

**Loại**: TypeScript Class  
**Mô tả**: Service layer để giao tiếp với Backend API

**Attributes**:
- `- baseURL: string` (private) - Base URL của Backend API

**Methods**:
- `+ getTrendingNews(language: string, limit: number): Promise<SearchResponse>`
- `+ searchNews(request: SearchRequest): Promise<SearchResponse>`
- `+ synthesizeSpeech(request: TTSRequest): Promise<Blob>`
- `+ recognizeSpeech(request: STTRequest): Promise<STTResponse>`
- `+ getVoices(): Promise<VoiceOption[]>`
- `+ getHistory(): Promise<HistoryItem[]>`
- `+ saveToHistory(item: HistoryItem): Promise<void>`
- `+ healthCheck(): Promise<boolean>`
- `+ getSupportedLanguages(): Promise<string[]>`
- `+ streamNews(query: string, language: string): Promise<ReadableStream<NewsArticle>>`

**Relationships**:
- **Uses** → SearchRequest, SearchResponse, TTSRequest, HistoryItem, VoiceOption (Dependency)
- **Calls** → ExpressServer (Dependency)
- **Used by** → useSmartNewsReader (Dependency)

---

## 📦 PACKAGE: Backend (Express.js)

### 9. ExpressServer (Express Application)

**Loại**: Express.js Application  
**Mô tả**: Main server application với RESTful API endpoints

**Attributes**:
- `- app: Express` (private) - Express application instance
- `- PORT: number = 8004` (private constant)
- `- NEWS_API_KEY: string` (private constant)
- `- NEWS_API_BASE_URL: string` (private constant)
- `- LANGUAGE_MAPPING: object` (private constant)

**Methods** (API Endpoints):
- `+ GET /health(): JSON` - Health check endpoint
- `+ GET /(): JSON` - API information
- `+ POST /search-news(req, res): Promise<void>` - Tìm kiếm tin tức
- `+ POST /synthesize(req, res): Promise<void>` - Text-to-speech conversion
- `+ GET /fetch-article-clean(req, res): Promise<void>` - Lấy nội dung bài báo đã làm sạch
- `+ GET /trending-news(req, res): Promise<void>` - Lấy tin tức trending
- `+ GET /test-extract(req, res): Promise<void>` - Test endpoint cho article extraction

**Relationships**:
- **Uses** → ArticleCleaner (Dependency)
- **Uses** → NewsService (Dependency)
- **Uses** → TTSService (Dependency)
- **Calls** → NewsData.io API (External Dependency)

---

### 10. ArticleCleaner (Module)

**Loại**: JavaScript Module  
**Mô tả**: Module xử lý và làm sạch nội dung bài báo

**Constants**:
- `- USER_AGENT: string` - User-Agent string cho HTTP requests
- `- JUNK_KEYWORDS: string[]` - Danh sách từ khóa rác cần loại bỏ

**Methods**:
- `+ getCleanArticleForTTS(url: string): Promise<Article>` - Hàm chính: lấy và làm sạch nội dung
- `+ extractMainContent(url: string): Promise<Article>` - Trích xuất nội dung từ URL
- `+ cleanText(text: string): string` - Làm sạch văn bản
- `+ cleanParagraphs(paragraphs: string[]): string[]` - Làm sạch các đoạn văn
- `+ prepareSpeechText(article: Article): string` - Format văn bản cho TTS
- `+ cleanAndPrepareText(title: string, content: string): string` - Làm sạch và format text có sẵn

**Relationships**:
- **Uses** → Article (Dependency)
- **Uses** → Puppeteer (External Dependency - để extract content)
- **Used by** → ExpressServer (Dependency)

---

### 11. NewsService (Service Class)

**Loại**: JavaScript Module/Service  
**Mô tả**: Service xử lý tìm kiếm và xử lý tin tức

**Methods**:
- `+ searchNews(query: string, language: string, limit: number): Promise<Article[]>` - Tìm kiếm tin tức
- `+ fetchFromNewsAPI(query: string, language: string, size: number): Promise<Article[]>` - Gọi NewsData.io API
- `+ calculateRelevanceScore(article: Article, query: string): number` - Tính điểm relevance (BM25 algorithm)
- `+ deduplicateArticles(articles: Article[]): Article[]` - Loại bỏ articles trùng lặp
- `+ normalizeText(text: string): string` - Chuẩn hóa text (loại bỏ diacritics)

**Relationships**:
- **Uses** → NewsArticle (Dependency)
- **Calls** → NewsData.io API (External Dependency)
- **Used by** → ExpressServer (Dependency)

---

### 12. TTSService (Service Class)

**Loại**: JavaScript Module/Service  
**Mô tả**: Service xử lý Text-to-Speech conversion

**Methods**:
- `+ synthesize(text: string, voice: string, language: string): Promise<Blob>` - Tạo audio từ text
- `+ splitTextIntoChunks(text: string, chunkSize: number): string[]` - Chia text thành chunks
- `+ generateAudioChunks(chunks: string[], language: string): Promise<Blob[]>` - Tạo audio cho từng chunk
- `+ concatenateAudioChunks(chunks: Blob[]): Promise<Blob>` - Nối các audio chunks lại

**Relationships**:
- **Calls** → Google TTS API (External Dependency)
- **Used by** → ExpressServer (Dependency)

---

## 📦 PACKAGE: Data Models

### 13. NewsArticle (Interface)

**Loại**: TypeScript Interface  
**Mô tả**: Interface định nghĩa cấu trúc của một bài báo

**Attributes**:
- `+ id: string`
- `+ title: string`
- `+ description: string`
- `+ image: string`
- `+ source: string`
- `+ published: string`
- `+ url: string`
- `+ language: string`
- `+ category?: string` (optional)
- `+ content?: string` (optional)

**Relationships**:
- **Used by** → NewsGrid, useSmartNewsReader, APIService, NewsService, SearchResponse, HistoryItem (Dependency)

---

### 14. AudioState (Interface)

**Loại**: TypeScript Interface  
**Mô tả**: Interface định nghĩa trạng thái của audio player

**Attributes**:
- `+ isPlaying: boolean`
- `+ isGenerating: boolean`
- `+ currentArticle?: NewsArticle` (optional)
- `+ progress: number` (0-100)
- `+ duration: number` (seconds)

**Relationships**:
- **Uses** → NewsArticle (Dependency - currentArticle)
- **Used by** → AudioPlayer, Sidebar, NewsGrid, useSmartNewsReader (Dependency)

---

### 15. SearchRequest (Interface)

**Loại**: TypeScript Interface  
**Mô tả**: Interface định nghĩa request cho tìm kiếm tin tức

**Attributes**:
- `+ query: string`
- `+ language: string`
- `+ real_time?: boolean` (optional)
- `+ max_articles?: number` (optional)

**Relationships**:
- **Used by** → APIService (Dependency)

---

### 16. SearchResponse (Interface)

**Loại**: TypeScript Interface  
**Mô tả**: Interface định nghĩa response từ tìm kiếm tin tức

**Attributes**:
- `+ articles: NewsArticle[]`
- `+ total: number`
- `+ query: string`
- `+ timestamp: string`

**Relationships**:
- **Contains** → NewsArticle (Composition - articles array)
- **Used by** → APIService (Dependency)

---

### 17. TTSRequest (Interface)

**Loại**: TypeScript Interface  
**Mô tả**: Interface định nghĩa request cho Text-to-Speech

**Attributes**:
- `+ text: string`
- `+ language: string`
- `+ voice_model: string`
- `+ speed?: number` (optional)
- `+ pitch?: number` (optional)

**Relationships**:
- **Used by** → APIService (Dependency)

---

### 18. HistoryItem (Interface)

**Loại**: TypeScript Interface  
**Mô tả**: Interface định nghĩa một item trong lịch sử đọc

**Attributes**:
- `+ id: string`
- `+ query: string`
- `+ articles: NewsArticle[]`
- `+ timestamp: string`
- `+ language: string`
- `+ duration?: number` (optional)

**Relationships**:
- **Contains** → NewsArticle (Composition - articles array)
- **Used by** → Sidebar, useSmartNewsReader, APIService (Dependency)

---

### 19. VoiceOption (Interface)

**Loại**: TypeScript Interface  
**Mô tả**: Interface định nghĩa một giọng đọc

**Attributes**:
- `+ id: string`
- `+ name: string`
- `+ language: string`
- `+ gender: 'male' | 'female'`
- `+ sample_url?: string` (optional)

**Relationships**:
- **Used by** → APIService, useSmartNewsReader (Dependency)

---

### 20. Article (Interface)

**Loại**: JavaScript/TypeScript Interface  
**Mô tả**: Interface định nghĩa cấu trúc article từ ArticleCleaner

**Attributes**:
- `+ title: string`
- `+ content: string`
- `+ ttsText?: string` (optional)
- `+ speechText?: string` (optional)
- `+ contentLength?: number` (optional)
- `+ error?: string` (optional)

**Relationships**:
- **Used by** → ArticleCleaner (Dependency)

---

## 🌐 External Systems

### 21. NewsData.io API (External)

**Loại**: External API  
**Mô tả**: Hệ thống bên ngoài cung cấp tin tức thời gian thực

**Methods**:
- `+ GET /api/1/news(query, language, size): Article[]` - Tìm kiếm tin tức

**Relationships**:
- **Called by** → ExpressServer, NewsService (External Dependency)

---

### 22. Google TTS API (External)

**Loại**: External API  
**Mô tả**: Hệ thống bên ngoài cung cấp dịch vụ Text-to-Speech

**Methods**:
- `+ getAudioUrl(text, lang): string` - Tạo audio URL
- `+ synthesize(text, lang): Blob` - Tạo audio blob

**Relationships**:
- **Called by** → TTSService (External Dependency)

---

### 23. Web Speech API (External)

**Loại**: Browser API  
**Mô tả**: API của trình duyệt cung cấp dịch vụ Speech-to-Text

**Methods**:
- `+ SpeechRecognition()` - Constructor
- `+ recognition.start()` - Bắt đầu nhận diện
- `+ recognition.onresult: callback` - Callback khi có kết quả

**Relationships**:
- **Used by** → useSmartNewsReader (External Dependency)

---

## 🔗 RELATIONSHIPS (Quan Hệ)

### 1. Dependency (Uses) - Mũi tên nét đứt

**Frontend**:
- App → Header, Sidebar, NewsGrid, AudioPlayer, AccessibilityPanel
- App → useSmartNewsReader
- useSmartNewsReader → APIService
- useSmartNewsReader → NewsArticle, AudioState, HistoryItem
- Components → Interfaces (NewsArticle, AudioState, etc.)
- APIService → Interfaces (SearchRequest, SearchResponse, TTSRequest, etc.)

**Backend**:
- ExpressServer → ArticleCleaner, NewsService, TTSService
- ArticleCleaner → Article
- NewsService → NewsArticle

**External**:
- ExpressServer → NewsData.io API
- TTSService → Google TTS API
- useSmartNewsReader → Web Speech API

### 2. Composition (Contains) - Mũi tên nét đứt với label "contains"

- SearchResponse **contains** NewsArticle[] (articles array)
- HistoryItem **contains** NewsArticle[] (articles array)
- AudioState **contains** NewsArticle? (currentArticle - optional)

### 3. Association - Mũi tên nét liền

- APIService **calls** ExpressServer (HTTP requests)
- ExpressServer **calls** NewsData.io API (HTTP requests)
- TTSService **calls** Google TTS API (HTTP requests)

---

## 📊 Tổng Kết

### Số Lượng Classes/Interfaces:

- **Frontend Package**: 8 classes/components
  - 6 React Components
  - 1 Custom Hook
  - 1 Service Class

- **Backend Package**: 4 classes/modules
  - 1 Express Server
  - 3 Service Modules

- **Data Models Package**: 7 interfaces
  - NewsArticle, AudioState, SearchRequest, SearchResponse
  - TTSRequest, HistoryItem, VoiceOption, Article

- **External Systems**: 3
  - NewsData.io API, Google TTS API, Web Speech API

**Tổng cộng**: 22 classes/interfaces/components

### Loại Quan Hệ:

1. **Dependency (Uses)**: 15+ relationships
2. **Composition (Contains)**: 2 relationships
3. **Association (Calls)**: 3 relationships

### Màu Sắc:

- **Xanh dương**: Frontend components
- **Vàng**: Custom Hook
- **Tím**: Service class
- **Xanh lá**: Backend classes
- **Cam**: ArticleCleaner module
- **Đỏ**: External systems
- **Trắng**: Data models/interfaces

---

## 📝 Ghi Chú

- Tất cả React Components là functional components (không phải class components)
- useSmartNewsReader là custom hook, không phải class nhưng được vẽ như class trong diagram
- ArticleCleaner là JavaScript module, không phải class nhưng được vẽ như class
- External systems được vẽ bằng màu đỏ để phân biệt
- Interfaces được đánh dấu bằng `<<interface>>` stereotype

