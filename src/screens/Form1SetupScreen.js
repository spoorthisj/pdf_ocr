// src/screens/Form1SetupScreen.js
import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Grid, TextField, Paper, CircularProgress,
  TextareaAutosize, Checkbox, FormControlLabel
} from '@mui/material';
import axios from 'axios';
import { useFiles } from '../context/FileContext';

// --- Parsing logic for all Form 1 fields ---
const parseExtractedText = (text) => {
  const data = {
    partNumber: '', partName: '', serialNumber: '', fairIdentifier: '',
    partRevisionLevel: '', drawingNumber: '', drawingRevisionLevel: '',
    additionalChanges: '', manufacturingProcessReference: '', organizationName: '',
    supplierCode: '', purchaseOrderNumber: '', detail: '',
    fullFAI: false, partialFAI: false,
    baselinePartNumber: '', reasonForFAI: '',
    indexPartNumber: '', indexPartName: '', indexPartType: '',
    indexSupplier: '', indexFairIdentifier: '',
    nonconformanceYes: false, nonconformanceNo: false,
    fairVerifiedBy: '', fairVerifiedDate: '',
    fairReviewedBy: '', fairReviewedDate: '',
    customerApproval: '', customerApprovalDate: '',
    comments: ''
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
  
  // Fallback: handle if serial is on the next line
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (/(Finish\s*Part\s*Serial\s*Number|Part\s*Serial\s*No|Serial\s*Number)/i.test(lines[i])) {
      if (lines[i+1]) {
        const val = lines[i+1].match(/[\w\-]+/);
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

  // If both are empty, try "Drawing Issue"
if (!data.partRevisionLevel && !data.drawingRevisionLevel) {
    const drawingIssue = matchField('Drawing Issue');
    if (drawingIssue) {
      data.partRevisionLevel = drawingIssue;
      data.drawingRevisionLevel = drawingIssue;
    }
  }
  data.additionalChanges = matchField('Additional Changes');
  data.manufacturingProcessReference = matchField('Manufacturing Process Reference');
  if (!data.manufacturingProcessReference) {
  data.manufacturingProcessReference = matchField('Batch Card Number');
}
  data.organizationName = matchField('Organization Name');
  data.supplierCode = matchField('Vendor Code');
  
  data.purchaseOrderNumber = matchField('Purchase Order Number');
  data.detail = matchField('Detail');
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

  if (/Full FAI.*\[x\]/i.test(text)) data.fullFAI = true;
  if (/Partial FAI.*\[x\]/i.test(text)) data.partialFAI = true;

  return data;
};

// --- Merge parsed results: pick most frequent non-empty value ---
const mergeParsedData = (parsedList) => {
  if (parsedList.length === 0) return {};

  const merged = {};
  const keys = Object.keys(parsedList[0]);

  keys.forEach((key) => {
    const values = parsedList.map(d => d[key]).filter(v => v !== '' && v !== null && v !== undefined);

    if (typeof parsedList[0][key] === 'boolean') {
      // For booleans, choose true if most files have it true
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

export default function Form1SetupScreen() {
  const { files } = useFiles();
  const [formData, setFormData] = useState({});
  const [rawTexts, setRawTexts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const processFiles = async () => {
      if (files.length === 0) return;

      setIsLoading(true);
      setError('');
      setFormData({});
      setRawTexts([]);

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
          setRawTexts(rawResults);
          setFormData(mergeParsedData(parsedResults));
        }

      } catch (err) {
        console.error("API Error:", err);
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

  return (
    <Box sx={{ padding: 4, backgroundColor: '#f4f7f6', minHeight: '100vh' }}>
      <Typography variant="h4" gutterBottom>
        Form 1 – Part Number Accountability
      </Typography>

      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
          <CircularProgress /> <Typography sx={{ ml: 2 }}>Extracting data...</Typography>
        </Box>
      )}
      {error && <Typography color="error">{error}</Typography>}

      {!isLoading && Object.keys(formData).length > 0 && (
        <Grid container spacing={4}>
          {/* Parsed Results */}
          {/* Parsed Results */}
<Grid item xs={12} md={6}>
  <Paper sx={{ padding: 3 }}>
    <Typography variant="h6" gutterBottom>Parsed Results (Merged)</Typography>

    {/* Row 1: Fields 1–4 */}
    <Grid container spacing={2}>
      <Grid item xs={3}>
        <TextField
          fullWidth
          label="Part Number"
          value={formData.partNumber || ''}
          onChange={handleChange('partNumber')}
        />
      </Grid>
      <Grid item xs={3}>
        <TextField
          fullWidth
          label="Part Name"
          value={formData.partName || ''}
          onChange={handleChange('partName')}
        />
      </Grid>
      <Grid item xs={3}>
        <TextField
          fullWidth
          label="Serial Number"
          value={formData.serialNumber || ''}
          onChange={handleChange('serialNumber')}
        />
      </Grid>
      <Grid item xs={3}>
        <TextField
          fullWidth
          label="FAIR Identifier"
          value={formData.fairIdentifier || ''}
          onChange={handleChange('fairIdentifier')}
        />
      </Grid>
    </Grid>

    {/* Row 2: Fields 5–8 */}
    <Grid container spacing={2} sx={{ mt: 2 }}>
      <Grid item xs={3}>
        <TextField
          fullWidth
          label="Part Revision Level"
          value={formData.partRevisionLevel || ''}
          onChange={handleChange('partRevisionLevel')}
        />
      </Grid>
      <Grid item xs={3}>
        <TextField
          fullWidth
          label="Drawing Number"
          value={formData.drawingNumber || ''}
          onChange={handleChange('drawingNumber')}
        />
      </Grid>
      <Grid item xs={3}>
        <TextField
          fullWidth
          label="Drawing Revision Level"
          value={formData.drawingRevisionLevel || ''}
          onChange={handleChange('drawingRevisionLevel')}
        />
      </Grid>
      <Grid item xs={3}>
        <TextField
          fullWidth
          label="Additional Changes"
          value={formData.additionalChanges || ''}
          onChange={handleChange('additionalChanges')}
        />
      </Grid>
    </Grid>

    {/* Row 3: Fields 9–12 */}
    <Grid container spacing={2} sx={{ mt: 2 }}>
      <Grid item xs={3}>
        <TextField
          fullWidth
          label="Manufacturing Process Reference"
          value={formData.manufacturingProcessReference || ''}
          onChange={handleChange('manufacturingProcessReference')}
        />
      </Grid>
      <Grid item xs={3}>
        <TextField
          fullWidth
          label="Organization Name"
          value={formData.organizationName || ''}
          onChange={handleChange('organizationName')}
        />
      </Grid>
      <Grid item xs={3}>
        <TextField
          fullWidth
          label="Supplier Code"
          value={formData.supplierCode || ''}
          onChange={handleChange('supplierCode')}
        />
      </Grid>
      <Grid item xs={3}>
        <TextField
          fullWidth
          label="Purchase Order Number"
          value={formData.purchaseOrderNumber || ''}
          onChange={handleChange('purchaseOrderNumber')}
        />
      </Grid>
    </Grid>

    {/* Row 4: Checkboxes & Reason */}
    <Grid container spacing={2} sx={{ mt: 2 }} alignItems="center">
      {/* Detail / Assembly */}
      <Grid item>
      <Typography variant="body1" style={{ marginRight: 8 }}>
      13
    </Typography>
        <FormControlLabel
          control={<Checkbox checked={formData.detail || false} onChange={handleChange('detail')} />}
          label="Detail"
        />
        <FormControlLabel
          control={<Checkbox checked={formData.assembly || false} onChange={handleChange('assembly')} />}
          label="Assembly"
        />
      </Grid>

      {/* Full / Partial FAI */}
      <Grid item>
      <Typography variant="body1" style={{ marginRight: 8 }}>
      14
    </Typography>
    <FormControlLabel
      control={
        <Checkbox
          checked={formData.fullFAI || false}
          onChange={handleChange('fullFAI')}
        />
      }
      label="Full FAI"
    />
    <FormControlLabel
      control={
        <Checkbox
          checked={formData.partialFAI || false}
          onChange={handleChange('partialFAI')}
        />
      }
      label="Partial FAI"
        />
      </Grid>

      {/* Reason beside FAI checkboxes */}
      <Grid item xs={4}>
        <TextField
          fullWidth
          label="Reason for FAI"
          value={formData.reasonForFAI || ''}
          onChange={handleChange('reasonForFAI')}
        />
      </Grid>

      {/* FAA Approved */}
      <Grid item>
        <FormControlLabel
          control={<Checkbox checked={formData.faaApproved || false} onChange={handleChange('faaApproved')} />}
          label="FAA Approved"
        />
        <FormControlLabel
      control={<Checkbox checked={formData.aog || false} onChange={handleChange('aog')} />}
      label="AOG"
    />
      </Grid>
      {/* Row 15-18 fields */}
<Grid container spacing={2}>
  <Grid item xs={3}>
    <TextField
      label="15. Part Number"
      fullWidth
      value={formData.indexPartNumber || ''}
      onChange={handleChange('indexPartNumber')}
    />
  </Grid>
  <Grid item xs={3}>
    <TextField
      label="16. Part Name"
      fullWidth
      value={formData.indexPartName || ''}
      onChange={handleChange('indexPartName')}
    />
  </Grid>
  <Grid item xs={3}>
    <TextField
      label="17. Part Type"
      fullWidth
      value={formData.indexPartType || ''}
      onChange={handleChange('indexPartType')}
    />
  </Grid>
  <Grid item xs={3}>
    <TextField
      label="Supplier"
      fullWidth
      value={formData.indexSupplier || ''}
      onChange={handleChange('indexSupplier')}
    />
  </Grid>
</Grid>

{/* Row for FAIR Identifier */}
<Grid container spacing={2} style={{ marginTop: 8 }}>
  <Grid item xs={3}>
    <TextField
      label="18. FAIR Identifier"
      fullWidth
      value={formData.indexFairIdentifier || ''}
      onChange={handleChange('indexFairIdentifier')}
    />
  </Grid>
</Grid>

{/* Row for Nonconformance checkboxes */}
<Grid item xs={12} style={{ marginTop: 8 }}>
  
    <Typography variant="body1" style={{ marginRight: 8 }}>
      Does FAIR Contain a Documented Nonconformance?
    </Typography>
    <FormControlLabel
      control={
        <Checkbox
          checked={formData.nonconformanceYes || false}
          onChange={handleChange('nonconformanceYes')}
        />
      }
      label="Yes"
    />
    <FormControlLabel
      control={
        <Checkbox
          checked={formData.nonconformanceNo || false}
          onChange={handleChange('nonconformanceNo')}
        />
      }
      label="No"
    />
  
</Grid>

{/* Row for FAIR verification & approval */}
<Grid container spacing={2} style={{ marginTop: 8 }}>
  <Grid item xs={3}>
    <TextField
      label="FAIR Verified By"
      fullWidth
      value={formData.fairVerifiedBy || ''}
      onChange={handleChange('fairVerifiedBy')}
    />
  </Grid>
  <Grid item xs={3}>
    <TextField
      label="FAIR Verified Date"
      fullWidth
      value={formData.fairVerifiedDate || ''}
      onChange={handleChange('fairVerifiedDate')}
    />
  </Grid>
  <Grid item xs={3}>
    <TextField
      label="FAIR Reviewed/Approved By"
      fullWidth
      value={formData.fairReviewedBy || ''}
      onChange={handleChange('fairReviewedBy')}
    />
  </Grid>
  <Grid item xs={3}>
    <TextField
      label="23. Date"
      fullWidth
      value={formData.fairReviewedDate || ''}
      onChange={handleChange('fairReviewedDate')}
    />
  </Grid>
</Grid>

{/* Row for Customer Approval */}
<Grid container spacing={2} style={{ marginTop: 8 }}>
  <Grid item xs={3}>
    <TextField
      label="Customer Approval"
      fullWidth
      value={formData.customerApproval || ''}
      onChange={handleChange('customerApproval')}
    />
  </Grid>
  <Grid item xs={3}>
    <TextField
      label="25. Date"
      fullWidth
      value={formData.customerApprovalDate || ''}
      onChange={handleChange('customerApprovalDate')}
    />
  </Grid>
</Grid>

{/* Comments */}
<Grid item xs={12} style={{ marginTop: 8 }}>
  <TextField
    label="Comments"
    fullWidth
    multiline
    rows={3}
    value={formData.comments || ''}
    onChange={handleChange('comments')}
  />
</Grid>
    </Grid>
  </Paper>
</Grid>


          {/* Raw OCR Output */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ padding: 3 }}>
              <Typography variant="h6" gutterBottom>Raw OCR Output (All Files)</Typography>
              {rawTexts.map((r, idx) => (
                <Box key={idx} sx={{ mb: 2 }}>
                  <Typography variant="subtitle2">{r.name}</Typography>
                  <TextareaAutosize
                    minRows={6}
                    value={r.text}
                    style={{
                      width: '100%',
                      padding: '8px',
                      fontSize: '12px',
                      fontFamily: 'monospace',
                      border: '1px solid #ccc',
                      borderRadius: '4px'
                    }}
                    readOnly
                  />
                </Box>
              ))}
            </Paper>
          </Grid>
        </Grid>
      )}
    </Box>
  );
}
