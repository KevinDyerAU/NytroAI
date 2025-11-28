import React from 'react';
import { Badge } from './ui/badge';
import { CheckCircle2, XCircle, AlertCircle, Clock } from 'lucide-react';

interface StatusBadgeProps {
  status: 'met' | 'not-met' | 'partial';
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function StatusBadge({ status, showIcon = true, size = 'md' }: StatusBadgeProps) {
  const configs = {
    met: {
      label: 'MET',
      color: 'bg-[#dcfce7] text-[#166534] border-[#22c55e]',
      icon: CheckCircle2
    },
    'not-met': {
      label: 'NOT MET',
      color: 'bg-[#fee2e2] text-[#991b1b] border-[#ef4444]',
      icon: XCircle
    },
    partial: {
      label: 'PARTIAL',
      color: 'bg-[#fef3c7] text-[#92400e] border-[#f59e0b]',
      icon: AlertCircle
    },
    unknown: {
      label: 'UNKNOWN',
      color: 'bg-[#f1f5f9] text-[#475569] border-[#94a3b8]',
      icon: Clock
    }
  };

  // Normalize status and provide fallback
  const normalizedStatus = status?.toLowerCase().replace(/\s+/g, '-') as keyof typeof configs;
  const config = configs[normalizedStatus] || configs.unknown;
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-1.5'
  };

  return (
    <Badge 
      className={`
        font-poppins border ${config.color}
        ${sizeClasses[size]} inline-flex items-center gap-1.5
      `}
    >
      {showIcon && <Icon className="w-3.5 h-3.5" />}
      {config.label}
    </Badge>
  );
}
