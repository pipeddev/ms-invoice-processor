export interface FileDownloader {
  downloadFile(bucket: string, key: string): Promise<Buffer>;
}
