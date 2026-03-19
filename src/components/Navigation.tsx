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
import nytroLogo from '../assets/nytro-logo-dark.png';

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

  // Build nav items based on user role
  // $99 users (no rto_id or no credits) only see Dashboard + Results
  // Full users (with rto_id and credits) see all nav items
  const hasFullAccess = !!user?.rto_id && (user?.credits > 0 || user?.is_admin);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    ...(hasFullAccess ? [
      { id: 'acquisition', label: 'Unit Acquisition', icon: Target },
      { id: 'upload', label: 'Validate', icon: Upload },
    ] : []),
  ];

  return (
    <>
      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 border-b border-slate-700/50 px-4 py-3 flex items-center justify-between" style={{ backgroundColor: '#0F172A' }}>
        <img
          src={nytroLogo}
          alt="Nytro Logo"
          className="h-10 w-auto object-contain cursor-pointer"
          onClick={() => navigate('/dashboard')}
        />
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
        >
          {isMobileMenuOpen ? <X className="w-6 h-6 text-slate-400" /> : <Menu className="w-6 h-6 text-slate-400" />}
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
        fixed top-0 left-0 bottom-0 w-72 z-50 flex flex-col border-r border-slate-700/50
        transform transition-transform duration-300 ease-in-out
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0
      `} style={{ backgroundColor: '#0F172A' }}>
        {/* Logo */}
        <div className="p-6 border-b border-slate-700/50">
          <div className="mb-4">
            <img
              src={nytroLogo}
              alt="Nytro Logo"
              className="w-[70%] h-auto object-contain mb-2 cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => navigate('/dashboard')}
            />
            <p className="text-xs text-slate-500 ml-1 italic">Precision that powers performance</p>
          </div>

          {/* RTO Details */}
          {rtoInfo && (
            <div className="mb-4 p-3 bg-slate-800/60 border border-slate-700/50 rounded-lg">
              <p className="text-sm font-sans font-semibold text-white">{rtoInfo.legalname}</p>
            </div>
          )}

          {isLoadingRTO && (
            <div className="mb-4 p-3 bg-slate-800/60 border border-slate-700/50 rounded-lg">
              <p className="text-xs text-slate-500 animate-pulse">Loading RTO details...</p>
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
                font-sans text-sm
                ${isActive
                    ? 'bg-teal-500/15 text-teal-400 border border-teal-500/20'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
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
        <div className="p-4 border-t border-slate-700/50 space-y-1">
          <button
            onClick={() => handleMobileNavigate('settings')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${currentView === 'settings'
                ? 'bg-teal-500/15 text-teal-400 border border-teal-500/20'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
          >
            <Settings className="w-5 h-5" />
            <span className="font-sans text-sm">Settings</span>
          </button>

          {/* Admin - Only visible to admin users */}
          {user?.is_admin && (
            <button
              onClick={() => handleMobileNavigate('maintenance')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${currentView === 'maintenance'
                  ? 'bg-purple-500/15 text-purple-400 border border-purple-500/20'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
            >
              <Lock className="w-5 h-5" />
              <span className="font-sans text-sm">Admin</span>
            </button>
          )}

          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${isLoggingOut
                ? 'text-slate-600 bg-slate-800 cursor-not-allowed'
                : 'text-red-400 hover:bg-red-500/10 hover:text-red-300'
              }`}
          >
            <LogOut className="w-5 h-5" />
            <span className="font-sans text-sm">{isLoggingOut ? 'Logging out...' : 'Logout'}</span>
          </button>
        </div>
      </nav>
    </>
  );
}
