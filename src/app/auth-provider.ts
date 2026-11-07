import type { AuthProvider } from '../core/auth/provider.ts';

// Deliberately unconfigured until a trusted remote authentication service
// is supplied. No local password database, fake login, or hardcoded token.
export const configuredAuthProvider: AuthProvider | null = null;
