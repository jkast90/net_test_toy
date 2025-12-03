import React from 'react';
import BaseDialog from '../../_common/components/ui/BaseDialog';
import RouteAdvertisementForm from './RouteAdvertisementForm';

interface RouteAdvertisementDialogProps {
  open: boolean;
  onClose: () => void;
}

const RouteAdvertisementDialog: React.FC<RouteAdvertisementDialogProps> = ({ open, onClose }) => {
  return (
    <BaseDialog open={open} onClose={onClose}>
      <RouteAdvertisementForm
        onSuccess={onClose}
        onCancel={onClose}
      />
    </BaseDialog>
  );
};

export default RouteAdvertisementDialog;
