/**
 * Reusable ASN input component
 */

import React from 'react';
import styles from '../Forms.module.css';

interface ASNInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}

export const ASNInput: React.FC<ASNInputProps> = ({
  id,
  label,
  value,
  onChange,
  required = false
}) => {
  return (
    <div className={styles.formGroup}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g., 65000"
        required={required}
        className={styles.input}
      />
    </div>
  );
};
