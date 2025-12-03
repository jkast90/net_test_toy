/**
 * Network Interface Selector Component
 * Reusable dropdown for selecting network interfaces from nodes
 */

import React from 'react';

export interface NetworkInterface {
  network: string;
  ipv4: string;
  gateway?: string;
}

export interface NodeData {
  name: string;
  type: string;
  interfaces: NetworkInterface[];
}

export interface NetworkInterfaceSelectorProps {
  /** Label to display above the selector */
  label?: string;
  /** Node data containing interfaces */
  node?: NodeData;
  /** Currently selected IP address */
  value: string;
  /** Called when selection changes */
  onChange: (ip: string) => void;
  /** Placeholder when no interfaces available */
  emptyMessage?: string;
  /** Additional class name */
  className?: string;
  /** Whether the selector is disabled */
  disabled?: boolean;
  /** Format for the option label */
  formatOption?: (iface: NetworkInterface) => string;
}

const defaultStyles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.5rem'
  },
  label: {
    display: 'block',
    fontSize: '0.9rem',
    fontWeight: 500 as const,
    color: 'var(--text)'
  },
  select: {
    width: '100%',
    padding: '0.5rem',
    background: 'var(--input-bg)',
    border: '1px solid var(--accent-dark)',
    borderRadius: '4px',
    color: 'var(--text)'
  },
  empty: {
    padding: '0.5rem',
    background: 'var(--surface-bg)',
    border: '1px solid var(--accent-dark)',
    borderRadius: '4px',
    color: 'var(--text-muted)',
    fontSize: '0.875rem'
  }
};

export const NetworkInterfaceSelector: React.FC<NetworkInterfaceSelectorProps> = ({
  label,
  node,
  value,
  onChange,
  emptyMessage = 'No interfaces available',
  className,
  disabled = false,
  formatOption = (iface) => `${iface.network} - ${iface.ipv4}`
}) => {
  const hasInterfaces = node && node.interfaces && node.interfaces.length > 0;

  return (
    <div style={defaultStyles.container} className={className}>
      {label && (
        <label style={defaultStyles.label}>
          {label}{node?.name ? `: ${node.name}` : ''}
        </label>
      )}
      {hasInterfaces ? (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={defaultStyles.select}
          disabled={disabled}
        >
          {node!.interfaces.map((iface, idx) => (
            <option key={idx} value={iface.ipv4}>
              {formatOption(iface)}
            </option>
          ))}
        </select>
      ) : (
        <div style={defaultStyles.empty}>
          {emptyMessage}
        </div>
      )}
    </div>
  );
};

export default NetworkInterfaceSelector;
