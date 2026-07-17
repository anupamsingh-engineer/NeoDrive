import { useState } from "react";
import { Outlet } from "react-router-dom";
import AppHeader from "./AppHeader";
import AppSider from "./AppSider";
import AppFooter from "./AppFooter";
import useBreakpoint from "../../../hooks/useBreakpoint";
import useSessionGuard from "../../../hooks/useSessionGuard";
import Drawer from "../../ui/Drawer";
import PageTransition from "../../ui/PageTransition";

const AppLayout = () => {
  const { isMobileAndTablet } = useBreakpoint();
  const [drawerOpen, setDrawerOpen] = useState(false);
  useSessionGuard();

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader showMenuButton={isMobileAndTablet} onMenuClick={() => setDrawerOpen(true)} />
      <div className="flex flex-1">
        {!isMobileAndTablet && (
          <aside className="w-60 shrink-0 border-r border-border bg-canvas">
            <AppSider />
          </aside>
        )}

        {isMobileAndTablet && (
          <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Menu" width={260}>
            <AppSider onNavigate={() => setDrawerOpen(false)} />
          </Drawer>
        )}

        <div className="flex flex-1 flex-col">
          <main className="flex flex-1 flex-col p-6">
            <PageTransition>
              <Outlet />
            </PageTransition>
          </main>
          <AppFooter />
        </div>
      </div>
    </div>
  );
};

export default AppLayout;
