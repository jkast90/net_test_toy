import React from 'react';
import buttonCss from '../../styles/Button.module.css';

interface ButtonGroupProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * ButtonGroup - Wrapper for grouping buttons together with consistent spacing
 *
 * Usage:
 * <ButtonGroup>
 *   <Button variant="primary">Save</Button>
 *   <Button variant="secondary">Cancel</Button>
 * </ButtonGroup>
 */
export const ButtonGroup: React.FC<ButtonGroupProps> = ({ children, className = '' }) => {
  return (
    <div className={`${buttonCss.buttonGroup} ${className}`}>
      {children}
    </div>
  );
};

export default ButtonGroup;
