# api.py

import pytesseract
from flask import Flask, request, jsonify
from flask_cors import CORS
from PIL import Image, ImageEnhance, ImageFilter
import fitz  # PyMuPDF
import re
from collections import Counter

app = Flask(__name__)
CORS(app)

# ----------- UTILITY FUNCTION -----------

def most_frequent(matches):
    """Return the most common match from a list, or '' if none."""
    if not matches:
        return ""
    return Counter(matches).most_common(1)[0][0]

# ----------- FIELD FINDERS (IMPROVED LOGIC) -----------

def find_vendor_number(text):
    """
    NEW FUNCTION: Finds a 6-digit vendor number.
    Looks for the word "Vendor" followed by a newline (or not) and then exactly 6 digits.
    This pattern matches the layout in your "Purchase order.pdf".
    - \n?       -> Matches an optional newline character.
    - (\d{6})   -> Captures a group of exactly 6 digits.
    """
    matches = re.findall(r"Vendor\s*\n?\s*(\d{6})", text, re.IGNORECASE)
    return most_frequent(matches)

def find_serial_number(text):
    """
    Finds a serial number. The regex now stops before hitting other known fields.
    """
    matches = re.findall(r"Serial\s*Number\s*[:\-]?\s*(.+?)(?=\s*CMM\s*PROGRAM|\n|$)", text, re.IGNORECASE)
    cleaned = [m.strip() for m in matches if m.strip()]
    return most_frequent(cleaned)

def find_part_name(text):
    """
    Finds the part name using a non-greedy regex.
    """
    matches = re.findall(r"Part\s*Name\s*[:\-]?\s*(.+?)(?=\s*PART\s*NUMBER|\s*METHOD|\n|$)", text, re.IGNORECASE)
    cleaned = [m.strip() for m in matches if len(m.strip()) > 3]
    return most_frequent(cleaned)

# ----------- OCR FUNCTION -----------

def ocr_image(img, psm):
    """Run Tesseract OCR on a PIL image with a given Page Segmentation Mode (PSM)."""
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
        # Add a list for vendor number candidates
        vendor_candidates = []
        serial_candidates = []
        part_name_candidates = []

        for page_num in range(len(pdf_doc)):
            page = pdf_doc.load_page(page_num)
            pix = page.get_pixmap(dpi=200)
            img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)

            # --- Multi-pass OCR for better accuracy ---
            for psm_mode in [6, 4]: # Run with both PSM 6 and 4
                text = ocr_image(img, psm=psm_mode)
                
                # Find all fields in each pass
                vendor_candidates.append(find_vendor_number(text))
                serial_candidates.append(find_serial_number(text))
                part_name_candidates.append(find_part_name(text))
                
                all_page_texts.append(f"--- OCR Pass (PSM {psm_mode}) ---\n{text}")

        # From all candidates, pick the most frequent valid one for each field
        vendor_number_final = most_frequent([v for v in vendor_candidates if v])
        serial_number_final = most_frequent([s for s in serial_candidates if s])
        part_name_final = most_frequent([p for p in part_name_candidates if p])

        # Return all the final parsed fields
        return jsonify({
            "extracted_text": "\n\n".join(all_page_texts),
            "vendor_number": vendor_number_final,
            "serial_number": serial_number_final,
            "part_name": part_name_final
        })

    except Exception as e:
        print(f"An error occurred: {e}")
        return jsonify({"error": "Failed to process the file. Check server logs."}), 500

# ----------- MAIN -----------

if __name__ == '__main__':
    app.run(debug=True)
