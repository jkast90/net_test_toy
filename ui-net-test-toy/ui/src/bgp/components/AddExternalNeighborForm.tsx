import React, { useState, useEffect } from 'react';
import { ClientDaemonPair, configureNeighborOnTargets } from '../../_common/services/multiClientBgpApi';
import { Button } from '../../_common/components/ui';
import buttonCss from '../../_common/styles/Button.module.css';
import styles from './Forms.module.css';
import { bgpApi } from '../../_common/services/bgpApi';

interface AddExternalNeighborFormProps {
  targets: ClientDaemonPair[];
  onSuccess?: () => void;
  onCancel?: () => void;
}

const AddExternalNeighborForm: React.FC<AddExternalNeighborFormProps> = ({
  targets,
  onSuccess,
  onCancel
}) => {
  const [selectedTarget, setSelectedTarget] = useState<ClientDaemonPair | null>(
    targets.length > 0 ? targets[0] : null
  );
  const [neighborIp, setNeighborIp] = useState('');
  const [remoteAsn, setRemoteAsn] = useState('');
  const [localAsn, setLocalAsn] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch and pre-fill local ASN when target changes
  useEffect(() => {
    const fetchDaemonAsn = async () => {
      if (!selectedTarget) return;

      try {
        const data = await bgpApi.getBackends(selectedTarget.client.baseUrl);
        const backendInfo = data.backends[selectedTarget.daemon.type];
        if (backendInfo && backendInfo.asn) {
          setLocalAsn(backendInfo.asn.toString());
        }
      } catch (err) {
        console.error('Failed to fetch daemon ASN:', err);
      }
    };

    fetchDaemonAsn();
  }, [selectedTarget]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedTarget) {
      setError('Please select a target daemon');
      return;
    }

    if (!neighborIp || !remoteAsn || !localAsn) {
      setError('Please fill in all required fields');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await configureNeighborOnTargets(
        [selectedTarget],
        neighborIp,
        {
          remote_asn: parseInt(remoteAsn),
          local_asn: parseInt(localAsn),
          description: description || undefined
        }
      );

      if (result.failed > 0) {
        setError(`Failed to configure: ${result.errors.join(', ')}`);
      } else {
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
      <h3>Add External Neighbor</h3>
      <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>
        Configure a BGP neighbor connection to an external peer
      </p>

      <div className={styles.formGroup}>
        <label htmlFor="target">Target Daemon *</label>
        <select
          id="target"
          value={selectedTarget ? `${selectedTarget.client.id}:${selectedTarget.daemon.type}` : ''}
          onChange={(e) => {
            const [clientId, daemonType] = e.target.value.split(':');
            const target = targets.find(
              t => t.client.id === clientId && t.daemon.type === daemonType
            );
            setSelectedTarget(target || null);
            // Reset local ASN when target changes (will be fetched by useEffect)
            setLocalAsn('');
          }}
          className={styles.input}
          required
        >
          {targets.map(target => (
            <option
              key={`${target.client.id}:${target.daemon.type}`}
              value={`${target.client.id}:${target.daemon.type}`}
            >
              {target.client.name} - {target.daemon.type.toUpperCase()}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.formGroup}>
        <label htmlFor="neighborIp">Neighbor IP Address *</label>
        <input
          id="neighborIp"
          type="text"
          value={neighborIp}
          onChange={(e) => setNeighborIp(e.target.value)}
          placeholder="192.168.1.1"
          className={styles.input}
          required
        />
      </div>

      <div className={styles.formGroup}>
        <label htmlFor="remoteAsn">Remote ASN *</label>
        <input
          id="remoteAsn"
          type="number"
          value={remoteAsn}
          onChange={(e) => setRemoteAsn(e.target.value)}
          placeholder="65001"
          className={styles.input}
          required
        />
      </div>

      <div className={styles.formGroup}>
        <label htmlFor="localAsn">Local ASN *</label>
        <input
          id="localAsn"
          type="number"
          value={localAsn}
          onChange={(e) => setLocalAsn(e.target.value)}
          placeholder="65000"
          className={styles.input}
          required
        />
      </div>

      <div className={styles.formGroup}>
        <label htmlFor="description">Description</label>
        <input
          id="description"
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="External peer connection"
          className={styles.input}
        />
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <div className={buttonCss.buttonGroup}>
        <Button
          type="submit"
          disabled={loading}
          className={buttonCss.buttonPrimary}
        >
          {loading ? 'Configuring...' : 'Add Neighbor'}
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

export default AddExternalNeighborForm;
