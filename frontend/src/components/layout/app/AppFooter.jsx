import { APP_CONFIG } from "../../../configs/apiConfig";

const AppFooter = () => (
  <footer className="px-6 py-4 text-center">
    <p className="text-xs text-ink-faint">
      © {new Date().getFullYear()} {APP_CONFIG.appName}. All rights reserved.
    </p>
  </footer>
);

export default AppFooter;
