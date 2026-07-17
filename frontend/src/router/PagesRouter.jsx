import { Route, Routes } from "react-router-dom";

import AppPageRouter from "./routes/PrivateRoutes";
import PublicPageRouter from "./routes/PublicRoutes";

const PagesRouter = () => {
  return (
    <Routes>
      <Route path="/app/*" element={<AppPageRouter />} />
      <Route path="/*" element={<PublicPageRouter />} />
    </Routes>
  );
};

export default PagesRouter;
