/**
 * NetFlow Monitor Pane Configurations Hook
 * Extracts the availablePanes configuration from NetFlowMonitor.tsx
 */

import React from 'react';
import { type PaneConfig } from '../../_common/components';
import {
  ProtocolDistributionPane,
  TopTalkersPane,
  TopConversationsPane,
  RecentFlowsPane
} from '../components/NetFlowMonitor';
import {
  NetFlowConfigurationPane,
  NetFlowStatisticsPane,
  TopBandwidthFlowsPane,
  FlowExportersPane
} from '../components/Builder';

export interface UseNetFlowMonitorPaneConfigsOptions {
  // Data
  netflowStats: any;
  protocolDistribution: any[];
  topTalkers: any[];
  topConversations: any[];
  flows: any[];

  // State
  isLoading: boolean;
  dataFreshness: string;

  // Callbacks (optional - for limit changes)
  onTalkersLimitChange?: (limit: number) => void;
  onConversationsLimitChange?: (limit: number) => void;
  onFlowsLimitChange?: (limit: number) => void;
}

export const useNetFlowMonitorPaneConfigs = (options: UseNetFlowMonitorPaneConfigsOptions): PaneConfig[] => {
  const {
    netflowStats,
    protocolDistribution,
    topTalkers,
    topConversations,
    flows,
    isLoading,
    dataFreshness,
    onTalkersLimitChange,
    onConversationsLimitChange,
    onFlowsLimitChange
  } = options;

  return [
    {
      id: 'netflow-config',
      title: 'NetFlow Configuration',
      category: 'NetFlow',
      component: <NetFlowConfigurationPane key="netflow-config" />
    },
    {
      id: 'netflow-statistics',
      title: 'NetFlow Statistics',
      category: 'NetFlow',
      component: (
        <NetFlowStatisticsPane
          key="netflow-statistics"
          netflowStats={netflowStats}
        />
      )
    },
    {
      id: 'protocol-distribution',
      title: 'Protocol Distribution',
      category: 'NetFlow',
      component: (
        <ProtocolDistributionPane
          key="protocol-distribution"
          distribution={protocolDistribution}
        />
      )
    },
    {
      id: 'flow-exporters',
      title: 'Flow Exporters',
      category: 'NetFlow',
      component: (
        <FlowExportersPane
          key="flow-exporters"
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
          records={flows}
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
          topTalkers={topTalkers}
          isLoading={isLoading}
          onLimitChange={onTalkersLimitChange || (() => {})}
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
          topConversations={topConversations}
          isLoading={isLoading}
          onLimitChange={onConversationsLimitChange || (() => {})}
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
          flows={flows}
          isLoading={isLoading}
          dataFreshness={dataFreshness}
          onLimitChange={onFlowsLimitChange || (() => {})}
        />
      )
    }
  ];
};
