/**
 * Form Layout Components
 * Reusable layout components for consistent form styling
 */

import React from 'react';

// ============================================================================
// FormRow - Horizontal row container for form fields
// ============================================================================

export interface FormRowProps {
  children: React.ReactNode;
  /** Gap between items (default: 1rem) */
  gap?: string;
  /** Additional class name */
  className?: string;
  /** Additional inline styles */
  style?: React.CSSProperties;
}

export const FormRow: React.FC<FormRowProps> = ({
  children,
  gap = '1rem',
  className,
  style
}) => {
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap,
        ...style
      }}
    >
      {children}
    </div>
  );
};

// ============================================================================
// FormGroup - Container for a single form field with label
// ============================================================================

export interface FormGroupProps {
  children: React.ReactNode;
  /** Label text for the field */
  label?: string;
  /** Whether the field is required */
  required?: boolean;
  /** Error message to display */
  error?: string;
  /** Help text to display below the field */
  helpText?: string;
  /** Flex basis for width control (default: auto) */
  flex?: string | number;
  /** Additional class name */
  className?: string;
  /** Additional inline styles */
  style?: React.CSSProperties;
}

const formGroupStyles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.5rem'
  },
  label: {
    display: 'block',
    fontSize: '0.9rem',
    fontWeight: 500 as const,
    color: 'var(--text)'
  },
  required: {
    color: 'var(--error)',
    marginLeft: '0.25rem'
  },
  error: {
    fontSize: '0.8rem',
    color: 'var(--error)'
  },
  helpText: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)'
  }
};

export const FormGroup: React.FC<FormGroupProps> = ({
  children,
  label,
  required = false,
  error,
  helpText,
  flex = 'auto',
  className,
  style
}) => {
  return (
    <div
      className={className}
      style={{
        ...formGroupStyles.container,
        flex,
        ...style
      }}
    >
      {label && (
        <label style={formGroupStyles.label}>
          {label}
          {required && <span style={formGroupStyles.required}>*</span>}
        </label>
      )}
      {children}
      {error && <span style={formGroupStyles.error}>{error}</span>}
      {helpText && !error && <span style={formGroupStyles.helpText}>{helpText}</span>}
    </div>
  );
};

// ============================================================================
// FormSection - Section divider with optional title
// ============================================================================

export interface FormSectionProps {
  children: React.ReactNode;
  /** Section title */
  title?: string;
  /** Description below title */
  description?: string;
  /** Additional class name */
  className?: string;
  /** Additional inline styles */
  style?: React.CSSProperties;
}

const formSectionStyles = {
  container: {
    marginBottom: '1.5rem'
  },
  title: {
    fontSize: '1rem',
    fontWeight: 600 as const,
    color: 'var(--text)',
    marginBottom: '0.5rem',
    paddingBottom: '0.5rem',
    borderBottom: '1px solid var(--border)'
  },
  description: {
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
    marginBottom: '1rem'
  },
  content: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1rem'
  }
};

export const FormSection: React.FC<FormSectionProps> = ({
  children,
  title,
  description,
  className,
  style
}) => {
  return (
    <div className={className} style={{ ...formSectionStyles.container, ...style }}>
      {title && <h4 style={formSectionStyles.title}>{title}</h4>}
      {description && <p style={formSectionStyles.description}>{description}</p>}
      <div style={formSectionStyles.content}>
        {children}
      </div>
    </div>
  );
};

// ============================================================================
// FormActions - Container for form action buttons
// ============================================================================

export interface FormActionsProps {
  children: React.ReactNode;
  /** Alignment of buttons (default: flex-end) */
  align?: 'flex-start' | 'center' | 'flex-end' | 'space-between';
  /** Gap between buttons (default: 1rem) */
  gap?: string;
  /** Additional class name */
  className?: string;
  /** Additional inline styles */
  style?: React.CSSProperties;
}

export const FormActions: React.FC<FormActionsProps> = ({
  children,
  align = 'flex-end',
  gap = '1rem',
  className,
  style
}) => {
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        justifyContent: align,
        gap,
        marginTop: '1.5rem',
        ...style
      }}
    >
      {children}
    </div>
  );
};
