# 🚀 Hướng dẫn Run & Stop - TTS Project

## 📋 Tổng quan
Dự án TTS bao gồm 2 phần chính:
- **Backend API**: FastAPI server chạy trên port 8000
- **Frontend Web**: React app chạy trên port 3000

---

## 🏃‍♂️ CÁCH CHẠY DỰ ÁN

### Phương pháp 1: Chạy thủ công (Recommended)

#### 1. Chạy Backend API
```bash
# Mở Terminal 1
cd /Users/jenifer/Documents/Final/TTS/english-tts-api
source venv/bin/activate
python main_simple.py
```

**Kết quả mong đợi:**
```
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Application startup complete.
```

#### 2. Chạy Frontend Web
```bash
# Mở Terminal 2 (tab mới)
cd /Users/jenifer/Documents/Final/TTS/tts-frontend
npm start
```

**Kết quả mong đợi:**
```
Compiled successfully!
You can now view tts-frontend in the browser.
  Local:            http://localhost:3000
  On Your Network:  http://192.168.x.x:3000
```

#### 3. Truy cập ứng dụng
- **Frontend**: http://localhost:3000
- **API Docs**: http://localhost:8000/docs

---

### Phương pháp 2: Chạy tự động (Scripts)

#### Tạo script chạy nhanh
```bash
# Tạo file start.sh
cat > start.sh << 'EOF'
#!/bin/bash
echo "🚀 Starting TTS Project..."

# Start Backend
echo "📡 Starting Backend API..."
cd english-tts-api
source venv/bin/activate
python main_simple.py &
BACKEND_PID=$!

# Wait 3 seconds
sleep 3

# Start Frontend
echo "🌐 Starting Frontend..."
cd ../tts-frontend
npm start &
FRONTEND_PID=$!

echo "✅ Both services started!"
echo "Backend PID: $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"
echo "Frontend: http://localhost:3000"
echo "Backend: http://localhost:8000"
EOF

# Cấp quyền thực thi
chmod +x start.sh
```

#### Chạy script
```bash
./start.sh
```

---

## 🛑 CÁCH DỪNG DỰ ÁN

### Phương pháp 1: Dừng thủ công

#### Dừng từ Terminal
- **Backend**: Nhấn `Ctrl + C` trong Terminal chạy backend
- **Frontend**: Nhấn `Ctrl + C` trong Terminal chạy frontend

#### Dừng bằng lệnh
```bash
# Dừng Backend (port 8000)
lsof -ti:8000 | xargs kill -9

# Dừng Frontend (port 3000)
lsof -ti:3000 | xargs kill -9

# Dừng tất cả
lsof -ti:8000,3000 | xargs kill -9
```

### Phương pháp 2: Script dừng tự động

#### Tạo script dừng
```bash
cat > stop.sh << 'EOF'
#!/bin/bash
echo "🛑 Stopping TTS Project..."

# Stop Backend
echo "📡 Stopping Backend API..."
lsof -ti:8000 | xargs kill -9 2>/dev/null

# Stop Frontend
echo "🌐 Stopping Frontend..."
lsof -ti:3000 | xargs kill -9 2>/dev/null

echo "✅ All services stopped!"
EOF

chmod +x stop.sh
```

#### Chạy script dừng
```bash
./stop.sh
```

---

## 🔧 TROUBLESHOOTING

### Lỗi "Address already in use"

#### Kiểm tra port đang sử dụng
```bash
# Kiểm tra port 8000
lsof -i:8000

# Kiểm tra port 3000
lsof -i:3000
```

#### Giải pháp
```bash
# Dừng tất cả process trên port
sudo lsof -ti:8000 | xargs kill -9
sudo lsof -ti:3000 | xargs kill -9

# Hoặc dùng port khác
# Backend: python main_simple.py --port 8001
# Frontend: PORT=3001 npm start
```

### Lỗi "Module not found"

#### Backend
```bash
cd english-tts-api
source venv/bin/activate
pip install -r requirements.txt
```

#### Frontend
```bash
cd tts-frontend
npm install
```

### Lỗi CORS

#### Kiểm tra backend đang chạy
```bash
curl http://localhost:8000/
# Kết quả: {"status":"English TTS API ready (Google TTS)"}
```

#### Restart backend
```bash
cd english-tts-api
source venv/bin/activate
python main_simple.py
```

---

## 📊 KIỂM TRA TRẠNG THÁI

### Kiểm tra services đang chạy
```bash
# Kiểm tra Backend
curl -s http://localhost:8000/ | jq .

# Kiểm tra Frontend
curl -s http://localhost:3000 | head -5

# Kiểm tra processes
ps aux | grep -E "(python|node)" | grep -v grep
```

### Kiểm tra ports
```bash
# Xem tất cả ports đang sử dụng
netstat -an | grep LISTEN | grep -E "(3000|8000)"

# Hoặc dùng lsof
lsof -i:3000,8000
```

---

## 🎯 QUICK COMMANDS

### Start Everything
```bash
# Terminal 1
cd english-tts-api && source venv/bin/activate && python main_simple.py

# Terminal 2  
cd tts-frontend && npm start
```

### Stop Everything
```bash
lsof -ti:8000,3000 | xargs kill -9
```

### Restart Everything
```bash
# Stop
lsof -ti:8000,3000 | xargs kill -9

# Wait
sleep 2

# Start
cd english-tts-api && source venv/bin/activate && python main_simple.py &
cd ../tts-frontend && npm start &
```

---

## 📝 NOTES

### Ports mặc định
- **Backend API**: 8000
- **Frontend Web**: 3000
- **API Documentation**: 8000/docs

### Logs
- **Backend logs**: Hiển thị trong Terminal chạy backend
- **Frontend logs**: Hiển thị trong Terminal chạy frontend + Browser Console

### Files quan trọng
- **Backend**: `english-tts-api/main_simple.py`
- **Frontend**: `tts-frontend/src/App.tsx`
- **Audio output**: `english-tts-api/output/output.wav`

---

**🎉 Chúc bạn sử dụng dự án thành công!**
