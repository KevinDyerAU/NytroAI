import { useState } from 'react';
import { Upload, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { FilePreview } from './FilePreview';
import { UploadProgress } from './UploadProgress';
import { useFileUpload } from '../../hooks/useFileUpload';
import { useAuthStore } from '../../store/auth.store';
import { supabase } from '../../lib/supabase';
import { cn } from '../ui/utils';
import { validateAssessmentV2, validateValidationRequest } from '../../services/ValidationService_v2';

interface DocumentUploadProps {
  unitCode: string;
  onUploadComplete: (validationId: number) => void;
}

export function DocumentUpload({ unitCode, onUploadComplete }: DocumentUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState<Map<string, number>>(new Map());
  const { user } = useAuthStore();
  const { uploadFile, isUploading } = useFileUpload();

  const validateFile = (file: File): boolean => {
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
    ];
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (!allowedTypes.includes(file.type)) {
      return false;
    }

    if (file.size > maxSize) {
      toast.error(`${file.name} is too large. Maximum size is 10MB.`);
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
      toast.error('Some files were rejected. Only PDF, DOCX, and TXT files are allowed.');
    }

    setFiles((prev) => [...prev, ...validFiles]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const validFiles = selectedFiles.filter(validateFile);

    if (validFiles.length !== selectedFiles.length) {
      toast.error('Some files were rejected. Only PDF, DOCX, and TXT files are allowed.');
    }

    setFiles((prev) => [...prev, ...validFiles]);
  };

  const createDocumentRecord = async (
    userId: string,
    rtoCode: string,
    unitCode: string,
    fileName: string,
    filePath: string,
    publicUrl: string
  ) => {
    const { data, error } = await supabase
      .from('validation_detail')
      .insert({
        namespace_code: `${rtoCode}-${unitCode}-${Date.now()}`,
        docExtracted: false,
        extractStatus: 'pending',
      })
      .select()
      .single();

    if (error) throw error;

    return data;
  };

  const handleUpload = async () => {
    if (files.length === 0 || !user) return;

    const rtoCode = user.rto_code || 'default';

    try {
      for (const file of files) {
        const fileName = file.name;
        setUploadingFiles((prev) => new Map(prev).set(fileName, 0));

        // Upload to Supabase Storage
        const { filePath, publicUrl } = await uploadFile(file, user.id, rtoCode);

        setUploadingFiles((prev) => new Map(prev).set(fileName, 50));

        // Create document record
        const document = await createDocumentRecord(
          user.id,
          rtoCode,
          unitCode,
          file.name,
          filePath,
          publicUrl
        );

        setUploadingFiles((prev) => new Map(prev).set(fileName, 75));

        // Trigger validation using new v2 service with robust error handling
        const validationRequest = {
          documentId: document.id,
          unitCode: unitCode,
          options: {
            includeSmartQuestions: true,
            difficultyLevel: 'intermediate',
            enableRegeneration: true
          }
        };

        // Validate request parameters
        const requestValidation = validateValidationRequest(validationRequest);
        if (!requestValidation.isValid) {
          throw new Error(requestValidation.error);
        }

        const validationResponse = await validateAssessmentV2(validationRequest);
        if (!validationResponse.success) {
          throw new Error(validationResponse.message);
        }

        setUploadingFiles((prev) => new Map(prev).set(fileName, 100));

        toast.success(`${file.name} uploaded successfully!`);
        onUploadComplete(document.id);
      }

      setFiles([]);
      setUploadingFiles(new Map());
    } catch (error) {
      toast.error('Upload failed. Please try again.');
      console.error(error);
      setUploadingFiles(new Map());
    }
  };

  return (
    <div className="space-y-4">
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
        >
          Browse Files
        </Button>
        <p className="text-xs text-muted-foreground mt-4">
          Supported formats: PDF, DOCX, TXT (max 10MB)
        </p>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-semibold">Selected Files ({files.length})</h4>
          {files.map((file, index) => {
            const uploadProgress = uploadingFiles.get(file.name);
            return uploadProgress !== undefined ? (
              <UploadProgress
                key={index}
                fileName={file.name}
                progress={uploadProgress}
                isUploading={uploadProgress < 100}
              />
            ) : (
              <FilePreview
                key={index}
                file={file}
                onRemove={() => setFiles(files.filter((_, i) => i !== index))}
              />
            );
          })}
        </div>
      )}

      {/* Upload Button */}
      {files.length > 0 && (
        <Button onClick={handleUpload} disabled={isUploading} className="w-full">
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
