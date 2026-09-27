/** The public demo of basedb: one shared account per language, prefilled on its login screen. */
export const DEMO_URL = 'https://demo.basedb.eodia.com/';

/**
 * The demo in the language of the page that links to it — the application's code of the
 * language (`pt-BR`, `zh-CN`): its login screen in that language, and that language's
 * account prefilled, whatever the browser asks for.
 */
export const demoUrl = (lang: string): string => `${DEMO_URL}?lang=${encodeURIComponent(lang)}`;
