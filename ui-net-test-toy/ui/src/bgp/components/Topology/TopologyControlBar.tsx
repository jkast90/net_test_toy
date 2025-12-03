/**
 * Topology Control Bar Component
 * Toolbar for topology interaction modes and actions
 */

import React from 'react';
import { Button, ButtonGroup } from '../../../_common/components';
import { InteractionMode } from '../../types/topology';
import buttonCss from '../../../_common/styles/Button.module.css';

interface TopologyControlBarProps {
  interactionMode: InteractionMode;
  firstSelectedForLink: string | null;
  onModeChange: (mode: InteractionMode) => void;
  onAutoLayout: () => void;
  onSave: () => void;
  onLoad: () => void;
  onClear: () => void;
  onAddNetwork: () => void;
  onAddExternalNode: () => void;
}

export const TopologyControlBar: React.FC<TopologyControlBarProps> = ({
  interactionMode,
  firstSelectedForLink,
  onModeChange,
  onAutoLayout,
  onSave,
  onLoad,
  onClear,
  onAddNetwork,
  onAddExternalNode
}) => {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '1rem',
      backgroundColor: 'var(--background-secondary)',
      borderRadius: '8px',
      marginBottom: '1rem',
      flexShrink: 0
    }}>
      {/* Mode Selection Buttons */}
      <ButtonGroup>
        <Button
          onClick={() => onModeChange('select')}
          className={interactionMode === 'select' ? buttonCss.buttonPrimary : buttonCss.buttonSecondary}
        >
          ✋ Select
        </Button>
        <Button
          onClick={() => onModeChange('add-link')}
          className={interactionMode === 'add-link' ? buttonCss.buttonPrimary : buttonCss.buttonSecondary}
        >
          🔗 Add Link
        </Button>
        <Button
          onClick={() => onModeChange('add-bgp-neighbor')}
          className={interactionMode === 'add-bgp-neighbor' ? buttonCss.buttonPrimary : buttonCss.buttonSecondary}
        >
          🤝 BGP Peer
        </Button>
        <Button
          onClick={onAddNetwork}
          className={buttonCss.buttonSecondary}
        >
          🌐 Add Network
        </Button>
        <Button
          onClick={onAddExternalNode}
          className={buttonCss.buttonSecondary}
        >
          🔌 Add External Node
        </Button>
      </ButtonGroup>

      {/* Mode Indicator */}
      <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
        Mode: <strong>{interactionMode.replace('-', ' ').toUpperCase()}</strong>
        {firstSelectedForLink && ' - Click second node to connect'}
      </div>

      {/* Action Buttons */}
      <ButtonGroup>
        <Button onClick={onSave} className={buttonCss.buttonSecondary}>
          💾 Save
        </Button>
        <Button onClick={onLoad} className={buttonCss.buttonSecondary}>
          📁 Load
        </Button>
        <Button onClick={onClear} className={buttonCss.buttonDelete}>
          🗑️ Clear All
        </Button>
      </ButtonGroup>
    </div>
  );
};
