/**
 * Custom hook for managing hover delete button visibility
 * Used by topology items (nodes, links, etc.) to show/hide delete buttons with delay
 */

import { useState, useEffect, useRef } from 'react';

interface UseHoverDeleteOptions {
  isHovered: boolean;
  isSelected: boolean;
  enabled?: boolean; // Whether the delete button should be shown at all
  delay?: number; // Delay in ms before hiding the button (default: 500)
}

interface UseHoverDeleteReturn {
  showDeleteButton: boolean;
  deleteButtonProps: {
    onMouseEnter: () => void;
    onMouseLeave: () => void;
  };
}

/**
 * Hook to manage hover delete button visibility with delay
 *
 * @param options - Configuration options
 * @returns Object with showDeleteButton flag and props to spread on delete button
 *
 * @example
 * const { showDeleteButton, deleteButtonProps } = useHoverDelete({
 *   isHovered,
 *   isSelected,
 *   enabled: interactionMode === 'select'
 * });
 *
 * {showDeleteButton && (
 *   <button {...deleteButtonProps} onClick={handleDelete}>×</button>
 * )}
 */
export function useHoverDelete(options: UseHoverDeleteOptions): UseHoverDeleteReturn {
  const {
    isHovered,
    isSelected,
    enabled = true,
    delay = 500
  } = options;

  const [showButton, setShowButton] = useState(false);
  const [isButtonHovered, setIsButtonHovered] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Update showButton based on isHovered, isSelected, and isButtonHovered with delay
  useEffect(() => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if ((isHovered || isSelected || isButtonHovered) && enabled) {
      // Immediately show button when item is hovered/selected or button is hovered
      setShowButton(true);
    } else {
      // Delay hiding the button
      timeoutRef.current = setTimeout(() => {
        setShowButton(false);
      }, delay);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isHovered, isSelected, isButtonHovered, enabled, delay]);

  return {
    showDeleteButton: showButton,
    deleteButtonProps: {
      onMouseEnter: () => setIsButtonHovered(true),
      onMouseLeave: () => setIsButtonHovered(false)
    }
  };
}
