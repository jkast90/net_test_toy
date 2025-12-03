/**
 * NetFlow Statistics Overview Pane
 */

import React from 'react';
import { StatsPane } from '../../../_common/components';
import { formatBytes } from '../../../_common/utils/networkUtils';

interface NetFlowStats {
  totalFlows: number;
  totalBytes: number;
  totalPackets: number;
  activeExporters: number;
}

interface NetFlowStatsPaneProps {
  stats: NetFlowStats;
}

export const NetFlowStatsPane: React.FC<NetFlowStatsPaneProps> = ({ stats }) => {
  return (
    <StatsPane
      title="NetFlow Statistics"
      stats={[
        {
          label: "Total Flows",
          value: stats.totalFlows.toLocaleString(),
          icon: "📊"
        },
        {
          label: "Total Traffic",
          value: formatBytes(stats.totalBytes),
          icon: "📡"
        },
        {
          label: "Total Packets",
          value: stats.totalPackets.toLocaleString(),
          icon: "📦"
        },
        {
          label: "Active Exporters",
          value: stats.activeExporters.toString(),
          icon: "🌐"
        }
      ]}
      columns={4}
    />
  );
};
