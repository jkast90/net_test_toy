/**
 * BMP Memoized Selectors
 * Efficient data access with caching for BMP state
 */

import { createSelector } from '@reduxjs/toolkit';
import { RootState } from './store';
import { BMPPeer, BMPRoute, BMPFlowSpecRule } from '../services/bmp/types';

// Base selectors
export const selectBMPState = (state: RootState) => state.bmp;
export const selectBMPPeers = (state: RootState) => state.bmp.peers;
export const selectBMPRoutes = (state: RootState) => state.bmp.routes;
export const selectBMPFlowSpecRules = (state: RootState) => state.bmp.flowSpecRules;
export const selectBMPMessages = (state: RootState) => state.bmp.messages;
export const selectBMPStats = (state: RootState) => state.bmp.stats;
export const selectBMPLoading = (state: RootState) => state.bmp.loading;
export const selectBMPErrors = (state: RootState) => state.bmp.errors;
export const selectBMPFilter = (state: RootState) => state.bmp.filter;
export const selectBMPSelectedPeer = (state: RootState) => state.bmp.selectedPeer;
export const selectBMPLastUpdate = (state: RootState) => state.bmp.lastUpdate;

// Memoized selector for filtered and deduplicated peers
export const selectFilteredBMPPeers = createSelector(
  [selectBMPPeers],
  (peers) => {
    // Filter out zero addresses
    const filtered = peers.filter((peer: BMPPeer) => {
      const isZeroIPv4 = peer.address === '0.0.0.0';
      const isZeroIPv6 = peer.address === '::' ||
                       peer.address === '0:0:0:0:0:0:0:0' ||
                       peer.address === '00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00';
      return !isZeroIPv4 && !isZeroIPv6;
    });

    // Deduplicate peers by address_as combination
    const uniquePeers = filtered.reduce((acc: BMPPeer[], peer: BMPPeer) => {
      const peerKey = `${peer.address}_${peer.as}`;
      if (!acc.find(p => `${p.address}_${p.as}` === peerKey)) {
        acc.push(peer);
      }
      return acc;
    }, []);

    // Sort by IP address
    return uniquePeers.sort((a, b) =>
      a.address.localeCompare(b.address, undefined, { numeric: true, sensitivity: 'base' })
    );
  }
);

// Memoized selector for routes by peer
export const selectRoutesForPeer = (peerAddress: string, as: number) =>
  createSelector(
    [selectBMPRoutes],
    (routes) => {
      // Routes are keyed by just the peer address, not address_as
      const peerRoutes = routes[peerAddress] || { advertised: [], received: [] };

      return {
        advertised: Array.isArray(peerRoutes.advertised)
          ? [...peerRoutes.advertised].sort((a, b) =>
              a.prefix.localeCompare(b.prefix, undefined, { numeric: true, sensitivity: 'base' })
            )
          : [],
        received: Array.isArray(peerRoutes.received)
          ? [...peerRoutes.received].sort((a, b) =>
              a.prefix.localeCompare(b.prefix, undefined, { numeric: true, sensitivity: 'base' })
            )
          : []
      };
    }
  );

// Memoized selector for sorted FlowSpec rules
export const selectSortedFlowSpecRules = createSelector(
  [selectBMPFlowSpecRules],
  (rules) => {
    return [...rules].sort((a: BMPFlowSpecRule, b: BMPFlowSpecRule) => {
      // First, compare by destination prefix (if present)
      const aDst = a.match.destination || '';
      const bDst = b.match.destination || '';
      if (aDst !== bDst) {
        // Put entries with destination first
        if (aDst && !bDst) return -1;
        if (!aDst && bDst) return 1;
        return aDst.localeCompare(bDst);
      }

      // Second, compare by source prefix (if destination is same or both empty)
      const aSrc = a.match.source || '';
      const bSrc = b.match.source || '';
      if (aSrc !== bSrc) {
        // Put entries with source first
        if (aSrc && !bSrc) return -1;
        if (!aSrc && bSrc) return 1;
        return aSrc.localeCompare(bSrc);
      }

      // Third, compare by protocol
      const aProto = a.match.protocol || 0;
      const bProto = b.match.protocol || 0;
      return aProto - bProto;
    });
  }
);

// Memoized selector for BMP statistics summary
export const selectBMPStatsSummary = createSelector(
  [selectBMPStats, selectBMPPeers, selectBMPFlowSpecRules],
  (stats, peers, flowSpecRules) => {
    const establishedPeers = peers.filter(p =>
      p.state === 'Established' || p.state === 'established' || p.state === 'up'
    ).length;

    return {
      totalPeers: peers.length,
      establishedPeers,
      totalRoutes: stats?.total_routes || 0,
      flowSpecRules: flowSpecRules.length,
      messagesReceived: stats?.messages_per_second || 0,
      lastMessageTime: stats?.last_update
    };
  }
);

// Memoized selector for loading state
export const selectIsLoadingBMP = createSelector(
  [selectBMPLoading],
  (loading) => {
    return Object.values(loading).some(isLoading => isLoading);
  }
);

// Memoized selector for error state
export const selectHasBMPErrors = createSelector(
  [selectBMPErrors],
  (errors) => {
    return Object.keys(errors).length > 0;
  }
);

// Memoized selector for data freshness
export const selectBMPDataFreshness = createSelector(
  [selectBMPLastUpdate],
  (lastUpdate) => {
    if (!lastUpdate) return 'stale';

    const now = new Date().getTime();
    const updateTime = new Date(lastUpdate).getTime();
    const ageInSeconds = (now - updateTime) / 1000;

    if (ageInSeconds < 10) return 'fresh';
    if (ageInSeconds < 60) return 'recent';
    return 'stale';
  }
);

// Combined selector for BMP Monitor component
export const selectBMPMonitorData = createSelector(
  [
    selectFilteredBMPPeers,
    selectBMPRoutes,
    selectSortedFlowSpecRules,
    selectBMPStatsSummary,
    selectIsLoadingBMP,
    selectHasBMPErrors,
    selectBMPDataFreshness
  ],
  (peers, routes, flowSpecRules, statsSummary, isLoading, hasErrors, dataFreshness) => ({
    peers,
    routes,
    flowSpecRules,
    statsSummary,
    isLoading,
    hasErrors,
    dataFreshness
  })
);