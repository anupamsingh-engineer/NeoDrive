import Modal from "../Modal";
import Button from "../Button";

const ConfirmDialog = ({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  danger = false,
  loading = false,
}) => (
  <Modal
    open={open}
    onClose={onClose}
    title={title}
    size="sm"
    footer={
      <>
        <Button variant="secondary" onClick={onClose} disabled={loading}>
          {cancelText}
        </Button>
        <Button variant={danger ? "danger" : "primary"} onClick={onConfirm} loading={loading}>
          {confirmText}
        </Button>
      </>
    }
  >
    {description && <p className="text-sm text-ink-soft">{description}</p>}
  </Modal>
);

export default ConfirmDialog;
