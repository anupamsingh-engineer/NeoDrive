import NavLogo from "./header/NavLogo";
import NavActions from "./header/NavActions";

const PublicHeader = () => (
  <nav className="sticky top-0 z-50 w-full border-b border-border bg-canvas/90 backdrop-blur">
    <div className="mx-auto flex h-18 w-full max-w-360 items-center justify-between px-6">
      <NavLogo />
      <NavActions />
    </div>
  </nav>
);

export default PublicHeader;
