// Components
import { BaseDialog, DialogActions } from "../ui";

export default function ConfirmDeleteDialog({
  open,
  onClose,
  onConfirm,
  itemName,
}) {
  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    onConfirm();
  };

  const handleSave = () => {
    handleSubmit(undefined);
  };

  return (
    <BaseDialog open={open} onClose={onClose} className="popup">
      <form onSubmit={handleSubmit}>
        <h3>Confirm Delete</h3>
        <p>
          Are you sure you want to delete <strong>{itemName}</strong>?
        </p>
        <DialogActions
          onCancel={onClose}
          onSubmit={handleSave} // Form submission handled by onSubmit above
          cancelText="Cancel"
          submitText="Delete"
        />
      </form>
    </BaseDialog>
  );
}
