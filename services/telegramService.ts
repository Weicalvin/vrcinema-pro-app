import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { Api } from 'telegram/tl';

const ENV_API_ID = Number(import.meta.env.VITE_TELEGRAM_API_ID);
const ENV_API_HASH = import.meta.env.VITE_TELEGRAM_API_HASH;

let client: TelegramClient | null = null;
let sessionString = localStorage.getItem('telegram_session') || '';

export const initClient = async (apiId?: number, apiHash?: string) => {
  if (client) return client;
  
  const finalApiId = apiId || ENV_API_ID;
  const finalApiHash = apiHash || ENV_API_HASH;

  if (!finalApiId || !finalApiHash) {
    console.warn('Telegram API ID or Hash missing');
    return null;
  }

  const stringSession = new StringSession(sessionString);
  client = new TelegramClient(stringSession, finalApiId, finalApiHash, {
    connectionRetries: 5,
  });

  try {
    await client.connect();
    // Save session if it changed (e.g. after login)
    const newSession = client.session.save() as unknown as string;
    if (newSession !== sessionString) {
      localStorage.setItem('telegram_session', newSession);
      sessionString = newSession;
    }
  } catch (err) {
    console.error('Failed to connect to Telegram:', err);
    client = null; // Reset client on failure
  }
  
  return client;
};

export const sendCode = async (phoneNumber: string, apiId?: number, apiHash?: string) => {
  const client = await initClient(apiId, apiHash);
  if (!client) throw new Error('Client not initialized. Missing API ID/Hash?');
  return await client.sendCode({
    apiId: apiId || ENV_API_ID,
    apiHash: apiHash || ENV_API_HASH,
    phoneNumber: phoneNumber,
  });
};

export const signIn = async (phoneNumber: string, phoneCodeHash: string, phoneCode: string, apiId?: number, apiHash?: string) => {
  const client = await initClient(apiId, apiHash);
  if (!client) throw new Error('Client not initialized');
  
  try {
    await client.invoke(new Api.auth.SignIn({
      phoneNumber,
      phoneCodeHash,
      phoneCode,
    }));
    localStorage.setItem('telegram_session', client.session.save() as unknown as string);
    return true;
  } catch (e: any) {
    if (e.message.includes('SESSION_PASSWORD_NEEDED')) {
      return 'PASSWORD_NEEDED';
    }
    throw e;
  }
};

export const signInWithPassword = async (password: string, apiId?: number, apiHash?: string) => {
  const client = await initClient(apiId, apiHash);
  if (!client) throw new Error('Client not initialized');

  await client.signInWithPassword({
    apiId: apiId || ENV_API_ID,
    apiHash: apiHash || ENV_API_HASH,
    password: password,
  });
  localStorage.setItem('telegram_session', client.session.save() as unknown as string);
  return true;
};

export const getDialogs = async () => {
  const client = await initClient();
  if (!client) throw new Error('Client not initialized');
  // Fetch dialogs (chats)
  const dialogs = await client.getDialogs({ limit: 20 });
  return dialogs;
};

export const getMessages = async (chatId: any, limit = 20) => {
  const client = await initClient();
  if (!client) throw new Error('Client not initialized');
  const messages = await client.getMessages(chatId, { limit });
  return messages;
};

export const logout = async () => {
  const client = await initClient();
  if (client) {
    await client.disconnect();
  }
  localStorage.removeItem('telegram_session');
  sessionString = '';
  client = null;
};

export const isLoggedIn = async () => {
  const client = await initClient();
  if (!client) return false;
  return await client.checkAuthorization();
};
