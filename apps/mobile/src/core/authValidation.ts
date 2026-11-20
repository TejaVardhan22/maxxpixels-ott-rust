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
  dateOfBirth: string; profession: string; pincode?: string; consent: boolean;
}, today = new Date()): string | undefined {
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
  if (form.dateOfBirth && form.dateOfBirth.trim()) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(form.dateOfBirth.trim());
    if (!match) return 'Enter your date of birth as YYYY-MM-DD.';
    const [, y, m, d] = match.map(Number);
    const birth = new Date(y, m - 1, d);
    if (birth.getFullYear() !== y || birth.getMonth() !== m - 1 || birth.getDate() !== d) return 'Please enter a valid date of birth.';
    let age = today.getFullYear() - y;
    if (today.getMonth() < m - 1 || (today.getMonth() === m - 1 && today.getDate() < d)) age--;
    if (age < 18) return 'You must be at least 18 years old to register.';
  }
  if (form.profession && form.profession.trim() && form.profession.trim().length < 2) {
    return 'Please select or enter your profession.';
  }
  if (form.pincode && form.pincode.trim() && !/^\d{6}$/.test(form.pincode.trim())) {
    return 'Please enter a valid 6-digit area pincode.';
  }
  if (!form.consent) return 'Please accept the Terms of Use and Privacy Policy.';
  return undefined;
}
