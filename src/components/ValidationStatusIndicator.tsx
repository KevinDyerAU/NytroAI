import React, { useState } from 'react';
import { CheckCircle2, FileText, BookOpen, Clock, Info } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';

interface ValidationStatusIndicatorProps {
  status: 'pending' | 'reqExtracted' | 'docExtracted' | 'validated';
  progress: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  compact?: boolean;
  extractStatus?: string; // Database column: Controls Stage 2 (Document Processing)
  validationStatus?: string; // Database column: Controls Stage 3 (Validations)
}

export function ValidationStatusIndicator({
  status,
  progress,
  size = 'md',
  showLabel = true,
  compact = false,
  extractStatus,
  validationStatus
}: ValidationStatusIndicatorProps) {
  const [isInfoOpen, setIsInfoOpen] = useState(false);

  // Determine actual stage based on database columns
  const determineCurrentStage = (): 'pending' | 'reqExtracted' | 'docExtracted' | 'validated' => {
    // Stage 4: Validation complete/finalised
    if (validationStatus === 'Completed' || validationStatus === 'Finalised') {
      return 'validated';
    }

    // Stage 3: Validation in progress
    if (validationStatus === 'In Progress') {
      return 'docExtracted';
    }

    // Stage 2: Document processing in progress
    if (
      extractStatus === 'In Progress' ||
      extractStatus === 'ProcessingInBackground' ||
      extractStatus === 'DocumentProcessing' ||
      extractStatus === 'Uploading'
    ) {
      return 'reqExtracted';
    }

    // Stage 1: Pending/default
    return 'pending';
  };

  const actualStatus = extractStatus || validationStatus ? determineCurrentStage() : status;

  const sizeConfig = {
    sm: { circle: 40, stroke: 4, text: 'text-xs', label: 'text-xs' },
    md: { circle: 60, stroke: 6, text: 'text-sm', label: 'text-xs' },
    lg: { circle: 80, stroke: 8, text: '', label: 'text-sm' }
  };

  const config = sizeConfig[size];
  const radius = (config.circle - config.stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - progress / 100);

  // Define the stages and their info
  const stages = [
    {
      key: 'pending',
      label: 'Confirmed',
      icon: CheckCircle2,
      color: '#3b82f6',
      bgColor: '#dbeafe',
      completed: status !== 'pending',
      description: 'Unit selected, documents uploaded'
    },
    {
      key: 'reqExtracted',
      label: 'Document Processing',
      icon: FileText,
      color: '#3b82f6',
      bgColor: '#dbeafe',
      completed: status === 'docExtracted' || status === 'validated',
      description: 'AI learning PDFs (seconds for small files)'
    },
    {
      key: 'docExtracted',
      label: 'Validations',
      icon: BookOpen,
      color: '#60a5fa',
      bgColor: '#dbeafe',
      completed: status === 'validated',
      description: 'Validating documents against training.gov.au requirements'
    },
    {
      key: 'validated',
      label: 'Report',
      icon: CheckCircle2,
      color: '#22c55e',
      bgColor: '#dcfce7',
      completed: status === 'validated',
      description: 'Reports generated and confirmed'
    }
  ];

  const currentStage = stages.find(s => s.key === actualStatus);
  const currentStageIndex = stages.findIndex(s => s.key === actualStatus);

  return (
    <>
      <div 
        className="inline-flex flex-col items-center cursor-pointer hover:opacity-80 transition-opacity group"
        onClick={() => setIsInfoOpen(true)}
        title="Click for validation workflow information"
      >
        {!compact && (
          <>
            {/* Circular Progress */}
            <div className="relative" style={{ width: config.circle, height: config.circle }}>
              <svg 
                viewBox={`0 0 ${config.circle} ${config.circle}`} 
                className="w-full h-full transform -rotate-90"
              >
                {/* Background circle */}
                <circle
                  cx={config.circle / 2}
                  cy={config.circle / 2}
                  r={radius}
                  fill="none"
                  stroke="#e2e8f0"
                  strokeWidth={config.stroke}
                />
                {/* Progress circle */}
                <circle
                  cx={config.circle / 2}
                  cy={config.circle / 2}
                  r={radius}
                  fill="none"
                  stroke={currentStage?.color || '#94a3b8'}
                  strokeWidth={config.stroke}
                  strokeDasharray={circumference}
                  strokeDashoffset={offset}
                  strokeLinecap="round"
                />
              </svg>
              
              {/* Center content - icon or percentage */}
              <div className="absolute inset-0 flex items-center justify-center">
                {currentStage && (
                  <currentStage.icon 
                    className={`${size === 'sm' ? 'w-4 h-4' : size === 'md' ? 'w-5 h-5' : 'w-6 h-6'}`}
                    style={{ color: currentStage.color }}
                  />
                )}
              </div>

              {/* Info icon overlay on hover */}
              <div className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="bg-[#3b82f6] rounded-full p-0.5">
                  <Info className="w-3 h-3 text-white" />
                </div>
              </div>
            </div>

            {/* Stage indicators below */}
            {showLabel && (
              <div className="mt-2 flex gap-1">
                {stages.map((stage, index) => {
                  const Icon = stage.icon;
                  const isActive = index === currentStageIndex;
                  const isCompleted = stage.completed;
                  
                  return (
                    <div
                      key={stage.key}
                      className={`
                        flex items-center justify-center rounded-full
                        ${size === 'sm' ? 'w-5 h-5' : size === 'md' ? 'w-6 h-6' : 'w-7 h-7'}
                        ${isActive ? 'ring-2 ring-offset-1' : ''}
                        ${isCompleted ? 'bg-[#dcfce7] text-[#22c55e]' : isActive ? 'text-white' : 'bg-[#f1f5f9] text-[#cbd5e1]'}
                      `}
                      style={{
                        backgroundColor: isActive ? stage.color : isCompleted ? '#dcfce7' : '#f1f5f9',
                        ringColor: isActive ? stage.color : undefined
                      }}
                    >
                      <Icon className={`${size === 'sm' ? 'w-3 h-3' : size === 'md' ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} />
                    </div>
                  );
                })}
              </div>
            )}

            {/* Label */}
            {showLabel && currentStage && (
              <p className={`${config.label} text-[#64748b] mt-1 text-center uppercase tracking-wide`}>
                {currentStage.label}
              </p>
            )}
          </>
        )}
      </div>

      {/* Information Dialog */}
      <AlertDialog open={isInfoOpen} onOpenChange={setIsInfoOpen}>
        <AlertDialogContent className="bg-white border-[#dbeafe]">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-poppins text-[#1e293b] flex items-center gap-2">
              <Info className="w-5 h-5 text-[#3b82f6]" />
              Validation Workflow Process
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[#64748b]">
              The validation process follows a 4-stage workflow to ensure comprehensive document analysis and compliance checking.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4 py-4">
            {stages.map((stage, index) => {
              const Icon = stage.icon;
              const isCurrentStage = stage.key === status;
              
              return (
                <div 
                  key={stage.key}
                  className={`
                    flex gap-3 p-3 rounded-lg border
                    ${isCurrentStage ? 'border-[#3b82f6] bg-[#eff6ff]' : 'border-[#dbeafe] bg-[#f8f9fb]'}
                  `}
                >
                  <div 
                    className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: stage.bgColor }}
                  >
                    <Icon 
                      className="w-5 h-5"
                      style={{ color: stage.color }}
                    />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-poppins text-[#1e293b]">
                        Stage {index + 1}: {stage.label}
                      </h4>
                      {isCurrentStage && (
                        <span className="px-2 py-0.5 bg-[#3b82f6] text-white text-xs rounded-full">
                          Current
                        </span>
                      )}
                      {stage.completed && !isCurrentStage && (
                        <CheckCircle2 className="w-4 h-4 text-[#22c55e]" />
                      )}
                    </div>
                    <p className="text-sm text-[#64748b]">
                      {stage.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="bg-[#eff6ff] border border-[#3b82f6] rounded-lg p-4">
            <p className="text-sm text-[#64748b]">
              <span className="font-poppins text-[#1e293b]">Current Progress:</span> {progress}% complete
              {currentStage && ` - ${currentStage.label} stage`}
            </p>
          </div>

          <AlertDialogFooter>
            <AlertDialogAction 
              onClick={() => setIsInfoOpen(false)}
              className="bg-[#3b82f6] hover:bg-[#2563eb] text-white"
            >
              Got it
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
