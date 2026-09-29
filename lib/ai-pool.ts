import { getAIKeys, type AIKey } from "./keys";

type State = {
  failures: number;
  cooldownUntil: number;
  lastUsed: number;
};

const state = new Map<number, State>();

function getState(id: number) {
  let s = state.get(id);
  if (!s) {
    s = { failures: 0, cooldownUntil: 0, lastUsed: 0 };
    state.set(id, s);
  }
  return s;
}

function eligible(keys: AIKey[]) {
  const now = Date.now();
  return keys
    .filter((k) => {
      const s = getState(k.id);
      return k.enabled && k.key && s.cooldownUntil <= now;
    })
    .sort((a, b) => getState(a.id).lastUsed - getState(b.id).lastUsed);
}

export function markSuccess(id: number) {
  const s = getState(id);
  s.failures = 0;
  s.cooldownUntil = 0;
  s.lastUsed = Date.now();
}

export function markFailure(id: number, message: string) {
  const s = getState(id);
  s.failures++;
  s.lastUsed = Date.now();

  const rate = /429|rate.?limit|quota|resource.?exhausted/i.test(message);
  const base = rate ? 30_000 : 5_000;
  s.cooldownUntil =
    Date.now() + Math.min(10 * 60_000, base * Math.pow(2, Math.min(s.failures - 1, 4)));
}

export async function pickKeys() {
  return eligible(await getAIKeys());
}

export function poolStatus(keys: AIKey[]) {
  return keys.map((k) => {
    const s = getState(k.id);
    return {
      id: k.id,
      provider: k.provider,
      enabled: k.enabled,
      status: s.cooldownUntil > Date.now() ? "cooldown" : "ready",
      cooldownUntil: s.cooldownUntil,
      failures: s.failures,
      lastUsed: s.lastUsed
    };
  });
}

export async function getPoolStatus() {
  return poolStatus(await getAIKeys());
}
