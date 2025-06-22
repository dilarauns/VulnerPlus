import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone, DropzoneOptions } from 'react-dropzone';
import './TrivyPage.css';
import CircularProgress from '@mui/material/CircularProgress';
import { FaDocker, FaFile, FaCheck, FaTimes, FaSpinner, FaCode, FaRobot } from 'react-icons/fa';
import Modal from '@mui/material/Modal';
import Box from '@mui/material/Box';
import ReactMarkdown from 'react-markdown';

interface ScanResult {
  id: string;
  imageName: string;
  status: 'scanning' | 'completed' | 'error';
  error?: string;
  vulnerabilities?: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    unknown: number;
  };
  rawData?: any;
  aiAnalysis?: string;
  analysisId?: string;
  aiStatus?: 'pending' | 'completed';
}

const TrivyPage: React.FC = () => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [imageInput, setImageInput] = useState('');
  const [inputMethod, setInputMethod] = useState<'file' | 'image'>('image');
  const [scanResults, setScanResults] = useState<ScanResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setSelectedFiles(acceptedFiles);
    setInputMethod('file');
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    onDragEnter: () => {},
    onDragOver: () => {},
    onDragLeave: () => {}
  } as unknown as DropzoneOptions);

  const inputProps = getInputProps() as unknown as React.InputHTMLAttributes<HTMLInputElement>;

  const handleImageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImageInput(e.target.value);
    setInputMethod('image');
  };

  // Add polling function for AI results
  const pollAiResults = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/trivy/ai-status/${id}`);
      const data = await response.json();
      
      if (data.status === 'completed') {
        setScanResults(prev => prev.map(scan => 
          scan.analysisId === id 
            ? {
                ...scan,
                aiAnalysis: data.ai_comment,
                aiStatus: 'completed'
              }
            : scan
        ));
        return true;
      }
      return false;
    } catch (error) {
      console.error('AI polling error:', error);
      return false;
    }
  }, []);

  // Add polling effect
  useEffect(() => {
    const intervals: { [key: string]: ReturnType<typeof setTimeout> } = {};
    
    scanResults.forEach(result => {
      if (result.analysisId && result.aiStatus === 'pending') {
        intervals[result.analysisId] = setInterval(async () => {
          const isComplete = await pollAiResults(result.analysisId!);
          if (isComplete) {
            clearInterval(intervals[result.analysisId!]);
            delete intervals[result.analysisId!];
          }
        }, 2000);
      }
    });

    return () => {
      Object.values(intervals).forEach(interval => clearInterval(interval));
    };
  }, [scanResults, pollAiResults]);

  const handleScanResult = (result: any, newScan: ScanResult) => {
    console.log('Raw scan result:', result);

    const vulnerabilityCounts = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      unknown: 0
    };

    try {
      // Handle double-nested scan_result structure
      const results = result?.scan_result?.Results;
      if (results && Array.isArray(results)) {
        results.forEach((scanResult: any) => {
          if (scanResult?.Vulnerabilities && Array.isArray(scanResult.Vulnerabilities)) {
            scanResult.Vulnerabilities.forEach((vuln: any) => {
              if (vuln?.Severity) {
                const severity = vuln.Severity.toLowerCase();
                if (severity in vulnerabilityCounts) {
                  vulnerabilityCounts[severity as keyof typeof vulnerabilityCounts]++;
                }
              }
            });
          }
        });
      }

      setScanResults(prev => prev.map(scan => 
        scan.id === newScan.id 
          ? {
              ...scan,
              status: 'completed',
              vulnerabilities: vulnerabilityCounts,
              rawData: result,
              analysisId: result.analysis_id,
              aiStatus: 'pending'
            }
          : scan
      ));
    } catch (error) {
      console.error('Error processing scan result:', error);
      setScanResults(prev => prev.map(scan => 
        scan.id === newScan.id 
          ? {
              ...scan,
              status: 'error',
              error: 'Failed to process scan results'
            }
          : scan
      ));
    }
  };

  const handleOpenModal = (result: any) => {
    setSelectedResult(result);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedResult(null);
  };

  const startScan = async () => {
    let newScan: ScanResult;
    
    if (inputMethod === 'image' && imageInput) {
      newScan = {
        id: Date.now().toString(),
        imageName: imageInput,
        status: 'scanning',
        vulnerabilities: {
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
          unknown: 0
        }
      };
    } else if (inputMethod === 'file' && selectedFiles.length > 0) {
      newScan = {
        id: Date.now().toString(),
        imageName: selectedFiles[0].name,
        status: 'scanning',
        vulnerabilities: {
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
          unknown: 0
        }
      };
    } else {
      return;
    }

    setScanResults(prev => [...prev, newScan]);

    try {
      if (inputMethod === 'file') {
        const formData = new FormData();
        formData.append('file', selectedFiles[0]);
        
        const response = await fetch('/api/trivy/analyze/file', {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || 'Scan failed');
        }

        const result = await response.json();
        handleScanResult(result, newScan);
      } else {
        console.log('Starting scan for image:', imageInput);  // Debug log
        
        const response = await fetch(`/api/trivy/analyze?image=${encodeURIComponent(imageInput)}`, {
          method: 'GET'
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || 'Scan failed');
        }

        const result = await response.json();
        console.log('Scan result:', result);  // Debug log
        
        handleScanResult(result, newScan);
        setImageInput('');
      }
    } catch (error) {
      console.error('Scan error:', error);  // Debug log
      setScanResults(prev => prev.map(scan => 
        scan.id === newScan.id 
          ? {
              ...scan,
              status: 'error',
              error: error instanceof Error ? error.message : 'An error occurred'
            }
          : scan
      ));
    }
  };

  const getSeverityColor = (severity: string): string => {
    switch (severity.toLowerCase()) {
      case 'critical': return '#dc2626';
      case 'high': return '#ea580c';
      case 'medium': return '#d97706';
      case 'low': return '#65a30d';
      default: return '#6b7280';
    }
  };

  return (
    <div className="trivy-page">
      <div className="page-title">
        <h1>Trivy Vulnerability Scanner</h1>
      </div>
      <div className="scan-input-section">
        <div className="input-toggle">
          <button 
            className={inputMethod === 'image' ? 'active' : ''} 
            onClick={() => setInputMethod('image')}
          >
            <FaDocker /> Docker Image
          </button>
          <button 
            className={inputMethod === 'file' ? 'active' : ''} 
            onClick={() => setInputMethod('file')}
          >
            <FaFile /> Upload File
          </button>
        </div>

        {inputMethod === 'image' ? (
          <div className="image-input">
            <input
              type="text"
              placeholder="Enter Docker image name (e.g., nginx:latest)"
              value={imageInput}
              onChange={handleImageInputChange}
            />
          </div>
        ) : (
          <div {...getRootProps()} className={`dropzone ${isDragActive ? 'active' : ''}`}>
            <input {...inputProps} />
            {isDragActive ? (
              <p>Drop the files here ...</p>
            ) : (
              <p>Drag and drop files here, or click to select files</p>
            )}
            {selectedFiles.length > 0 && (
              <div className="selected-files">
                <p>Selected: {selectedFiles[0].name}</p>
              </div>
            )}
          </div>
        )}

        <button 
          className="scan-button"
          onClick={startScan}
          disabled={
            (inputMethod === 'image' && !imageInput) || 
            (inputMethod === 'file' && selectedFiles.length === 0)
          }
        >
          Start Scan
        </button>
      </div>

      <div className="scan-results-list">
        {scanResults.map(result => (
          <div key={result.id} className="scan-result-card">
            <div className="scan-header">
              <h3>{result.imageName}</h3>
              <div className={`scan-status ${result.status}`}>
                {result.status === 'scanning' && (
                  <>
                    <span className="spin"><FaSpinner /></span> Scanning...
                  </>
                )}
                {result.status === 'completed' && (
                  <>
                    <FaCheck /> Scan Complete
                  </>
                )}
                {result.status === 'error' && (
                  <>
                    <FaTimes /> Error
                  </>
                )}
              </div>
            </div>

            {result.status === 'scanning' && (
              <div className="scan-progress">
                <CircularProgress size={24} />
                <p>Scanning for vulnerabilities...</p>
              </div>
            )}

            {result.status === 'error' && (
              <div className="scan-error">
                {result.error}
              </div>
            )}

            {result.status === 'completed' && result.vulnerabilities && (
              <>
                <div className="vulnerabilities-summary">
                  <div className="vuln-stats">
                    {Object.entries(result.vulnerabilities).map(([severity, count]) => (
                      <div
                        key={severity}
                        className="severity-stat"
                        style={{ backgroundColor: getSeverityColor(severity) }}
                      >
                        {severity}: {count}
                      </div>
                    ))}
                  </div>
                </div>
                
                {result.aiStatus === 'pending' && (
                  <div className="ai-analysis-loading">
                    <CircularProgress size={20} />
                    <span>AI Analysis in progress...</span>
                  </div>
                )}
                
                {result.aiAnalysis && (
                  <div className="ai-analysis">
                    <h3><FaRobot /> AI Analysis</h3>
                    <div className="ai-content">
                      <ReactMarkdown>{result.aiAnalysis}</ReactMarkdown>
                    </div>
                  </div>
                )}
                
                {result.rawData && (
                  <button 
                    className="view-json-button"
                    onClick={() => handleOpenModal(result.rawData)}
                  >
                    <FaCode /> View Raw Data
                  </button>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      <Modal
        open={isModalOpen}
        onClose={handleCloseModal}
        aria-labelledby="json-modal-title"
      >
        <Box className="json-modal">
          <h2 id="json-modal-title">Scan Result Details</h2>
          <pre>
            {selectedResult ? JSON.stringify(selectedResult, null, 2) : ''}
          </pre>
          <button onClick={handleCloseModal}>Close</button>
        </Box>
      </Modal>
    </div>
  );
};

export default TrivyPage; 