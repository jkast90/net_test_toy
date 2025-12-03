/**
 * Topology Data Hook
 * Converts backend topology data to canvas nodes and links
 * Uses the unified nodes model (nodes, bgp_sessions, gre_links)
 */

import { useEffect } from 'react';
import { getDaemonColor } from '../utils/topologyUtils';
import type { TopologyNode, TopologyLink } from '../types/topology';
import type { TopologyDetails as TopologyDetailsType } from '../../_common/services/topology/types';

// Re-export the type from the service layer for consistency
export type TopologyDetails = TopologyDetailsType;

export const useTopologyData = (
  topologyDetails: TopologyDetails | null,
  daemonsWithInterfaces: any[], // Legacy - kept for interface enrichment compatibility
  onNodesChange: (nodes: TopologyNode[]) => void,
  onLinksChange: (links: TopologyLink[]) => void,
  currentNodes?: TopologyNode[], // Optional: current nodes to preserve local state (e.g., positions during drag)
  currentLinks?: TopologyLink[] // Optional: current links to preserve local state (e.g., arc values during drag)
) => {
  useEffect(() => {
    if (!topologyDetails) return;

    const newNodes: TopologyNode[] = [];
    const newLinks: TopologyLink[] = [];
    const nodeMap = new Map<string, string>();

    // Build a map of current node positions for preserving local state during updates
    const currentPositionMap = new Map<string, { x: number; y: number }>();
    currentNodes?.forEach(node => {
      currentPositionMap.set(node.id, node.position);
    });

    // Process unified nodes (daemons, hosts, external nodes are all in nodes array)
    topologyDetails.nodes?.forEach((node, index: number) => {
      let nodeId: string;
      let nodeType: 'daemon' | 'host' | 'external_node' | 'network';
      let defaultY: number;

      switch (node.node_type) {
        case 'daemon':
          nodeId = `daemon-${node.name}`;
          nodeType = 'daemon';
          defaultY = 250;
          break;
        case 'host':
          nodeId = `host-${node.name}`;
          nodeType = 'host';
          defaultY = 400;
          break;
        case 'external':
          nodeId = `external-${node.name}`;
          nodeType = 'external_node';
          defaultY = 150 + index * 120;
          break;
        default:
          return; // Skip unknown types
      }

      nodeMap.set(node.name, nodeId);

      // Determine color based on node type
      let color: string;
      if (node.node_type === 'daemon') {
        color = node.color || getDaemonColor(node.daemon_type || 'gobgp');
      } else if (node.node_type === 'host') {
        color = node.color || '#D7CCC8';
      } else {
        color = node.color || '#FF9800';
      }

      // Build label
      let label: string;
      if (node.node_type === 'daemon') {
        label = `${node.name} (${node.daemon_type || 'daemon'})`;
      } else {
        label = node.name;
      }

      // Prefer local position if it exists (user is actively dragging), otherwise use DB value
      const localPosition = currentPositionMap.get(nodeId);
      const position = localPosition || {
        x: node.map_x ?? (200 + index * 150),
        y: node.map_y ?? defaultY
      };

      newNodes.push({
        id: nodeId,
        type: nodeType,
        label,
        position,
        data: {
          ...node,
          // For daemons, include interfaces from the node's interfaces array
          interfaces: node.interfaces || []
        },
        asn: node.asn,
        color
      });
    });

    // Add network nodes
    topologyDetails.networks?.forEach((network: any, index: number) => {
      const nodeId = `network-${network.name}`;
      nodeMap.set(network.name, nodeId);

      // Prefer local position if it exists
      const localPosition = currentPositionMap.get(nodeId);
      const position = localPosition || {
        x: network.map_x ?? (200 + index * 150),
        y: network.map_y ?? 100
      };

      newNodes.push({
        id: nodeId,
        type: 'network',
        label: network.name,
        position,
        data: network,
        color: '#90CAF9'
      });
    });

    // Build a map of IP -> node name for quick lookup (for BGP sessions)
    const ipToNode = new Map<string, string>();
    topologyDetails.nodes?.forEach((node) => {
      if (node.interfaces) {
        node.interfaces.forEach((iface) => {
          if (iface.ipv4) {
            ipToNode.set(iface.ipv4, node.name);
          }
        });
      }
    });

    // Build a map of current link arcs for preserving local state during updates
    const currentArcMap = new Map<string, number>();
    currentLinks?.forEach(link => {
      if ((link.type === 'bgp' || link.type === 'gre') && link.arc !== undefined) {
        currentArcMap.set(link.id, link.arc);
      }
    });

    // Add BGP session links (new model - each session is a single record)
    topologyDetails.bgp_sessions?.forEach((session) => {
      const sourceId = nodeMap.get(session.daemon1);
      const targetId = nodeMap.get(session.daemon2);

      if (!sourceId || !targetId) {
        console.warn('[useTopologyData] BGP session - node not found:', {
          daemon1: session.daemon1,
          daemon2: session.daemon2,
          sourceId,
          targetId
        });
        return;
      }

      const linkId = `bgp-${session.daemon1}-${session.daemon2}`;

      // Prefer local arc value if it exists (user is actively dragging), otherwise use DB value
      const localArc = currentArcMap.get(linkId);
      const arcValue = localArc !== undefined ? localArc : (session.arc ?? 0);

      const link = {
        id: linkId,
        source: sourceId,
        target: targetId,
        type: 'bgp' as const,
        label: 'BGP',
        color: '#2196F3',
        width: 2,
        sourceLabel: `${session.daemon1}\nAS${session.daemon1_asn || 'N/A'}\n${session.daemon1_ip}`,
        targetLabel: `${session.daemon2}\nAS${session.daemon2_asn || 'N/A'}\n${session.daemon2_ip}`,
        arc: arcValue, // Custom arc value for line curvature (preserves local state)
        data: {
          session,
          sessionId: session.id
        }
      };
      newLinks.push(link);
    });

    // Add GRE link connections (new model - each link is a single record for both sides)
    topologyDetails.gre_links?.forEach((link) => {
      const sourceId = nodeMap.get(link.container1);
      const targetId = nodeMap.get(link.container2);

      if (!sourceId || !targetId) {
        console.warn('[useTopologyData] GRE link - container not found:', {
          container1: link.container1,
          container2: link.container2,
          sourceId,
          targetId
        });
        return;
      }

      // Build middle label with tunnel details
      const tunnelDetails = [];
      if (link.gre_key !== null && link.gre_key !== undefined) {
        tunnelDetails.push(`Key: ${link.gre_key}`);
      }
      tunnelDetails.push(`TTL: ${link.ttl || 64}`);
      tunnelDetails.push(`${link.tunnel_ip1}/${link.tunnel_network || '30'} ↔ ${link.tunnel_ip2}/${link.tunnel_network || '30'}`);

      const greLinkId = `gre-${link.container1}-${link.container2}`;

      // Prefer local arc value if it exists (user is actively dragging), otherwise use DB value
      const localArc = currentArcMap.get(greLinkId);
      const arcValue = localArc !== undefined ? localArc : (link.arc ?? 0);

      const greLink = {
        id: greLinkId,
        source: sourceId,
        target: targetId,
        type: 'gre' as const,
        label: `GRE\n${tunnelDetails.join('\n')}`,
        color: '#FF9800',
        width: 2,
        sourceLabel: link.tunnel_ip1,
        targetLabel: link.tunnel_ip2,
        arc: arcValue, // Custom arc value for line curvature (preserves local state)
        data: {
          link,
          linkId: link.id
        }
      };
      newLinks.push(greLink);
    });

    // Add node-network links (from unified nodes' interfaces)
    topologyDetails.nodes?.forEach((node) => {
      const nodeId = nodeMap.get(node.name);
      if (!nodeId) return;

      // Use interfaces for network connections
      node.interfaces?.forEach((iface) => {
        const networkNodeId = nodeMap.get(iface.network);
        if (!networkNodeId) return;

        // Find the network details to get gateway and subnet
        const networkDetails = topologyDetails.networks?.find((n: any) => n.name === iface.network);
        const gateway = iface.gateway || networkDetails?.gateway || '';
        const subnet = networkDetails?.subnet || '';
        const gatewayCidr = subnet ? `${gateway}/${subnet.split('/')[1] || subnet}` : gateway;
        const nodeIp = iface.ipv4 || '';

        newLinks.push({
          id: `${node.node_type}-net-${node.name}-${iface.network}`,
          source: nodeId,
          target: networkNodeId,
          type: 'network',
          label: nodeIp ? `${nodeIp}\n${gatewayCidr}` : gatewayCidr,
          color: '#4CAF50',
          width: 2
        });
      });
    });

    onNodesChange(newNodes);
    onLinksChange(newLinks);
    // Note: We intentionally exclude currentLinks from deps to avoid infinite loops
    // The currentLinks is only used to preserve arc values during topology refreshes
  }, [topologyDetails, daemonsWithInterfaces, onNodesChange, onLinksChange]);
};
