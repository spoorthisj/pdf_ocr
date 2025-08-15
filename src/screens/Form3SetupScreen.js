// --- Full Form3SetupScreen.js with OCR replacement and PDF rotation ---
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, TextField, IconButton, Button,
  MenuItem, Select, InputAdornment, Dialog, DialogTitle,
  DialogContent, DialogActions, CircularProgress
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import MicIcon from '@mui/icons-material/Mic';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import axios from 'axios';
import { useLocation } from 'react-router-dom';

// --- helper to clean up spoken text ---
const processSpokenText = (text) =>
  text
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
            <Button disabled={pageNumber >= numPages} onClick={() => setPageNumber(p => p + 1)}>Next</Button>
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

// Main form remains the same...


// ---- Main Form3 component ----
export default function Form3SetupScreen() {
  const [rows, setRows] = useState([{ id: 1 }]);
  const [resultsValue, setResultsValue] = useState({});
  const [extraField, setExtraField] = useState({});
  const [values, setValues] = useState({}); // holds all SmartTextField values

  const location = useLocation();

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

  const handleResultsChange = (rowIndex, value) => {
    setResultsValue(prev => ({ ...prev, [rowIndex]: value }));
  };

  const setField = (name, value) => {
    setValues(prev => ({ ...prev, [name]: value }));
  };

  const generateExcel = () => {
    // simple example pack of values into sheets
    const form1Data = [
      ['Form 1'], ['Field', 'Value'],
      ['Part Number', values['top-0'] || ''], ['Part Name', values['top-1'] || ''],
      ['Serial Number', values['top-2'] || ''], ['FAIR ID', values['top-3'] || ''],
    ];

    const form3Data = [
      ['Form 3'],
      ['Char. No.', 'Reference Location', 'Characteristic Designator', 'Requirement', 'Results', 'Designed / Qualified Tooling', 'Nonconformance Number', 'Additional Data / Comments'],
      ...rows.map((_, index) => ([
        index + 1,
        values[`cell-${index}-1`] || '',
        values[`cell-${index}-2`] || '',
        values[`cell-${index}-3`] || '',
        resultsValue[index] || '',
        values[`cell-${index}-5`] || '',
        values[`cell-${index}-6`] || '',
        values[`cell-${index}-7`] || ''
      ]))
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

      <Box mb={3} display="flex" flexWrap="wrap" gap={2}>
        {['Part Number', 'Part Name', 'Serial Number', 'FAIR Identifier'].map((label, index) => (
          <Box key={index} sx={{ width: 220 }}>
            <SmartTextField
              label={label}
              name={`top-${index}`}
              formData={values[`top-${index}`] || ''}
              setField={setField}
            />
          </Box>
        ))}
      </Box>

      <TableContainer component={Paper} sx={{ backgroundColor: 'white' }}>
        <Table>
          <TableHead>
            <TableRow>
              {[
                'Char. No.', 'Reference Location', 'Characteristic Designator',
                'Requirement', 'Results', 'Designed / Qualified Tooling',
                'Nonconformance Number', 'Additional Data / Comments', ''
              ].map((header, i) => (
                <TableCell key={i} sx={{ color: 'black', fontWeight: 'bold', border: '1px solid #ddd' }}>
                  {header}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>

          <TableBody>
            {rows.map((row, rowIndex) => (
              <TableRow key={row.id}>
                {Array(9).fill().map((_, colIndex) => (
                  <TableCell key={colIndex} sx={{ border: '1px solid #ddd' }}>
                    {colIndex === 2 ? (
                      <Select
                        fullWidth
                        variant="outlined"
                        size="small"
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
                    ) : colIndex === 4 ? (
                      <Box>
                        {resultsValue[rowIndex] !== 'Attribute' && resultsValue[rowIndex] !== 'Pass' && resultsValue[rowIndex] !== 'Fail' ? (
                          <Select
                            fullWidth
                            variant="outlined"
                            size="small"
                            value={resultsValue[rowIndex] || ''}
                            onChange={(e) => handleResultsChange(rowIndex, e.target.value)}
                            sx={{
                              color: 'black',
                              '.MuiOutlinedInput-notchedOutline': { borderColor: 'lightgray' },
                              '.MuiSvgIcon-root': { color: 'black' }
                            }}
                          >
                            {['Variable', 'Attribute', 'Not Reportable'].map(opt => (
                              <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                            ))}
                          </Select>
                        ) : resultsValue[rowIndex] === 'Attribute' ? (
                          <Select
                            fullWidth
                            variant="outlined"
                            size="small"
                            value={''}
                            onChange={(e) => handleResultsChange(rowIndex, e.target.value)}
                            sx={{
                              color: 'black',
                              backgroundColor: 'white',
                              mt: 1,
                              '.MuiOutlinedInput-notchedOutline': { borderColor: 'gray' }
                            }}
                          >
                            <MenuItem value="Pass">Pass</MenuItem>
                            <MenuItem value="Fail">Fail</MenuItem>
                          </Select>
                        ) : (
                          <Typography variant="body2" color="black">{resultsValue[rowIndex]}</Typography>
                        )}
                      </Box>
                    ) : (
                      <SmartTextField
                        label=""
                        name={`cell-${rowIndex}-${colIndex}`}
                        formData={values[`cell-${rowIndex}-${colIndex}`] || ''}
                        setField={setField}
                      />
                    )}
                  </TableCell>
                ))}
                <TableCell sx={{ border: '1px solid #ddd', textAlign: 'center' }}>
                  {rowIndex === rows.length - 1 && (
                    <IconButton onClick={addRow} size="small" sx={{ color: 'black' }}>
                      <AddIcon />
                    </IconButton>
                  )}
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