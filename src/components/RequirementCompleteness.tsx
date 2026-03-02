import React from 'react';
import { CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from './ui/tooltip';

interface CompletenessFlags {
  has_knowledge_evidence: boolean;
  has_performance_evidence: boolean;
  has_foundation_skills: boolean;
  has_elements_performance_criteria: boolean;
  has_assessment_conditions: boolean;
}

interface RequirementCompletenessProps {
  flags: CompletenessFlags;
  compact?: boolean;
}

const SECTIONS = [
  { key: 'has_knowledge_evidence' as const, label: 'KE', fullLabel: 'Knowledge Evidence', color: '#3b82f6' },
  { key: 'has_performance_evidence' as const, label: 'PE', fullLabel: 'Performance Evidence', color: '#22c55e' },
  { key: 'has_foundation_skills' as const, label: 'FS', fullLabel: 'Foundation Skills', color: '#f59e0b' },
  { key: 'has_elements_performance_criteria' as const, label: 'EPC', fullLabel: 'Elements & Performance Criteria', color: '#6366f1' },
  { key: 'has_assessment_conditions' as const, label: 'AC', fullLabel: 'Assessment Conditions', color: '#ec4899' },
];

export function RequirementCompleteness({ flags, compact = false }: RequirementCompletenessProps) {
  const captured = SECTIONS.filter(s => flags[s.key]).length;
  const total = SECTIONS.length;
  const isComplete = captured === total;
  const isPartial = captured > 0 && captured < total;

  if (compact) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1 cursor-help">
            {SECTIONS.map(section => (
              <div
                key={section.key}
                className={`w-2 h-2 rounded-full transition-colors ${
                  flags[section.key]
                    ? 'opacity-100'
                    : 'opacity-20'
                }`}
                style={{ backgroundColor: section.color }}
              />
            ))}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="bg-[#1e293b] text-white p-3 max-w-xs">
          <p className="font-semibold text-xs mb-2">
            Requirements: {captured}/{total} sections captured
          </p>
          <div className="space-y-1">
            {SECTIONS.map(section => (
              <div key={section.key} className="flex items-center gap-2 text-xs">
                {flags[section.key] ? (
                  <CheckCircle2 className="w-3 h-3 text-[#22c55e] flex-shrink-0" />
                ) : (
                  <XCircle className="w-3 h-3 text-[#ef4444] flex-shrink-0" />
                )}
                <span className={flags[section.key] ? 'text-[#86efac]' : 'text-[#fca5a5]'}>
                  {section.fullLabel}
                </span>
              </div>
            ))}
          </div>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {isComplete ? (
          <CheckCircle2 className="w-4 h-4 text-[#22c55e]" />
        ) : isPartial ? (
          <AlertTriangle className="w-4 h-4 text-[#f59e0b]" />
        ) : (
          <XCircle className="w-4 h-4 text-[#ef4444]" />
        )}
        <span className={`text-sm font-medium ${
          isComplete ? 'text-[#166534]' : isPartial ? 'text-[#92400e]' : 'text-[#991b1b]'
        }`}>
          {captured}/{total} Requirement Sections
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {SECTIONS.map(section => (
          <Tooltip key={section.key}>
            <TooltipTrigger asChild>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border cursor-help transition-all ${
                  flags[section.key]
                    ? 'border-current opacity-100'
                    : 'border-[#e2e8f0] bg-[#f8f9fb] text-[#94a3b8] opacity-60'
                }`}
                style={flags[section.key] ? { color: section.color, borderColor: section.color, backgroundColor: `${section.color}15` } : undefined}
              >
                {flags[section.key] ? (
                  <CheckCircle2 className="w-3 h-3" />
                ) : (
                  <XCircle className="w-3 h-3" />
                )}
                {section.label}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="bg-[#1e293b] text-white text-xs">
              {section.fullLabel}: {flags[section.key] ? 'Captured' : 'Missing'}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </div>
  );
}

export function AcquisitionStatusBadge({ status, lastError }: { status: string; lastError?: string | null }) {
  const configs: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
    pending: {
      label: 'Pending',
      className: 'bg-[#f1f5f9] text-[#475569] border-[#94a3b8]',
      icon: <div className="w-2 h-2 rounded-full bg-[#94a3b8]" />,
    },
    queued: {
      label: 'Queued',
      className: 'bg-[#f1f5f9] text-[#475569] border-[#94a3b8]',
      icon: <div className="w-2 h-2 rounded-full bg-[#94a3b8]" />,
    },
    in_progress: {
      label: 'In Progress',
      className: 'bg-[#dbeafe] text-[#1e40af] border-[#3b82f6]',
      icon: <div className="w-2 h-2 rounded-full bg-[#3b82f6] animate-pulse" />,
    },
    complete: {
      label: 'Complete',
      className: 'bg-[#dcfce7] text-[#166534] border-[#22c55e]',
      icon: <CheckCircle2 className="w-3 h-3" />,
    },
    completed: {
      label: 'Complete',
      className: 'bg-[#dcfce7] text-[#166534] border-[#22c55e]',
      icon: <CheckCircle2 className="w-3 h-3" />,
    },
    partial: {
      label: 'Partial',
      className: 'bg-[#fef3c7] text-[#92400e] border-[#f59e0b]',
      icon: <AlertTriangle className="w-3 h-3" />,
    },
    partial_success: {
      label: 'Partial',
      className: 'bg-[#fef3c7] text-[#92400e] border-[#f59e0b]',
      icon: <AlertTriangle className="w-3 h-3" />,
    },
    failed: {
      label: 'Failed',
      className: 'bg-[#fee2e2] text-[#991b1b] border-[#ef4444]',
      icon: <XCircle className="w-3 h-3" />,
    },
    retry: {
      label: 'Retrying',
      className: 'bg-[#fef3c7] text-[#92400e] border-[#f59e0b]',
      icon: <div className="w-2 h-2 rounded-full bg-[#f59e0b] animate-pulse" />,
    },
  };

  const config = configs[status] || configs.pending;

  const badge = (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${config.className}`}>
      {config.icon}
      {config.label}
    </span>
  );

  if (lastError && (status === 'failed' || status === 'partial_success' || status === 'retry')) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-help">{badge}</span>
        </TooltipTrigger>
        <TooltipContent side="top" className="bg-[#1e293b] text-white text-xs max-w-sm">
          <p className="font-semibold mb-1">Last Error:</p>
          <p className="text-[#fca5a5]">{lastError}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return badge;
}

/**
 * Checks whether a unit has all required sections for validation.
 * Returns { ready: boolean, missing: string[] }
 */
export function checkValidationReadiness(flags: CompletenessFlags): { ready: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!flags.has_knowledge_evidence) missing.push('Knowledge Evidence');
  if (!flags.has_performance_evidence) missing.push('Performance Evidence');
  if (!flags.has_foundation_skills) missing.push('Foundation Skills');
  if (!flags.has_elements_performance_criteria) missing.push('Elements & Performance Criteria');
  if (!flags.has_assessment_conditions) missing.push('Assessment Conditions');
  return { ready: missing.length === 0, missing };
}
