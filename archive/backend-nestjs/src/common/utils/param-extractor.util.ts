export function extractId(
  paramVal?: number | string | null,
  body?: Record<string, any> | null,
  ...keys: string[]
): number | null {
  if (paramVal !== undefined && paramVal !== null && paramVal !== '') {
    const parsed = Number(paramVal);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  if (body && typeof body === 'object') {
    for (const key of keys) {
      if (body[key] !== undefined && body[key] !== null && body[key] !== '') {
        const parsed = Number(body[key]);
        if (!Number.isNaN(parsed)) {
          return parsed;
        }
      }
    }
  }
  return null;
}

export function extractString(
  paramVal?: string | null,
  body?: Record<string, any> | null,
  ...keys: string[]
): string | null {
  if (paramVal !== undefined && paramVal !== null) {
    const str = String(paramVal).trim();
    if (str.length > 0 && str.toLowerCase() !== 'null' && str.toLowerCase() !== 'undefined') {
      return str;
    }
  }
  if (body && typeof body === 'object') {
    for (const key of keys) {
      if (body[key] !== undefined && body[key] !== null) {
        const str = String(body[key]).trim();
        if (str.length > 0 && str.toLowerCase() !== 'null' && str.toLowerCase() !== 'undefined') {
          return str;
        }
      }
    }
  }
  return null;
}

