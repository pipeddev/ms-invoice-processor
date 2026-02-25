import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { FileStore, FileStoreSaveInput } from '@procureai/domain';

export type S3FileStoreConfig = {
  region: string;
  bucket: string;
};

export class S3FileStore implements FileStore {
  private readonly s3: S3Client;
  private readonly bucket: string;

  constructor(cfg: S3FileStoreConfig) {
    this.bucket = cfg.bucket;
    this.s3 = new S3Client({ region: cfg.region });
  }

  async saveFile(input: FileStoreSaveInput): Promise<void> {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: input.key,
        Body: input.bytes,
        ContentType: input.contentType
      })
    );
  }
}
