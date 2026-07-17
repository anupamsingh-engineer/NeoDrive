import React, { useEffect } from "react";
import { useDispatch } from "react-redux";
import { Route, Routes } from "react-router-dom";
import { MotionConfig } from "framer-motion";

import PagesRouter from "./router/PagesRouter";
import { bootstrapAuth } from "./store/slices/auth-slice";
import AuthGuard from "./components/common/Guard";
import ErrorBoundary from "./components/common/ErrorBoundary";
import PageViewTracker from "./analytics/PageViewTracker";
import { useIdleTimeout } from "./hooks/useIdleTimeout";
import { Toaster } from "./components/ui/Toast";

const App = () => {
  const dispatch = useDispatch();
  useIdleTimeout();

  useEffect(() => {
    // PersistGate has already rehydrated the store by the time App mounts. httpOnly cookies
    // can't be inspected client-side, so GET /users/me is the only way to know whether a
    // session is actually still valid.
    dispatch(bootstrapAuth());
  }, [dispatch]);

  return (
    <MotionConfig reducedMotion="user">
      <ErrorBoundary>
        <PageViewTracker />
        <Toaster />
        <Routes>
          <Route
            path="/*"
            element={
              <AuthGuard>
                <PagesRouter />
              </AuthGuard>
            }
          />
        </Routes>
      </ErrorBoundary>
    </MotionConfig>
  );
};

export default App;
