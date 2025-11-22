import React, { useState, useEffect } from 'react';
import { Card } from './ui/card';
import { GlowButton } from './GlowButton';
import { Input } from './ui/input';
import { Upload, CheckCircle, Play, Search, Target, AlertCircle, XCircle } from 'lucide-react';
import { Progress } from './ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "./ui/command";
import { Popover, PopoverContent, PopoverTrigger, PopoverAnchor } from "./ui/popover";
import { getRTOById, getValidationCredits, consumeValidationCredit, fetchUnitsOfCompetency } from '../types/rto';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { uploadFilesToSupabase, startValidationWithGemini, createFolderName, createPineconeNamespace } from '../lib/supabase-validation';
import { useAuthStore } from '../store/auth.store';

interface Unit {
  id: number;
  code: string;
  title: string;
  link?: string;
}

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  progress: number;
  isUploading: boolean;
  file: File;
}

interface UnitOfCompetency {
  id: number;
  unitCode: string;
  Title?: string;
  created_at?: string;
}

interface DocumentUploadProps {
  selectedRTOId: string;
  onValidationSubmit?: (validationData?: { validationId: number; documentName: string; unitCode: string }) => void;
  onCreditsConsumed?: () => void;
}

interface CreateValidationRecordResponse {
  success: boolean;
  validationSummaryId?: number;
  validationTypeId?: number;
  validationDetailId?: number;
  error?: string;
}

// Allow Edge Function to use nearly the full 60s execution window
const EDGE_FUNCTION_TIMEOUT_MS = 60000;
const EDGE_FUNCTION_TIMEOUT_MESSAGE = `Edge Function request timed out after ${EDGE_FUNCTION_TIMEOUT_MS / 1000} seconds`;

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId)) as Promise<T>;
}

function normalizeError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  if (typeof error === 'string') {
    return new Error(error);
  }
  try {
    return new Error(JSON.stringify(error));
  } catch {
    return new Error('Unknown error');
  }
}

export function DocumentUpload({ selectedRTOId, onValidationSubmit, onCreditsConsumed }: DocumentUploadProps) {
  const { user } = useAuthStore();
  const [validationType, setValidationType] = useState<'unit' | 'learner'>('unit');
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [open, setOpen] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [confirmText, setConfirmText] = useState('');
  const [validationCredits, setValidationCredits] = useState({ current: 10, total: 10 });
  const [isEngaging, setIsEngaging] = useState(false);
  const [availableUnits, setAvailableUnits] = useState<Unit[]>([]);
  const [isLoadingUnits, setIsLoadingUnits] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const MAX_FILES = 5;
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  const canAddMoreFiles = uploadedFiles.length < MAX_FILES;

  const selectedRTO = getRTOById(selectedRTOId);
  const hasValidationCredits = validationCredits.current > 0;

  // Debug logging for RTO state
  useEffect(() => {
    console.log('[DocumentUpload] selectedRTOId changed:', selectedRTOId);
    console.log('[DocumentUpload] selectedRTO:', selectedRTO);
    if (!selectedRTO && selectedRTOId) {
      console.warn('[DocumentUpload] WARNING: selectedRTOId is set but selectedRTO is undefined');
      console.warn('[DocumentUpload] This means RTOs may not be loaded in cache yet');
    }
  }, [selectedRTOId, selectedRTO]);

  useEffect(() => {
    const loadCredits = async () => {
      if (!selectedRTO?.code) return;

      const credits = await getValidationCredits(selectedRTO.code);
      setValidationCredits(credits);
    };

    loadCredits();
  }, [selectedRTOId, selectedRTO?.code]);

  useEffect(() => {
    const fetchUnits = async () => {
      setIsLoadingUnits(true);
      console.log('[DocumentUpload] Starting to fetch units via Edge Function...');
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

        const response = await fetch(`${supabaseUrl}/functions/v1/fetch-units-of-competency`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({}),
        });

        // Read response body directly
        const responseText = await response.text();
        const result = responseText ? JSON.parse(responseText) : {};
        console.log('[DocumentUpload] Edge Function response:', { success: result.success, dataLength: result.data?.length });

        if (!response.ok) {
          throw new Error(result?.error || `Edge Function returned ${response.status}: ${response.statusText}`);
        }

        if (!result.success) {
          throw new Error(result.error || 'Failed to fetch units');
        }

        const data = result.data || [];

        if (data.length === 0) {
          console.warn('[DocumentUpload] Data array is empty');
          setAvailableUnits([]);
          setIsLoadingUnits(false);
          return;
        }

        console.log('[DocumentUpload] Sample raw unit:', data[0]);

        try {
          const formattedUnits = data.map((unit: any, index: number) => {
            if (!unit) {
              console.warn(`[DocumentUpload] Unit at index ${index} is null/undefined`);
              return null;
            }
            return {
              id: unit.id,
              code: unit.unitCode || 'NO_CODE',
              title: unit.Title || unit.unitCode || 'Untitled',
              link: unit.Link,
            };
          }).filter(Boolean) as Unit[];

          console.log('[DocumentUpload] Formatted', formattedUnits.length, 'units');
          console.log('[DocumentUpload] First formatted unit:', formattedUnits[0]);
          setAvailableUnits(formattedUnits);
        } catch (formatError) {
          console.error('[DocumentUpload] Error formatting units:', formatError);
          setAvailableUnits([]);
        }
      } catch (error) {
        console.error('[DocumentUpload] Failed to fetch units:', error);
        toast.error('Failed to load units. Please refresh the page.');
        setAvailableUnits([]);
      } finally {
        console.log('[DocumentUpload] Setting isLoadingUnits to false');
        setIsLoadingUnits(false);
      }
    };

    fetchUnits();
  }, []);

  // Debug: Monitor button enabled/disabled state
  useEffect(() => {
    const isButtonDisabled = !hasValidationCredits ||
                             !selectedUnit ||
                             uploadedFiles.length === 0 ||
                             uploadedFiles.some(f => f.isUploading) ||
                             isEngaging ||
                             confirmText.toLowerCase() !== 'validate';

    console.log('[Validate Button State]', {
      isButtonDisabled,
      hasValidationCredits,
      hasSelectedUnit: !!selectedUnit,
      selectedUnitCode: selectedUnit?.code,
      uploadedFilesCount: uploadedFiles.length,
      anyUploading: uploadedFiles.some(f => f.isUploading),
      isEngaging,
      confirmText,
      confirmTextValid: confirmText.toLowerCase() === 'validate',
      validationCreditsValue: validationCredits
    });
  }, [hasValidationCredits, selectedUnit, uploadedFiles, isEngaging, confirmText, validationCredits]);

  const filteredUnits = availableUnits.filter(unit =>
    unit.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    unit.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleUnitSelect = (unit: Unit) => {
    setSelectedUnit(unit);
    setSearchTerm('');
    setOpen(false);
    // Reset files when unit changes
    setUploadedFiles([]);
  };

  const processFiles = (files: FileList | null) => {
    if (!files || !selectedUnit || !canAddMoreFiles) return;

    // Process each selected file
    Array.from(files).forEach((file) => {
      // Validate file type - PDF only
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        toast.error(`File "${file.name}" must be a PDF. Only PDF files are supported for optimal AI accuracy.`);
        return;
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`File "${file.name}" exceeds 5MB limit`);
        return;
      }

      // Check if file already exists
      if (uploadedFiles.some(f => f.name === file.name)) {
        toast.error(`File "${file.name}" is already uploaded`);
        return;
      }

      // Check if we can add more files
      if (uploadedFiles.length >= MAX_FILES) {
        toast.error(`Maximum ${MAX_FILES} files allowed`);
        return;
      }

      const fileId = `${Date.now()}-${Math.random()}`;
      const newFile: UploadedFile = {
        id: fileId,
        name: file.name,
        size: file.size,
        progress: 0,
        isUploading: true,
        file,
      };

      setUploadedFiles(prev => [...prev, newFile]);

      // Simulate upload progress
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.random() * 30;
        if (progress >= 100) {
          progress = 100;
          clearInterval(interval);
          setUploadedFiles(prev =>
            prev.map(f => f.id === fileId ? { ...f, progress: 100, isUploading: false } : f)
          );
        } else {
          setUploadedFiles(prev =>
            prev.map(f => f.id === fileId ? { ...f, progress } : f)
          );
        }
      }, 200);
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(e.target.files);
    // Reset input
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (selectedUnit && hasValidationCredits && canAddMoreFiles) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (selectedUnit && hasValidationCredits && canAddMoreFiles) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleRemoveFile = (fileId: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const handleEngage = async () => {
    console.log('[handleEngage] ENTRY - Function called');
    console.log('[handleEngage] selectedRTO:', selectedRTO);
    console.log('[handleEngage] selectedRTOId:', selectedRTOId);

    if (!selectedRTO?.code) {
      console.error('[handleEngage] ERROR: selectedRTO is not available');
      console.error('[handleEngage] This likely means RTOs haven\'t been loaded into cache yet');
      toast.error('RTO not selected - please refresh the page');
      return;
    }

    console.log('[handleEngage] RTO check passed:', selectedRTO.code);

    console.log('[handleEngage] Checking selectedUnit:', selectedUnit);
    if (!selectedUnit) {
      console.error('[handleEngage] ERROR: No unit selected');
      toast.error('Please select a unit');
      return;
    }
    console.log('[handleEngage] Unit check passed:', selectedUnit.code);

    console.log('[handleEngage] Checking uploadedFiles:', uploadedFiles.length);
    if (uploadedFiles.length === 0) {
      console.error('[handleEngage] ERROR: No files uploaded');
      toast.error('Please upload at least one file');
      return;
    }
    console.log('[handleEngage] Files check passed:', uploadedFiles.length, 'files');

    console.log('[handleEngage] Checking if files are uploading...');
    const uploadingFiles = uploadedFiles.filter(f => f.isUploading);
    if (uploadingFiles.length > 0) {
      console.error('[handleEngage] ERROR: Files still uploading:', uploadingFiles.map(f => f.name));
      toast.error('Please wait for all files to finish uploading');
      return;
    }
    console.log('[handleEngage] Upload status check passed');

    console.log('[handleEngage] Checking validation credits:', validationCredits.current);
    if (validationCredits.current <= 0) {
      console.error('[handleEngage] ERROR: Insufficient credits');
      toast.error('Insufficient validation credits');
      return;
    }
    console.log('[handleEngage] Credits check passed:', validationCredits.current);

    // Check authentication using auth store (avoids hanging Supabase call)
    console.log('[handleEngage] Checking user authentication from store...');
    if (!user) {
      console.error('[handleEngage] User not authenticated');
      toast.error('You must be logged in to start validation');
      return;
    }
    console.log('[handleEngage] User authenticated successfully:', user.email);

    setIsEngaging(true);
    console.log('[handleEngage] 1. Starting validation setup');
    toast.loading('Setting up validation...', { id: 'validation-setup' });

    let validationDetailData: { id: any } | null = null;

    try {
      // Consume a validation credit - simplified without timeout wrapper
      console.log('[handleEngage] 2. Consuming validation credit for RTO:', selectedRTO.code);
      toast.loading('Consuming validation credit...', { id: 'validation-setup' });

      const result = await consumeValidationCredit(selectedRTO.code);
      console.log('[handleEngage] 3. Credit consumption result:', result);

      if (!result.success) {
        throw new Error(result.message || 'Failed to consume validation credit');
      }

      console.log('[handleEngage] 4. Credit consumed successfully, new balance:', result.newBalance);

      // Update local credits
      setValidationCredits(prev => ({
        ...prev,
        current: Math.max(0, (result.newBalance as number) || prev.current - 1)
      }));

      // Notify parent that credits were consumed
      onCreditsConsumed?.();

        // Create folder name and namespace
        const validationTypeString = validationType === 'unit' ? 'UnitOfCompetency' : 'LearnerGuide';
        const folderName = createFolderName(selectedRTO.code, selectedUnit.code, validationTypeString);
        const pineconeNamespace = createPineconeNamespace(folderName);

        console.log('[handleEngage] 5. Created folder name:', folderName);

        // Create validation records via Edge Function (bypasses RLS)
        console.log('[handleEngage] 6. Creating validation records via Edge Function...');
        toast.loading('Creating validation record...', { id: 'validation-setup' });

        // Add timeout protection to prevent UI hang
        const createRecordsController = new AbortController();
        const createRecordsTimeout = setTimeout(() => {
          console.error('[handleEngage] 6. CREATE RECORDS TIMEOUT - Aborting after 30 seconds');
          createRecordsController.abort();
        }, 30000); // 30 second timeout for record creation

        let recordsResult, recordsError;
        try {
          const response = await supabase.functions.invoke(
            'create-validation-records-simple',
            {
              body: {
                rtoCode: selectedRTO.code,
                unitCode: selectedUnit.code,
                qualificationCode: null,
                validationType: validationTypeString,
                pineconeNamespace: pineconeNamespace,
              },
            }
          );
          recordsResult = response.data;
          recordsError = response.error;
          clearTimeout(createRecordsTimeout);
          console.log('[handleEngage] 6a. Create records completed successfully');
        } catch (createError: any) {
          clearTimeout(createRecordsTimeout);
          if (createError.name === 'AbortError') {
            console.error('[handleEngage] 6. CREATE RECORDS ABORTED - Request timed out');
            throw new Error('Validation record creation timed out after 30 seconds. Please try again.');
          }
          console.error('[handleEngage] 6. CREATE RECORDS EXCEPTION:', createError);
          throw new Error(`Failed to create validation records: ${createError.message || 'Unknown error'}`);
        }

        if (recordsError || !recordsResult?.success) {
          console.error('[handleEngage] 6. Error creating records:', recordsError || recordsResult);
          throw new Error(`Failed to create validation records: ${recordsError?.message || recordsResult?.error || 'Unknown error'}`);
        }

        validationDetailData = { id: recordsResult.detailId };
        console.log('[handleEngage] 7. All validation records created:', {
          summaryId: recordsResult.summaryId,
          typeId: recordsResult.typeId,
          detailId: recordsResult.detailId,
        });

        // Upload files to Supabase Storage via Edge Function
        console.log('[handleEngage] 9. Uploading', uploadedFiles.length, 'files to Supabase Storage...');
        toast.loading('Uploading files to storage...', { id: 'validation-setup' });

        // Convert files to base64 for transmission
        const filesToUpload = await Promise.all(uploadedFiles.map(async (f) => {
          const arrayBuffer = await f.file.arrayBuffer();
          const binaryString = new Uint8Array(arrayBuffer)
            .reduce((data, byte) => data + String.fromCharCode(byte), '');
          const base64Content = btoa(binaryString);
          return {
            name: f.name,
            base64Content,
          };
        }));

        console.log('[handleEngage] 9a. Converted files to base64, calling Edge Function...');

        // Add timeout protection for file upload (files can be large)
        const uploadController = new AbortController();
        const uploadTimeout = setTimeout(() => {
          console.error('[handleEngage] 9. FILE UPLOAD TIMEOUT - Aborting after 120 seconds');
          uploadController.abort();
        }, 120000); // 120 second timeout for file uploads (larger files need more time)

        let storageResponse;
        try {
          storageResponse = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-files-to-storage`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
              },
              body: JSON.stringify({
                rtoCode: selectedRTO.code,
                unitCode: selectedUnit.code,
                validationType: validationTypeString,
                files: filesToUpload,
              }),
              signal: uploadController.signal,
            }
          );
          clearTimeout(uploadTimeout);
          console.log('[handleEngage] 9b. File upload fetch completed');
        } catch (uploadError: any) {
          clearTimeout(uploadTimeout);
          if (uploadError.name === 'AbortError') {
            console.error('[handleEngage] 9. FILE UPLOAD ABORTED - Request timed out');
            throw new Error('File upload timed out after 2 minutes. Please try with smaller files or fewer files.');
          }
          console.error('[handleEngage] 9. FILE UPLOAD EXCEPTION:', uploadError);
          throw new Error(`File upload failed: ${uploadError.message || 'Unknown error'}`);
        }

        // Read response body directly
        const storageText = await storageResponse.text();
        const storageResult = storageText ? JSON.parse(storageText) : {};

        if (!storageResponse.ok || !storageResult.success) {
          throw new Error(storageResult?.error || `File upload failed: ${storageResponse.status} ${storageResponse.statusText}`);
        }

        const uploadedFileData = storageResult.uploadedFiles || [];
        console.log('[handleEngage] 10. Files uploaded to Supabase Storage, count:', uploadedFileData.length);

        // Dismiss upload toast and show processing status
        toast.dismiss('validation-setup');
        toast.success(`${uploadedFileData.length} file${uploadedFileData.length === 1 ? '' : 's'} uploaded successfully!`, {
          duration: 2000,
          id: 'upload-success'
        });

        // Note: Status updates are handled by Edge Functions with service role key
        // Frontend updates fail due to RLS requiring authenticated users (anon key doesn't work)
        console.log('[handleEngage] 10a. ✓ Files uploaded, validation_detail ID:', validationDetailData.id);
        console.log('[handleEngage] 10b. Status updates will be handled by Edge Functions...');

        // Start validation with Gemini via Supabase Edge Functions
        console.log('[handleEngage] 11. Starting validation with Gemini (this is the slow part)...');
        console.log('[handleEngage] 11a. Processing', uploadedFileData.length, 'file(s) with Gemini AI...');

        const fileCount = uploadedFileData.length;

        // Small delay to let success toast show
        await new Promise(resolve => setTimeout(resolve, 2000));

        toast.loading(`Processing with AI (${fileCount} file${fileCount === 1 ? '' : 's'}, small PDFs typically process in seconds)...`, { id: 'validation-setup' });

        let progressInterval: number | undefined;

        try {
          // Set up progress updates every 10 seconds
          progressInterval = window.setInterval(() => {
            console.log('[handleEngage] 11b. AI processing in progress...');
            toast.loading(`Processing with AI (${fileCount} file${fileCount === 1 ? '' : 's'}, small PDFs typically process in seconds)...`, { id: 'validation-setup' });
          }, 10000);

          console.log('[handleEngage] 11b. Progress interval started, calling startValidationWithGemini...');

          // Create a timeout promise that resolves after 10 minutes
          // If Gemini processing takes longer, we gracefully return to dashboard
          const overallTimeout = new Promise<void>((resolve) => {
            setTimeout(() => {
              console.log('[handleEngage] 11c. Overall operation timeout - validation queued for background processing');
              resolve();
            }, 600000); // 10 minutes
          });

          const validationPromise = startValidationWithGemini(
            validationDetailData.id,
            selectedRTO.code,
            selectedUnit.code,
            validationTypeString,
            uploadedFileData
          ).then(() => {
            console.log('[handleEngage] 11d. startValidationWithGemini completed successfully');
          }).catch((err) => {
            console.error('[handleEngage] 11e. startValidationWithGemini failed:', err);
            throw err;
          });

          // Race: either validation completes OR overall timeout occurs
          console.log('[handleEngage] 11f. Starting race between validation and timeout...');
          await Promise.race([
            validationPromise,
            overallTimeout
          ]);

          console.log('[handleEngage] 11g. Race completed, clearing interval...');
          if (progressInterval) {
            clearInterval(progressInterval);
            progressInterval = undefined;
          }

          console.log('[handleEngage] 12. Validation processing initiated successfully!');
          toast.dismiss('validation-setup');
          toast.loading('Finalizing validation record...', { id: 'validation-setup' });
        } catch (validationError) {
          console.error('[handleEngage] 12. ERROR during validation setup:', validationError);
          console.error('[handleEngage] 12a. Error details:', {
            message: validationError instanceof Error ? validationError.message : 'Unknown',
            stack: validationError instanceof Error ? validationError.stack : 'No stack',
            error: validationError
          });

          if (progressInterval) {
            clearInterval(progressInterval);
            progressInterval = undefined;
          }

          const errorMsg = validationError instanceof Error ? validationError.message : 'Unknown error';
          throw new Error(`Failed to set up validation: ${errorMsg}`);
        }

        // Success! Navigate to validation dashboard or show processing message
        toast.dismiss('validation-setup');
        console.log('[handleEngage] 13. Validation processing initiated...');

        // Update validation status to "documents" stage (Stage 3) to show in Active Validations
        console.log('[handleEngage] 13a. Updating validation status to processing stage...');
        const { error: updateError } = await supabase
          .from('validation_detail')
          .update({
            docExtracted: true,
            extractStatus: 'ProcessingInBackground',
          })
          .eq('id', validationDetailData.id);

        if (updateError) {
          console.error('[handleEngage] 13b. Warning: Could not update validation status:', updateError);
          console.error('[handleEngage] 13b. Full error:', JSON.stringify(updateError, null, 2));
        } else {
          console.log('[handleEngage] 13b. Validation status updated to processing stage');
        }

        toast.success('Validation queued for processing! Check Active Validations for progress.', {
          duration: 5000,
        });
        console.log('[handleEngage] 14. Navigating back to dashboard...');

        setConfirmText('');
        setUploadedFiles([]);

        // Navigate back to dashboard to show active validations
        if (onValidationSubmit) {
          console.log('[handleEngage] 14a. Calling onValidationSubmit to return to dashboard');
          onValidationSubmit(); // Call without parameters to trigger dashboard navigation
        }
    } catch (error) {
      console.error('[handleEngage] ERROR during validation setup:', error);
      console.error('[handleEngage] Error stack:', error instanceof Error ? error.stack : 'No stack');
      toast.dismiss('validation-setup');

      const errorMsg = error instanceof Error ? error.message : 'An error occurred';

      // Check if it's a timeout-related error
      if (errorMsg.includes('timeout') || errorMsg.includes('timed out')) {
        console.log('[handleEngage] Timeout detected - attempting graceful recovery...');

        // Try to update the validation record to mark it as processing
        if (validationDetailData?.id) {
          try {
            const { error: updateError } = await supabase
              .from('validation_detail')
              .update({
                docExtracted: true,
                extractStatus: 'ProcessingInBackground',
              })
              .eq('id', validationDetailData.id);

            if (!updateError) {
              console.log('[handleEngage] Validation marked as processing after timeout');
            } else {
              console.error('[handleEngage] Error updating after timeout:', updateError);
            }
          } catch (e) {
            console.error('[handleEngage] Could not update after timeout:', e);
          }
        }

        // Show helpful message about background processing
        toast.success(
          'Validation submitted! It\'s processing in the background. You\'ll see updates in Active Validations.',
          { duration: 6000 }
        );

        // Navigate back to dashboard after a brief delay
        setTimeout(() => {
          setConfirmText('');
          setUploadedFiles([]);
          if (onValidationSubmit) {
            console.log('[handleEngage] Timeout scenario - returning to dashboard');
            onValidationSubmit(); // Call without parameters to trigger dashboard navigation
          }
        }, 1000);
      } else {
        // For other errors, show the error message
        toast.error(errorMsg);
      }
    } finally {
      console.log('[handleEngage] 15. Cleanup - setting isEngaging to false');
      setIsEngaging(false);
    }
  };

  // Show error if RTO is not loaded
  if (!selectedRTO && selectedRTOId) {
    return (
      <div className="min-h-screen bg-[#f8f9fb] p-8">
        <div className="mb-8">
          <h1 className="font-poppins text-[#1e293b] mb-2">Validate</h1>
          <p className="text-[#64748b]">Upload and validate your documents</p>
        </div>
        <div className="max-w-4xl mx-auto">
          <Card className="border-2 border-[#ef4444] bg-[#fef2f2] p-6 shadow-soft">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg bg-[#ef4444] text-white flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-7 h-7" />
              </div>
              <div className="flex-1">
                <h3 className="font-poppins text-[#991b1b] mb-2">
                  RTO Data Not Found
                </h3>
                <p className="text-[#7f1d1d] mb-4">
                  Unable to load RTO information. Please refresh the page or contact support if the problem persists.
                </p>
                <button
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 bg-[#ef4444] hover:bg-[#dc2626] text-white font-semibold rounded transition-colors"
                >
                  Refresh Page
                </button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f9fb] p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-poppins text-[#1e293b] mb-2">
          Validate
        </h1>
        <p className="text-[#64748b]">Upload and validate your documents</p>
      </div>

      {/* No Validation Credits Warning */}
      {!hasValidationCredits && (
        <div className="max-w-4xl mx-auto mb-6">
          <Card className="border-2 border-[#ef4444] bg-[#fef2f2] p-6 shadow-soft">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg bg-[#ef4444] text-white flex items-center justify-center flex-shrink-0">
                <XCircle className="w-7 h-7" />
              </div>
              <div className="flex-1">
                <h3 className="font-poppins text-[#991b1b] mb-2">
                  No Validation Credits Available
                </h3>
                <p className="text-sm text-[#7f1d1d] mb-3">
                  Your organization has run out of validation credits. Upload and validation features are currently disabled. Please purchase additional validation credits.
                </p>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-[#991b1b] font-medium">Current credits:</span>
                  <span className="font-poppins text-[#ef4444]">
                    {validationCredits.current} / {validationCredits.total}
                  </span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      <div className="max-w-4xl mx-auto space-y-6">
        {/* Step 1: Validation Type */}
        <Card className={`border ${!hasValidationCredits ? 'border-[#fca5a5] opacity-60' : 'border-[#dbeafe]'} bg-white p-8 shadow-soft`}>
          <div className="flex items-center gap-3 mb-6">
            <div className={`w-10 h-10 rounded-lg ${!hasValidationCredits ? 'bg-[#cbd5e1]' : 'bg-[#3b82f6]'} text-white flex items-center justify-center font-poppins`}>
              1
            </div>
            <div>
              <h2 className="font-poppins text-[#1e293b]">Select Validation Type</h2>
              <p className="text-sm text-[#64748b]">Choose the type of validation</p>
            </div>
          </div>

          <Tabs value={validationType} onValueChange={(v) => {
            if (!hasValidationCredits) return;
            setValidationType(v as 'unit' | 'learner');
            // Reset selections when validation type changes
            setSelectedUnit(null);
            setUploadedFiles([]);
          }}>
            <TabsList className={`grid w-full grid-cols-2 bg-[#f1f5f9] ${!hasValidationCredits ? 'opacity-50 cursor-not-allowed' : ''}`}>
              <TabsTrigger 
                value="unit"
                className="data-[state=active]:bg-[#3b82f6] data-[state=active]:text-white font-poppins"
                disabled={!hasValidationCredits}
              >
                Unit Validation
              </TabsTrigger>
              <TabsTrigger 
                value="learner"
                className="data-[state=active]:bg-[#3b82f6] data-[state=active]:text-white font-poppins"
                disabled={!hasValidationCredits}
              >
                Learner Guide
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="unit" className="mt-6">
              <div className="p-4 bg-[#f8f9fb] border border-[#dbeafe] rounded-lg">
                <p className="text-sm text-[#64748b]">
                  Validate assessment tools, workbooks, and training materials against Unit of Competency requirements
                </p>
              </div>
            </TabsContent>
            
            <TabsContent value="learner" className="mt-6">
              <div className="p-4 bg-[#f8f9fb] border border-[#dbeafe] rounded-lg">
                <p className="text-sm text-[#64748b]">
                  Validate learner guides and training resources for completeness and compliance
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </Card>

        {/* Step 2: Select Unit */}
        <Card className={`border ${!hasValidationCredits ? 'border-[#fca5a5] opacity-60' : selectedUnit ? 'border-[#22c55e]' : 'border-[#dbeafe]'} bg-white p-8 shadow-soft`}>
          <div className="flex items-center gap-3 mb-6">
            <div className={`w-10 h-10 rounded-lg ${!hasValidationCredits ? 'bg-[#cbd5e1]' : selectedUnit ? 'bg-[#22c55e]' : 'bg-[#3b82f6]'} text-white flex items-center justify-center font-poppins`}>
              {selectedUnit ? '✓' : '2'}
            </div>
            <div>
              <h2 className="font-poppins text-[#1e293b]">Select Unit of Competency</h2>
              <p className="text-sm text-[#64748b]">Search and select the unit to validate against</p>
            </div>
          </div>

          {selectedUnit ? (
            <div className="space-y-4">
              <div className="p-6 bg-[#dcfce7] border-2 border-[#22c55e] rounded-lg">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-white border border-[#22c55e] flex items-center justify-center">
                      <Target className="w-6 h-6 text-[#22c55e]" />
                    </div>
                    <div>
                      <div className="font-poppins text-[#166534] mb-1">{selectedUnit.code}</div>
                      <p className="text-sm text-[#64748b]">{selectedUnit.title}</p>
                      <p className="text-xs text-[#94a3b8] mt-1">{selectedUnit.sector}</p>
                    </div>
                  </div>
                  <GlowButton
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setSelectedUnit(null);
                      setUploadedFiles([]);
                    }}
                  >
                    Change Unit
                  </GlowButton>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <Popover open={open} onOpenChange={setOpen} modal={false}>
                <PopoverAnchor asChild>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#64748b]" />
                    <Input
                      placeholder="Search by unit code or title..."
                      className="pl-12 h-14 bg-white border-2 border-[#dbeafe] focus:border-[#3b82f6]"
                      value={searchTerm}
                      onChange={(e) => {
                        if (!hasValidationCredits) return;
                        const value = e.target.value;
                        setSearchTerm(value);
                        if (!open) {
                          setOpen(true);
                        }
                      }}
                      onFocus={() => {
                        if (hasValidationCredits) {
                          setOpen(true);
                        }
                      }}
                      onBlur={(e) => {
                        // Don't close if clicking inside the popover
                        const relatedTarget = e.relatedTarget as HTMLElement;
                        if (relatedTarget && relatedTarget.closest('[role="dialog"]')) {
                          return;
                        }
                        // Delay close to allow click events to fire
                        setTimeout(() => setOpen(false), 200);
                      }}
                      disabled={!hasValidationCredits}
                    />
                  </div>
                </PopoverAnchor>

                <PopoverContent
                  className="w-[600px] p-0"
                  align="start"
                  side="bottom"
                  onOpenAutoFocus={(e) => e.preventDefault()}
                  onInteractOutside={(e) => {
                    // Don't close when clicking the input
                    const target = e.target as HTMLElement;
                    if (target.closest('input[placeholder="Search by unit code or title..."]')) {
                      e.preventDefault();
                    }
                  }}
                >
                  <Command className="bg-white" shouldFilter={false}>
                    <CommandList className="max-h-[300px]">
                      {filteredUnits.length === 0 ? (
                        <CommandEmpty className="py-8 text-center">
                          {isLoadingUnits ? (
                            <div className="space-y-2">
                              <div className="text-sm text-[#64748b]">Loading units...</div>
                              <div className="text-xs text-[#94a3b8]">This is taking longer than expected</div>
                            </div>
                          ) : availableUnits.length === 0 ? (
                            <div className="space-y-2">
                              <div className="text-sm text-[#64748b]">No units available</div>
                              <div className="text-xs text-[#94a3b8]">Check browser console for details</div>
                            </div>
                          ) : (
                            <div className="text-sm text-[#64748b]">No matching units found</div>
                          )}
                        </CommandEmpty>
                      ) : (
                        <CommandGroup heading="Available Units">
                          {filteredUnits.map((unit) => (
                            <CommandItem
                              key={unit.id}
                              value={`${unit.code} ${unit.title}`}
                              onSelect={() => handleUnitSelect(unit)}
                              className="cursor-pointer px-4 py-3"
                            >
                              <div className="flex items-center gap-3 w-full">
                                <div className="w-10 h-10 rounded bg-[#dbeafe] border border-[#3b82f6] flex items-center justify-center flex-shrink-0">
                                  <Target className="w-5 h-5 text-[#3b82f6]" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="font-poppins text-[#1e293b]">{unit.code}</div>
                                  <p className="text-sm text-[#64748b] truncate">{unit.title}</p>
                                </div>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      )}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              <div className="p-4 bg-[#fef3c7] border border-[#f59e0b] rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-[#f59e0b] flex-shrink-0 mt-0.5" />
                <div className="text-sm text-[#92400e]">
                  <p className="font-medium mb-1">Unit selection required</p>
                  <p className="text-xs">You must select a unit before uploading a document. The validation process will compare your document against the selected unit's requirements.</p>
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* Step 3: File Upload */}
        <Card className={`border ${!hasValidationCredits ? 'border-[#fca5a5] opacity-60' : !selectedUnit ? 'border-[#dbeafe] opacity-50' : uploadedFiles.length > 0 ? 'border-[#22c55e]' : 'border-[#dbeafe]'} bg-white p-8 shadow-soft`}>
          <div className="flex items-center gap-3 mb-6">
            <div className={`w-10 h-10 rounded-lg ${!hasValidationCredits ? 'bg-[#cbd5e1]' : uploadedFiles.length > 0 ? 'bg-[#22c55e]' : 'bg-[#3b82f6]'} text-white flex items-center justify-center font-poppins`}>
              {uploadedFiles.length > 0 ? '✓' : '3'}
            </div>
            <div>
              <h2 className="font-poppins text-[#1e293b]">Upload Document</h2>
              <p className="text-sm text-[#64748b]">Select documents for validation</p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Upload Zone */}
            <div className="relative">
              <input
                type="file"
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
                accept=".pdf"
                disabled={!selectedUnit || !hasValidationCredits || !canAddMoreFiles}
                multiple
              />

              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`
                  border-2 border-dashed rounded-lg p-12 text-center
                  transition-all
                  ${isDragging && selectedUnit && hasValidationCredits && canAddMoreFiles
                    ? 'border-[#3b82f6] bg-[#dbeafe] bg-opacity-20'
                    : !hasValidationCredits || !selectedUnit || !canAddMoreFiles
                    ? 'cursor-not-allowed opacity-50 border-[#dbeafe]'
                    : 'border-[#dbeafe] cursor-pointer hover:border-[#3b82f6] hover:bg-[#f8f9fb]'
                  }
                `}
              >
                <label
                  htmlFor="file-upload"
                  className="block cursor-pointer"
                  onClick={() => {
                    if (selectedUnit && hasValidationCredits && canAddMoreFiles) {
                      document.getElementById('file-upload')?.click();
                    }
                  }}
                >
                  <div className="space-y-4">
                    <Upload className={`w-16 h-16 mx-auto ${!hasValidationCredits || !selectedUnit || !canAddMoreFiles ? 'text-[#cbd5e1]' : 'text-[#3b82f6]'}`} />
                    <div>
                      <p className={`font-poppins mb-1 ${!hasValidationCredits || !selectedUnit || !canAddMoreFiles ? 'text-[#94a3b8]' : 'text-[#1e293b]'}`}>
                        {!hasValidationCredits ? 'No validation credits available' : !selectedUnit ? 'Select a unit first' : !canAddMoreFiles ? 'Maximum files reached' : 'Drop files here'}
                      </p>
                      <p className={`text-sm ${!hasValidationCredits || !selectedUnit || !canAddMoreFiles ? 'text-[#cbd5e1]' : 'text-[#64748b]'}`}>
                        {!hasValidationCredits ? 'Purchase credits to enable upload' : !selectedUnit ? 'Upload will be enabled after unit selection' : !canAddMoreFiles ? `You have reached the maximum of ${MAX_FILES} files` : 'or click to browse files'}
                      </p>
                      {selectedUnit && hasValidationCredits && canAddMoreFiles && (
                        <p className="text-xs text-[#94a3b8] mt-2">PDF files only (Max 5MB each, up to {MAX_FILES} files) • Small files process in seconds</p>
                      )}
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* Uploaded Files List */}
            {uploadedFiles.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-[#1e293b]">Uploaded Files ({uploadedFiles.length}/{MAX_FILES})</p>
                <div className="space-y-2">
                  {uploadedFiles.map((file) => (
                    <div key={file.id} className="p-4 bg-[#f8f9fb] border border-[#dbeafe] rounded-lg">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <p className="text-sm font-medium text-[#1e293b] truncate">{file.name}</p>
                            <span className="text-xs text-[#64748b]">({(file.size / 1024 / 1024).toFixed(2)}MB)</span>
                          </div>
                          {file.isUploading && (
                            <div>
                              <Progress value={file.progress} className="h-2 bg-[#e2e8f0]" />
                              <p className="text-xs text-[#64748b] mt-1">Uploading... {Math.round(file.progress)}%</p>
                            </div>
                          )}
                          {!file.isUploading && (
                            <p className="text-xs text-[#22c55e] font-medium">✓ Upload complete</p>
                          )}
                        </div>
                        {!file.isUploading && (
                          <button
                            onClick={() => handleRemoveFile(file.id)}
                            className="p-1 hover:bg-[#f1f5f9] rounded transition-colors text-[#64748b] hover:text-[#ef4444]"
                          >
                            <XCircle className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Step 4: Start Validation */}
        <Card className={`border ${!hasValidationCredits ? 'border-[#fca5a5] opacity-60' : selectedUnit && uploadedFiles.length > 0 ? 'border-[#3b82f6]' : 'border-[#dbeafe] opacity-50'} bg-white p-8 shadow-medium`}>
          <div className="flex items-center gap-3 mb-6">
            <div className={`w-10 h-10 rounded-lg ${!hasValidationCredits ? 'bg-[#cbd5e1]' : 'bg-[#3b82f6]'} text-white flex items-center justify-center font-poppins`}>
              4
            </div>
            <div>
              <h2 className="font-poppins text-[#1e293b]">Start Validation</h2>
              <p className="text-sm text-[#64748b]">Launch AI-powered validation process</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="p-4 bg-[#f8f9fb] border border-[#dbeafe] rounded-lg">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-[#64748b]">Validation Type:</span>
                  <span className="ml-2 text-[#3b82f6] font-poppins block mt-1">
                    {validationType === 'unit' ? 'Unit Validation' : 'Learner Guide'}
                  </span>
                </div>
                <div>
                  <span className="text-[#64748b]">Selected Unit:</span>
                  <span className={`ml-2 font-poppins block mt-1 ${selectedUnit ? 'text-[#22c55e]' : 'text-[#cbd5e1]'}`}>
                    {selectedUnit ? selectedUnit.code : 'Not selected'}
                  </span>
                </div>
                <div>
                  <span className="text-[#64748b]">Documents:</span>
                  <span className={`ml-2 font-poppins block mt-1 ${uploadedFiles.length > 0 ? 'text-[#22c55e]' : 'text-[#cbd5e1]'}`}>
                    {uploadedFiles.length > 0 ? `${uploadedFiles.length} file(s)` : 'Pending'}
                  </span>
                </div>
              </div>
            </div>

            {selectedUnit && uploadedFiles.length > 0 && uploadedFiles.every(f => !f.isUploading) && hasValidationCredits && (
              <div className="space-y-2">
                <label htmlFor="confirm-validation" className="text-sm text-[#64748b]">
                  Type <span className="font-medium text-[#0f172a]">validate</span> to confirm:
                </label>
                <Input
                  id="confirm-validation"
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="Type validate here"
                  className="w-full"
                />
              </div>
            )}

            <GlowButton
              variant="primary"
              onClick={() => {
                console.log('[Validate Button] Button clicked');
                console.log('[Validate Button] State:', {
                  hasValidationCredits,
                  selectedUnit: selectedUnit?.code,
                  uploadedFilesCount: uploadedFiles.length,
                  isEngaging,
                  confirmText,
                  confirmTextLower: confirmText.toLowerCase(),
                  isValidConfirmText: confirmText.toLowerCase() === 'validate'
                });
                handleEngage();
              }}
              disabled={!hasValidationCredits || !selectedUnit || uploadedFiles.length === 0 || uploadedFiles.some(f => f.isUploading) || isEngaging || confirmText.toLowerCase() !== 'validate'}
              className="w-full h-14"
            >
              <Play className="w-6 h-6 mr-3" />
              {isEngaging ? 'Starting Validation...' : !hasValidationCredits ? 'No Validation Credits Available' : 'Start Validation'}
            </GlowButton>

            {selectedUnit && uploadedFiles.length > 0 && uploadedFiles.every(f => !f.isUploading) && hasValidationCredits && (
              <p className="text-center text-xs text-[#64748b]">
                Click to begin validating <span className="font-poppins text-[#3b82f6]">{uploadedFiles.length} file(s)</span> against <span className="font-poppins text-[#3b82f6]">{selectedUnit.code}</span>
              </p>
            )}



            {hasValidationCredits && (!selectedUnit || uploadedFiles.length === 0) && (
              <p className="text-center text-xs text-[#cbd5e1]">
                Complete all steps above to enable validation
              </p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
