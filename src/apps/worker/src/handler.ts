import { ProcessInvoiceUseCase } from '@procureai/domain';
import {
  InMemoryInvoiceRepository,
  OpenAiInvoiceExtractor,
  S3FileDownloader
} from '@procureai/infra';
import { createLogger } from '@procureai/shared';

const logger = createLogger('worker-handler');

const processInvoiceUseCase = new ProcessInvoiceUseCase({
  invoiceRepository: new InMemoryInvoiceRepository(),
  fileDownloader: new S3FileDownloader({
    region: process.env.AWS_REGION ?? 'us-east-1'
  }),
  invoiceDataExtractor: new OpenAiInvoiceExtractor()
});

type SqsRecord = {
  body: string;
};

type SqsEvent = {
  Records: SqsRecord[];
};

/**
 * S3->SQS message body contains a JSON string with:
 * { Records: [{ s3: { bucket: { name }, object: { key } } }] }
 */
export const handler = async (event: SqsEvent): Promise<void> => {
  for (const record of event.Records ?? []) {
    try {
      const body = JSON.parse(record.body);

      // S3 event notifications usually come as:
      // body.Records[0].s3.bucket.name and body.Records[0].s3.object.key
      const s3Record = body?.Records?.[0];
      const bucket = s3Record?.s3?.bucket?.name;
      const rawKey = s3Record?.s3?.object?.key;

      // S3 may URL-encode the key (spaces, special chars)
      const key =
        typeof rawKey === 'string'
          ? decodeURIComponent(rawKey.replace(/\+/g, ' '))
          : undefined;

      logger.info({ bucket, key }, 'S3 event received');

      if (!bucket || !key) {
        logger.warn({ body }, 'Missing bucket/key in S3 event body');
        return;
      }

      // Parse invoiceId from key: invoices/<invoiceId>-filename.pdf
      const invoiceIdMatch = key.match(
        /invoices\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i
      );
      const invoiceId = invoiceIdMatch?.[1];
      if (!invoiceId) {
        logger.warn({ key }, 'Could not parse invoiceId from S3 key');
        return;
      }

      await processInvoiceUseCase.execute({ invoiceId, bucket, key });
    } catch (err) {
      logger.error({ err, body: record.body }, 'Failed to process SQS record');
      // Throwing makes Lambda treat this batch item as failed.
      // With batch size 1, it will retry and eventually go to DLQ.
      throw err;
    }
  }
};
