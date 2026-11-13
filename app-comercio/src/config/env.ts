const required = (name: string, value: string | undefined): string => {
  if (!value || value.trim() === '') {
    throw new Error(
      `Falta la variable de entorno ${name}. Copiá .env.example a .env y completala.`,
    );
  }
  return value.trim();
};

export const env = {
  firebase: {
    apiKey: required('VITE_FIREBASE_API_KEY', import.meta.env.VITE_FIREBASE_API_KEY),
    authDomain: required('VITE_FIREBASE_AUTH_DOMAIN', import.meta.env.VITE_FIREBASE_AUTH_DOMAIN),
    databaseURL: required('VITE_FIREBASE_DATABASE_URL', import.meta.env.VITE_FIREBASE_DATABASE_URL),
    projectId: required('VITE_FIREBASE_PROJECT_ID', import.meta.env.VITE_FIREBASE_PROJECT_ID),
    appId: required('VITE_FIREBASE_APP_ID', import.meta.env.VITE_FIREBASE_APP_ID),
  },
  chatId: required('VITE_CHAT_ID', import.meta.env.VITE_CHAT_ID),
} as const;
