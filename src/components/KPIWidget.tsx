import React from 'react';
import { Card } from './ui/card';
import { LucideIcon } from 'lucide-react';

interface KPIWidgetProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  trend?: 'up' | 'down' | 'neutral';
  variant?: 'blue' | 'green' | 'red' | 'grey';
  tooltip?: string;
}

export function KPIWidget({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  trend,
  variant = 'blue',
  tooltip
}: KPIWidgetProps) {
  const variantClasses = {
    blue: 'border-[#3b82f6] bg-[#dbeafe]',
    green: 'border-[#22c55e] bg-[#dcfce7]',
    red: 'border-[#ef4444] bg-[#fee2e2]',
    grey: 'border-[#64748b] bg-[#f1f5f9]',
  };

  const valueClasses = {
    blue: 'text-[#1e40af]',
    green: 'text-[#166534]',
    red: 'text-[#991b1b]',
    grey: 'text-[#334155]',
  };

  const iconBgClasses = {
    blue: 'bg-[#3b82f6]/10',
    green: 'bg-[#22c55e]/10',
    red: 'bg-[#ef4444]/10',
    grey: 'bg-[#64748b]/10',
  };

  return (
    <Card 
      className={`
        relative overflow-hidden border-l-4 p-6 shadow-soft
        ${variantClasses[variant]}
        transition-all hover:shadow-medium
      `}
      title={tooltip}
    >
      <div className={`absolute top-0 right-0 w-32 h-32 opacity-5 ${iconBgClasses[variant]}`}>
        {Icon && <Icon className="w-full h-full" />}
      </div>
      
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-2">
          {Icon && <Icon className={`w-5 h-5 ${valueClasses[variant]}`} />}
          <h3 className="text-sm uppercase tracking-wide text-[#64748b] font-poppins">{title}</h3>
        </div>
        
        <div className={`mb-1 font-poppins ${valueClasses[variant]}`}>
          {value}
        </div>
        
        {subtitle && (
          <p className="text-xs text-[#64748b]">{subtitle}</p>
        )}
      </div>
    </Card>
  );
}
