import React from 'react';
import { Alert } from '../../../_common/components';
import TargetSelector from '../../../_common/components/TargetSelector';

interface BGPNeighborManagementPaneProps {
  onAddSession: () => void;
  showEmptyAlert?: boolean;
}

const BGPNeighborManagementPane: React.FC<BGPNeighborManagementPaneProps> = ({
  onAddSession,
  showEmptyAlert = false
}) => {
  return (
    <>
      <TargetSelector label="View Neighbors From:" showDaemonFilter />
      {showEmptyAlert && (
        <Alert type="info" message="No clients selected. Use the selector above to choose which clients to view." />
      )}
    </>
  );
};

export default BGPNeighborManagementPane;
