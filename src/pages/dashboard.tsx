import { useState, useEffect } from 'react';
import { Navigation } from '../components/Navigation';
import { Dashboard_v3 as Dashboard } from '../components/Dashboard_v3';
import { UnitAcquisition } from '../components/UnitAcquisition';
import { DocumentUploadAdapterSimplified as DocumentUpload } from '../components/DocumentUploadAdapterSimplified';
import { ResultsExplorer_v2 as ResultsExplorer } from '../components/ResultsExplorer_v2';
import { Settings } from '../components/Settings';
import { MaintenanceHub } from '../components/maintenance/MaintenanceHub';
import { RTOMaintenance } from '../components/maintenance/RTOMaintenance';
import { QualificationsMaintenance } from '../components/maintenance/QualificationsMaintenance';
import { UnitOfCompetencyMaintenance } from '../components/maintenance/UnitOfCompetencyMaintenance';
import { SmartQuestionMaintenance } from '../components/maintenance/SmartQuestionMaintenance';
import { ValidationsMaintenance } from '../components/maintenance/ValidationsMaintenance';
import { RequirementsMaintenance } from '../components/maintenance/RequirementsMaintenance';
import { CreditsMaintenance } from '../components/maintenance/CreditsMaintenance';
import { PromptMaintenance } from '../components/maintenance/PromptMaintenance';
import { useAuth } from '../hooks/useAuth';
import { useIndexingProcessor } from '../hooks/useIndexingProcessor';
import type { ValidationRecord } from '../types/rto';
import { fetchRTOsFromSupabase, getCachedRTOs } from '../types/rto';

export function DashboardPage() {
  const { user } = useAuth();
  
  // Start background indexing processor
  useIndexingProcessor();
  const [currentView, setCurrentView] = useState('dashboard');
  const [selectedValidationId, setSelectedValidationId] = useState<string | null>(null);
  const [creditsRefreshTrigger, setCreditsRefreshTrigger] = useState(0);
  const [maintenanceModule, setMaintenanceModule] = useState<string | null>(null);
  const [rtosLoaded, setRtosLoaded] = useState(false);

  // Use user's RTO ID from auth instead of state
  const selectedRTOId = user?.rto_id ? String(user.rto_id) : '';

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

  const handleValidationDoubleClick = (validation: ValidationRecord) => {
    // Always navigate to Results Explorer when double-clicking a validation
    setSelectedValidationId(validation.id.toString());
    setCurrentView('results');
  };

  const handleValidationSubmit = (validationData?: { validationId: number; documentName: string; unitCode: string }) => {
    // Navigate to dashboard after validation starts
    console.log('[DashboardPage] handleValidationSubmit called with:', validationData);
    console.log('[DashboardPage] Navigating to dashboard view...');
    setCurrentView('dashboard');
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
        ← Back to Maintenance Hub
      </button>
    );

    switch (maintenanceModule) {
      case 'rto':
        return (
          <div className="space-y-4">
            {backButton}
            <RTOMaintenance />
          </div>
        );
      case 'qualifications':
        return (
          <div className="space-y-4">
            {backButton}
            <QualificationsMaintenance />
          </div>
        );
      case 'units':
        return (
          <div className="space-y-4">
            {backButton}
            <UnitOfCompetencyMaintenance />
          </div>
        );
      case 'acquisition':
        return (
          <div className="space-y-4">
            {backButton}
            <UnitAcquisition selectedRTOId={selectedRTOId} />
          </div>
        );
      case 'questions':
        return (
          <div className="space-y-4">
            {backButton}
            <SmartQuestionMaintenance />
          </div>
        );
      case 'validations':
        return (
          <div className="space-y-4">
            {backButton}
            <ValidationsMaintenance />
          </div>
        );
      case 'requirements':
        return (
          <div className="space-y-4">
            {backButton}
            <RequirementsMaintenance />
          </div>
        );
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
            onValidationDoubleClick={handleValidationDoubleClick}
            selectedRTOId={selectedRTOId}
            selectedRTOCode={user?.rto_code || null}
            creditsRefreshTrigger={creditsRefreshTrigger}
          />
        );
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
            onValidationDoubleClick={handleValidationDoubleClick}
            selectedRTOId={selectedRTOId}
            creditsRefreshTrigger={creditsRefreshTrigger}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9fb]">
      <Navigation currentView={currentView} onNavigate={setCurrentView} />
      <div className="pl-72">
        {renderView()}
      </div>
    </div>
  );
}
