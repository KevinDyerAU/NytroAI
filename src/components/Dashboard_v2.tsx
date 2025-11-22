/**
 * Dashboard Component - Phase 3.1 Update
 * Uses new validation_status fields with real-time updates
 */

import React, { useState, useEffect } from 'react';
import { KPIWidget } from './KPIWidget';
import { Card } from './ui/card';
import { ValidationStatusCard } from './ValidationStatusCard';
import {
  Activity,
  FileText,
  TrendingUp,
  Target,
  Zap,
  ChevronLeft,
  ChevronRight,
  Info,
  RefreshCw
} from 'lucide-react';
import { Progress } from './ui/progress';
import { Button } from './ui/button';

import { 
  getRTOById, 
  type ValidationRecord 
} from '../types/rto';
import { 
  useDashboardMetrics, 
  useValidationCredits, 
  useAICredits 
} from '../hooks/useDashboardMetrics';
import { useValidationStatusList } from '../hooks/useValidationStatus';

interface DashboardProps {
  onValidationDoubleClick?: (validation: ValidationRecord) => void;
  selectedRTOId: string;
  creditsRefreshTrigger?: number;
}

export function Dashboard_v2({ 
  onValidationDoubleClick, 
  selectedRTOId, 
  creditsRefreshTrigger = 0 
}: DashboardProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Get RTO code from ID
  const currentRTO = getRTOById(selectedRTOId);
  const rtoCode = currentRTO?.code || null;

  // Use hooks for metrics and credits
  const { metrics } = useDashboardMetrics(selectedRTOId, rtoCode);
  const { credits: validationCredits } = useValidationCredits(selectedRTOId, creditsRefreshTrigger);
  const { credits: aiCredits } = useAICredits(selectedRTOId, creditsRefreshTrigger);

  // Use new validation status hook with real-time updates
  const { 
    validations, 
    isLoading: validationsLoading, 
    error: validationsError,
    refresh: refreshValidations 
  } = useValidationStatusList(rtoCode);

  // Reset to page 1 when validations change
  useEffect(() => {
    setCurrentPage(1);
  }, [validations]);

  // Calculate pagination
  const totalPages = Math.ceil(validations.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedValidations = validations.slice(startIndex, endIndex);

  // Filter active validations (not completed)
  const activeValidations = validations.filter(
    v => v.validation_status !== 'completed'
  );

  const handleValidationClick = (validation: any) => {
    if (onValidationDoubleClick) {
      // Convert to ValidationRecord format
      const record: ValidationRecord = {
        id: validation.id,
        unit_code: validation.unitCode,
        validation_type: validation.validation_type_name,
        extract_status: validation.extract_status,
        doc_extracted: validation.doc_extracted,
        req_extracted: false,
        num_of_req: validation.validation_count,
        req_total: validation.validation_total,
        completed_count: validation.validation_count,
        created_at: validation.created_at,
        rtoCode: validation.rtoCode,
      };
      onValidationDoubleClick(record);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9fb] p-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <h1 className="font-poppins text-[#1e293b]">
          Dashboard Overview
        </h1>
        <Button
          onClick={refreshValidations}
          variant="outline"
          size="sm"
          className="flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <KPIWidget
          title="Total Validations"
          value={metrics?.totalValidations.count.toString() || '0'}
          subtitle={metrics?.totalValidations.monthlyGrowth || '+0 this month'}
          icon={FileText}
          variant="blue"
          tooltip="Total number of validation records created for this RTO"
        />

        <KPIWidget
          title="Success Rate"
          value={`${metrics?.successRate.rate || 0}%`}
          subtitle={metrics?.successRate.changeText || '↑ 0% from last month'}
          icon={TrendingUp}
          variant="green"
          tooltip="Percentage of requirements marked as 'met' across all validations"
        />

        <KPIWidget
          title="Active Units"
          value={activeValidations.length.toString()}
          subtitle={`${validations.length} total validations`}
          icon={Activity}
          variant="grey"
          tooltip="Number of validations currently in progress"
        />

        <KPIWidget
          title="AI Queries"
          value={metrics?.aiQueries.count.toLocaleString() || '0'}
          subtitle={metrics?.aiQueries.period || 'This month'}
          icon={Zap}
          variant="blue"
          tooltip="Total AI operations this month"
        />
      </div>

      {/* Progress Bars Section */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        {/* Validation Credits */}
        <Card className="border border-[#dbeafe] bg-white p-6 shadow-soft">
          <div className="flex items-center justify-between mb-4">
            <h3 className="uppercase tracking-wide font-poppins text-[#64748b]">
              Validation Credits
            </h3>
            <FileText className={`w-5 h-5 ${validationCredits.current > 0 ? 'text-[#3b82f6]' : 'text-[#ef4444]'}`} />
          </div>

          <div className="mb-4">
            <div className="flex justify-between items-baseline mb-2">
              <span className={`font-poppins ${validationCredits.current > 0 ? 'text-[#1e293b]' : 'text-[#ef4444]'}`}>
                {validationCredits.current}
              </span>
              <span className="text-sm text-[#64748b]">/ {validationCredits.total}</span>
            </div>
            <Progress
              value={(validationCredits.current / validationCredits.total) * 100}
              className="h-3"
            />
          </div>

          <div className="flex justify-between items-center text-xs text-[#94a3b8]">
            <span>{validationCredits.percentageText}</span>
            <span className="uppercase">Credits</span>
          </div>
        </Card>

        {/* AI Credits */}
        <Card className="border border-[#dbeafe] bg-white p-6 shadow-soft">
          <div className="flex items-center justify-between mb-4">
            <h3 className="uppercase tracking-wide font-poppins text-[#64748b]">
              AI Credits
            </h3>
            <Zap className={`w-5 h-5 ${aiCredits.current > 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`} />
          </div>

          <div className="mb-4">
            <div className="flex justify-between items-baseline mb-2">
              <span className={`font-poppins ${aiCredits.current > 0 ? 'text-[#1e293b]' : 'text-[#ef4444]'}`}>
                {aiCredits.current}
              </span>
              <span className="text-sm text-[#64748b]">/ {aiCredits.total}</span>
            </div>
            <Progress value={(aiCredits.current / aiCredits.total) * 100} className="h-3" />
          </div>

          <div className="flex justify-between items-center text-xs text-[#94a3b8]">
            <span>{aiCredits.percentageText}</span>
            <span className="uppercase">Credits</span>
          </div>
        </Card>
      </div>

      {/* Active Validations Feed */}
      <Card className="border border-[#dbeafe] bg-white p-6 shadow-soft">
        <h3 className="mb-6 uppercase tracking-wide font-poppins text-[#64748b] flex items-center gap-2">
          <Target className="w-5 h-5" />
          Active Validations
          {validationsLoading && (
            <span className="text-xs text-gray-500">(Loading...)</span>
          )}
        </h3>

        {/* Real-time update indicator */}
        {activeValidations.length > 0 && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-900 flex items-center gap-2">
              <Info className="w-4 h-4 flex-shrink-0" />
              <span>
                <strong>Real-time updates enabled.</strong> Status changes will appear automatically.
              </span>
            </p>
          </div>
        )}

        {validationsError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-900">Error loading validations: {validationsError}</p>
          </div>
        )}

        <div className="space-y-4">
          {validationsLoading ? (
            <div className="text-center py-8 text-gray-500">
              Loading validations...
            </div>
          ) : paginatedValidations.length > 0 ? (
            paginatedValidations.map((validation) => (
              <ValidationStatusCard
                key={validation.id}
                validationId={validation.id}
                unitCode={validation.unitCode}
                validationType={validation.validation_type_name}
                onDoubleClick={() => handleValidationClick(validation)}
                showProgress={true}
                compact={false}
              />
            ))
          ) : (
            <div className="text-center py-12 text-gray-500">
              <Target className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p className="text-lg font-medium mb-2">No active validations</p>
              <p className="text-sm">Start a new validation to see it here</p>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              Showing {startIndex + 1} to {Math.min(endIndex, validations.length)} of {validations.length} validations
            </p>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                variant="outline"
                size="sm"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </Button>
              <span className="text-sm text-gray-600">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                variant="outline"
                size="sm"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
