import React, { useState, useEffect } from 'react';
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
  Button
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { useLocation } from 'react-router-dom';

export default function Form3SetupScreen() {
  const location = useLocation();

  const [formData, setFormData] = useState({
    partNumber: '',
    partName: '',
    serialNumber: '',
    fairIdentifier: ''
  });

  const [rows, setRows] = useState([{ id: 1 }]);

  useEffect(() => {
    const { form1Data, form2Data } = location.state || {};
  
    if (form1Data) {
      setFormData(prev => ({
        ...prev,
        ...form1Data
      }));
    }
  
    if (form2Data) {
      // merge if needed
    }
  }, [location.state]);
  

  const addRow = () => {
    setRows(prev => [...prev, { id: prev.length + 1 }]);
  };

  const renderTextField = (placeholder = '') => (
    <TextField
      variant="outlined"
      size="small"
      placeholder={placeholder}
      InputProps={{ style: { fontSize: 13 } }}
      sx={{
        input: { color: '#333' },
        '& .MuiOutlinedInput-root': {
          '& fieldset': { borderColor: '#ccc' }
        }
      }}
    />
  );

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
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(form1Data), 'Form 1');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(form2Data), 'Form 2');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(form3Data), 'Form 3');

    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([wbout], { type: 'application/octet-stream' }), 'AllForms_FAIR.xlsx');
  };

  return (
    <Box
      sx={{
        padding: 4,
        backgroundColor: '#f9f9f9',
        minHeight: '100vh',
        color: '#333'
      }}
    >
      {/* Title */}
      <Typography
        variant="h5"
        gutterBottom
        sx={{
          fontWeight: 'bold',
          borderBottom: '2px solid #1976d2',
          paddingBottom: '8px',
          marginBottom: 3
        }}
      >
        Form 3: Characteristic Accountability, Verification & Compatibility Evaluation
      </Typography>

      {/* Top Input Fields */}
      <Box
        mb={3}
        display="flex"
        flexWrap="wrap"
        gap={2}
      >
        {[
          { label: '1.Part Number', key: 'partNumber' },
          { label: '2.Part Name', key: 'partName' },
          { label: '3.Serial Number', key: 'serialNumber' },
          { label: '4.FAIR Identifier', key: 'fairIdentifier' }
        ].map(field => (
          <TextField
            key={field.key}
            label={field.label}
            variant="outlined"
            size="small"
            value={formData[field.key]}
            onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
            sx={{
              width: '220px',
              '& .MuiOutlinedInput-root': {
                '& fieldset': { borderColor: '#ccc' }
              }
            }}
          />
        ))}
      </Box>

      {/* Table */}
      <TableContainer
        component={Paper}
        sx={{
          backgroundColor: 'white',
          boxShadow: 3,
          borderRadius: 2
        }}
      >
        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: '#f1f1f1' }}>
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
                  sx={{
                    fontWeight: 'bold',
                    border: '1px solid #ddd',
                    textAlign: 'center'
                  }}
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
                    <TableCell
                      key={colIndex}
                      sx={{
                        border: '1px solid #eee',
                        padding: '8px'
                      }}
                    >
                      {renderTextField()}
                    </TableCell>
                  ))}
                <TableCell
                  sx={{
                    border: '1px solid #eee',
                    textAlign: 'center'
                  }}
                >
                  {rowIndex === rows.length - 1 && (
                    <IconButton
                      onClick={addRow}
                      size="small"
                      sx={{ color: '#1976d2' }}
                    >
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
          variant="contained"
          color="success"
          onClick={generateExcel}
        >
          Download
        </Button>
        <Button
          variant="contained"
          color="primary"
        >
          Submit
        </Button>
      </Box>
    </Box>
  );
}
