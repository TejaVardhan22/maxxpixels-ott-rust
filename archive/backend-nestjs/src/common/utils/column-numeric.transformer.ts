import { ValueTransformer } from 'typeorm';

/**
 * Ensures PostgreSQL NUMERIC/DECIMAL columns are converted to JavaScript numbers
 * on read while preserving string/number precision on write, matching Spring Boot BigDecimal JSON output.
 */
export class ColumnNumericTransformer implements ValueTransformer {
  to(data?: number | string | null): number | string | null {
    if (data === null || data === undefined) {
      return null;
    }
    return data;
  }

  from(data?: string | number | null): number | null {
    if (data === null || data === undefined) {
      return null;
    }
    const parsed = typeof data === 'number' ? data : parseFloat(data);
    return Number.isNaN(parsed) ? null : parsed;
  }
}

export const numericTransformer = new ColumnNumericTransformer();

