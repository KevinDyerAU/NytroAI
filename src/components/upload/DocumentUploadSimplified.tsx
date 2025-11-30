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
  clearFilesOnNewValidation?: boolean;
}

interface FileState {
  file: File;
  progress: UploadProgress;
  storagePath?: string;
}

/**
 * Simplified Document Upload Component
 * 
 * Upload Flow:
 * 1. User selects files
 * 2. User clicks "Upload Files" → Files upload to storage + DB records created
 * 3. User types "validate" → Parent triggers n8n with validation_detail_id + storage_paths
 * 4. n8n uploads files to Gemini and validates
 * 5. Dashboard shows real-time status updates
 * 
 * Key: Document records exist in DB BEFORE n8n call
 */
export function DocumentUploadSimplified({ 
  unitCode, 
  validationDetailId, 
  onUploadComplete, 
  onFilesSelected, 
  triggerUpload = false,
  clearFilesOnNewValidation = false
}: DocumentUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<FileState[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const { user } = useAuthStore();
  const hasNotifiedFilesRef = useRef(false);
  const previousValidationIdRef = useRef<number | undefined>(undefined);

  // Notify parent ONCE when files are initially selected (not on progress updates)
  useEffect(() => {
    if (files.length > 0 && onFilesSelected && !hasNotifiedFilesRef.current) {
      const validFiles = files.filter(f => f?.file).map(f => f.file);
      if (validFiles.length > 0) {
        onFilesSelected(validFiles);
        hasNotifiedFilesRef.current = true;
      }
    }
  }, [files, onFilesSelected]);

  // Clear files when validationDetailId CHANGES (not when first set)
  useEffect(() => {
    if (clearFilesOnNewValidation && validationDetailId !== undefined) {
      const previousValidationId = previousValidationIdRef.current;
      
      // Only clear if validation ID actually changed (not first time being set)
      const isValidationIdChange = previousValidationId !== undefined && previousValidationId !== validationDetailId;
      
      console.log('[DocumentUploadSimplified] 🔍 Validation ID check:', {
        previousValidationId,
        currentValidationId: validationDetailId,
        isValidationIdChange,
        filesLength: files.length,
        isUploading
      });
      
      if (isValidationIdChange && !isUploading) {
        console.log('[DocumentUploadSimplified] 🧹 Validation ID changed, clearing old files');
        setFiles([]);
        hasNotifiedFilesRef.current = false;
      } else if (isValidationIdChange && isUploading) {
        console.log('[DocumentUploadSimplified] ⏸️ Upload in progress, delaying file clear');
      }
      
      // Update ref for next comparison
      previousValidationIdRef.current = validationDetailId;
    }
  }, [validationDetailId, clearFilesOnNewValidation, isUploading]);

  // Auto-upload when triggered (should NOT fire in manual mode)
  useEffect(() => {
    console.log('[DocumentUploadSimplified] 🔍 Auto-upload check:', {
      triggerUpload,
      filesLength: files.length,
      isUploading,
      willAutoUpload: triggerUpload && files.length > 0 && !isUploading
    });
    
    if (triggerUpload && files.length > 0 && !isUploading) {
      console.log('[DocumentUploadSimplified] ⚠️ AUTO-UPLOADING (should not happen in manual mode!)');
      handleUpload();
    }
  }, [triggerUpload, files.length, isUploading]);

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

    // Replace files instead of appending if clearFilesOnNewValidation is true
    if (clearFilesOnNewValidation) {
      setFiles(newFiles);
      hasNotifiedFilesRef.current = false;
    } else {
      setFiles(prev => [...prev, ...newFiles]);
    }
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
        
        // Skip if file is undefined (can happen if files are cleared during upload)
        if (!fileState?.file) {
          console.warn(`[DocumentUploadSimplified] Skipping undefined file at index ${i}`);
          continue;
        }
        
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

          // Upload complete! Save storage path and documentId
          setFiles(prev => {
            const updated = [...prev];
            updated[i] = { 
              ...updated[i],
              storagePath: result.storagePath,
              progress: {
                stage: 'completed',
                progress: 100,
                message: 'Upload complete',
              }
            };
            return updated;
          });

          // Notify parent with document details
          onUploadComplete(result.documentId, result.fileName, result.storagePath);

          toast.success(`${fileState.file.name} uploaded successfully`);

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

      console.log('[Upload] All files uploaded and documents created. Parent will trigger n8n.');
      toast.success('All files uploaded successfully');
      
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

          {files.filter(f => f?.file).map((fileState, index) => (
            <div
              key={index}
              className="flex items-center gap-3 p-3 border rounded-lg"
            >
              <FileText className="h-5 w-5 text-gray-400" />
              
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{fileState.file?.name || 'Unknown file'}</p>
                <p className="text-xs text-gray-500">{fileState.progress?.message || 'Pending'}</p>
                
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

    </div>
  );
}
