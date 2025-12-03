import React, { useState, useEffect, useRef } from 'react';
import { useTopology, useTopologyVisualization } from '../../_common/hooks/useTopology';
import { EmptyState, Alert } from '../../_common/components/ui';

interface NetworkInterface {
  network: string;
  ipv4: string;
  gateway: string;
  mac: string;
}

interface Daemon {
  id: string;
  name: string;
  status: string;
  type: string;
  asn: number;
  router_id: string;
  api_port: number;
  interfaces: NetworkInterface[];
}

interface Host {
  id: string;
  name: string;
  status: string;
  gateway_daemon: string;
  gateway_ip: string;
  loopback_ip: string;
  loopback_network: string;
  interfaces: NetworkInterface[];
}

interface Network {
  id: string;
  name: string;
  subnet: string;
  gateway: string;
  driver: string;
  containers: Array<{
    id: string;
    name: string;
    ipv4: string;
  }>;
}

interface BGPPeer {
  source: string;
  target: string;
  source_asn: number;
  target_asn: number;
  peer_ip: string;
}

interface Topology {
  networks: Network[];
  daemons: Daemon[];
  hosts: Host[];
  connections: Array<{
    network: string;
    container: string;
    ip: string;
  }>;
  bgp_peers: BGPPeer[];
}

interface LabTopologyViewerProps {
  hostUrl: string;
}

interface Node {
  id: string;
  name: string;
  type: 'daemon' | 'host' | 'network';
  x: number;
  y: number;
  data: any;
}

interface Link {
  source: string;
  target: string;
  label?: string;
  type?: 'network' | 'bgp-peer';
}

const LabTopologyViewerImproved: React.FC<LabTopologyViewerProps> = ({ hostUrl }) => {
  // Use the topology hooks
  const {
    currentTopology,
    loading,
    errors,
    loadTopology,
    discover,
    visualize,
    mutations
  } = useTopology(hostUrl);

  const {
    visualization,
    layout,
    calculateNodePositions
  } = useTopologyVisualization();

  const [topology, setTopology] = useState<Topology | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Dragging state
  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  const [nodePositions, setNodePositions] = useState<Map<string, { x: number, y: number }>>(new Map());

  // Visibility filters
  const [showDaemons, setShowDaemons] = useState(true);
  const [showHosts, setShowHosts] = useState(true);
  const [showNetworks, setShowNetworks] = useState(true);
  const [showCommonNetworks, setShowCommonNetworks] = useState(false);
  const [hiddenNodes, setHiddenNodes] = useState<Set<string>>(new Set());

  // Load topology using the hook
  const handleLoadTopology = async () => {
    // First try to discover the topology from containers
    const discoveryResult = await discover('container');

    if (discoveryResult) {
      // Generate visualization if discovery succeeded
      await visualize(undefined, 'hierarchical');
    }
  };

  useEffect(() => {
    if (hostUrl) {
      handleLoadTopology();
    }
  }, [hostUrl]);

  // Convert currentTopology from the service to the local Topology format
  useEffect(() => {
    if (currentTopology) {
      // Map the new topology format to the component's expected format
      const mappedTopology: Topology = {
        networks: currentTopology.nodes
          .filter(n => n.type === 'network')
          .map(n => ({
            id: n.id,
            name: n.name,
            subnet: n.metadata?.subnet as string || '',
            gateway: n.metadata?.gateway as string || '',
            driver: n.metadata?.driver as string || 'bridge',
            containers: []
          })),
        daemons: currentTopology.nodes
          .filter(n => n.type === 'daemon')
          .map(n => ({
            id: n.id,
            name: n.name,
            status: n.status || 'unknown',
            type: n.metadata?.daemon_type as string || '',
            asn: n.metadata?.asn as number || 0,
            router_id: n.metadata?.router_id as string || '',
            api_port: n.metadata?.api_port as number || 0,
            interfaces: n.metadata?.interfaces as NetworkInterface[] || []
          })),
        hosts: currentTopology.nodes
          .filter(n => n.type === 'host')
          .map(n => ({
            id: n.id,
            name: n.name,
            status: n.status || 'unknown',
            gateway_daemon: n.metadata?.gateway_daemon as string || '',
            gateway_ip: n.metadata?.gateway_ip as string || '',
            loopback_ip: n.metadata?.loopback_ip as string || '',
            loopback_network: n.metadata?.loopback_network as string || '',
            interfaces: n.metadata?.interfaces as NetworkInterface[] || []
          })),
        connections: currentTopology.edges
          .filter(e => e.type === 'network_connection')
          .map(e => ({
            network: e.target,
            container: e.source,
            ip: e.metadata?.ip as string || ''
          })),
        bgp_peers: currentTopology.edges
          .filter(e => e.type === 'bgp_peer')
          .map(e => ({
            source: e.source,
            target: e.target,
            source_asn: e.metadata?.source_asn as number || 0,
            target_asn: e.metadata?.target_asn as number || 0,
            peer_ip: e.metadata?.peer_ip as string || ''
          }))
      };
      setTopology(mappedTopology);
    }
  }, [currentTopology]);

  const getDaemonColor = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'gobgp': return '#4CAF50';
      case 'frr': return '#2196F3';
      case 'exabgp': return '#FF9800';
      default: return '#9E9E9E';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'running': return '#4CAF50';
      case 'exited': return '#f44336';
      case 'paused': return '#FF9800';
      default: return '#9E9E9E';
    }
  };

  // Identify common networks (networks that ALL containers connect to)
  const identifyCommonNetworks = (): Set<string> => {
    if (!topology) return new Set();

    const allContainers = [
      ...topology.daemons.map(d => d.name),
      ...topology.hosts.map(h => h.name)
    ];

    if (allContainers.length === 0) return new Set();

    const commonNetworks = new Set<string>();

    // Check each network
    for (const network of topology.networks) {
      if (network.name === 'bridge') continue; // Skip bridge network

      // Count how many containers are connected to this network
      const connectedContainers = new Set<string>();

      // Check daemon interfaces
      for (const daemon of topology.daemons) {
        if (daemon.interfaces.some(iface => iface.network === network.name)) {
          connectedContainers.add(daemon.name);
        }
      }

      // Check host interfaces
      for (const host of topology.hosts) {
        if (host.interfaces.some(iface => iface.network === network.name)) {
          connectedContainers.add(host.name);
        }
      }

      // If all containers are connected to this network, it's common
      if (connectedContainers.size === allContainers.length) {
        commonNetworks.add(network.name);
      }
    }

    return commonNetworks;
  };

  // Calculate row-based layout with vertical stacking for diverging paths
  const calculateLayout = (): { nodes: Node[], links: Link[] } => {
    if (!topology) return { nodes: [], links: [] };

    const nodes: Node[] = [];
    const links: Link[] = [];
    const width = 1200;
    const height = 800;
    const commonNetworks = identifyCommonNetworks();

    // Layout parameters
    const containerRowY = height / 2; // Main row for containers
    const containerSpacing = 150; // Horizontal spacing between containers
    const networkYOffset = 150; // Vertical offset for networks above/below
    const startX = 100; // Starting X position

    // Separate networks into common and specific
    const specificNetworks = topology.networks.filter(n =>
      n.name !== 'bridge' && !commonNetworks.has(n.name)
    );
    const sharedNetworks = topology.networks.filter(n =>
      n.name !== 'bridge' && commonNetworks.has(n.name)
    );

    // Place containers (daemons and hosts) in a horizontal row
    let currentX = startX;
    const containerNodes: Node[] = [];

    // Place daemons first
    topology.daemons.forEach((daemon) => {
      const nodeId = `daemon-${daemon.name}`;
      const defaultPos = { x: currentX, y: containerRowY };
      const pos = nodePositions.get(nodeId) || defaultPos;

      const node = {
        id: nodeId,
        name: daemon.name,
        type: 'daemon' as const,
        x: pos.x,
        y: pos.y,
        data: daemon
      };

      nodes.push(node);
      containerNodes.push(node);
      currentX += containerSpacing;
    });

    // Add some extra spacing between daemons and hosts
    currentX += 50;

    // Place hosts
    topology.hosts.forEach((host) => {
      const nodeId = `host-${host.name}`;
      const defaultPos = { x: currentX, y: containerRowY };
      const pos = nodePositions.get(nodeId) || defaultPos;

      const node = {
        id: nodeId,
        name: host.name,
        type: 'host' as const,
        x: pos.x,
        y: pos.y,
        data: host
      };

      nodes.push(node);
      containerNodes.push(node);
      currentX += containerSpacing;
    });

    // Track network positions - group networks by which containers use them
    const networkContainerMap = new Map<string, Set<string>>();

    // Build map of which containers use each network
    specificNetworks.forEach(network => {
      const containers = new Set<string>();

      topology.daemons.forEach(daemon => {
        if (daemon.interfaces.some(iface => iface.network === network.name)) {
          containers.add(daemon.name);
        }
      });

      topology.hosts.forEach(host => {
        if (host.interfaces.some(iface => iface.network === network.name)) {
          containers.add(host.name);
        }
      });

      networkContainerMap.set(network.name, containers);
    });

    // Position specific networks above/below based on connectivity
    let networkYTop = containerRowY - networkYOffset;
    let networkYBottom = containerRowY + networkYOffset;
    let alternatePosition = true;

    specificNetworks.forEach((network) => {
      const connectedContainers = networkContainerMap.get(network.name) || new Set();

      // Calculate average X position of connected containers
      let avgX = 0;
      let count = 0;

      containerNodes.forEach(node => {
        const containerName = node.name;
        if (connectedContainers.has(containerName)) {
          avgX += node.x;
          count++;
        }
      });

      if (count > 0) {
        avgX /= count;
      } else {
        avgX = width / 2; // Default to center if no connections
      }

      // Alternate between top and bottom for better distribution
      const yPos = alternatePosition ? networkYTop : networkYBottom;
      alternatePosition = !alternatePosition;

      const nodeId = `net-${network.name}`;
      const defaultPos = { x: avgX, y: yPos };
      const pos = nodePositions.get(nodeId) || defaultPos;

      nodes.push({
        id: nodeId,
        name: network.name,
        type: 'network',
        x: pos.x,
        y: pos.y,
        data: network
      });
    });

    // Position common networks (if shown) at the far left/right
    if (showCommonNetworks) {
      let commonNetworkX = 50; // Far left
      sharedNetworks.forEach((network, idx) => {
        const nodeId = `net-${network.name}`;
        const defaultPos = {
          x: commonNetworkX,
          y: containerRowY + (idx - sharedNetworks.length/2) * 80
        };
        const pos = nodePositions.get(nodeId) || defaultPos;

        nodes.push({
          id: nodeId,
          name: network.name,
          type: 'network',
          x: pos.x,
          y: pos.y,
          data: network
        });
      });
    }

    // Create network connection links
    topology.daemons.forEach(daemon => {
      daemon.interfaces.forEach(iface => {
        if (iface.network === 'bridge') return;

        // Only show link if we're showing common networks or it's not a common network
        if (showCommonNetworks || !commonNetworks.has(iface.network)) {
          links.push({
            source: `daemon-${daemon.name}`,
            target: `net-${iface.network}`,
            label: iface.ipv4,
            type: 'network'
          });
        }
      });
    });

    topology.hosts.forEach(host => {
      host.interfaces.forEach(iface => {
        if (iface.network === 'bridge') return;

        // Only show link if we're showing common networks or it's not a common network
        if (showCommonNetworks || !commonNetworks.has(iface.network)) {
          links.push({
            source: `host-${host.name}`,
            target: `net-${iface.network}`,
            label: iface.ipv4,
            type: 'network'
          });
        }
      });
    });

    // Add BGP peer connections
    if (topology.bgp_peers) {
      topology.bgp_peers.forEach(peer => {
        links.push({
          source: `daemon-${peer.source}`,
          target: `daemon-${peer.target}`,
          label: `BGP: AS${peer.source_asn} ↔ AS${peer.target_asn}`,
          type: 'bgp-peer'
        });
      });
    }

    return { nodes, links };
  };

  // Mouse event handlers for dragging
  const handleMouseDown = (nodeId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setDraggedNode(nodeId);
  };

  const handleMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
    if (!draggedNode || !svgRef.current) return;

    const svg = svgRef.current;
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const svgPoint = point.matrixTransform(svg.getScreenCTM()?.inverse());

    setNodePositions(prev => {
      const newMap = new Map(prev);
      newMap.set(draggedNode, { x: svgPoint.x, y: svgPoint.y });
      return newMap;
    });
  };

  const handleMouseUp = () => {
    setDraggedNode(null);
  };

  const toggleNodeVisibility = (nodeId: string) => {
    setHiddenNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  };

  const showAllNodes = () => {
    setHiddenNodes(new Set());
  };

  const { nodes: allNodes, links: allLinks } = calculateLayout();

  // Filter nodes and links based on visibility settings
  const visibleNodes = allNodes.filter(node => {
    // Check if individually hidden
    if (hiddenNodes.has(node.id)) return false;

    // Check category visibility
    if (node.type === 'daemon') return showDaemons;
    if (node.type === 'host') return showHosts;
    if (node.type === 'network') return showNetworks;
    return true;
  });

  const visibleNodeIds = new Set(visibleNodes.map(n => n.id));
  const visibleLinks = allLinks.filter(link =>
    visibleNodeIds.has(link.source) && visibleNodeIds.has(link.target)
  );

  const nodes = visibleNodes;
  const links = visibleLinks;

  // Get common networks for display
  const commonNetworks = identifyCommonNetworks();

  if (loading.topology) {
    return <EmptyState message="Loading topology..." icon="⏳" />;
  }

  if (errors.topology) {
    return <Alert type="error" message={`Error loading topology: ${errors.topology}`} />;
  }

  if (!topology) {
    return <EmptyState message="No topology data available" icon="🗺️" />;
  }

  return (
    <div style={{ padding: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0 }}>Lab Topology Map (Improved Layout)</h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => setNodePositions(new Map())}
            style={{
              padding: '0.5rem 1rem',
              background: 'var(--card-bg)',
              color: 'var(--text)',
              border: '1px solid var(--accent-dark)',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.9rem'
            }}
          >
            Reset Layout
          </button>
          <button
            onClick={loadTopology}
            style={{
              padding: '0.5rem 1rem',
              background: 'var(--accent)',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.9rem'
            }}
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Common Networks Info */}
      {commonNetworks.size > 0 && (
        <div style={{
          marginBottom: '1rem',
          padding: '0.75rem',
          background: 'var(--card-bg)',
          borderRadius: '8px',
          border: '1px solid var(--accent-dark)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ color: 'var(--text)', fontSize: '0.9rem' }}>
              <strong>Common Networks (shared by all containers):</strong> {Array.from(commonNetworks).join(', ')}
            </span>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginLeft: 'auto' }}>
              <input
                type="checkbox"
                checked={showCommonNetworks}
                onChange={(e) => setShowCommonNetworks(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              <span style={{ fontSize: '0.85rem', color: 'var(--text)' }}>Show Common Networks</span>
            </label>
          </div>
        </div>
      )}

      <div style={{
        background: 'var(--card-bg)',
        borderRadius: '8px',
        padding: '1rem',
        border: '1px solid var(--accent-dark)'
      }}>
        <svg
          ref={svgRef}
          width="100%"
          height="700"
          viewBox="0 0 1200 800"
          style={{ background: '#1a1a1a', borderRadius: '4px', cursor: draggedNode ? 'grabbing' : 'default' }}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* Draw links first (so they appear behind nodes) */}
          {links.map((link, idx) => {
            const sourceNode = nodes.find(n => n.id === link.source);
            const targetNode = nodes.find(n => n.id === link.target);
            if (!sourceNode || !targetNode) return null;

            const midX = (sourceNode.x + targetNode.x) / 2;
            const midY = (sourceNode.y + targetNode.y) / 2;

            // Style BGP peer links differently
            const isBGPPeer = link.type === 'bgp-peer';
            const isSelected = selectedNode === link.source || selectedNode === link.target;

            const linkColor = isSelected ? '#FFD700' : (isBGPPeer ? '#FF6B6B' : '#666');
            const linkWidth = isSelected ? 2 : (isBGPPeer ? 2 : 1);
            const linkOpacity = isBGPPeer ? 0.8 : 0.6;

            // Use curved paths for better visualization
            const dx = targetNode.x - sourceNode.x;
            const dy = targetNode.y - sourceNode.y;
            const dr = Math.sqrt(dx * dx + dy * dy) * 0.5;

            return (
              <g key={`link-${idx}`}>
                {isBGPPeer ? (
                  // Curved path for BGP peers
                  <path
                    d={`M ${sourceNode.x},${sourceNode.y} Q ${midX},${midY - dr * 0.5} ${targetNode.x},${targetNode.y}`}
                    fill="none"
                    stroke={linkColor}
                    strokeWidth={linkWidth}
                    strokeOpacity={linkOpacity}
                    strokeDasharray="5,5"
                  />
                ) : (
                  // Straight line for network connections
                  <line
                    x1={sourceNode.x}
                    y1={sourceNode.y}
                    x2={targetNode.x}
                    y2={targetNode.y}
                    stroke={linkColor}
                    strokeWidth={linkWidth}
                    strokeOpacity={linkOpacity}
                  />
                )}
                {link.label && (
                  <text
                    x={midX}
                    y={midY + (isBGPPeer ? -dr * 0.25 : 0)}
                    fill={isBGPPeer ? '#FF6B6B' : '#999'}
                    fontSize={isBGPPeer ? '11' : '10'}
                    fontWeight={isBGPPeer ? 'bold' : 'normal'}
                    textAnchor="middle"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {link.label}
                  </text>
                )}
              </g>
            );
          })}

          {/* Draw nodes */}
          {nodes.map(node => {
            const isSelected = selectedNode === node.id;
            const isHovered = hoveredNode === node.id;

            if (node.type === 'network') {
              const network = node.data as Network;
              const isCommon = commonNetworks.has(network.name);
              return (
                <g
                  key={node.id}
                  onMouseEnter={() => setHoveredNode(node.id)}
                  onMouseLeave={() => setHoveredNode(null)}
                  onClick={() => setSelectedNode(isSelected ? null : node.id)}
                  onMouseDown={(e) => handleMouseDown(node.id, e)}
                  style={{ cursor: draggedNode === node.id ? 'grabbing' : 'grab' }}
                >
                  {/* Network node - diamond shape, different color for common networks */}
                  <polygon
                    points={`${node.x},${node.y - 40} ${node.x + 40},${node.y} ${node.x},${node.y + 40} ${node.x - 40},${node.y}`}
                    fill={isCommon ? '#FF5722' : (isSelected || isHovered ? '#00BCD4' : '#00ACC1')}
                    stroke={isSelected ? '#FFD700' : (isCommon ? '#FFB74D' : '#00E5FF')}
                    strokeWidth={isSelected ? 3 : 2}
                  />
                  <text
                    x={node.x}
                    y={node.y - 5}
                    fill="white"
                    fontSize="12"
                    fontWeight="bold"
                    textAnchor="middle"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {node.name.length > 15 ? node.name.substring(0, 13) + '...' : node.name}
                  </text>
                  <text
                    x={node.x}
                    y={node.y + 8}
                    fill="white"
                    fontSize="9"
                    textAnchor="middle"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {network.subnet}
                  </text>
                  {isCommon && (
                    <text
                      x={node.x}
                      y={node.y + 20}
                      fill="#FFE0B2"
                      fontSize="8"
                      fontWeight="bold"
                      textAnchor="middle"
                      style={{ pointerEvents: 'none', userSelect: 'none' }}
                    >
                      COMMON
                    </text>
                  )}
                </g>
              );
            } else if (node.type === 'daemon') {
              const daemon = node.data as Daemon;
              const color = getDaemonColor(daemon.type);
              return (
                <g
                  key={node.id}
                  onMouseEnter={() => setHoveredNode(node.id)}
                  onMouseLeave={() => setHoveredNode(null)}
                  onClick={() => setSelectedNode(isSelected ? null : node.id)}
                  onMouseDown={(e) => handleMouseDown(node.id, e)}
                  style={{ cursor: draggedNode === node.id ? 'grabbing' : 'grab' }}
                >
                  {/* Daemon node - rectangle */}
                  <rect
                    x={node.x - 50}
                    y={node.y - 30}
                    width={100}
                    height={60}
                    fill={isSelected || isHovered ? color : color + 'dd'}
                    stroke={isSelected ? '#FFD700' : getStatusColor(daemon.status)}
                    strokeWidth={isSelected ? 3 : 2}
                    rx={5}
                  />
                  <text
                    x={node.x}
                    y={node.y - 8}
                    fill="white"
                    fontSize="12"
                    fontWeight="bold"
                    textAnchor="middle"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {node.name}
                  </text>
                  <text
                    x={node.x}
                    y={node.y + 6}
                    fill="white"
                    fontSize="9"
                    textAnchor="middle"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {daemon.type.toUpperCase()}
                  </text>
                  <text
                    x={node.x}
                    y={node.y + 18}
                    fill="white"
                    fontSize="9"
                    textAnchor="middle"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    AS{daemon.asn}
                  </text>
                </g>
              );
            } else {
              // Host node
              const host = node.data as Host;
              return (
                <g
                  key={node.id}
                  onMouseEnter={() => setHoveredNode(node.id)}
                  onMouseLeave={() => setHoveredNode(null)}
                  onClick={() => setSelectedNode(isSelected ? null : node.id)}
                  onMouseDown={(e) => handleMouseDown(node.id, e)}
                  style={{ cursor: draggedNode === node.id ? 'grabbing' : 'grab' }}
                >
                  {/* Host node - circle */}
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={35}
                    fill={isSelected || isHovered ? '#9C27B0' : '#8E24AA'}
                    stroke={isSelected ? '#FFD700' : getStatusColor(host.status)}
                    strokeWidth={isSelected ? 3 : 2}
                  />
                  <text
                    x={node.x}
                    y={node.y - 5}
                    fill="white"
                    fontSize="12"
                    fontWeight="bold"
                    textAnchor="middle"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {node.name}
                  </text>
                  <text
                    x={node.x}
                    y={node.y + 8}
                    fill="white"
                    fontSize="9"
                    textAnchor="middle"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {host.loopback_ip}
                  </text>
                </g>
              );
            }
          })}
        </svg>
      </div>

      {/* Selected Node Details */}
      {selectedNode && (
        <div style={{
          marginTop: '1rem',
          padding: '1rem',
          background: 'var(--card-bg)',
          borderRadius: '8px',
          border: '2px solid #FFD700'
        }}>
          {(() => {
            const node = allNodes.find(n => n.id === selectedNode);
            if (!node) return null;

            if (node.type === 'network') {
              const network = node.data as Network;
              const isCommon = commonNetworks.has(network.name);
              return (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <h3 style={{ margin: 0 }}>
                      Network: {network.name} {isCommon && <span style={{ color: '#FF5722', fontSize: '0.8em' }}>(Common)</span>}
                    </h3>
                    <button
                      onClick={() => {
                        toggleNodeVisibility(node.id);
                        setSelectedNode(null);
                      }}
                      style={{
                        padding: '0.25rem 0.75rem',
                        background: '#f44336',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.85rem'
                      }}
                    >
                      Hide Node
                    </button>
                  </div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                    <div><strong>Subnet:</strong> {network.subnet}</div>
                    <div><strong>Gateway:</strong> {network.gateway || 'N/A'}</div>
                    <div><strong>Driver:</strong> {network.driver}</div>
                    <div><strong>Connected Containers:</strong> {network.containers.length}</div>
                    {isCommon && (
                      <div style={{ marginTop: '0.5rem', color: '#FF8A65' }}>
                        This network is connected to all containers in the topology.
                      </div>
                    )}
                  </div>
                </>
              );
            } else if (node.type === 'daemon') {
              const daemon = node.data as Daemon;
              return (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <h3 style={{ margin: 0 }}>Daemon: {daemon.name}</h3>
                    <button
                      onClick={() => {
                        toggleNodeVisibility(node.id);
                        setSelectedNode(null);
                      }}
                      style={{
                        padding: '0.25rem 0.75rem',
                        background: '#f44336',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.85rem'
                      }}
                    >
                      Hide Node
                    </button>
                  </div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                    <div><strong>Type:</strong> {daemon.type.toUpperCase()}</div>
                    <div><strong>ASN:</strong> {daemon.asn}</div>
                    <div><strong>Router ID:</strong> {daemon.router_id}</div>
                    <div><strong>Status:</strong> <span style={{ color: getStatusColor(daemon.status) }}>{daemon.status}</span></div>
                    <div style={{ marginTop: '0.5rem' }}><strong>Interfaces:</strong></div>
                    {daemon.interfaces.map((iface, idx) => (
                      <div key={idx} style={{ marginLeft: '1rem', fontSize: '0.85rem', fontFamily: 'monospace' }}>
                        {iface.network}: {iface.ipv4}
                      </div>
                    ))}
                  </div>
                </>
              );
            } else {
              const host = node.data as Host;
              return (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <h3 style={{ margin: 0 }}>Host: {host.name}</h3>
                    <button
                      onClick={() => {
                        toggleNodeVisibility(node.id);
                        setSelectedNode(null);
                      }}
                      style={{
                        padding: '0.25rem 0.75rem',
                        background: '#f44336',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.85rem'
                      }}
                    >
                      Hide Node
                    </button>
                  </div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                    <div><strong>Loopback:</strong> {host.loopback_ip}/{host.loopback_network}</div>
                    <div><strong>Gateway Daemon:</strong> {host.gateway_daemon}</div>
                    <div><strong>Gateway IP:</strong> {host.gateway_ip}</div>
                    <div><strong>Status:</strong> <span style={{ color: getStatusColor(host.status) }}>{host.status}</span></div>
                    <div style={{ marginTop: '0.5rem' }}><strong>Interfaces:</strong></div>
                    {host.interfaces.map((iface, idx) => (
                      <div key={idx} style={{ marginLeft: '1rem', fontSize: '0.85rem', fontFamily: 'monospace' }}>
                        {iface.network}: {iface.ipv4}
                      </div>
                    ))}
                  </div>
                </>
              );
            }
          })()}
        </div>
      )}

      {/* Legend with Visibility Toggles */}
      <div style={{
        marginTop: '1rem',
        padding: '1rem',
        background: 'var(--card-bg)',
        borderRadius: '8px',
        border: '1px solid var(--accent-dark)'
      }}>
        <div style={{ marginBottom: '0.5rem', fontWeight: 'bold', color: 'var(--text)' }}>
          Legend & Filters
        </div>
        <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={showDaemons}
              onChange={(e) => setShowDaemons(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            <svg width="40" height="30">
              <rect x="5" y="5" width="30" height="20" fill={getDaemonColor('gobgp')} stroke="#4CAF50" strokeWidth="2" rx="3" />
            </svg>
            <span style={{ fontSize: '0.85rem', color: 'var(--text)' }}>BGP Daemons ({topology?.daemons.length || 0})</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={showHosts}
              onChange={(e) => setShowHosts(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            <svg width="40" height="30">
              <circle cx="20" cy="15" r="12" fill="#9C27B0" stroke="#9C27B0" strokeWidth="2" />
            </svg>
            <span style={{ fontSize: '0.85rem', color: 'var(--text)' }}>Hosts ({topology?.hosts.length || 0})</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={showNetworks}
              onChange={(e) => setShowNetworks(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            <svg width="40" height="30">
              <polygon points="20,3 35,15 20,27 5,15" fill="#00BCD4" stroke="#00E5FF" strokeWidth="2" />
            </svg>
            <span style={{ fontSize: '0.85rem', color: 'var(--text)' }}>Networks ({topology?.networks.filter(n => n.name !== 'bridge').length || 0})</span>
          </label>
        </div>

        {/* Hidden Nodes Section */}
        {hiddenNodes.size > 0 && (
          <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--accent-dark)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontWeight: 'bold', color: 'var(--text)' }}>
                Hidden Nodes ({hiddenNodes.size})
              </span>
              <button
                onClick={showAllNodes}
                style={{
                  padding: '0.25rem 0.75rem',
                  background: 'var(--accent)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.85rem'
                }}
              >
                Show All
              </button>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {allNodes.filter(n => hiddenNodes.has(n.id)).map(node => (
                <button
                  key={node.id}
                  onClick={() => toggleNodeVisibility(node.id)}
                  style={{
                    padding: '0.25rem 0.5rem',
                    background: 'var(--card-bg)',
                    color: 'var(--text)',
                    border: '1px solid var(--accent-dark)',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.8rem'
                  }}
                  title="Click to show"
                >
                  {node.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LabTopologyViewerImproved;