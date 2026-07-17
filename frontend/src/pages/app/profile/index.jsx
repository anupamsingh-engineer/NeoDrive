import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { Crown, LogOut } from "lucide-react";
import { useGetCurrentUserQuery } from "../../../store/api/features/userApi";
import { logoutUser, logoutAllUser } from "../../../store/slices/auth-slice";
import { formatBytes } from "../../../utils/utils";
import { Avatar, Badge, Button, Card, ProgressBar, Spinner } from "../../../components/ui";

const ROLE_VARIANT = { Admin: "danger", Manager: "brand" };

const ProfilePage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { data, isLoading } = useGetCurrentUserQuery();
  const user = data?.data;

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center py-24">
        <Spinner size="lg" className="text-brand" />
      </div>
    );
  }

  const percentUsed = user
    ? Math.min(100, Math.round((user.usedStorageInBytes / user.maxStorageInBytes) * 100))
    : 0;

  return (
    <div className="flex max-w-xl flex-col gap-5">
      <h1 className="text-2xl font-semibold text-ink">Profile</h1>

      <Card>
        <div className="mb-6 flex items-center gap-4">
          <Avatar src={user?.picture} name={user?.name} size="xl" />
          <div>
            <p className="text-lg font-semibold text-ink">{user?.name}</p>
            <p className="text-sm text-ink-soft">{user?.email}</p>
            <Badge variant={ROLE_VARIANT[user?.role] ?? "neutral"} className="mt-1.5">
              {user?.role}
            </Badge>
          </div>
        </div>

        <p className="mb-2 text-sm font-medium text-ink">Storage used</p>
        <ProgressBar percent={percentUsed} />
        <p className="mt-2 text-sm text-ink-soft">
          {formatBytes(user?.usedStorageInBytes)} of {formatBytes(user?.maxStorageInBytes)} used
        </p>

        <Button variant="secondary" icon={Crown} className="mt-4" onClick={() => navigate("/app/subscriptions")}>
          Upgrade Storage
        </Button>
      </Card>

      <Card>
        <p className="mb-4 text-sm font-semibold text-ink">Session</p>
        <div className="flex flex-col gap-2">
          <Button variant="secondary" icon={LogOut} block onClick={() => dispatch(logoutUser())}>
            Sign Out
          </Button>
          <Button variant="danger" icon={LogOut} block onClick={() => dispatch(logoutAllUser())}>
            Sign Out Everywhere
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default ProfilePage;
