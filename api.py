# api.py

import pytesseract
from flask import Flask, request, jsonify
from flask_cors import CORS
from PIL import Image, ImageEnhance, ImageFilter
import io
import fitz  # PyMuPDF

# --- Setup ---
app = Flask(__name__)
CORS(app)
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'


@app.route('/api/extract-text', methods=['POST'])
def extract_text_from_image():
    if 'file' not in request.files:
        return jsonify({"error": "No file part in the request"}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No file selected"}), 400

    try:
        image_content = file.read()
        
        # --- PDF to Image Conversion with HIGHER RESOLUTION ---
        pdf_doc = fitz.open(stream=image_content, filetype="pdf")
        page = pdf_doc.load_page(0)
        
        # Increase DPI for better quality. Default is 72, 300 is good for OCR.
        pix = page.get_pixmap(dpi=300) 
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)

        # --- Image Preprocessing ---
        img = img.convert('L') # Grayscale
        enhancer = ImageEnhance.Contrast(img)
        img = enhancer.enhance(2) # Increase contrast
        
        # Use pytesseract to perform OCR
        text = pytesseract.image_to_string(img)
        
        return jsonify({"extracted_text": text})

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)
