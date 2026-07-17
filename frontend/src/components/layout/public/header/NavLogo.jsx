import { useNavigate } from "react-router-dom";
import { Cloud } from "lucide-react";
import { APP_CONFIG } from "../../../../configs/apiConfig";

const NavLogo = () => {
  const navigate = useNavigate();

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => navigate("/")}
      onKeyDown={(e) => e.key === "Enter" && navigate("/")}
      className="flex cursor-pointer items-center gap-2"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-sm bg-brand text-white">
        <Cloud className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="text-lg font-semibold text-ink">{APP_CONFIG.appName}</span>
    </div>
  );
};

export default NavLogo;
