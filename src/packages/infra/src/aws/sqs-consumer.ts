import {
  DeleteMessageCommand,
  Message,
  ReceiveMessageCommand,
  SQSClient
} from '@aws-sdk/client-sqs';
import { createLogger } from '@procureai/shared';

const logger = createLogger('sqs-consumer');

export type MessageHandler = (message: Message) => Promise<void>;

export type SqsConsumerConfig = {
  queueUrl: string;
  region: string;
  maxMessages?: number;
  waitTimeSeconds?: number;
  visibilityTimeout?: number;
};

export class SqsConsumer {
  private readonly client: SQSClient;
  private readonly config: Required<SqsConsumerConfig>;
  private running = false;

  constructor(config: SqsConsumerConfig) {
    this.config = {
      maxMessages: 5,
      waitTimeSeconds: 20,
      visibilityTimeout: 30,
      ...config
    };
    this.client = new SQSClient({ region: this.config.region });
  }

  async start(handler: MessageHandler): Promise<void> {
    if (this.running) {
      logger.warn('SqsConsumer is already running');
      return;
    }
    this.running = true;
    logger.info({ queueUrl: this.config.queueUrl }, 'SqsConsumer started');
    await this.poll(handler);
  }

  stop(): void {
    this.running = false;
    logger.info('SqsConsumer stopped');
  }

  private async poll(handler: MessageHandler): Promise<void> {
    while (this.running) {
      try {
        const messages = await this.receive();
        if (messages.length > 0) {
          logger.info({ count: messages.length }, 'Messages received');
          await this.processAll(messages, handler);
        }
      } catch (err) {
        logger.error({ err }, 'Error during polling, retrying in 5s');
        await delay(5_000);
      }
    }
  }

  private async receive(): Promise<Message[]> {
    const { Messages } = await this.client.send(
      new ReceiveMessageCommand({
        QueueUrl: this.config.queueUrl,
        MaxNumberOfMessages: this.config.maxMessages,
        WaitTimeSeconds: this.config.waitTimeSeconds,
        VisibilityTimeout: this.config.visibilityTimeout,
        MessageAttributeNames: ['All'],
        AttributeNames: ['All']
      })
    );
    return Messages ?? [];
  }

  private async processAll(
    messages: Message[],
    handler: MessageHandler
  ): Promise<void> {
    for (const message of messages) {
      try {
        logger.debug({ messageId: message.MessageId }, 'Processing message');
        await handler(message);
        await this.delete(message.ReceiptHandle!);
        logger.info(
          { messageId: message.MessageId },
          'Message processed and deleted'
        );
      } catch (err) {
        logger.error(
          { err, messageId: message.MessageId },
          'Message processing failed — will be retried after VisibilityTimeout'
        );
      }
    }
  }

  private async delete(receiptHandle: string): Promise<void> {
    await this.client.send(
      new DeleteMessageCommand({
        QueueUrl: this.config.queueUrl,
        ReceiptHandle: receiptHandle
      })
    );
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
