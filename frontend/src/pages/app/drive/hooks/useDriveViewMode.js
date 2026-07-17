import { useState } from "react";

const STORAGE_KEY = "drive-view-mode";

const useDriveViewMode = () => {
  const [viewMode, setViewMode] = useState(() => localStorage.getItem(STORAGE_KEY) || "list");

  const handleViewModeChange = (value) => {
    setViewMode(value);
    localStorage.setItem(STORAGE_KEY, value);
  };

  return [viewMode, handleViewModeChange];
};

export default useDriveViewMode;
