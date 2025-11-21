import React from 'react';

interface HUDStatusIndicatorProps {
  status: 'online' | 'offline' | 'warning' | 'processing';
  label?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function HUDStatusIndicator({ 
  status, 
  label, 
  size = 'md' 
}: HUDStatusIndicatorProps) {
  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4'
  };

  const colors = {
    online: {
      bg: 'bg-[#22c55e]',
      text: 'text-[#166534]'
    },
    offline: {
      bg: 'bg-[#94a3b8]',
      text: 'text-[#64748b]'
    },
    warning: {
      bg: 'bg-[#f59e0b]',
      text: 'text-[#92400e]'
    },
    processing: {
      bg: 'bg-[#3b82f6]',
      text: 'text-[#1e40af]'
    }
  };

  const config = colors[status];

  return (
    <div className="flex items-center gap-2">
      <div className={`
        ${sizeClasses[size]} 
        ${config.bg} 
        rounded-full
        ${status === 'processing' ? 'animate-pulse' : ''}
      `}></div>
      {label && (
        <span className={`text-xs uppercase font-poppins ${config.text}`}>
          {label}
        </span>
      )}
    </div>
  );
}
