/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, FileText, AlertCircle, BarChart2, MessageCircle, Zap } from 'lucide-react';

// --- VALIDATION SCANNER DIAGRAM ---
export const SurfaceCodeDiagram: React.FC = () => {
  const [scanLine, setScanLine] = useState(0);
  const [documents, setDocuments] = useState([
    { id: 1, status: 'pending' },
    { id: 2, status: 'pending' },
    { id: 3, status: 'pending' },
    { id: 4, status: 'pending' },
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      setScanLine(prev => (prev + 5) % 110);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
     if (scanLine > 90) {
         setDocuments(prev => prev.map(d => ({...d, status: 'valid'})));
     } else if (scanLine < 10) {
         setDocuments(prev => prev.map(d => ({...d, status: 'pending'})));
     }
  }, [scanLine]);

  return (
    <div className="flex flex-col items-center p-8 bg-white rounded-2xl shadow-xl border border-slate-100 my-8 w-full max-w-md mx-auto">
      <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
            <FileText size={24} />
          </div>
          <h3 className="font-sans font-bold text-xl text-slate-900">Auto-Validation</h3>
      </div>
      
      <div className="relative w-full h-64 bg-slate-50 rounded-xl border border-slate-200 overflow-hidden p-6 grid grid-cols-2 gap-4">
         {/* Scan Line */}
         <motion.div 
            className="absolute left-0 right-0 h-1 bg-gradient-to-r from-teal-400 to-blue-500 shadow-[0_0_20px_rgba(37,99,235,0.5)] z-20"
            style={{ top: `${scanLine}%` }}
         />

         {documents.map((doc) => (
             <div key={doc.id} className={`relative rounded-lg border-2 flex flex-col items-center justify-center transition-all duration-500 ${doc.status === 'valid' ? 'bg-teal-50 border-teal-400' : 'bg-white border-slate-200'}`}>
                 <div className="w-12 h-16 bg-slate-200 rounded mb-2 overflow-hidden relative">
                    <div className="space-y-1 p-1">
                        <div className="h-1 bg-slate-300 w-full rounded"></div>
                        <div className="h-1 bg-slate-300 w-3/4 rounded"></div>
                        <div className="h-1 bg-slate-300 w-full rounded"></div>
                    </div>
                    {doc.status === 'valid' && (
                        <div className="absolute inset-0 flex items-center justify-center bg-teal-500/20">
                            <CheckCircle className="text-teal-600 w-6 h-6" />
                        </div>
                    )}
                 </div>
                 <span className={`text-xs font-bold uppercase tracking-wider ${doc.status === 'valid' ? 'text-teal-600' : 'text-slate-400'}`}>
                     {doc.status === 'valid' ? 'Compliant' : 'Scanning...'}
                 </span>
             </div>
         ))}
      </div>
      
      <div className="mt-6 text-center">
          <p className="text-slate-500 text-sm">Real-time validation against <strong className="text-slate-900">2025 Standards</strong>.</p>
      </div>
    </div>
  );
};

// --- WORKFLOW / STUDENT SUPPORT DIAGRAM ---
export const TransformerDecoderDiagram: React.FC = () => {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
        setStep(s => (s + 1) % 3);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center p-8 bg-slate-900 text-white rounded-2xl border border-slate-800 my-8 w-full max-w-lg mx-auto shadow-2xl">
      <div className="flex items-center gap-3 mb-8">
          <MessageCircle size={24} className="text-teal-400"/>
          <h3 className="font-sans font-bold text-xl">24/7 Student Support</h3>
      </div>

      <div className="space-y-6 w-full">
        {/* Step 1: Query */}
        <motion.div 
            animate={{ opacity: step >= 0 ? 1 : 0.3, x: step >= 0 ? 0 : -10 }}
            className="flex items-start gap-4"
        >
            <div className="w-10 h-10 rounded-full bg-slate-700 flex-shrink-0 flex items-center justify-center text-slate-300 font-bold">S</div>
            <div className="bg-slate-800 p-4 rounded-r-xl rounded-bl-xl border border-slate-700 text-sm text-slate-300 shadow-sm">
                "I'm stuck on the assessment for Unit 3."
            </div>
        </motion.div>

        {/* Step 2: Nytro Processing */}
        <motion.div 
             animate={{ opacity: step >= 1 ? 1 : 0.3, scale: step === 1 ? 1.05 : 1 }}
             className="flex items-center justify-center py-2"
        >
            <div className="px-4 py-1 rounded-full bg-gradient-to-r from-teal-500/20 to-blue-500/20 border border-blue-500/30 text-xs text-blue-300 flex items-center gap-2">
                <Zap size={12} className="animate-pulse text-teal-400" /> Nytro Analyzing Learner Guide...
            </div>
        </motion.div>

        {/* Step 3: Response */}
        <motion.div 
            animate={{ opacity: step >= 2 ? 1 : 0.3, x: step >= 2 ? 0 : 10 }}
            className="flex items-start gap-4 flex-row-reverse"
        >
             <div className="w-10 h-10 rounded-full bg-gradient-brand flex-shrink-0 flex items-center justify-center text-white font-bold shadow-[0_0_15px_rgba(45,212,191,0.5)]">n</div>
             <div className="bg-white p-4 rounded-l-xl rounded-br-xl text-sm text-slate-900 shadow-md">
                Here is a hint based on page 42 of your guide: Focus on the principles of evidence collection.
             </div>
        </motion.div>
      </div>
    </div>
  );
};

// --- PERFORMANCE / EFFICIENCY CHART ---
export const PerformanceMetricDiagram: React.FC = () => {
    return (
        <div className="flex flex-col p-8 bg-white rounded-2xl border border-slate-200 shadow-lg w-full">
            <div className="mb-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-bold uppercase tracking-wide mb-2">
                    Efficiency
                </div>
                <h3 className="text-2xl font-bold text-slate-900">Reduce Marking Time</h3>
                <p className="text-slate-500 mt-2">Pre-marking capabilities drastically reduce administrative burden.</p>
            </div>

            <div className="flex items-end justify-around h-48 gap-8">
                {/* Traditional */}
                <div className="flex flex-col items-center w-1/2 h-full justify-end group">
                    <span className="mb-2 font-bold text-slate-400">Manual</span>
                    <div className="w-full bg-slate-200 rounded-t-lg relative group-hover:bg-slate-300 transition-colors" style={{ height: '80%' }}>
                        <div className="absolute top-4 left-0 right-0 text-center text-slate-500 font-bold">40 hrs</div>
                    </div>
                </div>

                {/* Nytro */}
                <div className="flex flex-col items-center w-1/2 h-full justify-end">
                     <span className="mb-2 font-bold text-teal-600">With Nytro</span>
                     <div className="w-full bg-gradient-brand rounded-t-lg relative shadow-[0_0_20px_rgba(45,212,191,0.3)]" style={{ height: '30%' }}>
                        <div className="absolute -top-8 left-0 right-0 text-center text-blue-600 font-bold text-xl">15 hrs</div>
                     </div>
                </div>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100 text-center text-xs text-slate-400">
                *Average time saved per cohort
            </div>
        </div>
    )
}