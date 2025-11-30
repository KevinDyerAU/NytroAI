/**
 * ValidationStatusBadge - Display validation status with color-coded badges
 * 
 * Shows 4 simple stages:
 * 1. Document Upload (Pending)
 * 2. AI Learning (In Progress - Extract)
 * 3. Under Review (In Progress - Validation)
 * 4. Finalised (Completed)
 */

import React from 'react';

interface ValidationStatus {
  extractStatus: string;
  validationStatus: string;
}

interface ValidationStatusBadgeProps {
  status: ValidationStatus;
  className?: string;
}

export function ValidationStatusBadge({ status, className = '' }: ValidationStatusBadgeProps) {
  const getStage = () => {
    // Normalize status values (handle legacy and new formats)
    const extractStatus = (status.extractStatus || 'Pending').toLowerCase();
    const validationStatus = (status.validationStatus || 'Pending').toLowerCase();

    // Stage 4: Finalised (highest priority)
    if (validationStatus === 'finalised' || validationStatus === 'completed') {
      return { 
        label: 'Finalised', 
        color: 'green',
        bgClass: 'bg-green-100',
        textClass: 'text-green-800',
        borderClass: 'border-green-200'
      };
    }

    // Stage 3: Under Review (validation in progress OR extraction completed)
    if (
      extractStatus === 'completed' ||
      validationStatus === 'in progress' ||
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

    // Stage 2: AI Learning (extraction in progress)
    if (
      extractStatus === 'in progress' ||
      extractStatus === 'documentprocessing' ||
      extractStatus === 'processing'
    ) {
      return { 
        label: 'AI Learning', 
        color: 'yellow',
        bgClass: 'bg-yellow-100',
        textClass: 'text-yellow-800',
        borderClass: 'border-yellow-200'
      };
    }

    // Failed state
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
    if (extractStatus === 'pending' || validationStatus === 'pending') {
      return { 
        label: 'Document Upload', 
        color: 'blue',
        bgClass: 'bg-blue-100',
        textClass: 'text-blue-800',
        borderClass: 'border-blue-200'
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
