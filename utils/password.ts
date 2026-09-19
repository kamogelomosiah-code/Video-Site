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
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    failures.push("Must contain at least one special character");
  }

  if (context) {
    const { email, name, username } = context;
    if (email) {
      const emailLocal = email.split('@')[0];
      if (password.toLowerCase().includes(emailLocal.toLowerCase())) {
        failures.push("Password cannot contain parts of your email address");
      }
    }
    if (name && password.toLowerCase().includes(name.toLowerCase())) {
      failures.push("Password cannot contain your name");
    }
    if (username && password.toLowerCase().includes(username.toLowerCase())) {
      failures.push("Password cannot contain your username");
    }
  }

  return {
    ok: failures.length === 0,
    failures
  };
}
