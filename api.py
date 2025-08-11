# api.py

import pytesseract
from flask import Flask, request, jsonify
from flask_cors import CORS
from PIL import Image, ImageEnhance, ImageFilter
import fitz  # PyMuPDF
import docx
import io

app = Flask(__name__)
CORS(app)

# Helper OCR function
def ocr_image(img, psm=4):
    """Performs OCR on a PIL image with a given Page Segmentation Mode."""
    gray = img.convert('L')
    gray = ImageEnhance.Contrast(gray).enhance(2)
    config = f'--oem 3 --psm {psm}'
    return pytesseract.image_to_string(gray, config=config).strip()


@app.route('/api/extract-text', methods=['POST'])
def extract_text_from_file():
    if 'file' not in request.files:
        return jsonify({"error": "No file part in the request"}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No file selected"}), 400

    filename = file.filename.lower()
    final_text = ""

    try:
        file_content = file.read()
        
        # --- ROBUST PDF PROCESSING ---
        if filename.endswith('.pdf'):
            pdf_doc = fitz.open(stream=file_content, filetype="pdf")
            all_page_texts = []
            for page_num, page in enumerate(pdf_doc):
                # First, try to extract text directly
                page_text = page.get_text().strip()
                
                # If direct text extraction yields little or no text, it's likely a scanned image.
                # We will then perform OCR. A threshold of 20 characters is a reasonable guess.
                if len(page_text) < 20:
                    pix = page.get_pixmap(dpi=200) # Render page to an image
                    img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
                    # Use the OCR function to get text from the image
                    page_text = ocr_image(img, psm=4) # psm 4 is good for pages with variable layout
                
                all_page_texts.append(page_text)
            
            final_text = "\n\n".join(all_page_texts)

        elif filename.endswith('.docx'):
            doc = docx.Document(io.BytesIO(file_content))
            final_text = "\n".join([para.text for para in doc.paragraphs])

        elif filename.endswith(('.png', '.jpg', '.jpeg')):
            img = Image.open(io.BytesIO(file_content))
            final_text = ocr_image(img)

        else:
            return jsonify({"error": "Unsupported file type"}), 400

        return jsonify({"extracted_text": final_text})

    except Exception as e:
        # Print a more detailed error to the backend console for debugging
        print(f"ERROR in /api/extract-text: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": "Failed to process the file. Check server logs for details."}), 500


@app.route('/api/ocr-image', methods=['POST'])
def ocr_cropped_image():
    if 'cropped_image' not in request.files:
        return jsonify({"error": "No cropped_image part in the request"}), 400
    
    file = request.files['cropped_image']
    if file.filename == '':
        return jsonify({"error": "No file selected for cropping"}), 400

    try:
        img = Image.open(file.stream)
        # For cropped snippets, PSM 6 is usually best
        extracted_text = ocr_image(img, psm=6)
        return jsonify({"extracted_text": extracted_text})

    except Exception as e:
        print(f"ERROR in /api/ocr-image: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": "Failed to perform OCR on the cropped image."}), 500


if __name__ == '__main__':
    app.run(debug=True)