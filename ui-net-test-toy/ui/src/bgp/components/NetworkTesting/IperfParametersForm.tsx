import React from 'react';
import { InputField, SelectField } from '../../../_common/components/ui';
import styles from '../../pages/NetworkTesting.module.css';

interface IperfParametersFormProps {
  duration: number;
  protocol: 'tcp' | 'udp';
  port: number;
  onDurationChange: (value: number) => void;
  onProtocolChange: (value: 'tcp' | 'udp') => void;
  onPortChange: (value: number) => void;
}

const IperfParametersForm: React.FC<IperfParametersFormProps> = ({
  duration,
  protocol,
  port,
  onDurationChange,
  onProtocolChange,
  onPortChange
}) => {
  return (
    <>
      <div className={styles.formGrid2}>
        <InputField
          label="Duration (s)"
          type="number"
          value={duration}
          onChange={(e) => onDurationChange(parseInt(e.target.value))}
          min={1}
          max={60}
        />
        <InputField
          label="Port"
          type="number"
          value={port}
          onChange={(e) => onPortChange(parseInt(e.target.value))}
          min={1}
          max={65535}
        />
      </div>
      <SelectField
        label="Protocol"
        value={protocol}
        onChange={(e) => onProtocolChange(e.target.value as 'tcp' | 'udp')}
        options={[
          { value: 'tcp', label: 'TCP' },
          { value: 'udp', label: 'UDP' }
        ]}
      />
    </>
  );
};

export default IperfParametersForm;
