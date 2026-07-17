import React from "react";
import { useSelector } from "react-redux";
import { selectAuthState } from "../../../store/slices/auth-slice";
import { Navigate, useLocation } from "react-router-dom";
import FullScreenLoader from "../../ui/FullScreenLoader";

const AuthGuard = ({ children }) => {
  const { isAuthenticated, isAuthLoading } = useSelector(selectAuthState);
  const location = useLocation();
  const currentPath = location.pathname;

  if (isAuthLoading) {
    return <FullScreenLoader label="Authenticating, please wait" />;
  }

  if (!isAuthenticated && currentPath.startsWith("/app")) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }

  if (isAuthenticated && currentPath.startsWith("/auth")) {
    return <Navigate to="/app/drive" replace />;
  }

  if (currentPath === "/" && isAuthenticated) {
    return <Navigate to="/app/drive" replace />;
  }

  return children;
};

export default AuthGuard;
