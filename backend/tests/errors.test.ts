import { describe, expect, it, vi } from 'vitest';
import { ApiError, errorMiddleware, httpError } from '../src/errors';

function fakeRes() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis()
  };
}

describe('httpError', () => {
  it('returns an ApiError with status/code/message', () => {
    const err = httpError(404, 'NOT_FOUND', 'oops');
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
    expect(err.message).toBe('oops');
    expect(err.details).toBeUndefined();
  });

  it('attaches details when provided', () => {
    const err = httpError(400, 'BAD', 'bad', { field: 'x' });
    expect(err.details).toEqual({ field: 'x' });
  });
});

describe('errorMiddleware', () => {
  it('returns ApiError as structured JSON', () => {
    const err = httpError(404, 'PROJECT_NOT_FOUND', '项目不存在：foo');
    const res = fakeRes();
    errorMiddleware()(err, {} as never, res as never, () => {});
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      ok: false,
      code: 'PROJECT_NOT_FOUND',
      message: '项目不存在：foo'
    });
  });

  it('includes details when present', () => {
    const err = httpError(400, 'BAD', 'bad', { line: 5 });
    const res = fakeRes();
    errorMiddleware()(err, {} as never, res as never, () => {});
    expect(res.json).toHaveBeenCalledWith({
      ok: false,
      code: 'BAD',
      message: 'bad',
      details: { line: 5 }
    });
  });

  it('falls back to 400 BAD_REQUEST for generic Error', () => {
    const err = new Error('something broke');
    const res = fakeRes();
    errorMiddleware()(err, {} as never, res as never, () => {});
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      ok: false,
      code: 'BAD_REQUEST',
      message: 'something broke'
    });
  });

  it('handles non-Error throws gracefully', () => {
    const res = fakeRes();
    errorMiddleware()('oops' as never, {} as never, res as never, () => {});
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      ok: false,
      code: 'BAD_REQUEST',
      message: 'Internal Server Error'
    });
  });
});