import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import { BrowserRouter } from "react-router-dom";

import "./index.css";
import App from "./App.jsx";
import store, { persistor } from "./store/index.js";
import { initAnalytics } from "./analytics/index.js";
import FullScreenLoader from "./components/ui/FullScreenLoader";

// Auth cookies are SameSite=Lax in dev, so a session started on "localhost" silently drops
// them if the tab is ever on "127.0.0.1" instead (browsers treat these as different sites) -
// self-correct here rather than relying on always typing the right host.
if (window.location.hostname === "127.0.0.1") {
  window.location.replace(window.location.href.replace("127.0.0.1", "localhost"));
} else {
  initAnalytics();

  const PersistLoading = <FullScreenLoader label="Loading application, please wait" />;

  createRoot(document.getElementById("root")).render(
    <BrowserRouter>
      <Provider store={store}>
        <PersistGate loading={PersistLoading} persistor={persistor}>
          <App />
        </PersistGate>
      </Provider>
    </BrowserRouter>
  );
}
