import 'dotenv/config';
import { createServer } from 'node:http';
import { URL } from 'node:url';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';

import { handler } from './handler';
import { createLogger } from '@procureai/shared';

const logger = createLogger('LocalServer');
const port = Number(process.env.PORT ?? 3000);

const normalizeHeaders = (
  headers: NodeJS.Dict<string | string[]>
): Record<string, string> => {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined) continue;
    result[key.toLowerCase()] = Array.isArray(value) ? value.join(',') : value;
  }
  return result;
};

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled rejection');
});

process.on('uncaughtException', (error) => {
  logger.error({ error }, 'Uncaught exception');
});

const server = createServer((req, res) => {
  const chunks: Buffer[] = [];

  req.on('error', (error) => {
    logger.error({ error }, 'Request error');
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ message: 'Internal Server Error' }));
  });

  req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));

  req.on('end', async () => {
    try {
      const rawBody = Buffer.concat(chunks);
      const headers = normalizeHeaders(req.headers);

      const host = headers.host ?? `localhost:${port}`;
      const protocol = headers['x-forwarded-proto'] ?? 'http';
      const url = new URL(req.url ?? '/', `${protocol}://${host}`);

      const contentType = headers['content-type'] ?? '';
      const isMultipart = contentType.includes('multipart/form-data');

      logger.debug(
        { contentType, rawBodyBytes: rawBody.length, isMultipart },
        'Incoming request'
      );

      const event: APIGatewayProxyEventV2 = {
        version: '2.0',
        routeKey: '$default',
        rawPath: url.pathname,
        rawQueryString: url.search ? url.search.slice(1) : '',
        headers,
        requestContext: {
          accountId: 'local',
          apiId: 'local',
          domainName: 'localhost',
          domainPrefix: 'localhost',
          http: {
            method: req.method ?? 'GET',
            path: url.pathname,
            protocol: 'HTTP/1.1',
            sourceIp: '127.0.0.1',
            userAgent: headers['user-agent'] ?? 'local-server'
          },
          requestId: `local-${Date.now()}`,
          routeKey: '$default',
          stage: '$default',
          time: new Date().toISOString(),
          timeEpoch: Date.now()
        },
        isBase64Encoded: isMultipart,
        body: isMultipart
          ? rawBody.toString('base64')
          : rawBody.length > 0
            ? rawBody.toString('utf8')
            : undefined
      };

      const response = await handler(event);

      logger.info(
        {
          method: req.method,
          path: url.pathname,
          statusCode: response.statusCode
        },
        'Request completed'
      );

      res.statusCode = response.statusCode ?? 500;

      if (response.headers) {
        Object.entries(response.headers).forEach(([key, value]) => {
          if (value !== undefined) {
            res.setHeader(
              key,
              typeof value === 'boolean' ? String(value) : value
            );
          }
        });
      }

      if (!res.getHeader('content-type')) {
        res.setHeader('content-type', 'application/json');
      }

      res.end(response.body ?? '');
    } catch (error) {
      logger.error({ error }, 'Handler error');
      res.statusCode = 500;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ message: 'Internal Server Error' }));
    }
  });
});

server.listen(port, () => {
  logger.info({ port }, `API local running on http://localhost:${port}`);
});
