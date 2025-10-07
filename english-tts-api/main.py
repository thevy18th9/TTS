from fastapi import FastAPI, Form, HTTPException, Request
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os
import logging
from TTS.api import TTS
from pydantic import BaseModel
from typing import Optional
import json

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="English TTS API",
    description="A REST API for converting English text to speech using Coqui-TTS",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variable to store the TTS model
tts_model = None

# Pydantic model for JSON input
class TextInput(BaseModel):
    text: str

@app.on_event("startup")
async def startup_event():
    """Initialize the TTS model on startup"""
    global tts_model
    try:
        logger.info("Loading TTS model...")
        # Initialize TTS model for CPU only with optimized settings
        # Using a simpler, faster model
        tts_model = TTS(
            model_name="tts_models/en/ljspeech/speaker_adaptation", 
            progress_bar=False,
            gpu=False  # Force CPU only
        )
        logger.info("TTS model loaded successfully!")
        logger.info("English TTS API is ready to serve requests")
    except Exception as e:
        logger.error(f"Failed to load TTS model: {str(e)}")
        raise e

@app.get("/")
async def root():
    """Health check endpoint"""
    return {"status": "English TTS API ready"}

@app.post("/synthesize")
async def synthesize_speech(request: Request, text: Optional[str] = Form(None)):
    """
    Synthesize speech from text input.
    Accepts either JSON with 'text' field or form data with 'text' field.
    """
    global tts_model
    
    if tts_model is None:
        raise HTTPException(status_code=503, detail="TTS model not loaded")
    
    # Get text from either JSON input or form data
    input_text = None
    
    # Check if it's form data first
    if text:
        input_text = text
    else:
        # Try to parse as JSON
        try:
            body = await request.json()
            if isinstance(body, dict) and 'text' in body:
                input_text = body['text']
        except Exception as e:
            logger.error(f"Error parsing request: {str(e)}")
            raise HTTPException(status_code=400, detail="Invalid request format. Please provide text as JSON {'text': 'your text'} or form data")
    
    if not input_text:
        raise HTTPException(status_code=400, detail="No text provided")
    
    if not input_text.strip():
        raise HTTPException(status_code=400, detail="Empty text provided")
    
    # Limit text length for faster processing
    if len(input_text) > 200:
        raise HTTPException(status_code=400, detail="Text too long. Please keep it under 200 characters for faster processing.")
    
    try:
        # Ensure output directory exists
        output_dir = "output"
        os.makedirs(output_dir, exist_ok=True)
        
        # Define output file path
        output_file = os.path.join(output_dir, "output.wav")
        
        logger.info(f"Synthesizing speech for text: '{input_text[:50]}...'")
        
        # Synthesize speech with optimized settings for speed and quality
        tts_model.tts_to_file(
            text=input_text, 
            file_path=output_file,
            speaker_wav=None,  # Use default voice
            split_sentences=True,  # Split long text into sentences
            use_cuda=False  # Force CPU
        )
        
        logger.info(f"Speech synthesized successfully. Saved to: {output_file}")
        
        # Return the audio file
        return FileResponse(
            path=output_file,
            media_type="audio/wav",
            filename="output.wav"
        )
        
    except Exception as e:
        logger.error(f"Error synthesizing speech: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error synthesizing speech: {str(e)}")

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
