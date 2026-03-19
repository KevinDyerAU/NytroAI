import React from 'react';
import nytroLogo from '../../assets/nytro-logo-dark.png';

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex" style={{ backgroundColor: '#0F172A' }}>
      {/* Left side - Dark navy branding */}
      <div className="hidden lg:flex lg:w-1/2 p-12 flex-col justify-between" style={{ backgroundColor: '#0F172A' }}>
        <div>
          <img
            src={nytroLogo}
            alt="Nytro Logo"
            className="h-12 w-auto object-contain mb-4"
          />
          <p className="text-sm text-slate-500 italic">Precision that powers performance</p>
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <h1 className="text-4xl font-sans font-bold leading-tight text-white">
              Structured validation,<br />
              <span className="text-teal-400">without the manual workload.</span>
            </h1>
            <p className="text-lg text-slate-400">
              Clear, compliant visibility for Australian RTOs — in minutes, not days.
            </p>
          </div>
          <div className="flex gap-8 pt-4">
            <div>
              <p className="text-2xl font-semibold text-white">500+</p>
              <p className="text-sm text-slate-500">RTOs Using Nytro</p>
            </div>
            <div>
              <p className="text-2xl font-semibold text-white">500K+</p>
              <p className="text-sm text-slate-500">Assessments Validated</p>
            </div>
          </div>
        </div>
        <div className="text-slate-600 text-sm">
          &copy; {new Date().getFullYear()} Nytro Pty Ltd. All rights reserved.
        </div>
      </div>

      {/* Right side - Form with dark slate background */}
      <div className="flex-1 flex items-center justify-center p-8 bg-slate-900">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <img
              src={nytroLogo}
              alt="Nytro Logo"
              className="h-10 w-auto object-contain mb-6 lg:hidden"
            />
            <h2 className="text-3xl font-sans font-bold text-white">{title}</h2>
            {subtitle && (
              <p className="text-slate-400 mt-2 text-sm">{subtitle}</p>
            )}
          </div>
          <div className="bg-slate-800/80 backdrop-blur rounded-xl p-6 border border-slate-700/50">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
