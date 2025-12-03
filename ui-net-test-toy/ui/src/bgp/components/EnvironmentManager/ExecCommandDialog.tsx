import React from 'react';
import BaseDialog from '../../../_common/components/ui/BaseDialog';
import { Button, ButtonGroup } from '../../../_common/components/ui';
import buttonCss from '../../../_common/styles/Button.module.css';

interface Host {
  id: string;
  name: string;
  loopback_ip: string;
}

interface ExecCommandDialogProps {
  open: boolean;
  execHostName: string;
  execHostId: string | null;
  execCommand: string;
  execOutput: string;
  execRunning: boolean;
  hosts: Record<string, Host[]>;
  onClose: () => void;
  onExecute: () => void;
  onCommandChange: (command: string) => void;
  onQuickPing: (ip: string) => void;
}

export const ExecCommandDialog: React.FC<ExecCommandDialogProps> = ({
  open,
  execHostName,
  execHostId,
  execCommand,
  execOutput,
  execRunning,
  hosts,
  onClose,
  onExecute,
  onCommandChange,
  onQuickPing
}) => {
  return (
    <BaseDialog open={open} onClose={onClose}>
      <div style={{ padding: '1rem', maxWidth: '900px', minWidth: '600px' }}>
        <h2 style={{ marginTop: 0, marginBottom: '1.5rem' }}>Run Command on {execHostName}</h2>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: '500' }}>
            Quick Actions
          </label>
          <ButtonGroup>
            {execHostId && hosts[execHostId]?.filter(h => h.name !== execHostName).map(targetHost => (
              <Button
                key={targetHost.id}
                className={buttonCss.buttonSecondary}
                onClick={() => onQuickPing(targetHost.loopback_ip)}
                style={{ fontSize: '0.85rem' }}
              >
                Ping {targetHost.name} ({targetHost.loopback_ip})
              </Button>
            ))}
          </ButtonGroup>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: '500' }}>
            Command
          </label>
          <input
            type="text"
            value={execCommand}
            onChange={(e) => onCommandChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !execRunning) {
                onExecute();
              }
            }}
            placeholder="Enter command (e.g., ping -c 4 10.0.0.2, ip addr, ip route)"
            disabled={execRunning}
            style={{
              width: '100%',
              padding: '0.5rem',
              background: 'var(--input-bg)',
              border: '1px solid var(--accent-dark)',
              borderRadius: '4px',
              color: 'var(--text)',
              fontFamily: 'monospace'
            }}
          />
        </div>

        {execOutput && (
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: '500' }}>
              Output
            </label>
            <pre style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--accent-dark)',
              borderRadius: '4px',
              padding: '1rem',
              maxHeight: '400px',
              overflow: 'auto',
              fontFamily: 'monospace',
              fontSize: '0.85rem',
              whiteSpace: 'pre-wrap',
              wordWrap: 'break-word',
              margin: 0
            }}>
              {execOutput}
            </pre>
          </div>
        )}

        <ButtonGroup>
          <Button
            className={buttonCss.buttonPrimary}
            onClick={onExecute}
            disabled={!execCommand.trim() || execRunning}
          >
            {execRunning ? 'Running...' : 'Execute'}
          </Button>
          <Button
            className={buttonCss.buttonSecondary}
            onClick={onClose}
          >
            Close
          </Button>
        </ButtonGroup>
      </div>
    </BaseDialog>
  );
};

export default ExecCommandDialog;
