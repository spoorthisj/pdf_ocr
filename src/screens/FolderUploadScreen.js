// src/screens/FolderUploadScreen.js
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useFiles } from '../context/FileContext';

function FolderUploadScreen() {
  const { files, setFiles } = useFiles();
  const navigate = useNavigate();

  const handleFileChange = (event) => {
    // We'll handle one file at a time for this example
    if (event.target.files.length > 0) {
      setFiles([event.target.files[0]]);
    }
  };

  const goToForm = () => {
    navigate('/form1setup');
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.heading}>Upload Document</h1>
      <p style={styles.subheading}>Upload the engineering drawing to begin.</p>
      
      <input
        type="file"
        accept="image/*,application/pdf"
        id="fileUpload"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      
      <button 
        style={styles.uploadBtn}
        onClick={() => document.getElementById('fileUpload').click()}
      >
        Choose File
      </button>

      {files.length > 0 && (
        <div style={styles.filePreview}>
          <p>Selected file: {files[0].name}</p>
          <button style={styles.continueBtn} onClick={goToForm}>
            Extract Data & Continue
          </button>
        </div>
      )}
    </div>
  );
}

// Basic styles for a clean look
const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    padding: '20px',
    fontFamily: 'sans-serif',
    backgroundColor: '#f4f7f6',
  },
  heading: { fontSize: '2em', marginBottom: '10px' },
  subheading: { color: '#666', marginBottom: '30px' },
  uploadBtn: {
    padding: '12px 24px',
    fontSize: '1em',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
  },
  filePreview: { textAlign: 'center', marginTop: '30px' },
  continueBtn: {
    padding: '12px 24px',
    fontSize: '1em',
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    marginTop: '10px',
  },
};

export default FolderUploadScreen;