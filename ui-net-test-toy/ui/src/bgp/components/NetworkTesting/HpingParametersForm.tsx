import React from 'react';
import { InputField, SelectField } from '../../../_common/components/ui';
import styles from '../../pages/NetworkTesting.module.css';

interface HpingParametersFormProps {
  protocol: 'tcp' | 'udp' | 'icmp';
  count: number;
  flood: boolean;
  verbose: boolean;
  frag: boolean;
  syn: boolean;
  ttl: number;
  interval: string;
  data: number;
  randSource: boolean;
  sourcePort: number;
  destPort: number;
  firewallId: number;
  preset: string;
  onProtocolChange: (value: 'tcp' | 'udp' | 'icmp') => void;
  onCountChange: (value: number) => void;
  onFloodChange: (value: boolean) => void;
  onVerboseChange: (value: boolean) => void;
  onFragChange: (value: boolean) => void;
  onSynChange: (value: boolean) => void;
  onTtlChange: (value: number) => void;
  onIntervalChange: (value: string) => void;
  onDataChange: (value: number) => void;
  onRandSourceChange: (value: boolean) => void;
  onSourcePortChange: (value: number) => void;
  onDestPortChange: (value: number) => void;
  onFirewallIdChange: (value: number) => void;
  onPresetApply: (preset: string) => void;
}

const HpingParametersForm: React.FC<HpingParametersFormProps> = ({
  protocol,
  count,
  flood,
  verbose,
  frag,
  syn,
  ttl,
  interval,
  data,
  randSource,
  sourcePort,
  destPort,
  firewallId,
  preset,
  onProtocolChange,
  onCountChange,
  onFloodChange,
  onVerboseChange,
  onFragChange,
  onSynChange,
  onTtlChange,
  onIntervalChange,
  onDataChange,
  onRandSourceChange,
  onSourcePortChange,
  onDestPortChange,
  onFirewallIdChange,
  onPresetApply
}) => {
  return (
    <>
      <div className={styles.presetSection}>
        <div className={styles.presetTitle}>Attack Presets</div>
        <div className={styles.presetGrid}>
          {['SYN Flood', 'UDP Flood', 'ICMP Flood', 'Random Source SYN Flood', 'All out Traffic', 'High Traffic', 'Medium Traffic', 'Low Traffic'].map((p) => (
            <button
              key={p}
              onClick={() => onPresetApply(p)}
              className={`${styles.presetButton} ${preset === p ? styles.selected : ''}`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
      <div className={styles.formGrid2}>
        <SelectField
          label="Protocol"
          value={protocol}
          onChange={(e) => onProtocolChange(e.target.value as 'tcp' | 'udp' | 'icmp')}
          options={[
            { value: 'tcp', label: 'TCP' },
            { value: 'udp', label: 'UDP' },
            { value: 'icmp', label: 'ICMP' }
          ]}
        />
        <InputField
          label="Packet Count"
          type="number"
          value={count}
          onChange={(e) => onCountChange(parseInt(e.target.value))}
          min={1}
        />
        <InputField
          label="TTL"
          type="number"
          value={ttl}
          onChange={(e) => onTtlChange(parseInt(e.target.value))}
          min={1}
          max={255}
        />
        <InputField
          label="Interval (e.g., u12)"
          type="text"
          value={interval}
          onChange={(e) => onIntervalChange(e.target.value)}
          placeholder="u12"
        />
        <InputField
          label="Data Size (bytes)"
          type="number"
          value={data}
          onChange={(e) => onDataChange(parseInt(e.target.value))}
          min={0}
        />
        <InputField
          label="Source Port"
          type="number"
          value={sourcePort}
          onChange={(e) => onSourcePortChange(parseInt(e.target.value))}
          min={0}
          max={65535}
        />
        <InputField
          label="Dest Port"
          type="number"
          value={destPort}
          onChange={(e) => onDestPortChange(parseInt(e.target.value))}
          min={0}
          max={65535}
        />
        <InputField
          label="Firewall ID"
          type="number"
          value={firewallId}
          onChange={(e) => onFirewallIdChange(parseInt(e.target.value))}
          min={0}
        />
      </div>
      <div className={styles.formGrid3}>
        <label className={styles.checkboxLabel}>
          <input type="checkbox" checked={flood} onChange={(e) => onFloodChange(e.target.checked)} />
          Flood
        </label>
        <label className={styles.checkboxLabel}>
          <input type="checkbox" checked={syn} onChange={(e) => onSynChange(e.target.checked)} />
          SYN Flag
        </label>
        <label className={styles.checkboxLabel}>
          <input type="checkbox" checked={frag} onChange={(e) => onFragChange(e.target.checked)} />
          Fragment
        </label>
        <label className={styles.checkboxLabel}>
          <input type="checkbox" checked={randSource} onChange={(e) => onRandSourceChange(e.target.checked)} />
          Random Source
        </label>
        <label className={styles.checkboxLabel}>
          <input type="checkbox" checked={verbose} onChange={(e) => onVerboseChange(e.target.checked)} />
          Verbose
        </label>
      </div>
    </>
  );
};

export default HpingParametersForm;
