import React from 'react';
import BaseDialog from '../../_common/components/ui/BaseDialog';
import NeighborConfigForm from './NeighborConfigForm';

interface NeighborConfigDialogProps {
  open: boolean;
  onClose: () => void;
}

const NeighborConfigDialog: React.FC<NeighborConfigDialogProps> = ({ open, onClose }) => {
  return (
    <BaseDialog open={open} onClose={onClose}>
      <NeighborConfigForm
        onSuccess={onClose}
        onCancel={onClose}
      />
    </BaseDialog>
  );
};

export default NeighborConfigDialog;
