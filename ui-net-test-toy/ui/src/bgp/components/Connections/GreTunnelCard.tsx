import React from 'react';
import Card from '../../../_common/components/Card';

interface GreTunnel {
  id: number;
  container_name: string;
  tunnel_name: string;
  topology_name: string;
  local_ip: string;
  remote_ip: string;
  tunnel_ip: string;
  tunnel_network: string;
  gre_key: number | null;
  ttl: number;
  status: string;
  created_at: string;
}

interface GreTunnelCardProps {
  tunnel: GreTunnel;
}

const GreTunnelCard: React.FC<GreTunnelCardProps> = ({ tunnel }) => {
  return (
    <Card>
      <div style={{ marginBottom: '0.5rem' }}>
        <h3 style={{ margin: 0, fontSize: '0.875rem', marginBottom: '0.25rem' }}>
          {tunnel.container_name}
        </h3>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
          {tunnel.tunnel_name}
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr',
        gap: '0.35rem',
        fontSize: '0.75rem',
        marginBottom: '0.5rem'
      }}>
        <span style={{ color: 'var(--text-muted)' }}>Local:</span>
        <span style={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>{tunnel.local_ip}</span>

        <span style={{ color: 'var(--text-muted)' }}>Remote:</span>
        <span style={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>{tunnel.remote_ip}</span>

        <span style={{ color: 'var(--text-muted)' }}>Tunnel:</span>
        <span style={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>
          {tunnel.tunnel_ip}/{tunnel.tunnel_network}
        </span>

        {tunnel.gre_key && (
          <>
            <span style={{ color: 'var(--text-muted)' }}>Key:</span>
            <span>{tunnel.gre_key}</span>
          </>
        )}

        {tunnel.topology_name && (
          <>
            <span style={{ color: 'var(--text-muted)' }}>Topology:</span>
            <span style={{ fontSize: '0.7rem' }}>{tunnel.topology_name}</span>
          </>
        )}
      </div>
    </Card>
  );
};

export default GreTunnelCard;
