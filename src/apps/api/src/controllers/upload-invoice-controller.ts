import type { UploadInvoiceUseCase } from '@procureai/domain';
import { createLogger, uploadInvoiceSchema } from '@procureai/shared';

import { BadRequestError } from '../errors/http-error';
import { jsend } from '../jsend';
import type { RouteHandler } from '../router';

const logger = createLogger('UploadInvoiceController');

export const makeUploadInvoiceController = (
  uploadInvoiceUseCase: UploadInvoiceUseCase
): RouteHandler => {
  return async (request) => {
    logger.info(
      { method: request.method, path: request.path },
      'Upload invoice request received'
    );

    const parsed = uploadInvoiceSchema.safeParse(request.body ?? {});

    if (!parsed.success) {
      logger.warn({ issues: parsed.error.issues }, 'Invalid request body');
      throw new BadRequestError('Invalid request body', parsed.error.issues);
    }

    if (!request.file?.buffer) {
      logger.warn('File is required but not provided');
      throw new BadRequestError('File is required');
    }

    logger.debug(
      { fileName: request.file.originalname, size: request.file.size },
      'File received'
    );

    const result = await uploadInvoiceUseCase.execute({
      fileName: parsed.data.fileName ?? request.file.originalname,
      bytes: request.file.buffer,
      contentType: request.file.mimetype
    });

    logger.info(
      { invoiceId: result.invoiceId, storageKey: result.storageKey },
      'Invoice uploaded successfully'
    );

    return {
      statusCode: 202,
      body: jsend.success(result)
    };
  };
};
