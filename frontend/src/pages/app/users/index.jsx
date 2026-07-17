import { useState } from "react";
import { useSelector } from "react-redux";
import { LogOut, Trash2 } from "lucide-react";
import { selectCurrentUser } from "../../../store/slices/auth-slice";
import {
  useGetAllUsersQuery,
  useLogoutUserByIdMutation,
  useDeleteUserMutation,
} from "../../../store/api/features/userApi";
import { Table, Badge, IconButton, Pagination, ConfirmDialog, Spinner, toast } from "../../../components/ui";

const UsersListPage = () => {
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const currentUser = useSelector(selectCurrentUser);
  const isAdmin = currentUser?.role === "Admin";

  const { data, isFetching } = useGetAllUsersQuery({ page, limit });
  const [logoutUserById, { isLoading: isLoggingOut }] = useLogoutUserByIdMutation();
  const [deleteUser, { isLoading: isDeleting }] = useDeleteUserMutation();

  const users = data?.data?.users ?? [];
  const pagination = data?.data?.pagination ?? {};

  const handleForceLogout = async (user) => {
    try {
      await logoutUserById(user.id).unwrap();
      toast.success(`"${user.name}" has been signed out of all sessions.`);
    } catch (err) {
      toast.error(err?.data?.message || "Failed to force logout.");
    }
  };

  const handleDelete = async () => {
    try {
      await deleteUser(deleteTarget.id).unwrap();
      toast.success(`"${deleteTarget.name}" has been deleted.`);
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err?.data?.message || "Failed to delete user.");
    }
  };

  return (
    <div className="overflow-hidden rounded-md border border-border bg-canvas">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <h1 className="text-lg font-semibold text-ink">Users</h1>
        {pagination.total !== undefined && <p className="text-sm text-ink-faint">{pagination.total} total</p>}
      </div>

      <div className="p-5">
        {isFetching && users.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <Spinner size="lg" className="text-brand" />
          </div>
        ) : (
          <Table>
            <Table.Head>
              <Table.HeaderCell>Name</Table.HeaderCell>
              <Table.HeaderCell>Email</Table.HeaderCell>
              <Table.HeaderCell>Status</Table.HeaderCell>
              <Table.HeaderCell className="text-right">Actions</Table.HeaderCell>
            </Table.Head>
            <Table.Body>
              {users.map((user) => {
                // Compare by email, not id: GET /users/me (the only source of `user` after a
                // fresh page load) doesn't return an id at all, only /auth/login and /users
                // (this list) do.
                const isSelf = user.email === currentUser?.email;
                return (
                  <Table.Row key={user.id}>
                    <Table.Cell>{user.name}</Table.Cell>
                    <Table.Cell className="text-ink-soft">{user.email}</Table.Cell>
                    <Table.Cell>
                      <Badge variant={user.isLoggedIn ? "success" : "neutral"}>
                        {user.isLoggedIn ? "Logged in" : "Logged out"}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex justify-end gap-1">
                        <IconButton
                          icon={LogOut}
                          label="Force logout"
                          variant="secondary"
                          size="sm"
                          loading={isLoggingOut}
                          onClick={() => handleForceLogout(user)}
                        />
                        {isAdmin && (
                          <IconButton
                            icon={Trash2}
                            label="Delete"
                            variant="danger"
                            size="sm"
                            disabled={isSelf}
                            onClick={() => setDeleteTarget(user)}
                          />
                        )}
                      </div>
                    </Table.Cell>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table>
        )}

        <Pagination current={pagination.page || page} pageSize={pagination.limit || limit} total={pagination.total ?? 0} onChange={setPage} />
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={`Delete "${deleteTarget?.name}"?`}
        confirmText="Delete"
        danger
        loading={isDeleting}
      />
    </div>
  );
};

export default UsersListPage;
