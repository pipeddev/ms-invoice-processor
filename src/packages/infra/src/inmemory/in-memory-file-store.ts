import type { FileStore, FileStoreSaveInput } from '@procureai/domain';

export class InMemoryFileStore implements FileStore {
  private readonly files = new Map<string, FileStoreSaveInput>();

  async saveFile(input: FileStoreSaveInput): Promise<void> {
    this.files.set(input.key, input);
  }

  getByKey(key: string): FileStoreSaveInput | null {
    return this.files.get(key) ?? null;
  }
}
