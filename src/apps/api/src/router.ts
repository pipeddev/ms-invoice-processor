import { BadRequestError, HttpError, NotFoundError } from './errors/http-error';
import { jsend } from './jsend';

export type RouteFile = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
  size?: number;
};

export type RouteRequest = {
  method: string;
  path: string;
  headers: Record<string, string | undefined>;
  query?: Record<string, string | undefined>;
  params?: Record<string, string | undefined>;
  body?: unknown;
  file?: RouteFile;
};

export type RouteResponse = {
  statusCode: number;
  body: unknown;
};

export type RouteHandler = (request: RouteRequest) => Promise<RouteResponse>;

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

type RouteEntry = {
  method: HttpMethod;
  pattern: RegExp;
  paramNames: string[];
  handler: RouteHandler;
};

const pathToRegex = (
  path: string
): { pattern: RegExp; paramNames: string[] } => {
  const paramNames: string[] = [];
  const regexStr = path.replace(/:([^/]+)/g, (_: string, name: string) => {
    paramNames.push(name);
    return '([^/]+)';
  });
  return { pattern: new RegExp(`^${regexStr}$`), paramNames };
};

export class Router {
  private readonly routes: RouteEntry[] = [];

  register(method: HttpMethod, path: string, handler: RouteHandler): void {
    const { pattern, paramNames } = pathToRegex(path);
    this.routes.push({
      method: method.toUpperCase() as HttpMethod,
      pattern,
      paramNames,
      handler
    });
  }

  get(path: string, handler: RouteHandler): void {
    this.register('GET', path, handler);
  }

  post(path: string, handler: RouteHandler): void {
    this.register('POST', path, handler);
  }

  put(path: string, handler: RouteHandler): void {
    this.register('PUT', path, handler);
  }

  patch(path: string, handler: RouteHandler): void {
    this.register('PATCH', path, handler);
  }

  delete(path: string, handler: RouteHandler): void {
    this.register('DELETE', path, handler);
  }

  async dispatch(request: RouteRequest): Promise<RouteResponse> {
    const method = request.method.toUpperCase() as HttpMethod;
    const path = request.path;

    const matched = this.routes.find(
      (r) => r.method === method && r.pattern.test(path)
    );

    if (!matched) {
      return {
        statusCode: 404,
        body: jsend.fail({ message: `Cannot ${method} ${path}` })
      };
    }

    const match = path.match(matched.pattern);
    const params: Record<string, string> = {};
    if (match) {
      matched.paramNames.forEach((name, i) => {
        params[name] = match[i + 1] ?? '';
      });
    }

    try {
      return await matched.handler({ ...request, params });
    } catch (error) {
      if (error instanceof BadRequestError || error instanceof NotFoundError) {
        return {
          statusCode: error.statusCode,
          body: jsend.fail({
            message: error.message,
            ...(error.data ? { data: error.data } : {})
          })
        };
      }

      if (error instanceof HttpError) {
        return {
          statusCode: error.statusCode,
          body: jsend.error(error.message, error.data)
        };
      }

      // eslint-disable-next-line no-console
      console.error('[router dispatch error]', error);

      return {
        statusCode: 500,
        body: jsend.error('Internal Server Error')
      };
    }
  }
}
