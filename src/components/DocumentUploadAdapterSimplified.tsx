/**
 * DocumentUploadAdapterSimplified - Instant Upload Wrapper
 * 
 * Simplified adapter that uses DocumentUploadSimplified for instant uploads.
 * Upload completes immediately, validation happens in background via DB trigger.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { DocumentUploadSimplified } from './upload/DocumentUploadSimplified';
import { getRTOById, fetchRTOById } from '../types/rto';
import { supabase } from '../lib/supabase';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { FileText, CheckCircle, Info, Plus } from 'lucide-react';

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
  const [isComplete, setIsComplete] = useState(false);
  const [unitSearchTerm, setUnitSearchTerm] = useState('');
  const [allUnits, setAllUnits] = useState<any[]>([]);
  const [filteredUnits, setFilteredUnits] = useState<any[]>([]);
  const [showUnitDropdown, setShowUnitDropdown] = useState(false);
  const [isLoadingUnits, setIsLoadingUnits] = useState(false);
  const [validationDetailId, setValidationDetailId] = useState<number | undefined>(undefined);
  const [isCreatingValidation, setIsCreatingValidation] = useState(false);

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

  // Handle file selection (memoized to prevent infinite loop)
  const handleFilesSelected = useCallback(async (files: File[]) => {
    console.log('[DocumentUploadAdapterSimplified] Files selected:', files.length);
    
    // Don't set files yet - wait for validation to be created first
    setUploadedCount(0);
    setIsComplete(false);

    // Create validation record when files are selected (MUST complete before upload)
    if (files.length > 0 && !validationDetailId && selectedRTO && selectedUnit) {
      setIsCreatingValidation(true);
      try {
        console.log('[DocumentUploadAdapterSimplified] Creating validation record...');
        console.log('[DocumentUploadAdapterSimplified] Unit details:', {
          code: selectedUnit.code,
          Link: selectedUnit.Link,
          hasLink: !!selectedUnit.Link
        });
        
        // Verify unitLink exists
        if (!selectedUnit.Link) {
          console.error('[DocumentUploadAdapterSimplified] Unit Link is missing!');
          toast.error('Selected unit is missing Link. Please select a different unit.');
          return;
        }
        
        // Create session-specific namespace with timestamp for document isolation
        const sessionNamespace = `${selectedRTO.code}-${selectedUnit.code}-${Date.now()}`;
        
        const { data, error } = await supabase.functions.invoke('create-validation-record', {
          body: {
            rtoCode: selectedRTO.code,
            unitCode: selectedUnit.code,
            unitLink: selectedUnit.Link, // Pass unit URL for requirements linking (REQUIRED)
            validationType: 'assessment',
            pineconeNamespace: sessionNamespace // Session-specific namespace for document filtering
          }
        });

        if (error) {
          console.error('[DocumentUploadAdapterSimplified] Failed to create validation:', error);
          
          // Check for specific error messages
          const errorMsg = error.message || '';
          if (errorMsg.includes('No requirements found')) {
            toast.error(
              'Requirements not found for this unit. Please use Unit Acquisition to extract requirements first.',
              { duration: 6000 }
            );
          } else if (errorMsg.includes('Requirements not yet extracted')) {
            toast.error(
              'Requirements are still being extracted for this unit. Please wait and try again.',
              { duration: 6000 }
            );
          } else {
            toast.error(`Failed to create validation: ${errorMsg}`);
          }
          return;
        }

        console.log('[DocumentUploadAdapterSimplified] ✅ Validation created:', data.detailId);
        setValidationDetailId(data.detailId);
        
        // NOW set the files after validation is created
        console.log('[DocumentUploadAdapterSimplified] Now proceeding with file upload...');
        setSelectedFiles(files);
        
      } catch (error) {
        console.error('[DocumentUploadAdapterSimplified] Exception creating validation:', error);
        toast.error('Failed to create validation record');
        return;
      } finally {
        setIsCreatingValidation(false);
      }
    } else if (validationDetailId) {
      // Validation already exists, proceed with upload
      console.log('[DocumentUploadAdapterSimplified] Using existing validation:', validationDetailId);
      setSelectedFiles(files);
    }
  }, [validationDetailId, selectedRTO, selectedUnit]);

  // Handle upload complete (instant - just storage upload)
  const handleUploadComplete = (documentId: number) => {
    console.log('[DocumentUploadAdapterSimplified] Upload complete (instant)');
    
    // Update count and check if all files are done
    setUploadedCount(prev => {
      const newCount = prev + 1;
      console.log(`[DocumentUploadAdapterSimplified] Upload progress: ${newCount}/${selectedFiles.length}`);
      
      // Check if all files uploaded using the NEW count
      if (newCount >= selectedFiles.length) {
        console.log('[DocumentUploadAdapterSimplified] All files uploaded!');
        setIsComplete(true);
        
        // Show success message
        toast.success('Upload complete! Redirecting to Dashboard...', {
          description: 'Indexing and validation are running in the background.',
          duration: 2000,
        });

        // Auto-navigate to dashboard after 2 seconds
        setTimeout(() => {
          console.log('[DocumentUploadAdapterSimplified] Auto-navigating to dashboard...');
          if (onValidationSubmit) {
            onValidationSubmit({
              validationId: 0, // Will be assigned by edge function
              documentName: selectedFiles[0]?.name || 'document',
              unitCode: selectedUnit?.code || 'unknown'
            });
          }
        }, 2000);
      }
      
      return newCount;
    });
  };

  // Reset form to start a new validation
  const handleStartNew = () => {
    console.log('[DocumentUploadAdapterSimplified] Starting new validation...');
    setSelectedFiles([]);
    setUploadedCount(0);
    setIsComplete(false);
    setSelectedUnit(null);
    setUnitSearchTerm('');
    setValidationDetailId(undefined);
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
    <div className="min-h-screen bg-[#f8f9fb] p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-[#1e293b]">Upload & Validate</h1>
            <p className="text-[#64748b] mt-1">Upload assessment documents for instant validation</p>
          </div>
        </div>

        {/* Info Card */}
        <Card className="p-6 bg-blue-50 border-blue-200">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="space-y-2">
              <h3 className="font-semibold text-blue-900">Instant Upload Process</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>✅ Upload completes in &lt;1 second</li>
                <li>✅ You can close this page immediately</li>
                <li>✅ Processing happens automatically in the background</li>
                <li>✅ Check the Dashboard for progress and results</li>
              </ul>
            </div>
          </div>
        </Card>

        {/* RTO Info */}
        {selectedRTO && (
          <Card className="p-4 bg-white">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#3b82f6]" />
              <div>
                <p className="text-sm text-[#64748b]">Selected RTO</p>
                <p className="font-semibold text-[#1e293b]">{selectedRTO.name} ({selectedRTO.code})</p>
              </div>
            </div>
          </Card>
        )}

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
                placeholder={isLoadingUnits ? "Loading units..." : "Search by code or title (e.g., BSBWHS521)"}
                value={unitSearchTerm}
                onChange={(e) => handleSearchChange(e.target.value.toUpperCase())}
                onFocus={() => unitSearchTerm && setShowUnitDropdown(true)}
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

        {/* File Upload */}
        <Card className="p-6 bg-white">
          <h2 className="text-xl font-semibold text-[#1e293b] mb-4">2. Upload Assessment Documents</h2>
          {selectedUnit ? (
            <DocumentUploadSimplified
              unitCode={selectedUnit.code}
              validationDetailId={validationDetailId}
              onUploadComplete={handleUploadComplete}
              onFilesSelected={handleFilesSelected}
            />
          ) : (
            <div className="text-center py-8 text-[#64748b]">
              <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Please select a unit of competency first</p>
            </div>
          )}
        </Card>

        {/* Success Message */}
        {isComplete && (
          <Card className="p-6 bg-green-50 border-green-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-green-900">Upload Complete!</h3>
                  <p className="text-sm text-green-700 mt-1">
                    {uploadedCount} file{uploadedCount !== 1 ? 's' : ''} uploaded successfully. 
                    Processing is happening in the background. Check the Dashboard for progress.
                  </p>
                </div>
              </div>
              <Button
                onClick={handleStartNew}
                variant="outline"
                className="flex items-center gap-2 border-green-600 text-green-700 hover:bg-green-100"
              >
                <Plus className="w-4 h-4" />
                Start New Validation
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
