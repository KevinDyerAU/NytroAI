import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Home,
  Upload,
  Target,
  Settings,
  Lock,
  LogOut,
  Menu,
  X
} from 'lucide-react';
import { HUDStatusIndicator } from './HUDStatusIndicator';
import { useAuth } from '../hooks/useAuth';
import { fetchRTOById } from '../types/rto';
import wizardLogo from '../assets/wizard-logo.png';

interface NavigationProps {
  currentView: string;
  onNavigate: (view: string) => void;
}

interface RTOInfo {
  code: string;
  legalname: string;
}

export function Navigation({ currentView, onNavigate }: NavigationProps) {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const [rtoInfo, setRtoInfo] = useState<RTOInfo | null>(null);
  const [isLoadingRTO, setIsLoadingRTO] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Close mobile menu when navigating
  const handleMobileNavigate = (view: string) => {
    onNavigate(view);
    setIsMobileMenuOpen(false);
  };

  useEffect(() => {
    const loadRTOInfo = async () => {
      if (!user?.rto_id) {
        setRtoInfo(null);
        return;
      }

      setIsLoadingRTO(true);
      try {
        const rto = await fetchRTOById(user.rto_id);
        if (rto) {
          setRtoInfo({
            code: rto.code,
            legalname: rto.legalname,
          });
        }
      } catch (error) {
        console.error('Error loading RTO info:', error);
        setRtoInfo(null);
      } finally {
        setIsLoadingRTO(false);
      }
    };

    loadRTOInfo();
  }, [user?.rto_id]);

  const handleLogout = async () => {
    if (isLoggingOut) {
      console.log('[Navigation] Logout already in progress, ignoring click');
      return;
    }

    console.log('[Navigation] Starting logout...');
    setIsLoggingOut(true);
    try {
      await logout();
      console.log('[Navigation] Logout complete, navigating to landing page');
      navigate('/');
    } catch (err) {
      console.error('[Navigation] Logout failed:', err);
      setIsLoggingOut(false);
    }
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'acquisition', label: 'Unit Acquisition', icon: Target },
    { id: 'upload', label: 'Validate', icon: Upload },
  ];

  return (
    <>
      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b border-[#dbeafe] shadow-soft px-4 py-3 flex items-center justify-between">
        <img
          src={wizardLogo}
          alt="Nytro Logo"
          className="h-10 w-auto object-contain"
        />
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 rounded-lg hover:bg-[#f1f5f9] transition-colors"
        >
          {isMobileMenuOpen ? <X className="w-6 h-6 text-[#64748b]" /> : <Menu className="w-6 h-6 text-[#64748b]" />}
        </button>
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <nav className={`
        fixed top-0 left-0 bottom-0 w-72 z-50 bg-white border-r border-[#dbeafe] shadow-soft flex flex-col
        transform transition-transform duration-300 ease-in-out
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0
      `}>
      {/* Logo */}
      <div className="p-6 border-b border-[#dbeafe]">
        <div className="mb-4">
          <img
            src={wizardLogo}
            alt="Nytro Logo"
            className="w-full h-auto object-contain mb-2"
          />
          <p className="text-xs text-[#64748b] ml-1">Intelligence That Powers Performance</p>
        </div>

        {/* RTO Details */}
        {rtoInfo && (
          <div className="mb-4 p-3 bg-[#f8f9fb] border border-[#dbeafe] rounded-lg">
            <p className="text-sm font-poppins font-semibold text-[#1e293b]">{rtoInfo.legalname}</p>
          </div>
        )}

        {isLoadingRTO && (
          <div className="mb-4 p-3 bg-[#f8f9fb] border border-[#dbeafe] rounded-lg">
            <p className="text-xs text-[#cbd5e1] animate-pulse">Loading RTO details...</p>
          </div>
        )}

        {/* System Status */}
        <div className="flex flex-col gap-2">
          <HUDStatusIndicator status="online" label="AI ONLINE" size="sm" />
          <HUDStatusIndicator status="processing" label="ACTIVE" size="sm" />
        </div>
      </div>

      {/* Nav Items */}
      <div className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => handleMobileNavigate(item.id)}
              className={`
                w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all
                font-poppins text-sm
                ${isActive 
                  ? 'bg-[#3b82f6] text-white shadow-soft' 
                  : 'text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#1e293b]'
                }
              `}
            >
              <Icon className="w-5 h-5" />
              {item.label}
            </button>
          );
        })}
      </div>
      
      {/* Settings and Admin */}
      <div className="p-4 border-t border-[#dbeafe] space-y-1">
        <button
          onClick={() => handleMobileNavigate('settings')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
            currentView === 'settings'
              ? 'bg-[#e0f2fe] text-[#0284c7]'
              : 'text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#1e293b]'
          }`}
        >
          <Settings className="w-5 h-5" />
          <span className="font-poppins text-sm">Settings</span>
        </button>

        <button
          onClick={() => handleMobileNavigate('maintenance')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
            currentView === 'maintenance'
              ? 'bg-[#f3e8ff] text-[#7c3aed]'
              : 'text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#1e293b]'
          }`}
        >
          <Lock className="w-5 h-5" />
          <span className="font-poppins text-sm">Admin</span>
        </button>

        <button
          onClick={handleLogout}
          disabled={isLoggingOut}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
            isLoggingOut
              ? 'text-[#94a3b8] bg-[#f1f5f9] cursor-not-allowed'
              : 'text-[#ef4444] hover:bg-[#fee2e2] hover:text-[#dc2626]'
          }`}
        >
          <LogOut className="w-5 h-5" />
          <span className="font-poppins text-sm">{isLoggingOut ? 'Logging out...' : 'Logout'}</span>
        </button>
      </div>
    </nav>
    </>
  );
}
