import Spinner from "../Spinner";

const FullScreenLoader = ({ label = "Loading" }) => (
  <div role="status" aria-live="polite" aria-label={label} className="flex h-screen w-full items-center justify-center bg-canvas">
    <Spinner size="lg" className="text-brand" />
  </div>
);

export default FullScreenLoader;
