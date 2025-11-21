import React from 'react';
import { Card } from '../ui/card';
import { CheckCircle2, Clock, Zap } from 'lucide-react';

interface ValidationProgressProps {
  progress: number;
  status: 'pending' | 'reqExtracted' | 'docExtracted' | 'validated';
  completedCount: number;
  totalCount: number;
  docExtracted: boolean;
  reqExtracted: boolean;
}

export function ValidationProgress({
  progress,
  status,
  completedCount,
  totalCount,
  docExtracted,
  reqExtracted,
}: ValidationProgressProps) {
  const stages = [
    {
      id: 'pending',
      label: 'Pending',
      icon: Clock,
      completed: reqExtracted || docExtracted,
    },
    {
      id: 'reqExtracted',
      label: 'Requirements',
      icon: Zap,
      completed: docExtracted,
    },
    {
      id: 'docExtracted',
      label: 'Documents',
      icon: CheckCircle2,
      completed: status === 'validated',
    },
    {
      id: 'validated',
      label: 'Validated',
      icon: CheckCircle2,
      completed: status === 'validated',
    },
  ];

  const getStatusColor = (stageId: string) => {
    if (stageId === status) return '#3b82f6';
    if (stages.find((s) => s.id === stageId)?.completed) return '#22c55e';
    return '#cbd5e1';
  };

  return (
    <div className="space-y-6">
      {/* Progress Circle */}
      <Card className="border border-[#dbeafe] bg-white p-8 text-center shadow-soft">
        <div className="flex items-center justify-center mb-6">
          <div className="relative w-40 h-40">
            <svg viewBox="0 0 160 160" className="w-full h-full transform -rotate-90">
              <circle
                cx="80"
                cy="80"
                r="70"
                fill="none"
                stroke="#e2e8f0"
                strokeWidth="8"
              />
              <circle
                cx="80"
                cy="80"
                r="70"
                fill="none"
                stroke="#3b82f6"
                strokeWidth="8"
                strokeDasharray={439.8}
                strokeDashoffset={439.8 * (1 - progress / 100)}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-4xl font-poppins font-bold text-[#1e293b]">{progress}%</div>
              <div className="text-xs text-[#64748b] uppercase tracking-wide mt-1">Complete</div>
            </div>
          </div>
        </div>

        {/* Progress Details */}
        <div className="space-y-3 mt-6 pt-6 border-t border-[#dbeafe]">
          <div className="flex justify-between items-center text-sm">
            <span className="text-[#64748b]">Requirements Validated</span>
            <span className="font-poppins font-semibold text-[#1e293b]">
              {completedCount} / {totalCount}
            </span>
          </div>
          <div className="w-full bg-[#f1f5f9] rounded-full h-2 overflow-hidden">
            <div
              className="bg-[#3b82f6] h-full rounded-full transition-all duration-300"
              style={{ width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }}
            />
          </div>
        </div>
      </Card>

      {/* Stage Indicators */}
      <Card className="border border-[#dbeafe] bg-white p-6 shadow-soft">
        <h3 className="font-poppins text-[#64748b] uppercase text-xs tracking-wide mb-4">
          Validation Stages
        </h3>
        <div className="space-y-3">
          {stages.map((stage, index) => {
            const Icon = stage.icon;
            const isActive = stage.id === status;
            const isCompleted = stage.completed;

            return (
              <div key={stage.id} className="flex items-center gap-4">
                <div className="flex items-center gap-3 flex-1">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{
                      backgroundColor:
                        isCompleted || isActive ? (isCompleted ? '#dcfce7' : '#dbeafe') : '#f1f5f9',
                    }}
                  >
                    <Icon
                      className="w-5 h-5"
                      style={{ color: getStatusColor(stage.id) }}
                    />
                  </div>
                  <div>
                    <p className="font-poppins text-[#1e293b] text-sm font-medium">
                      {stage.label}
                    </p>
                    {isActive && (
                      <p className="text-xs text-[#3b82f6]">Currently processing...</p>
                    )}
                  </div>
                </div>
                {isCompleted && (
                  <CheckCircle2 className="w-5 h-5 text-[#22c55e] flex-shrink-0" />
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Status Summary */}
      <Card className="border border-[#dbeafe] bg-white p-6 shadow-soft">
        <h3 className="font-poppins text-[#64748b] uppercase text-xs tracking-wide mb-4">
          Current Status
        </h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between p-2 bg-[#f8f9fb] rounded">
            <span className="text-sm text-[#64748b]">Documents Processed</span>
            <span className={`font-poppins font-semibold ${docExtracted ? 'text-[#22c55e]' : 'text-[#94a3b8]'}`}>
              {docExtracted ? '✓ Yes' : '—'}
            </span>
          </div>
          <div className="flex items-center justify-between p-2 bg-[#f8f9fb] rounded">
            <span className="text-sm text-[#64748b]">Requirements Extracted</span>
            <span className={`font-poppins font-semibold ${reqExtracted ? 'text-[#22c55e]' : 'text-[#94a3b8]'}`}>
              {reqExtracted ? '✓ Yes' : '—'}
            </span>
          </div>
          <div className="flex items-center justify-between p-2 bg-[#f8f9fb] rounded">
            <span className="text-sm text-[#64748b]">Validation Status</span>
            <span className="text-sm font-poppins font-semibold text-[#3b82f6]">
              {status === 'pending'
                ? 'Pending'
                : status === 'reqExtracted'
                  ? 'Processing Requirements'
                  : status === 'docExtracted'
                    ? 'Processing Documents'
                    : 'Completed'}
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
}
