import React, { useState, useEffect } from 'react';
import { Button } from '../../../_common/components';
import buttonCss from '../../../_common/styles/Button.module.css';
import styles from '../Forms.module.css';
import type { Trigger, TriggerConditions, TriggerAction } from '../../../_common/types/netflow';

interface TriggerFormProps {
  initialData?: Partial<Trigger>;
  onChange: (updates: Partial<Trigger>) => void;
  onSubmit: () => void;
  onCancel: () => void;
  isEditing?: boolean;
}

const TriggerForm: React.FC<TriggerFormProps> = ({
  initialData,
  onChange,
  onSubmit,
  onCancel,
  isEditing = false
}) => {
  // Local form state
  const [name, setName] = useState(initialData?.name || '');
  const [enabled, setEnabled] = useState(initialData?.enabled ?? true);
  const [minKbps, setMinKbps] = useState(initialData?.conditions?.min_kbps?.toString() || '');
  const [minMbps, setMinMbps] = useState(initialData?.conditions?.min_mbps?.toString() || '');
  const [minPps, setMinPps] = useState(initialData?.conditions?.min_pps?.toString() || '');
  const [minBytes, setMinBytes] = useState(initialData?.conditions?.min_bytes?.toString() || '');
  const [srcAddr, setSrcAddr] = useState(initialData?.conditions?.src_addr || '');
  const [dstAddr, setDstAddr] = useState(initialData?.conditions?.dst_addr || '');
  const [srcOrDstAddr, setSrcOrDstAddr] = useState(initialData?.conditions?.src_or_dst_addr || '');
  const [protocol, setProtocol] = useState(initialData?.conditions?.protocol?.toString() || '');
  const [actionType, setActionType] = useState<'log' | 'alert' | 'flowspec'>(initialData?.action?.type || 'log');
  const [actionMessage, setActionMessage] = useState(initialData?.action?.message || '');
  const [rateLimitKbps, setRateLimitKbps] = useState(initialData?.action?.rate_limit_kbps?.toString() || '');

  // Reset form state when initialData changes (for edit mode)
  useEffect(() => {
    setName(initialData?.name || '');
    setEnabled(initialData?.enabled ?? true);
    setMinKbps(initialData?.conditions?.min_kbps?.toString() || '');
    setMinMbps(initialData?.conditions?.min_mbps?.toString() || '');
    setMinPps(initialData?.conditions?.min_pps?.toString() || '');
    setMinBytes(initialData?.conditions?.min_bytes?.toString() || '');
    setSrcAddr(initialData?.conditions?.src_addr || '');
    setDstAddr(initialData?.conditions?.dst_addr || '');
    setSrcOrDstAddr(initialData?.conditions?.src_or_dst_addr || '');
    setProtocol(initialData?.conditions?.protocol?.toString() || '');
    setActionType(initialData?.action?.type || 'log');
    setActionMessage(initialData?.action?.message || '');
    setRateLimitKbps(initialData?.action?.rate_limit_kbps?.toString() || '');
  }, [initialData]);

  // Update parent when local state changes
  useEffect(() => {
    const conditions: TriggerConditions = {};
    if (minKbps) conditions.min_kbps = parseFloat(minKbps);
    if (minMbps) conditions.min_mbps = parseFloat(minMbps);
    if (minPps) conditions.min_pps = parseFloat(minPps);
    if (minBytes) conditions.min_bytes = parseInt(minBytes, 10);
    if (srcAddr) conditions.src_addr = srcAddr;
    if (dstAddr) conditions.dst_addr = dstAddr;
    if (srcOrDstAddr) conditions.src_or_dst_addr = srcOrDstAddr;
    if (protocol) conditions.protocol = parseInt(protocol, 10);

    const action: TriggerAction = { type: actionType };
    if (actionMessage) action.message = actionMessage;
    if (actionType === 'flowspec' && rateLimitKbps) {
      action.rate_limit_kbps = parseFloat(rateLimitKbps);
    }

    onChange({
      name,
      enabled,
      conditions,
      action
    });
  }, [onChange, name, enabled, minKbps, minMbps, minPps, minBytes, srcAddr, dstAddr, srcOrDstAddr, protocol, actionType, actionMessage, rateLimitKbps]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <h3>{isEditing ? 'Edit' : 'Create'} NetFlow Trigger</h3>

      {/* Row 1: Name, Enabled */}
      <div className={styles.formRow}>
        <div className={styles.formGroup}>
          <label htmlFor="triggerName">Trigger Name *</label>
          <input
            id="triggerName"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="High Bandwidth Alert"
            required
            className={styles.input}
          />
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="enabled">Enabled</label>
          <input
            id="enabled"
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            style={{ width: 'auto', height: '20px' }}
          />
        </div>
      </div>

      {/* Row 2: Min Kbps, Min Mbps */}
      <div className={styles.formRow}>
        <div className={styles.formGroup}>
          <label htmlFor="minKbps">Min Kbps</label>
          <input
            id="minKbps"
            type="number"
            step="0.01"
            value={minKbps}
            onChange={(e) => setMinKbps(e.target.value)}
            placeholder="0.0"
            className={styles.input}
          />
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="minMbps">Min Mbps</label>
          <input
            id="minMbps"
            type="number"
            step="0.001"
            value={minMbps}
            onChange={(e) => setMinMbps(e.target.value)}
            placeholder="0.0"
            className={styles.input}
          />
        </div>
      </div>

      {/* Row 3: Min Pps, Min Bytes */}
      <div className={styles.formRow}>
        <div className={styles.formGroup}>
          <label htmlFor="minPps">Min Pps</label>
          <input
            id="minPps"
            type="number"
            step="0.01"
            value={minPps}
            onChange={(e) => setMinPps(e.target.value)}
            placeholder="0.0"
            className={styles.input}
          />
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="minBytes">Min Bytes</label>
          <input
            id="minBytes"
            type="number"
            value={minBytes}
            onChange={(e) => setMinBytes(e.target.value)}
            placeholder="0"
            className={styles.input}
          />
        </div>
      </div>

      {/* Row 4: Source IP, Destination IP */}
      <div className={styles.formRow}>
        <div className={styles.formGroup}>
          <label htmlFor="srcAddr">Source IP</label>
          <input
            id="srcAddr"
            type="text"
            value={srcAddr}
            onChange={(e) => setSrcAddr(e.target.value)}
            placeholder="10.0.1.2"
            className={styles.input}
          />
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="dstAddr">Destination IP</label>
          <input
            id="dstAddr"
            type="text"
            value={dstAddr}
            onChange={(e) => setDstAddr(e.target.value)}
            placeholder="10.0.2.2"
            className={styles.input}
          />
        </div>
      </div>

      {/* Row 5: Either Src/Dst IP, Protocol */}
      <div className={styles.formRow}>
        <div className={styles.formGroup}>
          <label htmlFor="srcOrDstAddr">Src or Dst IP</label>
          <input
            id="srcOrDstAddr"
            type="text"
            value={srcOrDstAddr}
            onChange={(e) => setSrcOrDstAddr(e.target.value)}
            placeholder="10.0.1.2"
            className={styles.input}
          />
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="protocol">Protocol</label>
          <select
            id="protocol"
            value={protocol}
            onChange={(e) => setProtocol(e.target.value)}
            className={styles.input}
          >
            <option value="">Any Protocol</option>
            <option value="1">ICMP (1)</option>
            <option value="6">TCP (6)</option>
            <option value="17">UDP (17)</option>
            <option value="47">GRE (47)</option>
            <option value="50">ESP (50)</option>
            <option value="89">OSPF (89)</option>
          </select>
        </div>
      </div>

      {/* Row 6: Action Type, Action Message */}
      <div className={styles.formRow}>
        <div className={styles.formGroup}>
          <label htmlFor="actionType">Action Type</label>
          <select
            id="actionType"
            value={actionType}
            onChange={(e) => setActionType(e.target.value as 'log' | 'alert' | 'flowspec')}
            className={styles.input}
          >
            <option value="log">Log</option>
            <option value="alert">Alert</option>
            <option value="flowspec">FlowSpec</option>
          </select>
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="actionMessage">
            {actionType === 'alert' ? 'Alert Message' : actionType === 'flowspec' ? 'FlowSpec Message' : 'Message'}
          </label>
          <input
            id="actionMessage"
            type="text"
            value={actionMessage}
            onChange={(e) => setActionMessage(e.target.value)}
            placeholder={actionType === 'alert' ? 'Custom alert message' : 'FlowSpec rule description'}
            className={styles.input}
            disabled={actionType === 'log'}
          />
        </div>
      </div>

      {/* Row 7: Rate Limit (only if FlowSpec) */}
      {actionType === 'flowspec' && (
        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label htmlFor="rateLimitKbps">Rate Limit (kbps)</label>
            <input
              id="rateLimitKbps"
              type="number"
              step="0.01"
              value={rateLimitKbps}
              onChange={(e) => setRateLimitKbps(e.target.value)}
              placeholder="0.0"
              className={styles.input}
            />
          </div>
          <div className={styles.formGroup}></div>
        </div>
      )}

      <div className={buttonCss.buttonGroup}>
        <Button type="submit" className={buttonCss.buttonPrimary}>
          {isEditing ? 'Update Trigger' : 'Create Trigger'}
        </Button>
        <Button
          type="button"
          onClick={onCancel}
          className={buttonCss.buttonSecondary}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
};

export default TriggerForm;
