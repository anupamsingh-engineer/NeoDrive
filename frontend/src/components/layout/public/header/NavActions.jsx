import { useLocation, useNavigate } from "react-router-dom";
import Button from "../../../ui/Button";

const NavActions = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const onLogin = location.pathname === "/auth/login";
  const onRegister = location.pathname === "/auth/register";

  return (
    <div className="flex shrink-0 items-center gap-2">
      {!onLogin && (
        <Button variant="ghost" size="sm" onClick={() => navigate("/auth/login")}>
          Login
        </Button>
      )}
      {!onRegister && (
        <Button variant="primary" size="sm" onClick={() => navigate("/auth/register")}>
          Sign Up
        </Button>
      )}
    </div>
  );
};

export default NavActions;
