import { AsyncLocalStorage } from "node:async_hooks";

const asyncLocalStorage = new AsyncLocalStorage();

export function runWithContext(context, fn) {
  return asyncLocalStorage.run(context, fn);
}

export function getContext() {
  return asyncLocalStorage.getStore();
}

export function getRequestId() {
  return asyncLocalStorage.getStore()?.requestId;
}

export function getUserId() {
  return asyncLocalStorage.getStore()?.userId;
}

export function setUserId(userId) {
  const store = asyncLocalStorage.getStore();
  if (store) store.userId = userId;
}
