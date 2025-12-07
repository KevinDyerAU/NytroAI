/**
 * ResultStatusBadge - Display validation result status (met/not-met/partial)
 * 
 * Color coding:
 * - Met: Green
 * - Not Met: Red
 * - Partial: Orange/Yellow
 */

import React from 'react';

interface ResultStatusBadgeProps {
  status: string;
  className?: string;
}

export function ResultStatusBadge({ status, className = '' }: ResultStatusBadgeProps) {
  const getStatusConfig = () => {
    // Normalize status (handle various formats)
    const normalizedStatus = (status || '').toLowerCase().replace(/_/g, '-').trim();

    switch (normalizedStatus) {
      case 'met':
        return {
          label: 'Met',
          bgClass: 'bg-green-100',
          textClass: 'text-green-800',
          borderClass: 'border-green-200'
        };
      case 'not-met':
      case 'notmet':
      case 'not met':
        return {
          label: 'Not Met',
          bgClass: 'bg-red-100',
          textClass: 'text-red-800',
          borderClass: 'border-red-200'
        };
      case 'partial':
      case 'partially-met':
      case 'partially met':
        return {
          label: 'Partial',
          bgClass: 'bg-orange-100',
          textClass: 'text-orange-800',
          borderClass: 'border-orange-200'
        };
      default:
        return {
          label: status || 'Unknown',
          bgClass: 'bg-gray-100',
          textClass: 'text-gray-800',
          borderClass: 'border-gray-200'
        };
    }
  };

  const config = getStatusConfig();

  return (
    <span 
      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${config.bgClass} ${config.textClass} ${config.borderClass} ${className}`}
    >
      {config.label}
    </span>
  );
}
