export const COUNTRY_CODES = [
  { code: '+91', name: 'India' }, { code: '+1', name: 'USA' },
  { code: '+44', name: 'UK' }, { code: '+971', name: 'UAE' },
  { code: '+65', name: 'Singapore' }, { code: '+60', name: 'Malaysia' },
];

export function isValidPhone(phone: string, countryCode: string): boolean {
  return /^\d{7,14}$/.test(phone) && countryCode.length - 1 + phone.length <= 15
    && (countryCode !== '+91' || phone.length === 10);
}

export function validateRegistration(form: {
  name: string; email: string; phone: string; countryCode: string;
  consent: boolean;
}): string | undefined {
  const cleanName = form.name.trim();
  if (cleanName.length < 2) return 'Please enter your full name.';
  const lower = cleanName.toLowerCase();
  if (['male', 'female', 'other', 'hero male', 'hero female'].includes(lower)) {
    return 'Please enter your actual full name (e.g. Rahul Sharma), not gender.';
  }
  if (/^[\d\s+\-()]+$/.test(cleanName)) {
    return 'Full name cannot be a phone number or digits.';
  }
  if (form.email && form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    return 'Please enter a valid email address or leave it blank.';
  }
  if (!isValidPhone(form.phone, form.countryCode)) return 'Please enter a valid mobile number.';
  if (!form.consent) return 'Please accept the Terms of Use and Privacy Policy.';
  return undefined;
}
