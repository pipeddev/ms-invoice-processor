import pino from 'pino';
import { v4 as uuidv4 } from 'uuid';
import type { Invoice } from '../entities/invoice';
import type { FileStore } from '../ports/file-store';
import type { InvoiceRepository } from '../ports/invoice-repository';

const logger = pino({
  name: 'UploadInvoiceUseCase',
  level: process.env.LOG_LEVEL ?? 'info',
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: { level: (label) => ({ level: label }) }
});

const MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const PDF_SIGNATURE = '%PDF-';
const PDF_CONTENT_TYPE = 'application/pdf';

export interface UploadInvoiceInput {
  fileName: string;
  bytes: Buffer;
  contentType?: string;
}

export interface UploadInvoiceOutput {
  invoiceId: string;
  storageKey: string;
}

export interface UploadInvoiceDependencies {
  invoiceRepository: InvoiceRepository;
  fileStore: FileStore;
  now?: () => Date;
  generateId?: () => string;
}

const isPdfName = (fileName: string): boolean =>
  /\.pdf$/i.test(fileName.trim());

const sanitizeFileName = (fileName: string): string =>
  fileName.trim().replace(/[^\w.\-]/g, '_');

const isPdfBySignature = (bytes: Buffer): boolean =>
  bytes.length >= 5 && bytes.subarray(0, 5).toString('utf8') === PDF_SIGNATURE;

export class UploadInvoiceUseCase {
  private readonly invoiceRepository: InvoiceRepository;
  private readonly fileStore: FileStore;
  private readonly now: () => Date;
  private readonly generateId: () => string;

  constructor(dependencies: UploadInvoiceDependencies) {
    this.invoiceRepository = dependencies.invoiceRepository;
    this.fileStore = dependencies.fileStore;
    this.now = dependencies.now ?? (() => new Date());
    this.generateId = dependencies.generateId ?? uuidv4;
  }

  async execute(input: UploadInvoiceInput): Promise<UploadInvoiceOutput> {
    logger.info({ fileName: input.fileName }, 'Executing UploadInvoiceUseCase');

    if (!isPdfName(input.fileName)) {
      logger.warn({ fileName: input.fileName }, 'Invalid file name');
      throw new Error('fileName debe terminar en .pdf');
    }

    if (!input.bytes || input.bytes.length === 0) {
      logger.warn('Empty file received');
      throw new Error('Archivo vacío');
    }

    if (input.bytes.length > MAX_PDF_SIZE_BYTES) {
      logger.warn({ size: input.bytes.length }, 'File exceeds max size');
      throw new Error(`Archivo excede ${MAX_PDF_SIZE_BYTES} bytes`);
    }

    const contentType = input.contentType ?? PDF_CONTENT_TYPE;
    const validPdf =
      contentType === PDF_CONTENT_TYPE || isPdfBySignature(input.bytes);

    if (!validPdf) {
      logger.warn({ contentType }, 'Invalid file type');
      throw new Error('Archivo inválido: solo PDF');
    }

    const invoiceId = this.generateId();
    const createdAt = this.now().toISOString();
    const safeName = sanitizeFileName(input.fileName);
    const key = `invoices/${invoiceId}-${safeName}`;

    logger.debug({ invoiceId, key }, 'Saving file to store');

    const invoice: Invoice = {
      id: invoiceId,
      status: 'pending',
      createdAt,
      events: [
        {
          status: 'pending',
          by: 'upload-lambda',
          at: createdAt
        }
      ],
      file: {
        name: safeName,
        type: PDF_CONTENT_TYPE
      }
    };

    await this.fileStore.saveFile({
      invoiceId,
      key,
      bytes: input.bytes,
      contentType: PDF_CONTENT_TYPE
    });

    logger.debug({ key }, 'File saved to store');

    await this.invoiceRepository.save(invoice);

    logger.info({ invoiceId, storageKey: key }, 'Invoice saved successfully');

    return { invoiceId, storageKey: key };
  }
}
