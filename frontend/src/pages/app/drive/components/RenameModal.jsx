import { useEffect, useState } from "react";
import { Modal, Button, Input } from "../../../../components/ui";

const RenameModal = ({ open, onClose, initialName, onRename, loading }) => {
  const [name, setName] = useState("");

  useEffect(() => {
    if (open) setName(initialName ?? "");
  }, [open, initialName]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onRename(name.trim());
  };

  return (
    <Modal open={open} onClose={onClose} title={`Rename "${initialName}"`} size="sm">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={loading}>
            Save
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default RenameModal;
