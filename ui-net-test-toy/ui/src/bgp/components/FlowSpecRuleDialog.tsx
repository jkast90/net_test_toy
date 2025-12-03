import React from 'react';
import BaseDialog from '../../_common/components/ui/BaseDialog';
import FlowSpecRuleForm from './FlowSpecRuleForm';

interface FlowSpecRuleDialogProps {
  open: boolean;
  onClose: () => void;
}

const FlowSpecRuleDialog: React.FC<FlowSpecRuleDialogProps> = ({ open, onClose }) => {
  return (
    <BaseDialog open={open} onClose={onClose}>
      <FlowSpecRuleForm
        onSuccess={onClose}
        onCancel={onClose}
      />
    </BaseDialog>
  );
};

export default FlowSpecRuleDialog;
