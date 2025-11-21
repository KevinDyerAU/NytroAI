/**
 * Environment configuration validation utilities
 * Used to ensure required environment variables are set before app initialization
 */

export interface EnvValidationResult {
  isValid: boolean;
  missingVars: string[];
  warnings: string[];
}

/**
 * Required environment variables for the application
 */
export const REQUIRED_ENV_VARS = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
] as const;

/**
 * Optional but recommended environment variables
 */
export const OPTIONAL_ENV_VARS = [
  'VITE_STRIPE_PUBLISHABLE_KEY',
] as const;

/**
 * Validates that all required environment variables are set
 */
export function validateEnvironment(): EnvValidationResult {
  const missingVars: string[] = [];
  const warnings: string[] = [];

  // Check required variables
  REQUIRED_ENV_VARS.forEach(varName => {
    const value = import.meta.env[varName];
    if (!value || value.trim() === '') {
      missingVars.push(varName);
    }
  });

  // Check optional variables and warn if missing
  OPTIONAL_ENV_VARS.forEach(varName => {
    const value = import.meta.env[varName];
    if (!value || value.trim() === '') {
      warnings.push(`${varName} is not set - some features may not work`);
    }
  });

  // Check for placeholder values
  REQUIRED_ENV_VARS.forEach(varName => {
    const value = import.meta.env[varName];
    if (value && (value.includes('placeholder') || value.includes('your-') || value.includes('example'))) {
      warnings.push(`${varName} appears to contain a placeholder value`);
    }
  });

  return {
    isValid: missingVars.length === 0,
    missingVars,
    warnings,
  };
}

/**
 * Gets a validated environment variable value
 * Throws an error if the variable is not set
 */
export function getRequiredEnvVar(varName: string): string {
  const value = import.meta.env[varName];
  if (!value || value.trim() === '') {
    throw new Error(`Required environment variable ${varName} is not set`);
  }
  return value;
}

/**
 * Gets an optional environment variable value
 * Returns undefined if not set
 */
export function getOptionalEnvVar(varName: string): string | undefined {
  const value = import.meta.env[varName];
  return value && value.trim() !== '' ? value : undefined;
}
