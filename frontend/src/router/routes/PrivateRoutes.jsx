import React, { Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import { useSelector } from "react-redux";
import { Navigate } from "react-router-dom";

import AppLayout from "../../components/layout/app/AppLayout";
import PageNotFound from "../../components/common/PageNotFound";
import FullScreenLoader from "../../components/ui/FullScreenLoader";
import { selectCurrentUser } from "../../store/slices/auth-slice";

const Drive = React.lazy(() => import("../../pages/app/drive"));
const Profile = React.lazy(() => import("../../pages/app/profile"));
const SharedLinks = React.lazy(() => import("../../pages/app/shared"));
const Subscriptions = React.lazy(() => import("../../pages/app/subscriptions"));
const UsersList = React.lazy(() => import("../../pages/app/users"));

// Admin and Manager can both view the Users screen; only Admin can delete (gated inside the page).
const RequireRole = ({ roles, children }) => {
  const user = useSelector(selectCurrentUser);
  if (!roles.includes(user?.role)) {
    return <Navigate to="/app/drive" replace />;
  }
  return children;
};

const AppPageRouter = () => {
  return (
    <Suspense fallback={<FullScreenLoader />}>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<Navigate to="drive" replace />} />
          <Route path="drive" element={<Drive />} />
          <Route path="drive/:dirId" element={<Drive />} />
          <Route path="profile" element={<Profile />} />
          <Route path="shared" element={<SharedLinks />} />
          <Route path="subscriptions" element={<Subscriptions />} />
          <Route
            path="users"
            element={
              <RequireRole roles={["Admin", "Manager"]}>
                <UsersList />
              </RequireRole>
            }
          />
          <Route path="*" element={<PageNotFound />} />
        </Route>
        <Route path="*" element={<PageNotFound />} />
      </Routes>
    </Suspense>
  );
};

export default AppPageRouter;
