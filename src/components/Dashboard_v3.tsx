/**
 * Dashboard Component - Phase 3.4
 * Enhanced with virtual scrolling, toast notifications, and performance optimizations
 */

import React, { useState, useEffect, useMemo } from 'react';
import { FixedSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { KPIWidget } from './KPIWidget';
import { Card } from './ui/card';
import { ValidationStatusCard } from './ValidationStatusCard';
import { useValidationStatusList } from '../hooks/useValidationStatus_v2';
import { getRTOById, fetchRTOById } from '../types/rto';
import type { ValidationRecord } from '../types/rto';

interface Dashboard_v3Props {
  onValidationDoubleClick?: (validation: ValidationRecord) => void;
  selectedRTOId: string;
  creditsRefreshTrigger?: number;
}

export function Dashboard_v3({
  onValidationDoubleClick,
  selectedRTOId,
  creditsRefreshTrigger = 0,
}: Dashboard_v3Props) {
  const navigate = useNavigate();
  const [rtoCode, setRtoCode] = useState<string | null>(null);

  // Get RTO code from ID
  useEffect(() => {
    const loadRTOCode = async () => {
      if (!selectedRTOId) return;

      const cachedRTO = getRTOById(selectedRTOId);
      if (cachedRTO?.code) {
        setRtoCode(cachedRTO.code);
      } else {
        const rtoData = await fetchRTOById(selectedRTOId);
        if (rtoData?.code) {
          setRtoCode(rtoData.code);
        }
      }
    };

    loadRTOCode();
  }, [selectedRTOId]);

  // ✅ Use enhanced hook with debouncing, optimistic updates, and retry
  const { validations, isLoading, error, refresh } = useValidationStatusList(rtoCode || '');

  // ✅ Show toast notification when viewing deleted validation
  useEffect(() => {
    if (error === 'This validation has been deleted') {
      toast.error('Validation Deleted', {
        description: 'This validation has been removed from the database',
        action: {
          label: 'Go to Dashboard',
          onClick: () => navigate('/dashboard'),
        },
        cancel: {
          label: 'Dismiss',
          onClick: () => {},
        },
        duration: 10000,
      });
    }
  }, [error, navigate]);

  // ✅ Calculate metrics from validations
  const metrics = useMemo(() => {
    const total = validations.length;
    const completed = validations.filter(v => v.validation_status === 'completed').length;
    const inProgress = validations.filter(v => v.validation_status === 'in_progress').length;
    const failed = validations.filter(v => v.validation_status === 'failed').length;

    return {
      total,
      completed,
      inProgress,
      failed,
      completionRate: total > 0 ? (completed / total) * 100 : 0,
    };
  }, [validations]);

  // ✅ Virtual scrolling row renderer
  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const validation = validations[index];
    
    return (
      <div style={style} className="px-4">
        <ValidationStatusCard
          validation={validation}
          onDoubleClick={() => onValidationDoubleClick?.(validation as any)}
        />
      </div>
    );
  };

  if (isLoading && validations.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading validations...</p>
        </div>
      </div>
    );
  }

  if (error && validations.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Card className="p-6 max-w-md">
          <div className="text-center">
            <div className="text-red-500 text-4xl mb-4">⚠️</div>
            <h3 className="text-lg font-semibold mb-2">Failed to Load Validations</h3>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <button
              onClick={refresh}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              Retry
            </button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPIWidget
          title="Total Validations"
          value={metrics.total}
          icon="FileText"
          trend={null}
        />
        <KPIWidget
          title="Completed"
          value={metrics.completed}
          icon="CheckCircle"
          trend={null}
        />
        <KPIWidget
          title="In Progress"
          value={metrics.inProgress}
          icon="Activity"
          trend={null}
        />
        <KPIWidget
          title="Completion Rate"
          value={`${metrics.completionRate.toFixed(1)}%`}
          icon="Target"
          trend={null}
        />
      </div>

      {/* Validations List with Virtual Scrolling */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Recent Validations</h2>
          <button
            onClick={refresh}
            className="px-3 py-1 text-sm bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80"
          >
            Refresh
          </button>
        </div>

        {validations.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-muted-foreground text-4xl mb-4">📋</div>
            <h3 className="text-lg font-semibold mb-2">No Validations Yet</h3>
            <p className="text-sm text-muted-foreground">
              Create your first validation to get started
            </p>
          </div>
        ) : (
          <div style={{ height: '600px' }}>
            <AutoSizer>
              {({ height, width }) => (
                <List
                  height={height}
                  itemCount={validations.length}
                  itemSize={140} // Height of each ValidationStatusCard + padding
                  width={width}
                  overscanCount={5} // Render 5 extra items above/below viewport
                >
                  {Row}
                </List>
              )}
            </AutoSizer>
          </div>
        )}
      </Card>

      {/* ✅ Toast notification for background sync */}
      {isLoading && validations.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50">
          <div className="bg-background border rounded-lg shadow-lg p-3 flex items-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
            <span className="text-sm">Syncing...</span>
          </div>
        </div>
      )}
    </div>
  );
}
