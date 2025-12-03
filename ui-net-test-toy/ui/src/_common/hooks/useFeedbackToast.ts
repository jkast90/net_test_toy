/**
 * Feedback Toast Hook
 * Automatically shows toast notifications when feedback changes
 */

import { useEffect } from 'react';
import { useToast } from './useToast';

export interface Feedback {
  type: 'success' | 'error' | 'info' | 'warning';
  text: string;
}

export interface UseFeedbackToastOptions {
  feedback: Feedback | null;
  clearFeedback: () => void;
  duration?: number;
}

export interface FeedbackToastState {
  toasts: Array<{ id: string; type: string; text: string }>;
  showToast: (toast: { type: string; text: string; duration?: number }) => void;
  dismissToast: (id: string) => void;
}

/**
 * Hook that combines useToast with automatic feedback display
 * When feedback changes, it automatically shows a toast and clears the feedback
 */
export const useFeedbackToast = (options: UseFeedbackToastOptions): FeedbackToastState => {
  const { feedback, clearFeedback, duration = 5000 } = options;
  const { toasts, showToast, dismissToast } = useToast();

  // Show toast when feedback changes
  useEffect(() => {
    if (feedback) {
      showToast({
        type: feedback.type,
        text: feedback.text,
        duration
      });
      clearFeedback();
    }
  }, [feedback, showToast, clearFeedback, duration]);

  return {
    toasts,
    showToast,
    dismissToast
  };
};
