import React, { useState } from 'react';
import { DashboardPane, Button } from '../../../_common/components';
import DataTable from '../../../_common/components/DataTable';
import type { Column } from '../../../_common/components/DataTable';
import { FlowSpecRuleForm } from '../../components';
import buttonCss from '../../../_common/styles/Button.module.css';

interface FlowSpecRule {
  id?: string;
  match: {
    source?: string;
    destination?: string;
    protocol?: number;
    source_port?: number;
    destination_port?: number;
  };
  actions: {
    action: string;
    rate?: number;
  };
  timestamp: string;
}

interface BMPFlowSpecRulesPaneProps {
  flowSpecRules: FlowSpecRule[] | undefined;
  isDeletingRule: string | null;
  onDeleteRule: (rule: FlowSpecRule) => void;
  onRuleAdded: () => void;
}

const BMPFlowSpecRulesPane: React.FC<BMPFlowSpecRulesPaneProps> = ({
  flowSpecRules,
  isDeletingRule,
  onDeleteRule,
  onRuleAdded
}) => {
  const [showForm, setShowForm] = useState(false);

  // Ensure flowSpecRules is always an array
  const rules = Array.isArray(flowSpecRules) ? flowSpecRules : [];

  const flowspecColumns: Column<FlowSpecRule>[] = [
    {
      key: 'match',
      header: 'Match Criteria',
      render: (rule) => {
        const parts = [];
        if (rule.match.source) parts.push(`Src: ${rule.match.source}`);
        if (rule.match.destination) parts.push(`Dst: ${rule.match.destination}`);
        if (rule.match.protocol) parts.push(`Proto: ${rule.match.protocol}`);
        if (rule.match.source_port) parts.push(`SPort: ${rule.match.source_port}`);
        if (rule.match.destination_port) parts.push(`DPort: ${rule.match.destination_port}`);
        return parts.join(', ');
      }
    },
    {
      key: 'actions',
      header: 'Action',
      render: (rule) => {
        let action = rule.actions.action;
        if (rule.actions.rate) action += ` (${rule.actions.rate}Mbps)`;
        return action;
      }
    },
    {
      key: 'timestamp',
      header: 'First Seen',
      render: (rule) => new Date(rule.timestamp).toLocaleString()
    },
    {
      key: 'actions_btn',
      header: 'Actions',
      render: (rule) => {
        const isDeleting = rule.id ? isDeletingRule === rule.id : false;
        return (
          <Button
            onClick={() => onDeleteRule(rule)}
            disabled={isDeleting || !rule.id}
            className={buttonCss.buttonDelete}
          >
            {isDeleting ? 'Canceling...' : 'Cancel'}
          </Button>
        );
      }
    }
  ];

  return (
    <DashboardPane
      title={`FlowSpec Rules (${rules.length})`}
      actions={
        <Button
          onClick={() => setShowForm(!showForm)}
          className={buttonCss.buttonPrimary}
        >
          {showForm ? 'Hide Form' : 'Add Rule'}
        </Button>
      }
    >
      {showForm && (
        <div style={{ marginBottom: '1rem' }}>
          <FlowSpecRuleForm
            backend="gobgp"
            onSuccess={() => {
              setShowForm(false);
              onRuleAdded();
            }}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      <DataTable
        data={rules}
        columns={flowspecColumns}
        emptyMessage="No FlowSpec rules configured"
      />
    </DashboardPane>
  );
};

export default BMPFlowSpecRulesPane;
