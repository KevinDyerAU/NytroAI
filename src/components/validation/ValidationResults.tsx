import React, { useState } from 'react';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { SearchIcon, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { ValidationCard } from '../ValidationCard';

interface ValidationResult {
  id: string | number;
  requirementNumber: string;
  type: string;
  requirementText: string;
  status: 'met' | 'not-met' | 'partial';
  reasoning: string;
  evidence: {
    mappedQuestions: string[];
    unmappedReasoning: string;
    documentReferences: (string | number)[];
  };
  aiEnhancement: {
    smartQuestion: string;
    benchmarkAnswer: string;
    recommendations: string[];
  };
}

interface ValidationResultsProps {
  results: ValidationResult[];
  validationContext?: {
    rtoId?: string;
    unitCode?: string;
    unitTitle?: string;
    validationType?: string;
    validationId?: string;
  };
  isLoading?: boolean;
  aiCreditsAvailable?: boolean;
}

export function ValidationResults({
  results,
  validationContext,
  isLoading = false,
  aiCreditsAvailable = true,
}: ValidationResultsProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'met' | 'not-met' | 'partial'>('all');
  const [selectedResult, setSelectedResult] = useState<ValidationResult | null>(null);
  const [showChat, setShowChat] = useState(false);

  const filteredResults = results.filter((result) => {
    const matchesSearch =
      result.requirementText.toLowerCase().includes(searchTerm.toLowerCase()) ||
      result.requirementNumber.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || result.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusCounts = {
    total: results.length,
    met: results.filter((r) => r.status === 'met').length,
    notMet: results.filter((r) => r.status === 'not-met').length,
    partial: results.filter((r) => r.status === 'partial').length,
  };

  const complianceScore =
    statusCounts.total > 0 ? Math.round((statusCounts.met / statusCounts.total) * 100) : 0;

  const handleChatClick = (result: ValidationResult) => {
    setSelectedResult(result);
    setShowChat(true);
  };

  if (isLoading) {
    return (
      <Card className="border border-[#dbeafe] bg-white p-8 text-center shadow-soft">
        <div className="space-y-4">
          <div className="w-16 h-16 mx-auto bg-[#dbeafe] rounded-full animate-pulse" />
          <p className="text-[#64748b]">Loading validation results...</p>
        </div>
      </Card>
    );
  }

  if (results.length === 0) {
    return (
      <Card className="border border-[#dbeafe] bg-white p-8 text-center shadow-soft">
        <AlertCircle className="w-12 h-12 mx-auto mb-4 text-[#cbd5e1]" />
        <p className="text-[#64748b]">No validation results available yet</p>
        <p className="text-sm text-[#94a3b8] mt-2">
          Results will appear here as the validation progresses
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="border border-[#3b82f6] bg-white p-6 text-center shadow-soft">
          <div className="w-20 h-20 mx-auto mb-3 relative">
            <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="#e2e8f0"
                strokeWidth="10"
              />
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="#3b82f6"
                strokeWidth="10"
                strokeDasharray="282.7"
                strokeDashoffset={282.7 * (1 - complianceScore / 100)}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="font-poppins text-[#1e293b] font-bold">{complianceScore}%</div>
              <div className="text-xs text-[#64748b]">Compliance</div>
            </div>
          </div>
        </Card>

        <Card className="border-l-4 border-[#22c55e] bg-white p-6 text-center shadow-soft">
          <div className="font-poppins text-[#166534] mb-1 text-2xl font-bold">
            {statusCounts.met}
          </div>
          <div className="text-sm text-[#64748b] uppercase">Met</div>
          <div className="mt-2 text-xs text-[#94a3b8]">
            {statusCounts.total > 0 ? Math.round((statusCounts.met / statusCounts.total) * 100) : 0}%
          </div>
        </Card>

        <Card className="border-l-4 border-[#ef4444] bg-white p-6 text-center shadow-soft">
          <div className="font-poppins text-[#991b1b] mb-1 text-2xl font-bold">
            {statusCounts.notMet}
          </div>
          <div className="text-sm text-[#64748b] uppercase">Not Met</div>
          <div className="mt-2 text-xs text-[#94a3b8]">
            {statusCounts.total > 0 ? Math.round((statusCounts.notMet / statusCounts.total) * 100) : 0}%
          </div>
        </Card>

        <Card className="border-l-4 border-[#f59e0b] bg-white p-6 text-center shadow-soft">
          <div className="font-poppins text-[#92400e] mb-1 text-2xl font-bold">
            {statusCounts.partial}
          </div>
          <div className="text-sm text-[#64748b] uppercase">Partial</div>
          <div className="mt-2 text-xs text-[#94a3b8]">
            {statusCounts.total > 0 ? Math.round((statusCounts.partial / statusCounts.total) * 100) : 0}%
          </div>
        </Card>

        <Card className="border-l-4 border-[#64748b] bg-white p-6 text-center shadow-soft">
          <div className="font-poppins text-[#1e293b] mb-1 text-2xl font-bold">
            {statusCounts.total}
          </div>
          <div className="text-sm text-[#64748b] uppercase">Total</div>
          <div className="mt-2 text-xs text-[#94a3b8]">Requirements</div>
        </Card>
      </div>

      {/* Results Panel */}
      <Card className="border border-[#dbeafe] bg-white p-6 shadow-soft">
        <h3 className="mb-6 uppercase tracking-wide font-poppins text-[#64748b]">
          Detailed Validation Results
        </h3>

        {/* Filters */}
        <div className="flex gap-4 mb-6">
          <div className="flex-1 relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748b]" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search requirements..."
              className="pl-10 bg-white border-[#dbeafe]"
            />
          </div>

          <Select
            value={statusFilter}
            onValueChange={(value: any) => setStatusFilter(value)}
          >
            <SelectTrigger className="w-48 bg-white border-[#dbeafe]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent className="bg-white border-[#dbeafe]">
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="met">Met</SelectItem>
              <SelectItem value="not-met">Not Met</SelectItem>
              <SelectItem value="partial">Partial</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Results Count */}
        <div className="flex items-center justify-between mb-4 pb-4 border-b border-[#dbeafe]">
          <p className="text-sm text-[#64748b]">
            Showing <span className="text-[#3b82f6] font-poppins">{filteredResults.length}</span> of{' '}
            {statusCounts.total} requirements
          </p>
        </div>

        {/* Results List */}
        <div className="space-y-4">
          {filteredResults.length > 0 ? (
            filteredResults.map((result) => (
              <ValidationCard
                key={result.id}
                result={result}
                onChatClick={handleChatClick}
                aiCreditsAvailable={aiCreditsAvailable}
                validationContext={validationContext}
              />
            ))
          ) : (
            <div className="text-center py-12">
              <AlertCircle className="w-12 h-12 mx-auto mb-4 text-[#cbd5e1]" />
              <p className="text-[#64748b]">No results match your search criteria</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
