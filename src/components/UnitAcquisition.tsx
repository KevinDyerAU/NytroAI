import React, { useState, useEffect } from 'react';
import { Card } from './ui/card';
import { Input } from './ui/input';
import { GlowButton } from './GlowButton';
import { StatusBadge } from './StatusBadge';
import { Target, Search, ExternalLink, RefreshCw, Sparkles, Eye, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { fetchUnitsOfCompetency } from '../types/rto';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import {
  AlertDialog,
  AlertDialogContent,
} from "./ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';

// Import wizard logo
import wizardLogo from '../assets/wizard-logo.png';

interface UnitAcquisitionProps {
  selectedRTOId: string;
}

interface UnitOfCompetency {
  id: number;
  unitCode: string;
  Title?: string;
  created_at?: string;
  link?: string;
}

export function UnitAcquisition({ selectedRTOId }: UnitAcquisitionProps) {
  const [unitCode, setUnitCode] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [showSuccessAlert, setShowSuccessAlert] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [existingUnits, setExistingUnits] = useState<UnitOfCompetency[]>([]);
  const [isLoadingUnits, setIsLoadingUnits] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  // Progress modal state
  const [showAcquisitionModal, setShowAcquisitionModal] = useState(false);
  const [acquisitionStep, setAcquisitionStep] = useState('');

  // Unit details dialog state
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [detailUnit, setDetailUnit] = useState<UnitOfCompetency | null>(null);
  const [activeTab, setActiveTab] = useState('ke');
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [keReqs, setKeReqs] = useState<any[]>([]);
  const [peReqs, setPeReqs] = useState<any[]>([]);
  const [fsReqs, setFsReqs] = useState<any[]>([]);
  const [epcReqs, setEpcReqs] = useState<any[]>([]);
  const [acReqs, setAcReqs] = useState<any[]>([]);

  const extractUnitCode = (input: string): string => {
    // Extract unit code from full URL or just the code itself
    // URL format: https://training.gov.au/training/details/UNITCODE/unitdetails
    const match = input.match(/(?:\/details\/)?([A-Z0-9]+)(?:\/unitdetails)?$/i);
    return match ? match[1].toUpperCase() : '';
  };

  const buildWebhookUrl = (code: string): string => {
    if (!code.trim()) return '';
    return `https://training.gov.au/training/details/${code.trim()}/unitdetails`;
  };

  useEffect(() => {
    fetchExistingUnits();
  }, []);

  const fetchExistingUnits = async () => {
    setIsLoadingUnits(true);
    try {
      const data = await fetchUnitsOfCompetency();
      const formattedUnits = (data || []).map((unit: any) => ({
        id: unit.id,
        unitCode: unit.unitCode,
        Title: unit.Title,
        created_at: unit.created_at,
        link: unit.Link,
      }));
      setExistingUnits(formattedUnits);
    } catch (error) {
      console.error('Failed to fetch units (exception):', error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoadingUnits(false);
    }
  };

  const isValidUnitCode = (code: string): boolean => {
    return code.trim().length > 0;
  };

  const handleUnitCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    const extracted = extractUnitCode(input);
    setUnitCode(extracted || input);
  };

  const unitCodeExists = existingUnits.some(
    unit => unit.unitCode.toUpperCase() === unitCode.toUpperCase()
  );

  const isCodeValid = isValidUnitCode(unitCode);

  const filteredUnits = unitCode.trim()
    ? existingUnits.filter(unit =>
      unit.unitCode.toUpperCase().includes(unitCode.toUpperCase())
    )
    : existingUnits;

  // Pagination calculations
  const totalPages = Math.ceil(filteredUnits.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedUnits = filteredUnits.slice(startIndex, endIndex);

  // Reset to page 1 when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [unitCode]);

  // Open unit details dialog and fetch requirements
  const openUnitDetails = async (unit: UnitOfCompetency) => {
    setDetailUnit(unit);
    setShowDetailsDialog(true);
    setActiveTab('ke');
    setIsLoadingDetails(true);

    // Clear previous data
    setKeReqs([]);
    setPeReqs([]);
    setFsReqs([]);
    setEpcReqs([]);
    setAcReqs([]);

    try {
      // The requirements tables use unit_url which stores the full URL
      // Match using the unit's link (exact match) or unit code pattern in URL
      const unitLink = unit.link || '';
      const unitCodePattern = `%${unit.unitCode}%`;

      console.log('[UnitAcquisition] Fetching requirements for unit:', unit.unitCode);
      console.log('[UnitAcquisition] Link URL:', unitLink);

      // Fetch from all 5 requirements tables in parallel
      // Use .eq() for exact URL match since that's how the data is stored
      const [keResult, peResult, fsResult, epcResult, acResult] = await Promise.all([
        supabase.from('knowledge_evidence_requirements')
          .select('*')
          .eq('unit_url', unitLink),
        supabase.from('performance_evidence_requirements')
          .select('*')
          .eq('unit_url', unitLink),
        supabase.from('foundation_skills_requirements')
          .select('*')
          .eq('unit_url', unitLink),
        supabase.from('elements_performance_criteria_requirements')
          .select('*')
          .eq('unit_url', unitLink),
        supabase.from('assessment_conditions_requirements')
          .select('*')
          .eq('unit_url', unitLink),
      ]);

      setKeReqs(keResult.data || []);
      setPeReqs(peResult.data || []);
      setFsReqs(fsResult.data || []);
      setEpcReqs(epcResult.data || []);
      setAcReqs(acResult.data || []);
    } catch (error) {
      console.error('Failed to load unit requirements:', error);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handleAcquire = async () => {
    if (!isCodeValid || unitCodeExists) return;

    const originUrl = buildWebhookUrl(unitCode);
    setIsScanning(true);
    setShowAcquisitionModal(true);
    setAcquisitionStep('Preparing extraction...');

    try {
      // Step 1: Validate configuration
      setAcquisitionStep('Checking configuration...');
      await new Promise(resolve => setTimeout(resolve, 300));

      const n8nUrl = import.meta.env.VITE_N8N_WEB_SCRAPE_URL;

      if (!n8nUrl) {
        throw new Error('N8N Web Scrape URL not configured. Please set VITE_N8N_WEB_SCRAPE_URL in environment variables.');
      }

      // Step 2: Connect to training.gov.au
      setAcquisitionStep(`Connecting to training.gov.au...`);
      await new Promise(resolve => setTimeout(resolve, 400));

      // Build callback webhook URL (for n8n to send results back)
      const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/scrape-training-gov-au`;

      // Step 3: Send extraction request
      setAcquisitionStep(`Extracting unit ${unitCode}...`);
      await new Promise(resolve => setTimeout(resolve, 300));

      const response = await fetch(n8nUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          originUrl: originUrl,
          webhookUrl: webhookUrl,
          executionMode: 'production',
        }),
      });

      // Step 4: Processing response
      setAcquisitionStep('Processing requirements...');
      await new Promise(resolve => setTimeout(resolve, 300));

      // Check response status first
      if (!response.ok) {
        console.error('Webhook request failed:');
        console.error('Status:', response.status, response.statusText);

        // Try to get error message from response body
        let errorText = 'Webhook request failed';
        try {
          const text = await response.text();
          if (text) {
            errorText = text;
          }
        } catch (e) {
          // Ignore if we can't read the error
        }

        throw new Error(errorText);
      }

      // Response is OK - try to parse JSON if there's content
      let result = null;
      const contentType = response.headers.get('content-type');

      if (contentType && contentType.includes('application/json')) {
        try {
          const text = await response.text();
          if (text && text.trim()) {
            result = JSON.parse(text);
          }
        } catch (jsonError) {
          console.warn('Could not parse JSON response, but request was successful:', jsonError);
          // Continue anyway since the request was successful
        }
      }

      // Step 5: Saving to database
      setAcquisitionStep('Saving to database...');
      await new Promise(resolve => setTimeout(resolve, 300));

      console.log('Webhook request successful', result);

      // Close modal and show success
      setShowAcquisitionModal(false);
      setAcquisitionStep('');
      setSuccessMessage(`Successfully initiated extraction for ${unitCode}. Requirements will be processed and saved to the database.`);
      setShowSuccessAlert(true);

      // Refresh the units list
      await fetchExistingUnits();

      // Auto-dismiss after 8 seconds and clear filter
      setTimeout(() => {
        setShowSuccessAlert(false);
        setUnitCode('');
      }, 8000);
    } catch (error) {
      console.error('Error sending webhook:', error);
      setShowAcquisitionModal(false);
      setAcquisitionStep('');
      // Show error to user
      setSuccessMessage(`Failed to extract unit: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setShowSuccessAlert(true);
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9fb] p-4 md:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-poppins text-[#1e293b] mb-2">
          Unit Acquisition
        </h1>
        <p className="text-[#64748b]">Extract Units of Competency from training.gov.au</p>
      </div>

      {/* Targeting System */}
      <Card className="border border-[#dbeafe] bg-white p-4 md:p-8 shadow-soft mb-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-lg bg-[#dbeafe] border border-[#3b82f6] flex items-center justify-center">
            <Target className="w-6 h-6 text-[#3b82f6]" />
          </div>
          <div>
            <h2 className="font-poppins text-[#1e293b]">Extract Unit Requirements</h2>
            <p className="text-sm text-[#64748b]">Enter training.gov.au URL to extract requirements</p>
          </div>
        </div>

        <div className="relative">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Input
                value={unitCode}
                onChange={handleUnitCodeChange}
                placeholder="Unit Code (e.g., TLIF0025)"
                className="h-14 bg-white border-2 border-[#dbeafe] focus:border-[#3b82f6]"
              />
              {isScanning && (
                <div className="absolute inset-0 border-2 border-[#3b82f6] animate-pulse rounded-md"></div>
              )}
            </div>

            <GlowButton
              variant="primary"
              onClick={handleAcquire}
              disabled={isScanning || !isCodeValid || unitCodeExists}
              className="h-14 px-8"
            >
              {isScanning ? (
                <>
                  <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                  Scanning...
                </>
              ) : (
                <>
                  <Target className="w-5 h-5 mr-2" />
                  Extract Unit
                </>
              )}
            </GlowButton>
          </div>

          {/* Scan Animation */}
          {isScanning && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 bg-[#e2e8f0] rounded-full overflow-hidden">
                  <div className="h-full bg-[#3b82f6] animate-pulse" style={{ width: '60%' }}></div>
                </div>
                <span className="text-xs text-[#64748b]">Extracting requirements...</span>
              </div>
            </div>
          )}
        </div>

        {/* Unit Already Exists Message */}
        {unitCodeExists && isCodeValid && (
          <div className="mt-6 p-4 bg-[#fef3c7] border border-[#fcd34d] rounded-lg">
            <p className="text-sm text-[#92400e]">
              <span className="font-semibold">⚠</span> Unit {unitCode} already exists in the system
            </p>
          </div>
        )}

        {/* Success Alert */}
        {showSuccessAlert && (
          <div className="mt-6 p-4 bg-[#dcfce7] border border-[#86efac] rounded-lg">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-[#16a34a]" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-[#166534]">Requirements Extraction Initiated</p>
                <p className="text-sm text-[#15803d] mt-1">{successMessage}</p>
              </div>
              <button
                onClick={() => {
                  setShowSuccessAlert(false);
                  setUnitCode('');
                }}
                className="flex-shrink-0 text-[#16a34a] hover:text-[#15803d] transition-colors"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Info Panel */}
        <div className="mt-6 p-4 bg-[#f8f9fb] border border-[#dbeafe] rounded-lg">
          <p className="text-xs text-[#64748b] leading-relaxed">
            <span className="text-[#3b82f6]">▸</span> Enter the unit code or paste the full training.gov.au URL
            <br />
            <span className="text-[#3b82f6]">▸</span> System will automatically extract the unit code and retrieve all performance criteria and knowledge evidence
            <br />
            <span className="text-[#3b82f6]">▸</span> Extracted data will be available for document validation
          </p>
        </div>
      </Card>

      {/* Existing Units Table */}
      <Card className="border border-[#dbeafe] bg-white p-6 shadow-soft">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-poppins text-[#1e293b]">Existing Units</h2>
            {unitCode.trim() && filteredUnits.length > 0 && (
              <p className="text-xs text-[#64748b] mt-1">Showing {filteredUnits.length} result{filteredUnits.length !== 1 ? 's' : ''} for "{unitCode}"</p>
            )}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Search units..."
              className="w-64 bg-white border-[#dbeafe]"
            />
            <GlowButton variant="secondary" size="icon">
              <Search className="w-4 h-4" />
            </GlowButton>
          </div>
        </div>

        <div className="border border-[#dbeafe] rounded-lg overflow-hidden">
          {isLoadingUnits ? (
            <div className="p-8 text-center text-[#64748b]">
              <p className="text-sm">Loading units...</p>
            </div>
          ) : unitCode.trim() && filteredUnits.length === 0 ? (
            <div className="p-8 text-center text-[#64748b]">
              <p className="text-sm">No units matching "{unitCode}" found</p>
            </div>
          ) : existingUnits.length === 0 && !unitCode.trim() ? (
            <div className="p-8 text-center text-[#64748b]">
              <p className="text-sm">No units of competency in the system yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-[#dbeafe] bg-[#f8f9fb]">
                  <TableHead className="font-poppins text-[#64748b]">Unit Code</TableHead>
                  <TableHead className="font-poppins text-[#64748b]">Title</TableHead>
                  <TableHead className="font-poppins text-[#64748b]">Date Captured</TableHead>
                  <TableHead className="font-poppins text-[#64748b]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedUnits.map((unit) => (
                  <TableRow
                    key={unit.id}
                    className="border-[#dbeafe] hover:bg-[#f8f9fb] transition-colors"
                  >
                    <TableCell className="font-mono text-[#3b82f6]">{unit.unitCode}</TableCell>
                    <TableCell className="text-[#1e293b]">{unit.Title || '-'}</TableCell>
                    <TableCell className="text-sm text-[#64748b]">
                      {unit.created_at ? new Date(unit.created_at).toLocaleDateString('en-AU') : '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {/* View Requirements Button */}
                        <button
                          onClick={() => openUnitDetails(unit)}
                          className="p-2 rounded transition-colors hover:bg-[#dbeafe] text-[#3b82f6] cursor-pointer"
                          title="View extracted requirements"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {/* External Link Button */}
                        <button
                          onClick={() => {
                            if (unit.link) {
                              window.open(unit.link, '_blank', 'width=1024,height=768');
                            }
                          }}
                          disabled={!unit.link}
                          className={`p-2 rounded transition-colors ${unit.link
                            ? 'hover:bg-[#f1f5f9] text-[#64748b] hover:text-[#3b82f6] cursor-pointer'
                            : 'text-[#cbd5e1] cursor-not-allowed opacity-50'
                            }`}
                          title={unit.link ? 'Open on training.gov.au' : 'No link available'}
                        >
                          <ExternalLink className="w-4 h-4" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Pagination Controls */}
        {filteredUnits.length > ITEMS_PER_PAGE && (
          <div className="flex items-center justify-between mt-4 px-2">
            <div className="text-sm text-[#64748b]">
              Showing {startIndex + 1} to {Math.min(endIndex, filteredUnits.length)} of {filteredUnits.length} units
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className={`px-3 py-1 rounded border transition-colors ${currentPage === 1
                  ? 'border-[#e2e8f0] text-[#cbd5e1] cursor-not-allowed'
                  : 'border-[#dbeafe] text-[#64748b] hover:bg-[#f1f5f9] hover:border-[#3b82f6] hover:text-[#3b82f6]'
                  }`}
              >
                Previous
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                  // Show first page, last page, current page, and pages around current
                  const showPage =
                    page === 1 ||
                    page === totalPages ||
                    (page >= currentPage - 1 && page <= currentPage + 1);

                  const showEllipsis =
                    (page === 2 && currentPage > 3) ||
                    (page === totalPages - 1 && currentPage < totalPages - 2);

                  if (showEllipsis) {
                    return (
                      <span key={page} className="px-2 text-[#cbd5e1]">
                        ...
                      </span>
                    );
                  }

                  if (!showPage) return null;

                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`min-w-[2rem] px-3 py-1 rounded border transition-colors ${currentPage === page
                        ? 'border-[#3b82f6] bg-[#3b82f6] text-white'
                        : 'border-[#dbeafe] text-[#64748b] hover:bg-[#f1f5f9] hover:border-[#3b82f6] hover:text-[#3b82f6]'
                        }`}
                    >
                      {page}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className={`px-3 py-1 rounded border transition-colors ${currentPage === totalPages
                  ? 'border-[#e2e8f0] text-[#cbd5e1] cursor-not-allowed'
                  : 'border-[#dbeafe] text-[#64748b] hover:bg-[#f1f5f9] hover:border-[#3b82f6] hover:text-[#3b82f6]'
                  }`}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* Unit Acquisition Loading Modal */}
      <AlertDialog open={showAcquisitionModal} onOpenChange={setShowAcquisitionModal}>
        <AlertDialogContent className="max-w-md bg-white">
          <div className="flex flex-col items-center justify-center py-8 px-4">
            {/* Wizard logo */}
            <div className="mb-6 w-32">
              <img
                src={wizardLogo}
                alt="Nytro Wizard"
                className="w-full h-auto object-contain animate-pulse"
              />
            </div>

            <h3 className="font-poppins text-lg font-semibold text-[#1e293b] mb-3">
              Nytro is extracting...
            </h3>

            {/* Progress indicator */}
            <div className="w-full max-w-xs mb-4">
              <div className="h-2 bg-[#e2e8f0] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#22c55e] to-[#3b82f6] animate-pulse"
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            {/* Current step display */}
            <div className="flex items-center gap-2 mb-3 px-4 py-2 bg-[#f0fdf4] rounded-lg border border-[#86efac]">
              <Target className="w-4 h-4 text-[#16a34a] animate-spin" style={{ animationDuration: '1.5s' }} />
              <p className="text-sm font-medium text-[#166534]">
                {acquisitionStep || 'Initializing...'}
              </p>
            </div>

            {/* Bouncing dots */}
            <div className="flex items-center gap-2 mb-2">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-[#22c55e] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                <span className="w-2 h-2 bg-[#22c55e] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="w-2 h-2 bg-[#22c55e] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
              </div>
            </div>

            <p className="text-xs text-[#94a3b8] text-center">
              Extracting requirements from training.gov.au for {unitCode}
            </p>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unit Details Dialog */}
      <AlertDialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <AlertDialogContent className="max-w-5xl w-[90vw] h-[85vh] overflow-hidden bg-white p-0 flex flex-col">
          <div className="flex flex-col h-full min-h-0">
            {/* Header */}
            <div className="flex flex-none items-start justify-between p-6 border-b border-[#e2e8f0]">
              <div>
                <h3 className="font-poppins text-xl font-bold text-[#1e293b]">
                  {detailUnit?.unitCode} - {detailUnit?.Title || 'Unit Details'}
                </h3>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span className="px-2 py-0.5 rounded bg-[#dbeafe] text-[#1e40af] text-xs font-medium">
                    KE: {keReqs.length}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-[#dcfce7] text-[#166534] text-xs font-medium">
                    PE: {peReqs.length}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-[#fef3c7] text-[#92400e] text-xs font-medium">
                    FS: {fsReqs.length}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-[#e0e7ff] text-[#4338ca] text-xs font-medium">
                    EPC: {epcReqs.length}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-[#fce7f3] text-[#be185d] text-xs font-medium">
                    AC: {acReqs.length}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowDetailsDialog(false)}
                className="p-2 rounded-lg hover:bg-[#f1f5f9] text-[#64748b] hover:text-[#1e293b] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tabs Content */}
            <div className="flex-1 overflow-hidden flex flex-col min-h-0 p-6">
              {isLoadingDetails ? (
                <div className="flex items-center justify-center h-48">
                  <div className="text-center">
                    <RefreshCw className="w-8 h-8 text-[#3b82f6] animate-spin mx-auto mb-3" />
                    <p className="text-[#64748b]">Loading requirements...</p>
                  </div>
                </div>
              ) : (
                <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
                  <TabsList className="grid grid-cols-5 mb-4">
                    <TabsTrigger value="ke" className="text-xs">
                      Knowledge ({keReqs.length})
                    </TabsTrigger>
                    <TabsTrigger value="pe" className="text-xs">
                      Performance ({peReqs.length})
                    </TabsTrigger>
                    <TabsTrigger value="fs" className="text-xs">
                      Foundation ({fsReqs.length})
                    </TabsTrigger>
                    <TabsTrigger value="epc" className="text-xs">
                      Elements ({epcReqs.length})
                    </TabsTrigger>
                    <TabsTrigger value="ac" className="text-xs">
                      Conditions ({acReqs.length})
                    </TabsTrigger>
                  </TabsList>

                  <div className="flex-1 overflow-auto">
                    {/* Knowledge Evidence Tab */}
                    <TabsContent value="ke" className="mt-0 h-full">
                      {keReqs.length === 0 ? (
                        <div className="text-center py-8 text-[#64748b]">
                          <p>No knowledge evidence requirements found for this unit.</p>
                        </div>
                      ) : (
                        <div className="border border-[#e2e8f0] rounded-lg overflow-hidden">
                          <table className="w-full">
                            <thead className="bg-[#f8f9fb]">
                              <tr className="border-b border-[#e2e8f0]">
                                <th className="text-left py-3 px-4 text-[#1e293b] font-semibold w-24">KE #</th>
                                <th className="text-left py-3 px-4 text-[#1e293b] font-semibold">Knowledge Point</th>
                              </tr>
                            </thead>
                            <tbody>
                              {keReqs.map((req: any) => (
                                <tr key={req.id} className="border-b border-[#e2e8f0] hover:bg-[#f8f9fb]">
                                  <td className="py-3 px-4 font-mono text-[#3b82f6] font-semibold">{req.ke_number}</td>
                                  <td className="py-3 px-4 text-[#1e293b]">{req.knowled_point}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </TabsContent>

                    {/* Performance Evidence Tab */}
                    <TabsContent value="pe" className="mt-0 h-full">
                      {peReqs.length === 0 ? (
                        <div className="text-center py-8 text-[#64748b]">
                          <p>No performance evidence requirements found for this unit.</p>
                        </div>
                      ) : (
                        <div className="border border-[#e2e8f0] rounded-lg overflow-hidden">
                          <table className="w-full">
                            <thead className="bg-[#f8f9fb]">
                              <tr className="border-b border-[#e2e8f0]">
                                <th className="text-left py-3 px-4 text-[#1e293b] font-semibold w-24">PE #</th>
                                <th className="text-left py-3 px-4 text-[#1e293b] font-semibold">Performance Evidence</th>
                              </tr>
                            </thead>
                            <tbody>
                              {peReqs.map((req: any) => (
                                <tr key={req.id} className="border-b border-[#e2e8f0] hover:bg-[#f8f9fb]">
                                  <td className="py-3 px-4 font-mono text-[#22c55e] font-semibold">{req.pe_number}</td>
                                  <td className="py-3 px-4 text-[#1e293b]">{req.performance_evidence}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </TabsContent>

                    {/* Foundation Skills Tab */}
                    <TabsContent value="fs" className="mt-0 h-full">
                      {fsReqs.length === 0 ? (
                        <div className="text-center py-8 text-[#64748b]">
                          <p>No foundation skills requirements found for this unit.</p>
                        </div>
                      ) : (
                        <div className="border border-[#e2e8f0] rounded-lg overflow-hidden">
                          <table className="w-full">
                            <thead className="bg-[#f8f9fb]">
                              <tr className="border-b border-[#e2e8f0]">
                                <th className="text-left py-3 px-4 text-[#1e293b] font-semibold w-24">FS #</th>
                                <th className="text-left py-3 px-4 text-[#1e293b] font-semibold">Skill Point</th>
                              </tr>
                            </thead>
                            <tbody>
                              {fsReqs.map((req: any) => (
                                <tr key={req.id} className="border-b border-[#e2e8f0] hover:bg-[#f8f9fb]">
                                  <td className="py-3 px-4 font-mono text-[#f59e0b] font-semibold">{req.fs_number}</td>
                                  <td className="py-3 px-4 text-[#1e293b]">{req.skill_point}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </TabsContent>

                    {/* Elements & Performance Criteria Tab */}
                    <TabsContent value="epc" className="mt-0 h-full">
                      {epcReqs.length === 0 ? (
                        <div className="text-center py-8 text-[#64748b]">
                          <p>No elements & performance criteria found for this unit.</p>
                        </div>
                      ) : (
                        <div className="border border-[#e2e8f0] rounded-lg overflow-hidden">
                          <table className="w-full">
                            <thead className="bg-[#f8f9fb]">
                              <tr className="border-b border-[#e2e8f0]">
                                <th className="text-left py-3 px-4 text-[#1e293b] font-semibold w-24">EPC #</th>
                                <th className="text-left py-3 px-4 text-[#1e293b] font-semibold">Performance Criteria</th>
                              </tr>
                            </thead>
                            <tbody>
                              {epcReqs.map((req: any) => (
                                <tr key={req.id} className="border-b border-[#e2e8f0] hover:bg-[#f8f9fb]">
                                  <td className="py-3 px-4 font-mono text-[#6366f1] font-semibold">{req.epc_number}</td>
                                  <td className="py-3 px-4 text-[#1e293b]">{req.performance_criteria}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </TabsContent>

                    {/* Assessment Conditions Tab */}
                    <TabsContent value="ac" className="mt-0 h-full">
                      {acReqs.length === 0 ? (
                        <div className="text-center py-8 text-[#64748b]">
                          <p>No assessment conditions found for this unit.</p>
                        </div>
                      ) : (
                        <div className="border border-[#e2e8f0] rounded-lg overflow-hidden">
                          <table className="w-full">
                            <thead className="bg-[#f8f9fb]">
                              <tr className="border-b border-[#e2e8f0]">
                                <th className="text-left py-3 px-4 text-[#1e293b] font-semibold w-24">AC #</th>
                                <th className="text-left py-3 px-4 text-[#1e293b] font-semibold">Condition</th>
                              </tr>
                            </thead>
                            <tbody>
                              {acReqs.map((req: any) => (
                                <tr key={req.id} className="border-b border-[#e2e8f0] hover:bg-[#f8f9fb]">
                                  <td className="py-3 px-4 font-mono text-[#ec4899] font-semibold">{req.ac_number}</td>
                                  <td className="py-3 px-4 text-[#1e293b]">{req.condition_text}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </TabsContent>
                  </div>
                </Tabs>
              )}
            </div>

            {/* Footer */}
            <div className="flex-none border-t border-[#e2e8f0] p-4 flex justify-end gap-3">
              {detailUnit?.link && (
                <button
                  onClick={() => window.open(detailUnit.link, '_blank')}
                  className="px-4 py-2 text-[#3b82f6] border border-[#3b82f6] rounded-lg hover:bg-[#dbeafe] transition-colors flex items-center gap-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  View on training.gov.au
                </button>
              )}
              <button
                onClick={() => setShowDetailsDialog(false)}
                className="px-4 py-2 bg-[#1e40af] text-white rounded-lg hover:bg-[#1e3a8a] transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
