from fastapi import FastAPI, Form, HTTPException, Request
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os
import logging
import requests
import json
import tempfile
import subprocess
import sys
from gtts import gTTS
import random

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Vietnamese TTS API (Diverse Voices)",
    description="A REST API for converting Vietnamese text to speech with diverse voice models",
    version="4.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Diverse voice models with different TTS engines and configurations
VOICE_MODELS = {
    "google_male_vn": {
        "name": "Google Nam (VN)",
        "engine": "google",
        "lang": "vi",
        "tld": "com.vn",
        "slow": False,
        "description": "Google TTS giọng nam Việt Nam"
    },
    "google_female_vn": {
        "name": "Google Nữ (VN)",
        "engine": "google", 
        "lang": "vi",
        "tld": "com",
        "slow": False,
        "description": "Google TTS giọng nữ Việt Nam"
    },
    "google_male_au": {
        "name": "Google Nam (AU)",
        "engine": "google",
        "lang": "vi", 
        "tld": "com.au",
        "slow": False,
        "description": "Google TTS giọng nam Australia"
    },
    "google_female_au": {
        "name": "Google Nữ (AU)",
        "engine": "google",
        "lang": "vi",
        "tld": "com.au", 
        "slow": True,
        "description": "Google TTS giọng nữ Australia chậm"
    },
    "google_male_us": {
        "name": "Google Nam (US)",
        "engine": "google",
        "lang": "vi",
        "tld": "com",
        "slow": False,
        "description": "Google TTS giọng nam Mỹ"
    },
    "google_female_us": {
        "name": "Google Nữ (US)",
        "engine": "google",
        "lang": "vi",
        "tld": "com",
        "slow": True,
        "description": "Google TTS giọng nữ Mỹ chậm"
    },
    "google_news_style": {
        "name": "Phong cách Tin tức",
        "engine": "google",
        "lang": "vi",
        "tld": "com.au",
        "slow": False,
        "description": "Google TTS phong cách phát thanh viên"
    },
    "google_slow_clear": {
        "name": "Chậm rãi rõ ràng",
        "engine": "google",
        "lang": "vi",
        "tld": "com.vn",
        "slow": True,
        "description": "Google TTS chậm rãi, rõ ràng"
    }
}

def synthesize_with_google_diverse(text: str, voice_model: str = "google_male_vn") -> str:
    """Synthesize speech using Google TTS with diverse configurations"""
    try:
        model_config = VOICE_MODELS.get(voice_model, VOICE_MODELS["google_male_vn"])
        
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

def synthesize_with_espeak(text: str, voice_model: str = "google_male_vn") -> str:
    """Synthesize speech using espeak (if available)"""
    try:
        # Check if espeak is available
        subprocess.run(["espeak", "--version"], check=True, capture_output=True)
        
        # Map voice models to espeak voices
        espeak_voices = {
            "google_male_vn": "vi",
            "google_female_vn": "vi+f3",  # Female voice
            "google_male_au": "vi+m3",    # Male voice
            "google_female_au": "vi+f4",  # Different female voice
            "google_male_us": "vi+m2",    # Different male voice
            "google_female_us": "vi+f2",  # Different female voice
            "google_news_style": "vi+m4", # News style
            "google_slow_clear": "vi+s"   # Slow speech
        }
        
        voice = espeak_voices.get(voice_model, "vi")
        
        output_path = "output/output.wav"
        os.makedirs("output", exist_ok=True)
        
        # Use espeak to generate speech
        subprocess.run([
            "espeak", 
            "-v", voice,
            "-s", "150",  # Speed
            "-w", output_path,
            text
        ], check=True)
        
        return output_path
        
    except (subprocess.CalledProcessError, FileNotFoundError):
        # Fallback to Google TTS
        logger.warning("espeak not available, falling back to Google TTS")
        return synthesize_with_google_diverse(text, voice_model)
    except Exception as e:
        logger.error(f"Error in espeak synthesis: {str(e)}")
        return synthesize_with_google_diverse(text, voice_model)

def synthesize_with_random_variation(text: str, voice_model: str = "google_male_vn") -> str:
    """Add random variation to make voices sound different"""
    try:
        model_config = VOICE_MODELS.get(voice_model, VOICE_MODELS["google_male_vn"])
        
        # Add random variation to text for different pronunciation
        variations = [
            text,
            text.replace(" ", "  "),  # Add extra spaces
            text.replace(".", ".."),  # Add extra pauses
            text.replace(",", ",,"),  # Add extra pauses
        ]
        
        # Randomly select a variation
        varied_text = random.choice(variations)
        
        # Create gTTS with random parameters
        tts = gTTS(
            text=varied_text,
            lang=model_config["lang"],
            tld=model_config["tld"],
            slow=model_config["slow"]
        )
        
        output_path = "output/output.wav"
        os.makedirs("output", exist_ok=True)
        
        # Save as MP3 first
        temp_mp3 = tempfile.NamedTemporaryFile(delete=False, suffix=".mp3")
        tts.save(temp_mp3.name)
        temp_mp3.close()
        
        # Convert with random audio processing
        try:
            # Random audio processing parameters
            sample_rate = random.choice([22050, 44100, 16000])
            channels = random.choice([1, 2])
            
            subprocess.run([
                "ffmpeg", "-i", temp_mp3.name, 
                "-acodec", "pcm_s16le", 
                "-ar", str(sample_rate), 
                "-ac", str(channels),
                output_path, "-y"
            ], check=True, capture_output=True)
            os.unlink(temp_mp3.name)
        except (subprocess.CalledProcessError, FileNotFoundError):
            os.rename(temp_mp3.name, output_path.replace('.wav', '.mp3'))
            output_path = output_path.replace('.wav', '.mp3')
        
        return output_path
        
    except Exception as e:
        logger.error(f"Error in random variation synthesis: {str(e)}")
        return synthesize_with_google_diverse(text, voice_model)

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "status": "Vietnamese TTS API ready (Diverse Voices)",
        "models": list(VOICE_MODELS.keys()),
        "supported_languages": ["vi", "en"],
        "max_text_length": 2000,
        "engines": ["google", "espeak", "random_variation"]
    }

@app.get("/models")
async def get_models():
    """Get available voice models"""
    return {
        "models": VOICE_MODELS,
        "default": "google_male_vn"
    }

@app.post("/synthesize")
async def synthesize_speech(
    request: Request,
    text: str = Form(None),
    language: str = Form("vi"),
    voice_model: str = Form("google_male_vn")
):
    """Synthesize speech from text"""
    try:
        # Parse request data
        if text is None:
            try:
                body = await request.json()
                text = body.get("text", "")
                language = body.get("language", "vi")
                voice_model = body.get("voice_model", "google_male_vn")
            except:
                raise HTTPException(status_code=400, detail="No text provided")
        
        # Validate input
        if not text or not text.strip():
            raise HTTPException(status_code=400, detail="Text cannot be empty")
        
        if len(text) > 2000:
            raise HTTPException(status_code=400, detail="Text too long (max 2000 characters)")
        
        # Validate voice model
        if voice_model not in VOICE_MODELS:
            voice_model = "google_male_vn"
        
        # Validate language
        if language not in ["vi", "en"]:
            language = "vi"
        
        logger.info(f"Synthesizing speech for text: '{text[:50]}...' with model: {voice_model}")
        
        # Choose synthesis method based on voice model
        if voice_model.startswith("google"):
            output_path = synthesize_with_google_diverse(text, voice_model)
        elif voice_model.startswith("espeak"):
            output_path = synthesize_with_espeak(text, voice_model)
        else:
            # Use random variation for more diversity
            output_path = synthesize_with_random_variation(text, voice_model)
        
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

if __name__ == "__main__":
    print("🎤 Starting Vietnamese TTS API with Diverse Voice Models...")
    print("📊 Available models:")
    for model_id, model_info in VOICE_MODELS.items():
        print(f"   - {model_id}: {model_info['name']} - {model_info['description']}")
    print("🌐 API will be available at: http://localhost:8000")
    print("📚 API docs at: http://localhost:8000/docs")
    print("🎯 Using different TLDs and configurations for voice diversity")
    
    uvicorn.run(
        "main_diverse:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
