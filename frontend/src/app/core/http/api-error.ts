export interface AppError {
  code: string;
  message: string;
  details?: unknown;
  status: number;
}

export function toAppError(status: number, body: unknown): AppError {
  if (
    body !== null &&
    typeof body === 'object' &&
    'code' in body &&
    'message' in body &&
    typeof (body as Record<string, unknown>)['code'] === 'string' &&
    typeof (body as Record<string, unknown>)['message'] === 'string'
  ) {
    const b = body as { code: string; message: string; details?: unknown };
    return { status, code: b.code, message: b.message, details: b.details };
  }
  return {
    status,
    code: 'UNKNOWN_ERROR',
    message: typeof body === 'string' ? body : 'An unexpected error occurred',
  };
}
