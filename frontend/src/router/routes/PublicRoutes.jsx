import React, { Suspense } from "react";
import { Route, Routes } from "react-router-dom";

import PublicLayout from "../../components/layout/public/PublicLayout";
import PageNotFound from "../../components/common/PageNotFound";
import FullScreenLoader from "../../components/ui/FullScreenLoader";
import { lazyWithRetry } from "../../utils/lazyWithRetry";

const Login = lazyWithRetry(() => import("../../pages/public/Login"), "public-login");
const Register = lazyWithRetry(() => import("../../pages/public/Register"), "public-register");
const ForgotPassword = lazyWithRetry(() => import("../../pages/public/ForgotPassword"), "public-forgot-password");
const ResetPassword = lazyWithRetry(() => import("../../pages/public/ResetPassword"), "public-reset-password");
const Home = lazyWithRetry(() => import("../../pages/public/Home"), "public-home");
const ShareView = lazyWithRetry(() => import("../../pages/public/ShareView"), "public-share-view");

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
        {/* Chromeless - deliberately outside PublicLayout, works for both anonymous and
            logged-in visitors since AuthGuard only special-cases /app and /auth. */}
        <Route path="s/:token" element={<ShareView />} />
        <Route path="*" element={<PageNotFound />} />
      </Routes>
    </Suspense>
  );
};

export default PublicPageRouter;
