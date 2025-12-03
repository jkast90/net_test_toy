import React from 'react';
import { Button } from '../../../_common/components';
import { TriggeredEvent } from './builderTypes';
import { PROTOCOL_NAMES, formatDecimal } from '../../../_common/utils/networkUtils';
import buttonCss from '../../../_common/styles/Button.module.css';

interface ActiveFlowSpecMitigationsPaneProps {
  triggeredEvents: TriggeredEvent[];
  loading: boolean;
  cancelingMitigation: string | null;
  onCancelMitigation: (event: TriggeredEvent) => void;
}

const ActiveFlowSpecMitigationsPane: React.FC<ActiveFlowSpecMitigationsPaneProps> = ({
  triggeredEvents,
  loading,
  cancelingMitigation,
  onCancelMitigation
}) => {
  return (
    <div style={{ fontSize: '0.875rem' }}>
      {triggeredEvents.filter(e => e.action_type === 'flowspec').length === 0 ? (
        <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <p>No active FlowSpec mitigations</p>
          <p style={{ fontSize: '0.75rem', marginTop: '0.5rem' }}>
            Configure triggers with FlowSpec actions to automatically rate-limit high-bandwidth flows
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {triggeredEvents
            .filter(e => e.action_type === 'flowspec')
            .slice(0, 10)
            .map((event, idx) => {
              const mitigationKey = `${event.flow.src_addr}-${event.flow.dst_addr}-${event.flow.dst_port}-${event.flow.protocol}`;
              const isCanceling = cancelingMitigation === mitigationKey;
              const uniqueKey = `${event.timestamp}-${mitigationKey}`;

              return (
                <div
                  key={uniqueKey}
                  style={{
                    padding: '0.75rem',
                    backgroundColor: 'var(--bg)',
                    border: '1px solid var(--border)',
                    borderRadius: '4px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', alignItems: 'center' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text)' }}>
                      {event.trigger_name}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {new Date(event.timestamp).toLocaleTimeString()}
                      </div>
                      <Button
                        onClick={() => onCancelMitigation(event)}
                        disabled={isCanceling}
                        className={buttonCss.buttonDelete}
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                      >
                        {isCanceling ? 'Canceling...' : 'Cancel'}
                      </Button>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.25rem 0.75rem', fontSize: '0.8125rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Flow:</span>
                    <span style={{ fontFamily: 'monospace' }}>
                      {event.flow.src_addr}:{event.flow.src_port} → {event.flow.dst_addr}:{event.flow.dst_port}
                    </span>
                    <span style={{ color: 'var(--text-muted)' }}>Protocol:</span>
                    <span>{PROTOCOL_NAMES[event.flow.protocol] || event.flow.protocol}</span>
                    <span style={{ color: 'var(--text-muted)' }}>Bandwidth:</span>
                    <span style={{ color: 'var(--warning-color, #f39c12)', fontWeight: 600 }}>
                      {formatDecimal(event.flow.mbps, 2)} Mbps
                    </span>
                    <span style={{ color: 'var(--text-muted)' }}>Action:</span>
                    <span style={{ color: 'var(--success-color, #10b981)' }}>
                      {event.action_result.includes('flowspec_created')
                        ? event.action_result.replace('flowspec_created: ', '').split('rate-limited')[0]
                        : event.action_result}
                    </span>
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
};

export default ActiveFlowSpecMitigationsPane;
