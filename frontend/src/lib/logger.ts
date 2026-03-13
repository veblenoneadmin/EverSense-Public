// Simple frontend logger for client-side logging
export const logger = {
  error: (message: string, data?: any, error?: any) => {
    console.error(`[ERROR] ${message}`, data, error);
  },
  warn: (message: string, data?: any, error?: any) => {
    console.warn(`[WARN] ${message}`, data, error);
  },
  info: (message: string, data?: any, error?: any) => {
    console.info(`[INFO] ${message}`, data, error);
  },
  debug: (message: string, data?: any, error?: any) => {
    console.debug(`[DEBUG] ${message}`, data, error);
  }
};