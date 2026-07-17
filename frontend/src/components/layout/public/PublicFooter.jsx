import { APP_CONFIG } from "../../../configs/apiConfig";

const PublicFooter = () => (
  <footer className="border-t border-border bg-canvas px-6 py-5 text-center">
    <p className="text-sm text-ink-faint">
      © {new Date().getFullYear()} {APP_CONFIG.appName}. All rights reserved.
    </p>
  </footer>
);

export default PublicFooter;
