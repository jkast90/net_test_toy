/**
 * Status Dot Component
 * Visual indicator for node status (saved/running/down) and BGP session status
 */

import React from 'react';

export type NodeStatus = 'saved' | 'running' | 'down' | 'established' | 'idle' | 'active' | 'connect';

interface StatusDotProps {
  status: NodeStatus;
  style?: React.CSSProperties;
}

export const StatusDot: React.FC<StatusDotProps> = ({ status, style }) => {
  const colors = {
    saved: '#2196F3',        // Blue - saved to topology
    running: '#4CAF50',      // Green - running/up
    down: '#f44336',         // Red - configured but down
    established: '#4CAF50',  // Green - BGP session established
    idle: '#FF9800',         // Orange - BGP idle
    active: '#FFC107',       // Amber - BGP active
    connect: '#2196F3'       // Blue - BGP connecting
  };

  const getTitleText = () => {
    switch (status) {
      case 'saved': return 'Saved to topology';
      case 'running': return 'Running';
      case 'down': return 'Not running';
      case 'established': return 'BGP Established';
      case 'idle': return 'BGP Idle';
      case 'active': return 'BGP Active';
      case 'connect': return 'BGP Connecting';
      default: return status;
    }
  };

  return (
    <div
      style={{
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        backgroundColor: colors[status],
        border: '1px solid #000',
        boxSizing: 'border-box',
        flexShrink: 0,
        ...style
      }}
      title={getTitleText()}
    />
  );
};

/**
 * Helper function to get status for a node
 */
export const getNodeStatus = (
  nodeName: string,
  nodeType: 'daemon' | 'host' | 'network',
  appConfig: any
): NodeStatus => {
  if (nodeType === 'daemon') {
    const daemon = appConfig?.daemons?.find((d: any) => d.name === nodeName);
    if (!daemon) return 'saved';
    return daemon.status === 'running' ? 'running' : 'down';
  } else if (nodeType === 'host') {
    const host = appConfig?.hosts?.find((h: any) => h.name === nodeName);
    if (!host) return 'saved';
    return host.status === 'running' ? 'running' : 'down';
  } else if (nodeType === 'network') {
    // For networks, check if at least one daemon or host is connected to it and running
    // This indicates the network has been deployed/created in Docker
    const daemonsOnNetwork = appConfig?.daemons?.filter((d: any) =>
      d.networks?.some((n: any) => n.name === nodeName) && d.status === 'running'
    ) || [];

    const hostsOnNetwork = appConfig?.hosts?.filter((h: any) =>
      h.networks?.some((n: any) => n.name === nodeName) && h.status === 'running'
    ) || [];

    // If any running containers are connected, network must be deployed
    return (daemonsOnNetwork.length > 0 || hostsOnNetwork.length > 0) ? 'running' : 'saved';
  }
  return 'saved';
};

/**
 * Helper function to get BGP session status
 * Checks actual BGP session state from neighbor data
 */
export const getBGPSessionStatus = (
  linkData: any,
  neighbors: any[]
): NodeStatus => {
  if (!linkData || !neighbors || neighbors.length === 0) {
    return 'saved';
  }

  // linkData contains: sourcePeer and targetPeer with local_daemon, peer_ip, local_ip
  const { sourcePeer, targetPeer } = linkData;

  if (!sourcePeer || !targetPeer) {
    return 'saved';
  }

  const sourceDaemon = sourcePeer.local_daemon;
  const targetDaemon = targetPeer.local_daemon;
  const sourcePeerIp = sourcePeer.peer_ip; // IP that source is peering with
  const targetPeerIp = targetPeer.peer_ip; // IP that target is peering with

  // Check if either daemon has the peer and what state it's in
  const sourceNeighbor = neighbors.find(
    (n: any) => n.clientName === sourceDaemon && n.neighbor_ip === sourcePeerIp
  );
  const targetNeighbor = neighbors.find(
    (n: any) => n.clientName === targetDaemon && n.neighbor_ip === targetPeerIp
  );

  // Use whichever neighbor we found
  const neighbor = sourceNeighbor || targetNeighbor;

  if (!neighbor) {
    return 'saved'; // Not deployed yet
  }

  // Map BGP state to status
  const state = neighbor.state?.toLowerCase();
  if (state === 'established') return 'established';
  if (state === 'idle') return 'idle';
  if (state === 'active') return 'active';
  if (state === 'connect' || state === 'opensent' || state === 'openconfirm') return 'connect';

  return 'saved';
};

/**
 * Helper function to get GRE tunnel status
 * Checks if both sides of the tunnel are deployed
 */
export const getGRETunnelStatus = (
  linkData: any,
  appConfig: any
): NodeStatus => {
  if (!linkData || !appConfig) {
    return 'saved';
  }

  // linkData contains tunnel information with container_name
  const containerName = linkData.container_name;
  const reciprocalContainerName = linkData.reciprocalContainerName;

  if (!containerName) {
    return 'saved';
  }

  // Check if the source container is running
  const sourceRunning = checkContainerRunning(containerName, appConfig);

  // If we have reciprocal info, check both sides
  if (reciprocalContainerName) {
    const targetRunning = checkContainerRunning(reciprocalContainerName, appConfig);

    // Both sides must be running for tunnel to be up
    if (sourceRunning && targetRunning) {
      return 'established';  // Use 'established' for up tunnels (green)
    } else if (!sourceRunning && !targetRunning) {
      return 'down';  // Both sides down
    } else {
      return 'idle';  // One side down (orange)
    }
  }

  // Only source info available
  return sourceRunning ? 'running' : 'down';
};

/**
 * Helper to check if a container is running
 */
const checkContainerRunning = (containerName: string, appConfig: any): boolean => {
  // Check in daemons
  const daemon = appConfig?.daemons?.find((d: any) => d.name === containerName);
  if (daemon) {
    return daemon.status === 'running';
  }

  // Check in hosts
  const host = appConfig?.hosts?.find((h: any) => h.name === containerName);
  if (host) {
    return host.status === 'running';
  }

  return false;
};
