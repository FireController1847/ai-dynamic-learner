/**
 * Trust boundary for an eventual remote authentication integration.
 * A provider MUST verify session identity against its trusted server;
 * a local profile, identity label, or stored flag is never authentication.
 * Providers own their session-token/cookie handling; application code does
 * not write passwords or bearer tokens to localStorage or IndexedDB.
 */
export interface VerifiedAccount {
  id: string;
  providerId: string;
  email: string | null;
  emailVerified: boolean;
}
export interface EmailCredentials {
  email: string;
  password: string;
}
export type AuthResult =
  | { status: 'authenticated'; account: VerifiedAccount }
  | { status: 'verification-required'; email: string };
export type RestoreResult = AuthResult
  | { status: 'signed-out' }
  | { status: 'connection-required'; emailHint?: string };
export interface AuthProvider {
  readonly id: string;
  restore(): Promise<RestoreResult>;
  signIn(credentials: EmailCredentials): Promise<AuthResult>;
  register(credentials: EmailCredentials): Promise<AuthResult>;
  requestPasswordReset(email: string): Promise<void>;
  signOut(): Promise<void>;
}
export function validAccount(value: VerifiedAccount): boolean {
  return !!value && typeof value.id === 'string' && value.id.length > 0 &&
    value.id.length <= 256 && typeof value.providerId === 'string' && value.providerId.length > 0 &&
    value.providerId.length <= 128 && (value.email === null ||
      (typeof value.email === 'string' && value.email.length <= 254)) &&
    typeof value.emailVerified === 'boolean';
}
