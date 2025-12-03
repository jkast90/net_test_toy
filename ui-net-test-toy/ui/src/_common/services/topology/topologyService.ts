/**
 * Topology Service Layer
 * Handles all API operations for network topology management
 */

import { fetchWrapper } from '../../utils/fetchWrapper';
import {
  Topology,
  TopologyDetails,
  Network,
  Daemon,
  Host,
  BGPPeer,
  BGPRoute,
  GRETunnel,
  ManagedHost,
  TopologyTemplate,
  TopologyLayout,
  CreateTopologyRequest,
  TopologyStats,
  TopologyMutationResult,
  UnifiedNode,
  BGPSession,
  GRELink
} from './types';

class TopologyService {
  private baseUrl: string;

  constructor(baseUrl: string = '') {
    // No default URL - must be provided via hostUrl parameter to methods
    this.baseUrl = baseUrl;
  }

  private getUrl(endpoint: string, hostUrl?: string): string {
    const base = hostUrl || this.baseUrl;
    return `${base}${endpoint}`;
  }

  // Topology management
  async getTopologies(hostUrl?: string): Promise<Topology[]> {
    const response = await fetchWrapper<{ topologies: Topology[] }>(this.getUrl('/topologies', hostUrl));
    return response.topologies || [];
  }

  async getTopology(name: string, hostUrl?: string): Promise<Topology> {
    return fetchWrapper<Topology>(this.getUrl(`/topologies/${name}`, hostUrl));
  }

  async getTopologyDetails(name: string, hostUrl?: string): Promise<TopologyDetails> {
    return fetchWrapper<TopologyDetails>(this.getUrl(`/topologies/${name}/details`, hostUrl));
  }

  async getActiveTopology(hostUrl?: string): Promise<Topology | null> {
    try {
      const response = await fetchWrapper<{ active: Topology | null }>(this.getUrl('/topologies/active', hostUrl));
      return response.active || null;
    } catch (error) {
      // No active topology
      return null;
    }
  }

  async createTopology(request: CreateTopologyRequest, hostUrl?: string): Promise<TopologyMutationResult<Topology>> {
    try {
      const result = await fetchWrapper<Topology>(
        this.getUrl('/topologies', hostUrl),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request)
        }
      );

      return {
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create topology',
        timestamp: new Date().toISOString()
      };
    }
  }

  async updateTopology(name: string, updates: Partial<CreateTopologyRequest>, hostUrl?: string): Promise<TopologyMutationResult<Topology>> {
    try {
      const result = await fetchWrapper<Topology>(
        this.getUrl(`/topologies/${name}`, hostUrl),
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates)
        }
      );

      return {
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update topology',
        timestamp: new Date().toISOString()
      };
    }
  }

  async deleteTopology(name: string, hostUrl?: string): Promise<TopologyMutationResult> {
    try {
      await fetchWrapper(
        this.getUrl(`/topologies/${name}`, hostUrl),
        { method: 'DELETE' }
      );

      return {
        success: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete topology',
        timestamp: new Date().toISOString()
      };
    }
  }

  async activateTopology(name: string, hostUrl?: string): Promise<TopologyMutationResult> {
    try {
      await fetchWrapper(
        this.getUrl(`/topologies/${name}/activate`, hostUrl),
        { method: 'POST' }
      );

      return {
        success: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to activate topology',
        timestamp: new Date().toISOString()
      };
    }
  }

  async deactivateTopology(name: string, hostUrl?: string): Promise<TopologyMutationResult> {
    try {
      await fetchWrapper(
        this.getUrl(`/topologies/${name}/deactivate`, hostUrl),
        { method: 'POST' }
      );

      return {
        success: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to deactivate topology',
        timestamp: new Date().toISOString()
      };
    }
  }

  async stopTopology(name: string, hostUrl?: string): Promise<TopologyMutationResult> {
    try {
      await fetchWrapper(
        this.getUrl(`/topologies/${name}/stop`, hostUrl),
        { method: 'POST' }
      );

      return {
        success: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to stop topology',
        timestamp: new Date().toISOString()
      };
    }
  }

  // Lab topology operations
  async getLabTopology(hostUrl?: string): Promise<TopologyLayout> {
    const response = await fetchWrapper<any>(this.getUrl('/lab/topology', hostUrl));

    // Convert to TopologyLayout format
    const nodes: any[] = [];
    const links: any[] = [];

    // Add network nodes
    if (response.networks) {
      response.networks.forEach((network: Network) => {
        nodes.push({
          id: `net-${network.name}`,
          name: network.name,
          type: 'network',
          data: network
        });
      });
    }

    // Add daemon nodes
    if (response.daemons) {
      response.daemons.forEach((daemon: Daemon) => {
        nodes.push({
          id: `daemon-${daemon.name}`,
          name: daemon.name,
          type: 'daemon',
          data: daemon
        });

        // Add network connections
        daemon.interfaces?.forEach(iface => {
          links.push({
            source: `daemon-${daemon.name}`,
            target: `net-${iface.network}`,
            type: 'network',
            label: iface.ipv4
          });
        });
      });
    }

    // Add host nodes
    if (response.hosts) {
      response.hosts.forEach((host: Host) => {
        nodes.push({
          id: `host-${host.name}`,
          name: host.name,
          type: 'host',
          data: host
        });

        // Add network connections
        host.interfaces?.forEach(iface => {
          links.push({
            source: `host-${host.name}`,
            target: `net-${iface.network}`,
            type: 'network',
            label: iface.ipv4
          });
        });
      });
    }

    // Add BGP peer links
    if (response.bgp_peers) {
      response.bgp_peers.forEach((peer: BGPPeer) => {
        links.push({
          source: `daemon-${peer.source}`,
          target: `daemon-${peer.target}`,
          type: 'bgp-peer',
          label: `AS${peer.source_asn} ↔ AS${peer.target_asn}`
        });
      });
    }

    return { nodes, links };
  }

  async standupTopology(name: string, hostUrl?: string): Promise<TopologyMutationResult> {
    try {
      await fetchWrapper(
        this.getUrl(`/topologies/${name}/standup`, hostUrl),
        { method: 'POST' }
      );

      return {
        success: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to standup topology',
        timestamp: new Date().toISOString()
      };
    }
  }

  async teardownTopology(name: string, hostUrl?: string): Promise<TopologyMutationResult> {
    try {
      await fetchWrapper(
        this.getUrl(`/topologies/${name}/teardown`, hostUrl),
        { method: 'POST' }
      );

      return {
        success: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to teardown topology',
        timestamp: new Date().toISOString()
      };
    }
  }

  // Network management
  async getNetworks(hostUrl?: string): Promise<Network[]> {
    return fetchWrapper<Network[]>(this.getUrl('/networks', hostUrl));
  }

  async createNetwork(network: Partial<Network>, hostUrl?: string): Promise<TopologyMutationResult<Network>> {
    try {
      const result = await fetchWrapper<Network>(
        this.getUrl('/networks', hostUrl),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(network)
        }
      );

      return {
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create network',
        timestamp: new Date().toISOString()
      };
    }
  }

  async deleteNetwork(topologyName: string, name: string, hostUrl?: string): Promise<TopologyMutationResult> {
    try {
      await fetchWrapper(
        this.getUrl(`/topologies/${topologyName}/networks/${name}`, hostUrl),
        { method: 'DELETE' }
      );

      return {
        success: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete network',
        timestamp: new Date().toISOString()
      };
    }
  }

  // Daemon management
  async getDaemons(hostUrl?: string): Promise<Daemon[]> {
    return fetchWrapper<Daemon[]>(this.getUrl('/daemons', hostUrl));
  }

  async createDaemon(daemon: Partial<Daemon>, hostUrl?: string): Promise<TopologyMutationResult<Daemon>> {
    try {
      const result = await fetchWrapper<Daemon>(
        this.getUrl('/daemons', hostUrl),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(daemon)
        }
      );

      return {
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create daemon',
        timestamp: new Date().toISOString()
      };
    }
  }

  async deleteDaemon(name: string, hostUrl?: string): Promise<TopologyMutationResult> {
    try {
      await fetchWrapper(
        this.getUrl(`/daemons/${name}`, hostUrl),
        { method: 'DELETE' }
      );

      return {
        success: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete daemon',
        timestamp: new Date().toISOString()
      };
    }
  }

  async restartDaemon(name: string, hostUrl?: string): Promise<TopologyMutationResult> {
    try {
      await fetchWrapper(
        this.getUrl(`/daemons/${name}/restart`, hostUrl),
        { method: 'POST' }
      );

      return {
        success: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to restart daemon',
        timestamp: new Date().toISOString()
      };
    }
  }

  // Host management
  async getHosts(hostUrl?: string): Promise<Host[]> {
    return fetchWrapper<Host[]>(this.getUrl('/hosts', hostUrl));
  }

  async createHost(host: Partial<Host>, hostUrl?: string): Promise<TopologyMutationResult<Host>> {
    try {
      const result = await fetchWrapper<Host>(
        this.getUrl('/hosts', hostUrl),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(host)
        }
      );

      return {
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create host',
        timestamp: new Date().toISOString()
      };
    }
  }

  async deleteHost(name: string, hostUrl?: string): Promise<TopologyMutationResult> {
    try {
      await fetchWrapper(
        this.getUrl(`/hosts/${name}`, hostUrl),
        { method: 'DELETE' }
      );

      return {
        success: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete host',
        timestamp: new Date().toISOString()
      };
    }
  }

  // GRE Tunnel management
  async getGreTunnels(hostUrl?: string): Promise<GRETunnel[]> {
    return fetchWrapper<GRETunnel[]>(this.getUrl('/gre-tunnels', hostUrl));
  }

  /**
   * Create a GRE tunnel (single side) - saves to DB only
   * This is for individual container operations, not topology-wide
   */
  async createGreTunnel(
    containerName: string,
    tunnelName: string,
    localIp: string,
    remoteIp: string,
    tunnelIp: string,
    tunnelNetwork: string,
    ttl: number,
    greKey?: number,
    hostUrl?: string
  ): Promise<TopologyMutationResult> {
    try {
      const params = new URLSearchParams({
        tunnel_name: tunnelName,
        local_ip: localIp,
        remote_ip: remoteIp,
        tunnel_ip: tunnelIp,
        tunnel_network: tunnelNetwork,
        ttl: ttl.toString()
      });

      if (greKey !== undefined) {
        params.append('gre_key', greKey.toString());
      }

      await fetchWrapper(
        this.getUrl(`/containers/${containerName}/tunnels?${params}`, hostUrl),
        { method: 'POST' }
      );

      return {
        success: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create GRE tunnel',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Create bidirectional GRE tunnels between two containers in a topology
   * This saves to database AND configures on both containers
   */
  async createTopologyGreTunnels(
    topologyName: string,
    containerA: string,
    containerB: string,
    tunnelNameA: string,
    tunnelNameB: string,
    localIpA: string,
    localIpB: string,
    tunnelIpA: string,
    tunnelIpB: string,
    tunnelNetwork: string,
    ttl: number,
    greKey?: number,
    hostUrl?: string
  ): Promise<TopologyMutationResult> {
    try {
      await fetchWrapper(
        this.getUrl(`/topologies/${topologyName}/gre-tunnels`, hostUrl),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            container_a: containerA,
            container_b: containerB,
            tunnel_name_a: tunnelNameA,
            tunnel_name_b: tunnelNameB,
            local_ip_a: localIpA,
            local_ip_b: localIpB,
            tunnel_ip_a: tunnelIpA,
            tunnel_ip_b: tunnelIpB,
            tunnel_network: tunnelNetwork,
            gre_key: greKey,
            ttl
          })
        }
      );

      return {
        success: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create GRE tunnels',
        timestamp: new Date().toISOString()
      };
    }
  }

  async deleteGreTunnel(id: number, hostUrl?: string): Promise<TopologyMutationResult> {
    try {
      await fetchWrapper(
        this.getUrl(`/gre-tunnels/${id}`, hostUrl),
        { method: 'DELETE' }
      );

      return {
        success: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete GRE tunnel',
        timestamp: new Date().toISOString()
      };
    }
  }

  async deleteGreTunnelByName(containerName: string, tunnelName: string, hostUrl?: string): Promise<TopologyMutationResult> {
    try {
      await fetchWrapper(
        this.getUrl(`/containers/${containerName}/tunnels/${tunnelName}`, hostUrl),
        { method: 'DELETE' }
      );

      return {
        success: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete GRE tunnel',
        timestamp: new Date().toISOString()
      };
    }
  }

  async testGreTunnel(id: number, hostUrl?: string): Promise<TopologyMutationResult<any>> {
    try {
      const result = await fetchWrapper<any>(
        this.getUrl(`/gre-tunnels/${id}/test`, hostUrl),
        { method: 'POST' }
      );

      return {
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to test GRE tunnel',
        timestamp: new Date().toISOString()
      };
    }
  }

  // External Node management
  async createExternalNode(topologyName: string, name: string, hostUrl?: string): Promise<TopologyMutationResult> {
    try {
      await fetchWrapper(
        this.getUrl(`/topologies/${topologyName}/external_nodes`, hostUrl),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name })
        }
      );

      return {
        success: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create external node',
        timestamp: new Date().toISOString()
      };
    }
  }

  async createExternalNetwork(
    topologyName: string,
    name: string,
    subnet: string,
    gateway: string,
    hostUrl?: string
  ): Promise<TopologyMutationResult> {
    try {
      await fetchWrapper(
        this.getUrl(`/topologies/${topologyName}/external_networks`, hostUrl),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, subnet, gateway })
        }
      );

      return {
        success: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create external network',
        timestamp: new Date().toISOString()
      };
    }
  }

  async deleteExternalNode(topologyName: string, nodeName: string, hostUrl?: string): Promise<TopologyMutationResult> {
    try {
      await fetchWrapper(
        this.getUrl(`/topologies/${topologyName}/external_nodes/${nodeName}`, hostUrl),
        { method: 'DELETE' }
      );

      return {
        success: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete external node',
        timestamp: new Date().toISOString()
      };
    }
  }

  // ==============================================================================
  // Unified Node Management (New Model)
  // ==============================================================================

  async getNodes(topologyName: string, nodeType?: string, hostUrl?: string): Promise<UnifiedNode[]> {
    let url = `/topologies/${topologyName}/nodes`;
    if (nodeType) {
      url += `?node_type=${nodeType}`;
    }
    const response = await fetchWrapper<{ nodes: UnifiedNode[] }>(this.getUrl(url, hostUrl));
    return response.nodes || [];
  }

  async getNode(topologyName: string, nodeName: string, hostUrl?: string): Promise<UnifiedNode> {
    return fetchWrapper<UnifiedNode>(this.getUrl(`/topologies/${topologyName}/nodes/${nodeName}`, hostUrl));
  }

  async createNode(topologyName: string, node: Partial<UnifiedNode>, hostUrl?: string): Promise<TopologyMutationResult<UnifiedNode>> {
    try {
      const result = await fetchWrapper<any>(
        this.getUrl(`/topologies/${topologyName}/nodes`, hostUrl),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(node)
        }
      );

      return {
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create node',
        timestamp: new Date().toISOString()
      };
    }
  }

  async updateNode(topologyName: string, nodeName: string, updates: Partial<UnifiedNode>, hostUrl?: string): Promise<TopologyMutationResult> {
    try {
      await fetchWrapper(
        this.getUrl(`/topologies/${topologyName}/nodes/${nodeName}`, hostUrl),
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates)
        }
      );

      return {
        success: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update node',
        timestamp: new Date().toISOString()
      };
    }
  }

  async deleteNode(topologyName: string, nodeName: string, hostUrl?: string): Promise<TopologyMutationResult> {
    try {
      await fetchWrapper(
        this.getUrl(`/topologies/${topologyName}/nodes/${nodeName}`, hostUrl),
        { method: 'DELETE' }
      );

      return {
        success: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete node',
        timestamp: new Date().toISOString()
      };
    }
  }

  async updateNodePosition(topologyName: string, nodeName: string, x: number, y: number, hostUrl?: string): Promise<TopologyMutationResult> {
    try {
      const params = new URLSearchParams({ x: x.toString(), y: y.toString() });
      await fetchWrapper(
        this.getUrl(`/topologies/${topologyName}/nodes/${nodeName}/position?${params}`, hostUrl),
        { method: 'PATCH' }
      );

      return {
        success: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update node position',
        timestamp: new Date().toISOString()
      };
    }
  }

  async addNodeNetwork(topologyName: string, nodeName: string, networkName: string, ipv4Address?: string, interfaceName?: string, hostUrl?: string): Promise<TopologyMutationResult> {
    try {
      await fetchWrapper(
        this.getUrl(`/topologies/${topologyName}/nodes/${nodeName}/networks`, hostUrl),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            network_name: networkName,
            ipv4_address: ipv4Address,
            interface_name: interfaceName
          })
        }
      );

      return {
        success: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add node to network',
        timestamp: new Date().toISOString()
      };
    }
  }

  async removeNodeNetwork(topologyName: string, nodeName: string, networkName: string, hostUrl?: string): Promise<TopologyMutationResult> {
    try {
      await fetchWrapper(
        this.getUrl(`/topologies/${topologyName}/nodes/${nodeName}/networks/${networkName}`, hostUrl),
        { method: 'DELETE' }
      );

      return {
        success: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to remove node from network',
        timestamp: new Date().toISOString()
      };
    }
  }

  // ==============================================================================
  // BGP Session Management (New Model)
  // ==============================================================================

  async getBGPSessions(topologyName: string, hostUrl?: string): Promise<BGPSession[]> {
    const response = await fetchWrapper<{ sessions: BGPSession[] }>(
      this.getUrl(`/topologies/${topologyName}/bgp/sessions`, hostUrl)
    );
    return response.sessions || [];
  }

  async createBGPSession(
    topologyName: string,
    session: {
      daemon1: string;
      daemon1_ip: string;
      daemon1_asn?: number;
      daemon2: string;
      daemon2_ip: string;
      daemon2_asn?: number;
      network?: string;
      address_families?: string;
      auth_key?: string;
      description?: string;
    },
    hostUrl?: string
  ): Promise<TopologyMutationResult<BGPSession>> {
    try {
      const result = await fetchWrapper<any>(
        this.getUrl(`/topologies/${topologyName}/bgp/sessions`, hostUrl),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(session)
        }
      );

      return {
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create BGP session',
        timestamp: new Date().toISOString()
      };
    }
  }

  async deleteBGPSession(topologyName: string, sessionId: number, hostUrl?: string): Promise<TopologyMutationResult> {
    try {
      await fetchWrapper(
        this.getUrl(`/topologies/${topologyName}/bgp/sessions/${sessionId}`, hostUrl),
        { method: 'DELETE' }
      );

      return {
        success: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete BGP session',
        timestamp: new Date().toISOString()
      };
    }
  }

  async deleteBGPSessionByIPs(topologyName: string, daemon1Ip: string, daemon2Ip: string, hostUrl?: string): Promise<TopologyMutationResult> {
    try {
      await fetchWrapper(
        this.getUrl(`/topologies/${topologyName}/bgp/sessions/by-ips`, hostUrl),
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            daemon1_ip: daemon1Ip,
            daemon2_ip: daemon2Ip
          })
        }
      );

      return {
        success: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete BGP session',
        timestamp: new Date().toISOString()
      };
    }
  }

  async updateBGPSessionArc(topologyName: string, sessionId: number, arc: number, hostUrl?: string): Promise<TopologyMutationResult> {
    try {
      await fetchWrapper(
        this.getUrl(`/topologies/${topologyName}/bgp/sessions/${sessionId}/arc`, hostUrl),
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ arc })
        }
      );

      return {
        success: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update BGP session arc',
        timestamp: new Date().toISOString()
      };
    }
  }

  // ==============================================================================
  // GRE Link Management (New Model)
  // ==============================================================================

  async updateGRELinkArc(topologyName: string, linkId: number, arc: number, hostUrl?: string): Promise<TopologyMutationResult> {
    try {
      await fetchWrapper(
        this.getUrl(`/topologies/${topologyName}/gre/links/${linkId}/arc`, hostUrl),
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ arc })
        }
      );

      return {
        success: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update GRE link arc',
        timestamp: new Date().toISOString()
      };
    }
  }

  async getGRELinks(topologyName: string, hostUrl?: string): Promise<GRELink[]> {
    const response = await fetchWrapper<{ links: GRELink[] }>(
      this.getUrl(`/topologies/${topologyName}/gre/links`, hostUrl)
    );
    return response.links || [];
  }

  async createGRELink(
    topologyName: string,
    link: {
      container1: string;
      container2: string;
      network: string;
      tunnel_ip1: string;
      tunnel_ip2: string;
      tunnel_network?: string;
      gre_key?: number;
      ttl?: number;
    },
    hostUrl?: string
  ): Promise<TopologyMutationResult<GRELink>> {
    try {
      const result = await fetchWrapper<any>(
        this.getUrl(`/topologies/${topologyName}/gre/links`, hostUrl),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(link)
        }
      );

      return {
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create GRE link',
        timestamp: new Date().toISOString()
      };
    }
  }

  async deleteGRELink(topologyName: string, linkId: number, hostUrl?: string): Promise<TopologyMutationResult> {
    try {
      await fetchWrapper(
        this.getUrl(`/topologies/${topologyName}/gre/links/${linkId}`, hostUrl),
        { method: 'DELETE' }
      );

      return {
        success: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete GRE link',
        timestamp: new Date().toISOString()
      };
    }
  }

  async deleteGRELinkByContainers(topologyName: string, container1: string, container2: string, hostUrl?: string): Promise<TopologyMutationResult> {
    try {
      await fetchWrapper(
        this.getUrl(`/topologies/${topologyName}/gre/links/by-containers`, hostUrl),
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            container1,
            container2
          })
        }
      );

      return {
        success: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete GRE link',
        timestamp: new Date().toISOString()
      };
    }
  }

  // ==============================================================================
  // Legacy BGP Peer management (kept for transition)
  // ==============================================================================

  async deleteBGPPeer(topologyName: string, localDaemon: string, peerDaemon: string, hostUrl?: string): Promise<TopologyMutationResult> {
    try {
      await fetchWrapper(
        this.getUrl(`/topologies/${topologyName}/bgp/peers`, hostUrl),
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            local_daemon: localDaemon,
            peer_daemon: peerDaemon
          })
        }
      );

      return {
        success: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete BGP peer',
        timestamp: new Date().toISOString()
      };
    }
  }

  // Node Position management
  async updateDaemonPosition(topologyName: string, daemonName: string, x: number, y: number, hostUrl?: string): Promise<TopologyMutationResult> {
    try {
      const params = new URLSearchParams({ x: x.toString(), y: y.toString() });
      await fetchWrapper(
        this.getUrl(`/topologies/${topologyName}/daemons/${daemonName}/position?${params}`, hostUrl),
        { method: 'PATCH' }
      );

      return {
        success: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update daemon position',
        timestamp: new Date().toISOString()
      };
    }
  }

  async updateHostPosition(topologyName: string, hostName: string, x: number, y: number, hostUrl?: string): Promise<TopologyMutationResult> {
    try {
      const params = new URLSearchParams({ x: x.toString(), y: y.toString() });
      await fetchWrapper(
        this.getUrl(`/topologies/${topologyName}/hosts/${hostName}/position?${params}`, hostUrl),
        { method: 'PATCH' }
      );

      return {
        success: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update host position',
        timestamp: new Date().toISOString()
      };
    }
  }

  async updateNetworkPosition(topologyName: string, networkName: string, x: number, y: number, hostUrl?: string): Promise<TopologyMutationResult> {
    try {
      const params = new URLSearchParams({ x: x.toString(), y: y.toString() });
      await fetchWrapper(
        this.getUrl(`/topologies/${topologyName}/networks/${networkName}/position?${params}`, hostUrl),
        { method: 'PATCH' }
      );

      return {
        success: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update network position',
        timestamp: new Date().toISOString()
      };
    }
  }

  async updateExternalNodePosition(topologyName: string, nodeName: string, x: number, y: number, hostUrl?: string): Promise<TopologyMutationResult> {
    try {
      const params = new URLSearchParams({ x: x.toString(), y: y.toString() });
      await fetchWrapper(
        this.getUrl(`/topologies/${topologyName}/external_nodes/${nodeName}/position?${params}`, hostUrl),
        { method: 'PATCH' }
      );

      return {
        success: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update external node position',
        timestamp: new Date().toISOString()
      };
    }
  }

  async createBGPPeer(
    localDaemon: string,
    localAsn: number,
    localIp: string,
    peerIp: string,
    peerAsn: number,
    peerRouterId: string,
    hostUrl?: string
  ): Promise<TopologyMutationResult> {
    try {
      await fetchWrapper(
        this.getUrl('/bgp/peers', hostUrl),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            local_daemon: localDaemon,
            local_asn: localAsn,
            local_ip: localIp,
            peer_ip: peerIp,
            peer_asn: peerAsn,
            peer_router_id: peerRouterId
          })
        }
      );

      return {
        success: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create BGP peer',
        timestamp: new Date().toISOString()
      };
    }
  }

  async deployBGPPeer(
    localDaemon: string,
    localAsn: number,
    localIp: string,
    peerIp: string,
    peerAsn: number,
    peerRouterId: string,
    hostUrl?: string
  ): Promise<TopologyMutationResult> {
    try {
      await fetchWrapper(
        this.getUrl('/bgp/peers/deploy', hostUrl),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            local_daemon: localDaemon,
            local_asn: localAsn,
            local_ip: localIp,
            peer_ip: peerIp,
            peer_asn: peerAsn,
            peer_router_id: peerRouterId
          })
        }
      );

      return {
        success: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to deploy BGP peer',
        timestamp: new Date().toISOString()
      };
    }
  }

  // Network connection management
  async connectDaemonToNetwork(
    topologyName: string,
    daemonName: string,
    networkName: string,
    ipv4: string,
    gateway: string,
    hostUrl?: string
  ): Promise<TopologyMutationResult> {
    try {
      const params = new URLSearchParams({
        network_name: networkName,
        ipv4,
        gateway
      });
      await fetchWrapper(
        this.getUrl(`/topologies/${topologyName}/daemons/${daemonName}/networks?${params}`, hostUrl),
        { method: 'POST' }
      );

      return {
        success: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to connect daemon to network',
        timestamp: new Date().toISOString()
      };
    }
  }

  async connectHostToNetwork(
    topologyName: string,
    hostName: string,
    networkName: string,
    ipv4: string,
    gateway: string,
    hostUrl?: string
  ): Promise<TopologyMutationResult> {
    try {
      const params = new URLSearchParams({
        network_name: networkName,
        ipv4,
        gateway
      });
      await fetchWrapper(
        this.getUrl(`/topologies/${topologyName}/hosts/${hostName}/networks?${params}`, hostUrl),
        { method: 'POST' }
      );

      return {
        success: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to connect host to network',
        timestamp: new Date().toISOString()
      };
    }
  }

  // Lab restore/deployment operations
  async deployDaemon(daemonName: string, hostUrl?: string): Promise<TopologyMutationResult> {
    try {
      await fetchWrapper(
        this.getUrl(`/lab/restore/daemon/${daemonName}`, hostUrl),
        { method: 'POST', timeout: 45000 }  // 45 seconds for daemon deployment
      );

      return {
        success: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to deploy daemon',
        timestamp: new Date().toISOString()
      };
    }
  }

  async deployNetwork(networkName: string, hostUrl?: string): Promise<TopologyMutationResult> {
    try {
      await fetchWrapper(
        this.getUrl(`/lab/restore/network/${networkName}`, hostUrl),
        { method: 'POST' }
      );

      return {
        success: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to deploy network',
        timestamp: new Date().toISOString()
      };
    }
  }

  async deployHost(hostName: string, hostUrl?: string): Promise<TopologyMutationResult> {
    try {
      await fetchWrapper(
        this.getUrl(`/lab/restore/host/${hostName}`, hostUrl),
        { method: 'POST', timeout: 45000 }  // 45 seconds for host deployment
      );

      return {
        success: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to deploy host',
        timestamp: new Date().toISOString()
      };
    }
  }

  // Template management
  async getTemplates(hostUrl?: string): Promise<TopologyTemplate[]> {
    return fetchWrapper<TopologyTemplate[]>(this.getUrl('/topology-templates', hostUrl));
  }

  async createTemplate(template: Omit<TopologyTemplate, 'id'>, hostUrl?: string): Promise<TopologyMutationResult<TopologyTemplate>> {
    try {
      const result = await fetchWrapper<TopologyTemplate>(
        this.getUrl('/topology-templates', hostUrl),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(template)
        }
      );

      return {
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create template',
        timestamp: new Date().toISOString()
      };
    }
  }

  async applyTemplate(templateId: string, topologyName: string, hostUrl?: string): Promise<TopologyMutationResult<Topology>> {
    try {
      const result = await fetchWrapper<Topology>(
        this.getUrl(`/topology-templates/${templateId}/apply`, hostUrl),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ topology_name: topologyName })
        }
      );

      return {
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to apply template',
        timestamp: new Date().toISOString()
      };
    }
  }

  // Statistics
  async getTopologyStats(name: string, hostUrl?: string): Promise<TopologyStats> {
    return fetchWrapper<TopologyStats>(this.getUrl(`/topologies/${name}/stats`, hostUrl));
  }

  // Route advertisements
  async saveRouteAdvertisement(
    topologyName: string,
    advertisement: {
      target_daemon: string;
      prefix: string;
      cidr: string;
      next_hop?: string;
      communities?: string;
      med?: number;
      as_path?: string;
    },
    hostUrl?: string
  ): Promise<TopologyMutationResult<any>> {
    try {
      const result = await fetchWrapper<any>(
        this.getUrl(`/topologies/${topologyName}/route-advertisements`, hostUrl),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(advertisement)
        }
      );

      return {
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save route advertisement',
        timestamp: new Date().toISOString()
      };
    }
  }

  async getRouteAdvertisements(topologyName: string, hostUrl?: string): Promise<any[]> {
    const result = await fetchWrapper<any>(
      this.getUrl(`/topologies/${topologyName}/route-advertisements`, hostUrl)
    );
    return result.route_advertisements || [];
  }

  async deleteRouteAdvertisement(topologyName: string, adId: number, hostUrl?: string): Promise<TopologyMutationResult> {
    try {
      await fetchWrapper(
        this.getUrl(`/topologies/${topologyName}/route-advertisements/${adId}`, hostUrl),
        { method: 'DELETE' }
      );

      return {
        success: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete route advertisement',
        timestamp: new Date().toISOString()
      };
    }
  }

  // Triggers
  async saveTrigger(
    topologyName: string,
    trigger: {
      name: string;
      enabled?: boolean;
      min_kbps?: string;
      min_mbps?: string;
      min_pps?: string;
      min_bytes?: string;
      src_addr?: string;
      dst_addr?: string;
      src_or_dst_addr?: string;
      protocol?: string;
      action_type: string;
      action_message?: string;
      rate_limit_kbps?: string;
    },
    hostUrl?: string
  ): Promise<TopologyMutationResult<any>> {
    try {
      const result = await fetchWrapper<any>(
        this.getUrl(`/topologies/${topologyName}/triggers`, hostUrl),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(trigger)
        }
      );

      return {
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save trigger',
        timestamp: new Date().toISOString()
      };
    }
  }

  async getTriggers(topologyName: string, hostUrl?: string): Promise<any[]> {
    const result = await fetchWrapper<any>(
      this.getUrl(`/topologies/${topologyName}/triggers`, hostUrl)
    );
    return result.triggers || [];
  }

  async deleteTrigger(topologyName: string, triggerId: number, hostUrl?: string): Promise<TopologyMutationResult> {
    try {
      await fetchWrapper(
        this.getUrl(`/topologies/${topologyName}/triggers/${triggerId}`, hostUrl),
        { method: 'DELETE' }
      );

      return {
        success: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete trigger',
        timestamp: new Date().toISOString()
      };
    }
  }

  // Lab manager hosts
  async getManagedHosts(): Promise<ManagedHost[]> {
    const saved = localStorage.getItem('managedHosts');
    if (saved) {
      return JSON.parse(saved);
    }
    // Return empty array - users must explicitly add their managed hosts
    return [];
  }

  async saveManagedHosts(hosts: ManagedHost[]): Promise<void> {
    localStorage.setItem('managedHosts', JSON.stringify(hosts));
  }

  // Multi-host operations
  async getTopologiesFromMultipleHosts(hostUrls: string[]): Promise<Record<string, Topology[]>> {
    const results: Record<string, Topology[]> = {};

    await Promise.all(
      hostUrls.map(async (url) => {
        try {
          results[url] = await this.getTopologies(url);
        } catch (error) {
          results[url] = [];
        }
      })
    );

    return results;
  }

  async getLabTopologyFromMultipleHosts(hostUrls: string[]): Promise<Record<string, TopologyLayout>> {
    const results: Record<string, TopologyLayout> = {};

    await Promise.all(
      hostUrls.map(async (url) => {
        try {
          results[url] = await this.getLabTopology(url);
        } catch (error) {
          results[url] = { nodes: [], links: [] };
        }
      })
    );

    return results;
  }
}

// Export singleton instance
export const topologyService = new TopologyService();

// Export class for testing
export default TopologyService;