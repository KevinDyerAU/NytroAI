/**
 * DocumentUploadAdapterSimplified - Instant Upload Wrapper
 * 
 * Simplified adapter that uses DocumentUploadSimplified for instant uploads.
 * Upload completes immediately, validation happens in background via DB trigger.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { DocumentUploadSimplified } from './upload/DocumentUploadSimplified';
import { getRTOById, fetchRTOById } from '../types/rto';
import { supabase } from '../lib/supabase';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Label } from './ui/label';
import { FileText, CheckCircle, Info, Plus } from 'lucide-react';
import { ValidationTriggerCard } from './ValidationTriggerButton';

interface DocumentUploadAdapterSimplifiedProps {
  selectedRTOId: string;
  onValidationSubmit?: (data?: { validationId: number; documentName: string; unitCode: string }) => void;
  onCreditsConsumed?: () => void;
}

export function DocumentUploadAdapterSimplified({
  selectedRTOId,
  onValidationSubmit,
  onCreditsConsumed
}: DocumentUploadAdapterSimplifiedProps) {
  const [selectedRTO, setSelectedRTO] = useState<any>(null);
  const [selectedUnit, setSelectedUnit] = useState<any>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadedCount, setUploadedCount] = useState(0);
  const [geminiUploadCount, setGeminiUploadCount] = useState(0);
  const [uploadedDocuments, setUploadedDocuments] = useState<Array<{ fileName: string; storagePath: string }>>([]);
  const [isComplete, setIsComplete] = React.useState(false);
  const [showValidationDialog, setShowValidationDialog] = React.useState(false);
  const [unitSearchTerm, setUnitSearchTerm] = useState('');
  const [allUnits, setAllUnits] = useState<any[]>([]);
  const [filteredUnits, setFilteredUnits] = useState<any[]>([]);
  const [showUnitDropdown, setShowUnitDropdown] = useState(false);
  const [isLoadingUnits, setIsLoadingUnits] = useState(false);
  // Removed validationDetailId state - will be created by ValidationTriggerCard when user types "validate"
  const [validationType, setValidationType] = useState<'unit' | 'learner_guide'>('unit');

  // validationDetailId will be created by ValidationTriggerCard when user confirms

  // Load RTO data
  useEffect(() => {
    const loadRTO = async () => {
      if (!selectedRTOId) return;

      let rto: any = getRTOById(selectedRTOId);
      if (!rto) {
        rto = await fetchRTOById(selectedRTOId);
      }
      setSelectedRTO(rto as any);
    };

    loadRTO();
  }, [selectedRTOId]);

  // Load all units on mount
  useEffect(() => {
    const loadUnits = async () => {
      setIsLoadingUnits(true);
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

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result?.error || 'Failed to fetch units');
        }

        console.log('[DocumentUploadAdapterSimplified] Loaded units:', result.data?.length || 0);
        // Debug: Log first unit to see structure
        if (result.data && result.data.length > 0) {
          console.log('[DocumentUploadAdapterSimplified] Sample unit structure:', result.data[0]);
        }
        setAllUnits(result.data || []);
      } catch (error) {
        console.error('[DocumentUploadAdapterSimplified] Error loading units:', error);
        toast.error('Failed to load units of competency');
      } finally {
        setIsLoadingUnits(false);
      }
    };

    loadUnits();
  }, []);

  // Filter units based on search term
  useEffect(() => {
    if (!unitSearchTerm) {
      setFilteredUnits([]);
      setShowUnitDropdown(false);
      return;
    }

    const searchLower = unitSearchTerm.toLowerCase();
    const filtered = allUnits.filter(unit => 
      unit.unitCode?.toLowerCase().includes(searchLower) ||
      unit.Title?.toLowerCase().includes(searchLower)
    ).slice(0, 10); // Limit to 10 results

    setFilteredUnits(filtered);
    setShowUnitDropdown(filtered.length > 0);
  }, [unitSearchTerm, allUnits]);

  // Handle unit selection from dropdown
  const handleUnitSelect = (unit: any) => {
    console.log('[DocumentUploadAdapterSimplified] Selected unit object:', unit);
    console.log('[DocumentUploadAdapterSimplified] Unit.Link value:', unit.Link);
    
    setSelectedUnit({
      id: unit.id,
      code: unit.unitCode,
      title: unit.Title,
      Link: unit.Link, // ← Required for requirements linking
    });
    setUnitSearchTerm(unit.unitCode);
    setShowUnitDropdown(false);
    toast.success(`Unit ${unit.unitCode} selected`);
  };

  // Handle search input change
  const handleSearchChange = (value: string) => {
    setUnitSearchTerm(value);
    if (!value) {
      setSelectedUnit(null);
    }
  };

  // Debug: Log Next button state whenever it changes
  useEffect(() => {
    const buttonDisabled = !isComplete || uploadedCount !== selectedFiles.length;
    console.log('[Next Button State] 🔘', {
      isComplete,
      uploadedCount,
      selectedFilesLength: selectedFiles.length,
      uploadedDocumentsLength: uploadedDocuments.length,
      buttonDisabled,
      buttonShouldBeEnabled: isComplete && uploadedCount === selectedFiles.length,
      reasons: {
        notComplete: !isComplete,
        countMismatch: uploadedCount !== selectedFiles.length
      }
    });
  }, [isComplete, uploadedCount, selectedFiles.length, uploadedDocuments.length]);

  // Handle Enter key to auto-select exact match
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && unitSearchTerm && filteredUnits.length > 0) {
      // Check for exact match first
      const exactMatch = filteredUnits.find(
        unit => unit.unitCode?.toUpperCase() === unitSearchTerm.toUpperCase()
      );
      
      if (exactMatch) {
        handleUnitSelect(exactMatch);
      } else {
        // Select first result if no exact match
        handleUnitSelect(filteredUnits[0]);
      }
    }
  };

  // Handle upload start - no longer creates validation (moved to ValidationTriggerCard)
  const handleUploadStart = useCallback(async () => {
    console.log('[DocumentUploadAdapterSimplified] Upload started');
    // Validation record will be created when user types "validate" in the dialog
  }, []);

  // Handle file selection (just update state, don't create validation)
  const handleFilesSelected = useCallback((files: File[]) => {
    console.log('[DocumentUploadAdapterSimplified] 📁 Files selected:', files.length);
    
    // Always update selectedFiles to ensure sync
    setSelectedFiles(files);
    
    // Reset upload state for new selection
    console.log('[DocumentUploadAdapterSimplified] 🔄 Resetting upload state for new file selection');
    setUploadedCount(0);
    setUploadedDocuments([]);
    setIsComplete(false);
  }, []);

  // Handle upload complete (storage only, n8n creates DB records)
  const handleUploadComplete = useCallback((fileName: string, storagePath: string) => {
    console.log('[DocumentUploadAdapterSimplified] ✅ Upload complete callback fired!', {
      fileName,
      storagePath,
    });
    
    // Add to uploaded documents list
    setUploadedDocuments(prev => {
      const updated = [...prev, { fileName, storagePath }];
      console.log(`[DocumentUploadAdapterSimplified] 📊 Uploaded documents: ${updated.length}`);
      
      // Check completion immediately after state update
      setUploadedCount(currentCount => {
        const newCount = currentCount + 1;
        console.log(`[DocumentUploadAdapterSimplified] 📊 Upload count: ${newCount}/${selectedFiles.length}`);
        
        // Check if all uploads are complete RIGHT NOW
        if (newCount === selectedFiles.length && selectedFiles.length > 0) {
          console.log('[DocumentUploadAdapterSimplified] 🎉 COMPLETION DETECTED! All files uploaded!');
          // Use setTimeout to ensure state update completes
          setTimeout(() => {
            setIsComplete(true);
            toast.success('Upload complete!', {
              description: 'Click "Next: Start Validation" to continue.',
              duration: 5000,
            });
          }, 100);
        } else {
          console.log(`[DocumentUploadAdapterSimplified] ⏳ Still uploading: ${newCount}/${selectedFiles.length}`);
        }
        
        return newCount;
      });
      
      return updated;
    });
  }, [selectedFiles.length]);

  // Check if all uploads are complete (runs whenever uploadedCount changes)
  useEffect(() => {
    console.log('[DocumentUploadAdapterSimplified] 🔍 Checking completion...', {
      uploadedCount,
      selectedFilesLength: selectedFiles.length,
      isComplete,
      shouldComplete: uploadedCount > 0 && uploadedCount === selectedFiles.length && !isComplete
    });
    
    if (uploadedCount > 0 && uploadedCount === selectedFiles.length && !isComplete) {
      console.log('[DocumentUploadAdapterSimplified] 🎉 All files uploaded! Setting isComplete=true');
      setIsComplete(true);
      
      toast.success('Upload complete!', {
        description: 'Click "Next: Start Validation" to continue.',
        duration: 5000,
      });
    }
  }, [uploadedCount, selectedFiles.length, isComplete]);

  // Reset form to start a new validation
  const handleStartNew = () => {
    console.log('[DocumentUploadAdapterSimplified] Starting new validation...');
    setSelectedFiles([]);
    setUploadedCount(0);
    setIsComplete(false);
    setSelectedUnit(null);
    setUnitSearchTerm('');
    toast.info('Form reset. Ready for new validation.');
  };

  // Handle start validation button
  const handleStartValidation = () => {
    console.log('[DocumentUploadAdapterSimplified] Starting validation...');
    console.log('[DocumentUploadAdapterSimplified] Files:', selectedFiles.length);
    console.log('[DocumentUploadAdapterSimplified] Unit:', selectedUnit?.code);
    console.log('[DocumentUploadAdapterSimplified] RTO:', selectedRTO?.code);

    if (!selectedFiles.length) {
      toast.error('Please select files to upload');
      return;
    }

    if (!selectedUnit) {
      toast.error('Please select a unit of competency');
      return;
    }

    // Files are uploaded instantly by DocumentUploadSimplified
    // Just need to trigger the upload
    console.log('[DocumentUploadAdapterSimplified] Ready to upload');
  };

  return (
    <div className="min-h-screen bg-[#f8f9fb] p-4 md:p-8">
      <div className={`max-w-7xl mx-auto space-y-6 ${selectedFiles.length > 0 && selectedUnit ? 'pb-24' : ''}`}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-[#1e293b]">Upload & Validate</h1>
            <p className="text-[#64748b] mt-1">Upload assessment documents for instant validation</p>
          </div>
        </div>

        {/* Validation Type Selection - Side by Side Tiles */}
        <RadioGroup value={validationType} onValueChange={(value: 'unit' | 'learner_guide') => setValidationType(value)}>
          <div className="flex gap-4">
          {/* Unit of Competency - Blue Tile */}
          <div
            onClick={() => setValidationType('unit')}
            className={`flex-1 relative cursor-pointer rounded-xl border-2 transition-all ${
              validationType === 'unit'
                ? 'border-[#3b82f6] bg-[#dbeafe]'
                : 'border-[#e2e8f0] bg-white hover:border-[#3b82f6]/50'
            }`}
          >
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                  validationType === 'unit' ? 'bg-[#3b82f6]' : 'bg-[#dbeafe]'
                }`}>
                  <FileText className={`w-6 h-6 ${
                    validationType === 'unit' ? 'text-white' : 'text-[#3b82f6]'
                  }`} />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-[#1e293b]">Unit of Competency</h3>
                  <p className="text-sm text-[#64748b]">Validate assessment documents</p>
                </div>
                <RadioGroupItem value="unit" id="unit-tile" checked={validationType === 'unit'} />
              </div>
            </div>
          </div>

          {/* Learner Guide - Green Tile */}
          <div
            onClick={() => setValidationType('learner_guide')}
            className={`flex-1 relative cursor-pointer rounded-xl border-2 transition-all ${
              validationType === 'learner_guide'
                ? 'border-[#22c55e] bg-[#dcfce7]'
                : 'border-[#e2e8f0] bg-white hover:border-[#22c55e]/50'
            }`}
          >
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                  validationType === 'learner_guide' ? 'bg-[#22c55e]' : 'bg-[#dcfce7]'
                }`}>
                  <FileText className={`w-6 h-6 ${
                    validationType === 'learner_guide' ? 'text-white' : 'text-[#22c55e]'
                  }`} />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-[#1e293b]">Learner Guide</h3>
                  <p className="text-sm text-[#64748b]">Validate learner materials</p>
                </div>
                <RadioGroupItem value="learner_guide" id="learner-guide-tile" checked={validationType === 'learner_guide'} />
              </div>
            </div>
          </div>
          </div>
        </RadioGroup>

        {/* Unit Selection */}
        <Card className="p-6 bg-white">
          <h2 className="text-xl font-semibold text-[#1e293b] mb-4">1. Select Unit of Competency</h2>
          <div className="space-y-4">
            <div className="relative">
              <label className="block text-sm font-medium text-[#64748b] mb-2">
                Unit Code
              </label>
              <input
                type="text"
                placeholder={isLoadingUnits ? "Loading units..." : "Search by code or title (e.g., BSBWHS521). Press Enter to select."}
                value={unitSearchTerm}
                onChange={(e) => handleSearchChange(e.target.value.toUpperCase())}
                onKeyDown={handleKeyDown}
                onFocus={() => {
                  // Only show dropdown if user is searching and hasn't selected a unit yet
                  // or if search term differs from selected unit
                  if (unitSearchTerm && (!selectedUnit || unitSearchTerm !== selectedUnit.code)) {
                    setShowUnitDropdown(true);
                  }
                }}
                onBlur={() => {
                  // Close dropdown when clicking outside (with small delay to allow click on dropdown items)
                  setTimeout(() => setShowUnitDropdown(false), 200);
                }}
                disabled={isLoadingUnits}
                className="w-full px-4 py-2 border border-[#e2e8f0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6] disabled:bg-gray-100"
              />
              
              {/* Autocomplete Dropdown */}
              {showUnitDropdown && filteredUnits.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-[#e2e8f0] rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {filteredUnits.map((unit) => (
                    <button
                      key={unit.id}
                      type="button"
                      onClick={() => handleUnitSelect(unit)}
                      className="w-full text-left px-4 py-3 hover:bg-[#f8f9fb] border-b border-[#e2e8f0] last:border-b-0 transition-colors"
                    >
                      <p className="font-semibold text-[#1e293b]">{unit.unitCode}</p>
                      <p className="text-sm text-[#64748b] truncate">{unit.Title}</p>
                    </button>
                  ))}
                </div>
              )}
              
              {unitSearchTerm && filteredUnits.length === 0 && !isLoadingUnits && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-[#e2e8f0] rounded-lg shadow-lg p-4 text-center text-[#64748b]">
                  <Info className="w-5 h-5 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No units found matching "{unitSearchTerm}"</p>
                </div>
              )}
            </div>
            
            {selectedUnit && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="font-semibold text-green-900">{selectedUnit.code}</p>
                    <p className="text-sm text-green-700">{selectedUnit.title}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Document Upload Section */}
        {selectedUnit && (
          <Card className="p-6 bg-white">
            <h2 className="text-xl font-semibold text-[#1e293b] mb-4">2. Upload Documents</h2>
            <DocumentUploadSimplified
              unitCode={selectedUnit.code}
              validationDetailId={undefined}
              onUploadComplete={handleUploadComplete}
              onFilesSelected={handleFilesSelected}
              onUploadStart={handleUploadStart}
              clearFilesOnNewValidation={true}
            />
          </Card>
        )}

        {/* Next Button - Always visible when files selected, enabled only after upload complete */}
        {selectedFiles.length > 0 && selectedUnit && (
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#e2e8f0] p-4 shadow-lg">
            <div className="max-w-7xl mx-auto flex justify-end">
              <Button
                onClick={() => {
                  console.log('[Next Button] Clicked, current state:', {
                    isComplete,
                    uploadedCount,
                    selectedFilesLength: selectedFiles.length,
                    uploadedDocumentsLength: uploadedDocuments.length
                  });
                  setShowValidationDialog(true);
                }}
                disabled={!isComplete || uploadedCount !== selectedFiles.length}
                size="lg"
                className="bg-[#3b82f6] hover:bg-[#2563eb] text-white px-8 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next: Start Validation
              </Button>
            </div>
          </div>
        )}

        {/* Validation Confirmation Dialog */}
        {showValidationDialog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full p-6 space-y-4">
              <ValidationTriggerCard
                uploadedCount={uploadedCount}
                totalCount={selectedFiles.length}
                storagePaths={uploadedDocuments.map(doc => doc.storagePath)}
                rtoCode={selectedRTO?.code}
                unitCode={selectedUnit?.code}
                unitLink={selectedUnit?.Link}
                validationType={validationType}
                onSuccess={() => {
                  setShowValidationDialog(false);
                  // Navigate to dashboard after validation starts
                  if (onValidationSubmit) {
                    onValidationSubmit({
                      validationId: 0, // Will be created by ValidationTriggerCard
                      documentName: selectedFiles[0]?.name || 'document',
                      unitCode: selectedUnit?.code || 'unknown'
                    });
                  }
                }}
              />
              <Button
                variant="outline"
                onClick={() => setShowValidationDialog(false)}
                className="w-full"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
