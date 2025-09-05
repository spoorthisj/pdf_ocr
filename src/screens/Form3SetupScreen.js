import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, TextField, IconButton, Button,
  MenuItem, Select, InputAdornment, Dialog, DialogTitle,
  DialogContent, DialogActions, CircularProgress,
  FormControl, InputLabel, Divider,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';

import MicIcon from '@mui/icons-material/Mic';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import axios from 'axios';
import { useLocation, useNavigate } from 'react-router-dom';

// --- helper to clean up spoken text ---
const processSpokenText = (text) =>
  text
    .replace(/\bhash\b/gi, '#')
    .replace(/\bhyphen\b/gi, '-')
    .replace(/\bdot\b/i, '.')
    .replace(/\bslash\b/gi, '/')
    .replace(/\bcolon\b/gi, ':')
    .replace(/\bcomma\b/gi, ',')
    .replace(/\bat\b/gi, '@')
    .replace(/\bpercent\b/gi, '%')
    .replace(/\band\b/gi, '')
    .trim();

const SmartTextField = React.memo(({ label, name, formData, setField, multiline, rows }) => {
  const [showIcons, setShowIcons] = useState(false);
  const fileRef = useRef(null);
  const [imageSrc, setImageSrc] = useState(null);
  const [pdfSrc, setPdfSrc] = useState(null);
  const [crop, setCrop] = useState();
  const imgRef = useRef(null);
  const pageRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [speechError, setSpeechError] = useState(null);
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [isPdfWorkerLoaded, setIsPdfWorkerLoaded] = useState(false);
  const [rotation, setRotation] = useState(0);
  
  useEffect(() => {
    pdfjs.GlobalWorkerOptions.workerSrc =
      `//cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
    setIsPdfWorkerLoaded(true);
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
      const processed = processSpokenText(ev.results[0][0].transcript || '');
      setField(name, processed);
    };
    recognition.onerror = (ev) => {
      setSpeechError('Speech recognition error: ' + (ev.error || 'unknown'));
    };
    recognition.start();
  };

  const handleCameraClick = () => {
    fileRef.current?.click();
  };

  const onSelectFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    if (file.type === 'application/pdf') {
      if (!isPdfWorkerLoaded) {
        setError('PDF viewer not ready yet.');
        return;
      }
      setPdfSrc(file);
      setPdfDialogOpen(true);
      setRotation(0);
      setCrop(undefined);
    } else if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setImageSrc(event.target.result);
        setOpen(true);
        setCrop(undefined);
      };
      reader.readAsDataURL(file);
    } else {
      setError('Unsupported file type. Please select an image or PDF.');
    }
  };

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
    setPageNumber(1);
    setError(null);
    setCrop(undefined);
  };
  


  const toBlobAsync = (canvas, type = 'image/jpeg', quality = 0.9) =>
    new Promise((resolve) => {
      if (!canvas.toBlob) {
        const dataURL = canvas.toDataURL(type, quality);
        const byteString = atob(dataURL.split(',')[1]);
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
        resolve(new Blob([ab], { type }));
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

      const croppedImageBlob = await toBlobAsync(croppedCanvas);
      const formData = new FormData();
      formData.append('cropped_image', croppedImageBlob, 'cropped.jpg');
      const response = await axios.post('http://127.0.0.1:5000/api/ocr-image', formData);
      setField(name, response.data.extracted_text || '');
    } catch (err) {
      setError(err.message || 'OCR failed.');
    } finally {
      setLoading(false);
      setPdfSrc(null);
      setCrop(undefined);
    }
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
      const canvas = document.createElement('canvas');
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
      const croppedImageBlob = await toBlobAsync(canvas);
      const formData = new FormData();
      formData.append('cropped_image', croppedImageBlob, 'cropped.jpg');
      const response = await axios.post('http://127.0.0.1:5000/api/ocr-image', formData);
      setField(name, response.data.extracted_text || '');
    } catch (err) {
      setError(err.message || 'OCR failed.');
    } finally {
      setLoading(false);
      setImageSrc(null);
      setCrop(undefined);
    }
  };

  return (
    <>
      <TextField
        fullWidth size="small" label={label} value={formData || ''}
        onChange={(e) => setField(name, e.target.value)}
        onFocus={() => setShowIcons(true)}
        onBlur={() => setTimeout(() => setShowIcons(false), 180)}
        multiline={multiline} rows={rows}
        InputProps={{
          endAdornment: showIcons && (
            <InputAdornment position="end">
              <IconButton size="small" onMouseDown={(e) => e.preventDefault()} onClick={handleSpeechInput}>
                <MicIcon sx={{ color: '#1976d2' }} />
              </IconButton>
              <IconButton size="small" onMouseDown={(e) => e.preventDefault()} onClick={handleCameraClick}>
                <CameraAltIcon sx={{ color: '#1976d2' }} />
              </IconButton>
            </InputAdornment>
          )
        }}
        disabled={loading}
      />
      <input
        ref={fileRef} type="file" accept="image/*, .pdf" capture="environment"
        style={{ display: 'none' }} onChange={onSelectFile}
      />

      {/* Image crop */}
      <Dialog open={open} onClose={() => { setOpen(false); setImageSrc(null); setCrop(undefined); }} maxWidth="md" fullWidth>
        <DialogTitle>Crop Image for OCR</DialogTitle>
        <DialogContent dividers>
          {imageSrc && (
            <ReactCrop crop={crop} onChange={setCrop}>
              <img ref={imgRef} src={imageSrc} alt="Crop" style={{ maxWidth: '100%' }} />
            </ReactCrop>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setOpen(false); setImageSrc(null); setCrop(undefined); }}>Cancel</Button>
          <Button onClick={handleImageCropComplete} disabled={!crop?.width || !crop?.height} variant="contained">Extract Text</Button>
        </DialogActions>
      </Dialog>

      {/* PDF crop with rotation */}
      <Dialog open={pdfDialogOpen} onClose={() => { setPdfDialogOpen(false); setPdfSrc(null); setCrop(undefined); }} maxWidth="md" fullWidth>
        <DialogTitle>Crop PDF for OCR</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ mb: 2, display: 'flex', gap: 1, alignItems: 'center' }}>
            <Button disabled={pageNumber <= 1} onClick={() => setPageNumber(p => p - 1)}>Prev</Button>
            <Typography>Page {pageNumber} of {numPages}</Typography>
            <Button onClick={() => setRotation(r => (r + 90) % 360)}>Rotate</Button>
          </Box>
          <ReactCrop crop={crop} onChange={setCrop}>
            {pdfSrc && (
              <Document file={pdfSrc} onLoadSuccess={onDocumentLoadSuccess}>
                <Page
                  pageNumber={pageNumber}
                  rotate={rotation}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                  canvasRef={(el) => { if (el) pageRef.current = el; }}
                />
              </Document>
            )}
          </ReactCrop>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setPdfDialogOpen(false); setPdfSrc(null); setCrop(undefined); }}>Cancel</Button>
          <Button onClick={handlePdfCropComplete} disabled={!crop?.width || !crop?.height} variant="contained">Extract Text</Button>
        </DialogActions>
      </Dialog>

      {/* Loading */}
      <Dialog open={loading}>
        <DialogContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <CircularProgress /> <Typography>Extracting text...</Typography>
        </DialogContent>
      </Dialog>

      {/* Errors */}
      <Dialog open={!!error} onClose={() => setError(null)}><DialogTitle>Error</DialogTitle><DialogContent><Typography>{error}</Typography></DialogContent></Dialog>
      <Dialog open={!!speechError} onClose={() => setSpeechError(null)}><DialogTitle>Speech Error</DialogTitle><DialogContent><Typography>{speechError}</Typography></DialogContent></Dialog>
    </>
  );
});

// ---- Main Form3 component ----
export default function Form3SetupScreen() {
  const [rows, setRows] = useState([{ id: 1 }]);
  // ⬇️ Add this at the top with your other states
const [ipsFile, setIpsFile] = useState(null);
const [ipsLoading, setIpsLoading] = useState(false);

  const [resultsValue, setResultsValue] = useState({});
  const [secondaryResults, setSecondaryResults] = useState({}); // New state for nested values
  const [extraField, setExtraField] = useState({});
  const [values, setValues] = useState({}); // holds all SmartTextField values
  const location = useLocation();
  const navigate = useNavigate();

  const goToForm2 = () => {
    navigate("/form2setup", {
      state: {
        form3Data: {
          values,
          resultsValue,
          secondaryResults,
          extraField
        }
      }
    });
  };
  
  useEffect(() => {
    if (location.state && location.state.form2Data) {
      const { partNumber, partName, serialNumber, fairIdentifier } = location.state.form2Data;
      setValues((prev) => ({
        ...prev,
        'top-0': partNumber || '',     // Corresponding to Part Number
        'top-1': partName || '',      // Corresponding to Part Name
        'top-2': serialNumber || '',  // Corresponding to Serial Number
        'top-3': fairIdentifier || '', // Corresponding to FAIR Identifier
      }));
    }
  }, [location.state]);

  const addRow = () => setRows(prev => [...prev, { id: prev.length + 1 }]);
 
  const deleteRow = (rowIndex) => {
       setRows(prev => prev.filter((_, i) => i !== rowIndex));
      setValues(prev => {
         const updated = { ...prev };
         Object.keys(updated).forEach(key => {
           if (key.startsWith(`cell-${rowIndex}-`)) {
             delete updated[key];
           }
         });
         return updated;
       });
       setResultsValue(prev => {
         const updated = { ...prev };
         delete updated[rowIndex];
         return updated;
       });
       setSecondaryResults(prev => {
         const updated = { ...prev };
         delete updated[rowIndex];
         return updated;
       });
       setExtraField(prev => {
         const updated = { ...prev };
         Object.keys(updated).forEach(key => {
           if (key.startsWith(`${rowIndex}-`)) {
             delete updated[key];
           }
         });
         return updated;
       });
     };
  const handleResultsChange = (rowIndex, value) => {
    setResultsValue(prev => ({ ...prev, [rowIndex]: value }));
    // Clear secondary results when the primary is changed
    setSecondaryResults(prev => ({ ...prev, [rowIndex]: null }));
  };

  const handleSecondaryResultsChange = (rowIndex, value) => {
    setSecondaryResults(prev => ({ ...prev, [rowIndex]: value }));
  };
  
  const handleCellChange = (name, value) => {
    setValues(prev => ({ ...prev, [name]: value }));
  };

  const handleIpsUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
  
    setIpsFile(file); // ✅ Save file for preview
    setIpsLoading(true);
  
    try {
      const formData = new FormData();
      formData.append("file", file);
  
      const response = await axios.post("http://127.0.0.1:5000/api/extract-text", formData);

  
      console.log("OCR Response:", response.data);
  
      const text = response.data.extracted_text || "";
      console.log("OCR raw text:", text);
     // Extract Operations: only numbers between "Operations" and the next heading
const operations = [];
const operationMatch = text.match(/Operations\s+([\s\S]*?)(?=Feature number|Drawing ref|Class|Dimension|$)/i);

if (operationMatch) {
  const opMatches = operationMatch[1].match(/\d+/g);
  if (opMatches) operations.push(...opMatches);
}

console.log("✅ Final Operations:", operations);


// Extract Drawing Refs: find all words after "Drawing Ref"
const drawingRefs = [];
const drawingSection = text.split(/Drawing\s*Ref/i)[1];
if (drawingSection) {
  const refMatches = drawingSection.match(/[A-Za-z0-9\-]+/g);
  if (refMatches) drawingRefs.push(...refMatches);
}

console.log("✅ Extracted Operations:", operations);
console.log("✅ Extracted Drawing Refs:", drawingRefs);

     

      // Build rows
      // Build rows = one per operation number
const newRows = operations.map((op, index) => ({ id: index + 1 }));

setRows(newRows);

setValues(prev => {
  const updated = { ...prev };

  newRows.forEach((row, i) => {
    // ✅ put operation numbers in Characteristic Number column
    updated[`cell-char-${i}`] = operations[i] || "";

    // Optional: also map drawing refs if count matches
    if (drawingRefs[i]) {
      updated[`cell-${i}-1`] = drawingRefs[i];
    }
  });

  return updated;
});

  
    } catch (err) {
      console.error("IPS OCR failed", err);
    } finally {
      setIpsLoading(false);
    }
  };
  
  

  const generateExcel = () => {
    const form1Data = [
      ['Form 1'], ['Field', 'Value'],
      ['Part Number', values['top-0'] || ''], ['Part Name', values['top-1'] || ''],
      ['Serial Number', values['top-2'] || ''], ['FAIR ID', values['top-3'] || ''],
    ];

    const form3Data = [
      ['Form 3'],
      ['Char. No.', 'Reference Location', 'Characteristic Designator', 'Requirement', 'Results', 'Designed / Qualified Tooling', 'Nonconformance Number', 'Additional Data / Comments'],
      ...rows.map((_, index) => {
        let results = resultsValue[index] || '';
        // Add secondary results to the same cell for a clean sheet
        if (secondaryResults[index]) {
          results += ` - ${secondaryResults[index]}`;
        }
        return [
          index + 1,
          values[`cell-${index}-1`] || '',
          values[`cell-${index}-2`] || '',
          //values[`cell-${index}-3`] || '',
          `Desc: ${values[`req-desc-${index}`] || ''} | Tol: ${values[`req-tol-${index}`] || ''} | GD&T: ${values[`req-gdt-${index}`] || ''} | Units: ${values[`req-units-${index}`] || ''}`,
          results,
          values[`cell-${index}-5`] || '',
          values[`cell-${index}-6`] || '',
          values[`cell-${index}-7`] || ''
        ];
      })
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(form1Data), 'Form 1');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(form3Data), 'Form 3');

    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([wbout], { type: 'application/octet-stream' }), 'Form3_FAIR.xlsx');
  };

  return (
    <Box sx={{ padding: 4, backgroundColor: '#f5f5f5', minHeight: '100vh', color: 'black' }}>
      <Typography variant="h6" gutterBottom>
        Form 3: Characteristic Accountability, Verification and Compatibility Evaluation
      </Typography>
      <Box mb={3}>
  <Typography variant="h6" gutterBottom>
    Upload IPS
  </Typography>
  <Button
    variant="outlined"
    component="label"
    disabled={ipsLoading}
    sx={{ mb: 2 }}
  >
    {ipsLoading ? "Processing..." : "Upload IPS"}
    <input type="file" hidden onChange={handleIpsUpload} accept="image/*,.pdf" />
  </Button>
</Box>

{ipsFile && (
  <Box mt={2}>
    <Typography
      variant="body2"
      sx={{ color: "blue", textDecoration: "underline", cursor: "pointer" }}
      onClick={() => window.open(URL.createObjectURL(ipsFile), "_blank")}
    >
      {ipsFile.name}
    </Typography>
  </Box>
)}
<Dialog open={ipsLoading}>
  <DialogContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
    <CircularProgress /> 
    <Typography>Extracting IPS data...</Typography>
  </DialogContent>
</Dialog>




      <Box mb={3} display="flex" flexWrap="wrap" gap={2}>
        {['1.Part Number', '2.Part Name', '3.Serial Number', '4.FAIR Identifier'].map((label, index) => (
          <Box key={index} sx={{ width: 220 }}>
            <SmartTextField
              label={label}
              name={`top-${index}`}
              formData={values[`top-${index}`] || ''}
              setField={handleCellChange}
            />
          </Box>
        ))}
      </Box>

      <TableContainer component={Paper} sx={{ backgroundColor: 'white' }}>
        <Table>
        <TableHead>
  <TableRow>
    {[
      '5.Char. No.', '6.Reference Location', '7.Characteristic Designator',
      '8.Requirement', '9.Results', '10.Designed / Qualified Tooling',
      '11.Nonconformance Number', '12.Additional Data / Comments'
    ].map((header, i) => {
      if (header === '8.Requirement') {
        return (
          <TableCell
            key={i}
            sx={{
              color: 'black',
              fontWeight: 'bold',
              border: '1px solid #ddd',
              width: "400px",
              minWidth: "600px",
              textAlign: "center"
            }}
          >
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
              {header}
            </Typography>
          </TableCell>
        );
      }

      if (header === '5.Char. No.') {
        return (
          <TableCell
            key={i}
            sx={{
              color: 'black',
              fontWeight: 'bold',
              border: '1px solid #ddd',
              width: "250px",    // ✅ wider than default
              minWidth: "70px", // ✅ ensures space even on smaller screens
              textAlign: "center"
            }}
          >
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
              {header}
            </Typography>
          </TableCell>
        );
      }
      if (header === '6.Reference Location') {
        return (
          <TableCell
            key={i}
            sx={{
              color: 'black',
              fontWeight: 'bold',
              border: '1px solid #ddd',
              width: "250px",    // ✅ wider than default
              minWidth: "100px", // ✅ ensures space even on smaller screens
              textAlign: "center"
            }}
          >
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
              {header}
            </Typography>
          </TableCell>
        );
      }
      if (
        header === '10.Designed / Qualified Tooling' ||
        header === '11.Nonconformance Number' ||
        header === '12.Additional Data / Comments'
      ) {
        return (
          <TableCell
            key={i}
            sx={{
              color: 'black',
              fontWeight: 'bold',
              border: '1px solid #ddd',
              width: "3000px",   // ✅ you can tweak
              minWidth: "45px", // ✅ ensures readability
              textAlign: "center"
            }}
          >
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
              {header}
            </Typography>
          </TableCell>
        );
      }
      
      return (
        <TableCell
          key={i}
          sx={{ color: 'black', fontWeight: 'bold', border: '1px solid #ddd' }}
        >
          {header}
        </TableCell>
      );
    })}
  </TableRow>
</TableHead>


          <TableBody>
            {rows.map((row, rowIndex) => (
              <TableRow key={row.id}>
                {Array(8).fill().map((_, colIndex) => {
                  const renderCell = () => {
                    if (colIndex === 0) { 
                        return (
                           <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                             <SmartTextField
                                label=""
                                name={`cell-char-${rowIndex}`}
                                formData={values[`cell-char-${rowIndex}`] || ''} 
                                setField={handleCellChange}
                             />
                             <SmartTextField
                                 label=""
                                 name={`cell-bubble-${rowIndex}`}
                                 formData={values[`cell-bubble-${rowIndex}`] || ''}
                                 setField={handleCellChange}
                             />
                           </Box>
                        );
                    }
                    if (colIndex === 2) {
                      return (
                        <FormControl fullWidth size="small">
                          <Select
                            value={extraField[`${rowIndex}-2`] || ''}
                            onChange={(e) => setExtraField(prev => ({
                              ...prev,
                              [`${rowIndex}-2`]: e.target.value
                            }))}
                            sx={{
                              color: 'black',
                              '.MuiOutlinedInput-notchedOutline': { borderColor: 'lightgray' },
                              '.MuiSvgIcon-root': { color: 'black' }
                            }}
                          >
                            {['Minor', 'Note', 'Significant', 'Critical'].map(opt => (
                              <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      );
                    }
                    if (colIndex === 3) {
                      return (
                        <Box
                          sx={{
                            display: "grid",
                            gridTemplateColumns: "1fr 2.5fr 0.8fr", // ✅ wider Specification, smaller Units
                            border: "1px solid #ddd",
                            "& > div": {
                              borderRight: "1px solid #ddd",
                              padding: 1,
                            },
                            "& > div:last-child": { borderRight: "none" },
                          }}
                        >
                          {/* Description */}
                          <Box>
                            <Typography
                              variant="caption"
                              sx={{ fontWeight: "bold", display: "block", mb: 0.5, textAlign: "center" }}
                            >
                              Description
                            </Typography>
                            <SmartTextField
                              label=""
                              name={`req-desc-${rowIndex}`}
                              formData={values[`req-desc-${rowIndex}`] || ""}
                              setField={handleCellChange}
                              multiline
                              rows={3}
                            />
                          </Box>
                    
                          {/* Specification */}
                          <Box>
                            <Typography
                              variant="caption"
                              sx={{ fontWeight: "bold", display: "block", mb: 0.5, textAlign: "center" }}
                            >
                              Specification
                            </Typography>
                    
                            <FormControl size="small" fullWidth sx={{ mb: 1 }}>
                              <Select
                                value={values[`req-tol-${rowIndex}`] || ""}
                                onChange={(e) => handleCellChange(`req-tol-${rowIndex}`, e.target.value)}
                                displayEmpty
                              >
                                <MenuItem value="">Tolerance Type</MenuItem>
                                <MenuItem value="Symmetrical">Symmetrical</MenuItem>
                                <MenuItem value="Bilateral">Bilateral</MenuItem>
                                <MenuItem value="Unilateral Upper">Unilateral Upper</MenuItem>
                                <MenuItem value="Unilateral Lower">Unilateral Lower</MenuItem>
                                <MenuItem value="Basic Dimension">Basic Dimension</MenuItem>
                                <MenuItem value="Range Inclusive">Range Inclusive</MenuItem>
                              </Select>
                            </FormControl>
                    
                            {/* Conditional fields */}
                            {values[`req-tol-${rowIndex}`] === "Symmetrical" && (
                              <Box sx={{ display: "flex", gap: 1 }}>
                                <SmartTextField
                                  label="Nominal"
                                  name={`req-sym-nom-${rowIndex}`}
                                  formData={values[`req-sym-nom-${rowIndex}`] || ""}
                                  setField={handleCellChange}
                                />
                                <SmartTextField
                                  label="High/Low Tol"
                                  name={`req-sym-tol-${rowIndex}`}
                                  formData={values[`req-sym-tol-${rowIndex}`] || ""}
                                  setField={handleCellChange}
                                />
                              </Box>
                            )}
                    
                            {values[`req-tol-${rowIndex}`] === "Bilateral" && (
                              <Box sx={{ display: "flex", gap: 1 }}>
                                <SmartTextField
                                  label="Nominal"
                                  name={`req-bilat-nom-${rowIndex}`}
                                  formData={values[`req-bilat-nom-${rowIndex}`] || ""}
                                  setField={handleCellChange}
                                />
                                <SmartTextField
                                  label="High Tol"
                                  name={`req-bilat-high-${rowIndex}`}
                                  formData={values[`req-bilat-high-${rowIndex}`] || ""}
                                  setField={handleCellChange}
                                />
                                <SmartTextField
                                  label="Low Tol"
                                  name={`req-bilat-low-${rowIndex}`}
                                  formData={values[`req-bilat-low-${rowIndex}`] || ""}
                                  setField={handleCellChange}
                                />
                              </Box>
                            )}
                    
                            {values[`req-tol-${rowIndex}`] === "Unilateral Upper" && (
                              <SmartTextField
                                label="Upper Specification"
                                name={`req-upper-${rowIndex}`}
                                formData={values[`req-upper-${rowIndex}`] || ""}
                                setField={handleCellChange}
                              />
                            )}
                    
                            {values[`req-tol-${rowIndex}`] === "Unilateral Lower" && (
                              <SmartTextField
                                label="Lower Specification"
                                name={`req-lower-${rowIndex}`}
                                formData={values[`req-lower-${rowIndex}`] || ""}
                                setField={handleCellChange}
                              />
                            )}
                    
                            {values[`req-tol-${rowIndex}`] === "Basic Dimension" && (
                              <SmartTextField
                                label="Basic Value"
                                name={`req-basic-${rowIndex}`}
                                formData={values[`req-basic-${rowIndex}`] || ""}
                                setField={handleCellChange}
                              />
                            )}
                    
                            {values[`req-tol-${rowIndex}`] === "Range Inclusive" && (
                              <Box sx={{ display: "flex", gap: 1 }}>
                                <SmartTextField
                                  label="Upper Specification"
                                  name={`req-range-up-${rowIndex}`}
                                  formData={values[`req-range-up-${rowIndex}`] || ""}
                                  setField={handleCellChange}
                                />
                                <SmartTextField
                                  label="Lower Specification"
                                  name={`req-range-low-${rowIndex}`}
                                  formData={values[`req-range-low-${rowIndex}`] || ""}
                                  setField={handleCellChange}
                                />
                              </Box>
                            )}
                    
                            {/* GD&T Callout always visible */}
                            <SmartTextField
                              label="GD&T Callout"
                              
                              name={`req-gdt-${rowIndex}`}
                              formData={values[`req-gdt-${rowIndex}`] || ""}
                              setField={handleCellChange}
                              sx={{ mt: 1 }}
                            />
                          </Box>
                    
                          {/* Units */}
                          <Box>
                            <Typography
                              variant="caption"
                              sx={{ fontWeight: "bold", display: "block", mb: 0.5, textAlign: "center" }}
                            >
                              Units
                            </Typography>
                            <FormControl size="small" fullWidth>
                              <Select
                                value={values[`req-units-${rowIndex}`] || ""}
                                onChange={(e) => handleCellChange(`req-units-${rowIndex}`, e.target.value)}
                                displayEmpty
                              >
                                <MenuItem value="">Units</MenuItem>
                                <MenuItem value="mm">mm</MenuItem>
                                <MenuItem value="in">in</MenuItem>
                                <MenuItem value="cm">cm</MenuItem>
                                <MenuItem value="deg">deg</MenuItem>
                              </Select>
                            </FormControl>
                          </Box>
                        </Box>
                      );
                    }
                    
                    
                    
                    if (colIndex === 4) {
                      const mainDropdown = (
                        <FormControl fullWidth size="small">
                          <Select
                            value={resultsValue[rowIndex] || ''}
                            onChange={(e) => handleResultsChange(rowIndex, e.target.value)}
                            sx={{
                              color: 'black',
                              '.MuiOutlinedInput-notchedOutline': { borderColor: 'lightgray' },
                              '.MuiSvgIcon-root': { color: 'black' }
                            }}
                          >
                            <MenuItem value="">- Select -</MenuItem>
                            <MenuItem value="Variable">Variable</MenuItem>
                            <MenuItem value="Attribute">Attribute</MenuItem>
                            <MenuItem value="Not Reportable">Not Reportable</MenuItem>
                          </Select>
                        </FormControl>
                      );

                      if (resultsValue[rowIndex] === 'Attribute') {
                        return (
                          <Box>
                            {mainDropdown}
                            <FormControl fullWidth size="small" sx={{ mt: 1 }}>
                               <InputLabel id={`attribute-label-${rowIndex}`}>Pass/Fail</InputLabel>
                                <Select
                                  labelId={`attribute-label-${rowIndex}`}
                                  value={secondaryResults[rowIndex] || ''}
                                  onChange={(e) => handleSecondaryResultsChange(rowIndex, e.target.value)}
                                  label="Pass/Fail"
                                  sx={{
                                    color: 'black',
                                    '.MuiOutlinedInput-notchedOutline': { borderColor: 'lightgray' },
                                    '.MuiSvgIcon-root': { color: 'black' }
                                  }}
                                >
                                  <MenuItem value="Pass">Pass</MenuItem>
                                  <MenuItem value="Fail">Fail</MenuItem>
                                </Select>
                            </FormControl>
                          </Box>
                        );
                      } else if (resultsValue[rowIndex] === 'Variable') {
                        return (
                          <Box>
                            {mainDropdown}
                            <Box sx={{ mt: 1 }}>
                               <SmartTextField
                                 label="Enter Value"
                                 name={`secondary-result-${rowIndex}`}
                                 formData={secondaryResults[rowIndex] || ''}
                                 setField={(name, value) => handleSecondaryResultsChange(rowIndex, value)}
                                 size="small"
                                 sx={{
                                   '.MuiOutlinedInput-notchedOutline': { borderColor: 'lightgray' }
                                 }}
                               />
                            </Box>
                          </Box>
                        );
                      } else {
                        return mainDropdown;
                      }
                    }

                    return (
                      <SmartTextField
                        label=""
                        name={`cell-${rowIndex}-${colIndex}`}
                        formData={values[`cell-${rowIndex}-${colIndex}`] || ''}
                        setField={handleCellChange}
                        multiline={colIndex === 0 || colIndex === 1 || colIndex === 5 || colIndex === 6 || colIndex === 7}
    rows={colIndex === 7 ? 3 : 2} // Comments field taller
                      />
                    );
                  };

                  return (
                    <TableCell key={colIndex} sx={{ border: '1px solid #ddd' }}>
                      {renderCell()}
                    </TableCell>
                  );
                })}
                <TableCell sx={{ border: '1px solid #ddd', textAlign: 'center' }}>
                  {rowIndex === rows.length - 1 && (
                    <IconButton onClick={addRow} size="small" sx={{ color: 'black' }}>
                      <AddIcon />
                    </IconButton>
                  )}
                  
   
   
   <IconButton onClick={() => deleteRow(rowIndex)} size="small" sx={{ color: 'red' }}>
     <DeleteIcon />
   </IconButton>
 
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Box mt={4} display="flex" justifyContent="space-between">
        <Button
          variant="outlined"
          onClick={generateExcel}
          sx={{
            color: '#4caf50',
            borderColor: '#4caf50',
            '&:hover': {
              backgroundColor: '#4caf50',
              color: 'white'
            }
          }}
        >
          Download
        </Button>
        
   <Button
     variant="outlined"
     onClick={goToForm2}
     sx={{
       color: '#2196f3',
       borderColor: '#2196f3',
       '&:hover': {
         backgroundColor: '#2196f3',
         color: 'white'
       }
     }}
   >
     Go to Form 2
   </Button>
        <Button
          variant="outlined"
          sx={{
            color: '#2196f3',
            borderColor: '#2196f3',
            '&:hover': {
              backgroundColor: '#2196f3',
              color: 'white'
            }
          }}
        >
          Submit
        </Button>
      </Box>
    </Box>
  );
}
