/**
 * Neighbor Service
 * Manages BGP neighbor data and operations
 */

import { fetchAggregatedNeighbors, deleteNeighborFromTargets, AggregatedNeighbor, ClientDaemonPair } from '../multiClientBgpApi';

/**
 * Check if an IP address is a zero address (IPv4 or IPv6)
 */
export function isZeroAddress(ip: string): boolean {
  // Check for IPv4 zero address
  if (ip === '0.0.0.0') {
    return true;
  }

  // Check for IPv6 zero addresses (various formats)
  const zeroIPv6Patterns = [
    '::',
    '0:0:0:0:0:0:0:0',
    '00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00'
  ];

  return zeroIPv6Patterns.includes(ip);
}

/**
 * Filter out neighbors with zero IP addresses
 */
export function filterValidNeighbors(neighbors: AggregatedNeighbor[]): AggregatedNeighbor[] {
  return neighbors.filter(neighbor => !isZeroAddress(neighbor.neighbor_ip));
}

/**
 * Sort neighbors by client name, backend, and IP address
 */
export function sortNeighbors(neighbors: AggregatedNeighbor[]): AggregatedNeighbor[] {
  return [...neighbors].sort((a, b) => {
    const clientCompare = a.clientName.localeCompare(b.clientName);
    if (clientCompare !== 0) return clientCompare;

    const backendCompare = a.backend.localeCompare(b.backend);
    if (backendCompare !== 0) return backendCompare;

    return a.neighbor_ip.localeCompare(b.neighbor_ip, undefined, { numeric: true });
  });
}

/**
 * Note: Neighbor data fetching and mutations are now handled by Redux (neighborSlice)
 * This file only contains utility functions for filtering and sorting neighbors.
 *
 * The filtering/sorting happens in the Redux thunk BEFORE data enters the store,
 * ensuring Redux only contains valid, clean neighbor data.
 */
