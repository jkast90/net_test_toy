import React, { useState, useCallback } from 'react';
import { DashboardBuilder } from '../../_common/components';
import { useAppSelector } from '../../_common/store/hooks';
import { selectAllEnabledDaemons, selectAllClients } from '../../_common/store/connectionSelectors';
import { useFlowSpec } from '../../_common/hooks/useFlowSpec';
import { useBMP } from '../../_common/hooks/useBMP';
import { useNetFlow } from '../../_common/hooks/useNetFlow';
import { useBGP } from '../../_common/hooks/useBGP';
import { useLabManager } from '../../_common/hooks/useLabManager';
import { useDockerNetworks } from '../../_common/hooks/useDockerNetworks';
import CreateNetworkDialog from '../components/CreateNetworkDialog';
import { useDialogManager, useDashboardLayout } from '../../_common/hooks';
import { useBuilderPaneConfigs } from '../hooks/useBuilderPaneConfigs';
import type { TriggeredEvent } from '../components/Builder';
import styles from './SharedBGPPages.module.css';
import { NavBarPageHeader } from '../../_common/components/layout';

const Builder: React.FC = () => {
  const targets = useAppSelector(selectAllEnabledDaemons);
  const {
    cancelMitigationForEvent,
    cancelingMitigation
  } = useFlowSpec();

  // Use hooks to access BMP data from Redux instead of local state
  const {
    peers: bmpPeers,
    flowSpecRules: flowspecRules,
    loading: bmpLoading
  } = useBMP();

  // Use hooks to access NetFlow data from Redux instead of local state
  const {
    stats: netflowStatsFromHook,
    records: netflowRecordsFromHook
  } = useNetFlow();

  // Use BGP hook for routes and neighbors
  const {
    neighbors,
    routes,
    loadRoutes,
    isLoadingRoutes,
    isLoadingNeighbors
  } = useBGP();

  // Use lab manager hook for managed hosts
  const {
    selectedHostId
  } = useLabManager();

  // Use Docker networks hook for network operations
  const {
    createNetworkForHost
  } = useDockerNetworks();

  // Dashboard layout state with localStorage persistence
  const {
    selectedPanes,
    paneOrder,
    previewColumns,
    setSelectedPanes,
    setPaneOrder,
    setPreviewColumns
  } = useDashboardLayout({
    storageKey: 'customDashboardPanes',
    defaultPanes: [],
    defaultColumns: 3
  });

  // Route view mode - UI state only
  const [routeViewMode, setRouteViewMode] = useState<'count' | 'list'>('count');

  // Network creation dialog state
  const { dialogs } = useDialogManager({
    createNetwork: {}
  });
  const [newNetwork, setNewNetwork] = useState({
    name: '',
    subnet: '',
    gateway: '',
    driver: 'bridge'
  });

  const allClients = useAppSelector(selectAllClients);

  const cancelFlowSpecMitigation = async (event: TriggeredEvent) => {
    const result = await cancelMitigationForEvent(event);
    if (!result.success) {
      alert(`Error canceling FlowSpec mitigation: ${result.error}`);
    }
  };

  const createNetwork = useCallback(async () => {
    const result = await createNetworkForHost(selectedHostId, newNetwork);

    if (result.success) {
      dialogs.createNetwork.close();
      setNewNetwork({
        name: '',
        subnet: '',
        gateway: '',
        driver: 'bridge'
      });
      alert('Network created successfully');
    } else {
      alert(`Failed to create network: ${result.error || 'Unknown error'}`);
    }
  }, [selectedHostId, newNetwork, dialogs.createNetwork, createNetworkForHost]);

  // Builder is VIEW ONLY - all data comes from hooks
  // Triggered events endpoint doesn't exist yet
  const triggeredEvents: TriggeredEvent[] = [];

  // Get pane configurations from hook
  const availablePanes = useBuilderPaneConfigs({
    allClients,
    targets,
    neighbors,
    routes,
    flowspecRules,
    bmpPeers,
    bmpLoading,
    netflowStats: netflowStatsFromHook,
    netflowRecords: netflowRecordsFromHook,
    triggeredEvents,
    cancelingMitigation,
    isLoadingRoutes,
    isLoadingNeighbors,
    previewColumns,
    routeViewMode,
    onRouteViewModeChange: setRouteViewMode,
    onLoadRoutes: loadRoutes,
    onCancelFlowSpecMitigation: cancelFlowSpecMitigation,
    onOpenCreateNetworkDialog: dialogs.createNetwork.open
  });


  return (
    <>
      {/* Network Testing Lab - Full Width */}
      {/* <div style={{ marginBottom: '2rem' }}>
        <NetworkTesting showAsPane={false} />
      </div> */}

      <div className={styles.container}>
        <NavBarPageHeader
          title="Dashboard Builder"
          subtitle="Select and arrange dashboard panes to create your custom view"
        />

        {/* Dashboard Builder */}
        <DashboardBuilder
          availablePanes={availablePanes}
          selectedPanes={selectedPanes}
          onPanesChange={setSelectedPanes}
          paneOrder={paneOrder}
          onOrderChange={setPaneOrder}
          previewColumns={previewColumns}
          onColumnsChange={setPreviewColumns}
          storageKey="customDashboardPanes"
        />
      </div>

      {/* Create Network Dialog */}
      <CreateNetworkDialog
        open={dialogs.createNetwork.isOpen}
        newNetwork={newNetwork}
        onClose={() => {
          dialogs.createNetwork.close();
          setNewNetwork({
            name: '',
            subnet: '',
            gateway: '',
            driver: 'bridge'
          });
        }}
        onChange={(field, value) => setNewNetwork({ ...newNetwork, [field]: value })}
        onCreate={createNetwork}
      />
    </>
  );
};

export default Builder;
