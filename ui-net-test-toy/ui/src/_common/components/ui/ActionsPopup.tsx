/**
 * Actions Popup Component
 * Reusable popup menu that appears above a button using a portal
 */

import React, { ReactNode, useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Button from './Button';
import buttonCss from '../../styles/Button.module.css';

interface Action {
  label: string;
  icon: string;
  onClick: () => void;
  className?: string;
  variant?: 'primary' | 'secondary' | 'warning' | 'delete';
  confirm?: string; // Optional confirmation message
}

interface ActionsPopupProps {
  actions: Action[];
  buttonLabel?: string;
  buttonClassName?: string;
  buttonStyle?: React.CSSProperties;
  popupBackgroundColor?: string;
}

export const ActionsPopup: React.FC<ActionsPopupProps> = ({
  actions,
  buttonLabel = 'Actions',
  buttonClassName = buttonCss.buttonSecondary,
  buttonStyle,
  popupBackgroundColor = 'var(--nav-bg, #1f1b2e)'
}) => {
  const [showActions, setShowActions] = useState(false);
  const [popupPosition, setPopupPosition] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate popup position when it becomes visible
  useEffect(() => {
    if (showActions && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPopupPosition({
        top: rect.top,
        left: rect.right - 150 // Align right edge, assuming popup width ~150px
      });
    } else {
      setPopupPosition(null);
    }
  }, [showActions]);

  const handleMouseEnter = () => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    setShowActions(true);
  };

  const handleMouseLeave = () => {
    hideTimerRef.current = setTimeout(() => {
      setShowActions(false);
    }, 300);
  };

  const handleActionClick = (action: Action) => {
    if (action.confirm) {
      if (confirm(action.confirm)) {
        action.onClick();
      }
    } else {
      action.onClick();
    }
    setShowActions(false);
  };

  const getButtonClass = (variant?: string) => {
    switch (variant) {
      case 'primary':
        return buttonCss.buttonPrimary;
      case 'warning':
        return buttonCss.buttonWarning;
      case 'delete':
        return buttonCss.buttonDelete;
      case 'secondary':
      default:
        return buttonCss.buttonSecondary;
    }
  };

  return (
    <>
      <div
        ref={buttonRef}
        style={{ position: 'relative' }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <Button
          onClick={(e) => {
            e.stopPropagation();
            setShowActions(!showActions);
          }}
          className={buttonClassName}
          style={buttonStyle}
        >
          {buttonLabel} {showActions ? '▼' : '▲'}
        </Button>
      </div>

      {/* Portal for actions popup */}
      {showActions && popupPosition && createPortal(
        <div
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          style={{
            position: 'fixed',
            top: `${popupPosition.top - 10}px`,
            left: `${popupPosition.left}px`,
            transform: 'translateY(-100%)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            zIndex: 10000,
            background: `linear-gradient(135deg, ${popupBackgroundColor} 0%, ${popupBackgroundColor} 100%)`,
            border: '2px solid var(--border, rgba(255, 255, 255, 0.3))',
            borderRadius: '6px',
            padding: '0.75rem',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5), 0 2px 8px rgba(0, 0, 0, 0.3)',
            minWidth: '150px'
          }}
        >
          {actions.map((action, index) => (
            <Button
              key={index}
              onClick={(e) => {
                e.stopPropagation();
                handleActionClick(action);
              }}
              className={action.className || getButtonClass(action.variant)}
              style={{ width: '100%', justifyContent: 'flex-start' }}
            >
              {action.icon} {action.label}
            </Button>
          ))}
        </div>,
        document.body
      )}
    </>
  );
};
