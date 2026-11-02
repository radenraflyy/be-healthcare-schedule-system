import { GraphQLError } from 'graphql';

import { findRpcErrorDetails } from '../../../../common/utils/rpc-error.utils.js';

export function toGraphQLError(error: unknown, serviceName: string): GraphQLError {
  const details = findRpcErrorDetails(error);
  if (details.code && details.message && details.code !== 'INTERNAL_SERVER_ERROR') {
    return new GraphQLError(details.message, {
      extensions: {
        code: details.code,
        ...(details.limit !== undefined ? { limit: details.limit } : {}),
        ...(details.remaining !== undefined ? { remaining: details.remaining } : {}),
        ...(details.retryAfterSeconds !== undefined
          ? { retryAfterSeconds: details.retryAfterSeconds }
          : {}),
      },
    });
  }

  const originalMessage = error instanceof Error ? error.message : '';
  if (/ECONNREFUSED|ENOTFOUND|EHOSTUNREACH|ETIMEDOUT/.test(originalMessage)) {
    return new GraphQLError(
      `Layanan ${serviceName} sedang tidak tersedia. Pastikan servicenya berjalan lalu coba lagi.`,
      { extensions: { code: 'SERVICE_UNAVAILABLE' } },
    );
  }

  return new GraphQLError(
    details.message && details.message !== 'Internal server error'
      ? details.message
      : 'Terjadi kendala saat memproses permintaan. Coba lagi sebentar.',
    { extensions: { code: details.code ?? 'INTERNAL_SERVER_ERROR' } },
  );
}
