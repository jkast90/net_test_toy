import React, { useEffect, useMemo } from 'react';
import { DashboardBuilder } from '../../_common/components';
import { useAppSelector, useAppDispatch } from '../../_common/store/hooks';
import { selectAllEnabledDaemons } from '../../_common/store/connectionSelectors';
import {
  selectNetFlowMonitorData,
  selectNetFlowStats,
  makeSelectTopTalkers,
  makeSelectTopConversations,
  makeSelectSortedFlows,
  selectProtocolDistribution
} from '../../_common/store/netflowSelectors';
import { clearErrors } from '../../_common/store/slices/netflowSlice';
import { useMonitoring, useConfig } from '../../_common/contexts/ConfigContext';
import { useNetFlowConfig } from '../../_common/hooks/useNetFlow';
import { useDashboardLayout } from '../../_common/hooks';
import { netflowService } from '../../_common/services/netflow/netflowService';
import {
  useTopTalkersLimit,
  useTopConversationsLimit,
  useRecentFlowsLimit
} from '../components/NetFlowMonitor';
import { useNetFlowMonitorPaneConfigs } from '../hooks/useNetFlowMonitorPaneConfigs';
import styles from './SharedBGPPages.module.css';
import { NavBarPageHeader } from '../../_common/components/layout';

const NetFlowMonitorRefactored: React.FC = () => {
  const dispatch = useAppDispatch();
  const targets = useAppSelector(selectAllEnabledDaemons);
  const monitoring = useMonitoring();
  const { config } = useConfig();

  // Dashboard layout state with localStorage persistence
  const {
    selectedPanes,
    paneOrder,
    previewColumns,
    setSelectedPanes,
    setPaneOrder,
    setPreviewColumns
  } = useDashboardLayout({
    storageKey: 'netflow-monitor-layout',
    defaultPanes: [
      'netflow-config',
      'netflow-statistics',
      'protocol-distribution',
      'top-talkers',
      'top-conversations',
      'recent-flows'
    ],
    defaultColumns: 3
  });

  // Redux state with memoized selectors
  const {
    statsSummary,
    isLoading,
    hasErrors,
    dataFreshness
  } = useAppSelector(selectNetFlowMonitorData);

  // Get raw NetFlow stats for NetFlowStatisticsPane (expects snake_case fields)
  const netflowStats = useAppSelector(selectNetFlowStats);

  // Get persisted limits
  const talkersLimit = useTopTalkersLimit();
  const conversationsLimit = useTopConversationsLimit();
  const flowsLimit = useRecentFlowsLimit();

  // Create memoized selectors with the current limits
  const selectTopTalkersWithLimit = useMemo(() => makeSelectTopTalkers(talkersLimit), [talkersLimit]);
  const selectTopConversationsWithLimit = useMemo(() => makeSelectTopConversations(conversationsLimit), [conversationsLimit]);
  const selectSortedFlowsWithLimit = useMemo(() => makeSelectSortedFlows(flowsLimit), [flowsLimit]);

  // Use memoized selectors for computed data
  const topTalkers = useAppSelector(selectTopTalkersWithLimit);
  const topConversations = useAppSelector(selectTopConversationsWithLimit);
  const flows = useAppSelector(selectSortedFlowsWithLimit);
  const protocolDistribution = useAppSelector(selectProtocolDistribution);

  // Configure netflowService with container manager URL
  // Container manager auto-discovers and routes to monitoring service
  useEffect(() => {
    if (config?.container_manager?.url) {
      netflowService.setContainerManagerUrl(config.container_manager.url);
    }
  }, [config]);

  // Use NetFlow configuration hook for auto-refresh
  const { refreshData } = useNetFlowConfig(monitoring?.url);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Auto-refresh every 10 seconds
  useEffect(() => {
    const interval = setInterval(refreshData, 10000);
    return () => clearInterval(interval);
  }, [refreshData]);

  // Clear errors on mount
  useEffect(() => {
    dispatch(clearErrors());
  }, [dispatch]);

  // Get pane configurations from hook
  const availablePanes = useNetFlowMonitorPaneConfigs({
    netflowStats,
    protocolDistribution,
    topTalkers,
    topConversations,
    flows,
    isLoading,
    dataFreshness
  });

  return (
    <div className={styles.container}>
      <NavBarPageHeader
        title="NetFlow Monitor"
        subtitle="Real-time network flow monitoring and analysis"
      />

      <DashboardBuilder
        availablePanes={availablePanes}
        selectedPanes={selectedPanes}
        onPanesChange={setSelectedPanes}
        paneOrder={paneOrder}
        onOrderChange={setPaneOrder}
        previewColumns={previewColumns}
        onColumnsChange={setPreviewColumns}
        storageKey="netflow-monitor-layout"
      />
    </div>
  );
};

export default NetFlowMonitorRefactored;