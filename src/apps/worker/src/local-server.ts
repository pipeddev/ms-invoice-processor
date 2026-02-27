import 'dotenv/config';
import { SqsConsumer } from '@procureai/infra';
import { createLogger } from '@procureai/shared';
import type { Message } from '@aws-sdk/client-sqs';
import { handler } from './handler';

const logger = createLogger('worker-local');

const queueUrl = process.env.SQS_QUEUE_URL;
const region = process.env.AWS_REGION ?? 'us-east-1';

if (!queueUrl) {
  logger.fatal('SQS_QUEUE_URL env variable is required');
  process.exit(1);
}

const consumer = new SqsConsumer({ queueUrl, region });

async function onMessage(message: Message): Promise<void> {
  await handler({ Records: [{ body: message.Body ?? '' }] });
}

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down');
  consumer.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down');
  consumer.stop();
  process.exit(0);
});

consumer.start(onMessage).catch((err) => {
  logger.fatal({ err }, 'SqsConsumer crashed');
  process.exit(1);
});
