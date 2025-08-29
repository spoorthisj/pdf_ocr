import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  TextField,
  Typography,
  Grid,
  Box,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Paper,
  Stack,
  IconButton,
  InputAdornment,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  CircularProgress,
} from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import MicIcon from '@mui/icons-material/Mic';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import RotateLeftIcon from '@mui/icons-material/RotateLeft';
import RotateRightIcon from '@mui/icons-material/RotateRight';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import axios from 'axios';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/TextLayer.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import { jsPDF } from 'jspdf';
import UploadFileIcon from '@mui/icons-material/UploadFile';

// PDF.js worker setup
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

const processSpokenText = (text) => {
  return text
    .replace(/\bhash\b/gi, '#')
    .replace(/\bhyphen\b/gi, '-')
    .replace(/\bdot\b/gi, '.')
    .replace(/\bslash\b/gi, '/')
    .replace(/\bcolon\b/gi, ':')
    .replace(/\bcomma\b/gi, ',')
    .replace(/\bat\b/gi, '@')
    .replace(/\bpercent\b/gi, '%')
    .replace(/\band\b/gi, '')
    .trim();
};
const newRow = {
  field0: '',
  field1: '',
  field2: '',
  field3: '', // supplier
  customerApproval: '',
  certNumbers: [""],
  refDoc: '',
  refDocFile: null,  // Used for Supplier's List
  refDocText: '',    // Used for Supplier's List
  refDocFile2: null, // New: For Reference Document
  refDocText2: ''    // New: For Reference Document
};

const SmartTextField = React.memo(({ label, name, formData, setField, multiline, rows, ...rest }) => {
  const [showIcons, setShowIcons] = useState(false);
  const fileRef = useRef(null);
  const [imageSrc, setImageSrc] = useState(null);
  const [pdfSrc, setPdfSrc] = useState(null);
  const [crop, setCrop] = useState();
  const imgRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [speechError, setSpeechError] = useState(null);
  const [speechInfo, setSpeechInfo] = useState(null);
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const pageRef = useRef(null);
  const [isPdfWorkerLoaded, setIsPdfWorkerLoaded] = useState(false);

  // Zoom/Rotate states
  const [imgZoom, setImgZoom] = useState(1);
  const [imgRotation, setImgRotation] = useState(0); // 0,90,180,270 (applied on extraction)
  const [pdfScale, setPdfScale] = useState(1.2);
  const [pdfRotation, setPdfRotation] = useState(0); // applied to preview + extraction canvas

  // Flag: after saying "consider COC number", next OCR/voice for this field is prepended, not replaced/appended
  const prependNextFromCamera = useRef(false);

  useEffect(() => {
    if (pdfjs.GlobalWorkerOptions.workerSrc) {
      setIsPdfWorkerLoaded(true);
    }
  }, []);

  const handleSpeechInput = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechError('Speech recognition not supported in this browser.');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.onresult = (ev) => {
      const transcript = ev.results[0][0].transcript || '';
      const processed = processSpokenText(transcript);
      const lower = transcript.toLowerCase();

      // Voice intent: "consider COC number"
      if (lower.includes('consider') && (lower.includes('coc') || lower.includes('c o c'))) {
        prependNextFromCamera.current = true;
        setSpeechInfo('Okay — next OCR/voice number will be added IN FRONT of this COC number.');
        return;
      }

      if (name === 'certNumbers' && prependNextFromCamera.current) {
        setField(name, (processed + ' ' + (formData || '')).trim());
        prependNextFromCamera.current = false;
      } else {
        setField(name, ((formData || '') + ' ' + processed).trim());
      }
    };
    recognition.onerror = (ev) => {
      console.error('Speech error', ev);
      setSpeechError('Speech recognition error: ' + (ev.error || 'unknown'));
    };
    recognition.start();
  };

  const handleCameraClick = () => {
    fileRef.current?.click();
  };

  const onSelectFile = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    setError(null);

    if (file.type === 'application/pdf') {
      if (!isPdfWorkerLoaded) {
        setError('PDF viewer is not ready. Please try again.');
        return;
      }
      setPdfSrc(file);
      setPdfDialogOpen(true);
      setCrop(undefined);
      setPdfScale(1.2);
      setPdfRotation(0);
    } else if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setImageSrc(event.target.result);
        setOpen(true);
        setCrop(undefined);
        setImgZoom(1);
        setImgRotation(0);
      };
      reader.onerror = (err) => {
        console.error('FileReader error:', err);
        setError('Failed to read the image file.');
      };
      reader.readAsDataURL(file);
    } else {
      setError('Unsupported file type. Please select an image or a PDF.');
    }
  };

  const onDocumentLoadSuccess = useCallback(({ numPages }) => {
    setNumPages(numPages);
    setPageNumber(1);
    setError(null);
    setCrop(undefined);
  }, []);

  const onDocumentLoadError = useCallback((error) => {
    console.error('Failed to load PDF document:', error);
    setError('Failed to load PDF file. The file may be corrupted or invalid.');
    setPdfSrc(null);
  }, []);

  const onPageRenderSuccess = useCallback(() => {
    setCrop(undefined);
  }, []);

  const toBlobAsync = (canvas, type = 'image/jpeg', quality = 0.9) =>
    new Promise((resolve) => {
      if (!canvas.toBlob) {
        const dataURL = canvas.toDataURL(type, quality);
        const byteString = atob(dataURL.split(',')[1]);
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
        const blob = new Blob([ab], { type });
        resolve(blob);
      } else {
        canvas.toBlob((blob) => resolve(blob), type, quality);
      }
    });

  const handlePdfCropComplete = async () => {
    if (!pageRef.current || !crop?.width || !crop?.height) {
      setPdfDialogOpen(false);
      return;
    }
    setPdfDialogOpen(false);
    setLoading(true);
    setError(null);
    try {
      const canvas = pageRef.current;
      if (!canvas) throw new Error('Rendered PDF page canvas not available.');
      const scaleX = canvas.width / canvas.clientWidth;
      const scaleY = canvas.height / canvas.clientHeight;
      const croppedCanvas = document.createElement('canvas');
      croppedCanvas.width = Math.round(crop.width * scaleX);
      croppedCanvas.height = Math.round(crop.height * scaleY);
      const ctx = croppedCanvas.getContext('2d');
      ctx.drawImage(
        canvas,
        Math.round(crop.x * scaleX),
        Math.round(crop.y * scaleY),
        Math.round(crop.width * scaleX),
        Math.round(crop.height * scaleY),
        0,
        0,
        croppedCanvas.width,
        croppedCanvas.height
      );

      const croppedImageBlob = await toBlobAsync(croppedCanvas, 'image/jpeg', 0.9);
      const requestFormData = new FormData();
      requestFormData.append('cropped_image', croppedImageBlob, 'cropped.jpg');
      const response = await axios.post('http://127.0.0.1:5000/api/ocr-image', requestFormData);
      const extractedText = (response.data.extracted_text || '').trim();

      if (name === 'certNumbers' && prependNextFromCamera.current) {
        setField(name, ((extractedText + ' ' + (formData || '')).trim()));
        prependNextFromCamera.current = false;
      } else {
        setField(name, (((formData || '') + ' ' + extractedText).trim()));
      }
    } catch (error) {
      console.error('PDF OCR extraction failed:', error);
      if (error.response) {
        setError(`Server Error: ${error.response.status} - ${error.response.data.error || 'Unknown error'}`);
      } else if (error.request) {
        setError('Network Error: The backend server is not running or is unreachable.');
      } else {
        setError(error.message || 'An unexpected error occurred during the OCR process.');
      }
    } finally {
      setLoading(false);
      setPdfSrc(null);
      setCrop(undefined);
      setPdfScale(1.2);
      setPdfRotation(0);
    }
  };

  // Rotate a canvas by multiples of 90 degrees
  const rotateCanvas = (srcCanvas, degrees) => {
    const out = document.createElement('canvas');
    const ctx = out.getContext('2d');
    const rad = (degrees % 360) * Math.PI / 180;

    if (degrees % 180 === 0) {
      out.width = srcCanvas.width;
      out.height = srcCanvas.height;
    } else {
      out.width = srcCanvas.height;
      out.height = srcCanvas.width;
    }

    ctx.translate(out.width / 2, out.height / 2);
    ctx.rotate(rad);
    ctx.drawImage(srcCanvas, -srcCanvas.width / 2, -srcCanvas.height / 2);
    return out;
  };

  const handleImageCropComplete = async () => {
    if (!imgRef.current || !crop?.width || !crop?.height) {
      setOpen(false);
      setImageSrc(null);
      return;
    }
    setOpen(false);
    setLoading(true);
    setError(null);
    try {
      const image = imgRef.current;
      const scaleX = image.naturalWidth / image.width;
      const scaleY = image.naturalHeight / image.height;

      // First, crop the selected region into a canvas
      const cropCanvas = document.createElement('canvas');
      cropCanvas.width = Math.round(crop.width * scaleX);
      cropCanvas.height = Math.round(crop.height * scaleY);
      const cctx = cropCanvas.getContext('2d');
      cctx.drawImage(
        image,
        crop.x * scaleX,
        crop.y * scaleY,
        crop.width * scaleX,
        crop.height * scaleY,
        0,
        0,
        cropCanvas.width,
        cropCanvas.height
      );

      // Apply rotation to the cropped region if requested (display remains unrotated)
      const finalCanvas = imgRotation ? rotateCanvas(cropCanvas, imgRotation) : cropCanvas;

      const croppedImageBlob = await toBlobAsync(finalCanvas, 'image/jpeg', 0.9);
      const requestFormData = new FormData();
      requestFormData.append('cropped_image', croppedImageBlob, 'cropped.jpg');
      const response = await axios.post('http://127.0.0.1:5000/api/ocr-image', requestFormData);
      const extractedText = (response.data.extracted_text || '').trim();

      if (name === 'certNumbers' && prependNextFromCamera.current) {
        setField(name, ((extractedText + ' ' + (formData || '')).trim()));
        prependNextFromCamera.current = false;
      } else {
        setField(name, (((formData || '') + ' ' + extractedText).trim()));
      }
    } catch (error) {
      console.error('OCR extraction failed:', error);
      if (error.response) {
        setError(`Server Error: ${error.response.status} - ${error.response.data.error || 'Unknown error'}`);
      } else if (error.request) {
        setError('Network Error: The backend server is not running or is unreachable.');
      } else {
        setError(error.message || 'An unexpected error occurred during the OCR process.');
      }
    } finally {
      setLoading(false);
      setImageSrc(null);
      setCrop(undefined);
      setImgZoom(1);
      setImgRotation(0);
    }
  };

  const isExtractButtonDisabled = !crop?.width || !crop?.height;

  return (
    <>
      <TextField
  fullWidth
  size="small"
  label={label}
  value={formData || ''}
  onChange={(e) => setField(name, e.target.value)}
  onFocus={() => setShowIcons(true)}
  onBlur={() => setTimeout(() => setShowIcons(false), 180)}
  multiline
  minRows={rows || 1}
  maxRows={8}   // lets the box grow up to 8 lines
  InputProps={{
    sx: {
      '& .MuiInputBase-input': {
        overflowX: 'auto',       // ✅ horizontal scroll if text too long
        whiteSpace: 'pre-wrap',  // ✅ allow wrapping
        wordBreak: 'break-word', // ✅ break long words
      },
    },
          endAdornment: showIcons && (
            <InputAdornment position="end">
              <IconButton
                size="small"
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleSpeechInput}
                aria-label={`speak ${label}`}
              >
                <MicIcon sx={{ color: '#1976d2' }} />
              </IconButton>
              <IconButton
                size="small"
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleCameraClick}
                aria-label={`camera ${label}`}
              >
                <CameraAltIcon sx={{ color: '#1976d2' }} />
              </IconButton>

              {/* ➕ Add button only for Certificate Number field */}
              {name === 'certNumbers' && rest.onAddExtra && (
                <IconButton
                  size="small"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={rest.onAddExtra}
                  aria-label="add extra cert number"
                >
                  <AddIcon sx={{ color: 'green' }} />
                </IconButton>
              )}
            </InputAdornment>
          ),
        }}
        disabled={loading}
        {...rest}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*, .pdf"
        capture="environment"
        style={{ display: 'none' }}
        onChange={onSelectFile}
      />

      {/* Dialog for Image Cropping */}
      <Dialog open={open} onClose={() => { setOpen(false); setImageSrc(null); setCrop(undefined); }} maxWidth="md" fullWidth>
        <DialogTitle>
          Crop Image for OCR
          {isExtractButtonDisabled && (
            <Typography variant="caption" color="text.secondary" sx={{ ml: 2 }}>
              Please select a crop area.
            </Typography>
          )}
        </DialogTitle>
        <DialogContent dividers>
          {/* Controls: Zoom & Rotation */}
<Box sx={{ display: "flex", justifyContent: "center", gap: 2, mb: 2, flexWrap: "wrap" }}>
  <Button startIcon={<ZoomOutIcon />} onClick={() => setImgZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(2)))}>ZOOM OUT</Button>
  <Button startIcon={<ZoomInIcon />} onClick={() => setImgZoom((z) => Math.min(3, +(z + 0.1).toFixed(2)))}>ZOOM IN</Button>
  <Button startIcon={<RotateLeftIcon />} onClick={() => setImgRotation((r) => (r + 270) % 360)}>ROTATE -90°</Button>
  <Button startIcon={<RotateRightIcon />} onClick={() => setImgRotation((r) => (r + 90) % 360)}>ROTATE +90°</Button>
  <Button startIcon={<RestartAltIcon />} onClick={() => { setImgZoom(1); setImgRotation(0); }}>RESET</Button>
</Box>


          {imageSrc && (
            <ReactCrop crop={crop} onChange={(c) => setCrop(c)}>
              <img
                ref={imgRef}
                src={imageSrc}
                alt="Crop Me"
                style={{ width: `${imgZoom * 100}%`, display: 'block' }}
              />
            </ReactCrop>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setOpen(false); setImageSrc(null); setCrop(undefined); }} color="secondary">
            Cancel
          </Button>
          <Button
            onClick={handleImageCropComplete}
            color="primary"
            variant="contained"
            disabled={isExtractButtonDisabled}
          >
            Extract Text
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog for PDF Cropping */}
      <Dialog open={pdfDialogOpen} onClose={() => { setPdfDialogOpen(false); setPdfSrc(null); setCrop(undefined); }} maxWidth="md" fullWidth>
        <DialogTitle>
          Crop PDF for OCR
          {isExtractButtonDisabled && (
            <Typography variant="caption" color="text.secondary" sx={{ ml: 2 }}>
              Please select a crop area.
            </Typography>
          )}
        </DialogTitle>
        <DialogContent dividers>
{/* Controls: Page Navigation + Zoom + Rotation */}
<Box sx={{ display: "flex", justifyContent: "center", gap: 2, mb: 2, flexWrap: "wrap" }}>
  <Button disabled={pageNumber <= 1} onClick={() => setPageNumber((p) => p - 1)}>PREVIOUS</Button>
  <Typography variant="body1" sx={{ alignSelf: "center" }}>Page {pageNumber} of {numPages}</Typography>
  <Button disabled={pageNumber >= numPages} onClick={() => setPageNumber((p) => p + 1)}>NEXT</Button>
  <Button startIcon={<ZoomOutIcon />} onClick={() => setPdfScale((s) => Math.max(0.5, +(s - 0.1).toFixed(2)))}>ZOOM OUT</Button>
  <Button startIcon={<ZoomInIcon />} onClick={() => setPdfScale((s) => Math.min(3, +(s + 0.1).toFixed(2)))}>ZOOM IN</Button>
  <Button startIcon={<RotateLeftIcon />} onClick={() => setPdfRotation((r) => (r + 270) % 360)}>ROTATE -90°</Button>
  <Button startIcon={<RotateRightIcon />} onClick={() => setPdfRotation((r) => (r + 90) % 360)}>ROTATE +90°</Button>
  <Button startIcon={<RestartAltIcon />} onClick={() => { setPdfScale(1.2); setPdfRotation(0); }}>RESET</Button>
</Box>


          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Box sx={{ mb: 2 }}>
              <Button disabled={pageNumber <= 1} onClick={() => setPageNumber((prev) => prev - 1)}>
                Previous Page
              </Button>
              <Typography component="span" sx={{ mx: 2 }}>
                {' '}Page {pageNumber} of {numPages}{' '}
              </Typography>
              <Button disabled={pageNumber >= numPages} onClick={() => setPageNumber((prev) => prev + 1)}>
                Next Page
              </Button>
            </Box>
            <ReactCrop crop={crop} onChange={(c) => setCrop(c)}>
              <Box>
                {pdfSrc && (
                  <Document file={pdfSrc} onLoadSuccess={onDocumentLoadSuccess} onLoadError={onDocumentLoadError}>
                    <Page
                      pageNumber={pageNumber}
                      renderTextLayer={false}
                      renderAnnotationLayer={false}
                      onRenderSuccess={onPageRenderSuccess}
                      scale={pdfScale}
                      rotate={pdfRotation}
                      canvasRef={(el) => {
                        pageRef.current = el;
                      }}
                    />
                  </Document>
                )}
              </Box>
            </ReactCrop>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setPdfDialogOpen(false); setPdfSrc(null); setCrop(undefined); }} color="secondary">
            Cancel
          </Button>
          <Button
            onClick={handlePdfCropComplete}
            color="primary"
            variant="contained"
            disabled={isExtractButtonDisabled}
          >
            Extract Text
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialogs for Loading and Errors */}
      <Dialog open={loading} PaperProps={{ sx: { p: 4, display: 'flex', alignItems: 'center' } }}>
        <CircularProgress />
        <Typography variant="h6" sx={{ ml: 2 }}>
          Extracting text...
        </Typography>
      </Dialog>

      <Dialog open={!!error} onClose={() => setError(null)}>
        <DialogTitle>Error</DialogTitle>
        <DialogContent>
          <Typography>{error}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setError(null)} color="primary">
            Close
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!speechError} onClose={() => setSpeechError(null)}>
        <DialogTitle>Speech Recognition Error</DialogTitle>
        <DialogContent>
          <Typography>{speechError}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSpeechError(null)} color="primary">
            Close
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!speechInfo} onClose={() => setSpeechInfo(null)}>
        <DialogTitle>Voice Mode</DialogTitle>
        <DialogContent>
          <Typography>{speechInfo}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSpeechInfo(null)} color="primary">
            Got it
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
});

const formStyles = {
  container: {
    padding: 3,
    maxWidth: '90%',
    margin: 'auto',
  },
  box: {
    border: '1px solid #ccc',
    borderRadius: '8px',
    padding: 2,
    marginBottom: 2,
  },
  title: {
    textAlign: 'center',
    marginBottom: 2,
  },
  tableHeader: {
    fontWeight: 'bold',
    textAlign: 'center',
    backgroundColor: '#f5f5f5',
    padding: '8px 0',
  },
  tableCell: {
    border: '1px solid #ccc',
    padding: '8px',
    height: '40px',
    textAlign: 'center',
  },
  inputField: {
    '& .MuiOutlinedInput-root': {
      '& fieldset': {
        borderWidth: `1px !important`,
      },
    },
  },
};

export default function Form2SetupScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const [formData, setFormData] = useState({
    partNumber: '',
    partName: '',
    serialNumber: '',
    fairIdentifier: '',
    materials: [{ field0: '', field1: '', field2: '', field3: '', customerApproval: '', certNumbers: [""], refDoc: '', refDocFile: null, refDocText: '', refDocFile2: null, refDocText2: '' }],
    processes: [{ field0: '', field1: '', field2: '', field3: '', customerApproval: '', certNumbers: [""], refDoc: '', refDocFile: null, refDocText: '', refDocFile2: null, refDocText2: '' }],
    inspections: [{ field0: '', field1: '', field2: '', field3: '', customerApproval: '', certNumbers: [""], refDoc: '', refDocFile: null, refDocText: '', refDocFile2: null, refDocText2: '' }],
    functionalTestNumber: '',
    acceptanceReportNumber: '',
    comments: '',
  });

  useEffect(() => {
    if (location.state && location.state.form1Data) {
      const { partNumber, partName, serialNumber, fairIdentifier } = location.state.form1Data;
      setFormData((prev) => ({
        ...prev,
        partNumber: partNumber || '',
        partName: partName || '',
        serialNumber: serialNumber || '',
        fairIdentifier: fairIdentifier || '',
      }));
    }
  }, [location.state]);

  const setField = useCallback((name, value, index, section) => {
    setFormData((prev) => {
      if (index !== undefined && section) {
        const newSection = [...prev[section]];
        newSection[index] = { ...newSection[index], [name]: value };
        return { ...prev, [section]: newSection };
      } else {
        return { ...prev, [name]: value };
      }
    });
  }, []);

// --- PDF Export (fixed column mapping) ---
const handlePdfExport = () => {
  const doc = new jsPDF('p', 'mm', 'a4');
  let yPos = 15;
  const margin = 10;
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFont('helvetica');
  doc.setTextColor(51, 51, 51);

  // Title
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(
    'Form 2: Product Accountability – Materials, Special Processes, and Functional Testing',
    pageWidth / 2,
    yPos,
    { align: 'center' }
  );
  yPos += 10;

  const drawBox = (label, value, x, y, width, height) => {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(label, x + 2, y + 4);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    const lines = doc.splitTextToSize(value || '', width - 4);
    doc.rect(x, y, width, height);
    doc.text(lines, x + 2, y + 8);
  };

  const calculateBoxHeight = (value, width, minHeight) => {
    const lines = doc.splitTextToSize(value || '', width - 4);
    const textHeight = lines.length * 4;
    return Math.max(minHeight, textHeight + 6);
  };

  // ---------- Top Fields ----------
  const fieldWidth = (pageWidth - margin * 2) / 4;
  const topFields = [
    { label: '1. Part Number', value: formData.partNumber },
    { label: '2. Part Name', value: formData.partName },
    { label: '3. Serial Number', value: formData.serialNumber },
    { label: '4. FAIR Identifier', value: formData.fairIdentifier },
  ];

  const maxTopHeight = Math.max(
    ...topFields.map((f) => calculateBoxHeight(f.value, fieldWidth, 10))
  );
  topFields.forEach((field, i) => {
    drawBox(field.label, field.value, margin + i * fieldWidth, yPos, fieldWidth, maxTopHeight);
  });
  yPos += maxTopHeight + 5;

  // ---------- Table Drawing ----------
  const drawTable = (title, sectionData, headers) => {
    if (yPos + 20 > doc.internal.pageSize.getHeight() - margin) {
      doc.addPage();
      yPos = margin;
    }

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(title, margin, yPos);
    yPos += 5;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    const tableWidth = pageWidth - margin * 2;
    const colWidths = [
      tableWidth * 0.12, // 5. Material/Process Name
      tableWidth * 0.15, // 6. Specification Number
      tableWidth * 0.09, // 7. Code
      tableWidth * 0.15, // 8. Supplier
      tableWidth * 0.15, // 8a. Supplier List
      tableWidth * 0.10, // 9. Customer Approval Verification
      tableWidth * 0.13, // 10. Certificate of Conformance Number
      tableWidth * 0.13, // Reference Document
    ];

    const headerHeight = 12;
    let x = margin;
    headers.forEach((header, i) => {
      doc.rect(x, yPos, colWidths[i], headerHeight);
      const headerLines = doc.splitTextToSize(header, colWidths[i] - 2);
      const headerYOffset = (headerHeight - headerLines.length * 3.5) / 2;
      doc.text(headerLines, x + 1, yPos + 4 + headerYOffset);
      x += colWidths[i];
    });
    yPos += headerHeight;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    sectionData.forEach((row) => {
      // IMPORTANT: map to your actual fields
      // Suppliers List value lives in refDocFile/refDocText
      const suppliersListValue =
        (row.refDocFile && row.refDocFile.name) || row.refDocText || '';

      // Reference Document lives in refDocFile2 (file name only)
      const referenceDocValue =
        (row.refDocFile2 && row.refDocFile2.name) || '';

      const certs = (row.certNumbers || []).filter(Boolean).join('\n');

      const textLines = [
        doc.splitTextToSize(row.field0 || '', colWidths[0] - 2),
        doc.splitTextToSize(row.field1 || '', colWidths[1] - 2),
        doc.splitTextToSize(row.field2 || '', colWidths[2] - 2),
        doc.splitTextToSize(row.field3 || '', colWidths[3] - 2),          // Supplier
        doc.splitTextToSize(suppliersListValue, colWidths[4] - 2),         // Suppliers List (file name or OCR text)
        doc.splitTextToSize(row.customerApproval || '', colWidths[5] - 2), // 9
        doc.splitTextToSize(certs, colWidths[6] - 2),                      // 10
        doc.splitTextToSize(referenceDocValue, colWidths[7] - 2),          // Reference Document
      ];

      const cellHeights = textLines.map((lines) => lines.length * 4.5 + 2);
      const rowHeight = Math.max(...cellHeights, 7);

      if (yPos + rowHeight > doc.internal.pageSize.getHeight() - margin) {
        doc.addPage();
        yPos = margin;

        // re-draw headers on new page
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        let currentX = margin;
        headers.forEach((header, i) => {
          doc.rect(currentX, yPos, colWidths[i], headerHeight);
          const headerLines = doc.splitTextToSize(header, colWidths[i] - 2);
          const headerYOffset = (headerHeight - headerLines.length * 3.5) / 2;
          doc.text(headerLines, currentX + 1, yPos + 4 + headerYOffset);
          currentX += colWidths[i];
        });
        yPos += headerHeight;
        doc.setFont('helvetica', 'normal');
      }

      let currentX = margin;
      textLines.forEach((lines, i) => {
        doc.rect(currentX, yPos, colWidths[i], rowHeight);
        const textHeight = lines.length * 4.5;
        const verticalOffset = (rowHeight - textHeight) / 2;
        doc.text(lines, currentX + 1, yPos + verticalOffset + 4);
        currentX += colWidths[i];
      });

      yPos += rowHeight;
    });

    yPos += 5;
  };

  // ---------- Table Headers (for PDF) ----------
  const pdfTableHeaders = [
    '5. Material/Process Name',
    '6. Specification Number',
    '7. Code',
    '8. Supplier',
    '8a. Supplier List',
    '9. Customer Approval Verification',
    '10. Certificate of Conformance Number',
    'Reference Document',
  ];

  drawTable('Materials', formData.materials, pdfTableHeaders);
  drawTable('Processes', formData.processes, pdfTableHeaders);
  drawTable('Inspections', formData.inspections, pdfTableHeaders);

  // ---------- Bottom Fields ----------
  const bottomFieldWidth = (pageWidth - margin * 2) / 2;
  const maxBottomHeight = Math.max(
    calculateBoxHeight(formData.functionalTestNumber, bottomFieldWidth, 10),
    calculateBoxHeight(formData.acceptanceReportNumber, bottomFieldWidth, 10)
  );

  if (yPos + maxBottomHeight > doc.internal.pageSize.getHeight() - margin) {
    doc.addPage();
    yPos = margin;
  }

  drawBox('11. Functional Test Number', formData.functionalTestNumber, margin, yPos, bottomFieldWidth, maxBottomHeight);
  drawBox('12. Acceptance Report Number', formData.acceptanceReportNumber, margin + bottomFieldWidth, yPos, bottomFieldWidth, maxBottomHeight);

  yPos += maxBottomHeight + 5;

  const commentsHeight = calculateBoxHeight(formData.comments, pageWidth - margin * 2, 20);
  if (yPos + commentsHeight > doc.internal.pageSize.getHeight() - margin) {
    doc.addPage();
    yPos = margin;
  }
  drawBox('13. Comments', formData.comments, margin, yPos, pageWidth - margin * 2, commentsHeight);

  doc.save('FAIR_Form2_Report.pdf');
};

// Save formData to localStorage
const handleSave = () => {
  localStorage.setItem("form2Data", JSON.stringify(formData));
  alert("Form 2 data saved locally!");
};

// Load saved formData on mount
useEffect(() => {
  const savedData = localStorage.getItem("form2Data");
  if (savedData) {
    setFormData(JSON.parse(savedData));
  }
}, []);


  // --- GO TO FORM 1 FUNCTIONALITY ---
  const handleGoToForm1 = () => {
    navigate('/form1setup', {
      state: {
        form2Data: {
          partNumber: formData.partNumber,
          partName: formData.partName,
          serialNumber: formData.serialNumber,
          fairIdentifier: formData.fairIdentifier,
        }
      }
    });
  };

  const handleNextToForm3 = () => {
    navigate('/form3setup', {
      state: {
        form2Data: {
          partNumber: formData.partNumber,
          partName: formData.partName,
          serialNumber: formData.serialNumber,
          fairIdentifier: formData.fairIdentifier,
        }
      }
    });
  };

  const addTableRow = useCallback((section) => {
    const newRow = { field0: '', field1: '', field2: '', field3: '', customerApproval: '', certNumbers: [""], refDoc: '', refDocFile: null, refDocText: '' };
    setFormData((prev) => ({
      ...prev,
      [section]: [...prev[section], newRow],
    }));
  }, []);

  const deleteTableRow = useCallback((section, index) => {
    setFormData((prev) => ({
      ...prev,
      [section]: prev[section].filter((_, i) => i !== index),
    }));
  }, []);

  const customerApprovalDropdown = useCallback((section, index) => (
    <select
      style={{
        width: '100%',
        color: '#333',
        backgroundColor: '#fff',
        border: '1px solid #ccc',
        borderRadius: 4,
        padding: '6px',
      }}
      value={formData[section][index]?.customerApproval || ''}
      onChange={(e) => setField('customerApproval', e.target.value, index, section)}
    >
      <option value="">Select</option>
      <option value="Yes">Yes</option>
      <option value="No">No</option>
      <option value="N/A">N/A</option>
    </select>
  ), [formData, setField]);

  const topFields = [
    { key: 'partNumber', label: '1. Part Number' },
    { key: 'partName', label: '2. Part Name' },
    { key: 'serialNumber', label: '3. Serial Number' },
    { key: 'fairIdentifier', label: '4. FAIR Identifier' },
  ];

  const tableHeaders = [
    '5. Material/Process Name',
    '6. Specification Number',
    '7. Code',
    '8. Supplier',
    'Supplier\s List',
    '9. Customer Approval Verification',
    '10. Certificate of Conformance Number',
    'Reference Document',
    'Actions'
  ];

  const renderTableRows = useCallback(
    (section) => {
      return formData[section].map((row, index) => (
        <TableRow key={index}>
          {/* 4 Generic fields (e.g., materials, processes, etc.) */}
          {[...Array(4)].map((_, i) => {
            const fieldName = `field${i}`;
            const fieldValue = row[fieldName];
            const isVerificationField = i >= 0 && i <= 2; // For fields 5, 6, 7
            const isSupplierField = i === 3; // For field 8
  
            // Determine validation based on field and available documents
            const isSupplierMatch =
              isSupplierField &&
              row.refDocText &&
              fieldValue &&
              row.refDocText.toLowerCase().includes(fieldValue.toLowerCase());
  
            const isOtherMatch =
              isVerificationField &&
              row.refDocText2 &&
              fieldValue &&
              row.refDocText2.toLowerCase().includes(fieldValue.toLowerCase());
  
            const isError =
              (isSupplierField && row.refDocText && fieldValue && !isSupplierMatch) ||
              (isVerificationField && row.refDocText2 && fieldValue && !isOtherMatch);
  
            const isSuccess = (isSupplierField && isSupplierMatch) || (isVerificationField && isOtherMatch);
  
            return (
              <TableCell key={i}>
                <SmartTextField
                  label=""
                  name={fieldName}
                  formData={fieldValue || ''}
                  setField={(name, value) => setField(name, value, index, section)}
                  error={isError}
                  helperText={isError ? "⚠ Not found in document" : ""}
                  sx={
                    isSuccess
                      ? {
                          '& .MuiOutlinedInput-root': {
                            '& fieldset': {
                              borderColor: 'green !important',
                            },
                            '&:hover fieldset': {
                              borderColor: 'green !important',
                            },
                            '&.Mui-focused fieldset': {
                              borderColor: 'green !important',
                            },
                          },
                          '& .MuiFormHelperText-root': {
                            color: 'green !important',
                          },
                        }
                      : {}
                  }
                />
              </TableCell>
            );
          })}

           {/* Reference Document Field with file upload functionality */}
           <TableCell>
  <Box display="flex" alignItems="center">
    {/* Hidden file input */}
    <input
      id={`file-upload-${index}-${section}`}
      type="file"
      accept=".pdf,.doc,.docx,.jpg,.png"
      style={{ display: "none" }}
      onChange={async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setField("refDocFile", file, index, section);
      
        const formDataFile = new FormData();
        formDataFile.append("file", file);
      
        try {
          const response = await axios.post(
            "http://127.0.0.1:5000/api/extract-text", // Corrected URL
            formDataFile
          );
          const extractedText = response.data.extracted_text || "";
          setField("refDocText", extractedText, index, section);
        } catch (err) {
          console.error("OCR error:", err);
          setField("refDocText", "", index, section);
        }
      }}
    />

    {/* Upload Icon */}
    <label htmlFor={`file-upload-${index}-${section}`}>
      <IconButton component="span" color="primary" size="small">
        <UploadFileIcon />
      </IconButton>
    </label>

    {/* Show file name and delete button */}
    {row.refDocFile && (
      <Box display="flex" alignItems="center" ml={1}>
        <Typography variant="caption" sx={{ mr: 1 }}>
          {row.refDocFile.name}
        </Typography>
        <IconButton
          size="small"
          color="error"
          onClick={() => {
            setField("refDocFile", null, index, section);
            setField("refDocText", "", index, section);
          }}
        >
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Box>
    )}
  </Box>
</TableCell>
  
          {/* Customer Approval Dropdown */}
          <TableCell>{customerApprovalDropdown(section, index)}</TableCell>
  
          {/* Certificate Number (Field 10) with SmartTextField */}
          <TableCell>
          <Box display="flex" flexDirection="column" gap={1}>
            {row.certNumbers.map((cert, idx) => (
              <Box key={idx} display="flex" alignItems="center" gap={1}>
                <SmartTextField
                  label= "" 
                  name="certNumbers"
                  formData={cert}
                  setField={(name, value) => {
                    const newCerts = [...row.certNumbers];
                    newCerts[idx] = value;
                    setField("certNumbers", newCerts, index, section);
                  }}
                  onAddExtra={() => {
                    const newCerts = [...row.certNumbers, ""];
                    setField("certNumbers", newCerts, index, section);
                  }}
                />
                {idx > 0 && (
                  <IconButton
                    color="error"
                    size="small"
                    onClick={() => {
                      const newCerts = row.certNumbers.filter((_, i) => i !== idx);
                      setField("certNumbers", newCerts, index, section);
                    }}
                  >
                    <DeleteIcon />
                  </IconButton>
                )}
              </Box>
            ))}
          </Box>
        </TableCell>
        {/* NEW Reference Document Column */}
        <TableCell>
                    <Box display="flex" alignItems="center">
                        {/* Hidden file input with a unique id */}
                        <input
                            id={`ref-doc-file-upload-${index}-${section}`}
                            type="file"
                            accept=".pdf,.doc,.docx,.jpg,.png"
                            style={{ display: "none" }}
                            onChange={async (e) => {
                                const file = e.target.files[0];
                                if (!file) return;
                                setField("refDocFile2", file, index, section);
                                
                                const formDataFile = new FormData();
                                formDataFile.append("file", file);

                                try {
                                    const response = await axios.post(
                                      "http://127.0.0.1:5000/api/extract-text",
                                      formDataFile
                                    );
                                    const extractedText = response.data.extracted_text || "";
                                    setField("refDocText2", extractedText, index, section);
                                } catch (err) {
                                    console.error("OCR error:", err);
                                    setField("refDocText2", "", index, section);
                                }
                            }}
                        />

                        {/* Upload Icon */}
                        <label htmlFor={`ref-doc-file-upload-${index}-${section}`}>
                            <IconButton component="span" color="primary" size="small">
                                <UploadFileIcon />
                            </IconButton>
                        </label>

                        {/* Show file name, make it clickable, and add a delete button */}
                        {row.refDocFile2 && (
                            <Box display="flex" alignItems="center" ml={1}>
                                <Typography
                                    variant="caption"
                                    sx={{ mr: 1, cursor: 'pointer', textDecoration: 'underline' }}
                                    onClick={() => window.open(URL.createObjectURL(row.refDocFile))}
                                >
                                    {row.refDocFile2.name}
                                </Typography>
                                <IconButton
                                    size="small"
                                    color="error"
                                    onClick={() => {
                                        setField("refDocFile2", null, index, section);
                                        setField("refDocText2", "", index, section);
                                    }}
                                >
                                    <DeleteIcon fontSize="small" />
                                </IconButton>
                            </Box>
                        )}
                    </Box>
                </TableCell>
  
         


  
          {/* Delete Button */}
          <TableCell>
            {formData[section].length > 1 && (
              <IconButton
                onClick={() => deleteTableRow(section, index)}
                color="error"
                size="small"
              >
                <DeleteIcon />
              </IconButton>
            )}
          </TableCell>
        </TableRow>
      ));
    },
    [formData, setField, deleteTableRow, customerApprovalDropdown]
  );
  

  return (
    <Box p={4} bgcolor="#f9f9f9" minHeight="100vh" className="tailwind-bg-gray-100">
      <Paper elevation={3} sx={{ p: 4, backgroundColor: '#fff', color: '#333' }}>
        <Typography
          variant="h6"
          gutterBottom
          align="center"
          sx={{ fontWeight: 'bold' }}
        >
          Form 2: Product Accountability – Materials, Special Processes, and Functional Testing
        </Typography>
        

        <Grid container spacing={2} mb={4}>
          {topFields.map(({ key, label }) => (
            <Grid item xs={12} sm={6} md={3} key={key}>
              <SmartTextField
                label={label}
                name={key}
                formData={formData[key] || ''}
                setField={setField}
              />
            </Grid>
          ))}
        </Grid>

        <Box>
          <Table sx={{ minWidth: 650, backgroundColor: '#fff', border: '1px solid #ccc' }}>
            <TableHead>
              <TableRow>
                <TableCell
                  colSpan={7}
                  align="center"
                  sx={{ color: '#333', backgroundColor: '#e0e0e0', fontWeight: 'bold' }}
                >
                  Materials
                </TableCell>
                <TableCell sx={{ color: '#333', backgroundColor: '#e0e0e0', textAlign: 'center' }}>
                  <IconButton onClick={() => addTableRow('materials')} color="primary" size="small">
                    <AddIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
              <TableRow>
                {tableHeaders.map((head, idx) => (
                  <TableCell
                    key={idx}
                    sx={{ color: '#333', backgroundColor: '#f5f5f5', fontWeight: 'medium' }}
                  >
                    {head}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>{renderTableRows('materials')}</TableBody>

            <TableHead>
              <TableRow>
                <TableCell
                  colSpan={7}
                  align="center"
                  sx={{ color: '#333', backgroundColor: '#e0e0e0', fontWeight: 'bold' }}
                >
                  Processes
                </TableCell>
                <TableCell sx={{ color: '#333', backgroundColor: '#e0e0e0', textAlign: 'center' }}>
                  <IconButton onClick={() => addTableRow('processes')} color="primary" size="small">
                    <AddIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
              <TableRow>
                {tableHeaders.map((head, idx) => (
                  <TableCell
                    key={idx}
                    sx={{ color: '#333', backgroundColor: '#f5f5f5', fontWeight: 'medium' }}
                  >
                    {head}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>{renderTableRows('processes')}</TableBody>

            <TableHead>
              <TableRow>
                <TableCell
                  colSpan={7}
                  align="center"
                  sx={{ color: '#333', backgroundColor: '#e0e0e0', fontWeight: 'bold' }}
                >
                  Inspections
                </TableCell>
                <TableCell sx={{ color: '#333', backgroundColor: '#e0e0e0', textAlign: 'center' }}>
                  <IconButton onClick={() => addTableRow('inspections')} color="primary" size="small">
                    <AddIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
              <TableRow>
                {tableHeaders.map((head, idx) => (
                  <TableCell
                    key={idx}
                    sx={{ color: '#333', backgroundColor: '#f5f5f5', fontWeight: 'medium' }}
                  >
                    {head}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>{renderTableRows('inspections')}</TableBody>
          </Table>
        </Box>

        <Grid container spacing={2} mt={4}>
          <Grid item xs={12} sm={6}>
            <SmartTextField
              label="11. Functional Test Number"
              name="functionalTestNumber"
              formData={formData.functionalTestNumber}
              setField={setField}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <SmartTextField
              label="12. Acceptance Report Number"
              name="acceptanceReportNumber"
              formData={formData.acceptanceReportNumber}
              setField={setField}
            />
          </Grid>
          <Grid item xs={12}>
            <SmartTextField
              label="13. Comments"
              name="comments"
              multiline
              rows={4}
              formData={formData.comments}
              setField={setField}
            />
          </Grid>
        </Grid>

        <Stack direction="row" spacing={2} justifyContent="flex-end" mt={4}>
          <Button
            variant="outlined"
            onClick={handleGoToForm1}
            sx={{
              backgroundColor: '#fff',
              color: '#1976d2',
              borderColor: '#1976d2',
              '&:hover': {
                backgroundColor: '#e3f2fd',
              },
            }}
          >
            Go to Form 1
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handlePdfExport}
          >
          Download PDF
          </Button>

            <Button
    variant="contained"
    color="primary"
    onClick={handleSave}
  >
    Save
  </Button>

          <Button
            variant="contained"
            onClick={handleNextToForm3}
            sx={{
              backgroundColor: '#1976d2',
              color: 'white',
              '&:hover': {
                backgroundColor: '#1565c0',
              },
            }}
          >
            Next
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
