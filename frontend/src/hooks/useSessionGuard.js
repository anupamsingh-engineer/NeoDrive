import { useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "../components/ui/Toast";
import { useGetCurrentUserQuery } from "../store/api/features/userApi";
import { selectIsAuthenticated, logoutUser, setUser } from "../store/slices/auth-slice";

const POLL_INTERVAL = 60_000;

// Periodically re-fetches the current user while authenticated. baseQuery already retries
// once via /auth/refresh on a 401, so any error surfacing here means the session is genuinely
// no longer valid (e.g. the account was deleted, or logout-all was triggered elsewhere).
const useSessionGuard = () => {
  const dispatch = useDispatch();
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
      // Deliberately no navigate() here. logoutUser() is async - it awaits POST /auth/logout
      // over the network before it dispatches handleLogout(), the action that actually flips
      // isAuthenticated to false. Navigating immediately, before that flip has happened, used
      // to land on /auth/login while isAuthenticated was still true - AuthGuard's own "can't
      // revisit /auth/* while authenticated" rule then bounced straight back to /app/drive,
      // remounting this hook with a fresh hasLoggedOutRef, re-triggering the same failing
      // query, dispatching a second real logoutUser() call, navigating again, getting bounced
      // again - a real ping-pong that only stopped once one of the several in-flight
      // logoutUser() calls finally resolved. AuthGuard already redirects to /auth/login on its
      // own once isAuthenticated genuinely goes false - same pattern baseQuery.js's
      // forceLogout relies on - so there's nothing to do here beyond dispatching the thunk.
      dispatch(logoutUser());
      return;
    }

    if (data?.data) {
      dispatch(setUser(data.data));
    }
  }, [data, error, dispatch]);
};

export default useSessionGuard;
