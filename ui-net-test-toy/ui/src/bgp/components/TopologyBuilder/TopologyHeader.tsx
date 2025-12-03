/**
 * Topology Builder Header
 * Displays alerts and selected link info bar
 */

import React from 'react';
import { Alert, Button, ButtonGroup } from '../../../_common/components';
import buttonCss from '../../../_common/styles/Button.module.css';
import type { TopologyLink, TopologyNode } from '../../types/topology';

interface TopologyHeaderProps {
  topologyError: string | null;
  successMessage: string | null;
  labFeedback: { type: 'success' | 'error' | 'info'; text: string } | null;
  selectedLink: string | null;
  findLink: (id: string) => TopologyLink | undefined;
  findNode: (id: string) => TopologyNode | undefined;
  onClearErrors: () => void;
  onClearSuccess: () => void;
  onClearLabFeedback: () => void;
  onDeleteLink: (linkId: string) => void;
  onClearSelectedLink: () => void;
}

export const TopologyHeader: React.FC<TopologyHeaderProps> = ({
  topologyError,
  successMessage,
  labFeedback,
  selectedLink,
  findLink,
  findNode,
  onClearErrors,
  onClearSuccess,
  onClearLabFeedback,
  onDeleteLink,
  onClearSelectedLink
}) => {
  return (
    <>
      {/* Error and Success Messages */}
      {topologyError && (
        <Alert type="error" message={topologyError} onClose={onClearErrors} />
      )}
      {successMessage && (
        <Alert type="success" message={successMessage} onClose={onClearSuccess} />
      )}
      {labFeedback && (
        <Alert type={labFeedback.type} message={labFeedback.text} onClose={onClearLabFeedback} />
      )}

      {/* Selected Link Info Bar */}
      {selectedLink && (() => {
        const link = findLink(selectedLink);
        if (!link) return null;
        const sourceNode = findNode(link.source);
        const targetNode = findNode(link.target);
        return (
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0.75rem 1rem',
            backgroundColor: 'rgba(33, 150, 243, 0.1)',
            border: '2px solid rgba(33, 150, 243, 0.5)',
            borderRadius: '8px',
            marginBottom: '1rem',
            flexShrink: 0
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                🔗 Selected Link
              </div>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                <strong>Type:</strong> {link.type === 'bgp' ? 'BGP Session' : 'Network Connection'}
                {' • '}
                <strong>From:</strong> {sourceNode?.label || 'Unknown'}
                {' → '}
                <strong>To:</strong> {targetNode?.label || 'Unknown'}
                {link.label && (
                  <>
                    {' • '}
                    <strong>Network:</strong> {link.label}
                  </>
                )}
              </div>
            </div>
            <ButtonGroup>
              <Button
                onClick={() => onDeleteLink(selectedLink)}
                className={buttonCss.buttonDelete}
              >
                🗑️ Delete Link
              </Button>
              <Button
                onClick={onClearSelectedLink}
                className={buttonCss.buttonSecondary}
              >
                ✕ Close
              </Button>
            </ButtonGroup>
          </div>
        );
      })()}
    </>
  );
};
