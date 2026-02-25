export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly data?: unknown
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export class BadRequestError extends HttpError {
  constructor(message = 'Bad Request', data?: unknown) {
    super(400, message, data);
    this.name = 'BadRequestError';
  }
}

export class NotFoundError extends HttpError {
  constructor(message = 'Not Found', data?: unknown) {
    super(404, message, data);
    this.name = 'NotFoundError';
  }
}

export class UnprocessableEntityError extends HttpError {
  constructor(message = 'Unprocessable Entity', data?: unknown) {
    super(422, message, data);
    this.name = 'UnprocessableEntityError';
  }
}

export class InternalServerError extends HttpError {
  constructor(message = 'Internal Server Error', data?: unknown) {
    super(500, message, data);
    this.name = 'InternalServerError';
  }
}
