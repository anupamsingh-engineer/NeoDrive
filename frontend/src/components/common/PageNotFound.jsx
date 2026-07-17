import { useNavigate } from "react-router-dom";
import { Compass } from "lucide-react";
import Button from "../ui/Button";

const PageNotFound = () => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface">
        <Compass className="h-6 w-6 text-ink-faint" aria-hidden="true" />
      </div>
      <div>
        <h1 className="text-2xl font-semibold text-ink">404</h1>
        <p className="mt-1 text-sm text-ink-soft">Sorry, the page you visited does not exist.</p>
      </div>
      <Button variant="primary" onClick={() => navigate("/")}>
        Back to Home
      </Button>
    </div>
  );
};

export default PageNotFound;
