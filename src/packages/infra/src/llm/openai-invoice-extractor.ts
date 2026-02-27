import OpenAI from 'openai';
import type {
  ExtractedInvoiceData,
  InvoiceDataExtractor
} from '@procureai/domain';
import { createLogger } from '@procureai/shared';

const logger = createLogger('openai-invoice-extractor');

const SYSTEM_PROMPT = `Eres un extractor de datos de facturas chilenas en PDF codificadas en base64.
Analiza el documento y extrae los datos con precisión.
Responde ÚNICAMENTE con un JSON válido con esta estructura exacta:
{
  "invoiceNumber": string,           // Número de folio o factura (ej: "12345")
  "invoiceType": string,             // Tipo de documento (ej: "Factura Electrónica", "Boleta", "Nota de Débito")
  "date": string,                    // Fecha de emisión ISO 8601 (ej: "2024-01-15")
  "dueDate": string | null,          // Fecha de vencimiento ISO 8601 o null si no aplica
  "currency": string,                // Moneda ISO 4217 (ej: "CLP", "USD", "UF")
  "vendor": {
    "name": string,                  // Razón social del emisor
    "rut": string,                   // RUT del emisor (ej: "76.123.456-7")
    "address": string | null,        // Dirección del emisor
    "activity": string | null        // Giro o actividad económica
  },
  "client": {
    "name": string,                  // Razón social del receptor
    "rut": string | null,            // RUT del receptor
    "address": string | null         // Dirección del receptor
  },
  "lineItems": [
    {
      "description": string,         // Descripción del ítem o servicio
      "quantity": number,            // Cantidad
      "unitPrice": number,           // Precio unitario neto
      "totalPrice": number           // Total neto del ítem
    }
  ],
  "subtotal": number,                // Total neto (sin IVA)
  "taxRate": number,                 // Tasa de IVA en decimal (ej: 0.19 para 19%)
  "taxAmount": number,               // Monto del IVA
  "totalAmount": number,             // Total con IVA incluido
  "exentAmount": number | null,      // Monto exento de IVA si aplica
  "siiResolution": string | null,    // Número y fecha de resolución SII si aparece
  "observations": string | null      // Observaciones o glosa adicional
}

Reglas importantes:
- El RUT chileno tiene formato XX.XXX.XXX-X
- Los montos deben ser numéricos sin puntos ni comas
- Si un campo no aparece en el documento, usa null
- La moneda por defecto en Chile es CLP`;

export type OpenAiInvoiceExtractorConfig = {
  apiKey?: string;
  model?: string;
};

export class OpenAiInvoiceExtractor implements InvoiceDataExtractor {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(cfg: OpenAiInvoiceExtractorConfig = {}) {
    this.client = new OpenAI({
      apiKey: cfg.apiKey ?? process.env.OPENAI_API_KEY
    });
    this.model = cfg.model ?? 'gpt-4o';
  }

  async extract(pdfBuffer: Buffer): Promise<ExtractedInvoiceData> {
    logger.info({ model: this.model }, 'Sending PDF to LLM for extraction');

    const base64Pdf = pdfBuffer.toString('base64');

    const response = await this.client.chat.completions.create({
      model: this.model,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Extrae los datos de esta factura en PDF (base64):'
            },
            { type: 'text', text: base64Pdf }
          ]
        }
      ]
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('LLM returned no content');
    }

    const extracted = JSON.parse(content) as ExtractedInvoiceData;
    logger.info(
      { invoiceNumber: extracted.invoiceNumber, vendor: extracted.vendor },
      'Data extracted by LLM'
    );
    return extracted;
  }
}
