import React, { useState, useEffect } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Upload, File, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { validateAssessmentV2, validateValidationRequest } from '../services/ValidationService_v2';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "./ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { getRTOById, getValidationCredits, consumeValidationCredit, fetchUnitsOfCompetency } from '../types/rto';
import { toast } from 'sonner';

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
  documentId?: number;
}

interface DocumentUploadProps {
  selectedRTOId: string;
  onValidationSubmit?: () => void;
}

export function DocumentUpload({ selectedRTOId, onValidationSubmit }: DocumentUploadProps) {
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

  const MAX_FILES = 5;
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB (increased for Gemini)
  const canAddMoreFiles = uploadedFiles.length < MAX_FILES;

  const selectedRTO = getRTOById(selectedRTOId);
  const hasValidationCredits = validationCredits.current > 0;

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
      try {
        const data = await fetchUnitsOfCompetency();
        const formattedUnits = (data || []).map((unit: any) => ({
          id: unit.id,
          code: unit.unitCode,
          title: unit.Title || unit.unitCode,
          link: unit.Link,
        }));
        setAvailableUnits(formattedUnits);
      } catch (error) {
        console.error('Failed to fetch units:', error);
      } finally {
        setIsLoadingUnits(false);
      }
    };

    fetchUnits();
  }, []);

  const filteredUnits = availableUnits.filter(unit =>
    unit.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    unit.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);

    if (uploadedFiles.length + files.length > MAX_FILES) {
      toast.error(`Maximum ${MAX_FILES} files allowed`);
      return;
    }

    const validFiles = files.filter(file => {
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name} exceeds 10MB limit`);
        return false;
      }
      return true;
    });

    const newFiles: UploadedFile[] = validFiles.map(file => ({
      id: Math.random().toString(36).substring(7),
      name: file.name,
      size: file.size,
      progress: 0,
      isUploading: false,
      file,
    }));

    setUploadedFiles(prev => [...prev, ...newFiles]);
  };

  const removeFile = (id: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== id));
  };

  const uploadToGemini = async (file: UploadedFile): Promise<number> => {
    if (!selectedRTO?.code) {
      throw new Error('No RTO selected');
    }

    // Read file as base64
    const fileContent = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file.file);
    });

    // Call Edge Function to upload to Gemini
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    const response = await fetch(`${supabaseUrl}/functions/v1/upload-document`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({
        rtoCode: selectedRTO.code,
        unitCode: selectedUnit?.code,
        documentType: 'assessment',
        fileName: file.name,
        fileContent: fileContent,
        displayName: file.name,
        metadata: {
          upload_source: 'web_ui',
          validation_type: validationType,
        },
      }),
    });

    let data;
    try {
      // Clone the response to safely read the body without stream conflicts
      try {
        data = await response.clone().json();
      } catch (cloneError) {
        // Fallback: if cloning fails, try reading directly
        console.warn('Clone json() failed, attempting direct read:', cloneError);
        data = await response.json();
      }
    } catch (jsonError) {
      console.error('Failed to parse upload response:', jsonError);
      throw new Error(`Failed to parse upload response: ${jsonError.message}`);
    }

    if (!response.ok) {
      throw new Error(data.error || 'Failed to upload document');
    }

    return data.document.id;
  };

  const handleEngageValidation = async () => {
    if (!selectedUnit) {
      toast.error('Please select a unit of competency');
      return;
    }

    if (uploadedFiles.length === 0) {
      toast.error('Please upload at least one document');
      return;
    }

    if (!hasValidationCredits) {
      toast.error('Insufficient validation credits');
      return;
    }

    if (confirmText !== 'ENGAGE') {
      toast.error('Please type ENGAGE to confirm');
      return;
    }

    setIsEngaging(true);

    try {
      // Upload all files to Gemini
      toast.info('Uploading documents to AI system...');

      for (const file of uploadedFiles) {
        setUploadedFiles(prev =>
          prev.map(f => (f.id === file.id ? { ...f, isUploading: true, progress: 0 } : f))
        );

        try {
          const documentId = await uploadToGemini(file);

          setUploadedFiles(prev =>
            prev.map(f =>
              f.id === file.id
                ? { ...f, isUploading: false, progress: 100, documentId }
                : f
            )
          );

          toast.success(`${file.name} uploaded successfully`);
        } catch (error) {
          console.error(`Error uploading ${file.name}:`, error);
          toast.error(`Failed to upload ${file.name}`);

          setUploadedFiles(prev =>
            prev.map(f => (f.id === file.id ? { ...f, isUploading: false, progress: 0 } : f))
          );
        }
      }

      // Get uploaded document IDs
      const documentIds = uploadedFiles
        .map(f => f.documentId)
        .filter((id): id is number => id !== undefined);

      if (documentIds.length === 0) {
        throw new Error('No documents were successfully uploaded');
      }

      // Kick off validation asynchronously (fire and forget)
      toast.info('Starting AI validation...');

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      // Trigger validation using new v2 service with robust error handling
      const validationRequest = {
        documentId: documentIds[0],
        unitCode: selectedUnit.code,
        validationType: 'full_validation',
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

      // Start validation in background - don't wait for completion
      toast.info('Starting AI validation...');
      validateAssessmentV2(validationRequest).catch(error => {
        console.error('Validation request failed:', error);
        toast.error(error.message || 'Validation failed. Please try again.');
        // Don't throw - validation will be visible/retryable from dashboard
      });

      // Consume validation credit
      if (selectedRTO?.code) {
        await consumeValidationCredit(selectedRTO.code, 'Validation for ' + selectedUnit.code);
        const newCredits = await getValidationCredits(selectedRTO.code);
        setValidationCredits(newCredits);
      }

      toast.success('Validation started! View progress in Active Validations');

      // Reset form
      setUploadedFiles([]);
      setConfirmText('');
      setSelectedUnit(null);

      // Notify parent component
      onValidationSubmit?.();
    } catch (error) {
      console.error('Validation error:', error);
      toast.error(error instanceof Error ? error.message : 'Validation failed');
    } finally {
      setIsEngaging(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="min-h-screen w-full bg-[#f8f9fb] p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-poppins font-bold text-[#1e293b] mb-8">Document Upload</h1>

        {/* Credit Balance Card */}
        <Card className="p-6 mb-6 bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Validation Credits</p>
              <p className="text-3xl font-bold text-[#1e293b]">
                {validationCredits.current} / {validationCredits.total}
              </p>
            </div>
            <Target className="w-12 h-12 text-blue-500" />
          </div>
        </Card>

        {/* Validation Type Tabs */}
        <Tabs value={validationType} onValueChange={(v) => setValidationType(v as 'unit' | 'learner')}>
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="unit">Unit Validation</TabsTrigger>
            <TabsTrigger value="learner">Learner Validation</TabsTrigger>
          </TabsList>

          <TabsContent value="unit">
            <Card className="p-6">
              {/* Unit Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Unit of Competency
                </label>
                <Popover open={open} onOpenChange={setOpen}>
                  <PopoverTrigger asChild>
                    <button
                      className="w-full flex items-center justify-between px-4 py-3 border border-gray-300 rounded-lg hover:border-blue-500 transition-colors"
                      disabled={isLoadingUnits}
                    >
                      <span className={selectedUnit ? 'text-gray-900' : 'text-gray-500'}>
                        {selectedUnit ? `${selectedUnit.code} - ${selectedUnit.title}` : 'Select a unit...'}
                      </span>
                      <Search className="w-4 h-4 text-gray-400" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[600px] p-0" align="start">
                    <Command>
                      <CommandInput
                        placeholder="Search units..."
                        value={searchTerm}
                        onValueChange={setSearchTerm}
                      />
                      <CommandList>
                        <CommandEmpty>No units found.</CommandEmpty>
                        <CommandGroup>
                          {filteredUnits.map((unit) => (
                            <CommandItem
                              key={unit.id}
                              onSelect={() => {
                                setSelectedUnit(unit);
                                setOpen(false);
                              }}
                            >
                              <div>
                                <div className="font-medium">{unit.code}</div>
                                <div className="text-sm text-gray-500">{unit.title}</div>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* File Upload */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload Assessment Documents (Max {MAX_FILES} files, 10MB each)
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors">
                  <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 mb-2">Drag and drop files here, or click to browse</p>
                  <Input
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx,.txt"
                    onChange={handleFileSelect}
                    disabled={!canAddMoreFiles}
                    className="hidden"
                    id="file-upload"
                  />
                  <label htmlFor="file-upload">
                    <GlowButton as="span" disabled={!canAddMoreFiles}>
                      Select Files
                    </GlowButton>
                  </label>
                </div>
              </div>

              {/* Uploaded Files List */}
              {uploadedFiles.length > 0 && (
                <div className="mb-6 space-y-3">
                  {uploadedFiles.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center flex-1">
                        <FileText className="w-5 h-5 text-blue-500 mr-3" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">{file.name}</p>
                          <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                          {file.isUploading && (
                            <Progress value={file.progress} className="mt-2" />
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {file.isUploading && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
                        {file.progress === 100 && <CheckCircle className="w-5 h-5 text-green-500" />}
                        {!file.isUploading && (
                          <button
                            onClick={() => removeFile(file.id)}
                            className="p-1 hover:bg-gray-200 rounded"
                          >
                            <XCircle className="w-5 h-5 text-red-500" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Confirmation */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type "ENGAGE" to confirm validation
                </label>
                <Input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="Type ENGAGE"
                  className="uppercase"
                />
              </div>

              {/* Engage Button */}
              <GlowButton
                onClick={handleEngageValidation}
                disabled={
                  !selectedUnit ||
                  uploadedFiles.length === 0 ||
                  confirmText !== 'ENGAGE' ||
                  !hasValidationCredits ||
                  isEngaging
                }
                className="w-full"
              >
                {isEngaging ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5 mr-2" />
                    Engage Validation
                  </>
                )}
              </GlowButton>

              {!hasValidationCredits && (
                <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-yellow-800">Insufficient Credits</p>
                    <p className="text-sm text-yellow-700 mt-1">
                      You need validation credits to perform assessments. Contact your administrator to add credits.
                    </p>
                  </div>
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="learner">
            <Card className="p-6">
              <p className="text-gray-600">Learner validation coming soon...</p>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
