import React, { useState } from 'react';
import { useAppSelector } from '../../_common/store/hooks';
import { selectEnabledDaemonsForSelectedClients } from '../../_common/store/connectionSelectors';
import { configureNeighborOnTargets } from '../../_common/services/multiClientBgpApi';
import { NeighborAttributes } from '../../_common/services/bgpApi';
import { Button } from '../../_common/components/ui';
import TargetSelector from '../../_common/components/TargetSelector';
import buttonCss from '../../_common/styles/Button.module.css';
import styles from './Forms.module.css';

interface NeighborConfigFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

const NeighborConfigForm: React.FC<NeighborConfigFormProps> = ({
  onSuccess,
  onCancel
}) => {
  const targets = useAppSelector(selectEnabledDaemonsForSelectedClients);
  const [neighborIp, setNeighborIp] = useState('');
  const [remoteAsn, setRemoteAsn] = useState('');
  const [localAsn, setLocalAsn] = useState('');
  const [description, setDescription] = useState('');
  const [localAddress, setLocalAddress] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [ebgpMultihop, setEbgpMultihop] = useState(false);
  const [ebgpMultihopTtl, setEbgpMultihopTtl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    if (targets.length === 0) {
      setError('No targets selected. Please select at least one client in Connection Manager.');
      setLoading(false);
      return;
    }

    try {
      const attributes: NeighborAttributes = {
        remote_asn: parseInt(remoteAsn)
      };

      if (localAsn) attributes.local_asn = parseInt(localAsn);
      if (description) attributes.description = description;
      if (localAddress) attributes.local_address = localAddress;
      if (authPassword) attributes.auth_password = authPassword;
      if (ebgpMultihop) {
        attributes.ebgp_multihop = true;
        if (ebgpMultihopTtl) attributes.ebgp_multihop_ttl = parseInt(ebgpMultihopTtl);
      }

      const result = await configureNeighborOnTargets(targets, neighborIp, attributes);

      if (result.failed > 0) {
        setError(`Configured on ${result.success} targets, failed on ${result.failed}: ${result.errors.join(', ')}`);
      } else {
        setSuccessMessage(`Successfully configured neighbor on ${result.success} target(s)`);
      }

      // Reset form on full success
      if (result.failed === 0) {
        setNeighborIp('');
        setRemoteAsn('');
        setLocalAsn('');
        setDescription('');
        setLocalAddress('');
        setAuthPassword('');
        setEbgpMultihop(false);
        setEbgpMultihopTtl('');

        if (onSuccess) onSuccess();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to configure neighbor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <h3>Configure BGP Neighbor</h3>

      <TargetSelector label="Target Clients & Daemons" showDaemonFilter />

      <div className={styles.formRow}>
        <div className={styles.formGroup}>
          <label htmlFor="neighborIp">Neighbor IP Address *</label>
          <input
            id="neighborIp"
            type="text"
            value={neighborIp}
            onChange={(e) => setNeighborIp(e.target.value)}
            placeholder="192.168.70.15"
            required
            className={styles.input}
          />
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="remoteAsn">Remote AS Number *</label>
          <input
            id="remoteAsn"
            type="number"
            value={remoteAsn}
            onChange={(e) => setRemoteAsn(e.target.value)}
            placeholder="65000"
            required
            className={styles.input}
          />
        </div>
      </div>

      <div className={styles.formRow}>
        <div className={styles.formGroup}>
          <label htmlFor="localAsn">Local AS Number</label>
          <input
            id="localAsn"
            type="number"
            value={localAsn}
            onChange={(e) => setLocalAsn(e.target.value)}
            placeholder="65001"
            className={styles.input}
          />
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="localAddress">Local Address</label>
          <input
            id="localAddress"
            type="text"
            value={localAddress}
            onChange={(e) => setLocalAddress(e.target.value)}
            placeholder="192.168.70.14"
            className={styles.input}
          />
        </div>
      </div>

      <div className={styles.formGroup}>
        <label htmlFor="description">Description</label>
        <input
          id="description"
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Peer description"
          className={styles.input}
        />
      </div>

      <div className={styles.formGroup}>
        <label htmlFor="authPassword">Authentication Password</label>
        <input
          id="authPassword"
          type="password"
          value={authPassword}
          onChange={(e) => setAuthPassword(e.target.value)}
          placeholder="Optional MD5 password"
          className={styles.input}
        />
      </div>

      <div className={styles.formGroup}>
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={ebgpMultihop}
            onChange={(e) => setEbgpMultihop(e.target.checked)}
          />
          Enable eBGP Multihop
        </label>
      </div>

      {ebgpMultihop && (
        <div className={styles.formGroup}>
          <label htmlFor="ebgpMultihopTtl">eBGP Multihop TTL</label>
          <input
            id="ebgpMultihopTtl"
            type="number"
            value={ebgpMultihopTtl}
            onChange={(e) => setEbgpMultihopTtl(e.target.value)}
            placeholder="255"
            min="1"
            max="255"
            className={styles.input}
          />
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
          {loading ? 'Configuring...' : 'Configure Neighbor'}
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

export default NeighborConfigForm;
