import { createLogger } from '@procureai/shared';
import type { InvoiceRepository } from '../ports/invoice-repository';
import type { FileDownloader } from '../ports/file-downloader';
import type {
  ExtractedInvoiceData,
  InvoiceDataExtractor
} from '../ports/invoice-data-extractor';

const logger = createLogger('ProcessInvoiceUseCase');

export interface ProcessInvoiceInput {
  invoiceId: string;
  bucket: string;
  key: string;
}

export interface ProcessInvoiceOutput {
  invoiceId: string;
  extractedData: ExtractedInvoiceData;
  processedAt: string;
}

export interface ProcessInvoiceDependencies {
  invoiceRepository: InvoiceRepository;
  fileDownloader: FileDownloader;
  invoiceDataExtractor: InvoiceDataExtractor;
  now?: () => Date;
}

export class ProcessInvoiceUseCase {
  private readonly invoiceRepository: InvoiceRepository;
  private readonly fileDownloader: FileDownloader;
  private readonly invoiceDataExtractor: InvoiceDataExtractor;
  private readonly now: () => Date;

  constructor(deps: ProcessInvoiceDependencies) {
    this.invoiceRepository = deps.invoiceRepository;
    this.fileDownloader = deps.fileDownloader;
    this.invoiceDataExtractor = deps.invoiceDataExtractor;
    this.now = deps.now ?? (() => new Date());
  }

  async execute(input: ProcessInvoiceInput): Promise<ProcessInvoiceOutput> {
    const { invoiceId, bucket, key } = input;

    logger.info({ invoiceId, bucket, key }, 'Starting invoice processing');

    // 1. Mark as processing
    const invoice = await this.invoiceRepository.findById(invoiceId);
    if (!invoice) {
      logger.warn({ invoiceId }, 'Invoice not found, skipping');
      throw new Error(`Invoice not found: ${invoiceId}`);
    }

    const processingAt = this.now().toISOString();
    invoice.status = 'processing';
    invoice.events.push({
      status: 'processing',
      by: 'worker',
      at: processingAt
    });
    await this.invoiceRepository.save(invoice);
    logger.info({ invoiceId }, 'Invoice marked as processing');

    try {
      // 2. Download PDF from S3
      logger.info({ invoiceId, bucket, key }, 'Downloading PDF from S3');
      const pdfBuffer = await this.fileDownloader.downloadFile(bucket, key);
      logger.info({ invoiceId, sizeBytes: pdfBuffer.length }, 'PDF downloaded');

      // 3. Extract data with LLM
      logger.info({ invoiceId }, 'Extracting data with LLM');
      const extractedData = await this.invoiceDataExtractor.extract(pdfBuffer);
      logger.info(
        { invoiceId, invoiceNumber: extractedData.invoiceNumber },
        'Data extracted'
      );

      // 4. Mark as processed
      const processedAt = this.now().toISOString();
      invoice.status = 'processed';
      invoice.events.push({
        status: 'processed',
        by: 'worker',
        at: processedAt
      });
      await this.invoiceRepository.save(invoice);
      logger.info({ invoiceId }, 'Invoice marked as processed');

      return { invoiceId, extractedData, processedAt };
    } catch (err) {
      // 5. Mark as failed on error
      const failedAt = this.now().toISOString();
      invoice.status = 'failed';
      invoice.events.push({ status: 'failed', by: 'worker', at: failedAt });
      await this.invoiceRepository.save(invoice);
      logger.error({ invoiceId, err }, 'Invoice processing failed');
      throw err;
    }
  }
}
