from fastapi import FastAPI, Form, HTTPException, Request
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os
import logging
from gtts import gTTS
import tempfile

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="English TTS API (Simple)",
    description="A simple REST API for converting English text to speech using Google TTS",
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

@app.get("/")
async def root():
    """Health check endpoint"""
    return {"status": "English TTS API ready (Google TTS)"}

@app.post("/synthesize")
async def synthesize_speech(request: Request, text: str = Form(None), language: str = Form("en")):
    """
    Synthesize speech from text input using Google TTS.
    Accepts either JSON with 'text' field or form data with 'text' field.
    Language options: 'en' (English), 'vi' (Vietnamese), 'ja' (Japanese), 'ko' (Korean), 'zh' (Chinese)
    """
    
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
                if 'language' in body:
                    language = body['language']
        except Exception as e:
            logger.error(f"Error parsing request: {str(e)}")
            raise HTTPException(status_code=400, detail="Invalid request format. Please provide text as JSON {'text': 'your text'} or form data")
    
    if not input_text:
        raise HTTPException(status_code=400, detail="No text provided")
    
    if not input_text.strip():
        raise HTTPException(status_code=400, detail="Empty text provided")
    
    # Limit text length for faster processing
    if len(input_text) > 2000:
        raise HTTPException(status_code=400, detail="Text too long. Please keep it under 2000 characters for faster processing.")
    
    try:
        # Ensure output directory exists
        output_dir = "output"
        os.makedirs(output_dir, exist_ok=True)
        
        # Define output file path
        output_file = os.path.join(output_dir, "output.wav")
        
        logger.info(f"Synthesizing speech for text: '{input_text[:50]}...'")
        
        # Use Google TTS (much faster and more reliable)
        tts = gTTS(text=input_text, lang=language, slow=False)
        tts.save(output_file)
        
        logger.info(f"Speech synthesized successfully. Saved to: {output_file}")
        
        # Return the audio file
        return FileResponse(
            path=output_file,
            media_type="audio/mpeg",
            filename="output.mp3"
        )
        
    except Exception as e:
        logger.error(f"Error synthesizing speech: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error synthesizing speech: {str(e)}")

if __name__ == "__main__":
    uvicorn.run(
        "main_simple:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
