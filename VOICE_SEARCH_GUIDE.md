# 🎤 Hướng dẫn sử dụng tính năng Voice Search & News

## ✨ Tính năng mới

### 🎯 Voice Search & News Reading
- **Speech-to-Text**: Nhận diện giọng nói và chuyển đổi thành văn bản
- **Tự động tìm kiếm tin tức**: Dựa trên lời nói của người dùng
- **TTS tự động**: Đọc tin tức tìm được cho người dùng nghe

## 🚀 Cách sử dụng

### 1. Khởi động hệ thống

```bash
# Terminal 1: Khởi động News TTS API
./start_news.sh

# Terminal 2: Khởi động React Frontend
cd tts-frontend
npm start
```

### 2. Sử dụng Voice Search

1. **Mở trình duyệt** và truy cập `http://localhost:3000`
2. **Chọn ngôn ngữ** (Tiếng Việt/English/中文)
3. **Nhấn nút "Start Voice Search"** (hoặc Ctrl+M)
4. **Nói từ khóa** bạn muốn tìm kiếm
5. **Hệ thống sẽ tự động**:
   - Nhận diện giọng nói
   - Tìm kiếm tin tức liên quan
   - Đọc tin tức cho bạn nghe

### 3. Các từ khóa mẫu

#### 🏆 Thể thao
- "Đọc tin tức thể thao"
- "Tin tức bóng đá"
- "Sports news"
- "Football news"

#### 💰 Kinh tế
- "Tin tức kinh tế"
- "Tài chính"
- "Economy news"
- "Finance news"

#### 💻 Công nghệ
- "Tin tức công nghệ"
- "AI news"
- "Technology"
- "Trí tuệ nhân tạo"

#### 🎓 Giáo dục
- "Tin tức giáo dục"
- "Học tập"
- "Education"
- "Trường học"

#### 🏥 Y tế
- "Tin tức y tế"
- "Sức khỏe"
- "Health news"
- "Bệnh viện"

#### 📰 Tin tức tổng hợp
- "Tin tức tổng hợp"
- "News today"
- "Tin tức"

## ⌨️ Keyboard Shortcuts

- **Ctrl + M**: Bắt đầu/Dừng Voice Search
- **Ctrl + 1-6**: Nghe tin tức nhanh từ các nguồn
- **Space**: Play/Pause audio
- **Ctrl + Enter**: Tạo speech từ text

## 🔧 Cấu hình

### Backend (News TTS API)
- **Port**: 8000
- **Endpoints**:
  - `POST /search-news`: Tìm kiếm tin tức
  - `POST /synthesize`: Tạo speech
  - `GET /news-sources`: Danh sách nguồn tin

### Frontend (React)
- **Port**: 3000
- **Features**:
  - Voice recognition
  - News search
  - Audio playback
  - Multi-language support

## 📱 Hỗ trợ trình duyệt

### Voice Recognition
- ✅ Chrome (khuyến nghị)
- ✅ Edge
- ✅ Safari (iOS 14.5+)
- ❌ Firefox (chưa hỗ trợ đầy đủ)

### Yêu cầu
- **Microphone**: Cần có microphone để sử dụng voice search
- **HTTPS**: Trên production cần HTTPS để sử dụng voice recognition
- **Permissions**: Cho phép truy cập microphone

## 🎯 Workflow hoàn chỉnh

```
1. Người dùng nói: "Đọc tin tức thể thao"
   ↓
2. Speech-to-Text: Chuyển đổi thành text
   ↓
3. News Search: Tìm kiếm tin tức về thể thao
   ↓
4. Text-to-Speech: Đọc tin tức cho người dùng
   ↓
5. Audio Playback: Phát audio tự động
```

## 🐛 Troubleshooting

### Voice Recognition không hoạt động
1. Kiểm tra microphone có hoạt động không
2. Cho phép truy cập microphone trong trình duyệt
3. Sử dụng Chrome hoặc Edge
4. Kiểm tra kết nối internet

### Không tìm thấy tin tức
1. Thử từ khóa khác
2. Kiểm tra kết nối internet
3. Kiểm tra API server có chạy không

### Audio không phát
1. Kiểm tra volume
2. Kiểm tra trình duyệt có hỗ trợ audio không
3. Thử refresh trang

## 📞 Hỗ trợ

Nếu gặp vấn đề:
1. Kiểm tra console trong trình duyệt (F12)
2. Kiểm tra logs của API server
3. Thử restart cả frontend và backend

---

**Made with ❤️ using React, FastAPI, and Web Speech API**
