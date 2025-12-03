/**
 * Button Popup Component
 * Reusable popup menu that appears above a button
 */

import React, { ReactNode, CSSProperties } from 'react';

interface ButtonPopupProps {
  children: ReactNode;
  visible?: boolean;
  style?: CSSProperties;
  onMouseLeave?: () => void;
}

export const ButtonPopup: React.FC<ButtonPopupProps> = ({
  children,
  visible = true,
  style,
  onMouseLeave
}) => {
  if (!visible) return null;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '100%',
        left: 0,
        marginBottom: '0.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        zIndex: 1000,
        backgroundColor: 'var(--background-primary)',
        border: '1px solid var(--border)',
        borderRadius: '4px',
        padding: '0.5rem',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
        ...style
      }}
      onMouseLeave={onMouseLeave}
    >
      {children}
    </div>
  );
};

export default ButtonPopup;
