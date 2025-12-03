import React, { useState } from 'react';
import { ClientDaemonPair, configureNeighborOnTargets } from '../../_common/services/multiClientBgpApi';
import { Button } from '../../_common/components/ui';
import buttonCss from '../../_common/styles/Button.module.css';
import styles from './Forms.module.css';

interface EditNeighborFormProps {
  target: ClientDaemonPair;
  neighborIp: string;
  currentDescription: string;
  remoteAsn: number;
  localAsn: number;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const EditNeighborForm: React.FC<EditNeighborFormProps> = ({
  target,
  neighborIp,
  currentDescription,
  remoteAsn,
  localAsn,
  onSuccess,
  onCancel
}) => {
  const [description, setDescription] = useState(currentDescription || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const result = await configureNeighborOnTargets(
        [target],
        neighborIp,
        {
          remote_asn: remoteAsn,
          local_asn: localAsn,
          description: description
        }
      );

      if (result.failed > 0) {
        setError(`Failed to update: ${result.errors.join(', ')}`);
      } else {
        if (onSuccess) onSuccess();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update neighbor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <h3>Edit Neighbor Description</h3>
      <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>
        Neighbor: <strong>{neighborIp}</strong> on {target.client.name} ({target.daemon.type.toUpperCase()})
      </p>

      <div className={styles.formGroup}>
        <label htmlFor="description">Description</label>
        <input
          id="description"
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Enter neighbor description"
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
          {loading ? 'Updating...' : 'Update'}
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

export default EditNeighborForm;
