export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;

  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  get isUnauthorized() { return this.status === 401; }
  get isForbidden() { return this.status === 403; }
  get isConflict() { return this.status === 409; }
}

const STATUS_MESSAGES: Record<number, string> = {
  401: '登录已过期，请重新登录。',
  403: '权限不足，无法执行此操作。',
  409: '数据已被其他人更新，请刷新后重试。',
};

export const parseError = async (response: Response): Promise<ApiError> => {
  let code: string | undefined;
  let details: unknown;
  let message = STATUS_MESSAGES[response.status] || `请求失败（${response.status}）`;

  try {
    const body = await response.json();
    if (typeof body?.error === 'string') message = body.error;
    if (typeof body?.message === 'string' && !body?.error) message = body.message;
    if (typeof body?.code === 'string') code = body.code;
    if ('details' in body) details = body.details;
  } catch {
    // The server may return an empty or non-JSON error response.
  }

  return new ApiError(message, response.status, code, details);
};

export const readError = async (response: Response): Promise<string> => {
  const error = await parseError(response);
  return error.message;
};

export type ApiRequestInit = Omit<RequestInit, 'body'> & {
  body?: BodyInit | Record<string, unknown> | unknown[] | null;
};


export const requestJson = async <T,>(url: string, init: ApiRequestInit = {}): Promise<T> => {
  const headers = new Headers(init.headers);
  let body = init.body as BodyInit | null | undefined;

  if (init.body && typeof init.body === 'object' && !(init.body instanceof FormData) && !(init.body instanceof Blob) && !(init.body instanceof ArrayBuffer) && !(init.body instanceof URLSearchParams)) {
    body = JSON.stringify(init.body);
    if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...init,
    credentials: 'same-origin',
    headers,
    body,
  });

  if (!response.ok) throw await parseError(response);
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
};

export const isAuthError = (error: unknown): error is ApiError => error instanceof ApiError && (error.status === 401 || error.status === 403);
export const isConflictError = (error: unknown): error is ApiError => error instanceof ApiError && error.status === 409;
export const getErrorMessage = (error: unknown, fallback = '无法连接服务器。') => error instanceof Error ? error.message : fallback;
