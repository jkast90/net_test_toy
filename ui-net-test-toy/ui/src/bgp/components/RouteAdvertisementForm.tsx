import React, { useState, useEffect } from 'react';
import { useAppSelector } from '../../_common/store/hooks';
import { selectAllEnabledDaemons } from '../../_common/store/connectionSelectors';
import { advertiseRouteToTargets } from '../../_common/services/multiClientBgpApi';
import { topologyService } from '../../_common/services/topology/topologyService';
import { Button } from '../../_common/components/ui';
import buttonCss from '../../_common/styles/Button.module.css';
import styles from './Forms.module.css';

interface RouteAdvertisementFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  forceTopologyMode?: boolean; // If true, always save to topology (hides checkbox)
}

const RouteAdvertisementForm: React.FC<RouteAdvertisementFormProps> = ({
  onSuccess,
  onCancel,
  forceTopologyMode = false
}) => {
  const allTargets = useAppSelector(selectAllEnabledDaemons);
  const [selectedTargetId, setSelectedTargetId] = useState<string>('');
  const [prefixCidr, setPrefixCidr] = useState('');
  const [nextHop, setNextHop] = useState('');
  const [community, setCommunity] = useState('');
  const [med, setMed] = useState('');
  const [asPath, setAsPath] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [saveToTopology, setSaveToTopology] = useState(forceTopologyMode);
  const [activeTopology, setActiveTopology] = useState<string | null>(null);

  // Fetch active topology on mount
  useEffect(() => {
    const fetchActiveTopology = async () => {
      // Get first client's base URL to query for active topology
      if (allTargets.length > 0) {
        const firstClientUrl = allTargets[0].client.baseUrl;
        try {
          const topology = await topologyService.getActiveTopology(firstClientUrl);
          if (topology && topology.active) {
            setActiveTopology(topology.active.name);
          }
        } catch (err) {
          // No active topology or error fetching
          setActiveTopology(null);
        }
      }
    };
    fetchActiveTopology();
  }, [allTargets]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    if (!selectedTargetId) {
      setError('Please select a target daemon.');
      setLoading(false);
      return;
    }

    const selectedTarget = allTargets.find(t =>
      `${t.client.id}-${t.daemon.type}` === selectedTargetId
    );

    if (!selectedTarget) {
      setError('Selected target not found.');
      setLoading(false);
      return;
    }

    // Parse prefix/CIDR
    const parts = prefixCidr.split('/');
    if (parts.length !== 2) {
      setError('Prefix must be in format: 192.0.2.0/24');
      setLoading(false);
      return;
    }
    const prefix = parts[0].trim();
    const cidr = parts[1].trim();

    try {
      const attributes: any = {};

      if (nextHop) attributes.next_hop = nextHop;
      if (community) attributes.community = community.split(',').map(s => s.trim());
      if (med) attributes.med = parseInt(med);
      if (asPath) attributes.as_path = asPath.split(' ').map(n => parseInt(n.trim()));

      const result = await advertiseRouteToTargets([selectedTarget], prefix, cidr, attributes);

      if (result.failed > 0) {
        setError(`Failed to advertise route: ${result.errors.join(', ')}`);
      } else {
        setSuccessMessage(`Successfully advertised route to ${selectedTarget.client.name} (${selectedTarget.daemon.type.toUpperCase()})`);
      }

      // Save to topology if checkbox is checked and topology is active
      if (result.failed === 0 && saveToTopology && activeTopology) {
        try {
          const saveResult = await topologyService.saveRouteAdvertisement(
            activeTopology,
            {
              target_daemon: selectedTarget.daemon.type,
              prefix,
              cidr,
              next_hop: nextHop || undefined,
              communities: community || undefined,
              med: med ? parseInt(med) : undefined,
              as_path: asPath || undefined
            },
            selectedTarget.client.baseUrl
          );

          if (saveResult.success) {
            setSuccessMessage(
              `Successfully advertised route and saved to topology '${activeTopology}'`
            );
          } else {
            setError(`Route advertised but failed to save to topology: ${saveResult.error}`);
          }
        } catch (err) {
          setError(`Route advertised but failed to save to topology: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      }

      // Reset form on full success
      if (result.failed === 0) {
        setPrefixCidr('');
        setNextHop('');
        setCommunity('');
        setMed('');
        setAsPath('');
        setSaveToTopology(false);

        if (onSuccess) onSuccess();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to advertise route');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <h3>Advertise BGP Route</h3>

      {/* Row 1: Daemon selector, Prefix/CIDR */}
      <div className={styles.formRow}>
        <div className={styles.formGroup}>
          <label htmlFor="target">Target Daemon *</label>
          <select
            id="target"
            value={selectedTargetId}
            onChange={(e) => setSelectedTargetId(e.target.value)}
            required
            className={styles.input}
          >
            <option value="">Select a target...</option>
            {allTargets.map((target) => {
              const targetId = `${target.client.id}-${target.daemon.type}`;
              const displayName = `${target.client.name} - ${target.daemon.type.toUpperCase()}`;
              return (
                <option key={targetId} value={targetId}>
                  {displayName}
                </option>
              );
            })}
          </select>
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="prefixCidr">Prefix *</label>
          <input
            id="prefixCidr"
            type="text"
            value={prefixCidr}
            onChange={(e) => setPrefixCidr(e.target.value)}
            placeholder="192.0.2.0/24"
            required
            className={styles.input}
          />
        </div>
      </div>

      {/* Row 2: Next Hop, Communities */}
      <div className={styles.formRow}>
        <div className={styles.formGroup}>
          <label htmlFor="nextHop">Next Hop</label>
          <input
            id="nextHop"
            type="text"
            value={nextHop}
            onChange={(e) => setNextHop(e.target.value)}
            placeholder="192.168.1.1"
            className={styles.input}
          />
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="community">BGP Communities (comma-separated)</label>
          <input
            id="community"
            type="text"
            value={community}
            onChange={(e) => setCommunity(e.target.value)}
            placeholder="65000:100, 65000:200"
            className={styles.input}
          />
        </div>
      </div>

      {/* Row 3: MED, AS Path */}
      <div className={styles.formRow}>
        <div className={styles.formGroup}>
          <label htmlFor="med">MED</label>
          <input
            id="med"
            type="number"
            value={med}
            onChange={(e) => setMed(e.target.value)}
            placeholder="100"
            className={styles.input}
          />
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="asPath">AS Path (space-separated)</label>
          <input
            id="asPath"
            type="text"
            value={asPath}
            onChange={(e) => setAsPath(e.target.value)}
            placeholder="65001 65002"
            className={styles.input}
          />
        </div>
      </div>

      {/* Save to Topology Checkbox (hidden in force topology mode) */}
      {activeTopology && !forceTopologyMode && (
        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label htmlFor="saveToTopology" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                id="saveToTopology"
                type="checkbox"
                checked={saveToTopology}
                onChange={(e) => setSaveToTopology(e.target.checked)}
                style={{ width: 'auto', height: '20px' }}
              />
              <span>Save to active topology ({activeTopology})</span>
            </label>
          </div>
        </div>
      )}

      {error && <div className={styles.error}>{error}</div>}
      {successMessage && <div className={styles.success}>{successMessage}</div>}

      <div className={buttonCss.buttonGroup}>
        <Button
          type="submit"
          disabled={loading}
          className={buttonCss.buttonPrimary}
        >
          {loading ? 'Advertising...' : 'Advertise Route'}
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

export { RouteAdvertisementForm };
export default RouteAdvertisementForm;
