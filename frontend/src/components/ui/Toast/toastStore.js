// Vanilla pub-sub toast store — callable from anywhere (components, RTK Query's baseQuery,
// hooks outside the React tree) with no context/bridging required, unlike antd's App.useApp().
let toasts = [];
let nextId = 0;
const listeners = new Set();

const DEFAULT_DURATION = 3500;

const emit = () => listeners.forEach((listener) => listener(toasts));

function dismiss(id) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

function push(type, message, duration = DEFAULT_DURATION) {
  const id = ++nextId;
  toasts = [...toasts, { id, type, message }];
  emit();
  if (duration > 0) {
    setTimeout(() => dismiss(id), duration);
  }
  return id;
}

export const toast = {
  success: (message, duration) => push("success", message, duration),
  error: (message, duration) => push("error", message, duration),
  warning: (message, duration) => push("warning", message, duration),
  info: (message, duration) => push("info", message, duration),
  dismiss,
};

export function subscribeToasts(listener) {
  listeners.add(listener);
  listener(toasts);
  return () => listeners.delete(listener);
}

export function getToasts() {
  return toasts;
}
