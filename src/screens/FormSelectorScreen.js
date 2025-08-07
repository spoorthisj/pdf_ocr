import React, { useEffect } from 'react';
import { Button, Typography, Stack } from '@mui/material';
import { useNavigate } from 'react-router-dom';

export default function FormSelectorScreen() {
  const navigate = useNavigate();

  useEffect(() => {
    console.log('FormSelectorScreen loaded');
  }, []);

  const handleNavigate = (path) => () => navigate(path);

  return (
    <div
      style={{
        padding: 30,
        minHeight: '100vh',
        backgroundColor: '#121212',
        color: 'white',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Typography variant="h4" gutterBottom>
        Select a Form
      </Typography>
      <Stack spacing={2} sx={{ width: '200px' }}>
        <Button variant="contained" fullWidth onClick={handleNavigate('/form1setup')}>
          Form 1
        </Button>
        <Button variant="contained" fullWidth onClick={handleNavigate('/form2setup')}>
          Form 2
        </Button>
        <Button variant="contained" fullWidth onClick={handleNavigate('/form3setup')}>
          Form 3
        </Button>
      </Stack>
    </div>
  );
}
