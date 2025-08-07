import React, { useState } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  IconButton,
  Button,
  Stack
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

export default function Form3SetupScreen() {
  const [rows, setRows] = useState([{ id: 1 }]);

  const addRow = () => {
    setRows(prev => [...prev, { id: prev.length + 1 }]);
  };

  const renderTextField = (placeholder = '') => (
    <TextField
      variant="outlined"
      size="small"
      placeholder={placeholder}
      InputProps={{ style: { color: 'white', fontSize: 12 } }}
      sx={{
        input: { color: 'white' },
        '& .MuiOutlinedInput-root': {
          '& fieldset': { borderColor: 'gray' }
        }
      }}
    />
  );

  // Dummy data for download (replace with real form data)
  const generateExcel = () => {
    const form1Data = [
      ['Form 1'],
      ['Field', 'Value'],
      ['Part Number', '123'],
      ['Part Name', 'Test Part'],
      ['Serial Number', 'SN001'],
      ['FAIR ID', 'FAIR001'],
      ['Detail (Assembly)', 'Assembly']
    ];

    const form2Data = [
      ['Form 2'],
      ['Material Name', 'Spec No.', 'Code', 'Supplier', 'Approved', 'CoC No.', 'Ref Doc'],
      ['MaterialX', 'Spec123', 'A1', 'ABC Corp', 'Yes', 'COC001', 'REF001']
    ];

    const form3Data = [
      ['Form 3'],
      ['Char. No.', 'Ref Location', 'Designator', 'Requirement', 'Results', 'Tooling', 'Nonconf. No.', 'Comments'],
      ...rows.map((_, index) => [`${index + 1}`, '', '', '', '', '', '', ''])
    ];

    const wb = XLSX.utils.book_new();

    const ws1 = XLSX.utils.aoa_to_sheet(form1Data);
    const ws2 = XLSX.utils.aoa_to_sheet(form2Data);
    const ws3 = XLSX.utils.aoa_to_sheet(form3Data);

    XLSX.utils.book_append_sheet(wb, ws1, 'Form 1');
    XLSX.utils.book_append_sheet(wb, ws2, 'Form 2');
    XLSX.utils.book_append_sheet(wb, ws3, 'Form 3');

    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([wbout], { type: 'application/octet-stream' }), 'AllForms_FAIR.xlsx');
  };

  return (
    <Box
      sx={{
        padding: 4,
        backgroundColor: '#121212',
        minHeight: '100vh',
        color: 'white'
      }}
    >
      <Typography variant="h6" gutterBottom>
        Form 3: Characteristic Accountability, Verification and Compatibility Evaluation
      </Typography>

      {/* Top Input Fields */}
      <Box mb={3} display="flex" flexWrap="wrap" gap={2}>
        {['Part Number', 'Part Name', 'Serial Number', 'FAIR Identifier'].map((label, index) => (
          <TextField
            key={index}
            label={label}
            variant="outlined"
            size="small"
            InputLabelProps={{ style: { color: 'white' } }}
            InputProps={{ style: { color: 'white' } }}
            sx={{
              width: '220px',
              '& .MuiOutlinedInput-root': {
                '& fieldset': { borderColor: 'gray' }
              }
            }}
          />
        ))}
      </Box>

      {/* Table */}
      <TableContainer component={Paper} sx={{ backgroundColor: '#1e1e1e' }}>
        <Table>
          <TableHead>
            <TableRow>
              {[
                'Char. No.',
                'Reference Location',
                'Characteristic Designator',
                'Requirement',
                'Results',
                'Designed / Qualified Tooling',
                'Nonconformance Number',
                'Additional Data / Comments',
                ''
              ].map((header, i) => (
                <TableCell
                  key={i}
                  sx={{ color: 'white', fontWeight: 'bold', border: '1px solid #444' }}
                >
                  {header}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>

          <TableBody>
            {rows.map((row, rowIndex) => (
              <TableRow key={row.id}>
                {Array(8)
                  .fill()
                  .map((_, colIndex) => (
                    <TableCell key={colIndex} sx={{ border: '1px solid #444' }}>
                      {renderTextField()}
                    </TableCell>
                  ))}
                <TableCell sx={{ border: '1px solid #444', textAlign: 'center' }}>
                  {rowIndex === rows.length - 1 && (
                    <IconButton onClick={addRow} size="small" sx={{ color: 'white' }}>
                      <AddIcon />
                    </IconButton>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Action Buttons */}
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
