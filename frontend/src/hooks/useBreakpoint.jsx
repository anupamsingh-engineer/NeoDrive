import { useState, useEffect } from "react";

export const BREAKPOINTS = {
  xs: 0, // Extra Small Devices
  sm: 576, // Small Devices
  md: 768, // Medium Devices
  lg: 992, // Large Devices
  xl: 1200, // Extra Large Devices
  xxl: 1600, // Extra Extra Large Devices
};

const useBreakpoint = () => {
  const [breakpoint, setBreakpoint] = useState(getBreakpoint());

  function getBreakpoint() {
    const width = window.innerWidth;
    if (width < BREAKPOINTS.sm) return "xs";
    if (width < BREAKPOINTS.md) return "sm";
    if (width < BREAKPOINTS.lg) return "md";
    if (width < BREAKPOINTS.xl) return "lg";
    return "xl";
  }

  useEffect(() => {
    const handleResize = () => setBreakpoint(getBreakpoint());
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const isExtraSmall = breakpoint === "xs";
  const isMobile = breakpoint === "xs" || breakpoint === "sm";
  const isTablet = breakpoint === "md";
  const isDesktop = breakpoint === "lg";
  const isExtraLarge = breakpoint === "xl";

  const isMobileAndTablet = isMobile || isTablet;

  return {
    breakpoint,
    isMobile,
    isTablet,
    isDesktop,
    isExtraLarge,
    isMobileAndTablet,
    isExtraSmall,
  };
};

export default useBreakpoint;
