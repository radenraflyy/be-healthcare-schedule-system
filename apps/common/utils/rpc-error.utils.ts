export interface RpcErrorDetails {
  code?: string;
  message?: string;
}

interface RpcErrorPayload {
  code?: unknown;
  message?: unknown;
  error?: unknown;
  response?: unknown;
}

export function findRpcErrorDetails(error: unknown): RpcErrorDetails {
  const queue: unknown[] = [error];
  const visited = new Set<unknown>();
  while (queue.length) {
    const value = queue.shift();
    if (!value || visited.has(value)) continue;
    if (typeof value === 'string') {
      try {
        queue.push(JSON.parse(value));
      } catch {
        // Plain text errors have no structured RPC code.
      }
      continue;
    }
    if (typeof value !== 'object') continue;
    visited.add(value);
    const record = value as RpcErrorPayload;
    if (typeof record.code === 'string' && typeof record.message === 'string') {
      return { code: record.code, message: record.message };
    }
    if (typeof record.message === 'object') queue.push(record.message);
    if (typeof record.error === 'object' || typeof record.error === 'string') {
      queue.push(record.error);
    }
    if (
      typeof record.response === 'object' ||
      typeof record.response === 'string'
    ) {
      queue.push(record.response);
    }
  }
  return {};
}
