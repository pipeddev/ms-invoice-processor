import mongoose from 'mongoose';

import type { Invoice, InvoiceRepository } from '@procureai/domain';
import { createLogger } from '@procureai/shared';

const logger = createLogger('mongo-invoice-repository');

import { InvoiceModel } from './invoice.schema';

export type MongoInvoiceRepositoryConfig = {
  uri: string;
};

export class MongoInvoiceRepository implements InvoiceRepository {
  private connected = false;
  private readonly uri: string;

  constructor(config: MongoInvoiceRepositoryConfig) {
    this.uri = config.uri;
  }

  private async connect(): Promise<void> {
    if (this.connected) return;
    await mongoose.connect(this.uri);
    this.connected = true;
    logger.info('Connected to MongoDB');
  }

  async save(invoice: Invoice): Promise<void> {
    await this.connect();
    await InvoiceModel.findOneAndUpdate(
      { id: invoice.id },
      {
        $set: {
          status: invoice.status,
          extractedData: invoice.extractedData,
          events: invoice.events
        },
        $setOnInsert: { id: invoice.id } // 👈 Solo asigna _id en inserción
      },
      { upsert: true, new: true }
    );
  }

  async findById(id: string): Promise<Invoice | null> {
    await this.connect();

    const doc = await InvoiceModel.findOne({ id: id }).lean();
    if (!doc) return null;

    return {
      id: doc.id,
      status: doc.status,
      createdAt: doc.createdAt,
      events: doc.events,
      file: doc.file
    };
  }
}
