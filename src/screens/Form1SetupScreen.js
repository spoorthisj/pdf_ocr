// src/screens/Form1SetupScreen.js
import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { jsPDF } from 'jspdf';
import {
  Box,
  Typography,
  Grid,
  TextField,
  CircularProgress,
  TextareaAutosize,
  Checkbox,
  RadioGroup,
  Radio,
  FormControlLabel,
  Select,
  MenuItem,
  InputLabel,
  FormLabel,
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
import RotateLeftIcon from '@mui/icons-material/RotateLeft';
import RotateRightIcon from '@mui/icons-material/RotateRight';
import axios from 'axios';
import { useFiles } from '../context/FileContext';
import { useNavigate, useLocation } from 'react-router-dom';
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
import UploadFileIcon from '@mui/icons-material/UploadFile';
import FolderUploadScreen from './FolderUploadScreen';

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

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

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

const SmartTextField = ({ label, name, formData, setField, multiline, rows, ...rest }) => {
  const [showIcons, setShowIcons] = useState(false);
    
  const [zoom, setZoom] = useState(1);

  const fileRef = useRef(null);
  const [imageSrc, setImageSrc] = useState(null);
  const [pdfSrc, setPdfSrc] = useState(null);

  const [crop, setCrop] = useState();
  const imgRef = useRef(null);
  const pageCanvasRef = useRef(null);

  const [openImageDialog, setOpenImageDialog] = useState(false);
  const [openPdfDialog, setOpenPdfDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [speechError, setSpeechError] = useState(null);
  const [error, setError] = useState(null);

  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);

  const [pdfRotation, setPdfRotation] = useState(0);
  const [imageRotation, setImageRotation] = useState(0);
  
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
      setField(name, (formData[name] || '') + ' ' + processed);
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
      const reader = new FileReader();
      reader.onload = (ev) => {
        setPdfSrc(ev.target.result);
        setOpenPdfDialog(true);
        setCrop(undefined);
        setPageNumber(1);
        setPdfRotation(0);
        setZoom(1);   
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
        setImageRotation(0);
        setZoom(1);
      };
      reader.onerror = (err) => {
        console.error('FileReader error:', err);
        setError('Failed to read the image file.');
      };
      reader.readAsDataURL(file);
    } else {
      setError('Unsupported file type. Please select an image or a PDF.');
    }

    e.target.value = '';
  };

  const rotateCurrentImage = async (delta = 90) => {
    if (!imageSrc) return;
    try {
      const img = await new Promise((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = reject;
        i.src = imageSrc;
      });

      const angle = ((imageRotation + delta) % 360 + 360) % 360;
      let cw = img.width;
      let ch = img.height;

      const swap = angle === 90 || angle === 270;
      const canvas = document.createElement('canvas');
      canvas.width = swap ? img.height : img.width;
      canvas.height = swap ? img.width : img.height;

      const ctx = canvas.getContext('2d');
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((angle * Math.PI) / 180);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);

      const newDataUrl = canvas.toDataURL('image/jpeg', 0.95);
      setImageSrc(newDataUrl);
      setImageRotation(angle);
      setCrop(undefined);
    } catch (err) {
      console.error('Rotate image failed:', err);
      setError('Failed to rotate image.');
    }
  };

 const handleImageCropComplete = async () => {
  if (!imgRef.current || !crop?.width || !crop?.height) return;

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
      setField(name, (formData[name] || '') + ' ' + extractedText);
    } catch (err) {
      console.error('Image OCR failed:', err);
      if (err.response) setError(`Server Error: ${err.response.status}`);
      else if (err.request) setError('Network Error: backend unreachable.');
      else setError(err.message || 'Unexpected error during OCR.');
    } finally {
      setLoading(false);
      setCrop(undefined);
      setImageRotation(0);
      setZoom(1);
    }
  };

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
    setCrop(undefined);
  };

  const handlePdfCropComplete = async () => {
    const canvasEl = pageCanvasRef.current;
    if (!canvasEl || !crop?.width || !crop?.height) {
      return;
    }
    setLoading(true);
    setError(null);

    try {
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
      setField(name, (formData[name] || '') + ' ' + extractedText);
    } catch (err) {
      console.error('PDF OCR failed:', err);
      if (err.response) setError(`Server Error: ${err.response.status}`);
      else if (err.request) setError('Network Error: backend unreachable.');
      else setError(err.message || 'Unexpected error during OCR.');
    } finally {
      setLoading(false);
      setCrop(undefined);
      setPdfRotation(0);
      setZoom(1); 
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

<Dialog
  open={openImageDialog}
  onClose={() => setOpenImageDialog(false)}
  maxWidth="md"
  fullWidth
>
  <DialogTitle sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
    Crop Image for OCR
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "8px",
      }}
    >
      <Button
        variant="text"
        onClick={() => rotateCurrentImage(-90)}
      >
        Rotate -90°
      </Button>
      <Button
        variant="text"
        onClick={() => rotateCurrentImage(90)}
      >
        Rotate +90°
      </Button>
      <Button variant="text" onClick={() => setZoom((z) => z + 0.2)}>
        Zoom In +
      </Button>
      <Button variant="text" onClick={() => setZoom((z) => Math.max(0.5, z - 0.2))}>
        Zoom Out -
      </Button>
      <Button
        color="primary"
        variant="text"
        onClick={() => {
          setZoom(1);
          setImageRotation(0);
          setCrop(undefined);
        }}
      >
        Reset
      </Button>
    </div>
  </DialogTitle>

  <DialogContent dividers>
    {imageSrc && (
      <ReactCrop crop={crop} onChange={(c) => setCrop(c)}>
        <img
          ref={imgRef}
          src={imageSrc}
          alt="Crop me"
          style={{
            maxWidth: "100%",
            transform: `scale(${zoom})`,
            transformOrigin: "center",
          }}
        />
      </ReactCrop>
    )}
  </DialogContent>

  <DialogActions>
    <Button onClick={() => setOpenImageDialog(false)}>Cancel</Button>
    <Button variant="contained" onClick={handleImageCropComplete}>
      Extract Text
    </Button>
  </DialogActions>
</Dialog>

     <Dialog
  open={openPdfDialog}
  onClose={() => setOpenPdfDialog(false)}
  maxWidth="md"
  fullWidth
>
  <DialogTitle sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
    Crop PDF for OCR
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "8px",
      }}
    >
      <Button disabled={pageNumber <= 1} onClick={() => setPageNumber((p) => Math.max(1, p - 1))}>
        Previous
      </Button>
      <Typography component="span">
        Page {pageNumber} {numPages ? `of ${numPages}` : ""}
      </Typography>
      <Button
        disabled={numPages && pageNumber >= numPages}
        onClick={() =>
          setPageNumber((p) =>
            numPages ? Math.min(numPages, p + 1) : p + 1
          )
        }
      >
        Next
      </Button>

      <Button variant="text" onClick={() => setZoom((z) => Math.max(0.5, z - 0.2))}>
        Zoom Out
      </Button>
      <Button variant="text" onClick={() => setZoom((z) => z + 0.2)}>
        Zoom In
      </Button>
      <Button
        variant="text"
        onClick={() => {
          setPdfRotation((r) => (r + 270) % 360);
          setCrop(undefined);
        }}
      >
        Rotate -90°
      </Button>
      <Button
        variant="text"
        onClick={() => {
          setPdfRotation((r) => (r + 90) % 360);
          setCrop(undefined);
        }}
      >
        Rotate +90°
      </Button>
      <Button
        color="primary"
        variant="text"
        onClick={() => {
          setZoom(1);
          setPdfRotation(0);
          setCrop(undefined);
        }}
      >
        Reset
      </Button>
    </div>
  </DialogTitle>

  <DialogContent dividers>
    {pdfSrc && (
      <ReactCrop crop={crop} onChange={(c) => setCrop(c)}>
        <div style={{ display: "inline-block" }}>
          <Document
            file={pdfSrc}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
          >
            <Page
              pageNumber={pageNumber}
              scale={zoom}
              renderTextLayer={false}
              renderAnnotationLayer={false}
              rotate={pdfRotation}
              onRenderSuccess={onPageRenderSuccess}
              canvasRef={(canvas) => {
                pageCanvasRef.current = canvas;
              }}
            />
          </Document>
        </div>
      </ReactCrop>
    )}
  </DialogContent>

  <DialogActions>
    <Button onClick={() => setOpenPdfDialog(false)}>Cancel</Button>
    <Button variant="contained" onClick={handlePdfCropComplete}>
      Extract Text
    </Button>
  </DialogActions>
</Dialog>


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
    const regex = new RegExp(`${label}\\s*[:.]?\\s*(\\S.*)`, 'i');
    const match = text.match(regex);
    if (match && match[1]) {
      return match[1].trim();
    }
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      if (new RegExp(label, 'i').test(lines[i])) {
        if (lines[i + 1]) {
          return lines[i + 1].trim();
        }
      }
    }
    return '';
  };
  
  data.partNumber = matchField('Part Number');
  if (data.partNumber) {
    const regex = new RegExp(`\\b${data.partNumber}\\b`, 'gi');
    data.partNumberCount = (text.match(regex) || []).length;
  }
  data.partName = matchField('Part Name')||matchField('Part Description');
  data.customerPartNumber = matchField('Part Number');
  data.serialNumber = matchField('Serial Number')|| matchField( 'Finish Part Serial No');
  data.fairIdentifier = matchField('FAIR Identifier');
  data.partRevisionLevel =
  matchField('Part Revision Level') ||
  matchField('Revision Number') ||
  matchField('Rev No');
  data.drawingNumber = matchField('Part Number');
  data.drawingRevisionLevel = matchField('Drawing Revision Level')|| matchField('Part Revision Level') || data.partRevisionLevel;
  if (!data.partRevisionLevel && !data.drawingRevisionLevel) {
    const drawingIssue = matchField('Drawing Issue');
    if (drawingIssue) {
      data.partRevisionLevel = drawingIssue;
      data.drawingRevisionLevel = drawingIssue;
    }
  }
  data.additionalChanges = matchField('Additional Changes');
  data.manufacturingProcessReference =
  matchField('Manufacturing Process Reference') ||
  matchField('Batch Card Number') ||
  matchField('Batch Card No') ||
  matchField('Batch Card');
  data.organizationName = matchField('Organization Name');
  data.supplierCode =
  matchField('Vendor Code') ||
  matchField('Vendor');
  data.purchaseOrderNumber = matchField('P.O.no')|| matchField('Purchase order numver')|| matchField('Purchase order no');
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
  return data;
};

const mergeParsedData = (parsedList) => {
  if (parsedList.length === 0) return {};
  const merged = {};
  const keys = Object.keys(parsedList[0]);
  keys.forEach((key) => {
    const values = parsedList.map(d => d[key]).filter(v => v !== '' && v !== null && v !== undefined);
    if (key === 'partNumberCount') {
      merged[key] = Math.max(...values, 3);
      return;
    }
    if (typeof parsedList[0][key] === 'boolean') {
      const trueCount = parsedList.filter(d => d[key] === true).length;
      merged[key] = trueCount > parsedList.length / 2;
    } else {
      if (values.length === 0) {
        merged[key] = '';
      } else {
        if (key === 'serialNumber') {
          const freqMap = {};
          values.forEach(v => {
            const clean = v.trim();
            freqMap[clean] = (freqMap[clean] || 0) + 1;
          });
          merged[key] = Object.entries(freqMap).sort((a, b) => b[1] - a[1])[0][0];
          return;
        }
        const freqMap = {};
        values.forEach(v => { freqMap[v] = (freqMap[v] || 0) + 1; });
        merged[key] = Object.entries(freqMap).sort((a, b) => b[1] - a[1])[0][0];
      }
    }
  });
  return merged;
};

const countOccurrences = (textArray, value) => {
  if (!value) return 0;
  const regex = new RegExp(value, "gi");
  return textArray.reduce((acc, file) => {
    const matches = file.text.match(regex);
    return acc + (matches ? matches.length : 0);
  }, 0);
};

export default function Form1SetupScreen() {
  const { files, extractedData, setExtractedData } = useFiles();
  const navigate = useNavigate();
  const location = useLocation();
  const [uploadedFile, setUploadedFile] = useState(null);
  const [formData, setFormData] = useState({});
  const [rawTexts, setRawTexts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [errors, setErrors] = useState({});
  const [openDialog, setOpenDialog] = useState(false);
  const [missingFields, setMissingFields] = useState([]);
  const [actionToPerform, setActionToPerform] = useState(null);
  const [customDialogOpen, setCustomDialogOpen] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customTarget, setCustomTarget] = useState("");
  const [fairVerifiedByOptions, setFairVerifiedByOptions] = useState(["Arvind", "Kiran", "Sharath"]);
  const [fairReviewedByOptions, setFairReviewedByOptions] = useState(["Arvind", "Kiran", "Sharath"]);
  const [customerApprovalOptions, setCustomerApprovalOptions] = useState(["Arvind", "Kiran", "Sharath"]);
  const [rows, setRows] = useState([
    { indexPartNumber: '', indexPartName: '', indexPartType: '', indexSupplier: '', indexFairIdentifier: '' }
  ]);
  const [partNameOptions, setPartNameOptions] = useState([]);
  const [serialNumberOptions, setSerialNumberOptions] = useState([]);
  const [showRawText, setShowRawText] = useState(false);

  const serialOccurrences = countOccurrences(rawTexts, formData.serialNumber);
  const mfgOccurrences = countOccurrences(rawTexts, formData.manufacturingProcessReference);
  const isSerialValid = serialOccurrences >= 2;
  const isMfgValid = mfgOccurrences >= 2;
  let isPartNumberValid = false;
  if (formData.partNumber) {
    const partNumberCount = countOccurrences(rawTexts, formData.partNumber);
    if (partNumberCount >= 2) {
      isPartNumberValid = true;
    }
  }
  let isPartNameValid = false;
  if (formData.partName) {
    const partNameCount = countOccurrences(rawTexts, formData.partName);
    if (partNameCount >= 2) {
      isPartNameValid = true;
    }
  }
  let isPartRevisionValid = false;
  if (formData.partRevisionLevel) {
    const partRevisionCount = countOccurrences(rawTexts, formData.partRevisionLevel);
    if (partRevisionCount >= 2) {
      isPartRevisionValid = true;
    }
  }
  
  useEffect(() => {
    if (extractedData) {
      setFormData(extractedData.formData);
      setRawTexts(extractedData.rawTexts);
      setPartNameOptions(extractedData.partNameOptions);
      setSerialNumberOptions(extractedData.serialNumberOptions);
      setRows(extractedData.rows || [{ indexPartNumber: '', indexPartName: '', indexPartType: '', indexSupplier: '', indexFairIdentifier: '' }]);
      return;
    }

    const processFiles = async () => {
      if (!files || files.length === 0) return;
      setIsLoading(true);
      setError('');
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
          const mergedData = mergeParsedData(parsedResults);
          setFormData(mergedData);
          setRawTexts(rawResults);
          
          const newPartNameOptions = Array.from(new Set(parsedResults.map(r => r.partDescription || r.partName).filter(Boolean)));
          const newSerialNumberOptions = Array.from(new Set(parsedResults.map(r => r.serialNumber).filter(Boolean)));
          setPartNameOptions(newPartNameOptions);
          setSerialNumberOptions(newSerialNumberOptions);

          setExtractedData({
            formData: mergedData,
            rawTexts: rawResults,
            partNameOptions: newPartNameOptions,
            serialNumberOptions: newSerialNumberOptions,
            rows: rows,
          });
        }
      } catch (err) {
        console.error('API Error:', err);
        setError('Failed to extract data. Is the backend server running?');
      } finally {
        setIsLoading(false);
      }
    };
    processFiles();
  }, [files, extractedData, setExtractedData]);

  const validateForm = () => {
    let missing = [];
    if (!formData.partNumber) missing.push("1. Part Number");
    if (!formData.partName) missing.push("2. Part Name");
    if (!formData.serialNumber) missing.push("3. Serial Number");
    if (!formData.fairIdentifier) missing.push("4. FAIR Identifier");
    if (!formData.partRevisionLevel) missing.push("5. Part Revision Level");
    if (!formData.drawingNumber) missing.push("6. Drawing Number");
    if (!formData.drawingRevisionLevel) missing.push("7. Drawing Revision Level");
    if (!formData.additionalChanges) missing.push("8. Additional Changes");
    if (!formData.manufacturingProcessReference) missing.push("9. Manufacturing Process Reference");
    if (!formData.organizationName) missing.push("10. Organization Name");
    if (!formData.supplierCode) missing.push("11. Supplier Code");
    if (!formData.purchaseOrderNumber) missing.push("12. Purchase Order Number");
    if (!formData.comments) missing.push("26. Comments");
    if (!formData.serialised && !formData.nonSerialised) missing.push("Serialised / Non-serialised");
    if (!formData.detailFAI && !formData.assemblyFAI) missing.push("13. Detail FAI / Assembly FAI");
    if (!formData.partialFAI && !formData.fullFAI) missing.push("14. Partial FAI / Full FAI");
    if (formData.partialFAI || formData.fullFAI) {
      if (!formData.faiReason) missing.push("Reason for Full/Partial FAI");
    }
    if (!formData.fairNonconformance) missing.push("19. Does FAIR contain a documented nonconformance?");
    if (!formData.fairVerifiedBy) missing.push("20. FAIR Verified By");
    if (!formData.fairReviewedBy) missing.push("22. FAIR Reviewed/Approved By");
    if (!formData.customerApproval) missing.push("24. Customer Approval");
    return missing;
  };
  
  const handleAddRow = () => {
    setRows((r) => [...r, { indexPartNumber: '', indexPartName: '', indexPartType: '', indexSupplier: '', indexFairIdentifier: '' }]);
  };
  
  const handleDeleteRow = (idx) => {
    const updatedRows = rows.filter((_, i) => i !== idx);
    setRows(updatedRows);
  };
  
  const setFieldValue = (name, value) => {
    setFormData(prev => {
      let updated = { ...prev, [name]: value };
      if (name === "partNumber") {
        updated.drawingNumber = value;
      }
      return updated;
    });
  };

  const performAction = (action) => {
    if (action === 'save') {
      setExtractedData({
        ...extractedData,
        formData,
        rows,
      });
      alert("Form 1 data saved locally!");
      setOpenDialog(false);
    } else if (action === 'next') {
      setExtractedData({
        ...extractedData,
        formData,
        rows,
      });
      navigate('/form2setup', {
        state: {
          form1Data: {
            partNumber: formData.partNumber,
            partName: formData.partName,
            serialNumber: formData.serialNumber,
            fairIdentifier: formData.fairIdentifier,
          }
        }
      });
      setOpenDialog(false);
    } else if (action === 'upload') {
      navigate('/fileupload');
    }
  };
  
  const handleSave = () => {
    const missing = validateForm();
    if (missing.length > 0) {
      setMissingFields(missing);
      setActionToPerform('save');
      setOpenDialog(true);
    } else {
      performAction('save');
    }
  };
  
  const handleNext = () => {
    const missing = validateForm();
    if (missing.length > 0) {
      setMissingFields(missing);
      setActionToPerform('next');
      setOpenDialog(true);
    } else {
      performAction('next');
    }
  };

  const handleGoToUpload = () => {
    // Clear the extracted data so a new extraction happens on next visit
    setExtractedData(null);
    navigate('/');
  };

  const handlePdfExport = () => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const marginX = 10;
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.setFont("helvetica");
    doc.setFontSize(12);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("FAIR Form 1", pageWidth / 2, 15, { align: "center" });
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("First Article Inspection Report - Part Number Accountability", pageWidth / 2, 20, { align: "center" });
    const startY = 30;
    const boxWidth = pageWidth - 2 * marginX;
    const minBoxHeight = 10;
    let currentY = startY;
    const calculateBoxHeight = (value, width, minHeight) => {
      const lines = doc.splitTextToSize(value || "", width - 4);
      const textHeight = lines.length * 4;
      return Math.max(minHeight, textHeight + 6);
    };
    const drawBox = (label, value, x, y, width, height) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      const labelText = label;
      doc.text(labelText, x + 2, y + 4);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      const lines = doc.splitTextToSize(value || "", width - 4);
      doc.rect(x, y, width, height);
      doc.text(lines, x + 2, y + 8);
    };
    const quarterBoxWidth = boxWidth / 4;
    const partNumberText = formData.partNumber + (formData.customerPartNumber ? "\nCustomer Part Number: " + formData.customerPartNumber : "");
    const row1Values = [
      partNumberText,
      formData.partName || "",
      formData.serialNumber || "",
      formData.fairIdentifier || ""
    ];
    const row1Widths = [quarterBoxWidth, quarterBoxWidth, quarterBoxWidth, quarterBoxWidth];
    const row1Labels = ["1. PART NUMBER", "2. PART NAME", "3. SERIAL NUMBER", "4. FAIR IDENTIFIER"];
    let maxRow1Height = Math.max(
      ...row1Values.map((val, i) => calculateBoxHeight(val, row1Widths[i], minBoxHeight))
    );
    row1Values.forEach((val, i) => {
      drawBox(row1Labels[i], val, marginX + (i * quarterBoxWidth), currentY, row1Widths[i], maxRow1Height);
    });
    currentY += maxRow1Height;
    const row2Values = [
      formData.partRevisionLevel || "",
      formData.drawingNumber || "",
      formData.drawingRevisionLevel || "",
      formData.additionalChanges || ""
    ];
    const row2Widths = [boxWidth / 4, boxWidth / 4, boxWidth / 4, boxWidth / 4];
    const row2Labels = ["5. PART REVISION LEVEL", "6. DRAWING NUMBER", "7. DRAWING REVISION LEVEL", "8. ADDITIONAL CHANGES"];
    let maxRow2Height = Math.max(
      ...row2Values.map((val, i) => calculateBoxHeight(val, row2Widths[i], minBoxHeight))
    );
    row2Values.forEach((val, i) => {
      drawBox(row2Labels[i], val, marginX + (i * (boxWidth / 4)), currentY, row2Widths[i], maxRow2Height);
    });
    currentY += maxRow2Height;
    const row3Values = [
      formData.manufacturingProcessReference || "",
      formData.organizationName || ""
    ];
    const row3Widths = [boxWidth / 2, boxWidth / 2];
    const row3Labels = ["9. MANUFACTURING PROCESS REFERENCE", "10. ORGANIZATION NAME"];
    let maxRow3Height = Math.max(
      ...row3Values.map((val, i) => calculateBoxHeight(val, row3Widths[i], minBoxHeight))
    );
    row3Values.forEach((val, i) => {
      drawBox(row3Labels[i], val, marginX + (i * (boxWidth / 2)), currentY, row3Widths[i], maxRow3Height);
    });
    currentY += maxRow3Height;
    const row4Values = [
      formData.supplierCode || "",
      formData.purchaseOrderNumber || ""
    ];
    const row4Widths = [boxWidth / 2, boxWidth / 2];
    const row4Labels = ["11. SUPPLIER CODE", "12. PURCHASE ORDER NUMBER"];
    let maxRow4Height = Math.max(
      ...row4Values.map((val, i) => calculateBoxHeight(val, row4Widths[i], minBoxHeight))
    );
    row4Values.forEach((val, i) => {
      drawBox(row4Labels[i], val, marginX + (i * (boxWidth / 2)), currentY, row4Widths[i], maxRow4Height);
    });
    currentY += maxRow4Height;
    const startYFAI = currentY;
    doc.setFontSize(8);
    const checkboxXOffset = 5;
    const checkboxWidth = 3;
    const checkboxCenterOffset = checkboxWidth / 2;
    const faiTypeLabelX = marginX + boxWidth / 2;
    const faiTypeCheckboxOffset = 25;
    const faiTypeTextOffset = faiTypeCheckboxOffset + checkboxWidth + 2;
    let faiSectionY = currentY + 4;
    doc.text("13.", marginX, faiSectionY);
    doc.text("14. FAI Type:", faiTypeLabelX, faiSectionY);
    doc.rect(marginX + checkboxXOffset, currentY + 1, checkboxWidth, checkboxWidth);
    if (formData.detailFAI) {
      doc.setFontSize(6);
      doc.text("v", marginX + checkboxXOffset + checkboxCenterOffset, currentY + 1 + checkboxCenterOffset + 1, { align: 'center' });
      doc.setFontSize(8);
    }
    doc.text("Detail FAI", marginX + checkboxXOffset + checkboxWidth + 2, faiSectionY);
    doc.rect(marginX + checkboxXOffset + 30, currentY + 1, checkboxWidth, checkboxWidth);
    if (formData.assemblyFAI) {
      doc.setFontSize(6);
      doc.text("v", marginX + checkboxXOffset + 30 + checkboxCenterOffset, currentY + 1 + checkboxCenterOffset + 1, { align: 'center' });
      doc.setFontSize(8);
    }
    doc.text("Assembly FAI", marginX + checkboxXOffset + 30 + checkboxWidth + 2, faiSectionY);
    doc.rect(faiTypeLabelX + faiTypeCheckboxOffset, currentY + 1, checkboxWidth, checkboxWidth);
    if (formData.fullFAI) {
      doc.setFontSize(6);
      doc.text("v", faiTypeLabelX + faiTypeCheckboxOffset + checkboxCenterOffset, currentY + 1 + checkboxCenterOffset + 1, { align: 'center' });
      doc.setFontSize(8);
    }
    doc.text("Full FAI", faiTypeLabelX + faiTypeTextOffset, faiSectionY);
    doc.rect(faiTypeLabelX + faiTypeCheckboxOffset + 30, currentY + 1, checkboxWidth, checkboxWidth);
    if (formData.partialFAI) {
      doc.setFontSize(6);
      doc.text("v", faiTypeLabelX + faiTypeCheckboxOffset + 30 + checkboxCenterOffset, currentY + 1 + checkboxCenterOffset + 1, { align: 'center' });
      doc.setFontSize(8);
    }
    doc.text("Partial FAI", faiTypeLabelX + faiTypeTextOffset + 30, faiSectionY);
    doc.setFontSize(8);
    let reasonText = "";
    if (formData.faiReasonDropdown && formData.faiReasonDropdown !== "" && formData.faiReasonDropdown !== "Other") {
        reasonText = formData.faiReasonDropdown;
    }
    if (formData.faiReason && formData.faiReason.trim() !== "") {
        if (reasonText) {
            reasonText += " - ";
        }
        reasonText += formData.faiReason;
    }
    if (formData.faiReasonCode && formData.faiReasonCode !== "") {
        if (reasonText) {
            reasonText += " - ";
        }
        reasonText += formData.faiReasonCode;
    }
    const reasonForFAIHeading = "Reason for Full/Partial FAI: ";
    const reasonLines = doc.splitTextToSize(reasonForFAIHeading + reasonText, boxWidth / 2 - 5);
    doc.text(reasonLines, faiTypeLabelX, currentY + 12);
    let currentYForReason = currentY + 12 + (reasonLines.length * 4);
    doc.text("AOG", faiTypeLabelX, currentYForReason + 4);
    doc.rect(faiTypeLabelX + 10, currentYForReason + 1, checkboxWidth, checkboxWidth);
    if (formData.aog) {
      doc.setFontSize(6);
      doc.text("v", faiTypeLabelX + 10 + checkboxCenterOffset, currentYForReason + 1 + checkboxCenterOffset + 1, { align: 'center' });
      doc.setFontSize(8);
    }
    doc.text("FAA Approved", faiTypeLabelX + 25, currentYForReason + 4);
    doc.rect(faiTypeLabelX + 55, currentYForReason + 1, checkboxWidth, checkboxWidth);
    if (formData.faaApproved) {
      doc.setFontSize(6);
      doc.text("v", faiTypeLabelX + 55 + checkboxCenterOffset, currentYForReason + 1 + checkboxCenterOffset + 1, { align: 'center' });
      doc.setFontSize(8);
    }
    currentY += minBoxHeight;
    currentY += Math.max(0, reasonLines.length * 4) + minBoxHeight;
    currentY += 5;
    const tableHeaders = ["15. PART NUMBER", "16. PART NAME", "17. PART TYPE", "18. SUPPLIER", "19. FAIR IDENTIFIER", "REFERENCE DOCUMENT"];
    const colWidths = [30, 30, 25, 25, 30, 50];
    let tableY = currentY;
    const minRowHeight = 7;
    const tableLineHeight = 5;
    doc.setFont("helvetica", "bold");
    let currentX = marginX;
    tableHeaders.forEach((header, i) => {
      doc.rect(currentX, tableY, colWidths[i], 7);
      doc.text(header, currentX + 2, tableY + 5);
      currentX += colWidths[i];
    });
    tableY += 7;
    doc.setFont("helvetica", "normal");
    rows.forEach((row, i) => {
      const texts = [
        formData[`indexPartNumber_${i}`] || "",
        formData[`indexPartName_${i}`] || "",
        formData[`indexPartType_${i}`] || "",
        formData[`indexSupplier_${i}`] || "",
        formData[`indexFairIdentifier_${i}`] || "",
        row.referenceFile ? row.referenceFile.name : ""
      ];
      let maxLines = 1;
      texts.forEach((text, index) => {
        const lines = doc.splitTextToSize(text, colWidths[index] - 4).length;
        if (lines > maxLines) {
          maxLines = lines;
        }
      });
      const rowHeight = Math.max(minRowHeight, maxLines * tableLineHeight);
      let rowX = marginX;
      texts.forEach((text, index) => {
        doc.rect(rowX, tableY, colWidths[index], rowHeight);
        const cellText = doc.splitTextToSize(text, rowX + 2, tableY + 5);
        rowX += colWidths[index];
      });
      tableY += rowHeight;
    });
    currentY = tableY;
    currentY += 5;
    let rowCustHeights = [
      calculateBoxHeight(formData.customer || "", boxWidth / 3, minBoxHeight),
      calculateBoxHeight(formData.program || "", boxWidth / 3, minBoxHeight),
      calculateBoxHeight(formData.toDivision || "", boxWidth / 3, minBoxHeight)
    ];
    let maxRowCustHeight = Math.max(...rowCustHeights);
    drawBox("CUSTOMER", formData.customer || "", marginX, currentY, boxWidth / 3, maxRowCustHeight);
    drawBox("PROGRAM", formData.program || "", marginX + boxWidth / 3, currentY, boxWidth / 3, maxRowCustHeight);
    drawBox("TO DIVISION", formData.toDivision || "", marginX + (2 * boxWidth) / 3, currentY, boxWidth / 3, maxRowCustHeight);
    currentY += maxRowCustHeight;
    currentY += 5;
    const nonConformanceLabel = "19. DOES FAIR CONTAIN A DOCUMENTED NONCONFORMANCE?";
    const nonConformanceValue = "";
    const box19Height = calculateBoxHeight(nonConformanceValue, boxWidth, minBoxHeight);
    drawBox(nonConformanceLabel, nonConformanceValue, marginX, currentY, boxWidth, minBoxHeight);
    const nonconformanceCheckboxX = marginX + boxWidth - 30;
    doc.rect(nonconformanceCheckboxX, currentY + 1, checkboxWidth, checkboxWidth);
    doc.text("Yes", nonconformanceCheckboxX + checkboxWidth + 2, currentY + 4);
    if (formData.fairNonconformance === 'Yes') {
      doc.setFontSize(6);
      doc.text("v", nonconformanceCheckboxX + checkboxCenterOffset, currentY + 1 + checkboxCenterOffset + 1, { align: 'center' });
      doc.setFontSize(8);
    }
    doc.rect(nonconformanceCheckboxX + 15, currentY + 1, checkboxWidth, checkboxWidth);
    doc.text("No", nonconformanceCheckboxX + 15 + checkboxWidth + 2, currentY + 4);
    if (formData.fairNonconformance === 'No') {
      doc.setFontSize(6);
      doc.text("v", nonconformanceCheckboxX + 15 + checkboxCenterOffset, currentY + 1 + checkboxCenterOffset + 1, { align: 'center' });
      doc.setFontSize(8);
    }
    currentY += box19Height;
    let row20Heights = [
      calculateBoxHeight(formData.fairVerifiedBy || "", boxWidth / 2, minBoxHeight),
      calculateBoxHeight(formData.fairVerifiedDate || "", boxWidth / 2, minBoxHeight)
    ];
    let maxRow20Height = Math.max(...row20Heights);
    drawBox("20. FAIR VERIFIED BY", formData.fairVerifiedBy || "", marginX, currentY, boxWidth / 2, maxRow20Height);
    drawBox("21. DATE", formData.fairVerifiedDate || "", marginX + boxWidth / 2, currentY, boxWidth / 2, maxRow20Height);
    currentY += maxRow20Height;
    let row22Heights = [
      calculateBoxHeight(formData.fairReviewedBy || "", boxWidth / 2, minBoxHeight),
      calculateBoxHeight(formData.fairReviewedDate || "", boxWidth / 2, minBoxHeight)
    ];
    let maxRow22Height = Math.max(...row22Heights);
    drawBox("22. FAIR REVIEWED/APPROVED BY", formData.fairReviewedBy || "", marginX, currentY, boxWidth / 2, maxRow22Height);
    drawBox("23. DATE", formData.fairReviewedDate || "", marginX + boxWidth / 2, currentY, boxWidth / 2, maxRow22Height);
    currentY += maxRow22Height;
    let row24Heights = [
      calculateBoxHeight(formData.customerApproval || "", boxWidth / 2, minBoxHeight),
      calculateBoxHeight(formData.customerApprovalDate || "", boxWidth / 2, minBoxHeight)
    ];
    let maxRow24Height = Math.max(...row24Heights);
    drawBox("24. CUSTOMER APPROVAL", formData.customerApproval || "", marginX, currentY, boxWidth / 2, maxRow24Height);
    drawBox("25. DATE", formData.customerApprovalDate || "", marginX + boxWidth / 2, currentY, boxWidth / 2, maxRow24Height);
    currentY += maxRow24Height;
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text("26. COMMENTS", marginX + 2, currentY + 4);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    const commentsLines = doc.splitTextToSize(formData.comments || "", boxWidth - 4);
    const commentsHeight = Math.max(20, commentsLines.length * 4 + 6);
    doc.rect(marginX, currentY, boxWidth, commentsHeight);
    doc.text(commentsLines, marginX + 2, currentY + 8);
    currentY += commentsHeight;
    doc.save('Form1_FAI_Report.pdf');
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
                    <SmartTextField
                      label="1. Part Number"
                      name="partNumber"
                      formData={formData}
                      setField={setFieldValue}
                      fullWidth
                      multiline
                      minRows={1}
                      maxRows={4}
                      sx={{
                        "& .MuiOutlinedInput-root": {
                          "& fieldset": {
                            borderColor: isPartNumberValid ? "darkgreen" : undefined,
                            borderWidth: isPartNumberValid ? 2 : undefined
                          },
                          "&:hover fieldset": {
                            borderColor: isPartNumberValid ? "darkgreen" : undefined
                          },
                          "&.Mui-focused fieldset": {
                            borderColor: isPartNumberValid ? "darkgreen" : undefined,
                            borderWidth: isPartNumberValid ? 2 : undefined
                          }
                        }
                      }}
                    />
                    <SmartTextField
                      label="Customer Part Number"
                      name="customerPartNumber"
                      formData={formData}
                      setField={setFieldValue}
                      fullWidth
                      multiline
                      minRows={1}
                      maxRows={4}
                      InputProps={{
                        readOnly: true,
                      }}
                      sx={{
                        "& .MuiOutlinedInput-root": {
                          "& fieldset": {
                            borderColor: isPartNumberValid ? "darkgreen" : undefined,
                            borderWidth: isPartNumberValid ? 2 : undefined
                          },
                          "&:hover fieldset": {
                            borderColor: isPartNumberValid ? "darkgreen" : undefined
                          },
                          "&.Mui-focused fieldset": {
                            borderColor: isPartNumberValid ? "darkgreen" : undefined,
                            borderWidth: isPartNumberValid ? 2 : undefined
                          }
                        }
                      }}
                    />
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <SmartTextField
                      label="2. Part Name"
                      name="partName"
                      formData={formData}
                      setField={setFieldValue}
                      fullWidth
                      multiline
                      minRows={1}
                      maxRows={4}
                    />
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <SmartTextField
                      label="3. Serial Number"
                      name="serialNumber"
                      formData={formData}
                      setField={setFieldValue}
                      fullWidth
                      multiline
                      minRows={1}
                      maxRows={4}
                    />
                    <Box display="flex" flexDirection="column" mt={1}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={formData.serialised === true}
                            onChange={() =>
                              setFormData((prev) => {
                                let baseSerial = prev.serialNumber || "";
                                if (prev.supplierCode && baseSerial.startsWith(prev.supplierCode)) {
                                  baseSerial = baseSerial.replace(prev.supplierCode, "");
                                }
                                let newSerialNumber = prev.supplierCode
                                  ? `${prev.supplierCode}${baseSerial}`
                                  : baseSerial;
                                return {
                                  ...prev,
                                  serialised: true,
                                  nonSerialised: false,
                                  serialNumber: newSerialNumber,
                                };
                              })
                            }
                          />
                        }
                        label="Serialised"
                      />
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={formData.nonSerialised === true}
                            onChange={() =>
                              setFormData((prev) => {
                                let baseSerial = prev.serialNumber || "";
                                if (prev.supplierCode && baseSerial.startsWith(prev.supplierCode)) {
                                  baseSerial = baseSerial.replace(prev.supplierCode, "");
                                }
                                return {
                                  ...prev,
                                  serialised: false,
                                  nonSerialised: true,
                                  serialNumber: baseSerial,
                                };
                              })
                            }
                          />
                        }
                        label="Non-serialised"
                      />
                    </Box>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <SmartTextField label="4. FAIR Identifier" name="fairIdentifier" formData={formData} setField={setFieldValue} fullWidth
                      multiline
                      minRows={1}
                      maxRows={4}
                    />
                  </Grid>
                </Grid>

                <Grid container spacing={2} sx={{ mt: 2 }}>
                  <Grid item xs={6} sm={3}>
                    <SmartTextField
                      label="5. Part Revision Level"
                      name="partRevisionLevel"
                      formData={formData}
                      setField={setFieldValue}
                      fullWidth
                      multiline
                      minRows={1}
                      maxRows={4}
                      sx={{
                        "& .MuiOutlinedInput-root": {
                          "& fieldset": {
                            borderColor: isPartRevisionValid ? "darkgreen" : undefined,
                            borderWidth: isPartRevisionValid ? 2 : undefined
                          },
                          "&:hover fieldset": {
                            borderColor: isPartRevisionValid ? "darkgreen" : undefined
                          },
                          "&.Mui-focused fieldset": {
                            borderColor: isPartRevisionValid ? "darkgreen" : undefined,
                            borderWidth: isPartRevisionValid ? 2 : undefined
                          }
                        }
                      }}
                    />
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <SmartTextField
                      label="6. Drawing Number"
                      name="drawingNumber"
                      formData={formData}
                      setField={setFieldValue}
                      fullWidth
                      multiline
                      minRows={1}
                      maxRows={4}
                      sx={{
                        "& .MuiOutlinedInput-root": {
                          "& fieldset": {
                            borderColor:
                              formData.drawingNumber && formData.partNumber
                                ? (formData.drawingNumber === formData.partNumber ? "green" : "red")
                                : undefined,
                            borderWidth:
                              formData.drawingNumber && formData.partNumber ? 2 : undefined,
                          },
                        },
                      }}
                    />
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <SmartTextField label="7. Drawing Revision Level" name="drawingRevisionLevel" formData={formData} setField={setFieldValue} fullWidth
                      multiline
                      minRows={1}
                      maxRows={4}
                      sx={{
                        "& .MuiOutlinedInput-root": {
                          "& fieldset": {
                            borderColor:
                              formData.partRevisionLevel && formData.drawingRevisionLevel
                                ? (formData.partRevisionLevel === formData.drawingRevisionLevel ? "green" : "red")
                                : undefined,
                            borderWidth:
                              formData.partRevisionLevel && formData.drawingRevisionLevel ? 2 : undefined,
                          },
                        },
                      }}
                    />
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <SmartTextField label="8. Additional Changes" name="additionalChanges" formData={formData} setField={setFieldValue} fullWidth
                      multiline
                      minRows={1}
                      maxRows={4}
                    />
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <SmartTextField
                      label="9. Manufacturing Process Reference"
                      name="manufacturingProcessReference"
                      formData={formData}
                      setField={setFieldValue}
                      fullWidth
                      multiline
                      minRows={1}
                      maxRows={4}
                      sx={{
                        "& .MuiOutlinedInput-root": {
                          "& fieldset": {
                            borderColor: isMfgValid ? "darkgreen" : undefined,
                            borderWidth: isMfgValid ? 2 : undefined
                          },
                          "&:hover fieldset": {
                            borderColor: isMfgValid ? "darkgreen" : undefined
                          },
                          "&.Mui-focused fieldset": {
                            borderColor: isMfgValid ? "darkgreen" : undefined,
                            borderWidth: isMfgValid ? 2 : undefined
                          }
                        }
                      }}
                    />
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <FormControl fullWidth>
                      <InputLabel id="organizationName-label">10. Organization Name</InputLabel>
                      <Select
                        labelId="organizationName-label"
                        value={formData.organizationName || ""}
                        onChange={(e) => setFieldValue("organizationName", e.target.value)}
                        name="organizationName"
                      >
                        <MenuItem value="International aerospace manufacturing private ltd. , Hosur">International aerospace manufacturing private ltd. , Hosur</MenuItem>
                        <MenuItem value="International aerospace manufacturing private ltd. , Bangalore">International aerospace manufacturing private ltd. , Bangalore</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <SmartTextField label="11. Supplier Code" name="supplierCode" formData={formData} setField={setFieldValue} fullWidth
                      multiline
                      minRows={1}
                      maxRows={4}
                    />
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <SmartTextField label="12. Purchase Order Number" name="purchaseOrderNumber" formData={formData} setField={setFieldValue} fullWidth
                      multiline
                      minRows={1}
                      maxRows={4}
                    />
                  </Grid>
                </Grid>

                <Grid container spacing={2} sx={{ mt: 2 }}>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle1" sx={{ mb: 1 }}>
                      13.
                    </Typography>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={formData.detailFAI || false}
                          onChange={(e) => setFieldValue("detailFAI", e.target.checked)}
                          name="detailFAI"
                        />
                      }
                      label="Detail FAI"
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={formData.assemblyFAI || false}
                          onChange={(e) => setFieldValue("assemblyFAI", e.target.checked)}
                          name="assemblyFAI"
                        />
                      }
                      label="Assembly FAI"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle1" sx={{ mb: 1 }}>
                      14. FAI Type
                    </Typography>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={formData.partialFAI || false}
                          onChange={(e) => setFieldValue("partialFAI", e.target.checked)}
                          name="partialFAI"
                        />
                      }
                      label="Partial FAI"
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={formData.fullFAI || false}
                          onChange={(e) => setFieldValue("fullFAI", e.target.checked)}
                          name="fullFAI"
                        />
                      }
                      label="Full FAI"
                    />
                    <TextField
                      fullWidth
                      label="Reason for Full/Partial FAI"
                      name="faiReason"
                      value={formData.faiReason || ""}
                      onChange={(e) => setFieldValue("faiReason", e.target.value)}
                      placeholder="Enter reason here"
                      sx={{ mt: 2 }}
                      multiline
                      minRows={2}
                      maxRows={4}
                    />
                    <FormControl fullWidth sx={{ mt: 2 }}>
                      <InputLabel id="fai-reason-code-label">Select Code</InputLabel>
                      <Select
                        labelId="fai-reason-code-label"
                        name="faiReasonCode"
                        value={formData.faiReasonCode || ""}
                        onChange={(e) => setFieldValue("faiReasonCode", e.target.value)}
                      >
                        {["Correcting previous FAI", "Lapse in production", "Location change", "New design or product", "Process change", "Revision change", "Supplier change","Others(see comments)"].map((option) => (
                          <MenuItem key={option} value={option}>
                            {option}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <Box display="flex" flexDirection="row" sx={{ mt: 2 }}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={formData.aog || false}
                            onChange={(e) => setFieldValue("aog", e.target.checked)}
                            name="aog"
                          />
                        }
                        label="AOG"
                      />
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={formData.faaApproved || false}
                            onChange={(e) => setFieldValue("faaApproved", e.target.checked)}
                            name="faaApproved"
                          />
                        }
                        label="FAA Approved"
                      />
                    </Box>
                  </Grid>
                </Grid>

                <TableContainer
                  component={Paper}
                  sx={{ backgroundColor: "white", boxShadow: 3, borderRadius: 2, mt: 2 }}
                >
                  <Table>
                    <TableHead>
                      <TableRow sx={{ backgroundColor: "#f1f1f1" }}>
                        {[
                          "15. Part Number",
                          "16. Part Name",
                          "17. Part Type",
                          "Supplier",
                          "18. FAIR Identifier",
                          "Reference Document",
                          "",
                        ].map((header, i) => (
                          <TableCell
                            key={i}
                            sx={{ fontWeight: "bold", border: "1px solid #ddd", textAlign: "center" }}
                          >
                            {header}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {rows.map((row, idx) => (
                        <TableRow key={idx}>
                          <TableCell sx={{ border: "1px solid #eee", padding: "8px" }}>
                            <SmartTextField
                              name={`indexPartNumber_${idx}`}
                              formData={formData}
                              setField={setFieldValue}
                              fullWidth
                              multiline
                              minRows={1}
                              maxRows={4}
                            />
                          </TableCell>
                          <TableCell sx={{ border: "1px solid #eee", padding: "8px" }}>
                            <SmartTextField
                              name={`indexPartName_${idx}`}
                              formData={formData}
                              setField={setFieldValue}
                              fullWidth
                              multiline
                              minRows={1}
                              maxRows={4}
                            />
                          </TableCell>
                          <TableCell sx={{ border: "1px solid #eee", padding: "8px" }}>
                            <FormControl fullWidth size="small">
                              <Select
                                value={formData[`indexPartType_${idx}`] || ""}
                                onChange={(e) =>
                                  setFieldValue(`indexPartType_${idx}`, e.target.value)
                                }
                                displayEmpty
                              >
                                <MenuItem value="">
                                  <em>Select Type</em>
                                </MenuItem>
                                <MenuItem value="Detail">Detail</MenuItem>
                                <MenuItem value="Sub-Assembly">Sub-Assembly</MenuItem>
                                <MenuItem value="Software">Software</MenuItem>
                                <MenuItem value="Standard Catalogue item">Standard catalogue item</MenuItem>
                                <MenuItem value="COTS (or equivalent)">COTS (or equivalent)</MenuItem>
                              </Select>
                            </FormControl>
                          </TableCell>
                          <TableCell sx={{ border: "1px solid #eee", padding: "8px" }}>
                            <SmartTextField
                              name={`indexSupplier_${idx}`}
                              formData={formData}
                              setField={setFieldValue}
                              fullWidth
                              multiline
                              minRows={1}
                              maxRows={4}
                            />
                          </TableCell>
                          <TableCell sx={{ border: "1px solid #eee", padding: "8px" }}>
                            <SmartTextField
                              name={`indexFairIdentifier_${idx}`}
                              formData={formData}
                              setField={setFieldValue}
                              fullWidth
                              multiline
                              minRows={1}
                              maxRows={4}
                            />
                          </TableCell>
                          <TableCell sx={{ border: "1px solid #eee", padding: "8px" }}>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                              <IconButton color="primary" component="label" size="small">
                                <UploadFileIcon />
                                <input
                                  type="file"
                                  accept="application/pdf,image/*"
                                  hidden
                                  onChange={(e) => {
                                    if (e.target.files.length > 0) {
                                      const file = e.target.files[0];
                                      const updatedRows = [...rows];
                                      updatedRows[idx].referenceFile = file;
                                      setRows(updatedRows);
                                    }
                                  }}
                                />
                              </IconButton>
                              {row.referenceFile && (
                                <a
                                  href={URL.createObjectURL(row.referenceFile)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{ textDecoration: "none", color: "blue" }}
                                >
                                  {row.referenceFile.name}
                                </a>
                              )}
                            </Box>
                          </TableCell>
                          <TableCell sx={{ textAlign: "center", border: "1px solid #eee" }}>
                            <Box sx={{ display: "flex", justifyContent: "center", gap: 1 }}>
                              {idx === rows.length - 1 && (
                                <IconButton color="primary" onClick={handleAddRow}>
                                  <AddIcon />
                                </IconButton>
                              )}
                              <IconButton color="error" onClick={() => handleDeleteRow(idx)}>
                                <DeleteIcon />
                              </IconButton>
                            </Box>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>

                <Grid container spacing={2} sx={{ mt: 2 }}>
                  <Grid item xs={12} sm={4}>
                    <SmartTextField
                      label="Customer"
                      name="customer"
                      formData={formData}
                      setField={setFieldValue}
                      multiline
                      rows={2}
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <SmartTextField
                      label="Program"
                      name="program"
                      formData={formData}
                      setField={setFieldValue}
                      multiline
                      rows={2}
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <SmartTextField
                      label="To Division"
                      name="toDivision"
                      formData={formData}
                      setField={setFieldValue}
                      multiline
                      rows={2}
                    />
                  </Grid>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <FormControl component="fieldset">
                    <FormLabel component="legend">
                      19. Does FAIR contain a documented nonconformance(s)?
                    </FormLabel>
                    <RadioGroup
                      row
                      name="fairNonconformance"
                      value={formData.fairNonconformance || ""}
                      onChange={(e) => setFieldValue("fairNonconformance", e.target.value)}
                    >
                      <FormControlLabel value="Yes" control={<Radio />} label="Yes" />
                      <FormControlLabel value="No" control={<Radio />} label="No" />
                    </RadioGroup>
                  </FormControl>
                </Grid>

                <Grid container spacing={2} sx={{ mt: 2 }}>
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth>
                      <InputLabel id="fair-verified-by-label">20. FAIR Verified By</InputLabel>
                      <Select
                        labelId="fair-verified-by-label"
                        value={formData.fairVerifiedBy || ""}
                        renderValue={(selected) => selected}
                        onChange={(e) => {
                          const selected = e.target.value;
                          if (selected === "Custom") {
                            setCustomTarget("fairVerifiedBy");
                            setCustomDialogOpen(true);
                          } else {
                            setFieldValue("fairVerifiedBy", selected);
                            const currentDateTime = new Date().toLocaleString("en-GB", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            });
                            setFieldValue("fairVerifiedDate", currentDateTime);
                          }
                        }}
                      >
                        {fairVerifiedByOptions.map((name, idx) => (
                          <MenuItem
                            key={idx}
                            value={name}
                            sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
                          >
                            {name}
                            {formData.fairVerifiedBy !== name &&
                              name !== "Arvind" &&
                              name !== "Kiran" &&
                              name !== "Sharath" && (
                                <IconButton
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setFairVerifiedByOptions((prev) =>
                                      prev.filter((opt) => opt !== name)
                                    );
                                    if (formData.fairVerifiedBy === name) {
                                      setFieldValue("fairVerifiedBy", "");
                                      setFieldValue("fairVerifiedDate", "");
                                    }
                                  }}
                                >
                                  ❌
                                </IconButton>
                              )}
                          </MenuItem>
                        ))}
                        <MenuItem value="Custom">+ Add Custom</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="21. Date & Time"
                      name="fairVerifiedDate"
                      value={formData.fairVerifiedDate || ""}
                      placeholder="DD/MM/YYYY HH:MM:SS"
                      InputProps={{
                        readOnly: true,
                      }}
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth>
                      <InputLabel id="fairReviewedBy-label">22. FAIR Reviewed/Approved By</InputLabel>
                      <Select
                        labelId="fairReviewedBy-label"
                        name="fairReviewedBy"
                        value={formData.fairReviewedBy || ""}
                        renderValue={(selected) => selected}
                        onChange={(e) => {
                          const selected = e.target.value;
                          if (selected === "Custom") {
                            setCustomTarget("fairReviewedBy");
                            setCustomDialogOpen(true);
                          } else {
                            setFieldValue("fairReviewedBy", selected);
                            const currentDateTime = new Date().toLocaleString("en-GB", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            });
                            setFieldValue("fairReviewedDate", currentDateTime);
                          }
                        }}
                      >
                        {fairReviewedByOptions.map((name, idx) => (
                          <MenuItem
                            key={idx}
                            value={name}
                            sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
                          >
                            {name}
                            {formData.fairReviewedBy !== name &&
                              name !== "Arvind" &&
                              name !== "Kiran" &&
                              name !== "Sharath" && (
                                <IconButton
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setFairReviewedByOptions((prev) => prev.filter((opt) => opt !== name));
                                    if (formData.fairReviewedBy === name) {
                                      setFieldValue("fairReviewedBy", "");
                                      setFieldValue("fairReviewedDate", "");
                                    }
                                  }}
                                >
                                  ❌
                                </IconButton>
                              )}
                          </MenuItem>
                        ))}
                        <MenuItem value="Custom">+ Add Custom</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="23. Date & Time"
                      name="fairReviewedDate"
                      value={formData.fairReviewedDate || ""}
                      placeholder="DD/MM/YYYY HH:MM:SS"
                      InputProps={{
                        readOnly: true,
                      }}
                    />
                  </Grid>
                </Grid>

                <Grid container spacing={2} sx={{ mt: 2 }}>
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth>
                      <InputLabel id="customerApproval-label">24. Customer Approval</InputLabel>
                      <Select
                        labelId="customerApproval-label"
                        name="customerApproval"
                        value={formData.customerApproval || ""}
                        renderValue={(selected) => selected}
                        onChange={(e) => {
                          const selected = e.target.value;
                          if (selected === "Custom") {
                            setCustomTarget("customerApproval");
                            setCustomDialogOpen(true);
                          } else {
                            setFieldValue("customerApproval", selected);
                            const currentDateTime = new Date().toLocaleString("en-GB", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            });
                            setFieldValue("customerApprovalDate", currentDateTime);
                          }
                        }}
                      >
                        {customerApprovalOptions.map((name, idx) => (
                          <MenuItem
                            key={idx}
                            value={name}
                            sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
                          >
                            {name}
                            {formData.customerApproval !== name &&
                              name !== "Arvind" &&
                              name !== "Kiran" &&
                              name !== "Sharath" && (
                                <IconButton
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setCustomerApprovalOptions((prev) => prev.filter((opt) => opt !== name));
                                    if (formData.customerApproval === name) {
                                      setFieldValue("customerApproval", "");
                                      setFieldValue("customerApprovalDate", "");
                                    }
                                  }}
                                >
                                  ❌
                                </IconButton>
                              )}
                          </MenuItem>
                        ))}
                        <MenuItem value="Custom">+ Add Custom</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="25. Date & Time"
                      name="customerApprovalDate"
                      value={formData.customerApprovalDate || ""}
                      placeholder="DD/MM/YYYY HH:MM:SS"
                      InputProps={{
                        readOnly: true,
                      }}
                    />
                  </Grid>
                </Grid>

                <Grid item xs={12} sx={{ mt: 2 }}>
                  <SmartTextField label="26. Comments" name="comments" formData={formData} setField={setFieldValue} multiline rows={4} />
                </Grid>

                <Grid item xs={12} sx={{ mt: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Button variant="countained" onClick={() => setShowRawText((s) => !s)}>
                    {showRawText ? 'Hide Extracted Text' : 'Show Extracted Text'}
                  </Button>
                  <Box>
                    <Button variant="contained" onClick={handlePdfExport}>
                      Download PDF
                    </Button>
                    <Button variant="contained" color="primary" onClick={handleSave} sx={{ mr: 2 }}>
                      Save
                    </Button>
                    <Button variant="contained" color="primary" onClick={handleNext}>
                      Next
                    </Button>
                    <Button
                      variant="countained"
                      onClick={handleGoToUpload}
                      sx={{ ml: 2 }}
                    >
                      Go to Upload Files
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

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)}>
        <DialogTitle>Required Fields Missing</DialogTitle>
        <DialogContent>
          <Typography>The following required fields are missing:</Typography>
          <ul>
            {missingFields.map((field, index) => (
              <li key={index}>{field}</li>
            ))}
          </ul>
          <Typography sx={{ mt: 2 }}>Are you sure you want to proceed?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)} color="error">Cancel</Button>
          <Button onClick={() => performAction(actionToPerform)} color="primary" variant="contained">Proceed Anyway</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={customDialogOpen} onClose={() => setCustomDialogOpen(false)}>
        <DialogTitle>Add Custom Name</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Enter Name"
            fullWidth
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCustomDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={() => {
              if (customName.trim() !== "") {
                const currentDateTime = new Date().toLocaleString("en-GB", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                });
                if (customTarget === "fairVerifiedBy") {
                  setFairVerifiedByOptions((prev) => [...prev, customName]);
                  setFieldValue("fairVerifiedBy", customName);
                  setFieldValue("fairVerifiedDate", currentDateTime);
                } else if (customTarget === "fairReviewedBy") {
                  setFairReviewedByOptions((prev) => [...prev, customName]);
                  setFieldValue("fairReviewedBy", customName);
                  setFieldValue("fairReviewedDate", currentDateTime);
                } else if (customTarget === "customerApproval") {
                  setCustomerApprovalOptions((prev) => [...prev, customName]);
                  setFieldValue("customerApproval", customName);
                  setFieldValue("customerApprovalDate", currentDateTime);
                }
                setFieldValue(customTarget, customName);
                setCustomDialogOpen(false);
                setCustomName("");
                setCustomTarget("");
                setCustomDialogOpen(false);
                setCustomName("");
              }
            }}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </ThemeProvider>
  );
}
