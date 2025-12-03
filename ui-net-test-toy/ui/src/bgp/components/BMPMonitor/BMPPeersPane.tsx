/**
 * BMP Peers Pane Component
 * Displays BMP-monitored peers with their advertised and received routes
 * Can be used in both summary mode (limited peers) and full mode (all peers)
 */

import React from 'react';
import { DashboardPane, EmptyState } from '../../../_common/components';
import { BMPPeer } from '../../../_common/types/bmp';
import BMPPeerCard from './BMPPeerCard';

interface BMPPeersPaneProps {
  peers: BMPPeer[] | undefined;
  loading?: boolean;
  limit?: number; // Optional limit for showing only first N peers (for dashboard summary)
}

export const BMPPeersPane: React.FC<BMPPeersPaneProps> = ({
  peers,
  loading = false,
  limit
}) => {
  // Ensure peers is always an array
  const peersList = Array.isArray(peers) ? peers : [];
  const displayedPeers = limit ? peersList.slice(0, limit) : peersList;
  const title = limit
    ? `BMP Monitored Peers (${displayedPeers.length}${peersList.length > limit ? ` of ${peersList.length}` : ''})`
    : `BMP Peers (${peersList.length})`;

  return (
    <DashboardPane title={title} loading={loading}>
      {peersList.length === 0 ? (
        <EmptyState message="No BGP peers monitored" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {displayedPeers.map((peer) => (
            <BMPPeerCard key={`${peer.address}_${peer.as}`} peer={peer} />
          ))}
        </div>
      )}
    </DashboardPane>
  );
};

export default BMPPeersPane;
