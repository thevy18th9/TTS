# 📊 USE CASE DIAGRAM - SMART NEWS READER AI

## 🎭 CÁC TÁC NHÂN (ACTORS)

### 1. **Người Dùng (User)**
- **Mô tả**: Người sử dụng hệ thống để tìm kiếm và nghe tin tức
- **Loại**: Primary Actor (Tác nhân chính)
- **Đặc điểm**: 
  - Sử dụng trình duyệt web để truy cập ứng dụng
  - Có thể sử dụng giọng nói hoặc văn bản để tương tác
  - Có thể tùy chỉnh cài đặt (giọng đọc, tốc độ, theme)

### 2. **NewsData.io API**
- **Mô tả**: Hệ thống bên ngoài cung cấp tin tức thời gian thực
- **Loại**: External System (Hệ thống bên ngoài)
- **Chức năng**: 
  - Cung cấp tin tức từ nhiều nguồn
  - Hỗ trợ tìm kiếm theo từ khóa
  - Hỗ trợ RSS feed aggregation
  - Hỗ trợ đa ngôn ngữ (vi, en, zh)

### 3. **Google TTS API**
- **Mô tả**: Hệ thống bên ngoài cung cấp dịch vụ Text-to-Speech
- **Loại**: External System (Hệ thống bên ngoài)
- **Chức năng**:
  - Chuyển đổi văn bản thành giọng nói
  - Hỗ trợ đa ngôn ngữ
  - Tạo file audio MP3

### 4. **Web Speech API**
- **Mô tả**: API của trình duyệt cung cấp dịch vụ Speech-to-Text
- **Loại**: External System (Hệ thống bên ngoài)
- **Chức năng**:
  - Nhận diện giọng nói real-time
  - Hỗ trợ đa ngôn ngữ
  - Chạy trực tiếp trên trình duyệt

### 5. **Trình Duyệt (Browser)**
- **Mô tả**: Môi trường chạy frontend application
- **Loại**: Supporting Actor (Tác nhân hỗ trợ)
- **Chức năng**:
  - Hiển thị giao diện người dùng
  - Cung cấp Web Speech API
  - Xử lý audio playback

---

## 📋 CÁC USE CASES (CHỨC NĂNG)

### Nhóm 1: Tìm Kiếm Tin Tức

#### UC-01: Tìm Kiếm Tin Tức Bằng Văn Bản
- **Actor**: Người Dùng
- **Mô tả**: Người dùng nhập từ khóa vào thanh tìm kiếm để tìm tin tức
- **Precondition**: Người dùng đã mở ứng dụng
- **Main Flow**:
  1. Người dùng nhập từ khóa vào thanh tìm kiếm
  2. Hệ thống gửi request đến Backend
  3. Backend gọi NewsData.io API
  4. Hệ thống hiển thị kết quả tìm kiếm
- **Postcondition**: Danh sách tin tức được hiển thị

#### UC-02: Tìm Kiếm Tin Tức Bằng Giọng Nói
- **Actor**: Người Dùng, Web Speech API
- **Mô tả**: Người dùng sử dụng giọng nói để tìm kiếm tin tức
- **Precondition**: Người dùng đã cấp quyền microphone
- **Main Flow**:
  1. Người dùng nhấn nút microphone
  2. Web Speech API nhận diện giọng nói
  3. Chuyển đổi giọng nói thành văn bản
  4. Tự động thực hiện tìm kiếm với văn bản đã nhận diện
- **Postcondition**: Kết quả tìm kiếm được hiển thị

#### UC-03: Xem Tin Tức Trending
- **Actor**: Người Dùng, NewsData.io API
- **Mô tả**: Người dùng xem các tin tức nổi bật/trending
- **Precondition**: Người dùng đã mở ứng dụng
- **Main Flow**:
  1. Hệ thống tự động tải tin tức trending khi khởi động
  2. Backend gọi NewsData.io API để lấy tin trending
  3. Hiển thị danh sách tin tức trending
- **Postcondition**: Danh sách tin trending được hiển thị

---

### Nhóm 2: Đọc Tin Tức (TTS)

#### UC-04: Đọc Tin Tức Tự Động
- **Actor**: Người Dùng, Google TTS API
- **Mô tả**: Người dùng chọn một bài báo để nghe đọc tự động
- **Precondition**: Đã có danh sách tin tức
- **Main Flow**:
  1. Người dùng nhấn nút "Nghe" trên một bài báo
  2. Hệ thống trích xuất nội dung bài báo (articleCleaner)
  3. Backend gọi Google TTS API để tạo audio
  4. Phát audio cho người dùng
- **Postcondition**: Audio được phát và người dùng có thể nghe

#### UC-05: Điều Khiển Phát Audio
- **Actor**: Người Dùng
- **Mô tả**: Người dùng điều khiển phát/dừng/tua audio
- **Precondition**: Đang có audio đang phát hoặc đã tải
- **Main Flow**:
  1. Người dùng nhấn nút Play/Pause
  2. Hệ thống phát/dừng audio
  3. Người dùng có thể tua đến vị trí khác
- **Postcondition**: Trạng thái phát audio được cập nhật

#### UC-06: Đọc Bài Báo Tiếp Theo
- **Actor**: Người Dùng
- **Mô tả**: Tự động chuyển sang đọc bài báo tiếp theo trong danh sách
- **Precondition**: Đang có danh sách tin tức và đang phát audio
- **Main Flow**:
  1. Người dùng nhấn nút "Next"
  2. Hệ thống dừng audio hiện tại
  3. Tự động đọc bài báo tiếp theo
- **Postcondition**: Bài báo tiếp theo được đọc

---

### Nhóm 3: Xử Lý Nội Dung Bài Báo

#### UC-07: Trích Xuất Nội Dung Bài Báo
- **Actor**: Hệ thống (Backend)
- **Mô tả**: Trích xuất nội dung chính từ URL bài báo
- **Precondition**: Có URL bài báo hợp lệ
- **Main Flow**:
  1. Backend sử dụng Puppeteer để tải trang web
  2. Sử dụng Mozilla Readability để trích xuất nội dung
  3. Làm sạch nội dung (loại bỏ quảng cáo, menu, footer)
  4. Trả về nội dung đã làm sạch
- **Postcondition**: Nội dung bài báo đã được trích xuất và làm sạch

#### UC-08: Làm Sạch Nội Dung Bài Báo
- **Actor**: Hệ thống (Backend)
- **Mô tả**: Loại bỏ các phần không cần thiết trong nội dung bài báo
- **Precondition**: Đã có nội dung thô từ bài báo
- **Main Flow**:
  1. Loại bỏ SAPO (tóm tắt đầu bài)
  2. Loại bỏ các từ khóa rác (quảng cáo, đăng nhập, bình luận...)
  3. Loại bỏ các đoạn quá ngắn (< 60 ký tự)
  4. Format lại văn bản cho TTS
- **Postcondition**: Nội dung đã được làm sạch và sẵn sàng cho TTS

---

### Nhóm 4: Tùy Chỉnh Cài Đặt

#### UC-09: Chọn Giọng Đọc
- **Actor**: Người Dùng
- **Mô tả**: Người dùng chọn giọng đọc (nam/nữ, ngôn ngữ)
- **Precondition**: Đang ở trang cài đặt hoặc sidebar
- **Main Flow**:
  1. Người dùng mở menu chọn giọng đọc
  2. Chọn giọng đọc mong muốn
  3. Hệ thống lưu lựa chọn
- **Postcondition**: Giọng đọc mới được áp dụng cho lần TTS tiếp theo

#### UC-10: Điều Chỉnh Tốc Độ Đọc
- **Actor**: Người Dùng
- **Mô tả**: Người dùng điều chỉnh tốc độ đọc (rate)
- **Precondition**: Đang ở trang cài đặt
- **Main Flow**:
  1. Người dùng kéo thanh trượt tốc độ
  2. Hệ thống cập nhật giá trị
  3. Áp dụng cho lần TTS tiếp theo
- **Postcondition**: Tốc độ đọc mới được lưu

#### UC-11: Điều Chỉnh Cao Độ Giọng
- **Actor**: Người Dùng
- **Mô tả**: Người dùng điều chỉnh cao độ giọng (pitch)
- **Precondition**: Đang ở trang cài đặt
- **Main Flow**:
  1. Người dùng kéo thanh trượt cao độ
  2. Hệ thống cập nhật giá trị
  3. Áp dụng cho lần TTS tiếp theo
- **Postcondition**: Cao độ mới được lưu

#### UC-12: Chuyển Đổi Theme (Dark/Light Mode)
- **Actor**: Người Dùng
- **Mô tả**: Người dùng chuyển đổi giữa chế độ sáng và tối
- **Precondition**: Đang ở giao diện chính
- **Main Flow**:
  1. Người dùng nhấn nút chuyển theme
  2. Hệ thống cập nhật theme
  3. Giao diện được cập nhật ngay lập tức
- **Postcondition**: Theme mới được áp dụng

#### UC-13: Chọn Ngôn Ngữ Giao Diện
- **Actor**: Người Dùng
- **Mô tả**: Người dùng chọn ngôn ngữ cho giao diện và tìm kiếm
- **Precondition**: Đang ở giao diện chính
- **Main Flow**:
  1. Người dùng chọn ngôn ngữ từ dropdown
  2. Hệ thống cập nhật ngôn ngữ
  3. Giao diện và kết quả tìm kiếm được cập nhật
- **Postcondition**: Ngôn ngữ mới được áp dụng

---

### Nhóm 5: Quản Lý Lịch Sử

#### UC-14: Xem Lịch Sử Đọc
- **Actor**: Người Dùng
- **Mô tả**: Người dùng xem lại các bài báo đã đọc trước đó
- **Precondition**: Đã có lịch sử đọc
- **Main Flow**:
  1. Người dùng mở sidebar hoặc menu lịch sử
  2. Hệ thống hiển thị danh sách lịch sử
  3. Người dùng có thể chọn để đọc lại
- **Postcondition**: Lịch sử được hiển thị

#### UC-15: Xóa Lịch Sử Đọc
- **Actor**: Người Dùng
- **Mô tả**: Người dùng xóa toàn bộ lịch sử đọc
- **Precondition**: Đang ở trang lịch sử
- **Main Flow**:
  1. Người dùng nhấn nút "Xóa lịch sử"
  2. Hệ thống xác nhận
  3. Xóa toàn bộ lịch sử
- **Postcondition**: Lịch sử đã được xóa

---

### Nhóm 6: Tính Năng Accessibility

#### UC-16: Bật/Tắt Screen Reader Mode
- **Actor**: Người Dùng
- **Mô tả**: Người dùng bật/tắt chế độ hỗ trợ screen reader
- **Precondition**: Đang ở trang cài đặt accessibility
- **Main Flow**:
  1. Người dùng bật/tắt toggle
  2. Hệ thống cập nhật ARIA labels và attributes
- **Postcondition**: Screen reader mode được bật/tắt

#### UC-17: Bật/Tắt Sound Cues
- **Actor**: Người Dùng
- **Mô tả**: Người dùng bật/tắt âm thanh thông báo
- **Precondition**: Đang ở trang cài đặt accessibility
- **Main Flow**:
  1. Người dùng bật/tắt toggle
  2. Hệ thống cập nhật cài đặt
- **Postcondition**: Sound cues được bật/tắt

#### UC-18: Bật/Tắt Large Text Mode
- **Actor**: Người Dùng
- **Mô tả**: Người dùng bật/tắt chế độ chữ lớn
- **Precondition**: Đang ở trang cài đặt accessibility
- **Main Flow**:
  1. Người dùng bật/tắt toggle
  2. Hệ thống cập nhật font size
- **Postcondition**: Large text mode được bật/tắt

#### UC-19: Sử Dụng Keyboard Shortcuts
- **Actor**: Người Dùng
- **Mô tả**: Người dùng sử dụng phím tắt để điều khiển ứng dụng
- **Precondition**: Đang ở giao diện chính
- **Main Flow**:
  1. Người dùng nhấn phím tắt (F1-F4, Ctrl+M...)
  2. Hệ thống thực hiện hành động tương ứng
- **Postcondition**: Hành động được thực hiện

---

## 🔗 MỐI QUAN HỆ GIỮA ACTORS VÀ USE CASES

### Quan Hệ "Use" (Sử dụng)
- **Người Dùng** sử dụng tất cả các use cases từ UC-01 đến UC-19
- **NewsData.io API** được sử dụng bởi UC-01, UC-03
- **Google TTS API** được sử dụng bởi UC-04
- **Web Speech API** được sử dụng bởi UC-02

### Quan Hệ "Extend" (Mở rộng)
- UC-02 **extends** UC-01 (Tìm kiếm bằng giọng nói mở rộng từ tìm kiếm bằng văn bản)
- UC-06 **extends** UC-04 (Đọc bài tiếp theo mở rộng từ đọc tin tức)

### Quan Hệ "Include" (Bao gồm)
- UC-04 **includes** UC-07 (Đọc tin tức bao gồm trích xuất nội dung)
- UC-04 **includes** UC-08 (Đọc tin tức bao gồm làm sạch nội dung)
- UC-07 **includes** UC-08 (Trích xuất nội dung bao gồm làm sạch)

---

## 📐 CẤU TRÚC USE CASE DIAGRAM

### Các Package (Nhóm Use Cases)

1. **Package: Tìm Kiếm Tin Tức**
   - UC-01: Tìm Kiếm Tin Tức Bằng Văn Bản
   - UC-02: Tìm Kiếm Tin Tức Bằng Giọng Nói
   - UC-03: Xem Tin Tức Trending

2. **Package: Đọc Tin Tức (TTS)**
   - UC-04: Đọc Tin Tức Tự Động
   - UC-05: Điều Khiển Phát Audio
   - UC-06: Đọc Bài Báo Tiếp Theo

3. **Package: Xử Lý Nội Dung**
   - UC-07: Trích Xuất Nội Dung Bài Báo
   - UC-08: Làm Sạch Nội Dung Bài Báo

4. **Package: Tùy Chỉnh Cài Đặt**
   - UC-09: Chọn Giọng Đọc
   - UC-10: Điều Chỉnh Tốc Độ Đọc
   - UC-11: Điều Chỉnh Cao Độ Giọng
   - UC-12: Chuyển Đổi Theme
   - UC-13: Chọn Ngôn Ngữ Giao Diện

5. **Package: Quản Lý Lịch Sử**
   - UC-14: Xem Lịch Sử Đọc
   - UC-15: Xóa Lịch Sử Đọc

6. **Package: Accessibility**
   - UC-16: Bật/Tắt Screen Reader Mode
   - UC-17: Bật/Tắt Sound Cues
   - UC-18: Bật/Tắt Large Text Mode
   - UC-19: Sử Dụng Keyboard Shortcuts

---

## 🎨 GỢI Ý VẼ USE CASE DIAGRAM

### Cách Vẽ:
1. **Vẽ các Actors** ở bên trái và bên phải của diagram
   - Người Dùng ở bên trái
   - Các External Systems (NewsData.io, Google TTS, Web Speech) ở bên phải

2. **Vẽ các Use Cases** ở giữa, nhóm theo package
   - Sử dụng hình oval cho use cases
   - Sử dụng hình chữ nhật với góc bo tròn cho packages

3. **Vẽ các mối quan hệ**:
   - **Association** (đường thẳng): Giữa Actor và Use Case
   - **Include** (mũi tên có <<include>>): Từ use case chính đến use case phụ
   - **Extend** (mũi tên có <<extend>>): Từ use case mở rộng đến use case cơ bản

4. **Chú thích**:
   - Primary Actor: Người Dùng (vẽ ở bên trái)
   - External Systems: Vẽ ở bên phải
   - Supporting Actor: Browser (có thể vẽ ở dưới)

### Ví dụ Mối Quan Hệ:
```
Người Dùng ────────► UC-01: Tìm Kiếm Tin Tức Bằng Văn Bản
                          │
                          │ <<include>>
                          ▼
                    UC-07: Trích Xuất Nội Dung

NewsData.io API ────────► UC-01: Tìm Kiếm Tin Tức Bằng Văn Bản
```

---

## 📝 GHI CHÚ

- **Primary Actor**: Người Dùng là tác nhân chính, thực hiện hầu hết các use cases
- **External Systems**: Các hệ thống bên ngoài cung cấp dịch vụ cho hệ thống
- **Supporting Actor**: Browser hỗ trợ việc hiển thị và xử lý frontend
- **System Boundary**: Toàn bộ hệ thống Smart News Reader AI nằm trong một boundary lớn

