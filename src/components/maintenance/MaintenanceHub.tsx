import React, { useState } from 'react';
import { ChevronRight, Zap, MessageSquare } from 'lucide-react';
import { Card } from '../ui/card';

interface MaintenanceModule {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

interface MaintenanceHubProps {
  onSelectModule: (moduleId: string) => void;
}

export function MaintenanceHub({ onSelectModule }: MaintenanceHubProps) {
  const modules: MaintenanceModule[] = [
    {
      id: 'credits',
      title: 'Credits Management',
      description: 'Manage AI and validation credits for accounts and promo codes',
      icon: <Zap className="w-8 h-8" />,
      color: 'bg-yellow-50 border-yellow-200',
    },
    {
      id: 'prompts',
      title: 'Prompt Management',
      description: 'Manage Gemini AI validation prompts and correlate with validation types',
      icon: <MessageSquare className="w-8 h-8" />,
      color: 'bg-pink-50 border-pink-200',
    },
  ];

  return (
    <div className="min-h-screen bg-[#f8f9fb] p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-12">
          <h1 className="text-4xl font-poppins font-bold text-[#1e293b] mb-2">Administration</h1>
          <p className="text-[#64748b] text-lg">Manage system settings, credits, and platform operations</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {modules.map((module) => (
            <Card
              key={module.id}
              className={`border ${module.color} p-6 cursor-pointer hover:shadow-lg transition-all duration-300 flex flex-col`}
              onClick={() => onSelectModule(module.id)}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="text-[#1e293b]">{module.icon}</div>
                <ChevronRight className="w-5 h-5 text-[#94a3b8]" />
              </div>
              <h3 className="text-lg font-poppins font-semibold text-[#1e293b] mb-2">{module.title}</h3>
              <p className="text-sm text-[#64748b] flex-grow">{module.description}</p>
              <button
                className="mt-4 inline-flex items-center text-sm font-semibold text-[#3b82f6] hover:text-[#2563eb] transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectModule(module.id);
                }}
              >
                Open <ChevronRight className="w-4 h-4 ml-1" />
              </button>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
