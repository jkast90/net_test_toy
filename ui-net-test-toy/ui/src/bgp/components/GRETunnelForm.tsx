/**
 * GRE Tunnel Form
 * Form for creating GRE tunnels between daemons, hosts, or external nodes
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '../../_common/components/ui';
import buttonCss from '../../_common/styles/Button.module.css';
import styles from './Forms.module.css';
import { topologyService } from '../../_common/services/topology/topologyService';

interface NetworkInfo {
  name: string;
  ips: string[];
}

interface NodeInfo {
  name: string;
  type: 'daemon' | 'host' | 'external_node';
  networks: NetworkInfo[];
  router_id?: string;
}

interface GRETunnelFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  saveToTopologyOnly?: boolean;
  topologyHostUrl?: string;
  topologyName?: string;  // Topology name for topology-level operations
  initialSource?: {
    name: string;
    type: 'daemon' | 'host' | 'external_node';
    interfaces?: Array<{ network: string; ipv4: string; gateway: string }>;
  };
  initialTarget?: {
    name: string;
    type: 'daemon' | 'host' | 'external_node';
    interfaces?: Array<{ network: string; ipv4: string; gateway: string }>;
  };
  availableNodes?: NodeInfo[];
}

const GRETunnelForm: React.FC<GRETunnelFormProps> = ({
  onSuccess,
  onCancel,
  saveToTopologyOnly = false,
  topologyHostUrl,
  topologyName = 'default',
  initialSource,
  initialTarget,
  availableNodes = []
}) => {
  const [selectedNodeA, setSelectedNodeA] = useState<string>('');
  const [selectedInterfaceA, setSelectedInterfaceA] = useState<string>('');
  const [selectedNodeB, setSelectedNodeB] = useState<string>('');
  const [selectedInterfaceB, setSelectedInterfaceB] = useState<string>('');
  const [tunnelName, setTunnelName] = useState<string>('gre0');
  const [tunnelIpA, setTunnelIpA] = useState<string>('');
  const [tunnelIpB, setTunnelIpB] = useState<string>('');
  const [tunnelNetwork, setTunnelNetwork] = useState<string>('30');
  const [greKey, setGreKey] = useState<string>('');
  const [ttl, setTtl] = useState<string>('64');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Generate random tunnel IPs with random 3rd octet
  const generateTunnelIPs = useCallback(() => {
    const randomOctet = Math.floor(Math.random() * 254) + 1; // 1-254
    setTunnelIpA(`10.255.${randomOctet}.1`);
    setTunnelIpB(`10.255.${randomOctet}.2`);
  }, []);

  // Auto-populate from initial values
  useEffect(() => {
    if (initialSource) {
      setSelectedNodeA(initialSource.name);
      if (initialSource.interfaces && initialSource.interfaces.length > 0) {
        setSelectedInterfaceA(`${initialSource.interfaces[0].network}:${initialSource.interfaces[0].ipv4}`);
      }
    }
    if (initialTarget) {
      setSelectedNodeB(initialTarget.name);
      if (initialTarget.interfaces && initialTarget.interfaces.length > 0) {
        setSelectedInterfaceB(`${initialTarget.interfaces[0].network}:${initialTarget.interfaces[0].ipv4}`);
      }
    }
    // Generate tunnel IPs when nodes are pre-selected
    if (initialSource && initialTarget) {
      generateTunnelIPs();
    }
  }, [initialSource, initialTarget, generateTunnelIPs]);

  // Generate tunnel IPs on mount if not pre-filled
  useEffect(() => {
    if (!tunnelIpA && !tunnelIpB) {
      generateTunnelIPs();
    }
  }, [tunnelIpA, tunnelIpB, generateTunnelIPs]);

  const getNodeByName = (nodeName: string): NodeInfo | undefined => {
    return availableNodes.find(n => n.name === nodeName);
  };

  const parseInterface = (interfaceStr: string): { network: string; ip: string } | null => {
    if (!interfaceStr) return null;
    const parts = interfaceStr.split(':');
    if (parts.length === 2) {
      // Format: "network:ip"
      return { network: parts[0], ip: parts[1] };
    } else if (parts.length === 1) {
      // Format: just "ip" (for external nodes)
      return { network: '', ip: parts[0] };
    }
    return null;
  };

  const handleCreateTunnel = async () => {
    setError(null);
    setSuccessMessage(null);

    // Validation
    if (!selectedNodeA || !selectedNodeB) {
      setError('Please select both nodes');
      return;
    }

    const ifaceA = parseInterface(selectedInterfaceA);
    const ifaceB = parseInterface(selectedInterfaceB);

    if (!ifaceA || !ifaceB) {
      setError('Please select interfaces for both nodes');
      return;
    }

    if (!tunnelIpA || !tunnelIpB) {
      setError('Please enter tunnel IPs for both sides');
      return;
    }

    setLoading(true);

    try {
      const nodeA = getNodeByName(selectedNodeA);
      const nodeB = getNodeByName(selectedNodeB);

      if (!nodeA || !nodeB) {
        throw new Error('Selected nodes not found');
      }

      const baseUrl = topologyHostUrl || '';
      const greKeyNum = greKey ? parseInt(greKey) : undefined;
      const ttlNum = parseInt(ttl);

      console.log(`[GRETunnelForm] Creating GRE tunnel "${tunnelName}" between ${selectedNodeA} and ${selectedNodeB}`);
      console.log(`[GRETunnelForm]   ${selectedNodeA}: ${ifaceA.ip} (${ifaceA.network}) -> tunnel IP ${tunnelIpA}`);
      console.log(`[GRETunnelForm]   ${selectedNodeB}: ${ifaceB.ip} (${ifaceB.network}) -> tunnel IP ${tunnelIpB}`);
      console.log(`[GRETunnelForm]   Tunnel network: /${tunnelNetwork}, GRE Key: ${greKeyNum || 'none'}, TTL: ${ttl}`);

      // Create bidirectional GRE tunnels using the new topology-level endpoint
      console.log(`[GRETunnelForm] Creating bidirectional GRE tunnels between ${selectedNodeA} and ${selectedNodeB}`);
      const result = await topologyService.createTopologyGreTunnels(
        topologyName,
        selectedNodeA,
        selectedNodeB,
        tunnelName, // tunnel_name_a
        tunnelName, // tunnel_name_b (same tunnel name for both sides)
        ifaceA.ip,  // local_ip_a
        ifaceB.ip,  // local_ip_b
        tunnelIpA,  // tunnel_ip_a
        tunnelIpB,  // tunnel_ip_b
        tunnelNetwork,
        ttlNum,
        greKeyNum,
        baseUrl
      );

      if (!result.success) {
        throw new Error(result.error || `Failed to create GRE tunnels`);
      }
      console.log(`[GRETunnelForm] ✓ GRE tunnels created successfully for ${selectedNodeA} and ${selectedNodeB}`);

      setSuccessMessage(`GRE tunnels created successfully between ${selectedNodeA} and ${selectedNodeB}`);

      if (onSuccess) {
        setTimeout(() => onSuccess(), 1500);
      }
    } catch (err: any) {
      console.error('[GRETunnelForm] Error creating GRE tunnel:', err);
      setError(err.message || 'Failed to create GRE tunnel');
    } finally {
      setLoading(false);
    }
  };

  const nodeA = getNodeByName(selectedNodeA);
  const nodeB = getNodeByName(selectedNodeB);

  return (
    <form onSubmit={(e) => { e.preventDefault(); handleCreateTunnel(); }} className={styles.form}>
      <h3>Create GRE Tunnel</h3>
      <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
        Configure a GRE tunnel between two nodes for point-to-point connectivity.
      </p>

      {error && (
        <div className={styles.errorMessage}>
          {error}
        </div>
      )}

      {successMessage && (
        <div className={styles.successMessage}>
          {successMessage}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
        {/* Row 1: Headers */}
        <div style={{ fontWeight: '600', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Node</div>
        <div style={{ fontWeight: '600', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Interface</div>
        <div style={{ fontWeight: '600', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Tunnel IP</div>

        {/* Row 2: Node A */}
        <div className={styles.formGroup}>
          <label htmlFor="nodeA">Node A *</label>
          <select
            id="nodeA"
            value={selectedNodeA}
            onChange={(e) => {
              setSelectedNodeA(e.target.value);
              setSelectedInterfaceA('');
            }}
            required
            className={styles.input}
            disabled={!!initialSource}
          >
            <option value="">-- Select Node --</option>
            {availableNodes.map(node => (
              <option key={node.name} value={node.name}>
                {node.name} ({node.type})
              </option>
            ))}
          </select>
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="interfaceA">
            {nodeA?.type === 'external_node' ? 'IP Address A *' : 'Interface A *'}
          </label>
          {nodeA?.type === 'external_node' ? (
            <input
              id="interfaceA"
              type="text"
              value={selectedInterfaceA}
              onChange={(e) => setSelectedInterfaceA(e.target.value)}
              required
              className={styles.input}
              placeholder="Enter IP address (e.g., 10.1.1.1)"
            />
          ) : (
            <select
              id="interfaceA"
              value={selectedInterfaceA}
              onChange={(e) => setSelectedInterfaceA(e.target.value)}
              required
              disabled={!selectedNodeA}
              className={styles.input}
            >
              <option value="">
                {!selectedNodeA
                  ? "-- Select Node A First --"
                  : (nodeA?.networks.length === 0 || nodeA?.networks.every(n => n.ips.length === 0))
                    ? "-- No interfaces available --"
                    : "-- Select Interface --"}
              </option>
              {nodeA?.networks.map(network =>
                network.ips.map(ip => (
                  <option key={`${network.name}:${ip}`} value={`${network.name}:${ip}`}>
                    {network.name}: {ip}
                  </option>
                ))
              )}
            </select>
          )}
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="tunnelIpA">Tunnel IP A *</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              id="tunnelIpA"
              type="text"
              value={tunnelIpA}
              onChange={(e) => setTunnelIpA(e.target.value)}
              required
              className={styles.input}
              placeholder="10.255.x.1"
            />
            <Button
              type="button"
              onClick={generateTunnelIPs}
              className={buttonCss.buttonSecondary}
              style={{ padding: '0.5rem', fontSize: '0.75rem', whiteSpace: 'nowrap' }}
              title="Generate new random tunnel IPs"
            >
              🎲
            </Button>
          </div>
        </div>

        {/* Row 3: Node B */}
        <div className={styles.formGroup}>
          <label htmlFor="nodeB">Node B *</label>
          <select
            id="nodeB"
            value={selectedNodeB}
            onChange={(e) => {
              setSelectedNodeB(e.target.value);
              setSelectedInterfaceB('');
            }}
            required
            className={styles.input}
            disabled={!!initialTarget}
          >
            <option value="">-- Select Node --</option>
            {availableNodes.map(node => (
              <option key={node.name} value={node.name}>
                {node.name} ({node.type})
              </option>
            ))}
          </select>
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="interfaceB">
            {nodeB?.type === 'external_node' ? 'IP Address B *' : 'Interface B *'}
          </label>
          {nodeB?.type === 'external_node' ? (
            <input
              id="interfaceB"
              type="text"
              value={selectedInterfaceB}
              onChange={(e) => setSelectedInterfaceB(e.target.value)}
              required
              className={styles.input}
              placeholder="Enter IP address (e.g., 10.1.1.1)"
            />
          ) : (
            <select
              id="interfaceB"
              value={selectedInterfaceB}
              onChange={(e) => setSelectedInterfaceB(e.target.value)}
              required
              disabled={!selectedNodeB}
              className={styles.input}
            >
              <option value="">
                {!selectedNodeB
                  ? "-- Select Node B First --"
                  : (nodeB?.networks.length === 0 || nodeB?.networks.every(n => n.ips.length === 0))
                    ? "-- No interfaces available --"
                    : "-- Select Interface --"}
              </option>
              {nodeB?.networks.map(network =>
                network.ips.map(ip => (
                  <option key={`${network.name}:${ip}`} value={`${network.name}:${ip}`}>
                    {network.name}: {ip}
                  </option>
                ))
              )}
            </select>
          )}
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="tunnelIpB">Tunnel IP B *</label>
          <input
            id="tunnelIpB"
            type="text"
            value={tunnelIpB}
            onChange={(e) => setTunnelIpB(e.target.value)}
            required
            className={styles.input}
            placeholder="10.255.x.2"
          />
        </div>
      </div>

      {/* Tunnel Parameters */}
      <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: '4px' }}>
        <h4 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Tunnel Parameters</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1rem' }}>
          <div className={styles.formGroup}>
            <label htmlFor="tunnelName">Tunnel Name *</label>
            <input
              id="tunnelName"
              type="text"
              value={tunnelName}
              onChange={(e) => setTunnelName(e.target.value)}
              required
              className={styles.input}
              placeholder="gre0"
            />
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Same name on both nodes
            </div>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="tunnelNetwork">Network Prefix *</label>
            <input
              id="tunnelNetwork"
              type="text"
              value={tunnelNetwork}
              onChange={(e) => setTunnelNetwork(e.target.value)}
              required
              className={styles.input}
              placeholder="30"
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="greKey">GRE Key (optional)</label>
            <input
              id="greKey"
              type="text"
              value={greKey}
              onChange={(e) => setGreKey(e.target.value)}
              className={styles.input}
              placeholder="Leave empty for no key"
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="ttl">TTL *</label>
            <input
              id="ttl"
              type="text"
              value={ttl}
              onChange={(e) => setTtl(e.target.value)}
              required
              className={styles.input}
              placeholder="64"
            />
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className={styles.buttonGroup} style={{ marginTop: '1.5rem' }}>
        <Button
          type="submit"
          disabled={loading}
          className={buttonCss.buttonPrimary}
        >
          {loading ? 'Creating...' : 'Create Tunnel'}
        </Button>
        <Button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className={buttonCss.buttonSecondary}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
};

export default GRETunnelForm;
