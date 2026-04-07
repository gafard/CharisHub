/**
 * Logger centralisé pour CharisHub.
 *
 * En production, seules les erreurs sont affichées.
 * En développement, tous les niveaux sont actifs.
 */

const isDev = process.env.NODE_ENV === 'development';

/* eslint-disable no-console */
export const logger = {
  log: isDev ? console.log.bind(console) : () => {},
  warn: isDev ? console.warn.bind(console) : () => {},
  error: console.error.bind(console), // Toujours actif
  info: isDev ? console.info.bind(console) : () => {},
  debug: isDev ? console.debug.bind(console) : () => {},
};
/* eslint-enable no-console */

export default logger;
