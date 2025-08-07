import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function FolderUploadScreen() {
  const [files, setFiles] = useState([]);
  const navigate = useNavigate();

  const pickFiles = (event) => {
    const selectedFiles = Array.from(event.target.files);
    setFiles((prev) => [...prev, ...selectedFiles]);
  };

  const goToFormSelector = () => {
    navigate('/form-selector');
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.heading}>Uploaded PDFs</h2>

      {files.length === 0 ? (
        <p style={styles.emptyText}>No files uploaded</p>
      ) : (
        <ul style={styles.fileList}>
          {files.map((file, index) => (
            <li key={file.name + index} style={styles.fileItem}>
              📄 <span style={styles.fileName}>{file.name}</span>
            </li>
          ))}
        </ul>
      )}

      <input
        type="file"
        accept="application/pdf"
        multiple
        id="fileUpload"
        style={{ display: 'none' }}
        onChange={pickFiles}
      />

      <button
        style={styles.fab}
        onClick={() => document.getElementById('fileUpload').click()}
      >
        +
      </button>

      {files.length > 0 && (
        <button style={styles.continueBtn} onClick={goToFormSelector}>
          Continue to Form
        </button>
      )}
    </div>
  );
}

export default FolderUploadScreen;

const styles = {
  container: {
    padding: '24px',
    fontFamily: 'Arial, sans-serif',
    backgroundColor: '#fafbff',
    minHeight: '100vh',
    position: 'relative',
  },
  heading: {
    fontSize: '22px',
    fontWeight: 'bold',
    marginBottom: '16px',
  },
  emptyText: {
    color: '#666',
    marginTop: '20px',
    textAlign: 'center',
  },
  fileList: {
    listStyleType: 'none',
    padding: 0,
  },
  fileItem: {
    backgroundColor: '#eef0f5',
    margin: '6px 0',
    padding: '10px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    fontSize: '16px',
    color: '#333',
  },
  fileName: {
    marginLeft: '10px',
  },
  fab: {
    position: 'fixed',
    bottom: '100px',
    right: '30px',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '50%',
    width: '56px',
    height: '56px',
    fontSize: '28px',
    cursor: 'pointer',
    boxShadow: '0px 4px 6px rgba(0,0,0,0.1)',
  },
  continueBtn: {
    position: 'fixed',
    bottom: '20px',
    left: '20px',
    right: '20px',
    backgroundColor: '#28a745',
    color: 'white',
    padding: '14px',
    borderRadius: '12px',
    fontSize: '16px',
    fontWeight: 'bold',
    border: 'none',
    cursor: 'pointer',
    boxShadow: '0px 4px 6px rgba(0,0,0,0.1)',
  },
};
