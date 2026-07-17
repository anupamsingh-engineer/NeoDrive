import { useSelector } from "react-redux";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Folder, User, Crown, Users } from "lucide-react";
import { selectCurrentUser } from "../../../store/slices/auth-slice";

const NAV_ITEMS = [
  { key: "/app/drive", icon: Folder, label: "My Drive" },
  { key: "/app/profile", icon: User, label: "Profile" },
  { key: "/app/subscriptions", icon: Crown, label: "Upgrade Storage" },
  { key: "/app/users", icon: Users, label: "Users", roles: ["Admin", "Manager"] },
];

const AppSider = ({ onNavigate }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useSelector(selectCurrentUser);

  const items = NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(user?.role));
  const selectedKey = NAV_ITEMS.find((item) => location.pathname.startsWith(item.key))?.key ?? "/app/drive";

  const handleClick = (key) => {
    navigate(key);
    onNavigate?.();
  };

  return (
    <nav className="flex h-full flex-col gap-0.5 p-3">
      {items.map((item) => {
        const active = item.key === selectedKey;
        const Icon = item.icon;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => handleClick(item.key)}
            className={`relative flex items-center gap-3 rounded-sm px-3 py-2.5 text-sm font-medium transition-colors ${
              active ? "text-brand" : "text-ink-soft hover:bg-surface hover:text-ink"
            }`}
          >
            {active && (
              <motion.span
                layoutId="app-nav-active"
                className="absolute inset-0 rounded-sm bg-brand-tint"
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
              />
            )}
            <Icon className="relative z-10 h-5 w-5 shrink-0" aria-hidden="true" />
            <span className="relative z-10">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};

export default AppSider;
