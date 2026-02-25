import { z } from 'zod';

const MAX_FILE_NAME_LENGTH = 255;
const PDF_FILE_NAME_REGEX = /^[^\\/:*?"<>|]+\.pdf$/i;

export const uploadInvoiceSchema = z
  .object({
    fileName: z
      .string()
      .trim()
      .min(1, 'fileName es requerido')
      .max(
        MAX_FILE_NAME_LENGTH,
        `fileName no puede superar ${MAX_FILE_NAME_LENGTH} caracteres`
      )
      .regex(
        PDF_FILE_NAME_REGEX,
        'fileName debe terminar en .pdf y no contener caracteres inválidos'
      )
  })
  .strict();

export type UploadInvoiceSchema = z.infer<typeof uploadInvoiceSchema>;
