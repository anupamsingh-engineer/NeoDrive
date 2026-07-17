import { useEffect, useRef, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { logoutUser, selectAuthState } from "../store/slices/auth-slice";
import { AUTH_CONFIG } from "../configs/apiConfig";

const IDLE_EVENTS = ["mousemove", "keydown", "mousedown", "touchstart", "scroll"];
const TIMEOUT_MS = AUTH_CONFIG.sessionTimeout * 60 * 1000;

// Logs out the user after TIMEOUT_MS of inactivity.
// Only active while the user is authenticated.
export const useIdleTimeout = () => {
  const dispatch = useDispatch();
  const { isAuthenticated } = useSelector(selectAuthState);
  const timerRef = useRef(null);

  const resetTimer = useCallback(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      dispatch(logoutUser());
    }, TIMEOUT_MS);
  }, [dispatch]);

  useEffect(() => {
    if (!isAuthenticated) {
      clearTimeout(timerRef.current);
      return;
    }

    resetTimer();
    IDLE_EVENTS.forEach((event) =>
      window.addEventListener(event, resetTimer, { passive: true }),
    );

    return () => {
      clearTimeout(timerRef.current);
      IDLE_EVENTS.forEach((event) =>
        window.removeEventListener(event, resetTimer),
      );
    };
  }, [isAuthenticated, resetTimer]);
};
