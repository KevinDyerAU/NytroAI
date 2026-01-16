import React, { useState } from 'react';
import { ChevronRight, Database, Building2, BookOpen, Brain, CheckSquare, FileText, Zap, Target, MessageSquare, PlayCircle, CreditCard } from 'lucide-react';
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
      id: 'rto',
      title: 'RTO Management',
      description: 'Manage Registered Training Organizations with full CRUD operations and cascading delete',
      icon: <Building2 className="w-8 h-8" />,
      color: 'bg-blue-50 border-blue-200',
    },
    {
      id: 'qualifications',
      title: 'Qualifications',
      description: 'Manage qualifications linked to RTOs with foreign key relationships',
      icon: <BookOpen className="w-8 h-8" />,
      color: 'bg-purple-50 border-purple-200',
    },
    {
      id: 'units',
      title: 'Units of Competency',
      description: 'Manage units of competency with assessment and competency details',
      icon: <CheckSquare className="w-8 h-8" />,
      color: 'bg-green-50 border-green-200',
    },
    {
      id: 'acquisition',
      title: 'Unit Acquisition',
      description: 'Extract Units of Competency from training.gov.au',
      icon: <Target className="w-8 h-8" />,
      color: 'bg-teal-50 border-teal-200',
    },
    {
      id: 'questions',
      title: 'Smart Questions',
      description: 'Manage smart questions for validation and assessment',
      icon: <Brain className="w-8 h-8" />,
      color: 'bg-orange-50 border-orange-200',
    },
    {
      id: 'validations',
      title: 'Validation Records',
      description: 'Manage validation summaries, details, and validation files',
      icon: <FileText className="w-8 h-8" />,
      color: 'bg-red-50 border-red-200',
    },
    {
      id: 'requirements',
      title: 'Requirements',
      description: 'Manage knowledge evidence, performance evidence, and other requirements',
      icon: <Database className="w-8 h-8" />,
      color: 'bg-indigo-50 border-indigo-200',
    },
    {
      id: 'credits',
      title: 'Credits Management',
      description: 'Manage AI and validation credits for each RTO',
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
    {
      id: 'trigger-validation',
      title: 'Trigger Validation',
      description: 'Manually trigger validation for debugging or re-running failed validations',
      icon: <PlayCircle className="w-8 h-8" />,
      color: 'bg-cyan-50 border-cyan-200',
    },
    {
      id: 'subscriptions',
      title: 'Subscriptions & Costs',
      description: 'Monitor paid service subscriptions including Render, Supabase, Google, and Netlify',
      icon: <CreditCard className="w-8 h-8" />,
      color: 'bg-violet-50 border-violet-200',
    },
  ];

  return (
    <div className="min-h-screen bg-[#f8f9fb] p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-12">
          <h1 className="text-4xl font-poppins font-bold text-[#1e293b] mb-2">Data Maintenance</h1>
          <p className="text-[#64748b] text-lg">Manage core entities and relationships in the system</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
