import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useFiles } from '../context/FileContext';

function FolderUploadScreen() {
  const { files, setFiles } = useFiles();
  const navigate = useNavigate();

  // Remove a single file by index
  const removeFile = (indexToRemove) => {
    setFiles(files.filter((_, index) => index !== indexToRemove));
  };

  // Handle new files added via file input (append to existing)
  const handleFileChange = (event) => {
    if (event.target.files.length > 0) {
      const selectedFiles = Array.from(event.target.files);
      // Append new files to existing files
      setFiles(prevFiles => [...prevFiles, ...selectedFiles]);
      // Reset input value so the same file can be re-selected if needed
      event.target.value = null;
    }
  };

  const goToForm = () => {
    navigate('/form1setup');
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.heading}>Upload Documents for FORM 1</h1>
      <p style={styles.subheading}>
        Select one or more Form 1 documents (images or PDFs) to begin.
      </p>

      {/* Hidden input for adding files */}
      <input
        type="file"
        accept="image/*,application/pdf"
        id="fileUpload"
        style={{ display: 'none' }}
        multiple
        onChange={handleFileChange}
      />

      {/* '+' button to add more files */}
      <button
        style={{ ...styles.uploadBtn, marginBottom: 20 }}
        onClick={() => document.getElementById('fileUpload').click()}
      >
        + Add More Files
      </button>

      {files.length > 0 && (
        <div style={styles.filePreview}>
          <h3>Selected Files:</h3>
          <ul style={styles.fileList}>
            {files.map((file, index) => (
              <li key={index} style={styles.fileListItem}>
                {file.name}
                <button
                  style={styles.removeBtn}
                  onClick={() => removeFile(index)}
                  aria-label={`Remove file ${file.name}`}
                >
                  ×
                </button>
              </li>
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
    maxWidth: 400,
  },
  fileListItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '6px 10px',
    borderBottom: '1px solid #ddd',
  },
  removeBtn: {
    backgroundColor: 'transparent',
    border: 'none',
    color: '#ff4d4f',
    fontSize: '1.2em',
    cursor: 'pointer',
    fontWeight: 'bold',
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
