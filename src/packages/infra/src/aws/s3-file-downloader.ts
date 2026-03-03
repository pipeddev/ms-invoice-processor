import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { FileDownloader } from '@procureai/domain';
import { createLogger } from '@procureai/shared';

const logger = createLogger('s3-file-downloader');

export type S3FileDownloaderConfig = {
  region: string;
};

export class S3FileDownloader implements FileDownloader {
  private readonly s3: S3Client;

  constructor(cfg: S3FileDownloaderConfig) {
    this.s3 = new S3Client({ region: cfg.region });
  }

  async downloadFile(bucket: string, key: string): Promise<Buffer> {
    logger.debug({ bucket, key }, 'Downloading file from S3');

    const response = await this.s3.send(
      new GetObjectCommand({ Bucket: bucket, Key: key })
    );

    if (!response.Body) {
      throw new Error(`File not found in S3: ${bucket}/${key}`);
    }

    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }

    const buffer = Buffer.concat(chunks);
    logger.debug(
      { bucket, key, sizeBytes: buffer.length },
      'File downloaded from S3'
    );
    return buffer;
  }
}
