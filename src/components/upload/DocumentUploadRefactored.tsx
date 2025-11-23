import React, { useState, useEffect, useCallback } from 'react';
import { Upload, Loader2, CheckCircle, XCircle, FileText, AlertTriangle, X, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { FilePreview } from './FilePreview';
import { UploadProgress as UploadProgressComponent } from './UploadProgress';
import { useAuthStore } from '../../store/auth.store';
import { cn } from '../ui/utils';
import { documentUploadServiceV2, UploadProgress } from '../../services/DocumentUploadService';
import { uploadCancellationManager } from '../../lib/uploadCancellation';
import { validateFile as validateFileAdvanced, validateBatch, formatFileSize } from '../../lib/fileValidation';
import { checkStorageBucket } from '../../utils/storageCheck';

interface DocumentUploadProps {
  unitCode: string;
  validationDetailId?: number;
  onUploadComplete: (documentId: number, currentFile?: number, totalFiles?: number) => void;
  onFilesSelected?: (files: File[]) => void;
  triggerUpload?: boolean;
}

interface FileState {
  file: File;
  progress: UploadProgress;
  documentId?: number;
  operationId?: string;
  hash?: string;
  canRetry?: boolean;
}

/**
 * Enhanced Document Upload Component (v2)
 * 
 * Phase 3.5 Features:
 * - Upload cancellation with AbortController
 * - Retry button for failed uploads
 * - Automatic retry with exponential backoff
 * - Better error messages with actions
 * - Adaptive polling (fast → slow)
 * - Advanced file validation
 * - Duplicate detection
 */
export function DocumentUploadRefactored({ 
  unitCode, 
  validationDetailId, 
  onUploadComplete, 
  onFilesSelected, 
  triggerUpload = false 
}: DocumentUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<FileState[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [storageHealthy, setStorageHealthy] = useState<boolean | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const { user, isLoading: isAuthLoading } = useAuthStore();

  // Notify parent when files change
  useEffect(() => {
    if (files.length > 0 && onFilesSelected) {
      onFilesSelected(files.map(f => f.file));
    }
  }, [files, onFilesSelected]);

  // Check storage health
  useEffect(() => {
    if (isAuthLoading) {
      return;
    }

    const checkStorage = async () => {
      if (!user) {
        return;
      }
      
      const result = await checkStorageBucket();

      if (!result.accessible) {
        setStorageHealthy(false);
        setStorageError(result.error || 'Storage bucket not accessible');
        console.warn('[Upload] Storage check failed (non-critical):', result);
      } else {
        setStorageHealthy(true);
        console.log('[Upload] Storage bucket is healthy:', result.details);
      }
    };

    checkStorage();
  }, [isAuthLoading, user]);

  // Trigger upload when parent sets triggerUpload to true
  useEffect(() => {
    if (triggerUpload && files.length > 0 && !isUploading) {
      console.log('[Upload] Triggered by parent, starting upload...');
      handleUpload();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerUpload]);

  // Cleanup on unmount - cancel all uploads
  useEffect(() => {
    return () => {
      const count = uploadCancellationManager.cancelAll();
      if (count > 0) {
        console.log(`[Upload] Cancelled ${count} uploads on unmount`);
      }
    };
  }, []);

  const validateFileBasic = (file: File): boolean => {
    const allowedTypes = ['application/pdf', 'text/plain'];
    const maxSize = 10 * 1024 * 1024; // 10MB per file (increased from 5MB)

    if (!allowedTypes.includes(file.type)) {
      toast.error(`${file.name}: Only PDF and TXT files are allowed`);
      return false;
    }

    if (file.size > maxSize) {
      toast.error(`${file.name}: File size exceeds ${formatFileSize(maxSize)} limit`);
      return false;
    }

    if (file.size === 0) {
      toast.error(`${file.name}: File is empty`);
      return false;
    }

    return true;
  };

  const validateTotalSize = (newFiles: File[]): boolean => {
    const totalSize = [...files.map(f => f.file), ...newFiles].reduce((sum, f) => sum + f.size, 0);
    const maxTotalSize = 50 * 1024 * 1024; // 50MB total

    if (totalSize > maxTotalSize) {
      toast.error(`Total file size exceeds ${formatFileSize(maxTotalSize)} limit`);
      return false;
    }

    return true;
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    await processFiles(droppedFiles);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    await processFiles(selectedFiles);
  };

  const processFiles = async (selectedFiles: File[]) => {
    // Basic validation
    const validFiles = selectedFiles.filter(validateFileBasic);

    if (validFiles.length !== selectedFiles.length) {
      toast.error('Some files were rejected. Check file type and size.');
    }

    if (validFiles.length === 0) {
      return;
    }

    if (!validateTotalSize(validFiles)) {
      return;
    }

    // Advanced validation with duplicate detection
    const batchValidation = await validateBatch(validFiles);

    if (!batchValidation.valid) {
      toast.error('Some files failed validation. Check the console for details.');
      console.error('[Upload] Batch validation failed:', batchValidation);
      return;
    }

    // Warn about duplicates (but allow upload)
    if (batchValidation.duplicates.length > 0) {
      toast.warning(`Duplicate files detected: ${batchValidation.duplicates.join(', ')}`);
    }

    // Create file states
    const newFileStates: FileState[] = validFiles.map((file) => {
      const validation = batchValidation.results.get(file.name);
      return {
        file,
        progress: {
          stage: 'validating',
          progress: 0,
          message: 'Ready to upload',
          cancellable: false,
        },
        hash: validation?.metadata?.hash,
        canRetry: false,
      };
    });

    setFiles((prev) => [...prev, ...newFileStates]);
  };

  const handleUpload = async () => {
    if (files.length === 0 || !user) return;

    const rtoCode = user.rto_code || 'default';
    console.log('[Upload] Starting upload process for', files.length, 'files');
    console.log('[Upload] RTO Code:', rtoCode, 'Unit Code:', unitCode);
    setIsUploading(true);

    try {
      for (let i = 0; i < files.length; i++) {
        const fileState = files[i];
        
        // Skip already completed files
        if (fileState.progress.stage === 'completed') {
          continue;
        }

        console.log(`[Upload] Processing file ${i + 1}/${files.length}:`, fileState.file.name);

        const operationId = `upload-${Date.now()}-${i}`;

        // Update file state with operation ID
        setFiles((prev) =>
          prev.map((f, idx) =>
            idx === i
              ? {
                  ...f,
                  operationId,
                  canRetry: false,
                }
              : f
          )
        );

        try {
          // Upload with v2 service (includes all Phase 3.5 features)
          const result = await documentUploadServiceV2.uploadDocument(
            fileState.file,
            rtoCode,
            unitCode,
            'assessment',
            validationDetailId,
            (progress) => {
              console.log(`[Upload] Progress update for ${fileState.file.name}:`, progress);
              
              // Update file progress in state
              setFiles((prev) =>
                prev.map((f, idx) => 
                  idx === i 
                    ? { 
                        ...f, 
                        progress,
                        canRetry: progress.stage === 'failed',
                      } 
                    : f
                )
              );
            },
            {
              enableRetry: true,
              showToasts: false, // We handle toasts ourselves
              validateBeforeUpload: true,
              checkDuplicates: true,
              adaptivePolling: true,
            }
          );

          console.log(`[Upload] Upload complete for ${fileState.file.name}:`, result);

          // Update file state with result
          setFiles((prev) =>
            prev.map((f, idx) =>
              idx === i
                ? {
                    ...f,
                    documentId: result.documentId,
                    operationId: result.operationId.toString(),
                    hash: result.hash,
                    progress: {
                      stage: 'completed',
                      progress: 100,
                      message: 'Upload complete',
                      cancellable: false,
                    },
                    canRetry: false,
                  }
                : f
            )
          );

          toast.success(`${fileState.file.name} uploaded successfully!`);
          
          // Pass document ID, current index, and total count
          onUploadComplete(result.documentId, i + 1, files.length);
        } catch (error) {
          console.error(`Error uploading ${fileState.file.name}:`, error);

          let errorMessage = error instanceof Error ? error.message : 'Upload failed';
          const isCancelled = errorMessage.includes('cancelled') || errorMessage.includes('abort');

          // Provide more helpful error message for edge function issues
          if (errorMessage.includes('Failed to send a request to the Edge Function') ||
              errorMessage.includes('Edge function not responding')) {
            errorMessage = 'Upload service unavailable. The edge function may need to be deployed. Please contact your administrator.';
          }

          setFiles((prev) =>
            prev.map((f, idx) =>
              idx === i
                ? {
                    ...f,
                    progress: {
                      stage: isCancelled ? 'cancelled' : 'failed',
                      progress: 0,
                      message: errorMessage,
                      error: errorMessage,
                      cancellable: false,
                    },
                    canRetry: !isCancelled, // Can retry if not cancelled
                  }
                : f
            )
          );

          if (!isCancelled) {
            toast.error(`Failed to upload ${fileState.file.name}: ${errorMessage}`);
          } else {
            toast.info(`Upload cancelled: ${fileState.file.name}`);
          }
        }
      }

      // Clear successfully uploaded files
      setFiles((prev) => prev.filter((f) => f.progress.stage !== 'completed'));
    } finally {
      setIsUploading(false);
    }
  };

  const removeFile = (index: number) => {
    const fileState = files[index];
    
    // Cancel upload if in progress
    if (fileState.operationId && fileState.progress.cancellable) {
      uploadCancellationManager.cancel(fileState.operationId);
    }

    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const cancelUpload = (index: number) => {
    const fileState = files[index];
    
    if (fileState.operationId) {
      const cancelled = uploadCancellationManager.cancel(fileState.operationId);
      
      if (cancelled) {
        toast.info(`Cancelling upload: ${fileState.file.name}`);
        
        // Update state to show cancelled
        setFiles((prev) =>
          prev.map((f, idx) =>
            idx === index
              ? {
                  ...f,
                  progress: {
                    stage: 'cancelled',
                    progress: 0,
                    message: 'Upload cancelled',
                    cancellable: false,
                  },
                  canRetry: true,
                }
              : f
          )
        );
      }
    }
  };

  const retryUpload = async (index: number) => {
    const fileState = files[index];
    
    if (!user) return;

    const rtoCode = user.rto_code || 'default';
    const operationId = `upload-retry-${Date.now()}-${index}`;

    console.log(`[Upload] Retrying upload for ${fileState.file.name}`);

    // Update state to show retrying
    setFiles((prev) =>
      prev.map((f, idx) =>
        idx === index
          ? {
              ...f,
              operationId,
              progress: {
                stage: 'uploading',
                progress: 0,
                message: 'Retrying upload...',
                cancellable: true,
              },
              canRetry: false,
            }
          : f
      )
    );

    try {
      const result = await documentUploadServiceV2.uploadDocument(
        fileState.file,
        rtoCode,
        unitCode,
        'assessment',
        validationDetailId,
        (progress) => {
          setFiles((prev) =>
            prev.map((f, idx) => 
              idx === index 
                ? { 
                    ...f, 
                    progress,
                    canRetry: progress.stage === 'failed',
                  } 
                : f
            )
          );
        },
        {
          enableRetry: true,
          showToasts: false,
          validateBeforeUpload: true,
          checkDuplicates: true,
          adaptivePolling: true,
        }
      );

      // Update file state with result
      setFiles((prev) =>
        prev.map((f, idx) =>
          idx === index
            ? {
                ...f,
                documentId: result.documentId,
                operationId: result.operationId.toString(),
                hash: result.hash,
                progress: {
                  stage: 'completed',
                  progress: 100,
                  message: 'Upload complete',
                  cancellable: false,
                },
                canRetry: false,
              }
            : f
        )
      );

      toast.success(`${fileState.file.name} uploaded successfully!`);
      onUploadComplete(result.documentId, index + 1, files.length);

      // Remove from list after successful retry
      setTimeout(() => {
        setFiles((prev) => prev.filter((_, i) => i !== index));
      }, 2000);
    } catch (error) {
      console.error(`Error retrying upload for ${fileState.file.name}:`, error);

      let errorMessage = error instanceof Error ? error.message : 'Upload failed';
      const isCancelled = errorMessage.includes('cancelled') || errorMessage.includes('abort');

      setFiles((prev) =>
        prev.map((f, idx) =>
          idx === index
            ? {
                ...f,
                progress: {
                  stage: isCancelled ? 'cancelled' : 'failed',
                  progress: 0,
                  message: errorMessage,
                  error: errorMessage,
                  cancellable: false,
                },
                canRetry: !isCancelled,
              }
            : f
        )
      );

      if (!isCancelled) {
        toast.error(`Failed to retry ${fileState.file.name}: ${errorMessage}`);
      }
    }
  };

  const getProgressColor = (stage: string) => {
    switch (stage) {
      case 'completed':
        return 'bg-green-500';
      case 'failed':
      case 'cancelled':
        return 'bg-red-500';
      case 'uploading':
      case 'indexing':
        return 'bg-blue-500';
      case 'validating':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getProgressIcon = (stage: string) => {
    switch (stage) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'cancelled':
        return <X className="h-5 w-5 text-orange-500" />;
      case 'uploading':
      case 'indexing':
      case 'validating':
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
      default:
        return <FileText className="h-5 w-5 text-gray-500" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Storage Health Warning */}
      {storageHealthy === false && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-yellow-800">Storage Warning</h3>
              <p className="text-sm text-yellow-700 mt-1">
                {storageError || 'Storage bucket may not be accessible. Uploads might fail.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Upload Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center transition-colors',
          isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400',
          isUploading && 'opacity-50 pointer-events-none'
        )}
      >
        <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
        <p className="text-sm text-gray-600 mb-2">
          Drag and drop files here, or click to browse
        </p>
        <p className="text-xs text-gray-500 mb-4">
          Supports PDF and TXT files (max {formatFileSize(10 * 1024 * 1024)} per file, {formatFileSize(50 * 1024 * 1024)} total)
        </p>
        <input
          type="file"
          multiple
          accept=".pdf,.txt,application/pdf,text/plain"
          onChange={handleFileSelect}
          className="hidden"
          id="file-upload"
          disabled={isUploading}
        />
        <label htmlFor="file-upload">
          <Button variant="outline" disabled={isUploading} asChild>
            <span>Browse Files</span>
          </Button>
        </label>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-700">
            Selected Files ({files.length})
          </h3>
          {files.map((fileState, index) => (
            <div
              key={`${fileState.file.name}-${index}`}
              className="border border-gray-200 rounded-lg p-4 bg-white"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1">
                  {getProgressIcon(fileState.progress.stage)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {fileState.file.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(fileState.file.size)}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      {fileState.progress.message}
                    </p>
                    {fileState.progress.error && (
                      <p className="text-xs text-red-600 mt-1">
                        {fileState.progress.error}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Cancel Button */}
                  {fileState.progress.cancellable && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => cancelUpload(index)}
                      className="text-orange-600 hover:text-orange-700"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Cancel
                    </Button>
                  )}

                  {/* Retry Button */}
                  {fileState.canRetry && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => retryUpload(index)}
                      className="text-blue-600 hover:text-blue-700"
                    >
                      <RotateCcw className="h-4 w-4 mr-1" />
                      Retry
                    </Button>
                  )}

                  {/* Remove Button */}
                  {!fileState.progress.cancellable && !isUploading && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(index)}
                      className="text-gray-600 hover:text-gray-700"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Progress Bar */}
              {fileState.progress.stage !== 'completed' && 
               fileState.progress.stage !== 'failed' &&
               fileState.progress.stage !== 'cancelled' && (
                <div className="mt-3">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={cn('h-2 rounded-full transition-all', getProgressColor(fileState.progress.stage))}
                      style={{ width: `${fileState.progress.progress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
