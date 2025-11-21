import React from 'react';
import { Button } from './ui/button';
import { LucideIcon } from 'lucide-react';

interface GlowButtonProps {
  children: React.ReactNode;
  icon?: LucideIcon;
  variant?: 'primary' | 'secondary' | 'danger';
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  size?: 'default' | 'sm' | 'lg' | 'icon';
  title?: string;
}

export function GlowButton({ 
  children, 
  icon: Icon, 
  variant = 'primary', 
  onClick, 
  disabled,
  className = '',
  size = 'default',
  title
}: GlowButtonProps) {
  const variantStyles = {
    primary: 'bg-[#3b82f6] hover:bg-[#2563eb] text-white shadow-soft hover:shadow-medium',
    secondary: 'bg-white border-2 border-[#3b82f6] text-[#3b82f6] hover:bg-[#dbeafe] shadow-soft',
    danger: 'bg-[#ef4444] hover:bg-[#dc2626] text-white shadow-soft hover:shadow-medium',
  };

  return (
    <Button
      onClick={onClick}
      disabled={disabled}
      size={size}
      title={title}
      className={`
        font-poppins transition-all
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variantStyles[variant]}
        ${className}
      `}
    >
      {Icon && <Icon className="mr-2 w-5 h-5" />}
      {children}
    </Button>
  );
}
