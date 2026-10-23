// Words for the claw machine in English and Chinese; the page's own language picks one.
// Every plush toy comes from a collection on the photography site, and the prize card links there.
import type { Kind } from './prizes';

export type Text = { en: string; zh: string };

export const isZh = () => document.documentElement.lang.toLowerCase().startsWith('zh');
export const tr = (t: Text) => (isZh() ? t.zh : t.en);
export const fill = (t: Text, values: Record<string, string | number>) =>
  tr(t).replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? ''));

export const T = {
  start: { en: 'Coin in. Steer the claw!', zh: '投币成功，开始移动爪子！' },
  saved: { en: 'Coin saved for the next go.', zh: '币存好了，下一局用。' },
  hurry: { en: 'Five seconds left!', zh: '还剩五秒！' },
  empty: { en: 'Nothing in the claw.', zh: '什么也没抓到。' },
  slipped: { en: 'It slipped out!', zh: '滑掉了！' },
  close: { en: 'So close…', zh: '差一点点……' },
  full: { en: 'The coin slot is full.', zh: '币已经塞满了。' },
  needCoin: { en: 'Put in a coin first.', zh: '先投个币吧。' },
  won: { en: 'Got it!', zh: '抓到啦！' },
  lives: { en: 'It lives in {word} →', zh: '它住在「{word}」→' },
  plus: { en: '+{n} pts', zh: '+{n} 分' },
  rank: { en: 'You are #{n} on the board', zh: '你现在排第 {n} 名' },
  sign: { en: 'Leave your name to get on the board ↓', zh: '留个名字就能上榜 ↓' },
  named: { en: 'Saved. Your catches now go on the board.', zh: '存好了，之后抓到的都会记上榜。' },
  renamed: { en: 'Name changed.', zh: '名字改好了。' },
  nameEmpty: { en: 'Type a name first.', zh: '先写个名字吧。' },
  boardWait: { en: 'Loading the board…', zh: '正在加载榜单……' },
  boardNone: { en: 'No one on the board yet. Catch something and be the first!', zh: '还没有人上榜，抓一个当第一名吧！' },
  boardOff: { en: 'The shared board isn’t open yet. Your own score is kept on this device.', zh: '全站排行榜还没开通，你的分数先存在这台设备上。' },
  boardDown: { en: 'Couldn’t reach the board just now.', zh: '暂时连不上排行榜。' },
  you: { en: 'you', zh: '你' },
  pts: { en: 'pts', zh: '分' },
  catches: { en: '{n} caught', zh: '抓到 {n} 个' },
  golden: { en: 'golden ×{n}', zh: '金松鼠 ×{n}' },
} satisfies Record<string, Text>;

export const PLUSH: Record<Kind, Text> = {
  squirrel: { en: 'a squirrel', zh: '一只松鼠' },
  leaf: { en: 'a maple leaf', zh: '一片枫叶' },
  duck: { en: 'a duckling', zh: '一只小黄鸭' },
  moon: { en: 'a sleepy moon', zh: '一个睡觉的月亮' },
  snail: { en: 'a snail', zh: '一只蜗牛' },
  golden: { en: 'the golden squirrel', zh: '金色松鼠' },
};

/** Where each toy lives on the photography site (the collections' words are drafts there too). */
export const HOMES: Record<Kind, { slug: string; word: Text }> = {
  squirrel: { slug: 'cache', word: { en: 'Cache', zh: '藏' } },
  golden: { slug: 'cache', word: { en: 'Cache', zh: '藏' } },
  leaf: { slug: 'turning', word: { en: 'Turning', zh: '转色' } },
  duck: { slug: 'glitter', word: { en: 'Glitter', zh: '波光' } },
  moon: { slug: 'still', word: { en: 'Still', zh: '还在' } },
  snail: { slug: 'slow', word: { en: 'Slow', zh: '慢' } },
};

export const homeHref = (kind: Kind) => (isZh() ? `/photographs/zh/${HOMES[kind].slug}/` : `/photographs/${HOMES[kind].slug}/`);
