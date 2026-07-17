import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { trackPageView } from "./index";

// Mount this once inside <App> (inside <BrowserRouter>).
// It fires trackPageView on every route change automatically.
export default function PageViewTracker() {
  const { pathname } = useLocation();

  useEffect(() => {
    trackPageView(pathname);
  }, [pathname]);

  return null;
}
