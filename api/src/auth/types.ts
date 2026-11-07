export type SocialProvider = 'google' | 'microsoft';
export type RuntimeEnv = Env & {
  dynlearn_data: D1Database;
  FRONTEND_ORIGIN?: string;
  API_ORIGIN?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  MICROSOFT_CLIENT_ID?: string;
  MICROSOFT_CLIENT_SECRET?: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  // Injected only by the local npm start runner. Not a production auth setting.
  LOCAL_MAIL_PREVIEW?: string;
  AUTH_RATE_SECRET?: string;
  AUTH_PEPPER?: string;
};
export interface AccountRow {
  id: string;
  email: string | null;
  email_verified: number;
  created_at: number;
}
export interface PasswordRow { email: string; account_id: string; password_hash: string }
export interface ActionRow { account_id: string; kind: 'verify' | 'reset'; expires_at: number }
export interface OAuthRequestRow {
  browser_hash: string;
  code_verifier: string;
  provider: SocialProvider;
  expires_at: number;
}
export interface VerifiedProfile {
  id: string;
  providerId: string;
  email: string | null;
  emailVerified: boolean;
}
export function publicProfile(row: AccountRow, providerId: string): VerifiedProfile {
  return { id: row.id, providerId, email: row.email, emailVerified: row.email_verified === 1 };
}
