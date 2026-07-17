import { useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { toast } from "../components/ui/Toast";
import { useGetCurrentUserQuery } from "../store/api/features/userApi";
import { selectIsAuthenticated, logoutUser, setUser } from "../store/slices/auth-slice";

const POLL_INTERVAL = 60_000;

// Periodically re-fetches the current user while authenticated. baseQuery already retries
// once via /auth/refresh on a 401, so any error surfacing here means the session is genuinely
// no longer valid (e.g. the account was deleted, or logout-all was triggered elsewhere).
const useSessionGuard = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const hasLoggedOutRef = useRef(false);

  const { data, error } = useGetCurrentUserQuery(undefined, {
    skip: !isAuthenticated,
    pollingInterval: POLL_INTERVAL,
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });

  useEffect(() => {
    if (hasLoggedOutRef.current) return;

    if (error) {
      hasLoggedOutRef.current = true;
      toast.warning("Your session is no longer valid. You have been signed out.");
      dispatch(logoutUser());
      navigate("/auth/login", { replace: true });
      return;
    }

    if (data?.data) {
      dispatch(setUser(data.data));
    }
  }, [data, error, dispatch, navigate]);
};

export default useSessionGuard;
