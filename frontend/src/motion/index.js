export const durations = {
  fast: 0.12,
  base: 0.2,
  slow: 0.32,
};

export const easings = {
  expoOut: [0.16, 1, 0.3, 1],
  easeInOut: [0.4, 0, 0.2, 1],
  spring: { type: "spring", stiffness: 400, damping: 30 },
  springSoft: { type: "spring", stiffness: 300, damping: 28 },
};

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: durations.base, ease: easings.expoOut } },
  exit: { opacity: 0, transition: { duration: durations.fast, ease: easings.expoOut } },
};

export const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: durations.base, ease: easings.expoOut } },
  exit: { opacity: 0, y: 8, transition: { duration: durations.fast, ease: easings.expoOut } },
};

export const fadeScale = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1, transition: { duration: durations.base, ease: easings.expoOut } },
  exit: { opacity: 0, scale: 0.97, transition: { duration: durations.fast, ease: easings.expoOut } },
};

export const staggerContainer = (staggerChildren = 0.04, delayChildren = 0) => ({
  initial: "initial",
  animate: "animate",
  exit: "exit",
  variants: {
    initial: {},
    animate: { transition: { staggerChildren, delayChildren } },
    exit: { transition: { staggerChildren: staggerChildren / 2, staggerDirection: -1 } },
  },
});

export const listItem = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: durations.base, ease: easings.expoOut } },
  exit: { opacity: 0, y: -6, transition: { duration: durations.fast, ease: easings.expoOut } },
};

export const backdrop = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: durations.base } },
  exit: { opacity: 0, transition: { duration: durations.fast } },
};

export const modalPanel = {
  initial: { opacity: 0, scale: 0.95, y: 8 },
  animate: { opacity: 1, scale: 1, y: 0, transition: { duration: durations.base, ease: easings.expoOut } },
  exit: { opacity: 0, scale: 0.96, y: 4, transition: { duration: durations.fast, ease: easings.expoOut } },
};

export const drawerPanel = {
  initial: { x: "-100%" },
  animate: { x: 0, transition: easings.spring },
  exit: { x: "-100%", transition: { duration: durations.base, ease: easings.easeInOut } },
};

export const toastVariant = {
  initial: { opacity: 0, y: -12, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1, transition: easings.springSoft },
  exit: { opacity: 0, x: 40, transition: { duration: durations.fast, ease: easings.easeInOut } },
};
