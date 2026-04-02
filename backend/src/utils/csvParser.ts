// src/utils/csvParser.ts
// CSV parser utility using papaparse.
// Validates required columns, transforms rows, and sanitizes CSV injection.

import Papa from 'papaparse';

export interface ParsedCSVResult<T> {
  data: T[];
  errors: {
    row: number;
    message: string;
  }[];
}

// ============================================
// CSV INJECTION PROTECTION
// Strips leading characters that Excel interprets as formulas.
// =HYPERLINK("..."), +cmd, -cmd, @SUM are all dangerous.
// ============================================
function sanitizeField(value: string): string {
  if (typeof value !== 'string') return value;
  // Strip leading formula characters
  return value.replace(/^[=+\-@\t\r]+/, '').trim();
}

function sanitizeRow(row: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(row)) {
    sanitized[key] = typeof value === 'string' ? sanitizeField(value) : value;
  }
  return sanitized;
}

export async function parseCSV<T>(
  fileBuffer: Buffer,
  options?: {
    requiredColumns?: string[];
    transform?: (row: any) => T;
  }
): Promise<ParsedCSVResult<T>> {
  return new Promise((resolve) => {
    const fileContent = fileBuffer.toString('utf-8');

    Papa.parse(fileContent, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header: string) => header.trim(),
      complete: (results) => {
        const errors: { row: number; message: string }[] = [];
        const data: T[] = [];

        // Check required columns
        if (options?.requiredColumns) {
          const headers = results.meta.fields || [];
          const missing = options.requiredColumns.filter((col) => !headers.includes(col));

          if (missing.length > 0) {
            errors.push({
              row: 0,
              message: `Missing required columns: ${missing.join(', ')}`,
            });
          }
        }

        // Sanitize and transform rows
        results.data.forEach((rawRow: any, index: number) => {
          try {
            const row = sanitizeRow(rawRow);
            const transformed = options?.transform ? options.transform(row) : (row as T);
            data.push(transformed);
          } catch (error: any) {
            errors.push({
              row: index + 2, // +2 for header and 1-indexing
              message: error.message,
            });
          }
        });

        resolve({ data, errors });
      },
    });
  });
}
