/**
 * Neighbor Management Control Pane
 * Provides controls for adding and refreshing BGP neighbors
 */

import React from 'react';
import { Button, Alert, DashboardPane } from '../../../_common/components';
import { ButtonGroup } from '../../../_common/components/ui';
import buttonCss from '../../../_common/styles/Button.module.css';

interface NeighborManagementPaneProps {
  targetCount: number;
  onAddNeighbor: () => void;
  onAddExternalNeighbor: () => void;
  onRefresh: () => void;
}

const NeighborManagementPane: React.FC<NeighborManagementPaneProps> = ({
  targetCount,
  onAddNeighbor,
  onAddExternalNeighbor,
  onRefresh
}) => {
  return (
    <DashboardPane
      title="BGP Neighbor Management"
      actions={
        <ButtonGroup>
          <Button
            className={buttonCss.buttonPrimary}
            onClick={onAddNeighbor}
          >
            Add Neighbor
          </Button>
          <Button
            className={buttonCss.buttonSecondary}
            onClick={onRefresh}
          >
            Refresh
          </Button>
        </ButtonGroup>
      }
    >
      {targetCount === 0 && (
        <Alert type="info" message="No BGP daemons are enabled. Please enable at least one daemon from the Environment Manager." />
      )}

      <div style={{ marginTop: '1rem' }}>
        <Button
          className={buttonCss.buttonPrimary}
          onClick={onAddExternalNeighbor}
          style={{ width: '100%' }}
        >
          Add External Neighbor
        </Button>
      </div>
    </DashboardPane>
  );
};

export default NeighborManagementPane;
