export interface ExtractedLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface ExtractedInvoiceData {
  [key: string]: unknown; 
  invoiceNumber: string;
  date: string;
  totalAmount: number;
  currency: string;
  vendor: string;
  lineItems: ExtractedLineItem[];
}

export interface InvoiceDataExtractor {
  extract(pdfBuffer: Buffer): Promise<ExtractedInvoiceData>;
}
