import { useState, useEffect, useRef } from 'react';
import { Upload, Loader2, CheckCircle, XCircle, FileText, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { useAuthStore } from '../../store/auth.store';
import { cn } from '../ui/utils';
import { documentUploadService, UploadProgress } from '../../services/DocumentUploadServiceSimplified';

interface DocumentUploadProps {
  unitCode: string;
  validationDetailId?: number;
  onUploadComplete: (documentId: number, fileName: string, storagePath: string) => void;
  onFilesSelected?: (files: File[]) => void;
  triggerUpload?: boolean;
}

interface FileState {
  file: File;
  progress: UploadProgress;
  documentId?: number;
}

/**
 * Simplified Document Upload Component
 * 
 * Instant Upload Flow:
 * 1. User selects files
 * 2. Files upload to storage (completes instantly)
 * 3. User can continue working immediately
 * 4. Background: Edge function creates document records
 * 5. Background: DB triggers handle indexing and validation
 * 6. Dashboard shows real-time status updates
 * 
 * Key: Upload completes BEFORE edge function call
 */
export function DocumentUploadSimplified({ 
  unitCode, 
  validationDetailId, 
  onUploadComplete, 
  onFilesSelected, 
  triggerUpload = false 
}: DocumentUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<FileState[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const { user } = useAuthStore();
  const hasNotifiedFilesRef = useRef(false);

  // Notify parent ONCE when files are initially selected (not on progress updates)
  useEffect(() => {
    if (files.length > 0 && onFilesSelected && !hasNotifiedFilesRef.current) {
      onFilesSelected(files.map(f => f.file));
      hasNotifiedFilesRef.current = true;
    }
  }, [files, onFilesSelected]);

  // Auto-upload when triggered
  useEffect(() => {
    if (triggerUpload && files.length > 0 && !isUploading) {
      handleUpload();
    }
  }, [triggerUpload]);

  const handleFileSelect = (selectedFiles: FileList | null) => {
    if (!selectedFiles || selectedFiles.length === 0) return;

    const newFiles: FileState[] = Array.from(selectedFiles).map(file => ({
      file,
      progress: {
        stage: 'pending',
        progress: 0,
        message: 'Ready to upload',
      },
    }));

    setFiles(prev => [...prev, ...newFiles]);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleUpload = async () => {
    if (!user?.rto_code) {
      toast.error('Please log in to upload documents');
      console.error('[DocumentUploadSimplified] Missing RTO code:', user);
      return;
    }

    if (files.length === 0) {
      toast.error('Please select files to upload');
      return;
    }

    console.log('[DocumentUploadSimplified] Starting upload with:', {
      rtoCode: user.rto_code,
      unitCode,
      fileCount: files.length,
    });

    setIsUploading(true);

    try {
      // Upload all files
      for (let i = 0; i < files.length; i++) {
        const fileState = files[i];
        
        console.log(`[DocumentUploadSimplified] Uploading file ${i + 1}/${files.length}:`, fileState.file.name);
        
        // Set to uploading stage
        setFiles(prev => {
          const updated = [...prev];
          updated[i] = { 
            ...updated[i], 
            progress: {
              stage: 'uploading',
              progress: 0,
              message: 'Uploading...',
            }
          };
          return updated;
        });
        
        try {
          const result = await documentUploadService.uploadDocument(
            fileState.file,
            user.rto_code,
            unitCode,
            'assessment',
            validationDetailId,
            (progress) => {
              setFiles(prev => {
                const updated = [...prev];
                updated[i] = { ...updated[i], progress };
                return updated;
              });
            }
          );

          // Upload complete! Processing continues in background
          setFiles(prev => {
            const updated = [...prev];
            updated[i] = { 
              ...updated[i], 
              progress: {
                stage: 'completed',
                progress: 100,
                message: 'Upload complete - processing in background',
              }
            };
            return updated;
          });

          // Notify parent with document details
          onUploadComplete(result.documentId, result.fileName, result.storagePath);

          toast.success(`${fileState.file.name} uploaded - processing in background`);

        } catch (error) {
          console.error('[Upload] Error uploading file:', error);
          
          setFiles(prev => {
            const updated = [...prev];
            updated[i] = {
              ...updated[i],
              progress: {
                stage: 'failed',
                progress: 0,
                message: error instanceof Error ? error.message : 'Upload failed',
                error: error instanceof Error ? error.message : 'Upload failed',
              }
            };
            return updated;
          });

          toast.error(`Failed to upload ${fileState.file.name}`);
        }
      }

      toast.success('All files uploaded - processing in background');
      
      // Reset notification flag for next upload batch
      hasNotifiedFilesRef.current = false;

    } finally {
      setIsUploading(false);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const clearAll = () => {
    setFiles([]);
    hasNotifiedFilesRef.current = false; // Reset so new uploads can trigger callback
  };

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center transition-colors',
          isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
        )}
      >
        <Upload className="mx-auto h-12 w-12 text-gray-400" />
        <p className="mt-2 text-sm text-gray-600">
          Drag and drop files here, or click to select
        </p>
        <input
          type="file"
          multiple
          accept=".pdf,.doc,.docx"
          onChange={(e) => handleFileSelect(e.target.files)}
          className="hidden"
          id="file-upload"
        />
        <label htmlFor="file-upload">
          <Button variant="outline" className="mt-4" asChild>
            <span>Select Files</span>
          </Button>
        </label>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-medium">Selected Files ({files.length})</h3>
            <Button variant="ghost" size="sm" onClick={clearAll} disabled={isUploading}>
              Clear All
            </Button>
          </div>

          {files.map((fileState, index) => (
            <div
              key={index}
              className="flex items-center gap-3 p-3 border rounded-lg"
            >
              <FileText className="h-5 w-5 text-gray-400" />
              
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{fileState.file.name}</p>
                <p className="text-xs text-gray-500">{fileState.progress.message}</p>
                
                {fileState.progress.stage === 'uploading' && (
                  <div className="mt-1 w-full bg-gray-200 rounded-full h-1.5">
                    <div
                      className="bg-blue-600 h-1.5 rounded-full transition-all"
                      style={{ width: `${fileState.progress.progress}%` }}
                    />
                  </div>
                )}
              </div>

              {fileState.progress.stage === 'pending' && <FileText className="h-5 w-5 text-gray-400" />}
              {fileState.progress.stage === 'uploading' && <Loader2 className="h-5 w-5 animate-spin text-blue-500" />}
              {fileState.progress.stage === 'completed' && <CheckCircle className="h-5 w-5 text-green-500" />}
              {fileState.progress.stage === 'failed' && <XCircle className="h-5 w-5 text-red-500" />}

              {!isUploading && fileState.progress.stage === 'pending' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeFile(index)}
                >
                  Remove
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upload Button */}
      {files.length > 0 && !triggerUpload && (
        <Button
          onClick={handleUpload}
          disabled={isUploading}
          className="w-full"
        >
          {isUploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Upload {files.length} {files.length === 1 ? 'File' : 'Files'}
            </>
          )}
        </Button>
      )}

      {/* Info Message */}
      {files.some(f => f.progress.stage === 'completed') && (
        <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <AlertTriangle className="h-5 w-5 text-blue-600 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium">Files uploaded successfully!</p>
            <p className="mt-1">
              Indexing and validation are running in the background. 
              Check the Dashboard for status updates.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
