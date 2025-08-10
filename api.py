import pytesseract
from flask import Flask, request, jsonify
from flask_cors import CORS
from PIL import Image, ImageEnhance, ImageFilter
import fitz  # PyMuPDF
import re
from collections import Counter

app = Flask(__name__)
CORS(app)

# ----------- FIELD FINDERS -----------

def most_frequent(matches):
    """Return the most common match from a list, or '' if none."""
    if not matches:
        return ""
    return Counter(matches).most_common(1)[0][0]

def find_serial_number(text):
    matches = re.findall(r"Serial\s*Number\s*[:\-]?\s*([A-Z0-9\-]+)", text, re.IGNORECASE)
    return most_frequent(matches)

def find_part_name(text):
    matches = re.findall(r"Part\s*Name\s*[:\-]?\s*(.+)", text, re.IGNORECASE)
    # Clean & filter short headings
    cleaned = [m.strip() for m in matches if len(m.strip()) > 5]
    return most_frequent(cleaned if cleaned else matches)

# ----------- OCR FUNCTION -----------

def ocr_image(img, psm):
    """Run Tesseract OCR on a PIL image with given PSM mode."""
    gray = img.convert('L')
    gray = ImageEnhance.Contrast(gray).enhance(2)
    gray = gray.filter(ImageFilter.SHARPEN)
    config = f'--oem 3 --psm {psm}'
    return pytesseract.image_to_string(gray, config=config)

# ----------- API ROUTE -----------

@app.route('/api/extract-text', methods=['POST'])
def extract_text_from_image():
    if 'file' not in request.files:
        return jsonify({"error": "No file part in the request"}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No file selected"}), 400

    try:
        file_content = file.read()
        pdf_doc = fitz.open(stream=file_content, filetype="pdf")

        all_page_texts = []
        serial_candidates = []
        part_name_candidates = []

        for page_num in range(len(pdf_doc)):
            page = pdf_doc.load_page(page_num)
            pix = page.get_pixmap(dpi=200)
            img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)

            width, height = img.size

            # Pass 1: top half with PSM 4 (better for tables/columns)
            top_half = img.crop((0, 0, width, height // 2))
            text_top = ocr_image(top_half, psm=4)

            serial_candidates.append(find_serial_number(text_top))
            part_name_candidates.append(find_part_name(text_top))

            # Pass 2: full page with PSM 6 (general text)
            text_full = ocr_image(img, psm=6)

            serial_candidates.append(find_serial_number(text_full))
            part_name_candidates.append(find_part_name(text_full))

            # Save merged text for output
            combined_text = f"{text_top}\n{text_full}".strip()
            all_page_texts.append(combined_text)

        # Pick the most frequent match from all candidates
        serial_number_final = most_frequent([s for s in serial_candidates if s])
        part_name_final = most_frequent([p for p in part_name_candidates if p])

        return jsonify({
            "extracted_text": "\n\n".join(all_page_texts),
            "serial_number": serial_number_final or "",
            "part_name": part_name_final or ""
        })

    except Exception as e:
        print(f"An error occurred: {e}")
        return jsonify({"error": "Failed to process the file. Check server logs."}), 500

# ----------- MAIN -----------

if __name__ == '__main__':
    app.run(debug=True)
