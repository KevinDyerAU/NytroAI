/**
 * DocumentUploadAdapterSimplified - Instant Upload Wrapper
 * 
 * Simplified adapter that uses DocumentUploadSimplified for instant uploads.
 * Upload completes immediately, validation happens in background via DB trigger.
 */

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { DocumentUploadSimplified } from './upload/DocumentUploadSimplified';
import { getRTOById, fetchRTOById } from '../types/rto';
import { supabase } from '../lib/supabase';
import { Card } from './ui/card';
import { FileText, CheckCircle, Info } from 'lucide-react';

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

  // Load RTO data
  useEffect(() => {
    const loadRTO = async () => {
      if (!selectedRTOId) return;

      let rto = getRTOById(selectedRTOId);
      if (!rto) {
        rto = await fetchRTOById(selectedRTOId);
      }
      setSelectedRTO(rto);
    };

    loadRTO();
  }, [selectedRTOId]);

  // Handle unit selection
  const handleUnitSelect = async (unitCode: string) => {
    if (!unitCode) return;
    
    // Fetch unit from database
    const { data, error } = await supabase
      .from('unit_of_competency')
      .select('*')
      .eq('code', unitCode)
      .single();
    
    if (error || !data) {
      toast.error(`Unit ${unitCode} not found`);
      setSelectedUnit(null);
      return;
    }
    
    setSelectedUnit(data);
    toast.success(`Unit ${unitCode} selected`);
  };

  // Handle file selection
  const handleFilesSelected = (files: File[]) => {
    console.log('[DocumentUploadAdapterSimplified] Files selected:', files.length);
    setSelectedFiles(files);
    setUploadedCount(0);
    setIsComplete(false);
  };

  // Handle upload complete (instant - just storage upload)
  const handleUploadComplete = (documentId: number) => {
    console.log('[DocumentUploadAdapterSimplified] Upload complete (instant)');
    setUploadedCount(prev => prev + 1);

    // Check if all files uploaded
    if (uploadedCount + 1 >= selectedFiles.length) {
      console.log('[DocumentUploadAdapterSimplified] All files uploaded!');
      setIsComplete(true);
      
      // Show success message
      toast.success('Upload complete! Processing in background...', {
        description: 'Check the Dashboard for progress and results.',
        duration: 5000,
      });

      // Notify parent
      if (onValidationSubmit) {
        onValidationSubmit({
          validationId: 0, // Will be assigned by edge function
          documentName: selectedFiles[0]?.name || 'document',
          unitCode: selectedUnit?.code || 'unknown'
        });
      }
    }
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
            <div>
              <label className="block text-sm font-medium text-[#64748b] mb-2">
                Unit Code
              </label>
              <input
                type="text"
                placeholder="e.g., BSBWHS521"
                className="w-full px-4 py-2 border border-[#e2e8f0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6]"
                onChange={(e) => handleUnitSelect(e.target.value.toUpperCase())}
              />
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
              rtoCode={selectedRTO?.code || ''}
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
            <div className="flex items-center gap-3">
              <CheckCircle className="w-6 h-6 text-green-600" />
              <div>
                <h3 className="font-semibold text-green-900">Upload Complete!</h3>
                <p className="text-sm text-green-700 mt-1">
                  {uploadedCount} file{uploadedCount !== 1 ? 's' : ''} uploaded successfully. 
                  Processing is happening in the background. Check the Dashboard for progress.
                </p>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
