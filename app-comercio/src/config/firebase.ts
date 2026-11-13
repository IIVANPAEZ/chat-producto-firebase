import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { env } from './env';

const app = initializeApp(env.firebase);

export const db = getDatabase(app);
