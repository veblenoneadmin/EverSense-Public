import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { prisma } from './lib/prisma.js';

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'mysql',
  }),

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24,      // refresh if older than 1 day
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60
    }
  },

  socialProviders: {
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId:     process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            scopes: [
              'openid', 'email', 'profile',
              'https://www.googleapis.com/auth/calendar',
              'https://www.googleapis.com/auth/calendar.events',
            ],
            accessType: 'offline',
            prompt: 'consent',
          },
        }
      : {}),
  },

  baseURL: process.env.BETTER_AUTH_URL || process.env.VITE_APP_URL || 'http://localhost:3001',
  secret: process.env.BETTER_AUTH_SECRET || 'fallback-secret-change-in-production',

  trustedOrigins: [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:3001',
    'https://vebtask.com',
    'https://www.vebtask.com',
    'https://vebtaskrevamp-production.up.railway.app',
    'https://eversense-ai.up.railway.app',
    ...(process.env.BETTER_AUTH_URL ? [process.env.BETTER_AUTH_URL] : []),
    ...(process.env.APP_URL ? [process.env.APP_URL] : []),
  ],
});