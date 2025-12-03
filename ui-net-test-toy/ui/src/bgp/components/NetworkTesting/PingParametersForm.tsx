import React from 'react';
import { InputField } from '../../../_common/components/ui';
import styles from '../../pages/NetworkTesting.module.css';

interface PingParametersFormProps {
  count: number;
  interval: number;
  size: number;
  flood: boolean;
  verbose: boolean;
  onCountChange: (value: number) => void;
  onIntervalChange: (value: number) => void;
  onSizeChange: (value: number) => void;
  onFloodChange: (value: boolean) => void;
  onVerboseChange: (value: boolean) => void;
}

const PingParametersForm: React.FC<PingParametersFormProps> = ({
  count,
  interval,
  size,
  flood,
  verbose,
  onCountChange,
  onIntervalChange,
  onSizeChange,
  onFloodChange,
  onVerboseChange
}) => {
  return (
    <>
      <div className={styles.formGrid2}>
        <InputField
          label="Count"
          type="number"
          value={count}
          onChange={(e) => onCountChange(parseInt(e.target.value))}
          min={1}
        />
        <InputField
          label="Interval (s)"
          type="number"
          value={interval}
          onChange={(e) => onIntervalChange(parseFloat(e.target.value))}
          min={0.1}
          step={0.1}
        />
        <InputField
          label="Packet Size (bytes)"
          type="number"
          value={size}
          onChange={(e) => onSizeChange(parseInt(e.target.value))}
          min={1}
        />
      </div>
      <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.5rem' }}>
        <label className={styles.checkboxLabel}>
          <input type="checkbox" checked={flood} onChange={(e) => onFloodChange(e.target.checked)} />
          Flood
        </label>
        <label className={styles.checkboxLabel}>
          <input type="checkbox" checked={verbose} onChange={(e) => onVerboseChange(e.target.checked)} />
          Verbose
        </label>
      </div>
    </>
  );
};

export default PingParametersForm;
