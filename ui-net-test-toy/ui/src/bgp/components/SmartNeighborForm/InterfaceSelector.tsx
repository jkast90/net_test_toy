/**
 * Reusable interface/IP selector component
 * Handles both daemon interface selection and external node IP input
 */

import React from 'react';
import { DaemonInfo } from '../../hooks';
import styles from '../Forms.module.css';

interface InterfaceSelectorProps {
  id: string;
  label: string;
  isExternalNode: boolean;
  // For external nodes
  manualIp?: string;
  onManualIpChange?: (value: string) => void;
  // For daemon interfaces
  selectedInterface?: string;
  onInterfaceChange?: (value: string) => void;
  daemon?: DaemonInfo;
  daemonSelected?: boolean;
  required?: boolean;
}

export const InterfaceSelector: React.FC<InterfaceSelectorProps> = ({
  id,
  label,
  isExternalNode,
  manualIp = '',
  onManualIpChange,
  selectedInterface = '',
  onInterfaceChange,
  daemon,
  daemonSelected = false,
  required = true
}) => {
  if (isExternalNode) {
    return (
      <div className={styles.formGroup}>
        <label htmlFor={id}>{label} {required && '*'}</label>
        <input
          id={id}
          type="text"
          value={manualIp}
          onChange={(e) => onManualIpChange?.(e.target.value)}
          placeholder="e.g., 192.168.1.1"
          required={required}
          className={styles.input}
        />
      </div>
    );
  }

  // Daemon interface selector
  const hasNoInterfaces = daemon?.networks.length === 0 || daemon?.networks.every(n => n.ips.length === 0);

  return (
    <div className={styles.formGroup}>
      <label htmlFor={id}>{label} {required && '*'}</label>
      <select
        id={id}
        value={selectedInterface}
        onChange={(e) => onInterfaceChange?.(e.target.value)}
        required={required}
        disabled={!daemonSelected}
        className={styles.input}
      >
        <option value="">
          {!daemonSelected
            ? "-- Select Router First --"
            : hasNoInterfaces
              ? "-- No interfaces available --"
              : "-- Select Interface --"}
        </option>
        {daemon?.networks.map(network =>
          network.ips.map(ip => (
            <option key={`${network.name}:${ip}`} value={`${network.name}:${ip}`}>
              {network.name}: {ip}
            </option>
          ))
        )}
      </select>
    </div>
  );
};
