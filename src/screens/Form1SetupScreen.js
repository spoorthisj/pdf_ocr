// src/screens/Form1SetupScreen.js
import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Grid,
  TextField,
  CircularProgress,
  TextareaAutosize,
  Checkbox,
  FormControlLabel,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  createTheme,
  ThemeProvider,
  InputAdornment,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Paper,
} from '@mui/material';
import MicIcon from '@mui/icons-material/Mic';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import axios from 'axios';
import { useFiles } from '../context/FileContext';
import { useNavigate } from 'react-router-dom';
import ReactCrop from 'react-image-crop';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import 'react-image-crop/dist/ReactCrop.css';
import {
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
} from '@mui/material';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/TextLayer.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';

// ---------------- THEME (light) ---------------- 
const theme = createTheme({
  palette: {
    mode: 'light',
    background: { default: '#f5f5f5', paper: '#ffffff' },
    text: { primary: '#000000', secondary: '#555555' },
  },
  components: {
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiInputBase-input': { color: 'black' },
          '& .MuiInputLabel-root': { color: '#555555' },
          '& .MuiOutlinedInput-root': {
            '& fieldset': { borderColor: '#ccc' },
            '&:hover fieldset': { borderColor: '#999' },
            '&.Mui-focused fieldset': { borderColor: '#000' },
          },
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        root: {
          color: 'black',
          '& .MuiOutlinedInput-notchedOutline': { borderColor: '#ccc' },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#999' },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000' },
          '& .MuiSvgIcon-root': { color: 'black' },
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          color: '#555555',
        },
      },
    },
  },
});

// set pdf worker (same CDN as in your other file)
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

// ---------------- Spoken text processing ---------------- 
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

// ---------------- SmartTextField with Image + PDF Cropping and OCR ---------------- 
const SmartTextField = ({ label, name, formData, setField, multiline, rows, ...rest }) => {
  const [showIcons, setShowIcons] = useState(false);

  // file refs & states
  const fileRef = useRef(null);
  const [imageSrc, setImageSrc] = useState(null);
  const [pdfSrc, setPdfSrc] = useState(null);

  // crop state
  const [crop, setCrop] = useState();
  const imgRef = useRef(null); // used for images
  const pageCanvasRef = useRef(null); // used for PDF page canvas

  // dialogs / UI
  const [openImageDialog, setOpenImageDialog] = useState(false);
  const [openPdfDialog, setOpenPdfDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [speechError, setSpeechError] = useState(null);
  const [error, setError] = useState(null);

  // pdf rendering state
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);

  // Speech
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
      setField(name, processed);
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

  // file select handler: image or pdf
  const onSelectFile = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setError(null);

    if (file.type === 'application/pdf') {
      // read PDF as dataURL and open PDF dialog
      const reader = new FileReader();
      reader.onload = (ev) => {
        setPdfSrc(ev.target.result);
        setOpenPdfDialog(true);
        setCrop(undefined);
        setPageNumber(1);
      };
      reader.onerror = (err) => {
        console.error('FileReader error:', err);
        setError('Failed to read the PDF file.');
      };
      reader.readAsDataURL(file);
    } else if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setImageSrc(ev.target.result);
        setOpenImageDialog(true);
        setCrop(undefined);
      };
      reader.onerror = (err) => {
        console.error('FileReader error:', err);
        setError('Failed to read the image file.');
      };
      reader.readAsDataURL(file);
    } else {
      setError('Unsupported file type. Please select an image or a PDF.');
    }

    // reset input value so selecting same file again triggers change
    e.target.value = '';
  };

  // Image crop complete -> extract and send to OCR
  const handleImageCropComplete = async () => {
    if (!imgRef.current || !crop?.width || !crop?.height) {
      setOpenImageDialog(false);
      setImageSrc(null);
      return;
    }
    setOpenImageDialog(false);
    setLoading(true);
    setError(null);

    try {
      const image = imgRef.current;
      const canvas = document.createElement('canvas');
      const scaleX = image.naturalWidth / image.width;
      const scaleY = image.naturalHeight / image.height;
      canvas.width = Math.round(crop.width * scaleX);
      canvas.height = Math.round(crop.height * scaleY);
      const ctx = canvas.getContext('2d');

      ctx.drawImage(
        image,
        crop.x * scaleX,
        crop.y * scaleY,
        crop.width * scaleX,
        crop.height * scaleY,
        0,
        0,
        canvas.width,
        canvas.height
      );

      const croppedBlob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.9));
      const fd = new FormData();
      fd.append('cropped_image', croppedBlob, 'cropped.jpg');

      const resp = await axios.post('http://127.0.0.1:5000/api/ocr-image', fd);
      const extractedText = resp.data.extracted_text || '';
      setField(name, extractedText);
    } catch (err) {
      console.error('Image OCR failed:', err);
      if (err.response) setError(`Server Error: ${err.response.status}`);
      else if (err.request) setError('Network Error: backend unreachable.');
      else setError(err.message || 'Unexpected error during OCR.');
    } finally {
      setLoading(false);
      setImageSrc(null);
      setCrop(undefined);
    }
  };

  // PDF handlers
  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
    setPageNumber(1);
    setCrop(undefined);
  };

  const onDocumentLoadError = (err) => {
    console.error('Failed to load PDF document:', err);
    setError('Failed to load PDF. File may be corrupted.');
    setPdfSrc(null);
    setOpenPdfDialog(false);
  };

  const onPageRenderSuccess = () => {
    // pageCanvasRef is set by Page via canvasRef prop
    setCrop(undefined);
  };

  const handlePdfCropComplete = async () => {
    // ensure we have canvas element
    const canvasEl = pageCanvasRef.current;
    if (!canvasEl || !crop?.width || !crop?.height) {
      setOpenPdfDialog(false);
      setPdfSrc(null);
      return;
    }

    setOpenPdfDialog(false);
    setLoading(true);
    setError(null);

    try {
      // canvasEl here is an actual <canvas> element rendered by react-pdf Page
      // We need to map crop (which is in CSS pixels of displayed canvas) to actual canvas pixels
      const scaleX = canvasEl.width / canvasEl.offsetWidth;
      const scaleY = canvasEl.height / canvasEl.offsetHeight;

      const croppedCanvas = document.createElement('canvas');
      croppedCanvas.width = Math.round(crop.width * scaleX);
      croppedCanvas.height = Math.round(crop.height * scaleY);
      const ctx = croppedCanvas.getContext('2d');

      ctx.drawImage(
        canvasEl,
        crop.x * scaleX,
        crop.y * scaleY,
        crop.width * scaleX,
        crop.height * scaleY,
        0,
        0,
        croppedCanvas.width,
        croppedCanvas.height
      );

      const croppedBlob = await new Promise((res) => croppedCanvas.toBlob(res, 'image/jpeg', 0.9));
      const fd = new FormData();
      fd.append('cropped_image', croppedBlob, 'cropped.jpg');

      const resp = await axios.post('http://127.0.0.1:5000/api/ocr-image', fd);
      const extractedText = resp.data.extracted_text || '';
      setField(name, extractedText);
    } catch (err) {
      console.error('PDF OCR failed:', err);
      if (err.response) setError(`Server Error: ${err.response.status}`);
      else if (err.request) setError('Network Error: backend unreachable.');
      else setError(err.message || 'Unexpected error during OCR.');
    } finally {
      setLoading(false);
      setPdfSrc(null);
      setCrop(undefined);
    }
  };

  const isExtractDisabled = !crop?.width || !crop?.height;

  return (
    <>
      <TextField
        fullWidth
        size="small"
        label={label}
        value={formData[name] || ''}
        onChange={(e) => setField(name, e.target.value)}
        onFocus={() => setShowIcons(true)}
        onBlur={() => setTimeout(() => setShowIcons(false), 180)}
        multiline={multiline}
        rows={rows}
        InputProps={{
          endAdornment: showIcons && (
            <InputAdornment position="end">
              <IconButton
                size="small"
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleSpeechInput}
                aria-label={`speak ${label}`}
              >
                <MicIcon sx={{ color: 'grey' }} />
              </IconButton>
              <IconButton
                size="small"
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleCameraClick}
                aria-label={`camera ${label}`}
              >
                <CameraAltIcon sx={{ color: 'grey' }} />
              </IconButton>
            </InputAdornment>
          ),
        }}
        {...rest}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*,application/pdf"
        capture="environment"
        style={{ display: 'none' }}
        onChange={onSelectFile}
      />

      {/* Image crop dialog */}
      <Dialog open={openImageDialog} onClose={() => { setOpenImageDialog(false); setImageSrc(null); setCrop(undefined); }} maxWidth="md" fullWidth>
        <DialogTitle>Crop Image for OCR</DialogTitle>
        <DialogContent dividers>
          {imageSrc && (
            <ReactCrop crop={crop} onChange={(c) => setCrop(c)}>
              <img ref={imgRef} src={imageSrc} alt="Crop me" style={{ maxWidth: '100%' }} />
            </ReactCrop>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setOpenImageDialog(false); setImageSrc(null); setCrop(undefined); }}>Cancel</Button>
          <Button onClick={handleImageCropComplete} variant="contained" disabled={isExtractDisabled}>Extract Text</Button>
        </DialogActions>
      </Dialog>

      {/* PDF crop dialog */}
      <Dialog open={openPdfDialog} onClose={() => { setOpenPdfDialog(false); setPdfSrc(null); setCrop(undefined); }} maxWidth="md" fullWidth>
        <DialogTitle>
          Crop PDF for OCR
        </DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Box sx={{ mb: 2 }}>
              <Button disabled={pageNumber <= 1} onClick={() => setPageNumber((p) => Math.max(1, p - 1))}>Previous</Button>
              <Typography component="span" sx={{ mx: 2 }}>Page {pageNumber} {numPages ? `of ${numPages}` : ''}</Typography>
              <Button disabled={numPages && pageNumber >= numPages} onClick={() => setPageNumber((p) => (numPages ? Math.min(numPages, p + 1) : p + 1))}>Next</Button>
            </Box>

            {/* Wrap Document->Page in ReactCrop so crop overlays the rendered canvas */}
            <ReactCrop crop={crop} onChange={(c) => setCrop(c)}>
              <Box>
                {pdfSrc && (
                  <Document file={pdfSrc} onLoadSuccess={onDocumentLoadSuccess} onLoadError={onDocumentLoadError}>
                    <Page
                      pageNumber={pageNumber}
                      renderTextLayer={false}
                      renderAnnotationLayer={false}
                      onRenderSuccess={onPageRenderSuccess}
                      canvasRef={(canvas) => {
                        // react-pdf gives us the canvas element
                        pageCanvasRef.current = canvas;
                      }}
                    />
                  </Document>
                )}
              </Box>
            </ReactCrop>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setOpenPdfDialog(false); setPdfSrc(null); setCrop(undefined); }}>Cancel</Button>
          <Button onClick={handlePdfCropComplete} variant="contained" disabled={isExtractDisabled}>Extract Text</Button>
        </DialogActions>
      </Dialog>

      {/* loading dialog */}
      <Dialog open={loading} PaperProps={{ sx: { p: 3, display: 'flex', alignItems: 'center' } }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Extracting text...</Typography>
      </Dialog>

      {/* speech error */}
      <Dialog open={!!speechError} onClose={() => setSpeechError(null)}>
        <DialogTitle>Speech Recognition Error</DialogTitle>
        <DialogContent>
          <Typography>{speechError}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSpeechError(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* generic error */}
      <Dialog open={!!error} onClose={() => setError(null)}>
        <DialogTitle>Error</DialogTitle>
        <DialogContent>
          <Typography>{error}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setError(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

// ---------------- Parsing logic (unchanged) ---------------- 
const parseExtractedText = (text) => {
  const data = {
    partNumber: '', partName: '', serialNumber: '', fairIdentifier: '',
    partRevisionLevel: '', drawingNumber: '', drawingRevisionLevel: '',
    additionalChanges: '', manufacturingProcessReference: '', organizationName: '',
    supplierCode: '', purchaseOrderNumber: '', 
    fullFAI: false, partialFAI: false,
    baselinePartNumber: '', reasonForFAI: '',
    indexPartNumber: '', indexPartName: '', indexPartType: '',
    indexSupplier: '', indexFairIdentifier: '',
    fairVerifiedBy: '', fairVerifiedDate: '',
    fairReviewedBy: '', fairReviewedDate: '',
    customerApproval: '', customerApprovalDate: '',
    comments: '',

  };

  const matchField = (label) => {
    const regex = new RegExp(`${label}\\s*[:.]?\\s*(.*)`, 'i');
    const match = text.match(regex);
    return match ? match[1].trim() : '';
  };

  data.partNumber = matchField('Part Number');
  data.partName = matchField('Part Name');

  function extractSerialNumber(text) {
    const regex = /(Finish\s*Part\s*Serial\s*Number|Part\s*Serial\s*No|Serial\s*Number)\s*[:.\-]?\s*([\w\-]+)/i;
    const match = text.match(regex);
    if (match) {
      return match[2].trim();
    }
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      if (/(Finish\s*Part\s*Serial\s*Number|Part\s*Serial\s*No|Serial\s*Number)/i.test(lines[i])) {
        if (lines[i + 1]) {
          const val = lines[i + 1].match(/[\w\-]+/);
          if (val) return val[0].trim();
        }
      }
    }
    return '';
  }
  data.serialNumber = extractSerialNumber(text);

  data.fairIdentifier = matchField('FAIR Identifier');
  data.partRevisionLevel = matchField('Part Revision Level');
  data.drawingNumber = matchField('Part Number');
  data.drawingRevisionLevel = matchField('Drawing Revision Level');

  if (!data.partRevisionLevel && !data.drawingRevisionLevel) {
    const drawingIssue = matchField('Drawing Issue');
    if (drawingIssue) {
      data.partRevisionLevel = drawingIssue;
      data.drawingRevisionLevel = drawingIssue;
    }
  }
  data.additionalChanges = matchField('Additional Changes');
  data.manufacturingProcessReference = matchField('Batch Card');
  if (!data.manufacturingProcessReference) {
    data.manufacturingProcessReference = matchField('Batch Card Number');
  }
  data.organizationName = matchField('Organization Name');
  data.supplierCode = matchField('Vendor Code');

  data.purchaseOrderNumber = matchField('P.O.no');
  data.baselinePartNumber = matchField('Baseline Part Number');
  data.reasonForFAI = matchField('Reason for Full/Partial FAI');

  data.indexPartNumber = matchField('15\\. Part Number');
  data.indexPartName = matchField('16\\. Part Name');
  data.indexPartType = matchField('17\\. Part Type');
  data.indexSupplier = matchField('Supplier');
  data.indexFairIdentifier = matchField('18\\. FAIR Identifier');

  if (/Does FAIR Contain a Documented Nonconformance.*Yes/i.test(text)) {
    data.nonconformanceYes = true;
  }
  if (/Does FAIR Contain a Documented Nonconformance.*No/i.test(text)) {
    data.nonconformanceNo = true;
  }

  data.fairVerifiedBy = matchField('FAIR Verified By');
  data.fairVerifiedDate = matchField('Date\\s+\\d{2}\\/\\d{2}\\/\\d{4}');
  data.fairReviewedBy = matchField('FAIR Reviewed/Approved By');
  data.fairReviewedDate = matchField('23\\. Date');
  data.customerApproval = matchField('Customer Approval');
  data.customerApprovalDate = matchField('25\\. Date');
  data.comments = matchField('Comments');



 

  return data;
};

// --- Merge parsed results: pick most frequent non-empty value --- 
const mergeParsedData = (parsedList) => {
  if (parsedList.length === 0) return {};

  const merged = {};
  const keys = Object.keys(parsedList[0]);

  keys.forEach((key) => {
    if (key === 'partName' || key === 'serialNumber') {
      merged[key] = '';
      return;
    }

    const values = parsedList.map(d => d[key]).filter(v => v !== '' && v !== null && v !== undefined);

    if (typeof parsedList[0][key] === 'boolean') {
      const trueCount = parsedList.filter(d => d[key] === true).length;
      merged[key] = trueCount > parsedList.length / 2;
    } else {
      if (values.length === 0) {
        merged[key] = '';
      } else {
        if (key === 'serialNumber') {
          const validValues = values.filter(v => /^[A-Za-z0-9\-]+$/.test(v));
          if (validValues.length) {
            const freqMap = {};
            validValues.forEach(v => { freqMap[v] = (freqMap[v] || 0) + 1; });
            merged[key] = Object.entries(freqMap).sort((a, b) => b[1] - a[1])[0][0];
            return;
          }
        }
        const freqMap = {};
        values.forEach(v => { freqMap[v] = (freqMap[v] || 0) + 1; });
        merged[key] = Object.entries(freqMap).sort((a, b) => b[1] - a[1])[0][0];
      }
    }
  });

  return merged;
};

// ---------------- Main component ---------------- 
export default function Form1SetupScreen() {
  const { files } = useFiles();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({});
  const [rawTexts, setRawTexts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  // table rows
  const [rows, setRows] = useState([
    { indexPartNumber: '', indexPartName: '', indexPartType: '', indexSupplier: '', indexFairIdentifier: '' }
  ]);

  const handleAddRow = () => {
    setRows((r) => [...r, { indexPartNumber: '', indexPartName: '', indexPartType: '', indexSupplier: '', indexFairIdentifier: '' }]);
  };

  const [partNameOptions, setPartNameOptions] = useState([]);
  const [serialNumberOptions, setSerialNumberOptions] = useState([]);
  const [showRawText, setShowRawText] = useState(false);

  useEffect(() => {
    const processFiles = async () => {
      if (!files || files.length === 0) return;

      setIsLoading(true);
      setError('');
      setFormData({});
      setRawTexts([]);
      setPartNameOptions([]);
      setSerialNumberOptions([]);
      setShowRawText(false);

      const parsedResults = [];
      const rawResults = [];

      try {
        for (const file of files) {
          const fileFormData = new FormData();
          fileFormData.append('file', file);

          const response = await axios.post('http://127.0.0.1:5000/api/extract-text', fileFormData);
          const { extracted_text } = response.data;

          if (extracted_text && extracted_text.trim() !== '') {
            rawResults.push({ name: file.name, text: extracted_text });
            parsedResults.push(parseExtractedText(extracted_text));
          }
        }

        if (parsedResults.length === 0) {
          setError('OCR failed to extract any text from the uploaded files.');
        } else {
          setPartNameOptions(Array.from(new Set(parsedResults.map(r => r.partName).filter(Boolean))));
          setSerialNumberOptions(Array.from(new Set(parsedResults.map(r => r.serialNumber).filter(Boolean))));
          setRawTexts(rawResults);
          setFormData(mergeParsedData(parsedResults));
        }
      } catch (err) {
        console.error('API Error:', err);
        setError('Failed to extract data. Is the backend server running?');
      } finally {
        setIsLoading(false);
      }
    };

    processFiles();
  }, [files]);

  const handleChange = (field) => (e) => {
    setFormData(prev => ({
      ...prev,
      [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value
    }));
  };

  const setFieldValue = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    console.log('Saved Form1 data:', formData);
    alert('Form saved!');
  };

  const handleNext = () => {
    handleSave();
    navigate('/form2setup', {
      state: {
        form1Data: { // Pass only the relevant fields
          partNumber: formData.partNumber,
          partName: formData.partName,
          serialNumber: formData.serialNumber,
          fairIdentifier: formData.fairIdentifier,
        }
      }
    });
  };

  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ padding: 4, backgroundColor: '#f4f7f6', minHeight: '100vh' }}>
        <Typography variant="h4" gutterBottom color="black">
          Form 1 – Part Number Accountability
        </Typography>

        {isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
            <CircularProgress /> <Typography sx={{ ml: 2, color: 'black' }}>Extracting data...</Typography>
          </Box>
        )}
        {error && <Typography color="error">{error}</Typography>}

        {!isLoading && Object.keys(formData).length > 0 && (
          <Grid container spacing={4}>
            <Grid item xs={12} md={showRawText ? 6 : 12}>
              <Paper sx={{ padding: 3 }}>
                <Grid container spacing={2}>
                  <Grid item xs={6} sm={3}>
                    <SmartTextField label="1. Part Number" name="partNumber" formData={formData} setField={setFieldValue} />
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <FormControl fullWidth>
                      <InputLabel id="part-name-label">2. Part Name</InputLabel>
                      <Select
                        labelId="part-name-label"
                        value={formData.partName || ''}
                        label="2. Part Name"
                        onChange={handleChange('partName')}
                      >
                        {partNameOptions.length === 0 && (
                          <MenuItem value="">
                            <em>No options</em>
                          </MenuItem>
                        )}
                        {partNameOptions.map((name, idx) => (
                          <MenuItem key={idx} value={name}>
                            {name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <FormControl fullWidth>
                      <InputLabel id="serial-number-label">3. Serial Number</InputLabel>
                      <Select
                        labelId="serial-number-label"
                        value={formData.serialNumber || ''}
                        label="3. Serial Number"
                        onChange={handleChange('serialNumber')}
                      >
                        {serialNumberOptions.length === 0 && (
                          <MenuItem value="">
                            <em>No options</em>
                          </MenuItem>
                        )}
                        {serialNumberOptions.map((serial, idx) => (
                          <MenuItem key={idx} value={serial}>
                            {serial}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <SmartTextField label="4. FAIR Identifier" name="fairIdentifier" formData={formData} setField={setFieldValue} />
                  </Grid>
                </Grid>

                <Grid container spacing={2} sx={{ mt: 2 }}>
                  <Grid item xs={6} sm={3}>
                    <SmartTextField label="5. Part Revision Level" name="partRevisionLevel" formData={formData} setField={setFieldValue} />
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <SmartTextField label="6. Drawing Number" name="drawingNumber" formData={formData} setField={setFieldValue} />
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <SmartTextField label="7. Drawing Revision Level" name="drawingRevisionLevel" formData={formData} setField={setFieldValue} />
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <SmartTextField label="8. Additional Changes" name="additionalChanges" formData={formData} setField={setFieldValue} />
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <SmartTextField label="9. Manufacturing Process Reference" name="manufacturingProcessReference" formData={formData} setField={setFieldValue} />
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <SmartTextField label="10. Organization Name" name="organizationName" formData={formData} setField={setFieldValue} />
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <SmartTextField label="11. Supplier Code" name="supplierCode" formData={formData} setField={setFieldValue} />
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <SmartTextField label="12. Purchase Order Number" name="purchaseOrderNumber" formData={formData} setField={setFieldValue} />
                  </Grid>
                </Grid>
                

                <TableContainer component={Paper} sx={{ backgroundColor: 'white', boxShadow: 3, borderRadius: 2, mt: 2 }}>
                  <Table>
                    <TableHead>
                      <TableRow sx={{ backgroundColor: '#f1f1f1' }}>
                        {[
                          '15. Part Number',
                          '16. Part Name',
                          '17. Part Type',
                          'Supplier',
                          '18. FAIR Identifier',
                          ''
                        ].map((header, i) => (
                          <TableCell key={i} sx={{ fontWeight: 'bold', border: '1px solid #ddd', textAlign: 'center' }}>
                            {header}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {rows.map((row, idx) => (
                        <TableRow key={idx}>
                          <TableCell sx={{ border: '1px solid #eee', padding: '8px' }}>
                            <SmartTextField name={`indexPartNumber_${idx}`} formData={formData} setField={setFieldValue} fullWidth />
                          </TableCell>
                          <TableCell sx={{ border: '1px solid #eee', padding: '8px' }}>
                            <SmartTextField name={`indexPartName_${idx}`} formData={formData} setField={setFieldValue} fullWidth />
                          </TableCell>
                          <TableCell sx={{ border: '1px solid #eee', padding: '8px' }}>
                            <SmartTextField name={`indexPartType_${idx}`} formData={formData} setField={setFieldValue} fullWidth />
                          </TableCell>
                          <TableCell sx={{ border: '1px solid #eee', padding: '8px' }}>
                            <SmartTextField name={`indexSupplier_${idx}`} formData={formData} setField={setFieldValue} fullWidth />
                          </TableCell>
                          <TableCell sx={{ border: '1px solid #eee', padding: '8px' }}>
                            <SmartTextField name={`indexFairIdentifier_${idx}`} formData={formData} setField={setFieldValue} fullWidth />
                          </TableCell>
                          <TableCell sx={{ textAlign: 'center', border: '1px solid #eee' }}>
                            {idx === rows.length - 1 && (
                              <IconButton color="primary" onClick={handleAddRow}>
                                <AddIcon />
                              </IconButton>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>


                <Grid container spacing={2} sx={{ mt: 2 }}>
                  <Grid item xs={12} sm={6}>
                    <SmartTextField label="20. FAIR Verified By" name="fairVerifiedBy" formData={formData} setField={setFieldValue} />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <SmartTextField label="21. Date" name="fairVerifiedDate" formData={formData} setField={setFieldValue} placeholder="MM/DD/YYYY" />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <SmartTextField label="22. FAIR Reviewed/Approved By" name="fairReviewedBy" formData={formData} setField={setFieldValue} />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <SmartTextField label="23. Date" name="fairReviewedDate" formData={formData} setField={setFieldValue} placeholder="MM/DD/YYYY" />
                  </Grid>
                </Grid>

                <Grid container spacing={2} sx={{ mt: 2 }}>
                  <Grid item xs={12} sm={6}>
                    <SmartTextField label="24. Customer Approval" name="customerApproval" formData={formData} setField={setFieldValue} />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <SmartTextField label="25. Date" name="customerApprovalDate" formData={formData} setField={setFieldValue} placeholder="MM/DD/YYYY" />
                  </Grid>
                </Grid>

                <Grid item xs={12} sx={{ mt: 2 }}>
                  <SmartTextField label="26. Comments" name="comments" formData={formData} setField={setFieldValue} multiline rows={4} />
                </Grid>

                <Grid item xs={12} sx={{ mt: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Button variant="outlined" onClick={() => setShowRawText((s) => !s)}>
                    {showRawText ? 'Hide Extracted Text' : 'Show Extracted Text'}
                  </Button>
                  <Box>
                    <Button variant="contained" color="primary" onClick={handleSave} sx={{ mr: 2 }}>
                      Save
                    </Button>
                    <Button variant="contained" color="success" onClick={handleNext}>
                      Next
                    </Button>
                  </Box>
                </Grid>
              </Paper>
            </Grid>

            {showRawText && (
              <Grid item xs={12} md={6}>
                <Paper sx={{ padding: 3, maxHeight: '80vh', overflowY: 'auto' }}>
                  <Typography variant="h6" gutterBottom>Raw Extracted Texts from Files</Typography>
                  {rawTexts.length === 0 && <Typography>No extracted text to display.</Typography>}
                  {rawTexts.map(({ name, text }, idx) => (
                    <Box key={idx} sx={{ mb: 3 }}>
                      <Typography variant="subtitle1">{name}</Typography>
                      <TextareaAutosize
                        minRows={10}
                        style={{ width: '100%', fontFamily: 'monospace', fontSize: 12, background: '#0f1720', color: '#e6eef6', padding: 8 }}
                        value={text}
                        readOnly
                      />
                    </Box>
                  ))}
                </Paper>
              </Grid>
            )}
          </Grid>
        )}
      </Box>
    </ThemeProvider>
  );
}
