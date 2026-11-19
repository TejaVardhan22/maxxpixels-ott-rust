export class PiiMasker {
  static maskEmail(email?: string | null): string {
    if (!email || !email.includes('@')) {
      return '***';
    }
    const [local, domain] = email.split('@');
    if (local.length <= 2) {
      return `${local.charAt(0)}***@${domain}`;
    }
    return `${local.substring(0, 2)}***@${domain}`;
  }

  static maskPhone(phone?: string | null): string {
    if (!phone || phone.length < 4) {
      return '***';
    }
    return `******${phone.substring(phone.length - 4)}`;
  }

  static maskToken(token?: string | null): string {
    if (!token || token.length < 8) {
      return '••••••••';
    }
    return `${token.substring(0, 6)}...[REDACTED]`;
  }
}

export function maskPhone(phone?: string | null): string {
  return PiiMasker.maskPhone(phone);
}

export function maskEmail(email?: string | null): string {
  return PiiMasker.maskEmail(email);
}

export function maskSecret(secret?: string | null): string {
  if (!secret) return '';
  if (secret.length <= 6) return '********';
  return `${secret.slice(0, 3)}********${secret.slice(-3)}`;
}
