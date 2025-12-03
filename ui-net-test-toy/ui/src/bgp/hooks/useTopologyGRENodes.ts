/**
 * Topology GRE Nodes Hook
 * Computes available nodes for GRE tunnel creation
 */

import { useMemo } from 'react';

export interface GRENode {
  name: string;
  type: 'daemon' | 'host' | 'external_node';
  networks: Array<{ name: string; ips: string[] }>;
  router_id?: string;
}

export interface UseTopologyGRENodesOptions {
  daemonsWithInterfaces: any[] | undefined;
  topologyDetails: any;
}

export const useTopologyGRENodes = (options: UseTopologyGRENodesOptions): GRENode[] => {
  const { daemonsWithInterfaces, topologyDetails } = options;

  return useMemo(() => {
    const nodes: GRENode[] = [];

    // Add daemons
    daemonsWithInterfaces?.forEach(daemon => {
      const networkMap = new Map<string, string[]>();
      daemon.interfaces?.forEach((iface: any) => {
        if (iface.network && iface.ipv4) {
          if (!networkMap.has(iface.network)) {
            networkMap.set(iface.network, []);
          }
          networkMap.get(iface.network)!.push(iface.ipv4);
        }
      });

      nodes.push({
        name: daemon.name,
        type: 'daemon',
        networks: Array.from(networkMap.entries()).map(([name, ips]) => ({ name, ips })),
        router_id: daemon.router_id
      });
    });

    // Add hosts
    topologyDetails?.hosts?.forEach((host: any) => {
      const networkMap = new Map<string, string[]>();
      host.interfaces?.forEach((iface: any) => {
        if (iface.network && iface.ipv4) {
          if (!networkMap.has(iface.network)) {
            networkMap.set(iface.network, []);
          }
          networkMap.get(iface.network)!.push(iface.ipv4);
        }
      });

      nodes.push({
        name: host.name,
        type: 'host',
        networks: Array.from(networkMap.entries()).map(([name, ips]) => ({ name, ips }))
      });
    });

    // Add external nodes (they don't have networks in this context)
    (topologyDetails as any)?.external_nodes?.forEach((externalNode: any) => {
      nodes.push({
        name: externalNode.name,
        type: 'external_node',
        networks: []
      });
    });

    return nodes;
  }, [daemonsWithInterfaces, topologyDetails]);
};
