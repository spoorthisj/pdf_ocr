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
import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import axios from 'axios';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/TextLayer.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';

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
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const pageRef = useRef(null);
  const [isPdfWorkerLoaded, setIsPdfWorkerLoaded] = useState(false);

  

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

  const onSelectFile = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    setError(null);

if (file.type === 'application/pdf') {
  if (!isPdfWorkerLoaded) {
    setError('PDF viewer is not ready. Please wait a moment and try again.');
    return;
  }
  
  // Pass the File object directly to react-pdf instead of reading as base64
  setPdfSrc(file);
  setPdfDialogOpen(true);
  setCrop(undefined); // Reset crop for the new file
    } else if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setImageSrc(event.target.result);
        setOpen(true);
        setCrop(undefined); // Reset crop for the new file
      };
      reader.onerror = (err) => {
        console.error("FileReader error:", err);
        setError("Failed to read the image file.");
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
    console.error("Failed to load PDF document:", error);
    setError("Failed to load PDF file. The file may be corrupted or invalid.");
    setPdfSrc(null);
  }, []);

  const onPageRenderSuccess = useCallback(() => {
    // After page rendered, clear any previous crop to avoid weird offsets
    setCrop(undefined);
  }, []);

  // Helper: safe toBlob promise (works across browsers)
  const toBlobAsync = (canvas, type = 'image/jpeg', quality = 0.9) =>
    new Promise((resolve) => {
      if (!canvas.toBlob) {
        // fallback - convert dataURL
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
    // If no crop selected, just close.
    if (!pageRef.current || !crop?.width || !crop?.height) {
      setPdfDialogOpen(false);
      return;
    }

    setPdfDialogOpen(false);
    setLoading(true);
    setError(null);

    try {
      // pageRef.current should be the rendered canvas element from react-pdf Page
      const canvas = pageRef.current;
      if (!canvas) throw new Error('Rendered PDF page canvas not available.');

      // Calculate scale between canvas bitmap size and its displayed size
      const scaleX = canvas.width / canvas.clientWidth;
      const scaleY = canvas.height / canvas.clientHeight;

      // Create cropped canvas with correct high-res size
      const croppedCanvas = document.createElement('canvas');
      croppedCanvas.width = Math.round(crop.width * scaleX);
      croppedCanvas.height = Math.round(crop.height * scaleY);
      const ctx = croppedCanvas.getContext('2d');

      // Draw the cropped area from the rendered PDF canvas
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

      // Convert to blob & send to same OCR endpoint you use for images
      const croppedImageBlob = await toBlobAsync(croppedCanvas, 'image/jpeg', 0.9);
      const formData = new FormData();
      formData.append('cropped_image', croppedImageBlob, 'cropped.jpg');

      const response = await axios.post('http://127.0.0.1:5000/api/ocr-image', formData);
      const extractedText = response.data.extracted_text || '';
      setField(name, extractedText);
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

      const croppedImageBlob = await toBlobAsync(canvas, 'image/jpeg', 0.9);
      const formData = new FormData();
      formData.append('cropped_image', croppedImageBlob, 'cropped.jpg');

      const response = await axios.post('http://127.0.0.1:5000/api/ocr-image', formData);
      const extractedText = response.data.extracted_text || '';
      setField(name, extractedText);
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
          {imageSrc && (
            <ReactCrop crop={crop} onChange={c => setCrop(c)}>
              <img ref={imgRef} src={imageSrc} alt="Crop Me" style={{ maxWidth: '100%' }} />
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
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Box sx={{ mb: 2 }}>
              <Button disabled={pageNumber <= 1} onClick={() => setPageNumber(prev => prev - 1)}>
                Previous Page
              </Button>
              <Typography component="span" sx={{ mx: 2 }}> Page {pageNumber} of {numPages} </Typography>
              <Button disabled={pageNumber >= numPages} onClick={() => setPageNumber(prev => prev + 1)}>
                Next Page
              </Button>
            </Box>
            <ReactCrop crop={crop} onChange={c => setCrop(c)}>
              <Box>
                {pdfSrc && (
                  <Document
                    file={pdfSrc}
                    onLoadSuccess={onDocumentLoadSuccess}
                    onLoadError={onDocumentLoadError}
                  >
                    <Page
                      pageNumber={pageNumber}
                      renderTextLayer={false}
                      renderAnnotationLayer={false}
                      onRenderSuccess={onPageRenderSuccess}
                      // canvasRef provides the underlying canvas element for the page
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

      {/* Dialog for Loading and Errors */}
      <Dialog open={loading} PaperProps={{ sx: { p: 4, display: 'flex', alignItems: 'center' } }}>
        <CircularProgress />
        <Typography variant="h6" sx={{ ml: 2 }}>Extracting text...</Typography>
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
    </>
  );
});

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [formData, setFormData] = useState({
    partNumber: '',
    partName: '',
    serialNumber: '',
    fairIdentifier: '',
    materials: [{ field0: '', field1: '', field2: '', field3: '', customerApproval: '', certNumber: '', refDoc: '' }],
    processes: [{ field0: '', field1: '', field2: '', field3: '', customerApproval: '', certNumber: '', refDoc: '' }],
    inspections: [{ field0: '', field1: '', field2: '', field3: '', customerApproval: '', certNumber: '', refDoc: '' }],
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

  const handleNextToForm3 = () => {
    navigate('/form3setup', {
      state: {
        form2Data: { // Pass the first four fields from Form2's formData
          partNumber: formData.partNumber,
          partName: formData.partName,
          serialNumber: formData.serialNumber,
          fairIdentifier: formData.fairIdentifier,
        }
      }
    });
  };

  const addTableRow = useCallback((section) => {
    const newRow = { field0: '', field1: '', field2: '', field3: '', customerApproval: '', certNumber: '', refDoc: '' };
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
    '9. Customer Approval Verification',
    '10. Certificate of Conformance Number',
    'Reference Document',
    'Actions'
  ];

  const renderTableRows = useCallback((section) => {
    return formData[section].map((row, index) => (
      <TableRow key={index}>
        {[...Array(4)].map((_, i) => (
          <TableCell key={i}>
            <SmartTextField
              label=""
              name={`field${i}`}
              formData={row[`field${i}`] || ''}
              setField={(name, value) => setField(name, value, index, section)}
            />
          </TableCell>
        ))}
        <TableCell>{customerApprovalDropdown(section, index)}</TableCell>
        <TableCell>
          <SmartTextField
            label=""
            name="certNumber"
            formData={row.certNumber || ''}
            setField={(name, value) => setField(name, value, index, section)}
          />
        </TableCell>
        <TableCell>
          <SmartTextField
            label=""
            name="refDoc"
            formData={row.refDoc || ''}
            setField={(name, value) => setField(name, value, index, section)}
            multiline
            rows={2}
          />
        </TableCell>
        <TableCell>
          {formData[section].length > 1 && (
            <IconButton onClick={() => deleteTableRow(section, index)} color="error" size="small">
              <DeleteIcon />
            </IconButton>
          )}
        </TableCell>
      </TableRow>
    ));
  }, [formData, setField, deleteTableRow, customerApprovalDropdown]);

  return (
    <Box p={4} bgcolor="#f9f9f9" minHeight="100vh" className="tailwind-bg-gray-100">
      <Paper elevation={3} sx={{ p: 4, backgroundColor: '#fff', color: '#333' }}>
        <Typography
          variant="h6"
          gutterBottom
          align="center"
          sx={{ fontWeight: 'bold' }}
        >
          AS/EN/SJAC9102 Rev C First Article Inspection
        </Typography>
        <Typography variant="subtitle1" gutterBottom align="center" sx={{ mb: 3 }}>
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
            variant="contained"
            color="primary"
            onClick={() => alert('Save clicked - implement save logic')}
          >
            Save
          </Button>
          <Button
        variant="contained"
        onClick={handleNextToForm3} // Attach the new handler
        sx={{
          backgroundColor: '#1976d2',
          color: 'white',
          '&:hover': {
            backgroundColor: '#1565c0',
          },
        }}
      >
        Next to Form 3
      </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
