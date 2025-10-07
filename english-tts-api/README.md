# English TTS API

A FastAPI-based REST API for converting English text to speech using Coqui-TTS. This API provides a simple interface to synthesize speech from text input and returns the generated audio file.

## Features

- **Text-to-Speech Conversion**: Convert English text to high-quality speech using Coqui-TTS
- **REST API**: Simple HTTP endpoints for easy integration
- **Multiple Input Formats**: Accepts both JSON and form data
- **CPU-Only**: Optimized for CPU inference (no GPU required)
- **Auto-generated Documentation**: Interactive API docs at `/docs`

## Requirements

- Python 3.10 or higher
- Virtual environment support

## Installation

### 1. Create and Activate Virtual Environment

```bash
# Create virtual environment
python -m venv venv

# Activate virtual environment
# On macOS/Linux:
source venv/bin/activate
# On Windows:
# venv\Scripts\activate
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

## Usage

### Running the API

```bash
python main.py
```

The API will start on `http://localhost:7860`

### API Endpoints

#### Health Check
- **GET** `/` - Returns API status
- **Response**: `{"status": "English TTS API ready"}`

#### Text-to-Speech Synthesis
- **POST** `/synthesize` - Convert text to speech
- **Input**: Text (JSON or form data)
- **Output**: Audio file (WAV format)

### Testing the API

Visit `http://localhost:7860/docs` to access the interactive API documentation where you can test the endpoints directly.

#### Example Usage

**Using curl with JSON:**
```bash
curl -X POST "http://localhost:7860/synthesize" \
     -H "Content-Type: application/json" \
     -d '{"text": "Hello, this is a test of the text to speech API."}' \
     --output output.wav
```

**Using curl with form data:**
```bash
curl -X POST "http://localhost:7860/synthesize" \
     -F "text=Hello, this is a test of the text to speech API." \
     --output output.wav
```

## Project Structure

```
english-tts-api/
├── main.py              # FastAPI application
├── requirements.txt     # Python dependencies
├── README.md           # This file
└── output/             # Generated audio files
    └── output.wav      # Latest synthesized audio
```

## Model Information

- **Model**: `tts_models/en/ljspeech/tacotron2-DDC`
- **Language**: English
- **Voice**: LJSpeech dataset
- **Architecture**: Tacotron2 with DDC (Duration Control)
- **Inference**: CPU-only

## Notes

- The TTS model is loaded on startup, which may take a few moments
- Generated audio files are saved in the `output/` directory
- The API supports CORS for web applications
- All audio output is in WAV format

## Troubleshooting

- Ensure Python 3.10+ is installed
- Make sure all dependencies are installed correctly
- Check that the virtual environment is activated
- Verify port 7860 is available
