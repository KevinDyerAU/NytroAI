/**
 * ValidationStatusBadge - Display validation status with color-coded badges
 * 
 * Shows 4 simple stages:
 * 1. Document Upload (Pending)
 * 2. AI Learning (In Progress - Extract)
 * 3. Under Review (Validations running but no results yet)
 * 4. Finalised (Validation results available, progress > 0%)
 */

import React from 'react';

interface ValidationStatus {
  extractStatus: string;
  validationStatus: string;
}

interface ValidationStatusBadgeProps {
  status: ValidationStatus;
  progress?: number; // 0-100, validation progress percentage
  className?: string;
}

export function ValidationStatusBadge({ status, progress = 0, className = '' }: ValidationStatusBadgeProps) {
  const getStage = () => {
    // Normalize status values (handle legacy and new formats)
    const extractStatus = (status.extractStatus || 'Pending').toLowerCase();
    const validationStatus = (status.validationStatus || 'Pending').toLowerCase();

    // Failed state - check first
    if (extractStatus === 'failed' || validationStatus === 'failed') {
      return { 
        label: 'Failed', 
        color: 'red',
        bgClass: 'bg-red-100',
        textClass: 'text-red-800',
        borderClass: 'border-red-200'
      };
    }

    // Stage 1: Document Upload (default/pending)
    if (extractStatus === 'pending' && validationStatus === 'pending') {
      return { 
        label: 'Document Upload', 
        color: 'blue',
        bgClass: 'bg-blue-100',
        textClass: 'text-blue-800',
        borderClass: 'border-blue-200'
      };
    }

    // Stage 2: AI Learning (extraction in progress)
    if (
      extractStatus === 'in progress' ||
      extractStatus === 'documentprocessing' ||
      extractStatus === 'processing' ||
      extractStatus === 'uploading'
    ) {
      return { 
        label: 'AI Learning', 
        color: 'yellow',
        bgClass: 'bg-yellow-100',
        textClass: 'text-yellow-800',
        borderClass: 'border-yellow-200'
      };
    }

    // Stage 4: Finalised - when we have any validation results available
    if (progress > 0) {
      return { 
        label: 'Finalised', 
        color: 'green',
        bgClass: 'bg-green-100',
        textClass: 'text-green-800',
        borderClass: 'border-green-200'
      };
    }

    // Stage 3: Under Review (validations running but no results yet)
    if (
      validationStatus === 'completed' ||
      validationStatus === 'in progress' ||
      extractStatus === 'completed' ||
      extractStatus === 'processinginbackground'
    ) {
      return { 
        label: 'Under Review', 
        color: 'orange',
        bgClass: 'bg-orange-100',
        textClass: 'text-orange-800',
        borderClass: 'border-orange-200'
      };
    }

    // Unknown state
    return { 
      label: 'Unknown', 
      color: 'gray',
      bgClass: 'bg-gray-100',
      textClass: 'text-gray-800',
      borderClass: 'border-gray-200'
    };
  };

  const stage = getStage();

  return (
    <span 
      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${stage.bgClass} ${stage.textClass} ${stage.borderClass} ${className}`}
    >
      {stage.label}
    </span>
  );
}
