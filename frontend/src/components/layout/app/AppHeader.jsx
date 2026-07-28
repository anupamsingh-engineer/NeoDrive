import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { Menu, User, LogOut, ChevronDown } from "lucide-react";
import { selectCurrentUser, logoutUser } from "../../../store/slices/auth-slice";
import { APP_CONFIG } from "../../../configs/apiConfig";
import useBreakpoint from "../../../hooks/useBreakpoint";
import Avatar from "../../ui/Avatar";
import Dropdown from "../../ui/Dropdown";
import IconButton from "../../ui/IconButton";

const AppHeader = ({ onMenuClick, showMenuButton }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useSelector(selectCurrentUser);
  const { isMobile } = useBreakpoint();
  // Same bug class already fixed on the Profile page's Sign Out buttons (logoutUser() is a
  // plain thunk, not an RTK Query mutation, so nothing disables this automatically): a click
  // with no visible feedback reads as "didn't work", inviting another click — each one firing
  // its own POST /auth/logout and racing through baseQuery's reauth logic independently.
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = () => {
    if (signingOut) return;
    setSigningOut(true);
    dispatch(logoutUser());
  };

  const menuItems = [
    { key: "profile", icon: User, label: "Profile", onClick: () => navigate("/app/profile") },
    { divider: true },
    {
      key: "logout",
      icon: LogOut,
      label: signingOut ? "Signing out…" : "Sign Out",
      danger: true,
      disabled: signingOut,
      onClick: handleSignOut,
    },
  ];

  return (
    <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center justify-between border-b border-border bg-canvas px-4">
      <div className="flex items-center gap-3">
        {showMenuButton && <IconButton icon={Menu} label="Open navigation menu" onClick={onMenuClick} />}
        <span className="text-lg font-semibold text-ink">{APP_CONFIG.appName}</span>
      </div>

      <Dropdown
        align="right"
        trigger={
          <div className="flex cursor-pointer items-center gap-2 rounded-sm p-1 pr-2 transition-colors hover:bg-surface">
            <Avatar src={user?.picture} name={user?.name} size="sm" />
            {!isMobile && <span className="max-w-40 truncate text-sm font-medium text-ink">{user?.name}</span>}
            <ChevronDown className="h-3.5 w-3.5 text-ink-faint" aria-hidden="true" />
          </div>
        }
        items={menuItems}
      />
    </header>
  );
};

export default AppHeader;
