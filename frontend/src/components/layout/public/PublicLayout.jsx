import { Outlet } from "react-router-dom";
import PublicHeader from "./PublicHeader";
import PublicFooter from "./PublicFooter";
import PageTransition from "../../ui/PageTransition";

const PublicLayout = () => (
  <div className="flex min-h-screen flex-col">
    <PublicHeader />
    <div className="flex flex-1 flex-col">
      <PageTransition>
        <Outlet />
      </PageTransition>
    </div>
    <PublicFooter />
  </div>
);

export default PublicLayout;
