import { storage } from './storage';

interface StoredCredential {
  salt: string;
  hash: string;
}

const KEY = 'wt.demoCredentials';
const HEX = (bytes: Uint8Array): string => Array.from(bytes).map((byte) => byte.toString(16).padStart(2, '0')).join('');

const digest = async (password: string, salt: string): Promise<string> => {
  if (!globalThis.crypto?.subtle) throw new Error('需要 HTTPS 安全上下文才能创建或校验演示账号');
  const bytes = new TextEncoder().encode(`wetrust-demo:${salt}:${password}`);
  return HEX(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes)));
};

const read = (): Record<string, StoredCredential> => {
  try { return JSON.parse(storage.get(KEY) ?? '{}') as Record<string, StoredCredential>; }
  catch { return {}; }
};

export const makeTemporaryPassword = (): string => {
  if (!globalThis.crypto?.getRandomValues) throw new Error('需要安全随机数源才能创建演示账号');
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(14));
  return `Wt@${HEX(bytes).slice(0, 18)}`;
};

export const saveDemoCredential = async (username: string, password: string): Promise<void> => {
  const salt = HEX(globalThis.crypto.getRandomValues(new Uint8Array(16)));
  const hash = await digest(password, salt);
  storage.set(KEY, JSON.stringify({ ...read(), [username]: { salt, hash } }));
};

export const verifyDemoCredential = async (username: string, password: string): Promise<boolean> => {
  const record = read()[username];
  if (!record) return false;
  try { return (await digest(password, record.salt)) === record.hash; }
  catch { return false; }
};

export const hasDemoCredential = (username: string): boolean => Boolean(read()[username]);

export const deleteDemoCredential = (username: string): void => {
  const data = read();
  delete data[username];
  storage.set(KEY, JSON.stringify(data));
};