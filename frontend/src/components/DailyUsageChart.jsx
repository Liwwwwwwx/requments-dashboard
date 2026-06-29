const PROVIDER_KEY = {
  kimi: 'kimiWeeklyUsed',
  minimax: 'minimaxWeeklyUsed',
  deepseek: 'deepseekCost'
};

export function resolveDailyUsed(today, provider) {
  if (!today || !provider) return null;
  const key = PROVIDER_KEY[provider];
  if (!key) return null;
  const value = Number(today[key]);
  return Number.isFinite(value) ? value : null;
}
