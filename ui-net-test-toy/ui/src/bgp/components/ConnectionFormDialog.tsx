import React from 'react';
import BaseDialog from '../../_common/components/ui/BaseDialog';
import styles from './ConnectionFormDialog.module.css';

interface ConnectionFormDialogProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

const ConnectionFormDialog: React.FC<ConnectionFormDialogProps> = ({
  open,
  onClose,
  children
}) => {
  return (
    <BaseDialog open={open} onClose={onClose} data-testid="connection-form-dialog">
      <div className={styles.connectionFormWrapper}>
        {children}
      </div>
    </BaseDialog>
  );
};

export default ConnectionFormDialog;
