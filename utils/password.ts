export interface PasswordPolicyContext {
  email?: string;
  name?: string;
  username?: string;
}

export interface PasswordCheckResult {
  ok: boolean;
  failures: string[];
}

export function checkPassword(password: string, context?: PasswordPolicyContext): PasswordCheckResult {
  const failures: string[] = [];

  if (!password) {
    return { ok: false, failures: ["Password is required"] };
  }

  if (password.length < 8) {
    failures.push("Must be at least 8 characters long");
  }
  if (!/[A-Z]/.test(password)) {
    failures.push("Must contain at least one uppercase letter");
  }
  if (!/[a-z]/.test(password)) {
    failures.push("Must contain at least one lowercase letter");
  }
  if (!/[0-9]/.test(password)) {
    failures.push("Must contain at least one number");
  }
  if (!/[^A-Za-z0-9\s]/.test(password)) {
    failures.push("Must contain at least one special character");
  }

  if (context) {
    const { email, name, username } = context;
    const lower = password.toLowerCase();
    // Only check meaningful fragments (3+ chars) so short names/emails don't block everything.
    if (email) {
      const emailLocal = email.split('@')[0];
      if (emailLocal.length >= 3 && lower.includes(emailLocal.toLowerCase())) {
        failures.push("Password cannot contain parts of your email address");
      }
    }
    const nameParts = (name || '').toLowerCase().split(/\s+/).filter(part => part.length >= 3);
    if (nameParts.some(part => lower.includes(part))) {
      failures.push("Password cannot contain your name");
    }
    if (username && username.length >= 3 && !username.includes('@') && lower.includes(username.toLowerCase())) {
      failures.push("Password cannot contain your username");
    }
  }

  return {
    ok: failures.length === 0,
    failures
  };
}
