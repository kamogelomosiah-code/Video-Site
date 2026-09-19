import React from "react";
import { checkPassword, PasswordPolicyContext } from "../utils/password";

interface PasswordStrengthProps {
  password?: string;
  context?: PasswordPolicyContext;
}

const PasswordStrength: React.FC<PasswordStrengthProps> = ({ password = "", context }) => {
  const result = checkPassword(password, context);

  // Calculate score based on conditions passed
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score++;

  let strengthColor = "bg-zinc-800";
  let strengthText = "Very Weak";

  if (password.length > 0) {
    if (score <= 2) {
      strengthColor = "bg-red-500";
      strengthText = "Weak";
    } else if (score <= 4) {
      strengthColor = "bg-yellow-500";
      strengthText = "Fair";
    } else {
      strengthColor = "bg-green-500";
      strengthText = "Strong";
    }
  } else {
    strengthText = "";
  }

  return (
    <div className="space-y-2 mt-2">
      <div className="flex justify-between items-center text-xs">
        <span className="text-zinc-500 font-medium">Password Strength</span>
        {strengthText && (
          <span
            className={`font-semibold uppercase tracking-wider text-[10px] ${
              score <= 2
                ? "text-red-500"
                : score <= 4
                ? "text-yellow-500"
                : "text-green-500"
            }`}
          >
            {strengthText}
          </span>
        )}
      </div>

      {/* Progress Bars */}
      <div className="grid grid-cols-5 gap-1.5 h-1">
        {[1, 2, 3, 4, 5].map((step) => {
          let stepColor = "bg-zinc-800/80";
          if (password.length > 0) {
            if (step <= score) {
              if (score <= 2) stepColor = "bg-red-500";
              else if (score <= 4) stepColor = "bg-yellow-500";
              else stepColor = "bg-green-500";
            }
          }
          return (
            <div
              key={step}
              className={`h-full rounded-full transition-all duration-300 ${stepColor}`}
            />
          );
        })}
      </div>

      {/* Validation Failures */}
      {password.length > 0 && !result.ok && (
        <ul className="text-[11px] text-zinc-500 space-y-1 list-disc pl-3 pt-1">
          {result.failures.map((fail, i) => (
            <li key={i} className="leading-tight">
              {fail}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default PasswordStrength;
