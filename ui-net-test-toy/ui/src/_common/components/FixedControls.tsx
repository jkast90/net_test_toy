/**
 * Fixed Controls Component
 * A container for controls that should always be visible at the bottom of the page,
 * positioned right above the footer
 */

import React from 'react';

interface FixedControlsProps {
  children: React.ReactNode;
  className?: string;
}

export const FixedControls: React.FC<FixedControlsProps> = ({ children, className = '' }) => {
  return (
    <div
      className={className}
      style={{
        position: 'fixed',
        bottom: '60px', // Above the footer (footer height is typically ~50-60px)
        left: 0,
        right: 0,
        zIndex: 100,
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none', // Allow clicks to pass through the container
        padding: '0 1rem'
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--card-bg)',
          borderRadius: '8px',
          padding: '0.75rem 1.25rem',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
          border: '1px solid var(--accent-dark)',
          pointerEvents: 'auto' // Re-enable clicks for the actual controls
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default FixedControls;
