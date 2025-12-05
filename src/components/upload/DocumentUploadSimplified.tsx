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
  onUploadComplete: (fileName: string, storagePath: string) => void;
  onFilesSelected?: (files: File[]) => void;
  onUploadStart?: () => Promise<void>; // New callback fired when Upload button is clicked
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
 * 2. User clicks "Upload Files" → Files upload to Supabase Storage ONLY
 * 3. User types "validate" → Parent triggers n8n with validation_detail_id + storage_paths
 * 4. n8n workflow creates document records, uploads to Gemini, and validates
 * 5. Dashboard shows real-time status updates
 * 
 * Key: n8n creates document records from storage paths
 */
export function DocumentUploadSimplified({ 
  unitCode, 
  validationDetailId, 
  onUploadComplete, 
  onFilesSelected,
  onUploadStart,
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

    // Always append files when user is actively selecting them
    // The clearFilesOnNewValidation logic only applies when validationDetailId changes
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

    // Call onUploadStart callback to create validation record BEFORE uploading
    if (onUploadStart) {
      console.log('[DocumentUploadSimplified] Calling onUploadStart to create validation...');
      try {
        await onUploadStart();
        console.log('[DocumentUploadSimplified] Validation record created, proceeding with upload');
      } catch (error) {
        console.error('[DocumentUploadSimplified] Failed to create validation:', error);
        toast.error('Failed to create validation record');
        return;
      }
    }

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

          // Upload complete! Save storage path
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

          // Notify parent with storage path (n8n will create document record)
          onUploadComplete(result.fileName, result.storagePath);

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
    <div className="space-y-6">
      {/* Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'relative border-2 border-dashed rounded-xl p-12 text-center transition-all duration-300',
          isDragging 
            ? 'border-[#3b82f6] bg-[#dbeafe] scale-[1.02]' 
            : 'border-[#cbd5e1] hover:border-[#94a3b8] hover:bg-[#f8fafc]'
        )}
      >
        <div className={cn(
          "mx-auto h-16 w-16 rounded-full flex items-center justify-center mb-4 transition-all duration-300",
          isDragging ? 'bg-[#3b82f6] scale-110' : 'bg-[#f1f5f9]'
        )}>
          <Upload className={cn(
            "h-8 w-8 transition-all duration-300",
            isDragging ? 'text-white' : 'text-[#64748b]'
          )} />
        </div>
        <p className="text-base font-medium text-[#1e293b] mb-2">
          {isDragging ? 'Drop files here' : 'Drag and drop files here'}
        </p>
        <p className="text-sm text-[#64748b] mb-4">
          or click to browse your files
        </p>
        <input
          type="file"
          multiple
          accept=".pdf,.txt"
          onChange={(e) => handleFileSelect(e.target.files)}
          className="hidden"
          id="file-upload"
        />
        <label htmlFor="file-upload">
          <Button 
            variant="outline" 
            className="border-[#cbd5e1] hover:border-[#3b82f6] hover:bg-[#f8fafc] transition-all" 
            asChild
          >
            <span>Select Files</span>
          </Button>
        </label>
        <p className="text-xs text-[#94a3b8] mt-3">
          Supported formats: PDF, TXT
        </p>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-3">
          <div className="flex justify-between items-center px-1">
            <h3 className="text-sm font-semibold text-[#1e293b]">
              Selected Files <span className="text-[#64748b] font-normal">({files.length})</span>
            </h3>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={clearAll} 
              disabled={isUploading}
              className="text-[#64748b] hover:text-[#ef4444] hover:bg-[#fef2f2]"
            >
              Clear All
            </Button>
          </div>

          <div className="space-y-2">
            {files.filter(f => f?.file).map((fileState, index) => (
              <div
                key={index}
                className={cn(
                  "flex items-center gap-4 p-4 rounded-xl border transition-all duration-200",
                  fileState.progress.stage === 'completed' 
                    ? 'border-[#22c55e] bg-[#f0fdf4]' 
                    : fileState.progress.stage === 'failed'
                    ? 'border-[#ef4444] bg-[#fef2f2]'
                    : fileState.progress.stage === 'uploading'
                    ? 'border-[#3b82f6] bg-[#f8fafc]'
                    : 'border-[#e2e8f0] bg-white hover:border-[#cbd5e1] hover:shadow-sm'
                )}
              >
                <div className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                  fileState.progress.stage === 'completed' 
                    ? 'bg-[#dcfce7]' 
                    : fileState.progress.stage === 'failed'
                    ? 'bg-[#fee2e2]'
                    : 'bg-[#f1f5f9]'
                )}>
                  <FileText className={cn(
                    "h-5 w-5",
                    fileState.progress.stage === 'completed' 
                      ? 'text-[#22c55e]' 
                      : fileState.progress.stage === 'failed'
                      ? 'text-[#ef4444]'
                      : 'text-[#64748b]'
                  )} />
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#1e293b] truncate">
                    {fileState.file?.name || 'Unknown file'}
                  </p>
                  <p className={cn(
                    "text-xs mt-0.5",
                    fileState.progress.stage === 'completed' 
                      ? 'text-[#22c55e]'
                      : fileState.progress.stage === 'failed'
                      ? 'text-[#ef4444]'
                      : 'text-[#64748b]'
                  )}>
                    {fileState.progress?.message || 'Pending'}
                  </p>
                  
                  {fileState.progress.stage === 'uploading' && (
                    <div className="mt-2 w-full bg-[#e2e8f0] rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-[#3b82f6] h-2 rounded-full transition-all duration-300"
                        style={{ width: `${fileState.progress.progress}%` }}
                      />
                    </div>
                  )}
                </div>

                <div className="flex-shrink-0">
                  {fileState.progress.stage === 'pending' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(index)}
                      className="text-[#64748b] hover:text-[#ef4444] hover:bg-[#fef2f2]"
                      disabled={isUploading}
                    >
                      Remove
                    </Button>
                  )}
                  {fileState.progress.stage === 'uploading' && <Loader2 className="h-5 w-5 animate-spin text-[#3b82f6]" />}
                  {fileState.progress.stage === 'completed' && <CheckCircle className="h-5 w-5 text-[#22c55e]" />}
                  {fileState.progress.stage === 'failed' && <XCircle className="h-5 w-5 text-[#ef4444]" />}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upload Button */}
      {files.length > 0 && !triggerUpload && (
        <Button
          onClick={handleUpload}
          disabled={isUploading}
          size="lg"
          className="w-full bg-[#3b82f6] hover:bg-[#2563eb] text-white font-semibold h-14 text-base shadow-md hover:shadow-lg transition-all flex items-center justify-center"
        >
          {isUploading ? (
            <>
              <Loader2 className="mr-3 h-5 w-5 animate-spin" />
              Uploading {files.length} {files.length === 1 ? 'File' : 'Files'}...
            </>
          ) : (
            <>
              <Upload className="mr-3 h-5 w-5" />
              Upload {files.length} {files.length === 1 ? 'File' : 'Files'}
            </>
          )}
        </Button>
      )}

    </div>
  );
}
