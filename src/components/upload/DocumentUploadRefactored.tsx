import { useState, useEffect } from 'react';
import { Upload, Loader2, CheckCircle, XCircle, FileText, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { FilePreview } from './FilePreview';
import { UploadProgress as UploadProgressComponent } from './UploadProgress';
import { useAuthStore } from '../../store/auth.store';
import { cn } from '../ui/utils';
import { documentUploadService, UploadProgress } from '../../services/DocumentUploadService';
import { checkStorageBucket, testStorageUpload } from '../../utils/storageCheck';

interface DocumentUploadProps {
  unitCode: string;
  validationDetailId?: number;
  onUploadComplete: (documentId: number, currentFile?: number, totalFiles?: number) => void;
  onFilesSelected?: (files: File[]) => void;
  triggerUpload?: boolean; // When true, starts upload
}

interface FileState {
  file: File;
  progress: UploadProgress;
  documentId?: number;
  operationId?: number;
}

/**
 * Refactored Document Upload Component
 * 
 * Uses the new DocumentUploadService for:
 * - Async file upload with proper progress tracking
 * - Gemini indexing with operation polling
 * - Clear separation of concerns
 * - No race conditions or timeouts
 */
export function DocumentUploadRefactored({ unitCode, validationDetailId, onUploadComplete, onFilesSelected, triggerUpload = false }: DocumentUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<FileState[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [storageHealthy, setStorageHealthy] = useState<boolean | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const { user, isLoading: isAuthLoading } = useAuthStore();

  // Notify parent when files change (separate from state update to avoid setState during render)
  useEffect(() => {
    if (files.length > 0 && onFilesSelected) {
      onFilesSelected(files.map(f => f.file));
    }
    // Note: onFilesSelected is intentionally NOT in deps array since it's memoized with useCallback in parent
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files]);

  // Check storage health AFTER auth is ready (to avoid timing issues on hard refresh)
  useEffect(() => {
    // Wait until auth is loaded before checking storage
    if (isAuthLoading) {
      console.log('[Upload] Waiting for auth to load before checking storage...');
      return;
    }

    const checkStorage = async () => {
      console.log('[Upload] Auth loaded, checking storage bucket health...');
      
      if (!user) {
        console.log('[Upload] No user yet, skipping storage check');
        return;
      }
      
      const result = await checkStorageBucket();

      if (!result.accessible) {
        setStorageHealthy(false);
        setStorageError(result.error || 'Storage bucket not accessible');
        console.warn('[Upload] Storage check failed (non-critical):', result);
        
        // Don't show error toast - the actual upload will fail if there's a real issue
        // This check is just informational
      } else {
        setStorageHealthy(true);
        console.log('[Upload] Storage bucket is healthy:', result.details);
      }
    };

    checkStorage();
  }, [isAuthLoading]);

  // Trigger upload when parent sets triggerUpload to true
  useEffect(() => {
    if (triggerUpload && files.length > 0 && !isUploading) {
      console.log('[Upload] Triggered by parent, starting upload...');
      handleUpload();
    }
  }, [triggerUpload]);

  const validateFile = (file: File): boolean => {
    const allowedTypes = ['application/pdf', 'text/plain'];
    const maxSize = 5 * 1024 * 1024; // 5MB per file

    if (!allowedTypes.includes(file.type)) {
      toast.error(`${file.name}: Only PDF and TXT files are allowed`);
      return false;
    }

    if (file.size > maxSize) {
      toast.error(`${file.name} is too large. Maximum size is 5MB per file.`);
      return false;
    }

    return true;
  };

  const validateTotalSize = (newFiles: File[]): boolean => {
    const maxTotalSize = 20 * 1024 * 1024; // 20MB total
    const currentTotalSize = files.reduce((sum, f) => sum + f.file.size, 0);
    const newFilesSize = newFiles.reduce((sum, f) => sum + f.size, 0);
    const totalSize = currentTotalSize + newFilesSize;

    if (totalSize > maxTotalSize) {
      const totalMB = (totalSize / (1024 * 1024)).toFixed(1);
      toast.error(`Total file size (${totalMB}MB) exceeds the 20MB limit`);
      return false;
    }

    return true;
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    const validFiles = droppedFiles.filter(validateFile);

    if (validFiles.length !== droppedFiles.length) {
      toast.error('Some files were rejected. Only PDF and TXT files are allowed.');
    }

    if (validFiles.length > 0 && !validateTotalSize(validFiles)) {
      return; // Total size check failed
    }

    const newFileStates: FileState[] = validFiles.map((file) => ({
      file,
      progress: {
        stage: 'ready',
        progress: 0,
        message: 'Ready to upload',
      },
    }));

    setFiles((prev) => [...prev, ...newFileStates]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const validFiles = selectedFiles.filter(validateFile);

    if (validFiles.length !== selectedFiles.length) {
      toast.error('Some files were rejected. Only PDF and TXT files are allowed.');
    }

    if (validFiles.length > 0 && !validateTotalSize(validFiles)) {
      return; // Total size check failed
    }

    const newFileStates: FileState[] = validFiles.map((file) => ({
      file,
      progress: {
        stage: 'ready',
        progress: 0,
        message: 'Ready to upload',
      },
    }));

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
        console.log(`[Upload] Processing file ${i + 1}/${files.length}:`, fileState.file.name);

        // Set initial uploading state
        setFiles((prev) =>
          prev.map((f, idx) =>
            idx === i
              ? {
                  ...f,
                  progress: {
                    stage: 'uploading',
                    progress: 5,
                    message: 'Preparing upload...',
                  },
                }
              : f
          )
        );

        try {
          console.log(`[Upload] About to call documentUploadService.uploadDocument`);
          console.log(`[Upload] Service object:`, documentUploadService);

          // Upload with progress tracking
          const result = await documentUploadService.uploadDocument(
            fileState.file,
            rtoCode,
            unitCode,
            'assessment',
            validationDetailId, // Links document to validation workflow
            (progress) => {
              console.log(`[Upload] Progress update for ${fileState.file.name}:`, progress);
              // Update file progress in state
              setFiles((prev) =>
                prev.map((f, idx) => (idx === i ? { ...f, progress } : f))
              );
            }
          ).catch((err) => {
            console.error('[Upload] ERROR in uploadDocument call:', err);
            throw err;
          });

          console.log(`[Upload] Upload complete for ${fileState.file.name}:`, result);

          // Update file state with result
          setFiles((prev) =>
            prev.map((f, idx) =>
              idx === i
                ? {
                    ...f,
                    documentId: result.documentId,
                    operationId: result.operationId,
                    progress: {
                      stage: 'completed',
                      progress: 100,
                      message: 'Upload complete',
                    },
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
                      stage: 'failed',
                      progress: 0,
                      message: errorMessage,
                      error: errorMessage,
                    },
                  }
                : f
            )
          );

          toast.error(`Failed to upload ${fileState.file.name}: ${errorMessage}`);
        }
      }

      // Clear successfully uploaded files
      setFiles((prev) => prev.filter((f) => f.progress.stage === 'failed'));
    } finally {
      setIsUploading(false);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const getProgressColor = (stage: string) => {
    switch (stage) {
      case 'completed':
        return 'bg-green-500';
      case 'failed':
        return 'bg-red-500';
      case 'indexing':
        return 'bg-blue-500';
      default:
        return 'bg-primary';
    }
  };

  const getProgressIcon = (stage: string) => {
    switch (stage) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'uploading':
      case 'indexing':
      case 'validating':
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'ready':
        return <FileText className="h-4 w-4 text-blue-500" />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {/* Storage Health Warning - Hidden since check is unreliable */}
      {/* Real storage issues will surface during actual upload */}
      {false && storageHealthy === false && (
        <div className="border-2 border-yellow-500 bg-yellow-50 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-semibold text-yellow-900 mb-1">Storage Issue Detected</h4>
              <p className="text-sm text-yellow-800 mb-2">{storageError}</p>
              <p className="text-xs text-yellow-700">
                Please ensure the 'documents' storage bucket exists in your Supabase project
                and has proper RLS policies configured.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={async () => {
                  const result = await testStorageUpload();
                  if (result.success) {
                    toast.success('Storage test upload successful!');
                    setStorageHealthy(true);
                    setStorageError(null);
                  } else {
                    toast.error(`Storage test failed: ${result.error}`);
                  }
                }}
              >
                Test Storage Upload
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Drop Zone */}
      <div
        className={cn(
          "border-2 border-dashed rounded-lg p-12 text-center transition-colors",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-primary/50"
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <h3 className="text-lg font-semibold mb-2">Drop your documents here</h3>
        <p className="text-muted-foreground mb-4">or click to browse</p>
        <input
          type="file"
          multiple
          accept=".pdf,.docx,.txt"
          onChange={handleFileSelect}
          className="hidden"
          id="file-input"
        />
        <Button
          variant="outline"
          onClick={() => document.getElementById('file-input')?.click()}
          disabled={isUploading}
        >
          Browse Files
        </Button>
        <p className="text-xs text-muted-foreground mt-4">
          Supported formats: PDF, TXT (max 5MB per file, 20MB total)
        </p>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-semibold">Selected Files ({files.length})</h4>
          {files.map((fileState, index) => {
            const { file, progress } = fileState;
            const isProcessing = ['uploading', 'indexing', 'validating'].includes(progress.stage);

            return (
              <div key={index} className="border rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {getProgressIcon(progress.stage)}
                    <span className="font-medium">{file.name}</span>
                    <span className="text-sm text-muted-foreground">
                      ({(file.size / 1024 / 1024).toFixed(2)} MB)
                    </span>
                  </div>
                  {!isProcessing && progress.stage !== 'completed' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(index)}
                      disabled={isUploading}
                    >
                      Remove
                    </Button>
                  )}
                </div>

                {/* Progress Bar */}
                {(isProcessing || progress.progress > 0) && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{progress.message}</span>
                      <span className="font-medium">{Math.floor(progress.progress)}%</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div
                        className={cn("h-2 rounded-full transition-all", getProgressColor(progress.stage))}
                        style={{ width: `${progress.progress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Error Message */}
                {progress.stage === 'failed' && progress.error && (
                  <p className="text-sm text-red-500">{progress.error}</p>
                )}

                {/* Success Message */}
                {progress.stage === 'completed' && (
                  <p className="text-sm text-green-500">
                    Document indexed and ready for validation
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Upload button removed - parent triggers upload via triggerUpload prop */}
    </div>
  );
}
