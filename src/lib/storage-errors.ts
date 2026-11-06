let storageError: string | null = null;
const listeners = new Set<() => void>();

export function getStorageError(): string | null {
  return storageError;
}

export function subscribeStorageError(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function reportStorageError(message: string, cause: unknown): void {
  console.error(message, cause);
  storageError = message;
  listeners.forEach((listener) => listener());
}

export function clearStorageError(): void {
  storageError = null;
  listeners.forEach((listener) => listener());
}
