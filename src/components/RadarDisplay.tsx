import React from 'react';
import { Card } from './ui/card';

interface RadarDisplayProps {
  title?: string;
  targets?: Array<{
    id: string;
    x: number;
    y: number;
    status: 'active' | 'inactive' | 'alert';
    label?: string;
  }>;
}

export function RadarDisplay({ title = 'RADAR OVERVIEW', targets = [] }: RadarDisplayProps) {
  return (
    <Card className="border-2 border-[#00aaff] bg-[#2a2a2a] p-6 glow-blue">
      <h3 className="mb-6 uppercase tracking-wider font-orbitron text-[#00aaff]">
        {title}
      </h3>
      
      <div className="relative w-full aspect-square max-w-md mx-auto">
        <svg viewBox="0 0 400 400" className="w-full h-full">
          {/* Background circles */}
          <circle
            cx="200"
            cy="200"
            r="180"
            fill="none"
            stroke="rgba(0,170,255,0.1)"
            strokeWidth="1"
          />
          <circle
            cx="200"
            cy="200"
            r="120"
            fill="none"
            stroke="rgba(0,170,255,0.1)"
            strokeWidth="1"
          />
          <circle
            cx="200"
            cy="200"
            r="60"
            fill="none"
            stroke="rgba(0,170,255,0.1)"
            strokeWidth="1"
          />
          
          {/* Cross lines */}
          <line
            x1="20"
            y1="200"
            x2="380"
            y2="200"
            stroke="rgba(0,170,255,0.1)"
            strokeWidth="1"
          />
          <line
            x1="200"
            y1="20"
            x2="200"
            y2="380"
            stroke="rgba(0,170,255,0.1)"
            strokeWidth="1"
          />
          
          {/* Diagonal lines */}
          <line
            x1="60"
            y1="60"
            x2="340"
            y2="340"
            stroke="rgba(0,170,255,0.05)"
            strokeWidth="1"
          />
          <line
            x1="340"
            y1="60"
            x2="60"
            y2="340"
            stroke="rgba(0,170,255,0.05)"
            strokeWidth="1"
          />
          
          {/* Radar sweep */}
          <g className="animate-radar" style={{ transformOrigin: '200px 200px' }}>
            <path
              d="M 200 200 L 200 20 A 180 180 0 0 1 380 200 Z"
              fill="url(#radarGradient)"
              opacity="0.3"
            />
          </g>
          
          {/* Gradient definition */}
          <defs>
            <radialGradient id="radarGradient">
              <stop offset="0%" stopColor="#00aaff" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#00aaff" stopOpacity="0" />
            </radialGradient>
          </defs>
          
          {/* Center point */}
          <circle
            cx="200"
            cy="200"
            r="4"
            fill="#00aaff"
            style={{ filter: 'drop-shadow(0 0 4px #00aaff)' }}
          />
          
          {/* Targets */}
          {targets.map((target) => {
            const colors = {
              active: '#00ff7f',
              inactive: '#666',
              alert: '#ff4500'
            };
            
            return (
              <g key={target.id}>
                <circle
                  cx={target.x}
                  cy={target.y}
                  r="6"
                  fill={colors[target.status]}
                  style={{ filter: `drop-shadow(0 0 6px ${colors[target.status]})` }}
                  className="animate-pulse"
                />
                {target.label && (
                  <text
                    x={target.x + 10}
                    y={target.y}
                    fill={colors[target.status]}
                    fontSize="10"
                    className="font-mono"
                  >
                    {target.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        
        {/* Corner markers */}
        <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-[#00aaff] opacity-50"></div>
        <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-[#00aaff] opacity-50"></div>
        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-[#00aaff] opacity-50"></div>
        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-[#00aaff] opacity-50"></div>
      </div>
    </Card>
  );
}
