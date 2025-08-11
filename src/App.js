// src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { FileProvider } from './context/FileContext';
import FolderUploadScreen from './screens/FolderUploadScreen';
import Form1SetupScreen from './screens/Form1SetupScreen';
import Form2SetupScreen from './screens/Form2SetupScreen'; // adjust path as needed
import Form3SetupScreen from './screens/Form3SetupScreen';
import './App.css';

function App() {
  return (
    <FileProvider>
      <Router>
        <Routes>
          <Route path="/" element={<FolderUploadScreen />} />
          <Route path="/form1setup" element={<Form1SetupScreen />} />
          <Route path="/form2setup" element={<Form2SetupScreen />} />
          <Route path="/form3setup" element={<Form3SetupScreen />} />

          {/* You can add routes for your other forms here */}
        </Routes>
      </Router>
    </FileProvider>
  );
}

export default App;