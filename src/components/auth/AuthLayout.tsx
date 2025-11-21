import React from 'react';
import nytroLogo from '../../assets/nytro-logo.jpeg';

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex">
      {/* Left side - Branding with white background */}
      <div className="hidden lg:flex lg:w-1/2 bg-white p-12 flex-col justify-between">
        <div>
          <img
            src={nytroLogo}
            alt="Nytro Logo"
            className="h-12 w-auto object-contain mb-4"
          />
          <p className="text-sm text-[#64748b]">Intelligence That Powers Performance</p>
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold leading-tight text-[#1e293b]">
              Leverage Intelligence That Powers Performance
            </h1>
            <p className="text-lg text-[#64748b]">
              to achieve seamless compliance with AI powered analysis and intelligent automation,
            </p>
          </div>
          <div className="flex gap-8 pt-4">
            <div>
              <p className="text-2xl font-semibold text-[#1e293b]">500+</p>
              <p className="text-sm text-[#64748b]">RTOs Using Nytro</p>
            </div>
            <div>
              <p className="text-2xl font-semibold text-[#1e293b]">500K+</p>
              <p className="text-sm text-[#64748b]">Assessments Validated</p>
            </div>
          </div>
        </div>
        <div className="text-[#64748b] text-sm">
          © 2025 Nytro. All rights reserved.
        </div>
      </div>

      {/* Right side - Form with blue gradient background */}
      <div className="flex-1 flex items-center justify-center p-8 bg-gradient-to-br from-[#0f4a8a] via-[#1e5fa8] to-[#3b82f6]">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-white">{title}</h2>
            {subtitle && (
              <p className="text-blue-100 mt-2 text-sm">{subtitle}</p>
            )}
          </div>
          <div className="bg-white rounded-xl p-6">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
