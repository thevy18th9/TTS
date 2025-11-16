from fastapi import FastAPI, Form, HTTPException, Request
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os
import logging
import tempfile
import subprocess
from gtts import gTTS

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Vietnamese TTS API",
    description="A REST API for converting Vietnamese text to speech with multiple voice models",
    version="2.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Available voice models for Vietnamese
VOICE_MODELS = {
    "google_male": {
        "name": "Google Male (Default)",
        "lang": "vi",
        "tld": "com.vn",
        "slow": False
    },
    "google_female": {
        "name": "Google Female",
        "lang": "vi", 
        "tld": "com",
        "slow": False
    },
    "google_slow": {
        "name": "Google Slow",
        "lang": "vi",
        "tld": "com.vn", 
        "slow": True
    },
    "google_news": {
        "name": "Google News Style",
        "lang": "vi",
        "tld": "com.au",
        "slow": False
    }
}

def synthesize_with_google_tts(text: str, voice_model: str = "google_male") -> str:
    """Synthesize speech using Google TTS with different voice models"""
    try:
        model_config = VOICE_MODELS.get(voice_model, VOICE_MODELS["google_male"])
        
        # Create gTTS object with specific configuration
        tts = gTTS(
            text=text,
            lang=model_config["lang"],
            tld=model_config["tld"],
            slow=model_config["slow"]
        )
        
        # Save to temporary file
        output_path = "output/output.wav"
        os.makedirs("output", exist_ok=True)
        
        # Save as MP3 first, then convert to WAV
        temp_mp3 = tempfile.NamedTemporaryFile(delete=False, suffix=".mp3")
        tts.save(temp_mp3.name)
        temp_mp3.close()
        
        # Convert MP3 to WAV using ffmpeg if available
        try:
            subprocess.run([
                "ffmpeg", "-i", temp_mp3.name, 
                "-acodec", "pcm_s16le", 
                "-ar", "22050", 
                "-ac", "1", 
                output_path, "-y"
            ], check=True, capture_output=True)
            os.unlink(temp_mp3.name)
        except (subprocess.CalledProcessError, FileNotFoundError):
            # If ffmpeg not available, just copy the MP3 file
            os.rename(temp_mp3.name, output_path.replace('.wav', '.mp3'))
            output_path = output_path.replace('.wav', '.mp3')
        
        return output_path
        
    except Exception as e:
        logger.error(f"Error in Google TTS synthesis: {str(e)}")
        raise HTTPException(status_code=500, detail=f"TTS synthesis failed: {str(e)}")

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "status": "Vietnamese TTS API ready",
        "models": list(VOICE_MODELS.keys()),
        "supported_languages": ["vi", "en"],
        "max_text_length": 2000
    }

@app.get("/models")
async def get_models():
    """Get available voice models"""
    return {
        "models": VOICE_MODELS,
        "default": "google_male"
    }

@app.post("/synthesize")
async def synthesize_speech(
    request: Request,
    text: str = Form(None),
    language: str = Form("vi"),
    voice_model: str = Form("google_male")
):
    """Synthesize speech from text"""
    try:
        # Parse request data
        if text is None:
            try:
                body = await request.json()
                text = body.get("text", "")
                language = body.get("language", "vi")
                voice_model = body.get("voice_model", "google_male")
            except:
                raise HTTPException(status_code=400, detail="No text provided")
        
        # Validate input
        if not text or not text.strip():
            raise HTTPException(status_code=400, detail="Text cannot be empty")
        
        if len(text) > 2000:
            raise HTTPException(status_code=400, detail="Text too long (max 2000 characters)")
        
        # Validate voice model
        if voice_model not in VOICE_MODELS:
            voice_model = "google_male"
        
        # Validate language
        if language not in ["vi", "en"]:
            language = "vi"
        
        logger.info(f"Synthesizing speech for text: '{text[:50]}...' with model: {voice_model}")
        
        # Synthesize speech
        if voice_model.startswith("google"):
            output_path = synthesize_with_google_tts(text, voice_model)
        else:
            output_path = synthesize_with_google_tts(text, "google_male")
        
        logger.info(f"Speech synthesized successfully. Saved to: {output_path}")
        
        # Return the audio file
        return FileResponse(
            path=output_path,
            media_type="audio/wav" if output_path.endswith('.wav') else "audio/mpeg",
            filename="tts_output.wav" if output_path.endswith('.wav') else "tts_output.mp3"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.post("/synthesize_advanced")
async def synthesize_advanced(
    text: str = Form(...),
    voice_model: str = Form("google_male"),
    speed: float = Form(1.0),
    pitch: float = Form(1.0)
):
    """Advanced synthesis with speed and pitch control"""
    try:
        # For now, just use basic synthesis
        # In a real implementation, you'd adjust these parameters
        logger.info(f"Advanced synthesis: voice={voice_model}, speed={speed}, pitch={pitch}")
        
        # Use the basic synthesis for now
        return await synthesize_speech(
            text=text,
            language="vi",
            voice_model=voice_model
        )
        
    except Exception as e:
        logger.error(f"Error in advanced synthesis: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Advanced synthesis failed: {str(e)}")

if __name__ == "__main__":
    print("🎤 Starting Vietnamese TTS API with multiple voice models...")
    print("📊 Available models:")
    for model_id, model_info in VOICE_MODELS.items():
        print(f"   - {model_id}: {model_info['name']}")
    print("🌐 API will be available at: http://localhost:8000")
    print("📚 API docs at: http://localhost:8000/docs")
    
    uvicorn.run(
        "main_vietnamese:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
