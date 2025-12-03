import React from 'react';
import type { Trigger, TriggerConditions } from '../../../_common/types/netflow';

interface TriggerCardProps {
  trigger: Trigger;
  protocolNames: { [key: number]: string };
  onToggleEnabled: (trigger: Trigger) => void;
  onEdit: (trigger: Trigger) => void;
  onDelete: (trigger: Trigger) => void;
}

const formatConditions = (conditions: TriggerConditions, protocolNames: { [key: number]: string }): string => {
  const parts: string[] = [];
  if (conditions.min_kbps) parts.push(`≥${conditions.min_kbps} kbps`);
  if (conditions.min_mbps) parts.push(`≥${conditions.min_mbps} Mbps`);
  if (conditions.min_pps) parts.push(`≥${conditions.min_pps} pps`);
  if (conditions.min_bytes) parts.push(`≥${conditions.min_bytes} bytes`);
  if (conditions.src_addr) parts.push(`src=${conditions.src_addr}`);
  if (conditions.dst_addr) parts.push(`dst=${conditions.dst_addr}`);
  if (conditions.src_or_dst_addr) parts.push(`host=${conditions.src_or_dst_addr}`);
  if (conditions.protocol) parts.push(`proto=${protocolNames[conditions.protocol] || conditions.protocol}`);
  return parts.length > 0 ? parts.join(', ') : 'No conditions';
};

const TriggerCard: React.FC<TriggerCardProps> = ({
  trigger,
  protocolNames,
  onToggleEnabled,
  onEdit,
  onDelete
}) => {
  return (
    <div
      style={{
        padding: '1rem',
        backgroundColor: 'var(--color-surface)',
        border: `1px solid ${trigger.enabled ? 'var(--color-success)' : 'var(--color-border)'}`,
        borderRadius: '4px',
        opacity: trigger.enabled ? 1 : 0.6
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.75rem' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--color-text-primary)' }}>
            {trigger.name}
          </h3>
          <span style={{
            display: 'inline-block',
            marginTop: '0.25rem',
            padding: '0.125rem 0.5rem',
            fontSize: '0.75rem',
            borderRadius: '3px',
            backgroundColor: trigger.enabled ? 'var(--color-success)' : 'var(--color-text-secondary)',
            color: '#fff'
          }}>
            {trigger.enabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => onToggleEnabled(trigger)}
            style={{
              padding: '0.25rem 0.5rem',
              fontSize: '0.75rem',
              border: '1px solid var(--color-border)',
              borderRadius: '3px',
              backgroundColor: 'var(--color-bg-primary)',
              color: 'var(--color-text-primary)',
              cursor: 'pointer'
            }}
          >
            {trigger.enabled ? 'Disable' : 'Enable'}
          </button>
          <button
            onClick={() => onEdit(trigger)}
            style={{
              padding: '0.25rem 0.5rem',
              fontSize: '0.75rem',
              border: '1px solid var(--color-border)',
              borderRadius: '3px',
              backgroundColor: 'var(--color-bg-primary)',
              color: 'var(--color-text-primary)',
              cursor: 'pointer'
            }}
          >
            Edit
          </button>
          <button
            onClick={() => onDelete(trigger)}
            style={{
              padding: '0.25rem 0.5rem',
              fontSize: '0.75rem',
              border: '1px solid var(--color-error)',
              borderRadius: '3px',
              backgroundColor: 'var(--color-bg-primary)',
              color: 'var(--color-error)',
              cursor: 'pointer'
            }}
          >
            Delete
          </button>
        </div>
      </div>

      <div style={{ marginBottom: '0.5rem' }}>
        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: '0.25rem' }}>
          Conditions:
        </div>
        <div style={{ fontSize: '0.875rem', color: 'var(--color-text-primary)', fontFamily: 'monospace' }}>
          {formatConditions(trigger.conditions, protocolNames)}
        </div>
      </div>

      <div>
        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: '0.25rem' }}>
          Action:
        </div>
        <div style={{ fontSize: '0.875rem', color: 'var(--color-text-primary)' }}>
          {trigger.action.type.toUpperCase()}
          {trigger.action.message && ` - ${trigger.action.message}`}
          {trigger.action.rate_limit_kbps && ` (limit: ${trigger.action.rate_limit_kbps} kbps)`}
        </div>
      </div>
    </div>
  );
};

export default TriggerCard;
