import React, { useEffect, useState } from 'react';
import { CheckCircle } from 'lucide-react';
import wizardLogo from '../assets/wizard-logo.png';

interface WelcomeSplashProps {
  onComplete: () => void;
}

export function WelcomeSplash({ onComplete }: WelcomeSplashProps) {
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);

  const bootSequence = [
    'Initializing validation system',
    'Loading AI modules',
    'Establishing connections',
    'Preparing workspace',
    'System ready'
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(onComplete, 500);
          return 100;
        }
        return prev + 2;
      });
    }, 30);

    return () => clearInterval(interval);
  }, [onComplete]);

  useEffect(() => {
    const stepInterval = setInterval(() => {
      setCurrentStep(prev => Math.min(prev + 1, bootSequence.length - 1));
    }, 600);

    return () => clearInterval(stepInterval);
  }, []);

  return (
    <div className="fixed inset-0 bg-[#f8f9fb] z-50 flex items-center justify-center">
      <div className="relative z-10 text-center max-w-2xl mx-auto px-8">
        {/* Logo */}
        <div className="mb-8">
          <div className="w-64 h-32 mx-auto mb-6 flex items-center justify-center">
            <img 
              src={wizardLogo} 
              alt="Nytro Logo" 
              className="w-full h-full object-contain animate-pulse"
            />
          </div>
          
          <p className="text-[#64748b] tracking-wide text-lg">Intelligence That Powers Performance</p>
        </div>

        {/* Boot sequence */}
        <div className="mb-8 space-y-2">
          {bootSequence.map((step, index) => (
            <div
              key={index}
              className={`
                text-sm flex items-center justify-center gap-2 transition-all
                ${index <= currentStep ? 'opacity-100' : 'opacity-0'}
                ${index === currentStep ? 'text-[#3b82f6]' : 'text-[#64748b]'}
              `}
            >
              {index < currentStep && <CheckCircle className="w-4 h-4 text-[#22c55e]" />}
              {index === currentStep && (
                <div className="w-2 h-2 bg-[#3b82f6] rounded-full animate-pulse"></div>
              )}
              <span>{step}</span>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div className="relative h-2 bg-[#e2e8f0] rounded-full overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-gradient-blue transition-all shadow-soft"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
        
        <div className="mt-4 font-poppins text-[#3b82f6]">
          {progress}%
        </div>
      </div>
    </div>
  );
}
