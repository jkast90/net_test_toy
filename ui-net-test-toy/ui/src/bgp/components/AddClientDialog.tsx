import React, { useState } from 'react';
import { useAppDispatch } from '../../_common/store/hooks';
import { addClient } from '../../_common/store/connectionSlice';
import BaseDialog from '../../_common/components/ui/BaseDialog';
import { Button } from '../../_common/components/ui';
import buttonCss from '../../_common/styles/Button.module.css';
import styles from './Forms.module.css';

interface AddClientDialogProps {
  open: boolean;
  onClose: () => void;
}

const AddClientDialog: React.FC<AddClientDialogProps> = ({ open, onClose }) => {
  const dispatch = useAppDispatch();

  const [clientName, setClientName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [pollInterval, setPollInterval] = useState(5);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!clientName || !baseUrl) {
      alert('Please provide both name and URL');
      return;
    }

    dispatch(addClient({
      name: clientName,
      baseUrl: baseUrl,
      daemons: [
        { type: 'gobgp', enabled: true },
        { type: 'frr', enabled: true },
        { type: 'exabgp', enabled: true },
        { type: 'bmp', enabled: true, port: 5002 },
        { type: 'netflow', enabled: false, port: 5003 }
      ],
      pollInterval: pollInterval,
      enabled: true
    }));

    // Reset form
    setClientName('');
    setBaseUrl('');
    setPollInterval(5);

    onClose();
  };

  return (
    <BaseDialog open={open} onClose={onClose}>
      <form onSubmit={handleSubmit} className={styles.form}>
        <h3>Add Unified API Client</h3>

        <div className={styles.formGroup}>
          <label htmlFor="clientName">Client Name *</label>
          <input
            id="clientName"
            type="text"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            placeholder="Lab 1 Router"
            required
            className={styles.input}
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="baseUrl">Base URL *</label>
          <input
            id="baseUrl"
            type="text"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="http://192.168.1.100:5001"
            required
            className={styles.input}
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="pollInterval">Poll Interval (seconds, 1-60)</label>
          <input
            id="pollInterval"
            type="number"
            min="1"
            max="60"
            value={pollInterval}
            onChange={(e) => setPollInterval(parseInt(e.target.value))}
            className={styles.input}
          />
        </div>

        <div className={buttonCss.buttonGroup}>
          <Button type="submit" className={buttonCss.buttonPrimary}>
            Add Client
          </Button>
          <Button type="button" onClick={onClose} className={buttonCss.buttonSecondary}>
            Cancel
          </Button>
        </div>
      </form>
    </BaseDialog>
  );
};

export default AddClientDialog;
