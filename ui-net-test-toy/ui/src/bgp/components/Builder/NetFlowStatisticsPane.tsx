/**
 * NetFlow Statistics Pane
 * Displays aggregate NetFlow statistics including flows, packets, bytes, and exporters
 */

import React, { useMemo } from 'react';
import { StatsPane } from '../../../_common/components';
import type { NetFlowStats as ServiceNetFlowStats } from '../../../_common/services/netflow/types';

interface NetFlowStatisticsPaneProps {
  netflowStats: ServiceNetFlowStats | null;
}

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};

const NetFlowStatisticsPane: React.FC<NetFlowStatisticsPaneProps> = ({ netflowStats }) => {
  // Transform raw service stats to local format
  const transformedStats = useMemo(() => {
    if (!netflowStats) return null;

    return {
      total_flows: netflowStats.total_flows || 0,
      total_packets: netflowStats.total_packets || 0,
      total_bytes: netflowStats.total_bytes || 0,
      flows_in_memory: netflowStats.active_flows || 0,
      exporters: {} // Exporters mapping would go here if needed
    };
  }, [netflowStats]);

  if (!transformedStats) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
        No NetFlow data available
      </div>
    );
  }

  return (
    <StatsPane
      title="NetFlow Statistics"
      stats={[
        {
          label: "Total Flows",
          value: transformedStats.total_flows.toLocaleString()
        },
        {
          label: "Total Packets",
          value: transformedStats.total_packets.toLocaleString()
        },
        {
          label: "Total Traffic",
          value: formatBytes(transformedStats.total_bytes)
        },
        {
          label: "Active Flows",
          value: transformedStats.flows_in_memory.toLocaleString()
        }
      ]}
      columns={2}
    />
  );
};

export default NetFlowStatisticsPane;
