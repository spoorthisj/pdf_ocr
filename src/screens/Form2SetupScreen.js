// Form2SetupScreen.js
import React from 'react';
import {
  TextField,
  Typography,
  Grid,
  Box,
  Checkbox,
  FormControlLabel,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Paper,
  Stack,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';

export default function Form2SetupScreen() {
  const navigate = useNavigate();

  const inputStyle = {
    '& .MuiOutlinedInput-root': {
      '& fieldset': { borderColor: '#555' },
      '&:hover fieldset': { borderColor: '#888' },
    },
    input: { color: 'white' },
    label: { color: 'white' }
  };

  return (
    <Box p={4} bgcolor="#121212" minHeight="100vh">
      <Paper elevation={3} sx={{ p: 4, backgroundColor: '#1e1e1e', color: 'white' }}>
        <Typography variant="h6" gutterBottom align="center">
          AS/EN/SJAC9102 Rev C First Article Inspection
        </Typography>
        <Typography variant="subtitle1" gutterBottom align="center">
          Form 2: Product Accountability – Materials, Special Processes, and Functional Testing
        </Typography>

        {/* Top 4 Fields */}
        <Grid container spacing={2}>
          {["1. Part Number", "2. Part Name", "3. Serial Number", "4. FAIR Identifier"].map((label, idx) => (
            <Grid item xs={12} sm={6} md={3} key={idx}>
              <TextField
                fullWidth
                label={label}
                variant="outlined"
                InputLabelProps={{ style: { color: 'white' } }}
                InputProps={{ style: { color: 'white' } }}
                sx={inputStyle}
              />
            </Grid>
          ))}
        </Grid>

        {/* Table Part: Materials, Processes, Inspections */}
        <Box mt={4}>
          <Table sx={{ minWidth: 650, backgroundColor: '#2b2b2b' }} border={1}>
            {/* Materials Section */}
            <TableHead>
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ color: 'white', backgroundColor: '#333' }}>
                  Materials
                </TableCell>
              </TableRow>
              <TableRow>
                {[
                  "5. Material/Process Name",
                  "6. Specification Number",
                  "7. Code",
                  "8. Supplier",
                  "9. Customer Approval Verification",
                  "10. Certificate of Conformance Number",
                  "Reference Document"
                ].map((label, idx) => (
                  <TableCell key={idx} sx={{ color: 'white', backgroundColor: '#2b2b2b' }}>
                    {label}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                {[...Array(4)].map((_, i) => (
                  <TableCell key={i}>
                    <TextField fullWidth variant="standard" InputProps={{ style: { color: 'white' } }} />
                  </TableCell>
                ))}
                <TableCell>
                  <FormControlLabel
                    control={<Checkbox sx={{ color: 'white' }} />}
                    label="Yes"
                    sx={{ color: 'white' }}
                  />
                  <FormControlLabel
                    control={<Checkbox sx={{ color: 'white' }} />}
                    label="No"
                    sx={{ color: 'white' }}
                  />
                </TableCell>
                <TableCell><TextField fullWidth variant="standard" InputProps={{ style: { color: 'white' } }} /></TableCell>
                <TableCell><TextField fullWidth variant="standard" InputProps={{ style: { color: 'white' } }} /></TableCell>
              </TableRow>
            </TableBody>

            {/* Processes Section */}
            <TableHead>
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ color: 'white', backgroundColor: '#333' }}>
                  Processes
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                {[...Array(7)].map((_, i) => (
                  <TableCell key={i}>
                    <TextField fullWidth variant="standard" InputProps={{ style: { color: 'white' } }} />
                  </TableCell>
                ))}
              </TableRow>
            </TableBody>

            {/* Inspections Section */}
            <TableHead>
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ color: 'white', backgroundColor: '#333' }}>
                  Inspections
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                {[...Array(7)].map((_, i) => (
                  <TableCell key={i}>
                    <TextField fullWidth variant="standard" InputProps={{ style: { color: 'white' } }} />
                  </TableCell>
                ))}
              </TableRow>
            </TableBody>
          </Table>
        </Box>

        {/* Bottom Fields */}
        <Grid container spacing={2} mt={2}>
          {["11. Functional Test Procedure Number", "12. Acceptance Report Number"].map((label, idx) => (
            <Grid item xs={12} sm={6} key={idx}>
              <TextField
                fullWidth
                label={label}
                variant="outlined"
                InputLabelProps={{ style: { color: 'white' } }}
                InputProps={{ style: { color: 'white' } }}
                sx={inputStyle}
              />
            </Grid>
          ))}
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="13. Comments"
              multiline
              rows={2}
              variant="outlined"
              InputLabelProps={{ style: { color: 'white' } }}
              InputProps={{ style: { color: 'white' } }}
              sx={inputStyle}
            />
          </Grid>
        </Grid>

        {/* Action Buttons (Same as Form1) */}
        <Box mt={4} display="flex" justifyContent="flex-start">
          <Stack direction="row" spacing={2}>
            <Button
              variant="contained"
              sx={{
                backgroundColor: '#4caf50',
                color: 'white',
                borderRadius: '8px',
                px: 4,
                '&:hover': {
                  backgroundColor: '#45a049',
                },
              }}
            >
              Save
            </Button>
            <Button
              variant="contained"
              sx={{
                backgroundColor: '#2196f3',
                color: 'white',
                borderRadius: '8px',
                px: 4,
                '&:hover': {
                  backgroundColor: '#1e88e5',
                },
              }}
              onClick={() => navigate('/form3setup')}
            >
              Next
            </Button>
          </Stack>
        </Box>
      </Paper>
    </Box>
  );
}
