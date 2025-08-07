// src/screens/Form1SetupScreen.js
import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Grid, TextField, Paper, Button, CircularProgress, TextareaAutosize
} from '@mui/material';
import axios from 'axios';
import { useFiles } from '../context/FileContext';

/**
 * --- FINAL, ROBUST PARSING LOGIC ---
 * This function processes the OCR text line by line, which is much more reliable.
 */
const parseExtractedText = (text) => {
    const data = {
        partNumber: '',
        partName: ''
    };

    // Split the entire text block into an array of individual lines
    const lines = text.split('\n');

    // Process each line
    lines.forEach(line => {
        // Use .match() with case-insensitive flag 'i'
        // This looks for "Part" and "NO" on the same line, then grabs the rest of the line.
        const partNoMatch = line.match(/Part\s*NO\s*(.*)/i);
        if (partNoMatch && partNoMatch[1]) {
            data.partNumber = partNoMatch[1].trim();
        }

        // This looks for "Description" and grabs the rest of the line.
        const descriptionMatch = line.match(/Description\s*(.*)/i);
        if (descriptionMatch && descriptionMatch[1]) {
            data.partName = descriptionMatch[1].trim();
        }
    });
    
    // If the first method failed, try a more general approach
    if (!data.partNumber) {
        const genericPartNoMatch = text.match(/FW\d+/i);
        if (genericPartNoMatch) {
            data.partNumber = genericPartNoMatch[0];
        }
    }
    
    console.log("Parsed Data:", data);
    return data;
};


export default function Form1SetupScreen() {
    const { files } = useFiles();
    const [formData, setFormData] = useState({});
    const [rawText, setRawText] = useState(''); // State to hold the raw text
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const processFile = async () => {
            if (files.length === 0) return;

            const file = files[0];
            const fileFormData = new FormData();
            fileFormData.append('file', file);

            setIsLoading(true);
            setError('');
            setRawText('');

            try {
                const response = await axios.post('http://127.0.0.1:5000/api/extract-text', fileFormData);
                const { extracted_text } = response.data;
                
                if (!extracted_text || extracted_text.trim() === '') {
                    setError('OCR failed to extract any text from the document.');
                } else {
                    // --- THIS IS THE KEY ---
                    // We store the raw text so we can see it on the screen
                    setRawText(extracted_text); 
                    const parsedData = parseExtractedText(extracted_text);
                    setFormData(parsedData);
                }

            } catch (err) {
                console.error("API Error:", err);
                setError('Failed to extract data. Is the backend server running?');
            } finally {
                setIsLoading(false);
            }
        };

        processFile();
    }, [files]);

    const handleChange = (field) => (e) => {
        setFormData(prev => ({ ...prev, [field]: e.target.value }));
    };

    return (
        <Box sx={{ padding: 4, backgroundColor: '#f4f7f6', minHeight: '100vh' }}>
            <Typography variant="h4" gutterBottom>
                Data Extraction Form
            </Typography>

            {isLoading && <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}><CircularProgress /> <Typography sx={{ml: 2}}>Extracting data...</Typography></Box>}
            {error && <Typography color="error">{error}</Typography>}
            
            {!isLoading && !error && (
                <Grid container spacing={4}>
                    {/* Parsed Results */}
                    <Grid item xs={12} md={6}>
                        <Paper sx={{ padding: 3 }}>
                            <Typography variant="h6" gutterBottom>Parsed Results</Typography>
                            <TextField fullWidth label="Part Number" value={formData.partNumber || ''} onChange={handleChange('partNumber')} sx={{mb: 2}} />
                            <TextField fullWidth label="Part Name" value={formData.partName || ''} onChange={handleChange('partName')} />
                        </Paper>
                    </Grid>

                    {/* Raw OCR Output */}
                    <Grid item xs={12} md={6}>
                        <Paper sx={{ padding: 3 }}>
                            <Typography variant="h6" gutterBottom>Raw OCR Output (What the computer sees)</Typography>
                            <TextareaAutosize
                                minRows={10}
                                value={rawText}
                                style={{ width: '100%', fontSize: '12px', fontFamily: 'monospace' }}
                                readOnly
                            />
                        </Paper>
                    </Grid>
                </Grid>
            )}
        </Box>
    );
}
