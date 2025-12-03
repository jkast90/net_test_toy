import React, { useState, useEffect } from 'react';
import { Button } from '../../_common/components/ui';
import buttonCss from '../../_common/styles/Button.module.css';
import styles from './Forms.module.css';
import { containerManagerService } from '../../_common/services/containerManager';
import { useAppSelector } from '../../_common/store/hooks';
import { selectEnabledManagedHosts } from '../../_common/store/labManagerSelectors';

interface NetworkInfo {
  name: string;
  ips: string[];
}

interface ContainerInfo {
  type: 'daemon' | 'host';
  name: string;
  id: string;
  hostId: string;
  hostName: string;
  networks: NetworkInfo[];
}

interface CreateGreTunnelFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

const CreateGreTunnelForm: React.FC<CreateGreTunnelFormProps> = ({
  onSuccess,
  onCancel
}) => {
  const managedHosts = useAppSelector(selectEnabledManagedHosts);
  const [availableContainers, setAvailableContainers] = useState<ContainerInfo[]>([]);
  const [selectedContainerA, setSelectedContainerA] = useState<string>(''); // Format: "hostId:containerType:containerName"
  const [selectedInterfaceA, setSelectedInterfaceA] = useState<string>(''); // Format: "ip"
  const [selectedContainerB, setSelectedContainerB] = useState<string>('');
  const [selectedInterfaceB, setSelectedInterfaceB] = useState<string>('');
  const [tunnelNameA, setTunnelNameA] = useState<string>('gre0');
  const [tunnelNameB, setTunnelNameB] = useState<string>('gre0');
  const [tunnelIpA, setTunnelIpA] = useState<string>('172.16.0.1');
  const [tunnelIpB, setTunnelIpB] = useState<string>('172.16.0.2');
  const [tunnelNetwork, setTunnelNetwork] = useState<string>('30');
  const [greKey, setGreKey] = useState<string>('');
  const [ttl, setTtl] = useState<string>('64');
  const [loading, setLoading] = useState(false);
  const [fetchingContainers, setFetchingContainers] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Fetch all available containers (daemons and hosts) from Lab Manager hosts
  useEffect(() => {
    const fetchAllContainers = async () => {
      if (managedHosts.length === 0) return;

      setFetchingContainers(true);

      try {
        // Use service to fetch containers from all hosts
        const results = await containerManagerService.getContainersFromHosts(
          managedHosts.map(h => ({
            url: h.url,
            id: h.id,
            name: h.name
          }))
        );

        // Flatten results into container list
        const containerList: ContainerInfo[] = results.flatMap(result =>
          result.containers.map(container => ({
            type: container.type as 'daemon' | 'host',
            name: container.name,
            id: container.name, // Use name as id
            hostId: container.host_id,
            hostName: container.host_name,
            networks: [] // Networks will be populated if needed
          }))
        );

        setAvailableContainers(containerList);
      } catch (err) {
        console.error('Failed to fetch containers:', err);
      } finally {
        setFetchingContainers(false);
      }
    };

    fetchAllContainers();
  }, [managedHosts]);

  // Get container A object
  const containerA = availableContainers.find(c =>
    `${c.hostId}:${c.type}:${c.name}` === selectedContainerA
  );

  // Get container B object
  const containerB = availableContainers.find(c =>
    `${c.hostId}:${c.type}:${c.name}` === selectedContainerB
  );

  // Get all network:ip pairs from a container's networks
  const getContainerNetworkIPs = (container: ContainerInfo | undefined): Array<{ network: string; ip: string }> => {
    if (!container) return [];
    const result: Array<{ network: string; ip: string }> = [];
    for (const net of container.networks) {
      for (const ip of net.ips || []) {
        result.push({ network: net.name, ip });
      }
    }
    return result;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!containerA || !containerB) {
      setError('Please select both containers');
      return;
    }

    if (!selectedInterfaceA || !selectedInterfaceB) {
      setError('Please select interfaces for both containers');
      return;
    }

    if (!tunnelIpA || !tunnelIpB) {
      setError('Please provide tunnel IPs for both endpoints');
      return;
    }

    setLoading(true);

    try {
      // Find host URLs from Redux state
      const hostA = managedHosts.find((h) => h.id === containerA.hostId);
      const hostB = managedHosts.find((h) => h.id === containerB.hostId);

      if (!hostA || !hostB) {
        setError('Could not find Lab Manager hosts');
        setLoading(false);
        return;
      }

      // Extract IP from interface selection (format: "networkName:ip")
      const localIpA = selectedInterfaceA.split(':')[1]?.split('/')[0] || selectedInterfaceA.split('/')[0];
      const localIpB = selectedInterfaceB.split(':')[1]?.split('/')[0] || selectedInterfaceB.split('/')[0];

      // Create tunnel on container A using service
      await containerManagerService.createGreTunnel(hostA.url, containerA.name, {
        remote_host: hostB.name,
        remote_ip: localIpB,
        tunnel_network: tunnelNetwork,
        tunnel_ip_a: tunnelIpA,
        tunnel_name: tunnelNameA,
        gre_key: greKey ? parseInt(greKey) : undefined,
        ttl: parseInt(ttl)
      });

      // Create tunnel on container B using service
      await containerManagerService.createGreTunnel(hostB.url, containerB.name, {
        remote_host: hostA.name,
        remote_ip: localIpA,
        tunnel_network: tunnelNetwork,
        tunnel_ip_a: tunnelIpB,
        tunnel_name: tunnelNameB,
        gre_key: greKey ? parseInt(greKey) : undefined,
        ttl: parseInt(ttl)
      });

      setSuccessMessage(`GRE tunnels created successfully between ${containerA.name} and ${containerB.name}`);
      setLoading(false);
      setTimeout(() => {
        if (onSuccess) onSuccess();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create GRE tunnels');
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <h3>Create GRE Tunnel</h3>
      <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
        Select two containers (daemons or hosts) and configure a bidirectional GRE tunnel between them.
      </p>

      {fetchingContainers && (
        <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading available containers...
        </div>
      )}

      {!fetchingContainers && availableContainers.length < 2 && (
        <div className={styles.warning}>
          At least 2 containers are required. Please ensure Lab Manager hosts are available.
        </div>
      )}

      {!fetchingContainers && availableContainers.length >= 2 && (
        <>
          <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'var(--accent-dark)', borderRadius: '4px', fontSize: '0.85rem' }}>
            <strong>Available Containers:</strong> {availableContainers.length} containers found
            <div style={{ marginTop: '0.5rem' }}>
              {availableContainers.slice(0, 5).map((c, idx) => (
                <div key={`${c.hostId}:${c.type}:${c.name}`} style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {idx + 1}. [{c.hostName}] {c.name} ({c.type}) - {c.networks.length} networks
                </div>
              ))}
              {availableContainers.length > 5 && (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  ... and {availableContainers.length - 5} more
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1rem' }}>
            {/* Row 1: Headers */}
            <div style={{ fontWeight: '600', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Container</div>
            <div style={{ fontWeight: '600', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Interface</div>
            <div style={{ fontWeight: '600', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Tunnel Name</div>
            <div style={{ fontWeight: '600', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Tunnel IP</div>

            {/* Row 2: Container A */}
            <div className={styles.formGroup}>
              <label htmlFor="containerA">Container A *</label>
              <select
                id="containerA"
                value={selectedContainerA}
                onChange={(e) => {
                  setSelectedContainerA(e.target.value);
                  setSelectedInterfaceA('');
                }}
                required
                className={styles.input}
              >
                <option value="">-- Select Container --</option>
                {availableContainers.map(container => (
                  <option
                    key={`${container.hostId}:${container.type}:${container.name}`}
                    value={`${container.hostId}:${container.type}:${container.name}`}
                    disabled={`${container.hostId}:${container.type}:${container.name}` === selectedContainerB}
                  >
                    [{container.hostName}] {container.name} ({container.type})
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="interfaceA">Interface A *</label>
              <select
                id="interfaceA"
                value={selectedInterfaceA}
                onChange={(e) => setSelectedInterfaceA(e.target.value)}
                required
                disabled={!containerA}
                className={styles.input}
              >
                <option value="">
                  {!selectedContainerA
                    ? "-- Select Container A First --"
                    : (containerA.networks.length === 0 ||
                       containerA.networks.every(n => n.ips.length === 0))
                      ? "-- No interfaces available --"
                      : "-- Select Interface --"}
                </option>
                {getContainerNetworkIPs(containerA).map(({ network, ip }) => (
                  <option key={`${network}:${ip}`} value={`${network}:${ip}`}>
                    {network}: {ip}
                  </option>
                ))}
              </select>
              {selectedContainerA && containerA?.networks.every(n => n.ips.length === 0) && (
                <div style={{ fontSize: '0.8rem', color: 'var(--warning)', marginTop: '0.25rem' }}>
                  Container {containerA.name} has no network interfaces configured
                </div>
              )}
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="tunnelNameA">Tunnel Name A</label>
              <input
                id="tunnelNameA"
                type="text"
                value={tunnelNameA}
                onChange={(e) => setTunnelNameA(e.target.value)}
                className={styles.input}
                placeholder="gre0"
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="tunnelIpA">Tunnel IP A *</label>
              <input
                id="tunnelIpA"
                type="text"
                value={tunnelIpA}
                onChange={(e) => setTunnelIpA(e.target.value)}
                required
                className={styles.input}
                placeholder="172.16.0.1"
              />
            </div>

            {/* Row 3: Container B */}
            <div className={styles.formGroup}>
              <label htmlFor="containerB">Container B *</label>
              <select
                id="containerB"
                value={selectedContainerB}
                onChange={(e) => {
                  setSelectedContainerB(e.target.value);
                  setSelectedInterfaceB('');
                }}
                required
                className={styles.input}
              >
                <option value="">-- Select Container --</option>
                {availableContainers.map(container => (
                  <option
                    key={`${container.hostId}:${container.type}:${container.name}`}
                    value={`${container.hostId}:${container.type}:${container.name}`}
                    disabled={`${container.hostId}:${container.type}:${container.name}` === selectedContainerA}
                  >
                    [{container.hostName}] {container.name} ({container.type})
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="interfaceB">Interface B *</label>
              <select
                id="interfaceB"
                value={selectedInterfaceB}
                onChange={(e) => setSelectedInterfaceB(e.target.value)}
                required
                disabled={!containerB}
                className={styles.input}
              >
                <option value="">
                  {!selectedContainerB
                    ? "-- Select Container B First --"
                    : (containerB.networks.length === 0 ||
                       containerB.networks.every(n => n.ips.length === 0))
                      ? "-- No interfaces available --"
                      : "-- Select Interface --"}
                </option>
                {getContainerNetworkIPs(containerB).map(({ network, ip }) => (
                  <option key={`${network}:${ip}`} value={`${network}:${ip}`}>
                    {network}: {ip}
                  </option>
                ))}
              </select>
              {selectedContainerB && containerB?.networks.every(n => n.ips.length === 0) && (
                <div style={{ fontSize: '0.8rem', color: 'var(--warning)', marginTop: '0.25rem' }}>
                  Container {containerB.name} has no network interfaces configured
                </div>
              )}
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="tunnelNameB">Tunnel Name B</label>
              <input
                id="tunnelNameB"
                type="text"
                value={tunnelNameB}
                onChange={(e) => setTunnelNameB(e.target.value)}
                className={styles.input}
                placeholder="gre0"
              />
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
                placeholder="172.16.0.2"
              />
            </div>
          </div>

          {/* Tunnel Parameters Section */}
          <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'var(--background-secondary)', borderRadius: '4px' }}>
            <h4 style={{ marginBottom: '1rem', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Tunnel Parameters
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
              <div className={styles.formGroup}>
                <label htmlFor="tunnelNetwork">Network Prefix</label>
                <input
                  id="tunnelNetwork"
                  type="text"
                  value={tunnelNetwork}
                  onChange={(e) => setTunnelNetwork(e.target.value)}
                  className={styles.input}
                  placeholder="30"
                />
                <small style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.25rem' }}>
                  CIDR prefix length (e.g., 30 for /30)
                </small>
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="greKey">GRE Key (optional)</label>
                <input
                  id="greKey"
                  type="number"
                  value={greKey}
                  onChange={(e) => setGreKey(e.target.value)}
                  className={styles.input}
                  placeholder="Leave empty for no key"
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="ttl">TTL</label>
                <input
                  id="ttl"
                  type="number"
                  value={ttl}
                  onChange={(e) => setTtl(e.target.value)}
                  className={styles.input}
                  placeholder="64"
                />
              </div>
            </div>
          </div>
        </>
      )}

      {error && <div className={styles.error}>{error}</div>}
      {successMessage && <div className={styles.success}>{successMessage}</div>}

      <div className={buttonCss.buttonGroup}>
        <Button
          type="submit"
          disabled={loading || !selectedContainerA || !selectedContainerB || !selectedInterfaceA || !selectedInterfaceB || !tunnelIpA || !tunnelIpB || fetchingContainers}
          className={buttonCss.buttonPrimary}
        >
          {loading ? 'Creating...' : 'Create Tunnels'}
        </Button>
        {onCancel && (
          <Button
            type="button"
            onClick={onCancel}
            className={buttonCss.buttonSecondary}
          >
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
};

export default CreateGreTunnelForm;
