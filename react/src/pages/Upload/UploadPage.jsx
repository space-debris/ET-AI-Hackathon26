import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Upload,
  FileText,
  CheckCircle,
  AlertCircle,
  X,
  ArrowRight,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Progress } from '../../components/ui/Progress';
import { portfolioApi } from '../../services/api';
import { clsx } from 'clsx';

export function UploadPage() {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadState, setUploadState] = useState('idle'); // idle, uploading, success, error
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.type === 'application/pdf') {
      setFile(droppedFile);
      setError(null);
    } else {
      setError('Please upload a PDF file');
    }
  }, []);

  const handleFileChange = useCallback((e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (selectedFile.type === 'application/pdf') {
        setFile(selectedFile);
        setError(null);
      } else {
        setError('Please upload a PDF file');
      }
    }
  }, []);

  const handleUpload = async () => {
    if (!file) return;

    setUploadState('uploading');
    setProgress(0);

    // Simulate progress
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return prev;
        }
        return prev + 10;
      });
    }, 200);

    try {
      await portfolioApi.uploadStatement(file);
      clearInterval(progressInterval);
      setProgress(100);
      setUploadState('success');

      // Navigate to portfolio after short delay
      setTimeout(() => {
        navigate('/portfolio');
      }, 1500);
    } catch (err) {
      clearInterval(progressInterval);
      setUploadState('error');
      setError('Failed to process the statement. Please try again.');
    }
  };

  const resetUpload = () => {
    setFile(null);
    setUploadState('idle');
    setProgress(0);
    setError(null);
  };

  return (
    <div className="max-w-3xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Upload Statement</h1>
          <p className="text-gray-500 mt-1">
            Upload your CAMS or KFintech consolidated statement to analyze your portfolio
          </p>
        </div>

        {/* Upload Card */}
        <Card>
          <CardHeader>
            <CardTitle>Upload PDF Statement</CardTitle>
            <CardDescription>
              Supported formats: CAMS, KFintech Consolidated Account Statements
            </CardDescription>
          </CardHeader>
          <CardContent>
            {uploadState === 'idle' && (
              <>
                {/* Drop Zone */}
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={clsx(
                    'border-2 border-dashed rounded-xl p-12 text-center transition-all',
                    isDragging
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300',
                    file && 'border-emerald-500 bg-emerald-50'
                  )}
                >
                  {file ? (
                    <div className="space-y-4">
                      <div className="w-16 h-16 mx-auto bg-emerald-100 rounded-full flex items-center justify-center">
                        <FileText className="h-8 w-8 text-emerald-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{file.name}</p>
                        <p className="text-sm text-gray-500">
                          {(file.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={resetUpload}>
                        <X className="h-4 w-4 mr-1" /> Remove
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center">
                        <Upload className="h-8 w-8 text-gray-400" />
                      </div>
                      <div>
                        <p className="text-gray-600">
                          Drag and drop your PDF here, or{' '}
                          <label className="text-blue-600 hover:text-blue-700 cursor-pointer">
                            browse
                            <input
                              type="file"
                              accept=".pdf"
                              className="hidden"
                              onChange={handleFileChange}
                            />
                          </label>
                        </p>
                        <p className="text-sm text-gray-400 mt-1">
                          PDF files only, max 10MB
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {error && (
                  <div className="mt-4 p-3 bg-red-50 rounded-lg flex items-center gap-2 text-red-600">
                    <AlertCircle className="h-5 w-5" />
                    <span className="text-sm">{error}</span>
                  </div>
                )}

                {file && (
                  <div className="mt-6 flex justify-end">
                    <Button onClick={handleUpload} icon={ArrowRight} iconPosition="right">
                      Analyze Statement
                    </Button>
                  </div>
                )}
              </>
            )}

            {uploadState === 'uploading' && (
              <div className="py-8 space-y-6">
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto bg-blue-100 rounded-full flex items-center justify-center animate-pulse-soft">
                    <FileText className="h-8 w-8 text-blue-600" />
                  </div>
                  <h3 className="mt-4 font-semibold text-gray-900">Processing Statement</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Extracting transactions and calculating returns...
                  </p>
                </div>
                <Progress value={progress} showLabel />
                <div className="flex justify-center gap-2 text-sm text-gray-500">
                  <span className={progress >= 30 ? 'text-blue-600' : ''}>Parsing PDF</span>
                  <span>→</span>
                  <span className={progress >= 60 ? 'text-blue-600' : ''}>Extracting Data</span>
                  <span>→</span>
                  <span className={progress >= 90 ? 'text-blue-600' : ''}>Calculating XIRR</span>
                </div>
              </div>
            )}

            {uploadState === 'success' && (
              <div className="py-8 text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', bounce: 0.5 }}
                  className="w-16 h-16 mx-auto bg-emerald-100 rounded-full flex items-center justify-center"
                >
                  <CheckCircle className="h-8 w-8 text-emerald-600" />
                </motion.div>
                <h3 className="mt-4 font-semibold text-gray-900">Analysis Complete!</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Redirecting to your portfolio analysis...
                </p>
              </div>
            )}

            {uploadState === 'error' && (
              <div className="py-8 text-center">
                <div className="w-16 h-16 mx-auto bg-red-100 rounded-full flex items-center justify-center">
                  <AlertCircle className="h-8 w-8 text-red-600" />
                </div>
                <h3 className="mt-4 font-semibold text-gray-900">Processing Failed</h3>
                <p className="text-sm text-gray-500 mt-1">{error}</p>
                <Button variant="secondary" className="mt-4" onClick={resetUpload}>
                  Try Again
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Help Section */}
        <Card>
          <CardHeader>
            <CardTitle>How to get your statement</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h4 className="font-semibold text-gray-900">CAMS Statement</h4>
                <ol className="space-y-2 text-sm text-gray-600">
                  <li className="flex gap-2">
                    <span className="font-semibold text-blue-600">1.</span>
                    Visit www.camsonline.com
                  </li>
                  <li className="flex gap-2">
                    <span className="font-semibold text-blue-600">2.</span>
                    Click on "Investor Services"
                  </li>
                  <li className="flex gap-2">
                    <span className="font-semibold text-blue-600">3.</span>
                    Select "Mailback" → "Consolidated Account Statement"
                  </li>
                  <li className="flex gap-2">
                    <span className="font-semibold text-blue-600">4.</span>
                    Enter your email and PAN, submit OTP
                  </li>
                  <li className="flex gap-2">
                    <span className="font-semibold text-blue-600">5.</span>
                    Download the PDF from your email
                  </li>
                </ol>
              </div>
              <div className="space-y-3">
                <h4 className="font-semibold text-gray-900">KFintech Statement</h4>
                <ol className="space-y-2 text-sm text-gray-600">
                  <li className="flex gap-2">
                    <span className="font-semibold text-blue-600">1.</span>
                    Visit www.kfintech.com/mfs
                  </li>
                  <li className="flex gap-2">
                    <span className="font-semibold text-blue-600">2.</span>
                    Go to "Investor Services" → "Account Statement"
                  </li>
                  <li className="flex gap-2">
                    <span className="font-semibold text-blue-600">3.</span>
                    Select statement type and date range
                  </li>
                  <li className="flex gap-2">
                    <span className="font-semibold text-blue-600">4.</span>
                    Enter PAN and complete verification
                  </li>
                  <li className="flex gap-2">
                    <span className="font-semibold text-blue-600">5.</span>
                    Download the emailed PDF
                  </li>
                </ol>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

export default UploadPage;
