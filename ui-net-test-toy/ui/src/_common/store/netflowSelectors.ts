/**
 * NetFlow Memoized Selectors
 * Efficient data access with caching for NetFlow state
 */

import { createSelector } from '@reduxjs/toolkit';
import { RootState } from './store';

// Base selectors
export const selectNetFlowState = (state: RootState) => state.netflow;
export const selectNetFlowRecords = (state: RootState) => state.netflow.records;
export const selectNetFlowStats = (state: RootState) => state.netflow.stats;
export const selectNetFlowExporters = (state: RootState) => state.netflow.exporters;
export const selectNetFlowAlerts = (state: RootState) => state.netflow.alerts;
export const selectNetFlowAnalysis = (state: RootState) => state.netflow.analysis;
export const selectNetFlowTimeSeries = (state: RootState) => state.netflow.timeSeries;
export const selectNetFlowLoading = (state: RootState) => state.netflow.loading;
export const selectNetFlowErrors = (state: RootState) => state.netflow.errors;
export const selectNetFlowFilter = (state: RootState) => state.netflow.filter;
export const selectNetFlowLastUpdate = (state: RootState) => state.netflow.lastUpdate;

// Age threshold for top talkers (30 seconds)
const TOP_TALKERS_AGE_THRESHOLD_MS = 30 * 1000;

// Memoized selector for top talkers with configurable limit
// Only includes records from the last 30 seconds to age out stale talkers
// Accepts an optional currentTime parameter to force recalculation for aging
export const makeSelectTopTalkers = (limit: number = 10) => {
  return (state: RootState, currentTime?: number) => {
    const records = selectNetFlowRecords(state);
    const now = currentTime || Date.now();
    const talkerMap = new Map<string, { bytes: number; packets: number; flows: number; totalDurationMs: number; totalBps: number }>();

    records.forEach((record) => {
      // Filter out records older than 30 seconds
      // Note: timestamps from backend are UTC but may lack 'Z' suffix, so append it if needed
      let recordTime = now;
      if ((record as any).timestamp) {
        const ts = (record as any).timestamp;
        // Append 'Z' if timestamp doesn't have timezone info (assume UTC)
        const utcTimestamp = ts.endsWith('Z') ? ts : ts + 'Z';
        recordTime = new Date(utcTimestamp).getTime();
      }
      if (now - recordTime > TOP_TALKERS_AGE_THRESHOLD_MS) {
        return; // Skip stale records
      }

      // Handle both field name conventions (src_addr and source_ip)
      const srcAddr = (record as any).src_addr || (record as any).source_ip;
      const dstAddr = (record as any).dst_addr || (record as any).destination_ip;
      const durationMs = (record as any).duration_ms || 0;
      const bps = (record as any).bps || 0;

      if (srcAddr) {
        // Source address
        const srcData = talkerMap.get(srcAddr) || { bytes: 0, packets: 0, flows: 0, totalDurationMs: 0, totalBps: 0 };
        srcData.bytes += record.bytes || 0;
        srcData.packets += record.packets || 0;
        srcData.flows += 1;
        srcData.totalDurationMs += durationMs;
        srcData.totalBps += bps;
        talkerMap.set(srcAddr, srcData);
      }

      if (dstAddr) {
        // Destination address
        const dstData = talkerMap.get(dstAddr) || { bytes: 0, packets: 0, flows: 0, totalDurationMs: 0, totalBps: 0 };
        dstData.bytes += record.bytes || 0;
        dstData.packets += record.packets || 0;
        dstData.flows += 1;
        dstData.totalDurationMs += durationMs;
        dstData.totalBps += bps;
        talkerMap.set(dstAddr, dstData);
      }
    });

    return Array.from(talkerMap.entries())
      .map(([address, data]) => ({
        address,
        bytes: data.bytes,
        packets: data.packets,
        flows: data.flows,
        // Average rate across all flows for this address (in bits per second)
        avgBps: data.flows > 0 ? data.totalBps / data.flows : 0
      }))
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, limit);
  };
};

// Default selector with limit of 10
export const selectTopTalkers = makeSelectTopTalkers(10);

// Memoized selector for top conversations with configurable limit
export const makeSelectTopConversations = (limit: number = 10) => createSelector(
  [selectNetFlowRecords],
  (records) => {
    const convMap = new Map<string, { bytes: number; packets: number; flows: number }>();

    records.forEach((record) => {
      // Handle both field name conventions
      const srcAddr = (record as any).src_addr || (record as any).source_ip;
      const dstAddr = (record as any).dst_addr || (record as any).destination_ip;

      if (srcAddr && dstAddr) {
        const pair = `${srcAddr} <-> ${dstAddr}`;
        const data = convMap.get(pair) || { bytes: 0, packets: 0, flows: 0 };
        data.bytes += record.bytes || 0;
        data.packets += record.packets || 0;
        data.flows += 1;
        convMap.set(pair, data);
      }
    });

    return Array.from(convMap.entries())
      .map(([pair, data]) => ({ pair, ...data }))
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, limit);
  }
);

// Default selector with limit of 10
export const selectTopConversations = makeSelectTopConversations(10);

// Memoized selector for protocol distribution
export const selectProtocolDistribution = createSelector(
  [selectNetFlowStats],
  (stats) => {
    if (!stats) return [];

    // Handle multiple possible field names: protocols, protocol_distribution, or top_protocols
    const protocolData = (stats as any)?.protocols || (stats as any)?.protocol_distribution || (stats as any)?.top_protocols;

    if (!protocolData) return [];

    // If it's already an array (top_protocols), use it directly
    if (Array.isArray(protocolData)) {
      return protocolData.map((p: any) => ({
        protocol: p.protocol,
        count: p.flow_count || p.count || 0,
        percentage: p.percentage || 0
      })).sort((a, b) => b.count - a.count);
    }

    // If it's an object (protocols or protocol_distribution), convert it
    return Object.entries(protocolData)
      .map(([protocol, count]) => ({
        protocol: Number(protocol),
        count: Number(count),
        percentage: stats.total_flows > 0 ? (Number(count) / stats.total_flows) * 100 : 0
      }))
      .sort((a, b) => b.count - a.count);
  }
);

// Memoized selector for sorted flows with configurable limit
export const makeSelectSortedFlows = (limit: number = 100) => createSelector(
  [selectNetFlowRecords],
  (records) => {
    // Map records to ensure consistent field names
    const mappedRecords = records.map((record: any) => ({
      ...record,
      src_addr: record.src_addr || record.source_ip,
      dst_addr: record.dst_addr || record.destination_ip,
      src_port: record.src_port || record.source_port,
      dst_port: record.dst_port || record.destination_port
    }));

    return mappedRecords.sort((a, b) => {
      // Sort by timestamp descending (most recent first)
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      return timeB - timeA;
    }).slice(0, limit);
  }
);

// Default selector with limit of 100
export const selectSortedFlows = makeSelectSortedFlows(100);

// Memoized selector for stats summary
export const selectNetFlowStatsSummary = createSelector(
  [selectNetFlowStats, selectNetFlowExporters, selectNetFlowRecords],
  (stats, exporters, records) => {
    return {
      totalFlows: stats?.total_flows || 0,
      totalPackets: stats?.total_packets || 0,
      totalBytes: stats?.total_bytes || 0,
      flowsPerSecond: stats?.flows_per_second || 0,
      activeExporters: exporters.filter(e => e.status === 'active').length,
      totalExporters: exporters.length,
      recordsInMemory: records.length
    };
  }
);

// Memoized selector for loading state
export const selectIsLoadingNetFlow = createSelector(
  [selectNetFlowLoading],
  (loading) => {
    return Object.values(loading).some(isLoading => isLoading);
  }
);

// Memoized selector for error state
export const selectHasNetFlowErrors = createSelector(
  [selectNetFlowErrors],
  (errors) => {
    return Object.keys(errors).length > 0;
  }
);

// Memoized selector for data freshness
export const selectNetFlowDataFreshness = createSelector(
  [selectNetFlowLastUpdate],
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

// Combined selector for NetFlow Monitor component (without top talkers/conversations/flows - those use configurable limits)
export const selectNetFlowMonitorData = createSelector(
  [
    selectProtocolDistribution,
    selectNetFlowStatsSummary,
    selectIsLoadingNetFlow,
    selectHasNetFlowErrors,
    selectNetFlowDataFreshness
  ],
  (protocolDist, statsSummary, isLoading, hasErrors, dataFreshness) => ({
    protocolDist,
    statsSummary,
    isLoading,
    hasErrors,
    dataFreshness
  })
);