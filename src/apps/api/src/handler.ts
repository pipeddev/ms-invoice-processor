import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2
} from 'aws-lambda';
import Busboy from 'busboy';

import { UploadInvoiceUseCase } from '@procureai/domain';
import {
  InMemoryFileStore,
  InMemoryInvoiceRepository,
  MongoInvoiceRepository,
  S3FileStore
} from '@procureai/infra';

import { makeUploadInvoiceController } from './controllers/upload-invoice-controller';
import { Router } from './router';

const fileStore = process.env.S3_BUCKET_INVOICES
  ? new S3FileStore({
      region: process.env.AWS_REGION ?? 'us-east-1',
      bucket: process.env.S3_BUCKET_INVOICES
    })
  : new InMemoryFileStore();

const invoiceRepository = process.env.MONGODB_URI
  ? new MongoInvoiceRepository({ uri: process.env.MONGODB_URI })
  : new InMemoryInvoiceRepository();

const uploadInvoiceUseCase = new UploadInvoiceUseCase({
  invoiceRepository,
  fileStore
});

const router = new Router();
router.post(
  '/invoices/upload',
  makeUploadInvoiceController(uploadInvoiceUseCase)
);

const jsonResponse = (
  statusCode: number,
  body: unknown
): APIGatewayProxyStructuredResultV2 => ({
  statusCode,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body)
});

const getHeader = (
  headers: Record<string, string | undefined> | undefined,
  name: string
): string | undefined => {
  if (!headers) return undefined;
  const key = Object.keys(headers).find(
    (k) => k.toLowerCase() === name.toLowerCase()
  );
  return key ? headers[key] : undefined;
};

const parseMultipart = (
  event: APIGatewayProxyEventV2
): Promise<{
  body: Record<string, string>;
  file?: {
    originalname: string;
    mimetype: string;
    buffer: Buffer;
    size: number;
  };
}> => {
  const contentType = getHeader(event.headers, 'content-type');
  if (!contentType) throw new Error('Missing content-type');

  const raw = event.body ?? '';
  const bodyBuffer = event.isBase64Encoded
    ? Buffer.from(raw, 'base64')
    : Buffer.from(raw, 'binary');

  return new Promise((resolve, reject) => {
    const bb = Busboy({ headers: { 'content-type': contentType } });

    const fields: Record<string, string> = {};
    let file:
      | { originalname: string; mimetype: string; buffer: Buffer; size: number }
      | undefined;

    bb.on('field', (name, value) => {
      fields[name] = value;
    });

    bb.on('file', (_fieldname, stream, info) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => {
        const buffer = Buffer.concat(chunks);
        file = {
          originalname: info.filename,
          mimetype: info.mimeType,
          buffer,
          size: buffer.length
        };
      });
    });

    bb.on('finish', () => {
      // eslint-disable-next-line no-console
      console.log('[multipart] fields:', fields);
      // eslint-disable-next-line no-console
      console.log('[multipart] file:', file?.originalname, file?.size);
      resolve({ body: fields, file });
    });

    bb.on('error', reject);

    bb.end(bodyBuffer);
  });
};

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyStructuredResultV2> => {
  try {
    const contentType = getHeader(event.headers, 'content-type') ?? '';
    let body: unknown = {};
    let file:
      | { originalname: string; mimetype: string; buffer: Buffer; size: number }
      | undefined;

    if (contentType.includes('multipart/form-data')) {
      const parsed = await parseMultipart(event);
      body = parsed.body;
      file = parsed.file;
    } else {
      const rawBody = event.body ?? '';
      body = rawBody.length > 0 ? JSON.parse(rawBody) : {};
    }

    const routeResult = await router.dispatch({
      method: event.requestContext.http.method,
      path: event.rawPath,
      headers: event.headers,
      body,
      file
    });

    return jsonResponse(routeResult.statusCode, routeResult.body);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[handler error]', error);
    return jsonResponse(500, { message: 'Internal Server Error' });
  }
};
