import { useState } from "react";
import { Folder, Copy, Check, ExternalLink, Link2Off } from "lucide-react";
import { useListSharesQuery, useRevokeShareMutation } from "../../../store/api/features/shareApi";
import { Table, IconButton, ConfirmDialog, Spinner, EmptyState, FileTypeIcon, toast } from "../../../components/ui";

const SharedLinksPage = () => {
  const { data, isLoading } = useListSharesQuery();
  const [revokeShare, { isLoading: isRevoking }] = useRevokeShareMutation();
  const [revoking, setRevoking] = useState(null); // the share pending a revoke confirmation
  const [copiedId, setCopiedId] = useState(null);

  const shares = data?.data ?? [];

  const handleCopy = async (share) => {
    await navigator.clipboard.writeText(share.url);
    setCopiedId(share.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleConfirmRevoke = async () => {
    try {
      await revokeShare(revoking.id).unwrap();
      toast.success("Link sharing turned off");
      setRevoking(null);
    } catch (err) {
      toast.error(err?.data?.message || "Failed to turn off link sharing");
    }
  };

  return (
    <div className="overflow-hidden rounded-md border border-border bg-canvas">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <h1 className="text-lg font-semibold text-ink">Shared Links</h1>
        {shares.length > 0 && <p className="text-sm text-ink-faint">{shares.length} active</p>}
      </div>

      <div className="p-5">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner size="lg" className="text-brand" />
          </div>
        ) : shares.length === 0 ? (
          <EmptyState
            icon={Link2Off}
            title="No active shared links"
            description="Share a file or folder from your Drive to see it here."
          />
        ) : (
          <Table>
            <Table.Head>
              <Table.HeaderCell>Name</Table.HeaderCell>
              <Table.HeaderCell>Shared</Table.HeaderCell>
              <Table.HeaderCell className="text-right">Actions</Table.HeaderCell>
            </Table.Head>
            <Table.Body>
              {shares.map((share) => (
                <Table.Row key={share.id}>
                  <Table.Cell>
                    <div className="flex items-center gap-2.5">
                      {share.resourceType === "directory" ? (
                        <Folder className="h-5 w-5 text-brand" aria-hidden="true" />
                      ) : (
                        <FileTypeIcon extension={share.resourceExtension} className="h-5 w-5 text-ink-faint" />
                      )}
                      <span className="text-sm text-ink">{share.resourceName ?? "(deleted)"}</span>
                    </div>
                  </Table.Cell>
                  <Table.Cell className="text-ink-soft">{new Date(share.createdAt).toLocaleString()}</Table.Cell>
                  <Table.Cell>
                    <div className="flex justify-end gap-1">
                      <IconButton
                        icon={copiedId === share.id ? Check : Copy}
                        label="Copy link"
                        variant="secondary"
                        size="sm"
                        onClick={() => handleCopy(share)}
                      />
                      <IconButton
                        icon={ExternalLink}
                        label="Open link"
                        variant="secondary"
                        size="sm"
                        onClick={() => window.open(share.url, "_blank", "noopener,noreferrer")}
                      />
                      <IconButton
                        icon={Link2Off}
                        label="Turn off link"
                        variant="danger"
                        size="sm"
                        onClick={() => setRevoking(share)}
                      />
                    </div>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        )}
      </div>

      <ConfirmDialog
        open={!!revoking}
        onClose={() => setRevoking(null)}
        onConfirm={handleConfirmRevoke}
        title={`Turn off link for "${revoking?.resourceName}"?`}
        description="Anyone with this link will no longer be able to view it."
        confirmText="Turn off link"
        danger
        loading={isRevoking}
      />
    </div>
  );
};

export default SharedLinksPage;
