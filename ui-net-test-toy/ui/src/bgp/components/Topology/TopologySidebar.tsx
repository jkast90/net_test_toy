/**
 * Topology Sidebar Component
 * Contains topology selector and draggable lists of daemons/hosts
 */

import React from 'react';
import { DashboardPane, Button, StatusBadge } from '../../../_common/components';
import { LabDaemon, LabHost } from '../../types/topology';
import { getDaemonColor } from '../../utils/topologyUtils';
import buttonCss from '../../../_common/styles/Button.module.css';

interface TopologySidebarProps {
  // Daemons and hosts
  labDaemons: LabDaemon[];
  labHosts: LabHost[];
  onDragStart: (e: React.DragEvent, type: 'daemon' | 'host', data: any) => void;
  onCreateDaemon?: () => void;
  onCreateHost?: () => void;
}

export const TopologySidebar: React.FC<TopologySidebarProps> = ({
  labDaemons,
  labHosts,
  onDragStart,
  onCreateDaemon,
  onCreateHost
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '200px', flexShrink: 0, height: 'auto' }}>
      {/* Daemons List */}
      <DashboardPane title="BGP Daemons" style={{ flexShrink: 0 }}>
        <div>
          {labDaemons.length === 0 ? (
            <div style={{ padding: '0.75rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              No daemons available
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', padding: '0.5rem' }}>
              {labDaemons.map(daemon => (
                <div
                  key={daemon.id}
                  draggable
                  onDragStart={(e) => onDragStart(e, 'daemon', daemon)}
                  style={{
                    padding: '0.4rem',
                    backgroundColor: getDaemonColor(daemon.daemon_type),
                    borderRadius: '4px',
                    cursor: 'grab',
                    fontSize: '0.75rem',
                    border: '1px solid rgba(255,255,255,0.2)',
                    transition: 'all 0.2s',
                    color: 'white'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.05)';
                    e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div style={{ fontWeight: 500, fontSize: '0.8rem' }}>🔧 {daemon.name}</div>
                  <div style={{ fontSize: '0.7rem', opacity: 0.9 }}>
                    {daemon.daemon_type.toUpperCase()} - AS{daemon.asn}
                  </div>
                </div>
              ))}
            </div>
          )}
          {onCreateDaemon && (
            <div style={{ padding: '0.5rem', borderTop: '1px solid var(--border)' }}>
              <Button
                onClick={() => {
                  console.log('CREATE DAEMON BUTTON CLICKED');
                  onCreateDaemon();
                }}
                className={buttonCss.buttonPrimary}
                style={{ width: '100%', fontSize: '0.75rem', padding: '0.4rem' }}
              >
                + Create Daemon
              </Button>
            </div>
          )}
        </div>
      </DashboardPane>

      {/* Hosts List */}
      <DashboardPane title="Host Containers" style={{ flexShrink: 0 }}>
        <div>
          {labHosts.length === 0 ? (
            <div style={{ padding: '0.75rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              No hosts available
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', padding: '0.5rem' }}>
              {labHosts.map(host => (
                <div
                  key={host.id}
                  draggable
                  onDragStart={(e) => onDragStart(e, 'host', host)}
                  style={{
                    padding: '0.4rem',
                    backgroundColor: '#9C27B0',
                    borderRadius: '4px',
                    cursor: 'grab',
                    fontSize: '0.75rem',
                    border: '1px solid rgba(255,255,255,0.2)',
                    transition: 'all 0.2s',
                    color: 'white'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.05)';
                    e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div style={{ fontWeight: 500, fontSize: '0.8rem' }}>💻 {host.name}</div>
                  <div style={{ fontSize: '0.7rem', opacity: 0.9 }}>
                    {host.container_ip || host.loopback_ip}
                  </div>
                </div>
              ))}
            </div>
          )}
          {onCreateHost && (
            <div style={{ padding: '0.5rem', borderTop: '1px solid var(--border)' }}>
              <Button
                onClick={onCreateHost}
                className={buttonCss.buttonPrimary}
                style={{ width: '100%', fontSize: '0.75rem', padding: '0.4rem' }}
              >
                + Create Host
              </Button>
            </div>
          )}
        </div>
      </DashboardPane>
    </div>
  );
};
