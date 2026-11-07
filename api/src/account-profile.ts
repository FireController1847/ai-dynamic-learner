import { activeSession, db, now, rateLimit } from './auth/db';
import { ApiError, readJson, respond } from './auth/http';
import type { RuntimeEnv } from './auth/types';

const NAME_LIMIT = 64;
const ABOUT_LIMIT = 500;
const CONTACT_EMAIL_LIMIT = 254;
const PHONE_LIMIT = 40;
const AVATAR_LIMIT = 300_000;

interface AccountProfileRow {
  display_name: string;
  about: string;
  contact_email: string;
  phone: string;
  avatar_data_url: string | null;
  revision: number;
  updated_at: number;
}
function payload(row: AccountProfileRow) {
  return {
    displayName: row.display_name, about: row.about, contactEmail: row.contact_email,
    phone: row.phone, avatarDataUrl: row.avatar_data_url,
  };
}
async function accountId(request: Request, env: RuntimeEnv): Promise<{ id: string; email: string | null }> {
  const session = await activeSession(env, request);
  if (!session) throw new ApiError(401, 'Sign in to access your account profile.');
  return { id: session.account.id, email: session.account.email };
}
function fallbackName(email: string | null): string {
  return email?.split('@')[0]?.slice(0, NAME_LIMIT) || 'Learner';
}
function validate(input: Record<string, unknown>) {
  if (Object.keys(input).some(key => ![
    'revision', 'displayName', 'about', 'contactEmail', 'phone', 'avatarDataUrl',
  ].includes(key))) throw new ApiError(400, 'Invalid account profile fields.');
  const revision = input.revision;
  const displayName = input.displayName;
  const about = input.about;
  const contactEmail = input.contactEmail;
  const phone = input.phone;
  const avatarDataUrl = input.avatarDataUrl;
  if (typeof revision !== 'number' || !Number.isSafeInteger(revision) || revision < 0 ||
      typeof displayName !== 'string' || !displayName.trim() || displayName.length > NAME_LIMIT ||
      typeof about !== 'string' || about.length > ABOUT_LIMIT ||
      typeof contactEmail !== 'string' || contactEmail.length > CONTACT_EMAIL_LIMIT ||
      (contactEmail !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) ||
      typeof phone !== 'string' || phone.length > PHONE_LIMIT ||
      (avatarDataUrl !== null && (typeof avatarDataUrl !== 'string' ||
        avatarDataUrl.length > AVATAR_LIMIT ||
        !/^data:image\/jpeg;base64,(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(avatarDataUrl)))) {
    throw new ApiError(400, 'Invalid account profile.');
  }
  return {
    revision, displayName: displayName.trim(), about, contactEmail: contactEmail.trim(),
    phone: phone.trim(), avatarDataUrl,
  };
}
export async function getAccountProfile(request: Request, env: RuntimeEnv): Promise<Response> {
  const account = await accountId(request, env);
  const stored = await db(env).prepare(
    'SELECT display_name,about,contact_email,phone,avatar_data_url,revision,updated_at ' +
    'FROM account_profiles WHERE account_id=?'
  ).bind(account.id).first<AccountProfileRow>();
  return respond({
    revision: stored?.revision ?? 0,
    updatedAt: stored?.updated_at ?? 0,
    profile: stored ? payload(stored) : {
      displayName: fallbackName(account.email), about: '', contactEmail: '', phone: '',
      avatarDataUrl: null,
    },
  });
}
export async function saveAccountProfile(request: Request, env: RuntimeEnv): Promise<Response> {
  const account = await accountId(request, env);
  const data = validate(await readJson(request, 350_000));
  await rateLimit(env, request, 'account-profile-update', account.id, 90, 3600);
  const timestamp = now();
  let revision: number | undefined;
  if (data.revision === 0) {
    const created = await db(env).prepare(
      'INSERT OR IGNORE INTO account_profiles(' +
        'account_id,display_name,about,contact_email,phone,avatar_data_url,revision,updated_at) ' +
        'VALUES(?,?,?,?,?,?,1,?) RETURNING revision'
    ).bind(account.id, data.displayName, data.about, data.contactEmail,
      data.phone, data.avatarDataUrl, timestamp).first<{ revision: number }>();
    revision = created?.revision;
  } else {
    const updated = await db(env).prepare(
      'UPDATE account_profiles SET display_name=?,about=?,contact_email=?,phone=?,' +
        'avatar_data_url=?,revision=revision+1,updated_at=? ' +
        'WHERE account_id=? AND revision=? RETURNING revision'
    ).bind(data.displayName, data.about, data.contactEmail, data.phone,
      data.avatarDataUrl, timestamp, account.id, data.revision).first<{ revision: number }>();
    revision = updated?.revision;
  }
  if (revision === undefined) {
    throw new ApiError(409, 'Your profile changed on another device. Reload it before saving.');
  }
  return respond({ revision, updatedAt: timestamp, profile: {
    displayName: data.displayName, about: data.about, contactEmail: data.contactEmail,
    phone: data.phone, avatarDataUrl: data.avatarDataUrl,
  } });
}
