import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Modal, Button, Input, toast } from "../../../../components/ui";
import { useCreateShareMutation, useRevokeShareMutation } from "../../../../store/api/features/shareApi";

const ShareModal = ({ open, onClose, item }) => {
  const [createShare, { isLoading: isCreating }] = useCreateShareMutation();
  const [revokeShare, { isLoading: isRevoking }] = useRevokeShareMutation();
  const [share, setShare] = useState(null);
  const [copied, setCopied] = useState(false);

  // Idempotent on the backend: reopening the modal for the same item always resolves to the
  // same live link instead of minting a new one every time.
  useEffect(() => {
    if (!open || !item) {
      setShare(null);
      setCopied(false);
      return;
    }

    createShare({ resourceType: item.type, resourceId: item.id })
      .unwrap()
      .then((res) => setShare(res.data))
      .catch((err) => {
        toast.error(err?.data?.message || "Failed to create share link");
        onClose();
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item]);

  const handleCopy = async () => {
    if (!share) return;
    await navigator.clipboard.writeText(share.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRevoke = async () => {
    if (!share) return;
    try {
      await revokeShare(share.id).unwrap();
      toast.success("Link sharing turned off");
      onClose();
    } catch (err) {
      toast.error(err?.data?.message || "Failed to turn off link sharing");
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Share "${item?.name}"`} size="sm">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ink-soft">
          Anyone with this link can view {item?.type === "directory" ? "this folder" : "this file"} — no account
          needed.
        </p>

        <div className="flex items-center gap-2">
          <Input value={isCreating || !share ? "Generating link…" : share.url} readOnly className="text-xs" />
          <Button
            type="button"
            variant="secondary"
            icon={copied ? Check : Copy}
            disabled={isCreating || !share}
            onClick={handleCopy}
          >
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Done
          </Button>
          <Button type="button" variant="danger" disabled={!share} loading={isRevoking} onClick={handleRevoke}>
            Turn off link
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ShareModal;
