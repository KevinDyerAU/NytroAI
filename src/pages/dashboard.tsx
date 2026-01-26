import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Navigation } from '../components/Navigation';
import { Dashboard_v3 as Dashboard } from '../components/Dashboard_v3';
import { UnitAcquisition } from '../components/UnitAcquisition';
import { DocumentUploadAdapterSimplified as DocumentUpload } from '../components/DocumentUploadAdapterSimplified';
import { ResultsExplorer_v2 as ResultsExplorer } from '../components/ResultsExplorer_v2';
import { Settings } from '../components/Settings';
import { MaintenanceHub } from '../components/maintenance/MaintenanceHub';
import { CreditsMaintenance } from '../components/maintenance/CreditsMaintenance';
import { PromptMaintenanceNew as PromptMaintenance } from '../components/maintenance/PromptMaintenanceNew';
import { SubscriptionsAdmin } from '../components/maintenance/SubscriptionsAdmin';
import { TechRoadmap } from '../components/maintenance/TechRoadmap';
import { NytroStrategyRoadmap } from '../components/maintenance/NytroStrategyRoadmap';
import { useAuth } from '../hooks/useAuth';
import type { ValidationRecord } from '../types/rto';
import { fetchRTOsFromSupabase, getCachedRTOs } from '../types/rto';

// Valid view names for URL state
const VALID_VIEWS = ['dashboard', 'acquisition', 'upload', 'results', 'settings', 'maintenance'];

export function DashboardPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Read view state from URL, default to 'dashboard'
  const urlView = searchParams.get('view') || 'dashboard';
  const urlValidationId = searchParams.get('validationId');
  const urlModule = searchParams.get('module');

  // Validate and use URL state
  // Block maintenance view for non-admin users (redirect to dashboard)
  const isMaintenanceAllowed = user?.is_admin === true;
  const currentView = VALID_VIEWS.includes(urlView)
    ? (urlView === 'maintenance' && !isMaintenanceAllowed ? 'dashboard' : urlView)
    : 'dashboard';
  const selectedValidationId = urlValidationId;
  const maintenanceModule = urlModule;

  const [creditsRefreshTrigger, setCreditsRefreshTrigger] = useState(0);
  const [rtosLoaded, setRtosLoaded] = useState(false);

  // Use user's RTO ID from auth instead of state
  const selectedRTOId = user?.rto_id ? String(user.rto_id) : '';

  // Update URL params - this enables browser back/forward and refresh persistence
  const updateUrlState = useCallback((updates: { view?: string; validationId?: string | null; module?: string | null }) => {
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);

      if (updates.view !== undefined) {
        if (updates.view === 'dashboard') {
          newParams.delete('view'); // Clean URL for default view
        } else {
          newParams.set('view', updates.view);
        }
      }

      if (updates.validationId !== undefined) {
        if (updates.validationId === null) {
          newParams.delete('validationId');
        } else {
          newParams.set('validationId', updates.validationId);
        }
      }

      if (updates.module !== undefined) {
        if (updates.module === null || updates.module === 'hub') {
          newParams.delete('module');
        } else {
          newParams.set('module', updates.module);
        }
      }

      return newParams;
    }, { replace: false }); // Use push to enable back button
  }, [setSearchParams]);

  // Custom navigation handler that updates URL state
  const handleNavigate = useCallback((view: string) => {
    // Clear validation ID when navigating away from results (unless navigating TO results)
    if (currentView === 'results' && view !== 'results') {
      updateUrlState({ view, validationId: null, module: null });
    } else if (view === 'maintenance') {
      updateUrlState({ view, module: 'hub' });
    } else {
      updateUrlState({ view, module: null });
    }
  }, [currentView, updateUrlState]);

  // Handler for setting validation ID (used when clicking a validation)
  const setSelectedValidationId = useCallback((id: string | null) => {
    updateUrlState({ validationId: id });
  }, [updateUrlState]);

  // Handler for setting maintenance module
  const setMaintenanceModule = useCallback((module: string | null) => {
    updateUrlState({ module });
  }, [updateUrlState]);

  // Load RTOs cache on mount
  useEffect(() => {
    const loadRTOs = async () => {
      console.log('[DashboardPage] Checking RTO cache...');
      const cached = getCachedRTOs();
      console.log('[DashboardPage] Cached RTOs count:', cached.length);

      if (cached.length === 0) {
        console.log('[DashboardPage] Cache empty, fetching RTOs from Supabase...');
        const fetched = await fetchRTOsFromSupabase();
        console.log('[DashboardPage] Fetched RTOs count:', fetched.length);
      }

      setRtosLoaded(true);
      console.log('[DashboardPage] RTOs loaded and ready');
    };
    loadRTOs();
  }, []);

  const handleValidationClick = useCallback((validation: ValidationRecord) => {
    // Navigates to Results Explorer when clicking a validation
    updateUrlState({ view: 'results', validationId: validation.id.toString() });
  }, [updateUrlState]);

  const handleValidationSubmit = (validationData?: { validationId: number; documentName: string; unitCode: string }) => {
    // Navigate to dashboard after validation starts
    console.log('[DashboardPage] handleValidationSubmit called with:', validationData);
    console.log('[DashboardPage] Navigating to dashboard view...');
    handleNavigate('dashboard');
  };

  const handleCreditsAdded = () => {
    setCreditsRefreshTrigger(prev => prev + 1);
  };

  const renderMaintenanceModule = () => {
    if (!maintenanceModule || maintenanceModule === 'hub') {
      return (
        <MaintenanceHub onSelectModule={(moduleId) => setMaintenanceModule(moduleId)} />
      );
    }

    const backButton = (
      <button
        onClick={() => setMaintenanceModule('hub')}
        className="px-4 py-2 bg-[#e2e8f0] hover:bg-[#cbd5e1] text-[#1e293b] font-semibold rounded transition-colors"
      >
        ← Back to Administration
      </button>
    );

    switch (maintenanceModule) {
      case 'credits':
        return (
          <div className="space-y-4">
            {backButton}
            <CreditsMaintenance onCreditsModified={handleCreditsAdded} />
          </div>
        );
      case 'prompts':
        return (
          <div className="space-y-4">
            {backButton}
            <PromptMaintenance />
          </div>
        );
      case 'subscriptions':
        return (
          <div className="space-y-4">
            {backButton}
            <SubscriptionsAdmin />
          </div>
        );
      case 'roadmap':
        return (
          <div className="space-y-4">
            {backButton}
            <TechRoadmap />
          </div>
        );
      case 'strategy':
        return (
          <div className="space-y-4">
            {backButton}
            <NytroStrategyRoadmap />
          </div>
        );
      default:
        return <MaintenanceHub onSelectModule={(moduleId) => setMaintenanceModule(moduleId)} />;
    }
  };

  const renderView = () => {
    if (currentView === 'maintenance') {
      return (
        <div className="min-h-screen bg-[#f8f9fb] p-8">
          <div className="max-w-7xl mx-auto">
            {renderMaintenanceModule()}
          </div>
        </div>
      );
    }

    switch (currentView) {
      case 'dashboard':
        return (
          <Dashboard
            onValidationClick={handleValidationClick}
            selectedRTOId={selectedRTOId}
            selectedRTOCode={user?.rto_code || null}
            creditsRefreshTrigger={creditsRefreshTrigger}
          />
        );
      case 'acquisition':
        return <UnitAcquisition selectedRTOId={selectedRTOId} />;
      case 'upload':
        if (!rtosLoaded) {
          return (
            <div className="flex items-center justify-center h-screen">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading RTO data...</p>
              </div>
            </div>
          );
        }
        return <DocumentUpload selectedRTOId={selectedRTOId} onValidationSubmit={handleValidationSubmit} onCreditsConsumed={handleCreditsAdded} />;
      case 'results':
        return <ResultsExplorer selectedValidationId={selectedValidationId} aiCreditsAvailable={(user?.credits || 0) > 0} selectedRTOId={selectedRTOId} />;
      case 'settings':
        return <Settings selectedRTOId={selectedRTOId} onCreditsAdded={handleCreditsAdded} />;
      default:
        return (
          <Dashboard
            onValidationClick={handleValidationClick}
            selectedRTOId={selectedRTOId}
            creditsRefreshTrigger={creditsRefreshTrigger}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9fb]">
      <Navigation currentView={currentView} onNavigate={handleNavigate} />
      {/* Main content - add top padding on mobile for header, left padding on desktop for sidebar */}
      <div className="pt-16 md:pt-0 md:pl-72">
        {renderView()}
      </div>
    </div>
  );
}
