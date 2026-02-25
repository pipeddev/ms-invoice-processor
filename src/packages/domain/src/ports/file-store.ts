export interface FileStoreSaveInput {
  key: string;
  bytes: Buffer;
  contentType: string;
}
export interface FileStore {
  saveFile(input: FileStoreSaveInput): Promise<void>;
}
