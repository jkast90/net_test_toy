/**
 * Canvas Bottom Controls Component
 * Fixed bar at the bottom of the canvas with buttons to toggle overlay panes
 */

import React from 'react';

interface CanvasBottomControlsProps {
  showQuickTest: boolean;
  showTopTalkers: boolean;
  onToggleQuickTest: () => void;
  onToggleTopTalkers: () => void;
}

export const CanvasBottomControls: React.FC<CanvasBottomControlsProps> = ({
  showQuickTest,
  showTopTalkers,
  onToggleQuickTest,
  onToggleTopTalkers
}) => {
  const buttonStyle = (isActive: boolean): React.CSSProperties => ({
    padding: '0.4rem 0.75rem',
    fontSize: '0.75rem',
    fontWeight: 600,
    background: isActive ? 'var(--accent, #2196F3)' : '#2a2a2a',
    border: `1px solid ${isActive ? 'var(--accent, #2196F3)' : '#444'}`,
    borderRadius: '4px',
    color: '#fff',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem'
  });

  return (
    <div style={{
      position: 'absolute',
      bottom: '10px',
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex',
      gap: '0.5rem',
      padding: '0.5rem',
      background: 'rgba(0,0,0,0.7)',
      borderRadius: '8px',
      backdropFilter: 'blur(4px)',
      zIndex: 50
    }}>
      <button
        onClick={onToggleQuickTest}
        style={buttonStyle(showQuickTest)}
        title={showQuickTest ? 'Hide Quick Test' : 'Show Quick Test'}
      >
        Quick Test
      </button>
      <button
        onClick={onToggleTopTalkers}
        style={buttonStyle(showTopTalkers)}
        title={showTopTalkers ? 'Hide Top Talkers' : 'Show Top Talkers'}
      >
        Top Talkers
      </button>
    </div>
  );
};
