/**
 * Builder Pane Configurations Hook
 * Extracts the availablePanes configuration from Builder.tsx
 */

import React from 'react';
import { type PaneConfig, Button } from '../../_common/components';
import { BMPPeersPane } from '../components/BMPMonitor';
import buttonCss from '../../_common/styles/Button.module.css';
import {
  SystemOverviewPane,
  BGPNeighborsSummaryPane,
  TopBandwidthFlowsPane,
  FlowExportersPane,
  TopTalkersPane,
  TopConversationsPane,
  RecentFlowsPane,
  BMPConfigurationPane,
  BGPNeighborManagementPane,
  GRETunnelManagementPane,
  FlowSpecRulesPane,
  ActiveFlowSpecMitigationsPane,
  ActiveRoutesPane,
  RouteAdvertisementPane,
  DockerNetworkManagementPane,
  NetFlowStatisticsPane,
  NetFlowConfigurationPane,
  type TriggeredEvent
} from '../components/Builder';

export interface UseBuilderPaneConfigsOptions {
  // Data
  allClients: any[];
  targets: any[];
  neighbors: any[];
  routes: any[];
  flowspecRules: any[];
  bmpPeers: any[];
  bmpLoading: { peers: boolean };
  netflowStats: any;
  netflowRecords: any[];
  triggeredEvents: TriggeredEvent[];
  cancelingMitigation: string | null;
  isLoadingRoutes: boolean;
  isLoadingNeighbors: boolean;
  previewColumns: number;
  routeViewMode: 'count' | 'list';

  // Callbacks
  onRouteViewModeChange: (mode: 'count' | 'list') => void;
  onLoadRoutes: () => void;
  onCancelFlowSpecMitigation: (event: TriggeredEvent) => void;
  onOpenCreateNetworkDialog: () => void;
}

export const useBuilderPaneConfigs = (options: UseBuilderPaneConfigsOptions): PaneConfig[] => {
  const {
    allClients,
    targets,
    neighbors,
    routes,
    flowspecRules,
    bmpPeers,
    bmpLoading,
    netflowStats,
    netflowRecords,
    triggeredEvents,
    cancelingMitigation,
    isLoadingRoutes,
    isLoadingNeighbors,
    previewColumns,
    routeViewMode,
    onRouteViewModeChange,
    onLoadRoutes,
    onCancelFlowSpecMitigation,
    onOpenCreateNetworkDialog
  } = options;

  return [
    // System Panes
    {
      id: 'system-overview',
      title: 'System Overview',
      category: 'System',
      component: (
        <SystemOverviewPane
          key="system-overview"
          allClients={allClients}
          bgpDaemons={targets.length}
          neighbors={neighbors}
          routes={routes.length}
          flowspecRules={flowspecRules.length}
          previewColumns={previewColumns}
        />
      )
    },

    // BGP Panes
    {
      id: 'bgp-neighbor-management',
      title: 'BGP Neighbor Management',
      category: 'BGP',
      component: (
        <BGPNeighborManagementPane
          key="bgp-neighbor-management"
          onAddSession={() => {/* TODO: Implement add session functionality */}}
          showEmptyAlert={targets.length === 0}
        />
      ),
      actions: (
        <Button
          className={buttonCss.buttonPrimary}
          style={{ padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}
          onClick={() => {/* TODO: Implement add session functionality */}}
        >
          Add BGP Session
        </Button>
      )
    },
    {
      id: 'bgp-neighbors-summary',
      title: 'BGP Neighbors Summary',
      category: 'BGP',
      component: (
        <BGPNeighborsSummaryPane
          key="bgp-neighbors-summary"
          neighbors={neighbors}
          loading={isLoadingNeighbors}
        />
      )
    },
    {
      id: 'route-advertisement',
      title: 'Route Advertisement',
      category: 'BGP',
      component: (
        <RouteAdvertisementPane
          key="route-advertisement"
          targetCount={targets.length}
          onAdvertiseRoute={() => {/* TODO: Open route advertisement dialog */}}
        />
      )
    },
    {
      id: 'active-routes',
      title: 'Active BGP Routes',
      category: 'BGP',
      component: (
        <ActiveRoutesPane
          key="active-routes"
          routes={routes}
          loading={isLoadingRoutes}
          viewMode={routeViewMode}
          targets={targets}
          onViewModeChange={onRouteViewModeChange}
          onRefresh={onLoadRoutes}
        />
      )
    },

    // NetFlow Panes
    {
      id: 'netflow-config',
      title: 'NetFlow Configuration',
      category: 'NetFlow',
      component: <NetFlowConfigurationPane key="netflow-config" />
    },
    {
      id: 'netflow-stats',
      title: 'NetFlow Statistics',
      category: 'NetFlow',
      component: (
        <NetFlowStatisticsPane
          key="netflow-stats"
          netflowStats={netflowStats}
        />
      )
    },
    {
      id: 'netflow-exporters',
      title: 'Flow Exporters',
      category: 'NetFlow',
      component: (
        <FlowExportersPane
          key="netflow-exporters"
          netflowStats={null}
        />
      )
    },
    {
      id: 'top-bandwidth-flows',
      title: 'Top Bandwidth Flows',
      category: 'NetFlow',
      component: (
        <TopBandwidthFlowsPane
          key="top-bandwidth-flows"
          records={netflowRecords}
        />
      )
    },
    {
      id: 'top-talkers',
      title: 'Top Talkers',
      category: 'NetFlow',
      component: (
        <TopTalkersPane
          key="top-talkers"
          topTalkers={[]}
        />
      )
    },
    {
      id: 'top-conversations',
      title: 'Top Conversations',
      category: 'NetFlow',
      component: (
        <TopConversationsPane
          key="top-conversations"
          conversations={[]}
        />
      )
    },
    {
      id: 'recent-flows',
      title: 'Recent Flows',
      category: 'NetFlow',
      component: (
        <RecentFlowsPane
          key="recent-flows"
          records={netflowRecords}
        />
      )
    },

    // BMP Panes
    {
      id: 'bmp-configuration',
      title: 'BMP Configuration',
      category: 'BMP',
      component: (
        <BMPConfigurationPane
          key="bmp-configuration"
          onEnableBMP={() => {/* TODO: Implement BMP enable functionality */}}
        />
      ),
      actions: (
        <Button
          className={buttonCss.buttonPrimary}
          style={{ padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}
          onClick={() => {/* TODO: Implement BMP enable functionality */}}
        >
          Enable BMP
        </Button>
      )
    },
    {
      id: 'bmp-peers',
      title: 'BMP Monitored Peers',
      category: 'BMP',
      component: (
        <BMPPeersPane
          key="bmp-peers"
          peers={bmpPeers}
          loading={bmpLoading.peers}
          limit={3}
        />
      )
    },
    {
      id: 'flowspec-rules',
      title: 'FlowSpec Rules',
      category: 'BMP',
      component: (
        <FlowSpecRulesPane
          key="flowspec-rules"
          flowspecRules={flowspecRules}
        />
      )
    },
    {
      id: 'flowspec-mitigations',
      title: 'Active FlowSpec Mitigations',
      category: 'BMP',
      component: (
        <ActiveFlowSpecMitigationsPane
          key="flowspec-mitigations"
          triggeredEvents={triggeredEvents}
          loading={false}
          cancelingMitigation={cancelingMitigation}
          onCancelMitigation={onCancelFlowSpecMitigation}
        />
      )
    },

    // Network Management Panes
    {
      id: 'gre-tunnel-management',
      title: 'GRE Tunnel Management',
      category: 'Network',
      component: (
        <GRETunnelManagementPane
          key="gre-tunnel-management"
          onAddTunnel={() => {/* TODO: Implement GRE tunnel functionality */}}
        />
      ),
      actions: (
        <Button
          className={buttonCss.buttonPrimary}
          style={{ padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}
          onClick={() => {/* TODO: Implement GRE tunnel functionality */}}
        >
          Add Tunnel
        </Button>
      )
    },
    {
      id: 'docker-network-management',
      title: 'Docker Network Management',
      category: 'Network',
      component: (
        <DockerNetworkManagementPane
          key="docker-network-management"
          onAddNetwork={onOpenCreateNetworkDialog}
        />
      ),
      actions: (
        <Button
          className={buttonCss.buttonPrimary}
          style={{ padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}
          onClick={onOpenCreateNetworkDialog}
        >
          Add Network
        </Button>
      )
    }
  ];
};
