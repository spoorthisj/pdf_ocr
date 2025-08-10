// src/screens/FolderUploadScreen.js
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useFiles } from '../context/FileContext';

function FolderUploadScreen() {
  const { files, setFiles } = useFiles();
  const navigate = useNavigate();

  const handleFileChange = (event) => {
    if (event.target.files.length > 0) {
      // Convert FileList to an array
      const selectedFiles = Array.from(event.target.files);
      setFiles(selectedFiles);
    }
  };

  const goToForm = () => {
    navigate('/form1setup');
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.heading}>Upload Documents</h1>
      <p style={styles.subheading}>
        Select one or more Form 1 documents (images or PDFs) to begin.
      </p>
      
      <input
        type="file"
        accept="image/*,application/pdf"
        id="fileUpload"
        style={{ display: 'none' }}
        multiple
        onChange={handleFileChange}
      />
      
      <button 
        style={styles.uploadBtn}
        onClick={() => document.getElementById('fileUpload').click()}
      >
        Choose Files
      </button>

      {files.length > 0 && (
        <div style={styles.filePreview}>
          <h3>Selected Files:</h3>
          <ul style={styles.fileList}>
            {files.map((file, index) => (
              <li key={index}>{file.name}</li>
            ))}
          </ul>
          <button style={styles.continueBtn} onClick={goToForm}>
            Extract Data & Continue
          </button>
        </div>
      )}
    </div>
  );
}

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
  subheading: { color: '#666', marginBottom: '30px', textAlign: 'center' },
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
  fileList: {
    listStyle: 'none',
    padding: 0,
    margin: '10px 0',
    textAlign: 'left',
  },
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
