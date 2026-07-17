import { useEffect, useState } from "react";
import { Modal, Button, Input } from "../../../../components/ui";

const NewFolderModal = ({ open, onClose, onCreate, loading }) => {
  const [name, setName] = useState("");

  useEffect(() => {
    if (open) setName("");
  }, [open]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate(name.trim());
  };

  return (
    <Modal open={open} onClose={onClose} title="New Folder" size="sm">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input placeholder="Folder name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={loading}>
            Create
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default NewFolderModal;
