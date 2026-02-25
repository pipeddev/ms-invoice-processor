export type JSendSuccess<T> = {
  status: 'success';
  data: T;
};

export type JSendFail = {
  status: 'fail';
  data: unknown;
};

export type JSendError = {
  status: 'error';
  message: string;
  data?: unknown;
};

export type JSendResponse<T> = JSendSuccess<T> | JSendFail | JSendError;

export const jsend = {
  success: <T>(data: T): JSendSuccess<T> => ({
    status: 'success',
    data
  }),

  fail: (data: unknown): JSendFail => ({
    status: 'fail',
    data
  }),

  error: (message: string, data?: unknown): JSendError => ({
    status: 'error',
    message,
    ...(data !== undefined && { data })
  })
};
