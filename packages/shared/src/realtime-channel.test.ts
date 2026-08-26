import { describe, expect, it } from 'vitest';
import { ApiError, NETWORK_ERROR_CODE, UNKNOWN_ERROR_CODE } from './api-client/api-error';
import { classifyRefreshFailure } from './realtime-channel';

describe('classifyRefreshFailure', () => {
  it('classifies a NETWORK_ERROR_CODE ApiError as network', () => {
    const error = new ApiError({ code: NETWORK_ERROR_CODE, message: 'offline', status: 0 });
    expect(classifyRefreshFailure(error)).toBe('network');
  });

  it('classifies an explicit refresh rejection as rejected', () => {
    const error = new ApiError({
      code: 'INVALID_REFRESH_TOKEN',
      message: 'Invalid or expired.',
      status: 401,
    });
    expect(classifyRefreshFailure(error)).toBe('rejected');
  });

  it('classifies any other ApiError as rejected', () => {
    const error = new ApiError({ code: UNKNOWN_ERROR_CODE, message: 'boom', status: 500 });
    expect(classifyRefreshFailure(error)).toBe('rejected');
  });

  it('classifies a non-ApiError value as rejected', () => {
    expect(classifyRefreshFailure(new TypeError('unexpected'))).toBe('rejected');
  });
});
