/**
 * Map Item Component
 * Reusable component for displaying items in the topology map panel
 * Supports expandable view to show networks and IPs
 */

import React, { ReactNode, useState } from 'react';
import { ActionsPopup } from '../../../_common/components';
import buttonCss from '../../../_common/styles/Button.module.css';

interface MapItemProps {
  id: string;
  label: string;
  color: string;
  icon: string;
  subtitle?: string;
  isSelected: boolean;
  tooltip: string;
  statusIndicator?: ReactNode;
  onSelect: () => void;
  onDeploy?: () => void;
  onStop?: () => void;
  onEdit?: (data: any) => void;
  onDelete?: () => void;
  onCopyInfo?: () => void;
  data: any;
}

export const MapItem: React.FC<MapItemProps> = ({
  id,
  label,
  color,
  icon,
  subtitle,
  isSelected,
  tooltip,
  statusIndicator,
  onSelect,
  onDeploy,
  onStop,
  onEdit,
  onDelete,
  onCopyInfo,
  data
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Build actions array
  const actions = [];
  if (onCopyInfo) {
    actions.push({
      label: 'Copy Info',
      icon: '📋',
      onClick: onCopyInfo,
      variant: 'secondary' as const
    });
  }
  if (onDeploy) {
    actions.push({
      label: 'Deploy',
      icon: '🚀',
      onClick: onDeploy,
      variant: 'primary' as const
    });
  }
  if (onStop) {
    actions.push({
      label: 'Remove Container',
      icon: '⏸️',
      onClick: onStop,
      variant: 'warning' as const
    });
  }
  if (onEdit) {
    actions.push({
      label: 'Edit',
      icon: '✏️',
      onClick: () => onEdit(data),
      variant: 'secondary' as const
    });
  }
  if (onDelete) {
    actions.push({
      label: 'Delete',
      icon: '🗑️',
      onClick: onDelete,
      variant: 'delete' as const,
      confirm: `Delete ${label}?`
    });
  }

  // Add opacity to color
  const rgbaColor = color.startsWith('#') ? `${color}CC` : color;

  // Extract networks and IPs from data
  const networks = data?.interfaces?.reduce((acc: any[], iface: any) => {
    if (iface.network && iface.ipv4) {
      const existingNetwork = acc.find(n => n.name === iface.network);
      if (existingNetwork) {
        if (!existingNetwork.ips.includes(iface.ipv4)) {
          existingNetwork.ips.push(iface.ipv4);
        }
      } else {
        acc.push({
          name: iface.network,
          ips: [iface.ipv4]
        });
      }
    }
    return acc;
  }, []) || [];

  const hasNetworks = networks.length > 0;

  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasNetworks) {
      setIsExpanded(!isExpanded);
    }
  };

  return (
    <>
      <div
        key={id}
        style={{
          borderRadius: '4px',
          fontSize: '0.75rem',
          border: isSelected ? '2px solid white' : '1px solid rgba(255,255,255,0.2)',
          transition: 'all 0.2s',
          color: 'white',
          overflow: 'hidden'
        }}
      >
        <div
          style={{
            padding: '0.5rem',
            backgroundColor: rgbaColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.5rem'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.02)';
            e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <div
            onClick={handleToggleExpand}
            style={{ flex: 1, cursor: hasNetworks ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            title={tooltip}
          >
            {hasNetworks && (
              <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>
                {isExpanded ? '▼' : '▶'}
              </span>
            )}
            {statusIndicator}
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500, fontSize: '0.8rem' }}>
                {icon} {label}
              </div>
              {subtitle && (
                <div style={{ fontSize: '0.7rem', opacity: 0.9 }}>{subtitle}</div>
              )}
            </div>
          </div>
          {actions.length > 0 && (
            <ActionsPopup
              actions={actions}
              buttonLabel="Actions"
              buttonClassName={buttonCss.buttonSecondary}
              buttonStyle={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem' }}
            />
          )}
        </div>

        {/* Expanded network details */}
        {isExpanded && hasNetworks && (
          <div style={{
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            padding: '0.5rem',
            fontSize: '0.7rem'
          }}>
            <div style={{ fontWeight: 600, marginBottom: '0.25rem', opacity: 0.8 }}>
              NETWORKS & IPs:
            </div>
            {networks.map((network: any, idx: number) => (
              <div key={idx} style={{ marginBottom: '0.5rem', paddingLeft: '0.5rem' }}>
                <div style={{ fontWeight: 500, opacity: 0.9 }}>
                  🌐 {network.name}
                </div>
                {network.ips.map((ip: string, ipIdx: number) => (
                  <div key={ipIdx} style={{ paddingLeft: '1rem', opacity: 0.8 }}>
                    • {ip}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
};
