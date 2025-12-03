/**
 * BMP Monitor Pane Configurations Hook
 * Extracts the availablePanes configuration from BMPMonitor.tsx
 */

import React from 'react';
import { type PaneConfig } from '../../_common/components';
import {
  BMPPeersPane,
  BMPFlowSpecRulesPane,
  BMPConfigurationPane,
  BMPStatisticsPane,
  BMPRoutesPane
} from '../components/BMPMonitor';
import { ActiveFlowSpecMitigationsPane } from '../components/Builder';
import type { TriggeredEvent } from '../components/Builder/builderTypes';

export interface UseBMPMonitorPaneConfigsOptions {
  // Data
  targets: any[];
  monitoringUrl: string | undefined;
  peers: any[];
  routes: any;
  flowSpecRules: any[] | undefined;
  statsSummary: any;
  triggeredEvents: TriggeredEvent[];
  loading: {
    peers: boolean;
    routes: boolean;
    stats: boolean;
  };

  // State
  isConfiguring: boolean;
  configMessage: string | null;
  isDeletingRule: string | null;
  cancelingMitigation: string | null;

  // Callbacks
  onConfigure: () => void;
  onDeleteFlowSpecRule: (rule: any) => void;
  onRuleAdded: () => void;
  onCancelMitigation: (event: TriggeredEvent) => void;
}

export const useBMPMonitorPaneConfigs = (options: UseBMPMonitorPaneConfigsOptions): PaneConfig[] => {
  const {
    targets,
    monitoringUrl,
    peers,
    routes,
    flowSpecRules,
    statsSummary,
    triggeredEvents,
    loading,
    isConfiguring,
    configMessage,
    isDeletingRule,
    cancelingMitigation,
    onConfigure,
    onDeleteFlowSpecRule,
    onRuleAdded,
    onCancelMitigation
  } = options;

  return [
    {
      id: 'bmp-config',
      title: 'BMP Configuration',
      category: 'Configuration',
      component: (
        <BMPConfigurationPane
          key="bmp-config"
          targetsCount={targets.length}
          monitoringConfigured={!!monitoringUrl}
          isConfiguring={isConfiguring}
          configMessage={configMessage}
          onConfigure={onConfigure}
        />
      )
    },
    {
      id: 'bmp-peers',
      title: 'BMP Monitored Peers',
      category: 'Monitoring',
      component: (
        <BMPPeersPane
          key="bmp-peers"
          peers={peers}
          loading={loading.peers}
        />
      )
    },
    {
      id: 'bmp-routes',
      title: 'BMP Routes',
      category: 'Monitoring',
      component: (
        <BMPRoutesPane
          key="bmp-routes"
          routes={routes}
          loading={loading.routes}
        />
      )
    },
    {
      id: 'flowspec-rules',
      title: 'FlowSpec Rules',
      category: 'FlowSpec',
      component: (
        <BMPFlowSpecRulesPane
          key="flowspec-rules"
          flowSpecRules={flowSpecRules}
          isDeletingRule={isDeletingRule}
          onDeleteRule={onDeleteFlowSpecRule}
          onRuleAdded={onRuleAdded}
        />
      )
    },
    {
      id: 'flowspec-mitigations',
      title: 'Active FlowSpec Mitigations',
      category: 'FlowSpec',
      component: (
        <ActiveFlowSpecMitigationsPane
          key="flowspec-mitigations"
          triggeredEvents={triggeredEvents}
          loading={false}
          cancelingMitigation={cancelingMitigation}
          onCancelMitigation={onCancelMitigation}
        />
      )
    },
    {
      id: 'bmp-stats',
      title: 'BMP Statistics',
      category: 'Monitoring',
      component: (
        <BMPStatisticsPane
          key="bmp-stats"
          stats={statsSummary}
          loading={loading.stats}
        />
      )
    }
  ];
};
