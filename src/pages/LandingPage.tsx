/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';
import { HeroScene } from '../components/QuantumScene';
import { LoginDialog } from '../components/auth/LoginDialog';
import { SignUpDialog } from '../components/auth/SignUpDialog';
import nytroLogo from '../assets/IMG_5440.jpeg';
import nytroWizardVideo from '../assets/NytroWizardClip.MP4';

export const LandingPage: React.FC = () => {
  const [loginDialogOpen, setLoginDialogOpen] = useState(false);
  const [signUpDialogOpen, setSignUpDialogOpen] = useState(false);

  const handleLogin = () => {
    setLoginDialogOpen(true);
  };

  const handleSignUp = () => {
    setSignUpDialogOpen(true);
  };

  const switchToSignUp = () => {
    setLoginDialogOpen(false);
    setSignUpDialogOpen(true);
  };

  const switchToLogin = () => {
    setSignUpDialogOpen(false);
    setLoginDialogOpen(true);
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 selection:bg-teal-200 selection:text-teal-900 font-sans overflow-hidden">
      
      {/* Nytro Logo - Top Left */}
      <div className="absolute top-6 left-6 z-20 animate-fade-in">
        <img
          src={nytroLogo}
          alt="Nytro"
          className="h-16 md:h-20 w-auto object-contain"
        />
      </div>

      {/* NytroWizard Video - Bottom Left (hidden on mobile) */}
      <div className="hidden md:block absolute bottom-6 left-6 z-20 animate-fade-in" style={{ animationDelay: '0.3s' }}>
        <video
          src={nytroWizardVideo}
          autoPlay
          loop
          muted
          playsInline
          className="h-40 w-auto"
        />
      </div>

      {/* Full Screen Hero with Login/Signup */}
      <div className="relative min-h-screen flex items-center justify-center">
        {/* 3D Background Bubbles */}
        <HeroScene />
        
        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 z-0 bg-gradient-to-br from-white/80 via-transparent to-white/60 pointer-events-none" />

        {/* Main Content */}
        <div className="relative z-10 flex flex-col items-center justify-center px-6 py-12">
          {/* Tagline */}
          <h1 className="font-sans font-bold text-3xl md:text-5xl leading-tight mb-4 text-slate-900 text-center max-w-2xl animate-fade-in-up">
            RTO Validation Made Simple
          </h1>
          
          <p className="text-slate-600 text-lg md:text-xl text-center max-w-xl mb-10 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
            AI-powered compliance validation for training organizations
          </p>

          {/* Auth Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            <button 
              onClick={handleLogin}
              className="px-10 py-4 bg-gradient-to-r from-[#0d9488] to-[#3b82f6] text-white rounded-full font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 text-lg min-w-[160px]"
            >
              Login
            </button>
            <button 
              onClick={handleSignUp}
              className="px-10 py-4 bg-white text-slate-700 border-2 border-slate-200 rounded-full font-semibold hover:border-[#3b82f6] hover:text-[#3b82f6] hover:scale-105 transition-all duration-300 text-lg min-w-[160px]"
            >
              Sign Up
            </button>
          </div>

          {/* Footer text */}
          <p className="mt-16 text-sm text-slate-400 animate-fade-in" style={{ animationDelay: '0.4s' }}>
            © 2025 Nytro. Ready for 2025 Standards.
          </p>
        </div>
      </div>

      {/* Auth Dialogs */}
      <LoginDialog 
        open={loginDialogOpen} 
        onOpenChange={setLoginDialogOpen} 
        onSwitchToSignUp={switchToSignUp} 
      />
      <SignUpDialog 
        open={signUpDialogOpen} 
        onOpenChange={setSignUpDialogOpen} 
        onSwitchToLogin={switchToLogin} 
      />
    </div>
  );
};
