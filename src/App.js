import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import FolderUploaderScreen from './screens/FolderUploaderScreen';
import FormSelectorScreen from './screens/FormSelectorScreen';
import Form1SetupScreen from './screens/Form1SetupScreen';
import Form2SetupScreen from './screens/Form2SetupScreen';
import Form3SetupScreen from './screens/Form3SetupScreen';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<FolderUploaderScreen />} />
        <Route path="/form-selector" element={<FormSelectorScreen />} />
        <Route path="/form1setup" element={<Form1SetupScreen />} />
        <Route path="/form2setup" element={<Form2SetupScreen />} />
        <Route path="/form3setup" element={<Form3SetupScreen />} />
      </Routes>
    </Router>
  );
}

export default App;
