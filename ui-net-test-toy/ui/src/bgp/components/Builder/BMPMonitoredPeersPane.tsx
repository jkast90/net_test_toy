import React from 'react';
import { DashboardPane } from '../../../_common/components';
import { BMPPeer } from './builderTypes';

interface BMPMonitoredPeersPaneProps {
  bmpPeers: BMPPeer[];
  loading: boolean;
}

const BMPMonitoredPeersPane: React.FC<BMPMonitoredPeersPaneProps> = ({
  bmpPeers,
  loading
}) => {
  return (
    <DashboardPane title={`BMP Monitored Peers (${bmpPeers.length})`}>
      {bmpPeers.length === 0 ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          No BMP-monitored peers
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {bmpPeers.slice(0, 3).map((peer, idx) => (
            <div key={`${peer.address}-${peer.as}-${peer.router_id}-${idx}`} style={{ border: '1px solid var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr 1fr',
                gap: '0.5rem',
                padding: '0.75rem',
                backgroundColor: 'var(--background-secondary)',
                borderBottom: '1px solid var(--border)',
                fontSize: '0.875rem'
              }}>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                    Peer Address
                  </div>
                  <div style={{ fontWeight: 500 }}>{peer.address}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                    AS Number
                  </div>
                  <div>{peer.as}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                    Router ID
                  </div>
                  <div>{peer.router_id}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                    State
                  </div>
                  <div style={{ color: peer.state === 'Established' ? 'var(--success)' : 'var(--error)' }}>
                    {peer.state}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardPane>
  );
};

export default BMPMonitoredPeersPane;
