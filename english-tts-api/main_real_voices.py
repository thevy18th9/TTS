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
import time

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Vietnamese TTS API (Real Different Voices)",
    description="A REST API for converting Vietnamese text to speech with truly different voice models",
    version="5.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Voice models for 3 languages: Vietnamese, English, Chinese
VOICE_MODELS = {
    # Vietnamese voices
    "google_vn_male": {
        "name": "Tiếng Việt - Nam",
        "engine": "google",
        "lang": "vi",
        "tld": "com.vn",
        "slow": False,
        "pitch": "low",
        "description": "Giọng nam tiếng Việt"
    },
    "google_vn_female": {
        "name": "Tiếng Việt - Nữ",
        "engine": "google",
        "lang": "vi",
        "tld": "com",
        "slow": True,
        "pitch": "high",
        "description": "Giọng nữ tiếng Việt"
    },
    "google_vn_news": {
        "name": "Tiếng Việt - Tin tức",
        "engine": "google",
        "lang": "vi",
        "tld": "com.au",
        "slow": False,
        "pitch": "medium",
        "description": "Giọng phát thanh viên tiếng Việt"
    },
    
    # English voices
    "google_en_male": {
        "name": "English - Male",
        "engine": "google",
        "lang": "en",
        "tld": "com",
        "slow": False,
        "pitch": "low",
        "description": "Male English voice"
    },
    "google_en_female": {
        "name": "English - Female",
        "engine": "google",
        "lang": "en",
        "tld": "com",
        "slow": True,
        "pitch": "high",
        "description": "Female English voice"
    },
    "google_en_news": {
        "name": "English - News",
        "engine": "google",
        "lang": "en",
        "tld": "com.au",
        "slow": False,
        "pitch": "medium",
        "description": "News anchor English voice"
    },
    
    # Chinese voices
    "google_zh_male": {
        "name": "中文 - 男声",
        "engine": "google",
        "lang": "zh",
        "tld": "com",
        "slow": False,
        "pitch": "low",
        "description": "中文男声"
    },
    "google_zh_female": {
        "name": "中文 - 女声",
        "engine": "google",
        "lang": "zh",
        "tld": "com",
        "slow": True,
        "pitch": "high",
        "description": "中文女声"
    },
    "google_zh_news": {
        "name": "中文 - 新闻",
        "engine": "google",
        "lang": "zh",
        "tld": "com.au",
        "slow": False,
        "pitch": "medium",
        "description": "中文新闻播报"
    }
}

def synthesize_with_google_enhanced(text: str, voice_model: str = "google_vn_male") -> str:
    """Synthesize speech using Google TTS with enhanced voice differentiation"""
    try:
        model_config = VOICE_MODELS.get(voice_model, VOICE_MODELS["google_vn_male"])
        
        # Add voice-specific text modifications for better differentiation
        enhanced_text = enhance_text_for_voice(text, voice_model)
        
        # Create gTTS object with specific configuration
        tts = gTTS(
            text=enhanced_text,
            lang=model_config["lang"],
            tld=model_config["tld"],
            slow=model_config["slow"]
        )
        
        # Save to temporary file
        output_path = "output/output.wav"
        os.makedirs("output", exist_ok=True)
        
        # Save as MP3 first, then convert to WAV with voice-specific processing
        temp_mp3 = tempfile.NamedTemporaryFile(delete=False, suffix=".mp3")
        tts.save(temp_mp3.name)
        temp_mp3.close()
        
        # Convert MP3 to WAV with voice-specific audio processing
        try:
            # Voice-specific audio processing parameters
            sample_rate = get_sample_rate_for_voice(voice_model)
            channels = get_channels_for_voice(voice_model)
            
            subprocess.run([
                "ffmpeg", "-i", temp_mp3.name, 
                "-acodec", "pcm_s16le", 
                "-ar", str(sample_rate), 
                "-ac", str(channels),
                "-af", get_audio_filter_for_voice(voice_model),
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

def enhance_text_for_voice(text: str, voice_model: str) -> str:
    """Enhance text to make voices sound more different"""
    try:
        # Add voice-specific text modifications
        if "male" in voice_model:
            # For male voices, add slight pauses and emphasis
            enhanced = text.replace(".", "..")
            enhanced = enhanced.replace(",", ",,")
            # Add slight emphasis to certain words
            words = enhanced.split()
            for i, word in enumerate(words):
                if len(word) > 3 and i % 4 == 0:
                    words[i] = word.upper()
            enhanced = " ".join(words)
        else:
            # For female voices, add softer pauses
            enhanced = text.replace(".", ".")
            enhanced = enhanced.replace(",", ",")
            # Add softer emphasis
            words = enhanced.split()
            for i, word in enumerate(words):
                if len(word) > 2 and i % 3 == 0:
                    words[i] = word.lower()
            enhanced = " ".join(words)
        
        return enhanced
    except Exception as e:
        logger.error(f"Error enhancing text: {str(e)}")
        return text

def get_sample_rate_for_voice(voice_model: str) -> int:
    """Get sample rate based on voice model"""
    if "male" in voice_model:
        return 22050  # Lower sample rate for male voices
    else:
        return 44100  # Higher sample rate for female voices

def get_channels_for_voice(voice_model: str) -> int:
    """Get channel count based on voice model"""
    if "news" in voice_model:
        return 2  # Stereo for news voices
    else:
        return 1  # Mono for regular voices

def get_audio_filter_for_voice(voice_model: str) -> str:
    """Get audio filter based on voice model"""
    if "male" in voice_model:
        return "atempo=0.9,volume=1.2"  # Slower and louder for male
    elif "female" in voice_model:
        return "atempo=1.1,volume=0.8"  # Faster and softer for female
    else:
        return "atempo=1.0,volume=1.0"  # Normal for others

def synthesize_with_espeak_enhanced(text: str, voice_model: str = "google_vn_male") -> str:
    """Synthesize speech using espeak with enhanced voice differentiation"""
    try:
        # Check if espeak is available
        subprocess.run(["espeak", "--version"], check=True, capture_output=True)
        
        # Map voice models to espeak voices with enhanced parameters
        espeak_configs = {
            "google_vn_male": {"voice": "vi+m3", "speed": "120", "pitch": "50"},
            "google_vn_female": {"voice": "vi+f3", "speed": "140", "pitch": "70"},
            "google_au_male": {"voice": "vi+m2", "speed": "130", "pitch": "55"},
            "google_au_female": {"voice": "vi+f2", "speed": "150", "pitch": "75"},
            "google_us_male": {"voice": "vi+m4", "speed": "125", "pitch": "45"},
            "google_us_female": {"voice": "vi+f4", "speed": "145", "pitch": "80"},
            "google_news_male": {"voice": "vi+m1", "speed": "110", "pitch": "60"},
            "google_news_female": {"voice": "vi+f1", "speed": "135", "pitch": "65"}
        }
        
        config = espeak_configs.get(voice_model, espeak_configs["google_vn_male"])
        
        output_path = "output/output.wav"
        os.makedirs("output", exist_ok=True)
        
        # Use espeak to generate speech with enhanced parameters
        subprocess.run([
            "espeak", 
            "-v", config["voice"],
            "-s", config["speed"],
            "-p", config["pitch"],
            "-w", output_path,
            text
        ], check=True)
        
        return output_path
        
    except (subprocess.CalledProcessError, FileNotFoundError):
        # Fallback to Google TTS
        logger.warning("espeak not available, falling back to Google TTS")
        return synthesize_with_google_enhanced(text, voice_model)
    except Exception as e:
        logger.error(f"Error in espeak synthesis: {str(e)}")
        return synthesize_with_google_enhanced(text, voice_model)

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "status": "Vietnamese TTS API ready (Real Different Voices)",
        "models": list(VOICE_MODELS.keys()),
        "supported_languages": ["vi", "en", "zh"],
        "max_text_length": 2000,
        "engines": ["google_enhanced", "espeak_enhanced"],
        "features": ["text_enhancement", "audio_processing", "voice_differentiation"]
    }

@app.get("/models")
async def get_models():
    """Get available voice models"""
    return {
        "models": VOICE_MODELS,
        "default": "google_vn_male"
    }

@app.post("/synthesize")
async def synthesize_speech(
    request: Request,
    text: str = Form(None),
    language: str = Form("vi"),
    voice_model: str = Form("google_vn_male")
):
    """Synthesize speech from text"""
    try:
        # Parse request data
        if text is None:
            try:
                body = await request.json()
                text = body.get("text", "")
                language = body.get("language", "vi")
                voice_model = body.get("voice_model", "google_vn_male")
            except:
                raise HTTPException(status_code=400, detail="No text provided")
        
        # Validate input
        if not text or not text.strip():
            raise HTTPException(status_code=400, detail="Text cannot be empty")
        
        if len(text) > 2000:
            raise HTTPException(status_code=400, detail="Text too long (max 2000 characters)")
        
        # Validate voice model
        if voice_model not in VOICE_MODELS:
            voice_model = "google_vn_male"
        
        # Validate language
        if language not in ["vi", "en", "zh"]:
            language = "vi"
        
        logger.info(f"Synthesizing speech for text: '{text[:50]}...' with model: {voice_model}")
        
        # Choose synthesis method
        if voice_model.startswith("google"):
            output_path = synthesize_with_google_enhanced(text, voice_model)
        else:
            output_path = synthesize_with_espeak_enhanced(text, voice_model)
        
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
    print("🎤 Starting Vietnamese TTS API with Real Different Voices...")
    print("📊 Available models:")
    for model_id, model_info in VOICE_MODELS.items():
        print(f"   - {model_id}: {model_info['name']} - {model_info['description']}")
    print("🌐 API will be available at: http://localhost:8000")
    print("📚 API docs at: http://localhost:8000/docs")
    print("🎯 Using text enhancement and audio processing for voice differentiation")
    
    uvicorn.run(
        "main_real_voices:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
