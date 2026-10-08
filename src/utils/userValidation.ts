const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function maskBirthDate(text: string): string {
  const digits = text.replace(/\D/g, '').slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)].filter(Boolean).join('/');
}

export function maskPhone(text: string): string {
  const digits = text.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  const area = `(${digits.slice(0, 2)}) `;
  if (digits.length <= 6) return area + digits.slice(2);
  const split = digits.length === 11 ? 7 : 6;
  return `${area}${digits.slice(2, split)}-${digits.slice(split)}`;
}

/** Converte DD/MM/AAAA em AAAA-MM-DD. Retorna null se a data não existir ou estiver no futuro. */
export function birthDateToIso(masked: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(masked);
  if (!match) return null;
  const [day, month, year] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  const exists = date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  if (!exists || year < 1900 || date.getTime() > Date.now()) return null;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

export function formatBirthDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : '';
}

type SignUpForm = {
  name: string;
  email: string;
  phoneNumber: string;
  birthDate: string; // DD/MM/AAAA
  password: string;
  confirmPassword: string;
};

export function validateSignUp(form: SignUpForm): string | null {
  if (form.name.trim().length < 2) return 'Informe seu nome.';
  if (!EMAIL_PATTERN.test(form.email.trim())) return 'Informe um e-mail válido.';
  if (form.phoneNumber.replace(/\D/g, '').length < 10) return 'Informe o celular com DDD.';
  if (!birthDateToIso(form.birthDate)) return 'Informe uma data de nascimento válida (DD/MM/AAAA).';
  if (form.password.length < 6) return 'A senha deve ter pelo menos 6 caracteres.';
  if (form.password !== form.confirmPassword) return 'As senhas não conferem.';
  return null;
}
