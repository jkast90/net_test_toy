/**
 * Quick Test Dialog
 * Simplified test runner for quick ping/iperf tests
 */

import React, { useState, useEffect } from 'react';
import BaseDialog from '../../../_common/components/ui/BaseDialog';
import {
  Button,
  ButtonGroup,
  NetworkInterfaceSelector,
  FormGroup,
  type NodeData
} from '../../../_common/components/ui';
import buttonCss from '../../../_common/styles/Button.module.css';

// Matches the tool types supported by TestParameters in networkTestingService
export type QuickTestType = 'ping' | 'traceroute' | 'iperf' | 'hping' | 'curl';

interface QuickTestDialogProps {
  open: boolean;
  onClose: () => void;
  onStartTest: (srcIp: string, dstIp: string, testType: QuickTestType) => void;
  isRunning: boolean;
  sourceNode?: NodeData;
  targetNode?: NodeData;
}

export const QuickTestDialog: React.FC<QuickTestDialogProps> = ({
  open,
  onClose,
  onStartTest,
  isRunning,
  sourceNode,
  targetNode
}) => {
  const [srcIp, setSrcIp] = useState('');
  const [dstIp, setDstIp] = useState('');
  const [testType, setTestType] = useState<QuickTestType>('ping');

  // Auto-select first interface when nodes change
  useEffect(() => {
    if (sourceNode && sourceNode.interfaces.length > 0) {
      setSrcIp(sourceNode.interfaces[0].ipv4);
    }
    if (targetNode && targetNode.interfaces.length > 0) {
      setDstIp(targetNode.interfaces[0].ipv4);
    }
  }, [sourceNode, targetNode]);

  const handleStart = () => {
    if (!srcIp || !dstIp) {
      return;
    }
    onStartTest(srcIp, dstIp, testType);
  };

  return (
    <BaseDialog open={open} onClose={onClose}>
      <div style={{ padding: '1.5rem', minWidth: '500px' }}>
        <h2 style={{ marginTop: 0, marginBottom: '1.5rem' }}>Quick Test</h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
          {/* Test Type Selection */}
          <FormGroup label="Test Type">
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {(['ping', 'traceroute', 'iperf', 'curl', 'hping'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setTestType(type)}
                  style={{
                    flex: '1 1 auto',
                    minWidth: '80px',
                    padding: '0.5rem',
                    background: testType === type ? 'var(--accent)' : 'var(--surface-bg)',
                    border: '1px solid var(--accent-dark)',
                    borderRadius: '4px',
                    color: 'var(--text)',
                    cursor: 'pointer',
                    fontWeight: testType === type ? '600' : '400',
                    textTransform: 'capitalize'
                  }}
                >
                  {type}
                </button>
              ))}
            </div>
          </FormGroup>

          {/* Source Node/Interface */}
          <NetworkInterfaceSelector
            label="Source"
            node={sourceNode}
            value={srcIp}
            onChange={setSrcIp}
          />

          {/* Destination Node/Interface */}
          <NetworkInterfaceSelector
            label="Destination"
            node={targetNode}
            value={dstIp}
            onChange={setDstIp}
          />
        </div>

        <ButtonGroup>
          <Button
            className={buttonCss.buttonPrimary}
            onClick={handleStart}
            disabled={!srcIp || !dstIp || isRunning}
          >
            {isRunning ? 'Running...' : 'Start Test'}
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
