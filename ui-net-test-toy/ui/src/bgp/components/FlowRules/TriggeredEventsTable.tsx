import React from 'react';
import { formatTimestamp, formatDecimal } from '../../../_common/utils/networkUtils';

interface TriggeredEvent {
  timestamp: string;
  trigger_id: string;
  trigger_name: string;
  flow: {
    src_addr: string;
    dst_addr: string;
    src_port: number;
    dst_port: number;
    protocol: number;
    bytes: number;
    packets: number;
    kbps?: number;
    mbps?: number;
  };
  action_type: string;
  action_result: string;
}

interface TriggeredEventsTableProps {
  events: TriggeredEvent[];
  protocolNames: { [key: number]: string };
}

const TriggeredEventsTable: React.FC<TriggeredEventsTableProps> = ({
  events,
  protocolNames
}) => {
  if (events.length === 0) {
    return (
      <div style={{
        padding: '2rem',
        textAlign: 'center',
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: '4px',
        color: 'var(--color-text-secondary)'
      }}>
        No events triggered yet
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: '0.875rem',
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: '4px'
      }}>
        <thead>
          <tr style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
            <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}>
              Timestamp
            </th>
            <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}>
              Trigger
            </th>
            <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}>
              Flow
            </th>
            <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}>
              Rate
            </th>
            <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}>
              Action
            </th>
          </tr>
        </thead>
        <tbody>
          {events.slice(0, 50).map((event, idx) => (
            <tr key={idx} style={{ borderBottom: '1px solid var(--color-border)' }}>
              <td style={{ padding: '0.75rem', color: 'var(--color-text-secondary)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                {formatTimestamp(event.timestamp)}
              </td>
              <td style={{ padding: '0.75rem', color: 'var(--color-text-primary)', fontWeight: 600 }}>
                {event.trigger_name}
              </td>
              <td style={{ padding: '0.75rem', color: 'var(--color-text-primary)', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                {event.flow.src_addr}:{event.flow.src_port} → {event.flow.dst_addr}:{event.flow.dst_port}
                <div style={{ color: 'var(--color-text-secondary)', marginTop: '0.25rem' }}>
                  {protocolNames[event.flow.protocol] || `Proto-${event.flow.protocol}`}
                </div>
              </td>
              <td style={{ padding: '0.75rem', color: 'var(--color-text-primary)', fontSize: '0.75rem' }}>
                {event.flow.kbps !== undefined ? `${formatDecimal(event.flow.kbps, 2)} kbps` : 'N/A'}
                {event.flow.mbps !== undefined && event.flow.mbps >= 1 && (
                  <div style={{ color: 'var(--color-text-secondary)' }}>
                    ({formatDecimal(event.flow.mbps, 2)} Mbps)
                  </div>
                )}
              </td>
              <td style={{ padding: '0.75rem', color: 'var(--color-text-primary)', fontSize: '0.75rem' }}>
                <span style={{
                  padding: '0.125rem 0.5rem',
                  borderRadius: '3px',
                  backgroundColor: event.action_type === 'alert' ? 'var(--color-error)' : 'var(--color-info)',
                  color: '#fff'
                }}>
                  {event.action_type}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TriggeredEventsTable;
