/**
 * Every API error body is `{ code, message }` at the top level, with `details`
 * added only for INVALID_PAYLOAD. See specs/api-contracts/README.md.
 *
 * `message` is English developer/log text: it is never shown to an end user.
 * Each frontend translates by `code` in its own layer (ADR-028 point 1).
 */
export interface InvalidPayloadDetail {
  property: string;
  constraints: string[];
}

/** `code` used when the response body carries no machine-readable code of its own. */
export const UNKNOWN_ERROR_CODE = 'UNKNOWN_ERROR';

/** `code` used when the request never reached the API (offline, DNS, CORS). */
export const NETWORK_ERROR_CODE = 'NETWORK_ERROR';

export class ApiError extends Error {
  readonly code: string;
  /** HTTP status, or 0 when the request never got a response. */
  readonly status: number;
  readonly details?: InvalidPayloadDetail[];

  constructor(params: {
    code: string;
    message: string;
    status: number;
    details?: InvalidPayloadDetail[];
  }) {
    super(params.message);
    this.name = 'ApiError';
    this.code = params.code;
    this.status = params.status;
    this.details = params.details;
  }
}

/**
 * Builds an ApiError from a raw error response body.
 *
 * Not every error the API emits follows the contract: anything Nest throws
 * outside a controller — most importantly the 401 from JwtAuthGuard, but also
 * unhandled 500s — serializes as `{ message, statusCode }` with no `code`,
 * because there is no global exception filter. A non-JSON body (an nginx error
 * page, say) is possible too. Both collapse to UNKNOWN_ERROR rather than
 * throwing while handling an error.
 */
export function toApiError(status: number, rawBody: string): ApiError {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return new ApiError({
      code: UNKNOWN_ERROR_CODE,
      message: rawBody || `Request failed with status ${status}.`,
      status,
    });
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return new ApiError({
      code: UNKNOWN_ERROR_CODE,
      message: `Request failed with status ${status}.`,
      status,
    });
  }

  const body = parsed as { code?: unknown; message?: unknown; details?: unknown };

  return new ApiError({
    code: typeof body.code === 'string' ? body.code : UNKNOWN_ERROR_CODE,
    message:
      typeof body.message === 'string' ? body.message : `Request failed with status ${status}.`,
    status,
    details: Array.isArray(body.details) ? (body.details as InvalidPayloadDetail[]) : undefined,
  });
}
