import {
  API_URL,
  CHAT_ID,
  FIREBASE_API_KEY,
  FIREBASE_APP_ID,
  FIREBASE_AUTH_DOMAIN,
  FIREBASE_DATABASE_URL,
  FIREBASE_PROJECT_ID,
} from '@env';

const required = (name: string, value: string | undefined): string => {
  if (!value || value.trim() === '') {
    throw new Error(
      `Falta la variable de entorno ${name}. Copiá .env.example a .env, completala y reiniciá Metro con --reset-cache.`,
    );
  }
  return value.trim();
};

export const env = {
  firebase: {
    apiKey: required('FIREBASE_API_KEY', FIREBASE_API_KEY),
    authDomain: required('FIREBASE_AUTH_DOMAIN', FIREBASE_AUTH_DOMAIN),
    databaseURL: required('FIREBASE_DATABASE_URL', FIREBASE_DATABASE_URL),
    projectId: required('FIREBASE_PROJECT_ID', FIREBASE_PROJECT_ID),
    appId: required('FIREBASE_APP_ID', FIREBASE_APP_ID),
  },
  chatId: required('CHAT_ID', CHAT_ID),
  apiUrl: required('API_URL', API_URL).replace(/\/+$/, ''),
} as const;
