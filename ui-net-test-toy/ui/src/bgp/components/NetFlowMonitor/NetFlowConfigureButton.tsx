/**
 * NetFlow Configure Button Component
 */

import React from 'react';
import { Button } from '../../../_common/components';
import buttonCss from '../../../_common/styles/Button.module.css';

interface NetFlowConfigureButtonProps {
  targetCount: number;
  isConfiguring: boolean;
  onConfigure: () => void;
}

export const NetFlowConfigureButton: React.FC<NetFlowConfigureButtonProps> = ({
  targetCount,
  isConfiguring,
  onConfigure
}) => {
  return (
    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
      {targetCount > 0 && (
        <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          {targetCount} daemon(s) selected
        </span>
      )}
      <Button
        className={buttonCss.buttonPrimary}
        onClick={onConfigure}
        disabled={isConfiguring || targetCount === 0}
      >
        {isConfiguring ? 'Configuring...' : 'Configure NetFlow'}
      </Button>
    </div>
  );
};
