import en from '@/locales/en.json';
import zhTW from '@/locales/zh-TW.json';
import zhCN from '@/locales/zh-CN.json';
import ko from '@/locales/ko.json';
import ja from '@/locales/ja.json';
import pt from '@/locales/pt.json';

// Same shape as the original client/src/i18n/messages.ts (exported as `wD` there).
export const messages: Record<string, any> = {
  en,
  'zh-TW': zhTW,
  'zh-CN': zhCN,
  ko,
  ja,
  pt,
};
