import React from 'react';
import { Button, DashboardPane, EmptyState } from '../../../_common/components';
import buttonCss from '../../../_common/styles/Button.module.css';
import dialogCss from '../../../_common/styles/Dialog.module.css';
import BaseDialog from '../../../_common/components/ui/BaseDialog';
import { TriggerForm, TriggerCard } from '../FlowRules';
import { PROTOCOL_NAMES } from '../../../_common/utils/networkUtils';
import type { Trigger } from '../../../_common/types/netflow';

interface NetFlowTriggersPaneProps {
  triggers: Trigger[];
  loading: boolean;
  deletingTriggerId: string | null;
  // Dialog state
  isCreateOpen: boolean;
  isEditOpen: boolean;
  editingTrigger: Trigger | null;
  onOpenCreate: () => void;
  onCloseDialog: () => void;
  // Form state
  formState: any;
  setFormState: (state: any) => void;
  // Actions
  onSubmit: () => void;
  onEdit: (trigger: Trigger) => void;
  onDelete: (trigger: Trigger) => void;
  onToggleEnabled: (trigger: Trigger) => void;
}

const NetFlowTriggersPane: React.FC<NetFlowTriggersPaneProps> = ({
  triggers,
  loading,
  deletingTriggerId,
  isCreateOpen,
  isEditOpen,
  editingTrigger,
  onOpenCreate,
  onCloseDialog,
  formState,
  setFormState,
  onSubmit,
  onEdit,
  onDelete,
  onToggleEnabled
}) => {
  return (
    <DashboardPane
      title={`NetFlow Triggers (${triggers.length})`}
      loading={loading}
      actions={
        <Button
          className={buttonCss.buttonPrimary}
          onClick={onOpenCreate}
        >
          Create Trigger
        </Button>
      }
    >
      {(isCreateOpen || isEditOpen) && (
        <BaseDialog
          open={isCreateOpen || isEditOpen}
          onClose={onCloseDialog}
          className={dialogCss.narrowDialog}
        >
          <TriggerForm
            initialData={{
              name: formState.name,
              enabled: formState.enabled,
              conditions: {
                min_kbps: formState.minKbps ? parseFloat(formState.minKbps) : undefined,
                min_mbps: formState.minMbps ? parseFloat(formState.minMbps) : undefined,
                min_pps: formState.minPps ? parseFloat(formState.minPps) : undefined,
                min_bytes: formState.minBytes ? parseInt(formState.minBytes) : undefined,
                src_addr: formState.srcAddr || undefined,
                dst_addr: formState.dstAddr || undefined,
                src_or_dst_addr: formState.srcOrDstAddr || undefined,
                protocol: formState.protocol ? parseInt(formState.protocol) : undefined
              },
              action: {
                type: formState.actionType || 'log',
                message: formState.actionMessage || undefined,
                rate_limit_kbps: formState.rateLimitKbps ? parseFloat(formState.rateLimitKbps) : undefined
              }
            }}
            onChange={(updates) => {
              setFormState((prev: any) => ({
                ...prev,
                name: updates.name ?? prev.name,
                enabled: updates.enabled ?? prev.enabled,
                minKbps: updates.conditions?.min_kbps?.toString() ?? prev.minKbps,
                minMbps: updates.conditions?.min_mbps?.toString() ?? prev.minMbps,
                minPps: updates.conditions?.min_pps?.toString() ?? prev.minPps,
                minBytes: updates.conditions?.min_bytes?.toString() ?? prev.minBytes,
                srcAddr: updates.conditions?.src_addr ?? prev.srcAddr,
                dstAddr: updates.conditions?.dst_addr ?? prev.dstAddr,
                srcOrDstAddr: updates.conditions?.src_or_dst_addr ?? prev.srcOrDstAddr,
                protocol: updates.conditions?.protocol?.toString() ?? prev.protocol,
                actionType: updates.action?.type ?? prev.actionType,
                actionMessage: updates.action?.message ?? prev.actionMessage,
                rateLimitKbps: updates.action?.rate_limit_kbps?.toString() ?? prev.rateLimitKbps
              }));
            }}
            onSubmit={onSubmit}
            onCancel={onCloseDialog}
            isEditing={!!editingTrigger}
          />
        </BaseDialog>
      )}

      {triggers.length === 0 ? (
        <EmptyState message="No triggers configured. Create your first trigger to get started." />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
          {triggers.map((trigger) => (
            <TriggerCard
              key={trigger.id}
              trigger={trigger}
              onEdit={onEdit}
              onDelete={onDelete}
              onToggleEnabled={onToggleEnabled}
              protocolNames={PROTOCOL_NAMES}
            />
          ))}
        </div>
      )}
    </DashboardPane>
  );
};

export default NetFlowTriggersPane;
