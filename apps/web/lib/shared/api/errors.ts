export interface ApiErrorBody {
  message?: string;
  status?: number;
  errors?: unknown;
  [key: string]: unknown;
}

export class OttApiError extends Error {
  readonly status?: number;
  readonly body?: unknown;

  constructor(message: string, status?: number, body?: unknown) {
    super(message);
    this.name = 'OttApiError';
    this.status = status;
    this.body = body;
  }
}

export function normalizeAxiosError(err: unknown): OttApiError {
  if (err instanceof OttApiError) return err;
  const error = err as {
    message?: string;
    status?: number;
    body?: ApiErrorBody | unknown;
    response?: {
      status?: number;
      data?: ApiErrorBody;
    };
  };
  const body = (error.body as ApiErrorBody | undefined) ?? error.response?.data;
  const errors = body?.errors;
  const status = error.status ?? error.response?.status;
  const msg =
    (typeof body?.message === 'string' && body.message) ||
    (typeof errors === 'string' && errors) ||
    (Array.isArray(errors) && typeof errors[0] === 'string' && errors[0]) ||
    error.message ||
    'Request failed';
  return new OttApiError(String(msg), status, body);
}
