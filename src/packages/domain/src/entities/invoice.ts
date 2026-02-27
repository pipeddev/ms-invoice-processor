export type InvoiceStatus = 'pending' | 'processing' | 'processed' | 'failed';

export interface InvoiceEvent {
  status: InvoiceStatus;
  by: string;
  at: string;
}

export interface InvoiceFileMetadata {
  name: string;
  type: string;
}

export interface Invoice {
  id: string;
  status: InvoiceStatus;
  createdAt: string;
  events: InvoiceEvent[];
  file: InvoiceFileMetadata;
}
