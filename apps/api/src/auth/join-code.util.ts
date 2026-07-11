import { randomBytes } from 'node:crypto';

// institutions.join_code is varchar(20): 6 (initials) + '-2024' (5) + '-A3F9' (5) = 16, safe margin.
const MAX_INITIALS = 6;
const MAX_GENERATION_ATTEMPTS = 10;

export function buildJoinCodeInitials(institutionName: string): string {
  const initials = institutionName
    .split(/\s+/)
    .map((word) => word.match(/[a-zA-Z0-9]/)?.[0]?.toUpperCase())
    .filter((char): char is string => Boolean(char))
    .join('')
    .slice(0, MAX_INITIALS);
  return initials.length > 0 ? initials : 'INS';
}

export function randomJoinCodeSuffix(): string {
  return randomBytes(2).toString('hex').toUpperCase();
}

export async function generateUniqueJoinCode(
  institutionName: string,
  isTaken: (candidate: string) => Promise<boolean>,
): Promise<string> {
  const base = `${buildJoinCodeInitials(institutionName)}-${new Date().getFullYear()}`;
  if (!(await isTaken(base))) {
    return base;
  }
  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
    const candidate = `${base}-${randomJoinCodeSuffix()}`;
    if (!(await isTaken(candidate))) {
      return candidate;
    }
  }
  throw new Error('Could not generate a unique join_code after 10 attempts.');
}
