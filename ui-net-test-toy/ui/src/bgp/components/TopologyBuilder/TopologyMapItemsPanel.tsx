/**
 * Topology Map Items Panel
 * Collapsible sidebar showing all items on the topology map
 */

import React from 'react';
import { getDaemonColor } from '../../utils/topologyUtils';
import type { TopologyNode, TopologyLink } from '../../types/topology';
import { MapItem } from './MapItem';
import { StatusDot, getNodeStatus, getBGPSessionStatus, getGRETunnelStatus } from './StatusDot';
import { useNeighbors, useClipboard } from '../../../_common/hooks';

interface TapInfo {
  tap_name: string;
  target_container: string;
  target_interface: string;
  status: string;
  collector?: string;
}

interface TriggerInfo {
  id: number;
  name: string;
  enabled: boolean | number;
  min_kbps?: string;
  min_mbps?: string;
  min_pps?: string;
  src_addr?: string;
  dst_addr?: string;
  src_or_dst_addr?: string;
  protocol?: string;
  action_type: string;
  action_message?: string;
  rate_limit_kbps?: string;
}

// BGP Session record from unified model
interface BgpSessionInfo {
  id: number;
  topology_name: string;
  daemon1: string;
  daemon1_asn?: number | null;
  daemon1_ip: string;
  daemon2: string;
  daemon2_asn?: number | null;
  daemon2_ip: string;
  network?: string | null;
  address_families?: string | null;
  auth_key?: string | null;
  description?: string | null;
  status?: string;
}

interface TopologyMapItemsPanelProps {
  nodes: TopologyNode[];
  links: TopologyLink[];
  selectedNode: string | null;
  expanded: boolean;
  appConfig: any;
  containerManagerUrl: string;
  selectedTopologyName: string | null;
  topologies: any[];
  taps?: TapInfo[];
  triggers?: TriggerInfo[];
  bgpSessions?: BgpSessionInfo[];
  onToggleExpanded: () => void;
  onSelectNode: (nodeId: string) => void;
  onDeployDaemon: (name: string) => void;
  onStopDaemon: (name: string) => void;
  onDeployNetwork: (name: string) => void;
  onDeployHost: (name: string) => void;
  onStopHost: (name: string) => void;
  onDeployBGPSession?: (linkData: any) => Promise<void>;
  onDeployGRETunnel?: (linkData: any) => Promise<void>;
  onEditDaemon: (daemon: any) => void;
  onEditHost: (host: any) => void;
  onEditNetwork: (network: any) => void;
  onEditBGPSession?: (bgpData: any) => void;
  onEditGRETunnel?: (greData: any) => void;
  onDeleteBGPSession?: (session: BgpSessionInfo) => void;
  onDeleteGRETunnel?: (tunnel: any) => void;
  onDeleteNode: (nodeId: string) => void;
  onDeleteTap?: (tap: TapInfo) => void;
  onDeployTap?: (tap: TapInfo) => void;
  onStopTap?: (tap: TapInfo) => void;
  onEditTrigger?: (trigger: TriggerInfo) => void;
  onDeleteTrigger?: (trigger: TriggerInfo) => void;
  onToggleTrigger?: (trigger: TriggerInfo) => void;
  refetchConfig: () => void;
}

export const TopologyMapItemsPanel: React.FC<TopologyMapItemsPanelProps> = ({
  nodes,
  links,
  selectedNode,
  expanded,
  appConfig,
  taps = [],
  triggers = [],
  bgpSessions = [],
  onToggleExpanded,
  onSelectNode,
  onDeployDaemon,
  onStopDaemon,
  onDeployNetwork,
  onDeployHost,
  onStopHost,
  onDeployBGPSession,
  onDeployGRETunnel,
  onEditDaemon,
  onEditHost,
  onEditNetwork,
  onEditBGPSession,
  onEditGRETunnel,
  onDeleteBGPSession,
  onDeleteGRETunnel,
  onDeleteNode,
  onDeleteTap,
  onDeployTap,
  onStopTap,
  onEditTrigger,
  onDeleteTrigger,
  onToggleTrigger
}) => {
  // Get neighbors for BGP session status
  const { neighbors } = useNeighbors();

  // Clipboard hook for copying external node info
  const { copyJSON } = useClipboard({
    onSuccess: () => alert('Connection info copied to clipboard!'),
    onError: () => alert('Failed to copy to clipboard')
  });

  // Helper function to copy external node info to clipboard
  const copyExternalNodeInfo = (externalNode: TopologyNode) => {
    const externalNodeName = externalNode.data?.name;
    if (!externalNodeName) return;

    // Find all BGP sessions to this external node
    const bgpSessions = links
      .filter(l => l.type === 'bgp')
      .filter(l => {
        const source = nodes.find(n => n.id === l.source);
        const target = nodes.find(n => n.id === l.target);
        return source?.data?.name === externalNodeName || target?.data?.name === externalNodeName;
      })
      .map(l => {
        const sourceNode = nodes.find(n => n.id === l.source);
        const targetNode = nodes.find(n => n.id === l.target);
        const isSource = sourceNode?.data?.name === externalNodeName;
        const localSide = isSource ? l.data?.sourcePeer : l.data?.targetPeer;
        const remoteSide = isSource ? l.data?.targetPeer : l.data?.sourcePeer;

        return {
          local_daemon: localSide?.local_daemon || externalNodeName,
          local_ip: localSide?.local_ip || '',
          local_asn: localSide?.local_asn || '',
          peer_daemon: remoteSide?.local_daemon || '',
          peer_ip: remoteSide?.local_ip || '',
          peer_asn: remoteSide?.local_asn || ''
        };
      });

    // Find all GRE tunnels to this external node
    const greTunnels = links
      .filter(l => l.type === 'gre')
      .filter(l => {
        const sourceNode = nodes.find(n => n.id === l.source);
        const targetNode = nodes.find(n => n.id === l.target);
        return sourceNode?.data?.name === externalNodeName || targetNode?.data?.name === externalNodeName;
      })
      .map(l => {
        const sourceNode = nodes.find(n => n.id === l.source);
        const targetNode = nodes.find(n => n.id === l.target);
        const isSource = sourceNode?.data?.name === externalNodeName;

        // Extract tunnel details from label
        const labelLines = l.label?.split('\n') || [];
        const keyLine = labelLines.find(line => line.startsWith('Key:'));
        const ttlLine = labelLines.find(line => line.startsWith('TTL:'));
        const tunnelIpsLine = labelLines.find(line => line.includes('↔'));

        return {
          local_container: isSource ? sourceNode?.data?.name : targetNode?.data?.name,
          remote_container: isSource ? targetNode?.data?.name : sourceNode?.data?.name,
          local_ip: l.sourceLabel || '',
          remote_ip: l.targetLabel || '',
          tunnel_ips: tunnelIpsLine || '',
          gre_key: keyLine?.split(':')[1]?.trim() || null,
          ttl: ttlLine?.split(':')[1]?.trim() || '64'
        };
      });

    const info = {
      external_node: externalNodeName,
      bgp_sessions: bgpSessions,
      gre_tunnels: greTunnels
    };

    // Copy to clipboard using the hook
    copyJSON(info);
  };

  const daemons = nodes.filter(n => n.type === 'daemon');
  const networks = nodes.filter(n => n.type === 'network');
  const hosts = nodes.filter(n => n.type === 'host');
  const externalNodes = nodes.filter(n => n.type === 'external_node');
  const bgpLinks = (links || []).filter(l => l.type === 'bgp');
  const greTunnels = (links || []).filter(l => l.type === 'gre');

  // Calculate total items count
  const totalItemsCount = daemons.length + hosts.length + externalNodes.length + networks.length +
    bgpSessions.length + greTunnels.length + taps.length + triggers.length;

  return (
    <div style={{
      position: 'absolute',
      top: '5rem',
      left: '1rem',
      width: '300px',
      border: '1px solid var(--border)',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
      zIndex: 10,
      backdropFilter: 'blur(8px)'
    }}>
      <div
        onClick={onToggleExpanded}
        style={{
          padding: '0.75rem',
          backgroundColor: 'var(--accent-dark)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          userSelect: 'none'
        }}
      >
        <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Map Items ({totalItemsCount})</span>
        <span style={{ fontSize: '0.75rem' }}>{expanded ? '▼' : '▶'}</span>
      </div>
      {expanded && (
        <div style={{
          maxHeight: '500px',
          overflowY: 'auto',
          overflowX: 'visible',
          borderRadius: '0 0 8px 8px'
        }}>
          {/* Daemons */}
          {daemons.length > 0 && (
            <>
              <div style={{
                padding: '0.5rem 0.75rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--text-muted)',
                borderBottom: '1px solid var(--border)'
              }}>
                DAEMONS ({daemons.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', padding: '0.5rem' }}>
                {daemons.map(node => (
                  <MapItem
                    key={node.id}
                    id={node.id}
                    label={node.label}
                    color={node.color || getDaemonColor(node.data?.daemon_type)}
                    icon="🔧"
                    subtitle={node.asn ? `AS${node.asn}` : undefined}
                    isSelected={selectedNode === node.id}
                    tooltip={`Type: ${node.data?.type || 'BGP Daemon'}\nASN: ${node.asn || 'N/A'}\nRouter ID: ${node.data?.router_id || 'N/A'}\nIP: ${node.data?.ip_address || 'N/A'}\nStatus: ${getNodeStatus(node.data?.name, 'daemon', appConfig)}`}
                    statusIndicator={<StatusDot status={getNodeStatus(node.data?.name, 'daemon', appConfig)} />}
                    onSelect={() => onSelectNode(node.id)}
                    onDeploy={node.data?.name ? () => onDeployDaemon(node.data.name) : undefined}
                    onStop={node.data?.name ? () => onStopDaemon(node.data.name) : undefined}
                    onEdit={() => onEditDaemon(node.data)}
                    onDelete={() => onDeleteNode(node.id)}
                    data={node.data}
                                      />
                ))}
              </div>
            </>
          )}

          {/* Hosts */}
          {hosts.length > 0 && (
            <>
              <div style={{
                padding: '0.5rem 0.75rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--text-muted)',
                borderBottom: '1px solid var(--border)',
                marginTop: daemons.length > 0 ? '0.5rem' : 0
              }}>
                HOSTS ({hosts.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', padding: '0.5rem' }}>
                {hosts.map(node => (
                  <MapItem
                    key={node.id}
                    id={node.id}
                    label={node.label}
                    color={node.color || '#9C27B0'}
                    icon="💻"
                    subtitle={node.data?.container_ip}
                    isSelected={selectedNode === node.id}
                    tooltip={`Host: ${node.data?.name || 'N/A'}\nContainer IP: ${node.data?.container_ip || 'N/A'}\nLoopback: ${node.data?.loopback_ip || 'N/A'}`}
                    statusIndicator={<StatusDot status={getNodeStatus(node.data?.name, 'host', appConfig)} />}
                    onSelect={() => onSelectNode(node.id)}
                    onDeploy={node.data?.name ? () => onDeployHost(node.data.name) : undefined}
                    onStop={node.data?.name ? () => onStopHost(node.data.name) : undefined}
                    onEdit={() => onEditHost(node.data)}
                    onDelete={() => onDeleteNode(node.id)}
                    data={node.data}
                                      />
                ))}
              </div>
            </>
          )}

          {/* External Nodes */}
          {externalNodes.length > 0 && (
            <>
              <div style={{
                padding: '0.5rem 0.75rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--text-muted)',
                borderBottom: '1px solid var(--border)',
                marginTop: (daemons.length > 0 || hosts.length > 0) ? '0.5rem' : 0
              }}>
                EXTERNAL NODES ({externalNodes.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', padding: '0.5rem' }}>
                {externalNodes.map(node => (
                  <MapItem
                    key={node.id}
                    id={node.id}
                    label={node.label}
                    color={node.color || '#FF9800'}
                    icon="🌍"
                    subtitle={undefined}
                    isSelected={selectedNode === node.id}
                    tooltip={`External Node: ${node.data?.name || 'N/A'}`}
                    statusIndicator={undefined}
                    onSelect={() => onSelectNode(node.id)}
                    onDeploy={undefined} // External nodes don't have deploy button
                    onCopyInfo={() => copyExternalNodeInfo(node)}
                    onEdit={() => onEditNetwork(node.data)} // Reuse network edit for now
                    onDelete={() => onDeleteNode(node.id)}
                    data={node.data}
                                      />
                ))}
              </div>
            </>
          )}

          {/* BGP Sessions - from unified bgp_sessions table */}
          {bgpSessions.length > 0 && (
            <>
              <div style={{
                padding: '0.5rem 0.75rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--text-muted)',
                borderBottom: '1px solid var(--border)',
                marginTop: '0.5rem'
              }}>
                BGP SESSIONS ({bgpSessions.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', padding: '0.5rem' }}>
                {bgpSessions.map((session) => {
                  const label = `${session.daemon1} ↔ ${session.daemon2}`;
                  const subtitle = `AS${session.daemon1_asn || 'N/A'} ↔ AS${session.daemon2_asn || 'N/A'}`;

                  // Find session status from neighbors (check both directions)
                  const neighborMatch = neighbors.find(
                    n => (n.clientId === session.daemon1 && n.neighbor_ip === session.daemon2_ip) ||
                         (n.clientId === session.daemon2 && n.neighbor_ip === session.daemon1_ip)
                  );
                  const sessionStatus = neighborMatch?.state === 'established' ? 'running' : 'down';

                  return (
                    <MapItem
                      key={`bgp-session-${session.id}`}
                      id={`bgp-${session.id}`}
                      label={label}
                      color="#2196F3"
                      icon="🔗"
                      subtitle={subtitle}
                      isSelected={false}
                      tooltip={`BGP Session\n${session.daemon1} (${session.daemon1_ip}) AS${session.daemon1_asn || 'N/A'}\n↔\n${session.daemon2} (${session.daemon2_ip}) AS${session.daemon2_asn || 'N/A'}${session.description ? `\nDescription: ${session.description}` : ''}`}
                      statusIndicator={<StatusDot status={sessionStatus} />}
                      onSelect={() => {}}
                      onDeploy={onDeployBGPSession ? () => onDeployBGPSession(session) : undefined}
                      onEdit={onEditBGPSession ? () => onEditBGPSession(session) : undefined}
                      onDelete={onDeleteBGPSession ? () => onDeleteBGPSession(session) : undefined}
                      data={session}
                    />
                  );
                })}
              </div>
            </>
          )}

          {/* GRE Tunnels */}
          {greTunnels.length > 0 && (
            <>
              <div style={{
                padding: '0.5rem 0.75rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--text-muted)',
                borderBottom: '1px solid var(--border)',
                marginTop: '0.5rem'
              }}>
                GRE TUNNELS ({greTunnels.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', padding: '0.5rem' }}>
                {greTunnels.map(link => {
                  const sourceNode = nodes.find(n => n.id === link.source);
                  const targetNode = nodes.find(n => n.id === link.target);
                  const label = sourceNode && targetNode
                    ? `${sourceNode.data?.name} ↔ ${targetNode.data?.name}`
                    : link.label || 'GRE Tunnel';

                  return (
                    <MapItem
                      key={link.id}
                      id={link.id}
                      label={label}
                      color="#FF9800"
                      icon="🔧"
                      subtitle={link.label}
                      isSelected={false}
                      tooltip={`GRE Tunnel\n${link.sourceLabel || ''}\n${link.targetLabel || ''}`}
                      statusIndicator={<StatusDot status={getGRETunnelStatus(link.data, appConfig)} />}
                      onSelect={() => {}}
                      onDeploy={onDeployGRETunnel ? () => onDeployGRETunnel(link.data) : undefined}
                      onEdit={onEditGRETunnel ? () => onEditGRETunnel(link.data) : undefined}
                      onDelete={onDeleteGRETunnel ? () => onDeleteGRETunnel(link.data) : undefined}
                      data={link}
                                          />
                  );
                })}
              </div>
            </>
          )}

          {/* NetFlow Taps */}
          {taps.length > 0 && (
            <>
              <div style={{
                padding: '0.5rem 0.75rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--text-muted)',
                borderBottom: '1px solid var(--border)',
                marginTop: '0.5rem'
              }}>
                NETFLOW TAPS ({taps.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', padding: '0.5rem' }}>
                {taps.map(tap => {
                  // Handle both naming conventions from different API sources
                  const interfaceName = (tap as any).interface_name || tap.target_interface || 'unknown';
                  const containerName = (tap as any).container_name || tap.target_container || 'unknown';
                  return (
                    <MapItem
                      key={tap.tap_name}
                      id={tap.tap_name}
                      label={`${interfaceName}-tap`}
                      color="#2196F3"
                      icon="📡"
                      subtitle={containerName}
                      isSelected={false}
                      tooltip={`NetFlow Tap: ${interfaceName}-tap\nContainer: ${containerName}\nInterface: ${interfaceName}\nStatus: ${tap.status}${tap.collector ? `\nCollector: ${tap.collector}` : ''}`}
                      statusIndicator={<StatusDot status={tap.status === 'running' || tap.status === 'active' ? 'running' : 'down'} />}
                      onSelect={() => {}}
                      onDeploy={onDeployTap ? () => onDeployTap(tap) : undefined}
                      onStop={onStopTap ? () => onStopTap(tap) : undefined}
                      onDelete={onDeleteTap ? () => onDeleteTap(tap) : undefined}
                      data={tap}
                    />
                  );
                })}
              </div>
            </>
          )}

          {/* Triggers */}
          {triggers.length > 0 && (
            <>
              <div style={{
                padding: '0.5rem 0.75rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--text-muted)',
                borderBottom: '1px solid var(--border)',
                marginTop: '0.5rem'
              }}>
                TRIGGERS ({triggers.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', padding: '0.5rem' }}>
                {triggers.map(trigger => {
                  // Build conditions description
                  const conditions: string[] = [];
                  if (trigger.min_kbps) conditions.push(`≥${trigger.min_kbps} kbps`);
                  if (trigger.min_mbps) conditions.push(`≥${trigger.min_mbps} Mbps`);
                  if (trigger.min_pps) conditions.push(`≥${trigger.min_pps} pps`);
                  if (trigger.src_addr) conditions.push(`src=${trigger.src_addr}`);
                  if (trigger.dst_addr) conditions.push(`dst=${trigger.dst_addr}`);
                  if (trigger.src_or_dst_addr) conditions.push(`host=${trigger.src_or_dst_addr}`);
                  const conditionsStr = conditions.length > 0 ? conditions.join(', ') : 'No conditions';

                  const isEnabled = trigger.enabled === true || trigger.enabled === 1;

                  return (
                    <MapItem
                      key={trigger.id}
                      id={`trigger-${trigger.id}`}
                      label={trigger.name}
                      color={trigger.action_type === 'flowspec' ? '#FF5722' : trigger.action_type === 'alert' ? '#FF9800' : '#9E9E9E'}
                      icon="⚡"
                      subtitle={`${trigger.action_type.toUpperCase()}${trigger.rate_limit_kbps ? ` (${trigger.rate_limit_kbps} kbps)` : ''}`}
                      isSelected={false}
                      tooltip={`Trigger: ${trigger.name}\nAction: ${trigger.action_type}\nConditions: ${conditionsStr}\nStatus: ${isEnabled ? 'Enabled' : 'Disabled'}${trigger.action_message ? `\nMessage: ${trigger.action_message}` : ''}${trigger.rate_limit_kbps ? `\nRate Limit: ${trigger.rate_limit_kbps} kbps` : ''}`}
                      statusIndicator={<StatusDot status={isEnabled ? 'running' : 'down'} />}
                      onSelect={() => {}}
                      onEdit={onEditTrigger ? () => onEditTrigger(trigger) : undefined}
                      onDelete={onDeleteTrigger ? () => onDeleteTrigger(trigger) : undefined}
                      data={trigger}
                    />
                  );
                })}
              </div>
            </>
          )}

          {/* Networks */}
          {networks.length > 0 && (
            <>
              <div style={{
                padding: '0.5rem 0.75rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--text-muted)',
                borderBottom: '1px solid var(--border)',
                marginTop: '0.5rem'
              }}>
                NETWORKS ({networks.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', padding: '0.5rem' }}>
                {networks.map(node => (
                  <MapItem
                    key={node.id}
                    id={node.id}
                    label={node.label}
                    color={node.color || '#4CAF50'}
                    icon="🌐"
                    subtitle={node.data?.subnet}
                    isSelected={selectedNode === node.id}
                    tooltip={`Network: ${node.data?.name || 'N/A'}\nSubnet: ${node.data?.subnet || 'N/A'}\nGateway: ${node.data?.gateway || 'N/A'}`}
                    statusIndicator={<StatusDot status={getNodeStatus(node.data?.name, 'network', appConfig)} />}
                    onSelect={() => onSelectNode(node.id)}
                    onDeploy={node.data?.name ? () => onDeployNetwork(node.data.name) : undefined}
                    onEdit={() => onEditNetwork(node.data)}
                    onDelete={() => onDeleteNode(node.id)}
                    data={node.data}
                                      />
                ))}
              </div>
            </>
          )}

          {/* Empty State */}
          {nodes.length === 0 && links.length === 0 && (
            <div style={{
              padding: '2rem',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: '0.875rem'
            }}>
              No items on map yet. Drag components from the right to get started.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
