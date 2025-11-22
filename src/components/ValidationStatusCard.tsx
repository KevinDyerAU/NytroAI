/**
 * ValidationStatusCard Component - Phase 3.1
 * Displays validation status with real-time updates
 */

import React from 'react';
import { Card } from './ui/card';
import { Progress } from './ui/progress';
import { 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  XCircle,
  Loader2 
} from 'lucide-react';
import { 
  useValidationStatus, 
  getStatusColor, 
  getStatusLabel,
  getProgressColor,
  type ValidationStatus 
} from '../hooks/useValidationStatus';

interface ValidationStatusCardProps {
  validationId: number;
  unitCode?: string;
  validationType?: string;
  onDoubleClick?: () => void;
  showProgress?: boolean;
  compact?: boolean;
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'completed':
      return <CheckCircle className="w-5 h-5 text-green-600" />;
    case 'partial':
      return <AlertCircle className="w-5 h-5 text-yellow-600" />;
    case 'in_progress':
      return <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />;
    case 'failed':
      return <XCircle className="w-5 h-5 text-red-600" />;
    case 'pending':
    default:
      return <Clock className="w-5 h-5 text-gray-600" />;
  }
}

export function ValidationStatusCard({
  validationId,
  unitCode,
  validationType,
  onDoubleClick,
  showProgress = true,
  compact = false,
}: ValidationStatusCardProps) {
  const { status, isLoading, error } = useValidationStatus(validationId);

  if (isLoading) {
    return (
      <Card className="p-4 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-4 border-red-200 bg-red-50">
        <p className="text-sm text-red-600">Error loading status: {error}</p>
      </Card>
    );
  }

  if (!status) {
    return null;
  }

  const statusColor = getStatusColor(status.validation_status);
  const statusLabel = getStatusLabel(status.validation_status);
  const progressColor = getProgressColor(status.validation_progress);

  if (compact) {
    return (
      <div 
        className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
        onDoubleClick={onDoubleClick}
        title="Double-click to view details"
      >
        {getStatusIcon(status.validation_status)}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">
            {unitCode || `Validation #${validationId}`}
          </p>
          <p className="text-xs text-gray-500">
            {status.validation_count} / {status.validation_total} validated
          </p>
        </div>
        <span className={`px-2 py-1 rounded text-xs font-semibold ${statusColor}`}>
          {statusLabel}
        </span>
      </div>
    );
  }

  return (
    <Card 
      className="p-4 hover:shadow-md transition-shadow cursor-pointer"
      onDoubleClick={onDoubleClick}
      title="Double-click to view validation results"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            {getStatusIcon(status.validation_status)}
            <h3 className="font-semibold text-gray-900">
              {unitCode || `Validation #${validationId}`}
            </h3>
          </div>
          {validationType && (
            <p className="text-sm text-gray-600 mb-2">{validationType}</p>
          )}
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColor}`}>
          {statusLabel}
        </span>
      </div>

      {showProgress && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Progress</span>
            <span className="font-semibold text-gray-900">
              {status.validation_progress.toFixed(0)}%
            </span>
          </div>
          <Progress 
            value={status.validation_progress} 
            className="h-2"
          />
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>
              {status.validation_count} of {status.validation_total} requirements validated
            </span>
            <span>
              {status.validation_count > 0 && status.validation_total > 0
                ? `${Math.round((status.validation_count / status.validation_total) * 100)}% complete`
                : 'Not started'}
            </span>
          </div>
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-gray-200">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Last updated</span>
          <span>{new Date(status.last_updated_at).toLocaleString()}</span>
        </div>
      </div>
    </Card>
  );
}

/**
 * Simplified status badge component
 */
export function ValidationStatusBadge({ 
  status 
}: { 
  status: ValidationStatus 
}) {
  const statusColor = getStatusColor(status.validation_status);
  const statusLabel = getStatusLabel(status.validation_status);

  return (
    <div className="flex items-center gap-2">
      {getStatusIcon(status.validation_status)}
      <span className={`px-2 py-1 rounded text-xs font-semibold ${statusColor}`}>
        {statusLabel}
      </span>
      <span className="text-xs text-gray-500">
        {status.validation_progress.toFixed(0)}%
      </span>
    </div>
  );
}

/**
 * Inline progress indicator
 */
export function ValidationProgressIndicator({ 
  validationId 
}: { 
  validationId: number 
}) {
  const { status, isLoading } = useValidationStatus(validationId);

  if (isLoading || !status) {
    return <div className="h-2 w-full bg-gray-200 rounded animate-pulse" />;
  }

  const progressColor = getProgressColor(status.validation_progress);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-gray-600">
        <span>{status.validation_count} / {status.validation_total}</span>
        <span>{status.validation_progress.toFixed(0)}%</span>
      </div>
      <div className="h-2 w-full bg-gray-200 rounded overflow-hidden">
        <div 
          className={`h-full ${progressColor} transition-all duration-500`}
          style={{ width: `${status.validation_progress}%` }}
        />
      </div>
    </div>
  );
}
