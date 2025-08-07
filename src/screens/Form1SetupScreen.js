import React, { useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  TextField,
  Checkbox,
  FormControlLabel,
  Radio,
  RadioGroup,
  Paper,
  Button,
  createTheme,
  ThemeProvider,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';

const theme = createTheme({
  palette: {
    mode: 'dark',
    background: {
      default: '#121212',
      paper: '#1e1e1e',
    },
    text: {
      primary: '#ffffff',
      secondary: '#cccccc',
    },
  },
  components: {
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiInputBase-input': {
            color: 'white',
          },
          '& .MuiInputLabel-root': {
            color: '#cccccc',
          },
          '& .MuiOutlinedInput-root': {
            '& fieldset': {
              borderColor: '#777',
            },
            '&:hover fieldset': {
              borderColor: '#aaa',
            },
            '&.Mui-focused fieldset': {
              borderColor: '#fff',
            },
          },
        },
      },
    },
  },
});

export default function Form1SetupScreen() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({});

  const handleChange = (field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    // Save logic - you can replace with API/localStorage etc.
    console.log('Form1 Saved Data:', formData);
    alert('Form1 data saved!');
  };

  const handleNext = () => {
    handleSave();
    navigate('/form2setup');
  };

  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ padding: 4, backgroundColor: '#121212', minHeight: '100vh' }}>
        <Typography variant="h6" gutterBottom color="white">
          Form 1: Part Number Accountability
        </Typography>

        <Paper sx={{ padding: 2 }}>
          <Grid container spacing={2}>
            {/* 1-4 */}
            <Grid item xs={3}>
              <TextField fullWidth label="1. Part Number" size="small" onChange={handleChange('partNumber')} />
            </Grid>
            <Grid item xs={3}>
              <TextField fullWidth label="2. Part Name" size="small" onChange={handleChange('partName')} />
            </Grid>
            <Grid item xs={3}>
              <TextField fullWidth label="3. Serial Number" size="small" onChange={handleChange('serialNumber')} />
            </Grid>
            <Grid item xs={3}>
              <TextField fullWidth label="4. FAIR Identifier" size="small" onChange={handleChange('fairId')} />
            </Grid>

            {/* 5-12 */}
            {[
              ['5. Part Revision Level', 'revLevel'],
              ['6. Drawing Number', 'drawingNumber'],
              ['7. Drawing Revision Level', 'drawingRev'],
              ['8. Additional Changes', 'additionalChanges'],
              ['9. Manufacturing Process Reference', 'manufacturingProcess'],
              ['10. Organization Name', 'organizationName'],
              ['11. Supplier Code', 'supplierCode'],
              ['12. Purchase Order Number', 'poNumber'],
            ].map(([label, key], index) => (
              <Grid item xs={3} key={index}>
                <TextField fullWidth label={label} size="small" onChange={handleChange(key)} />
              </Grid>
            ))}

            {/* 13 - Checklist */}
            <Grid item xs={12}>
              <Typography variant="subtitle1" gutterBottom>
                13. Detail (Assembly)
              </Typography>
              <FormControlLabel control={<Checkbox onChange={handleChange('detail')} />} label="Detail" />
              <FormControlLabel control={<Checkbox onChange={handleChange('assembly')} />} label="Assembly" />
            </Grid>

            {/* 14 */}
            <Grid item xs={12}>
              <Typography variant="subtitle1" gutterBottom>
                14. Full FAI / Partial FAI:
              </Typography>
              <FormControlLabel control={<Checkbox onChange={handleChange('partialFAI')} />} label="Partial FAI" />
              <FormControlLabel control={<Checkbox onChange={handleChange('fullFAI')} />} label="Full FAI" />
              <TextField fullWidth label="Baseline Part Number (Including Revision Level)" size="small" sx={{ mt: 1 }} onChange={handleChange('baselinePart')} />
              <TextField fullWidth label="Reason for Full/Partial FAI" size="small" sx={{ mt: 1 }} onChange={handleChange('faiReason')} />
              <TextField fullWidth label="Comments" size="small" sx={{ mt: 1 }} onChange={handleChange('faiComments')} />
            </Grid>

            {/* 15-18 */}
            {[
              ['15. Part Number', 'partNum15'],
              ['16. Part Name', 'partName16'],
              ['17. Part Type', 'partType'],
              ['18. FAIR Identifier', 'fairId18'],
            ].map(([label, key], index) => (
              <Grid item xs={3} key={index}>
                <TextField fullWidth label={label} size="small" onChange={handleChange(key)} />
              </Grid>
            ))}

            {/* 19 */}
            <Grid item xs={12}>
              <Typography>19. Does FAIR Contain a Documented Nonconformance(s):</Typography>
              <RadioGroup row onChange={handleChange('nonConformance')}>
                <FormControlLabel value="yes" control={<Radio />} label="Yes" />
                <FormControlLabel value="no" control={<Radio />} label="No" />
              </RadioGroup>
            </Grid>

            {/* 20-25 */}
            {[
              ['20. FAIR Verified By', 'verifiedBy'],
              ['21. Date', 'dateVerified'],
              ['22. FAIR Reviewed/Approved By', 'approvedBy'],
              ['23. Date', 'dateApproved'],
              ['24. Customer Approval', 'customerApproval'],
              ['25. Date', 'dateCustomer'],
            ].map(([label, key], index) => (
              <Grid item xs={6} key={index}>
                <TextField fullWidth label={label} size="small" onChange={handleChange(key)} />
              </Grid>
            ))}

            {/* 26 */}
            <Grid item xs={12}>
              <TextField fullWidth label="26. Comments" size="small" onChange={handleChange('comments')} />
            </Grid>

            {/* Buttons */}
            <Grid item xs={12} sx={{ mt: 2 }}>
              <Button variant="contained" color="primary" onClick={handleSave} sx={{ mr: 2 }}>
                Save
              </Button>
              <Button variant="contained" color="success" onClick={handleNext}>
                Next
              </Button>
            </Grid>
          </Grid>
        </Paper>
      </Box>
    </ThemeProvider>
  );
}
