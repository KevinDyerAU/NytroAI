/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { HeroScene, QuantumComputerScene } from '../components/QuantumScene';
import { SurfaceCodeDiagram, TransformerDecoderDiagram, PerformanceMetricDiagram } from '../components/Diagrams';
import { ArrowDown, Menu, X, CheckCircle2, ShieldCheck, Zap, Users, BookOpen, PlayCircle } from 'lucide-react';
import { LoginDialog } from '../components/auth/LoginDialog';
import { SignUpDialog } from '../components/auth/SignUpDialog';
import { VideoDialog } from '../components/VideoDialog';
import wizardLogo from '../assets/wizard-logo.png';

const FeatureCard = ({ icon: Icon, title, description, delay }: { icon: any, title: string, description: string, delay: string }) => {
  return (
    <div className="flex flex-col group animate-fade-in-up p-8 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-xl hover:border-teal-200 transition-all duration-300 w-full" style={{ animationDelay: delay }}>
      <div className="w-14 h-14 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-6 group-hover:bg-gradient-brand group-hover:text-white transition-all duration-300">
        <Icon size={28} />
      </div>
      <h3 className="font-sans font-bold text-xl text-slate-900 mb-3">{title}</h3>
      <p className="text-slate-500 leading-relaxed">{description}</p>
    </div>
  );
};

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loginDialogOpen, setLoginDialogOpen] = useState(false);
  const [signUpDialogOpen, setSignUpDialogOpen] = useState(false);
  const [videoDialogOpen, setVideoDialogOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    setMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      const headerOffset = 100;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth"
      });
    }
  };

  const handleLogin = () => {
    setLoginDialogOpen(true);
  };

  const handleSignUp = () => {
    setSignUpDialogOpen(true);
  };

  const handleWatchVideo = () => {
    setVideoDialogOpen(true);
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
    <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-teal-200 selection:text-teal-900 font-sans">
      
      {/* Navigation */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white/90 backdrop-blur-md shadow-sm py-4' : 'bg-transparent py-6'}`}>
        <div className="container mx-auto px-6 flex justify-between items-center">
          {/* Logo */}
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <img
              src={wizardLogo}
              alt="Nytro Logo"
              className="h-20 w-auto object-contain"
            />
          </div>
          
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <a href="#features" onClick={scrollToSection('features')} className="hover:text-blue-600 transition-colors cursor-pointer">Features</a>
            <a href="#validation" onClick={scrollToSection('validation')} className="hover:text-blue-600 transition-colors cursor-pointer">Validation</a>
            <a href="#support" onClick={scrollToSection('support')} className="hover:text-blue-600 transition-colors cursor-pointer">Support</a>
            <a href="#contact" onClick={scrollToSection('contact')} className="hover:text-blue-600 transition-colors cursor-pointer">Contact</a>
            <button 
              onClick={handleLogin}
              className="px-6 py-2.5 bg-gradient-brand text-white rounded-full hover:bg-slate-800 transition-all shadow-lg hover:shadow-xl font-semibold"
            >
              Login
            </button>
            <button 
              onClick={handleSignUp}
              className="px-6 py-2.5 bg-gradient-brand text-white rounded-full hover:bg-slate-800 transition-all shadow-lg hover:shadow-xl font-semibold"
            >
              Sign Up
            </button>
          </div>

          <button className="md:hidden text-slate-900 p-2" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 bg-white flex flex-col items-center justify-center gap-8 text-xl font-bold animate-fade-in">
            <a href="#features" onClick={scrollToSection('features')}>Features</a>
            <a href="#validation" onClick={scrollToSection('validation')}>Validation</a>
            <a href="#support" onClick={scrollToSection('support')}>Support</a>
            <a href="#contact" onClick={scrollToSection('contact')}>Contact</a>
            <button 
              onClick={handleLogin}
              className="px-8 py-3 bg-gradient-brand text-white rounded-full shadow-lg"
            >
              Login
            </button>
            <button 
              onClick={handleSignUp}
              className="px-8 py-3 bg-gradient-brand text-white rounded-full shadow-lg"
            >
              Sign Up
            </button>
        </div>
      )}

      {/* Hero Section */}
      <header className="relative min-h-screen flex items-center justify-center overflow-hidden bg-white pt-20">
        {/* 3D Background */}
        <HeroScene />
        
        {/* Gradient Overlay for Text Readability */}
        <div className="absolute inset-0 z-0 bg-gradient-to-b from-transparent via-white/50 to-white pointer-events-none" />

        <div className="relative z-10 container mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 mb-6 px-4 py-2 border border-teal-200 bg-teal-50 text-teal-700 text-xs uppercase font-bold rounded-full shadow-sm">
            <ShieldCheck size={14} />
            Ready for 2025 Standards
          </div>
          <h1 className="font-sans font-bold text-5xl md:text-7xl leading-tight mb-8 text-slate-900 drop-shadow-sm max-w-5xl mx-auto">
            Transform the way your operation runs.
          </h1>
          <p className="max-w-2xl mx-auto text-lg md:text-xl text-slate-600 leading-relaxed mb-10">
            Nytro is not a CRM or an LMS. It is built to support RTOs by providing validation before delivery and ongoing validation of units, learner guides & student documents.
          </p>
          
          <div className="flex flex-col sm:flex-row justify-center gap-4">
             <button onClick={handleWatchVideo} className="group px-8 py-4 bg-gradient-brand text-white rounded-full font-semibold shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-3">
                <PlayCircle size={20} className="text-white group-hover:text-white transition-colors"/>
                Watch Video
             </button>
             <button onClick={scrollToSection('features')} className="px-8 py-4 bg-white text-slate-700 border border-slate-200 rounded-full font-semibold hover:border-blue-400 hover:text-blue-600 transition-all flex items-center justify-center">
                Explore Features
             </button>
          </div>
        </div>
      </header>

      <main>
        {/* Introduction / Main Value Prop */}
        <section id="features" className="py-24 bg-white">
          <div className="container mx-auto px-6">
            <div className="text-center max-w-3xl mx-auto mb-16">
                <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6">Everything Your RTO Needs in One Smart System</h2>
                <p className="text-slate-600 text-lg">
                    The system delivers clear feedback that improves consistency, aligns with the principles of assessment and rules of evidence, and enables RTOs to demonstrate effective validation processes at audit.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                <FeatureCard 
                    icon={ShieldCheck}
                    title="Unit Validation"
                    description="Enhance accuracy & efficiency. Ensure every unit meets compliance standards before delivery."
                    delay="0s"
                />
                <FeatureCard 
                    icon={BookOpen}
                    title="Learner Guide Validation"
                    description="Create stronger educational outcomes with guides that are automatically checked for alignment."
                    delay="0.1s"
                />
                <FeatureCard 
                    icon={CheckCircle2}
                    title="Student Validation"
                    description="Simple, ongoing validation of student documents to maintain audit readiness."
                    delay="0.2s"
                />
                <FeatureCard 
                    icon={Zap}
                    title="Pre-Marking"
                    description="Save time and improve accuracy with automated pre-marking analysis."
                    delay="0.3s"
                />
                 <FeatureCard 
                    icon={Users}
                    title="Student Support System"
                    description="24/7 learning assistance powered by Nytro to help students succeed anytime."
                    delay="0.4s"
                />
            </div>
          </div>
        </section>

        {/* Interactive Feature: Validation */}
        <section id="validation" className="py-24 bg-slate-50 overflow-hidden">
            <div className="container mx-auto px-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-700 text-xs font-bold uppercase rounded-full mb-6">
                            Compliance First
                        </div>
                        <h2 className="text-4xl font-bold mb-6 text-slate-900">Validation That Enhances Accuracy</h2>
                        <p className="text-lg text-slate-600 mb-6 leading-relaxed">
                           Navigating the 2025 Standards requires precision. Nytro provides instant feedback on your assessment tools and learner resources.
                        </p>
                        <ul className="space-y-4 mb-8">
                            {[
                                "Aligns with Principles of Assessment",
                                "Checks Rules of Evidence",
                                "Demonstrates effective validation at audit"
                            ].map((item, i) => (
                                <li key={i} className="flex items-center gap-3 text-slate-700 font-medium">
                                    <CheckCircle2 className="text-teal-500" size={20} />
                                    {item}
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div>
                        <SurfaceCodeDiagram />
                    </div>
                </div>
            </div>
        </section>

        {/* Interactive Feature: Student Support */}
        <section id="support" className="py-24 bg-slate-900 text-white relative">
            {/* Abstract shapes */}
            <div className="absolute top-0 right-0 w-1/2 h-full opacity-20 pointer-events-none overflow-hidden">
                 <div className="w-[600px] h-[600px] bg-blue-600 rounded-full blur-[120px] absolute -top-32 -right-32"></div>
            </div>

            <div className="container mx-auto px-6 relative z-10">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                     <div className="order-2 lg:order-1">
                        <TransformerDecoderDiagram />
                     </div>
                     <div className="order-1 lg:order-2">
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-teal-900 text-teal-300 text-xs font-bold uppercase rounded-full mb-6 border border-teal-800">
                            Always On
                        </div>
                        <h2 className="text-4xl font-bold mb-6">Nytro Student Support</h2>
                        <p className="text-lg text-slate-300 mb-6 leading-relaxed">
                            Your trainers can't be available 24/7, but Nytro can. Our intelligent support system guides students through their learner guides, providing hints and clarifications without giving away the answers.
                        </p>
                        <div className="p-6 bg-slate-800 rounded-xl border border-slate-700">
                             <p className="text-teal-400 font-semibold mb-2">Real Impact</p>
                             <p className="text-slate-400">"It's like having a tutor available at midnight when I'm actually doing my study."</p>
                        </div>
                     </div>
                </div>
            </div>
        </section>

        {/* Efficiency / Impact */}
        <section className="py-24 bg-white">
            <div className="container mx-auto px-6 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                <div>
                    <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6">Pre-Marking That Saves Time</h2>
                    <p className="text-lg text-slate-600 mb-8">
                        Free up your trainers to focus on teaching. Nytro pre-analyzes student submissions, highlighting potential issues and ensuring completeness before a trainer even looks at the page.
                    </p>
                    <PerformanceMetricDiagram />
                </div>
                <div className="relative h-[400px] rounded-2xl overflow-hidden shadow-2xl bg-slate-100">
                    <QuantumComputerScene />
                    <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-slate-900/80 to-transparent text-white">
                        <p className="font-bold text-xl">Streamlined Operations</p>
                        <p className="text-sm text-slate-200">Drive growth with efficient compliance.</p>
                    </div>
                </div>
            </div>
        </section>

        {/* Testimonial */}
        <section className="py-24 bg-slate-50 border-y border-slate-200">
           <div className="container mx-auto px-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
                    {/* First Testimonial */}
                    <div className="bg-white p-10 md:p-14 rounded-3xl shadow-sm border border-slate-100 relative">
                        <div className="absolute top-10 left-10 text-6xl font-serif text-teal-200 opacity-50">"</div>
                        <p className="text-xl md:text-2xl text-slate-700 leading-relaxed italic text-center relative z-10 mb-8">
                            As a trainer in the VET sector, I'm always on the lookout for tools that make compliance easier and help me focus more on my students. Nytro looks like a real game-changer—it's designed to save time and keep everything running smoothly. I'm excited to see how it can transform the way RTOs work!
                        </p>
                        <div className="flex flex-col items-center">
                            <div className="w-16 h-16 bg-slate-200 rounded-full mb-4 overflow-hidden">
                                <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Chris" alt="Chris J" />
                            </div>
                            <h4 className="font-bold text-slate-900">Chris J.</h4>
                            <p className="text-sm text-slate-500 font-medium">Trainer, Sydney</p>
                        </div>
                    </div>

                    {/* Second Testimonial */}
                    <div className="bg-white p-10 md:p-14 rounded-3xl shadow-sm border border-slate-100 relative">
                        <div className="absolute top-10 left-10 text-6xl font-serif text-teal-200 opacity-50">"</div>
                        <p className="text-xl md:text-2xl text-slate-700 leading-relaxed italic text-center relative z-10 mb-8">
                            Managing compliance across multiple campuses has always been challenging, but Nytro has made it seamless. It's a must-have for any RTO looking to simplify their processes.
                        </p>
                        <div className="flex flex-col items-center">
                            <div className="w-16 h-16 bg-slate-200 rounded-full mb-4 overflow-hidden">
                                <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah" alt="Sarah H" />
                            </div>
                            <h4 className="font-bold text-slate-900">Sarah H.</h4>
                            <p className="text-sm text-slate-500 font-medium">Compliance Coordinator, Perth</p>
                        </div>
                    </div>
                </div>
           </div>
        </section>

      </main>

      {/* Footer */}
      <footer id="contact" className="bg-slate-900 text-slate-300 py-20">
        <div className="container mx-auto px-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                <div>
                    <h2 className="text-3xl font-bold text-white mb-6">Get In Touch</h2>
                    <p className="text-lg text-slate-400 mb-8">Driving your success with innovation and expertise.</p>
                    
                    <div className="space-y-4">
                        <a href="mailto:info@nytro.com.au" className="flex items-center gap-3 hover:text-teal-400 transition-colors">
                            <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                            </div>
                            info@nytro.com.au
                        </a>
                    </div>
                </div>
                
                <div className="text-center md:text-right">
                    <p className="text-sm text-slate-500 mb-4">© 2025 Nytro. All rights reserved.</p>
                    <div className="flex gap-6 justify-center md:justify-end">
                        <a href="#" className="text-slate-500 hover:text-teal-400 transition-colors">Privacy Policy</a>
                        <a href="#" className="text-slate-500 hover:text-teal-400 transition-colors">Terms of Service</a>
                    </div>
                </div>
            </div>
        </div>
      </footer>

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
      
      {/* Video Dialog */}
      <VideoDialog 
        open={videoDialogOpen} 
        onOpenChange={setVideoDialogOpen} 
      />
    </div>
  );
};
