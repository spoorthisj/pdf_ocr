import React, { createContext, useContext, useState } from 'react';

const FileContext = createContext(null);

export const FileProvider = ({ children }) => {
  const [files, setFiles] = useState([]);
  const [extractedData, setExtractedData] = useState(null); // New state for extracted data

  const value = {
    files,
    setFiles,
    extractedData,
    setExtractedData, // Expose the new state setter
  };

  return <FileContext.Provider value={value}>{children}</FileContext.Provider>;
};

export const useFiles = () => {
  return useContext(FileContext);
};
