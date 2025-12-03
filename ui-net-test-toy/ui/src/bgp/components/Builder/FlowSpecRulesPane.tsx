import React from 'react';
import DataTable from '../../../_common/components/DataTable';
import { FlowSpecRule } from './builderTypes';

interface FlowSpecRulesPaneProps {
  flowspecRules: FlowSpecRule[] | undefined;
}

const FlowSpecRulesPane: React.FC<FlowSpecRulesPaneProps> = ({ flowspecRules }) => {
  // Ensure flowspecRules is always an array
  const rules = Array.isArray(flowspecRules) ? flowspecRules : [];

  return (
    <DataTable
      data={rules.slice(0, 10)}
      columns={[
        {
          key: 'match',
          header: 'Match',
          render: (rule) => {
            const parts = [];
            if (rule.match.source) parts.push(`src:${rule.match.source}`);
            if (rule.match.destination) parts.push(`dst:${rule.match.destination}`);
            if (rule.match.protocol) parts.push(`proto:${rule.match.protocol}`);
            if (rule.match.source_port) parts.push(`sport:${rule.match.source_port}`);
            if (rule.match.destination_port) parts.push(`dport:${rule.match.destination_port}`);
            return parts.join(', ') || 'N/A';
          }
        },
        {
          key: 'actions',
          header: 'Action',
          render: (rule) => rule.actions.action + (rule.actions.rate ? ` (${rule.actions.rate})` : '')
        }
      ]}
      emptyMessage="No FlowSpec rules configured"
    />
  );
};

export default FlowSpecRulesPane;
