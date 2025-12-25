# 📊 SEQUENCE DIAGRAMS - SMART NEWS READER AI

## 📋 Tổng Quan

Tài liệu này mô tả các biểu đồ trình tự (Sequence Diagrams) cho các luồng xử lý chính trong hệ thống Smart News Reader AI.

---

## 🔍 SD-01: Tìm Kiếm Tin Tức Bằng Văn Bản

### Mô Tả
Biểu đồ trình tự này mô tả luồng xử lý khi người dùng tìm kiếm tin tức bằng cách nhập từ khóa vào thanh tìm kiếm.

### Các Thành Phần Tham Gia
- **Người Dùng**: Người sử dụng hệ thống
- **Frontend (React)**: Giao diện người dùng
- **Backend API (Express.js)**: Server xử lý requests
- **NewsData.io API**: Hệ thống bên ngoài cung cấp tin tức

### Luồng Xử Lý

1. **Người Dùng → Frontend**: Nhập từ khóa tìm kiếm
   - Người dùng nhập từ khóa vào thanh tìm kiếm
   - Frontend nhận input và validate

2. **Frontend → Backend**: POST /search-news
   - Gửi request với payload: `{query, language, limit}`
   - Frontend hiển thị trạng thái "Đang tìm kiếm..."

3. **Backend → NewsData.io API**: GET /api/1/news
   - Backend tạo URL với query parameters:
     - `apikey`: API key
     - `q`: Từ khóa tìm kiếm
     - `language`: Ngôn ngữ (vi, en, zh)
     - `size`: Số lượng bài báo
   - Gọi NewsData.io API

4. **NewsData.io API → Backend**: Response: articles[]
   - Trả về danh sách bài báo dạng JSON
   - Mỗi article chứa: title, description, url, image, source, published

5. **Backend**: Xử lý và sắp xếp articles
   - Áp dụng thuật toán BM25 để tính điểm relevance
   - Loại bỏ các bài báo trùng lặp (deduplication)
   - Sắp xếp theo điểm số từ cao xuống thấp
   - Giới hạn số lượng theo `limit`

6. **Backend → Frontend**: Response: {articles, total, query}
   - Trả về danh sách articles đã xử lý
   - Kèm theo tổng số kết quả và query đã tìm

7. **Frontend**: Hiển thị danh sách tin tức
   - Cập nhật state với articles mới
   - Render NewsGrid component với danh sách articles
   - Hiển thị hình ảnh, tiêu đề, mô tả cho mỗi article

8. **(Optional) Frontend**: Auto-read first article
   - Nếu real-time mode được bật
   - Tự động gọi handleListen() cho article đầu tiên
   - Bắt đầu đọc tin tức tự động

### Điểm Đặc Biệt
- Backend sử dụng thuật toán BM25 (Google-inspired) để sắp xếp kết quả
- Hỗ trợ fallback mechanism nếu NewsData.io API fail
- Có thể tìm kiếm theo latest news nếu query search không trả về đủ kết quả

---

## 🎤 SD-02: Tìm Kiếm Tin Tức Bằng Giọng Nói (STT)

### Mô Tả
Biểu đồ trình tự này mô tả luồng xử lý khi người dùng sử dụng giọng nói để tìm kiếm tin tức thông qua Web Speech API.

### Các Thành Phần Tham Gia
- **Người Dùng**: Người sử dụng hệ thống
- **Frontend (React)**: Giao diện người dùng
- **Browser (Web Speech API)**: API của trình duyệt cho STT
- **Backend API**: Server xử lý requests
- **NewsData.io API**: Hệ thống bên ngoài cung cấp tin tức

### Luồng Xử Lý

1. **Người Dùng → Frontend**: Nhấn nút microphone
   - Người dùng click vào nút microphone hoặc nhấn phím tắt (Ctrl+M)
   - Frontend nhận sự kiện

2. **Frontend → Browser**: Khởi tạo SpeechRecognition
   - Frontend tạo instance của `SpeechRecognition` hoặc `webkitSpeechRecognition`
   - Cấu hình:
     - `recognition.lang`: Ngôn ngữ (vi-VN, en-US, zh-CN)
     - `recognition.continuous`: false
     - `recognition.interimResults`: true
   - Gọi `recognition.start()`

3. **Browser**: Yêu cầu quyền microphone
   - Browser hiển thị dialog yêu cầu quyền truy cập microphone
   - Người dùng phải cho phép để tiếp tục

4. **Người Dùng → Browser**: Nói từ khóa tìm kiếm
   - Người dùng nói từ khóa vào microphone
   - Browser thu âm và xử lý

5. **Browser**: Nhận diện giọng nói (Speech-to-Text)
   - Web Speech API xử lý audio
   - Chuyển đổi giọng nói thành văn bản
   - Sử dụng mô hình nhận diện giọng nói của browser

6. **Browser → Frontend**: onresult: text transcript
   - Browser gọi callback `recognition.onresult`
   - Trả về text đã nhận diện được
   - Frontend nhận cả interim results (kết quả tạm thời) và final results

7. **Frontend**: Hiển thị text trong search bar
   - Cập nhật state `sttText` với text đã nhận diện
   - Hiển thị text trong thanh tìm kiếm
   - Người dùng có thể xem và chỉnh sửa nếu cần

8. **Frontend**: Tự động gọi handleSearch(query)
   - Frontend tự động trigger tìm kiếm với text đã nhận diện
   - Gọi hàm `handleSearch()` với query từ STT

9. **Frontend → Backend**: POST /search-news
   - Tương tự như SD-01, gửi request tìm kiếm
   - Payload: `{query: recognizedText, language, limit}`

10. **Backend → NewsData.io API**: GET /api/1/news
    - Tương tự như SD-01

11. **NewsData.io API → Backend**: Response: articles[]
    - Tương tự như SD-01

12. **Backend → Frontend**: Response: {articles, total}
    - Tương tự như SD-01

13. **Frontend**: Hiển thị kết quả tìm kiếm
    - Tương tự như SD-01

### Điểm Đặc Biệt
- Sử dụng Web Speech API (browser-native), không cần server-side STT
- Hỗ trợ real-time recognition với interim results
- Tự động trigger tìm kiếm sau khi nhận diện xong
- Hỗ trợ nhiều ngôn ngữ (vi, en, zh)

---

## 🔊 SD-03: Đọc Tin Tức Tự Động (TTS)

### Mô Tả
Biểu đồ trình tự này mô tả luồng xử lý khi người dùng chọn một bài báo để nghe đọc tự động, bao gồm việc trích xuất nội dung, làm sạch, và chuyển đổi thành giọng nói.

### Các Thành Phần Tham Gia
- **Người Dùng**: Người sử dụng hệ thống
- **Frontend (React)**: Giao diện người dùng
- **Backend API**: Server xử lý requests
- **ArticleCleaner Module**: Module xử lý và làm sạch nội dung bài báo
- **Puppeteer (Browser)**: Tool để trích xuất nội dung từ web pages
- **Google TTS API**: Hệ thống bên ngoài cung cấp dịch vụ TTS

### Luồng Xử Lý

1. **Người Dùng → Frontend**: Click "Nghe đọc" trên article
   - Người dùng click vào nút "Nghe đọc" trên một article card
   - Frontend nhận sự kiện và gọi `handleListen(article)`

2. **Frontend → Backend**: GET /fetch-article-clean?url=...
   - Frontend gửi request để lấy nội dung đã làm sạch của bài báo
   - URL parameter chứa link đến bài báo gốc

3. **Backend → ArticleCleaner Module**: Gọi getCleanArticleForTTS(url)
   - Backend gọi hàm `getCleanArticleForTTS()` từ module ArticleCleaner
   - Module này sẽ xử lý toàn bộ quá trình trích xuất và làm sạch

4. **ArticleCleaner → Puppeteer**: Gọi extractMainContent(url)
   - Module gọi hàm `extractMainContent()` để trích xuất nội dung
   - Sử dụng Puppeteer để tải và parse HTML

5. **Puppeteer**: Launch browser và navigate to URL
   - Puppeteer khởi động headless browser (hoặc non-headless)
   - Navigate đến URL của bài báo
   - Đợi page load hoàn toàn (networkidle2)

6. **Puppeteer**: Extract HTML content
   - Sử dụng `page.evaluate()` để extract nội dung từ DOM
   - Loại bỏ các elements không cần thiết (popup, modal, login)
   - Lấy title từ `<h1>` tag
   - Lấy các paragraphs từ `<p>` tags

7. **Puppeteer → ArticleCleaner**: Return {title, content}
   - Trả về object chứa title và content thô
   - Content chưa được làm sạch hoàn toàn

8. **ArticleCleaner**: cleanText(content)
   - Gọi hàm `cleanText()` để làm sạch nội dung
   - Loại bỏ SAPO (tóm tắt đầu bài)
   - Loại bỏ các từ khóa rác:
     - Quảng cáo, đăng nhập, bình luận
     - Tin liên quan, xem thêm
     - Menu, footer, sidebar
   - Loại bỏ các đoạn quá ngắn (< 60 ký tự)
   - Format lại văn bản

9. **ArticleCleaner**: prepareSpeechText({title, content})
   - Gọi hàm `prepareSpeechText()` để format cho TTS
   - Thêm prefix "Tin tức: " cho title
   - Thêm prefix "Nội dung chính: " cho content
   - Kết hợp title và content thành một văn bản hoàn chỉnh

10. **ArticleCleaner → Backend**: Return {title, content, ttsText}
    - Trả về object chứa:
      - `title`: Tiêu đề bài báo
      - `content`: Nội dung đã làm sạch
      - `ttsText`: Văn bản đã format cho TTS

11. **Backend → Frontend**: Response: {ttsText, title, content}
    - Backend trả về response cho frontend
    - Frontend nhận được văn bản sẵn sàng cho TTS

12. **Frontend → Backend**: POST /synthesize
    - Frontend gửi request để tạo audio
    - Payload: `{text: ttsText, voice: language, language: article.language}`
    - Có thể bao gồm `speed` và `pitch` nếu người dùng đã tùy chỉnh

13. **Backend**: Split text thành chunks (500 chars)
    - Backend chia văn bản thành các chunks nhỏ (500 ký tự mỗi chunk)
    - Lý do: Google TTS API có giới hạn độ dài cho mỗi request
    - Xử lý để không cắt giữa từ

14. **Backend → Google TTS API**: Gọi Google TTS cho từng chunk
    - Backend gọi Google TTS API cho mỗi chunk
    - Sử dụng `google-tts-api` library
    - Mỗi chunk tạo một audio URL

15. **Google TTS API → Backend**: Return audio chunks (MP3)
    - Google TTS API trả về audio data cho mỗi chunk
    - Format: MP3
    - Backend fetch audio data từ URLs

16. **Backend**: Concatenate audio chunks
    - Backend nối các audio chunks lại với nhau
    - Sử dụng thư viện để merge MP3 files
    - Tạo một audio file hoàn chỉnh

17. **Backend → Frontend**: Response: audio blob (MP3)
    - Backend trả về audio dưới dạng binary blob
    - Content-Type: `audio/mpeg`
    - Frontend nhận blob

18. **Frontend**: Create audio URL: URL.createObjectURL(blob)
    - Frontend tạo object URL từ blob
    - Sử dụng `URL.createObjectURL()` để tạo URL có thể sử dụng với `<audio>` tag
    - Lưu URL vào state

19. **Frontend**: Phát audio trong AudioPlayer
    - Frontend tạo hoặc cập nhật `<audio>` element
    - Set `audio.src` = object URL
    - Gọi `audio.play()` để bắt đầu phát
    - Hiển thị AudioPlayer component với controls (play/pause/stop)

20. **Người Dùng**: Nghe tin tức
    - Người dùng nghe audio được phát
    - Có thể điều khiển playback (play/pause/stop)
    - Có thể xem progress bar

### Điểm Đặc Biệt
- Quá trình trích xuất và làm sạch nội dung rất chi tiết
- Sử dụng Puppeteer để handle JavaScript-rendered pages
- Loại bỏ hoàn toàn SAPO và các phần không cần thiết
- Chia nhỏ text để xử lý với Google TTS API
- Nối các audio chunks để tạo file hoàn chỉnh
- Sử dụng object URL để phát audio trong browser

---

## 📊 Tổng Kết

### Các Sequence Diagrams Đã Tạo

1. **SD-01**: Tìm Kiếm Tin Tức Bằng Văn Bản
   - Mô tả luồng tìm kiếm cơ bản
   - Tích hợp với NewsData.io API
   - Xử lý và sắp xếp kết quả

2. **SD-02**: Tìm Kiếm Tin Tức Bằng Giọng Nói (STT)
   - Sử dụng Web Speech API
   - Nhận diện giọng nói real-time
   - Tự động trigger tìm kiếm

3. **SD-03**: Đọc Tin Tức Tự Động (TTS)
   - Trích xuất nội dung bài báo
   - Làm sạch nội dung
   - Chuyển đổi thành giọng nói
   - Phát audio trong browser

### Các Thành Phần Chính

- **Frontend (React)**: Xử lý UI và tương tác người dùng
- **Backend API (Express.js)**: Xử lý business logic
- **ArticleCleaner Module**: Xử lý và làm sạch nội dung
- **Puppeteer**: Trích xuất nội dung từ web pages
- **NewsData.io API**: Cung cấp tin tức
- **Google TTS API**: Chuyển đổi text thành speech
- **Web Speech API**: Nhận diện giọng nói (browser-native)

### Các Mẫu Thiết Kế Sử Dụng

- **API Gateway Pattern**: Backend đóng vai trò gateway cho các external APIs
- **Module Pattern**: ArticleCleaner là một module độc lập
- **Async/Await Pattern**: Sử dụng async/await cho các operations bất đồng bộ
- **Error Handling**: Có fallback mechanisms cho các external API calls

---

## 🔧 Hướng Dẫn Sử Dụng

### Import vào Draw.io

1. Mở https://app.diagrams.net/
2. File → Open → chọn `SequenceDiagrams.drawio`
3. Diagram sẽ hiển thị 3 sequence diagrams trong cùng một file
4. Bạn có thể tách thành 3 file riêng nếu cần

### Export Diagram

- **PNG**: Cho báo cáo Word/PowerPoint (300 DPI)
- **PDF**: Cho báo cáo PDF
- **SVG**: Cho chất lượng vector

### Chỉnh Sửa

- Các lifelines có thể kéo dài/thu ngắn
- Các messages có thể di chuyển và chỉnh sửa text
- Có thể thêm activation boxes nếu cần
- Có thể thêm notes để giải thích thêm

---

## 📝 Ghi Chú

- Tất cả các sequence diagrams đều tuân theo chuẩn UML 2.0
- Các external systems được vẽ bằng màu đỏ để phân biệt
- Các self-messages (messages gửi cho chính mình) được vẽ bằng đường cong
- Activation boxes thể hiện thời gian object đang active

