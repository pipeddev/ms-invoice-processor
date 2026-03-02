import mongoose, { Schema } from 'mongoose';

import type {
  Invoice,
  InvoiceEvent,
  InvoiceFileMetadata
} from '@procureai/domain';

const InvoiceEventSchema = new Schema<InvoiceEvent>(
  {
    status: { type: String, required: true },
    by: { type: String, required: true },
    at: { type: String, required: true }
  },
  { _id: false }
);

const InvoiceFileMetadataSchema = new Schema<InvoiceFileMetadata>(
  {
    name: { type: String, required: true },
    type: { type: String, required: true }
  },
  { _id: false }
);

const InvoiceSchema = new Schema<Invoice>(
  {
    id: { type: String, required: true, unique: true },
    status: {
      type: String,
      required: true,
      enum: ['pending', 'processing', 'processed', 'failed'],
      default: 'pending'
    },
    createdAt: { type: String, required: true },
    events: { type: [InvoiceEventSchema], required: true, default: [] },
    file: { type: InvoiceFileMetadataSchema, required: true }
  },
  {
    versionKey: false
  }
);

export const InvoiceModel = mongoose.model<Invoice>('Invoice', InvoiceSchema);
