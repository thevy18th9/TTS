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
import azure.cognitiveservices.speech as speechsdk

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Vietnamese TTS API (Azure)",
    description="A REST API for converting Vietnamese text to speech with Azure Cognitive Services",
    version="3.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Azure Speech Service configuration
AZURE_SPEECH_KEY = os.getenv("AZURE_SPEECH_KEY", "your_azure_key_here")
AZURE_REGION = os.getenv("AZURE_REGION", "eastus")

# Vietnamese voice models with different characteristics
VOICE_MODELS = {
    "azure_male_1": {
        "name": "Nam - Trung niên",
        "voice": "vi-VN-NamMinhNeural",
        "description": "Giọng nam trung niên, ấm áp",
        "gender": "male",
        "age": "middle"
    },
    "azure_male_2": {
        "name": "Nam - Trẻ",
        "voice": "vi-VN-HoaiMyNeural", 
        "description": "Giọng nam trẻ, năng động",
        "gender": "male",
        "age": "young"
    },
    "azure_female_1": {
        "name": "Nữ - Trung niên",
        "voice": "vi-VN-HoaiMyNeural",
        "description": "Giọng nữ trung niên, dịu dàng",
        "gender": "female", 
        "age": "middle"
    },
    "azure_female_2": {
        "name": "Nữ - Trẻ",
        "voice": "vi-VN-HoaiMyNeural",
        "description": "Giọng nữ trẻ, tươi tắn",
        "gender": "female",
        "age": "young"
    },
    "azure_news": {
        "name": "Phát thanh viên",
        "voice": "vi-VN-NamMinhNeural",
        "description": "Giọng phát thanh viên chuyên nghiệp",
        "gender": "male",
        "age": "professional"
    },
    "azure_google_male": {
        "name": "Google Nam",
        "voice": "google",
        "description": "Google TTS giọng nam",
        "gender": "male",
        "age": "default"
    },
    "azure_google_female": {
        "name": "Google Nữ", 
        "voice": "google",
        "description": "Google TTS giọng nữ",
        "gender": "female",
        "age": "default"
    }
}

def synthesize_with_azure(text: str, voice_model: str = "azure_male_1") -> str:
    """Synthesize speech using Azure Cognitive Services"""
    try:
        model_config = VOICE_MODELS.get(voice_model, VOICE_MODELS["azure_male_1"])
        
        if model_config["voice"] == "google":
            # Fallback to Google TTS
            return synthesize_with_google_tts(text, voice_model)
        
        # Azure Speech Service
        speech_config = speechsdk.SpeechConfig(
            subscription=AZURE_SPEECH_KEY, 
            region=AZURE_REGION
        )
        speech_config.speech_synthesis_voice_name = model_config["voice"]
        
        # Create audio output
        output_path = "output/output.wav"
        os.makedirs("output", exist_ok=True)
        
        audio_config = speechsdk.audio.AudioOutputConfig(filename=output_path)
        
        # Create synthesizer
        synthesizer = speechsdk.SpeechSynthesizer(
            speech_config=speech_config, 
            audio_config=audio_config
        )
        
        # Synthesize
        result = synthesizer.speak_text_async(text).get()
        
        if result.reason == speechsdk.ResultReason.SynthesizingAudioCompleted:
            logger.info(f"Azure synthesis completed successfully")
            return output_path
        else:
            logger.error(f"Azure synthesis failed: {result.reason}")
            # Fallback to Google TTS
            return synthesize_with_google_tts(text, "azure_google_male")
            
    except Exception as e:
        logger.error(f"Error in Azure synthesis: {str(e)}")
        # Fallback to Google TTS
        return synthesize_with_google_tts(text, "azure_google_male")

def synthesize_with_google_tts(text: str, voice_model: str = "azure_google_male") -> str:
    """Fallback to Google TTS"""
    try:
        # Map Azure voice models to Google TTS parameters
        google_configs = {
            "azure_google_male": {"tld": "com.vn", "slow": False},
            "azure_google_female": {"tld": "com", "slow": False},
            "azure_male_1": {"tld": "com.vn", "slow": False},
            "azure_male_2": {"tld": "com.au", "slow": False},
            "azure_female_1": {"tld": "com", "slow": False},
            "azure_female_2": {"tld": "com.vn", "slow": True},
            "azure_news": {"tld": "com.au", "slow": False}
        }
        
        config = google_configs.get(voice_model, google_configs["azure_google_male"])
        
        tts = gTTS(
            text=text,
            lang="vi",
            tld=config["tld"],
            slow=config["slow"]
        )
        
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
        logger.error(f"Error in Google TTS fallback: {str(e)}")
        raise HTTPException(status_code=500, detail=f"TTS synthesis failed: {str(e)}")

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "status": "Vietnamese TTS API ready (Azure + Google)",
        "models": list(VOICE_MODELS.keys()),
        "supported_languages": ["vi", "en"],
        "max_text_length": 2000,
        "azure_configured": AZURE_SPEECH_KEY != "your_azure_key_here"
    }

@app.get("/models")
async def get_models():
    """Get available voice models"""
    return {
        "models": VOICE_MODELS,
        "default": "azure_male_1"
    }

@app.post("/synthesize")
async def synthesize_speech(
    request: Request,
    text: str = Form(None),
    language: str = Form("vi"),
    voice_model: str = Form("azure_male_1")
):
    """Synthesize speech from text"""
    try:
        # Parse request data
        if text is None:
            try:
                body = await request.json()
                text = body.get("text", "")
                language = body.get("language", "vi")
                voice_model = body.get("voice_model", "azure_male_1")
            except:
                raise HTTPException(status_code=400, detail="No text provided")
        
        # Validate input
        if not text or not text.strip():
            raise HTTPException(status_code=400, detail="Text cannot be empty")
        
        if len(text) > 2000:
            raise HTTPException(status_code=400, detail="Text too long (max 2000 characters)")
        
        # Validate voice model
        if voice_model not in VOICE_MODELS:
            voice_model = "azure_male_1"
        
        # Validate language
        if language not in ["vi", "en"]:
            language = "vi"
        
        logger.info(f"Synthesizing speech for text: '{text[:50]}...' with model: {voice_model}")
        
        # Synthesize speech
        output_path = synthesize_with_azure(text, voice_model)
        
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
    print("🎤 Starting Vietnamese TTS API with Azure + Google...")
    print("📊 Available models:")
    for model_id, model_info in VOICE_MODELS.items():
        print(f"   - {model_id}: {model_info['name']} - {model_info['description']}")
    print("🌐 API will be available at: http://localhost:8000")
    print("📚 API docs at: http://localhost:8000/docs")
    print("⚠️  Note: Azure Speech Service requires API key. Set AZURE_SPEECH_KEY environment variable.")
    
    uvicorn.run(
        "main_azure:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
