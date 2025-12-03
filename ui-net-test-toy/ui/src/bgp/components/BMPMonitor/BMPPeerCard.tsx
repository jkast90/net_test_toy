import React from 'react';
import { useAppSelector } from '../../../_common/store/hooks';
import { selectRoutesForPeer } from '../../../_common/store/bmpSelectors';
import DataTable from '../../../_common/components/DataTable';
import type { Column } from '../../../_common/components/DataTable';

interface BMPRoute {
  prefix: string;
  next_hop: string;
  as_path: (number | string)[];
  local_pref?: number;
  med?: number;
  communities?: string[];
  timestamp: string;
}

interface BMPPeer {
  address: string;
  as: number;
  router_id: string;
  state: string;
}

interface BMPPeerCardProps {
  peer: BMPPeer;
}

const BMPPeerCard: React.FC<BMPPeerCardProps> = ({ peer }) => {
  const peerKey = `${peer.address}_${peer.as}`;
  const peerRoutes = useAppSelector(selectRoutesForPeer(peer.address, peer.as));

  const routeColumns: Column<BMPRoute>[] = [
    { key: 'prefix', header: 'Prefix' },
    { key: 'next_hop', header: 'Next Hop' },
    {
      key: 'as_path',
      header: 'AS Path',
      render: (route) => route.as_path.join(' ')
    },
    { key: 'local_pref', header: 'Local Pref' },
    { key: 'med', header: 'MED' }
  ];

  return (
    <div key={peerKey} style={{ border: '1px solid var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
      {/* Peer Header Row */}
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

      {/* Routes Section */}
      <div style={{ padding: '0.75rem' }}>
        <div style={{ marginBottom: '0.75rem' }}>
          <h4 style={{ marginBottom: '0.5rem', fontSize: '0.8rem', fontWeight: 600 }}>
            Advertised Routes ({peerRoutes.advertised.length})
          </h4>
          <DataTable
            data={peerRoutes.advertised}
            columns={routeColumns}
            emptyMessage="No advertised routes"
          />
        </div>

        <div>
          <h4 style={{ marginBottom: '0.5rem', fontSize: '0.8rem', fontWeight: 600 }}>
            Received Routes ({peerRoutes.received.length})
          </h4>
          <DataTable
            data={peerRoutes.received}
            columns={routeColumns}
            emptyMessage="No received routes"
          />
        </div>
      </div>
    </div>
  );
};

export default BMPPeerCard;
