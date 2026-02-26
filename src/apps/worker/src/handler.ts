import { createLogger } from '@procureai/shared';

const logger = createLogger('worker-handler');

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
      }

      // Next steps later:
      // - parse invoiceId from key: invoices/<invoiceId>.pdf
      // - download from S3
      // - process with LLM
    } catch (err) {
      logger.error(
        { err, body: record.body },
        'Failed to parse SQS record body'
      );
      // Throwing makes Lambda treat this batch item as failed.
      // With batch size 1, it will retry and eventually go to DLQ (when you add it).
      throw err;
    }
  }
};
