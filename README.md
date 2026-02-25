# procureai-invoice-processor

Primer paso del procesador de facturas con arquitectura hexagonal minimalista sobre Node.js + TypeScript.

## Requisitos

- Node.js 20+
- pnpm

## Setup

```bash
pnpm install
```

## Comandos

```bash
pnpm -w build
pnpm dev:api
pnpm -w lint
pnpm -w test
```

## API

### `POST /invoices/upload`

Request:

```json
{
  "fileName": "invoice-001.pdf",
  "contentType": "application/pdf",
  "fileBase64": "JVBERi0xLjQK..."
}
```

Response `202`:

```json
{
  "invoiceId": "uuid"
}
```
