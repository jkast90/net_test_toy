import React, { useEffect } from 'react';
import type { TriggeredEvent } from '../components/Builder/builderTypes';
import {
  Alert,
  ToastContainer,
  DashboardBuilder,
  MonitoringUnavailableState
} from '../../_common/components';
import { NavBarPageHeader } from '../../_common/components/layout';
import styles from './SharedBGPPages.module.css';
import { useAppSelector } from '../../_common/store/hooks';
import { selectAllEnabledDaemons } from '../../_common/store/connectionSelectors';
import { useBMP, useBMPPolling } from '../../_common/hooks/useBMP';
import { useFlowSpecOperationsWithFeedback, useFlowSpec, useFeedbackToast, useDashboardLayout } from '../../_common/hooks';
import { useMonitoring } from '../../_common/contexts/ConfigContext';
import { bmpService } from '../../_common/services/bmp/bmpService';
import { useBMPMonitorPaneConfigs } from '../hooks/useBMPMonitorPaneConfigs';

const BMPMonitor: React.FC = () => {
  const targets = useAppSelector(selectAllEnabledDaemons);
  const monitoring = useMonitoring();
  const containerManagerUrl = monitoring?.url?.replace(/\/bmp.*$/, '').replace(/:\d+\/.*$/, (match) => match.split('/')[0]) || '';

  // Configure bmpService with container manager URL
  useEffect(() => {
    // Extract base container manager URL from monitoring URL
    // monitoring.url is like "http://netstream-monitoring:5002"
    // We need the container manager URL like "http://localhost:5010"
    const baseUrl = 'http://localhost:5010'; // Container manager always runs on this port
    if (baseUrl) {
      bmpService.setContainerManagerUrl(baseUrl);
    }
  }, []);

  // Use the BMP hook for state and operations
  const {
    peers,
    routes,
    flowSpecRules,
    stats,
    loading,
    loadBMPData,
    configureBMPOnTargets,
    isConfiguring,
    configMessage,
    isDeletingRule,
    clearAllErrors
  } = useBMP();

  // Use FlowSpec hook for triggered events and mitigation cancellation
  const {
    cancelMitigationForEvent,
    cancelingMitigation
  } = useFlowSpec();

  // Triggered events - placeholder until we have the endpoint
  const triggeredEvents: TriggeredEvent[] = [];

  // Set up polling for real-time updates - increased to 15s to reduce server load
  useBMPPolling(!!monitoring?.url, monitoring?.url, 15000);

  // Use FlowSpec operations hook with automatic feedback
  const {
    handleDeleteFlowSpecRule,
    feedback,
    clearFeedback
  } = useFlowSpecOperationsWithFeedback(monitoring?.url, targets);

  // Toast notifications with automatic feedback display
  const { toasts, dismissToast } = useFeedbackToast({
    feedback,
    clearFeedback,
    duration: 5000
  });

  // Configure BMP on targets - hook handles all state
  const handleConfigureBMP = async () => {
    await configureBMPOnTargets(targets, monitoring?.url);
  };

  // Clear errors on mount
  useEffect(() => {
    clearAllErrors();
  }, [clearAllErrors]);

  // Dashboard layout state with localStorage persistence - MUST be before any conditional returns
  const {
    selectedPanes,
    paneOrder,
    previewColumns,
    setSelectedPanes,
    setPaneOrder,
    setPreviewColumns
  } = useDashboardLayout({
    storageKey: 'bmp-monitor-layout',
    defaultPanes: ['bmp-config', 'bmp-peers', 'flowspec-rules', 'bmp-stats'],
    defaultColumns: 3
  });

  // Check if monitoring service is available
  if (!monitoring?.url) {
    return (
      <MonitoringUnavailableState
        title="BMP Monitor"
        subtitle="Real-time peer and route monitoring"
        configMessage={configMessage}
      />
    );
  }

  // Handle rule added - reload BMP data
  const handleRuleAdded = () => {
    loadBMPData().catch((error) => {
      console.warn('Failed to fetch BMP data:', error);
    });
  };

  // Get pane configurations from hook
  const availablePanes = useBMPMonitorPaneConfigs({
    targets,
    monitoringUrl: monitoring?.url,
    peers,
    routes,
    flowSpecRules,
    statsSummary: stats,
    triggeredEvents,
    loading,
    isConfiguring,
    configMessage,
    isDeletingRule,
    cancelingMitigation,
    onConfigure: handleConfigureBMP,
    onDeleteFlowSpecRule: handleDeleteFlowSpecRule,
    onRuleAdded: handleRuleAdded,
    onCancelMitigation: cancelMitigationForEvent
  });

  return (
    <div className={styles.container}>
      <NavBarPageHeader
        title="BMP Monitor"
        subtitle="Real-time peer and route monitoring"
      />
      {/* Toast Notifications - stacks at top, pushes content down */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Loading state */}
      {loading.peers && peers.length === 0 && (
        <Alert
          type="info"
          message="Loading BMP data..."
        />
      )}

      {/* Error state */}
      {!loading.peers && peers.length === 0 && monitoring?.url && (
        <Alert
          type="warning"
          message="No BMP data available. BMP monitoring service may not be running or no peers are configured."
        />
      )}


      <DashboardBuilder
        availablePanes={availablePanes}
        selectedPanes={selectedPanes}
        onPanesChange={setSelectedPanes}
        paneOrder={paneOrder}
        onOrderChange={setPaneOrder}
        previewColumns={previewColumns}
        onColumnsChange={setPreviewColumns}
        storageKey="bmp-monitor-layout"
      />
    </div>
  );
};

export default BMPMonitor;