/**
 * Reusable daemon selector dropdown component
 */

import React from 'react';
import { DaemonInfo } from '../../hooks';
import styles from '../Forms.module.css';

interface DaemonSelectorProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  availableDaemons: DaemonInfo[];
  disabledValue?: string;
  required?: boolean;
}

export const DaemonSelector: React.FC<DaemonSelectorProps> = ({
  id,
  label,
  value,
  onChange,
  availableDaemons,
  disabledValue,
  required = true
}) => {
  return (
    <div className={styles.formGroup}>
      <label htmlFor={id}>{label} {required && '*'}</label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className={styles.input}
      >
        <option value="">-- Select Router --</option>
        {availableDaemons.map((d) => {
          const uniqueKey = `${d.client.id}-${d.daemon.type}-${d.routerId}`;
          return (
            <option
              key={uniqueKey}
              value={uniqueKey}
              disabled={uniqueKey === disabledValue}
            >
              {d.routerId} - {d.client.name} ({d.daemon.type.toUpperCase()})
            </option>
          );
        })}
      </select>
    </div>
  );
};
