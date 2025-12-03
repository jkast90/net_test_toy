/**
 * Hook for fetching available BGP daemons
 * Handles both real daemon fetching and synthetic daemon creation for topology mode
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { UnifiedClient, DaemonConfig } from '../../_common/store/connectionSlice';
import { containerManagerService } from '../../_common/services/containerManager';

export interface NetworkInfo {
  name: string;
  ips: string[];
}

export interface DaemonInfo {
  client: UnifiedClient;
  daemon: DaemonConfig;
  routerId: string;
  asn: number;
  containerName: string;
  networks: NetworkInfo[];
}

interface InitialNodeData {
  router_id: string;
  daemon_type: string;
  type?: string;
  asn?: number;
  name?: string;
  interfaces?: Array<{ network: string; ipv4: string; gateway: string }>;
}

interface UseDaemonFetcherProps {
  clients: UnifiedClient[];
  currentHostUrl: string;
  saveToTopologyOnly: boolean;
  topologyHostUrl?: string;
  initialSource?: InitialNodeData;
  initialTarget?: InitialNodeData;
}

export const useDaemonFetcher = ({
  clients,
  currentHostUrl,
  saveToTopologyOnly,
  topologyHostUrl,
  initialSource,
  initialTarget
}: UseDaemonFetcherProps) => {
  const [availableDaemons, setAvailableDaemons] = useState<DaemonInfo[]>([]);
  const [fetchingDaemons, setFetchingDaemons] = useState(false);
  const syntheticDaemonsCreated = useRef(false);

  // Memoize client signature to prevent unnecessary re-fetches
  const clientsSignature = useMemo(() => {
    return clients
      .filter(c => c.status === 'connected' && c.enabled)
      .map(c => `${c.id}-${c.baseUrl}`)
      .sort()
      .join('|');
  }, [clients]);

  useEffect(() => {
    const fetchAllDaemonInfo = async () => {
      setFetchingDaemons(true);
      const daemonList: DaemonInfo[] = [];

      // In topology-only mode with pre-selected daemons, skip fetching
      if (saveToTopologyOnly && initialSource && initialTarget) {
        console.log('[useDaemonFetcher] Topology-only mode - skipping daemon fetch, will use initial data');
        setFetchingDaemons(false);
        return;
      }

      console.log('[useDaemonFetcher] Total clients:', clients.length);
      clients.forEach(c => {
        console.log(`[useDaemonFetcher] Client: ${c.name}, status: ${c.status}, enabled: ${c.enabled}, baseUrl: ${c.baseUrl}`);
      });

      // Fetch daemons from container manager
      let containerDaemons: any[] = [];
      if (!currentHostUrl) {
        console.warn('[useDaemonFetcher] No host URL available');
      } else {
        try {
          containerDaemons = await containerManagerService.getDaemons(currentHostUrl);
        } catch (err) {
          console.error('Failed to fetch daemons from container manager:', err);
        }
      }

      for (const client of clients) {
        if (client.status !== 'connected' || !client.enabled) {
          console.log(`[useDaemonFetcher] Skipping ${client.name}: status=${client.status}, enabled=${client.enabled}`);
          continue;
        }

        try {
          const data = await containerManagerService.getBackends(client.baseUrl);

          // Loop through each backend and get its router_id and ASN
          for (const [backendType, backendInfo] of Object.entries(data.backends)) {
            const info = backendInfo as any;

            // Only include available backends that are enabled in the client config
            const daemonConfig = client.daemons.find(d => d.type === backendType);
            if (!daemonConfig || !daemonConfig.enabled) continue;
            if (!info.available) continue;
            if (!info.router_id || !info.asn) continue;

            // Find matching container daemon to get network info
            const containerDaemon = containerDaemons.find(d => d.router_id === info.router_id);
            const networks: NetworkInfo[] = containerDaemon?.networks || [];

            daemonList.push({
              client,
              daemon: daemonConfig,
              routerId: info.router_id,
              asn: info.asn,
              containerName: containerDaemon?.name || '',
              networks
            });
          }
        } catch (err) {
          console.error(`Failed to fetch info for ${client.name}:`, err);
        }
      }

      console.log('[useDaemonFetcher] Available daemons found:', daemonList.length);
      daemonList.forEach(d => {
        console.log(`[useDaemonFetcher] - ${d.routerId} (AS${d.asn}) from ${d.client.name}/${d.daemon.type}, networks:`, d.networks.length);
      });

      setAvailableDaemons(daemonList);
      setFetchingDaemons(false);
    };

    fetchAllDaemonInfo();
  }, [clientsSignature, currentHostUrl, saveToTopologyOnly, initialSource, initialTarget, clients]);

  // Create synthetic daemons for topology-only mode
  useEffect(() => {
    if (!initialSource || !initialTarget || !saveToTopologyOnly || syntheticDaemonsCreated.current) {
      return;
    }

    console.log('[useDaemonFetcher] Topology-only mode - creating synthetic daemons from initial data');
    syntheticDaemonsCreated.current = true;

    const sourceType = initialSource.daemon_type || initialSource.type || 'unknown';
    const targetType = initialTarget.daemon_type || initialTarget.type || 'unknown';

    const syntheticDaemons: DaemonInfo[] = [
      {
        client: { id: 'topology', name: 'Topology', baseUrl: topologyHostUrl || '' } as any,
        daemon: { type: sourceType, enabled: true } as any,
        routerId: initialSource.router_id,
        asn: initialSource.asn || 65000,
        containerName: initialSource.name || '',
        networks: initialSource.interfaces?.map(iface => ({
          name: iface.network,
          ips: [iface.ipv4]
        })) || []
      },
      {
        client: { id: 'topology', name: 'Topology', baseUrl: topologyHostUrl || '' } as any,
        daemon: { type: targetType, enabled: true } as any,
        routerId: initialTarget.router_id,
        asn: initialTarget.asn || 65000,
        containerName: initialTarget.name || '',
        networks: initialTarget.interfaces?.map(iface => ({
          name: iface.network,
          ips: [iface.ipv4]
        })) || []
      }
    ];

    console.log('[useDaemonFetcher] Created synthetic daemon 0:',
      'routerId:', syntheticDaemons[0].routerId,
      'type:', syntheticDaemons[0].daemon.type,
      'asn:', syntheticDaemons[0].asn,
      'clientId:', syntheticDaemons[0].client.id);
    console.log('[useDaemonFetcher] Created synthetic daemon 1:',
      'routerId:', syntheticDaemons[1].routerId,
      'type:', syntheticDaemons[1].daemon.type,
      'asn:', syntheticDaemons[1].asn,
      'clientId:', syntheticDaemons[1].client.id);

    setAvailableDaemons(syntheticDaemons);
  }, [initialSource, initialTarget, saveToTopologyOnly, topologyHostUrl]);

  const getDaemonByUniqueKey = (uniqueKey: string): DaemonInfo | undefined => {
    // uniqueKey format: "clientId-daemonType-routerId"
    if (!uniqueKey) return undefined;

    const parts = uniqueKey.split('-');
    if (parts.length < 3) return undefined;

    // Last part is router ID, second-to-last is daemon type, rest is client ID
    const routerId = parts[parts.length - 1];
    const daemonType = parts[parts.length - 2];
    const clientId = parts.slice(0, parts.length - 2).join('-');

    return availableDaemons.find(d => {
      const clientMatch = String(d.client.id).trim() === String(clientId).trim();
      const typeMatch = String(d.daemon.type).trim() === String(daemonType).trim();
      const routerMatch = String(d.routerId).trim() === String(routerId).trim();
      return clientMatch && typeMatch && routerMatch;
    });
  };

  return {
    availableDaemons,
    fetchingDaemons,
    getDaemonByUniqueKey
  };
};
