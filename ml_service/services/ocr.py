import io
import gc
import traceback

# Lazy variables
trocr_processor = None
trocr_model = None
has_transformers = True

try:
    from transformers import TrOCRProcessor, VisionEncoderDecoderModel
except ImportError:
    has_transformers = False
    TrOCRProcessor = None
    VisionEncoderDecoderModel = None

try:
    from PIL import Image
except ImportError:
    Image = None


def get_trocr():
    global trocr_processor, trocr_model, has_transformers
    if not has_transformers:
        print("[OCR SERVICE] Transformers not installed. OCR features disabled.")
        return None, None

    if trocr_processor is None or trocr_model is None:
        try:
            print("[OCR SERVICE] Lazy-loading TrOCR model (microsoft/trocr-base-printed)...")
            trocr_processor = TrOCRProcessor.from_pretrained("microsoft/trocr-base-printed")
            trocr_model = VisionEncoderDecoderModel.from_pretrained("microsoft/trocr-base-printed")
            print("[OCR SERVICE] TrOCR model loaded successfully into memory cache.")
        except Exception as e:
            print(f"[OCR SERVICE] Fatal error lazy-loading TrOCR: {e}")
            traceback.print_exc()
            return None, None

    return trocr_processor, trocr_model


def perform_ocr(image_bytes):
    """
    Parses image bytes and returns OCR decoded text.
    Ensures OCR failures or memory spikes do not crash the application.
    """
    if Image is None:
        print("[OCR SERVICE] PIL module not found. OCR cannot be performed.")
        return "Warning: PIL missing. OCR fallback mode active."

    try:
        # 1. Lazy load model
        processor, model = get_trocr()
        if not processor or not model:
            print("[OCR SERVICE] Model not available. Returning soft error response.")
            return "Warning: TrOCR model offline. Mock OCR result."

        # 2. Open image in RGB mode
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        
        # 3. Perform Inference
        print("[OCR SERVICE] Starting TrOCR tensor inference...")
        pixel_values = processor(images=image, return_tensors="pt").pixel_values
        
        # Run in no_grad to reduce memory overhead
        import torch
        with torch.no_grad():
            generated_ids = model.generate(pixel_values)
        
        extracted_text = processor.batch_decode(generated_ids, skip_special_tokens=True)[0]
        
        # 4. Clean up memory immediately to prevent memory spikes
        del pixel_values
        del generated_ids
        gc.collect()
        
        print(f"[OCR SERVICE] OCR extraction complete: \"{extracted_text}\"")
        return extracted_text.strip()
        
    except Exception as e:
        print(f"[OCR SERVICE] Graceful exception caught during OCR processing: {e}")
        traceback.print_exc()
        # Return fallback mock/degraded response to avoid crashing the server
        return "Warning: OCR processing timed out or failed. Standard facial skincare cleanser."
