import React, { useState } from 'react';
import { useAppSelector } from '../../_common/store/hooks';
import { selectEnabledDaemonsForSelectedClients } from '../../_common/store/connectionSelectors';
import { addFlowSpecRuleToTargets } from '../../_common/services/multiClientBgpApi';
import { FlowSpecRule } from '../../_common/services/bgpApi';
import { Button } from '../../_common/components/ui';
import TargetSelector from '../../_common/components/TargetSelector';
import buttonCss from '../../_common/styles/Button.module.css';
import styles from './Forms.module.css';

interface FlowSpecRuleFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

const FlowSpecRuleForm: React.FC<FlowSpecRuleFormProps> = ({
  onSuccess,
  onCancel
}) => {
  const targets = useAppSelector(selectEnabledDaemonsForSelectedClients);
  const [family, setFamily] = useState<'ipv4' | 'ipv6'>('ipv4');
  const [source, setSource] = useState('');
  const [destination, setDestination] = useState('');
  const [protocol, setProtocol] = useState('');
  const [sourcePort, setSourcePort] = useState('');
  const [destPort, setDestPort] = useState('');
  const [action, setAction] = useState<'discard' | 'accept' | 'rate-limit'>('discard');
  const [rateLimit, setRateLimit] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const protocolOptions = [
    { value: '1', label: 'ICMP' },
    { value: '6', label: 'TCP' },
    { value: '17', label: 'UDP' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    // Filter to only GoBGP targets (FlowSpec only supported on GoBGP)
    const gobgpTargets = targets.filter(t => t.daemon.type === 'gobgp');

    if (gobgpTargets.length === 0) {
      setError('No GoBGP targets selected. FlowSpec is only supported on GoBGP daemons.');
      setLoading(false);
      return;
    }

    try {
      const rule: FlowSpecRule = {
        family,
        match: {},
        actions: { action }
      };

      // Build match criteria
      if (source) rule.match.source = source;
      if (destination) rule.match.destination = destination;
      if (protocol) rule.match.protocol = parseInt(protocol);
      if (sourcePort) rule.match.source_port = parseInt(sourcePort);
      if (destPort) rule.match.destination_port = parseInt(destPort);

      // Build actions
      if (action === 'rate-limit' && rateLimit) {
        rule.actions.rate = parseFloat(rateLimit);
      }

      const result = await addFlowSpecRuleToTargets(gobgpTargets, rule);

      if (result.failed > 0) {
        setError(`Added to ${result.success} targets, failed on ${result.failed}: ${result.errors.join(', ')}`);
      } else {
        setSuccessMessage(`Successfully added FlowSpec rule to ${result.success} target(s)`);
      }

      // Reset form on full success
      if (result.failed === 0) {
        setSource('');
        setDestination('');
        setProtocol('');
        setSourcePort('');
        setDestPort('');
        setAction('discard');
        setRateLimit('');

        if (onSuccess) onSuccess();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add FlowSpec rule');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <h3>Add FlowSpec Rule</h3>
      <p className={styles.helpText}>
        FlowSpec rules allow traffic filtering and rate limiting at the BGP level (GoBGP only)
      </p>

      <TargetSelector label="Target GoBGP Clients" showDaemonFilter />

      <div className={styles.formGroup}>
        <label htmlFor="family">Address Family</label>
        <select
          id="family"
          value={family}
          onChange={(e) => setFamily(e.target.value as 'ipv4' | 'ipv6')}
          className={styles.input}
        >
          <option value="ipv4">IPv4</option>
          <option value="ipv6">IPv6</option>
        </select>
      </div>

      <div className={styles.sectionTitle}>Match Criteria</div>

      <div className={styles.formRow}>
        <div className={styles.formGroup}>
          <label htmlFor="source">Source Prefix</label>
          <input
            id="source"
            type="text"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="192.0.2.0/24"
            className={styles.input}
          />
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="destination">Destination Prefix</label>
          <input
            id="destination"
            type="text"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="198.51.100.0/24"
            className={styles.input}
          />
        </div>
      </div>

      <div className={styles.formGroup}>
        <label htmlFor="protocol">Protocol</label>
        <select
          id="protocol"
          value={protocol}
          onChange={(e) => setProtocol(e.target.value)}
          className={styles.input}
        >
          <option value="">Any</option>
          {protocolOptions.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      <div className={styles.formRow}>
        <div className={styles.formGroup}>
          <label htmlFor="sourcePort">Source Port</label>
          <input
            id="sourcePort"
            type="number"
            value={sourcePort}
            onChange={(e) => setSourcePort(e.target.value)}
            placeholder="Any"
            min="1"
            max="65535"
            className={styles.input}
          />
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="destPort">Destination Port</label>
          <input
            id="destPort"
            type="number"
            value={destPort}
            onChange={(e) => setDestPort(e.target.value)}
            placeholder="80"
            min="1"
            max="65535"
            className={styles.input}
          />
        </div>
      </div>

      <div className={styles.sectionTitle}>Action</div>

      <div className={styles.formGroup}>
        <label htmlFor="action">Action Type</label>
        <select
          id="action"
          value={action}
          onChange={(e) => setAction(e.target.value as any)}
          className={styles.input}
        >
          <option value="discard">Discard (Drop traffic)</option>
          <option value="accept">Accept (Allow traffic)</option>
          <option value="rate-limit">Rate Limit</option>
        </select>
      </div>

      {action === 'rate-limit' && (
        <div className={styles.formGroup}>
          <label htmlFor="rateLimit">Rate Limit (Mbps)</label>
          <input
            id="rateLimit"
            type="number"
            value={rateLimit}
            onChange={(e) => setRateLimit(e.target.value)}
            placeholder="10"
            min="0.1"
            step="0.1"
            required
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
          {loading ? 'Adding Rule...' : 'Add FlowSpec Rule'}
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

export default FlowSpecRuleForm;
