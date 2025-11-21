import React from 'react';
import { Card } from './ui/card';

interface ProgressMeterProps {
  title: string;
  current: number;
  total: number;
  unit?: string;
  variant?: 'blue' | 'green' | 'red';
}

export function ProgressMeter({ 
  title, 
  current, 
  total, 
  unit = 'items',
  variant = 'blue' 
}: ProgressMeterProps) {
  const percentage = (current / total) * 100;
  
  const colors = {
    blue: '#00aaff',
    green: '#00ff7f',
    red: '#ff4500'
  };

  const glowClasses = {
    blue: 'glow-blue',
    green: 'glow-green',
    red: 'glow-red'
  };

  return (
    <Card className={`border-2 border-[${colors[variant]}] bg-[${colors[variant]}]/5 p-6 ${glowClasses[variant]}`}>
      <h3 className="mb-4 uppercase tracking-wider font-orbitron">{title}</h3>
      
      <div className="relative h-24 mb-4">
        <svg viewBox="0 0 200 100" className="w-full h-full">
          {/* Background arc */}
          <path
            d="M 20 90 A 80 80 0 0 1 180 90"
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="8"
          />
          
          {/* Progress arc */}
          <path
            d="M 20 90 A 80 80 0 0 1 180 90"
            fill="none"
            stroke={colors[variant]}
            strokeWidth="8"
            strokeDasharray={`${(percentage / 100) * 251.2} 251.2`}
            strokeLinecap="round"
            style={{
              filter: `drop-shadow(0 0 8px ${colors[variant]})`
            }}
          />
          
          {/* Center text */}
          <text
            x="100"
            y="70"
            textAnchor="middle"
            className="font-orbitron"
            fill={colors[variant]}
            style={{ fontSize: '24px' }}
          >
            {Math.round(percentage)}%
          </text>
        </svg>
      </div>
      
      <div className="flex justify-between items-center">
        <span className="opacity-70">{current} / {total}</span>
        <span className="text-xs uppercase opacity-60">{unit}</span>
      </div>
    </Card>
  );
}
