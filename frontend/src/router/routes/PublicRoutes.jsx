import React, { Suspense } from "react";
import { Route, Routes } from "react-router-dom";

import PublicLayout from "../../components/layout/public/PublicLayout";
import PageNotFound from "../../components/common/PageNotFound";
import FullScreenLoader from "../../components/ui/FullScreenLoader";

const Login = React.lazy(() => import("../../pages/public/Login"));
const Register = React.lazy(() => import("../../pages/public/Register"));
const ForgotPassword = React.lazy(() => import("../../pages/public/ForgotPassword"));
const ResetPassword = React.lazy(() => import("../../pages/public/ResetPassword"));
const Home = React.lazy(() => import("../../pages/public/Home"));

const PublicPageRouter = () => {
  return (
    <Suspense fallback={<FullScreenLoader />}>
      <Routes>
        <Route path="/" element={<PublicLayout />}>
          <Route index element={<Home />} />
          <Route path="home" element={<Home />} />
          <Route path="auth/login" element={<Login />} />
          <Route path="auth/register" element={<Register />} />
          <Route path="auth/forgot-password" element={<ForgotPassword />} />
          <Route path="auth/reset-password" element={<ResetPassword />} />
        </Route>
        <Route path="*" element={<PageNotFound />} />
      </Routes>
    </Suspense>
  );
};

export default PublicPageRouter;
