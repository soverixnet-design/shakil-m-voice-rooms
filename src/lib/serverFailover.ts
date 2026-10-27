import {gameServerUrl} from './gameServerUrl';

type HealthRequest = typeof fetch;
const HEALTHY_MS = 15000;
const UNHEALTHY_MS = 20000;

export function createGameServerSelector({
  request = fetch,
  now = Date.now,
  probeTimeoutMs = 2200
}: {request?: HealthRequest; now?: () => number; probeTimeoutMs?: number} = {}) {
  const cache = new Map<string, {healthy: boolean; until: number}>();

  async function probe(base: string) {
    const state = cache.get(base);
    if (state && state.until > now()) return state.healthy;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), probeTimeoutMs);
    let healthy = false;
    try {
      const response = await request(base + '/health', {
        method: 'GET',
        signal: controller.signal,
        cache: 'no-store'
      });
      if (response.ok) {
        const payload = await response.json();
        healthy = payload?.status === 'ok';
      }
    } catch {
      healthy = false;
    } finally {
      clearTimeout(timer);
    }
    cache.set(base, {healthy, until: now() + (healthy ? HEALTHY_MS : UNHEALTHY_MS)});
    return healthy;
  }

  async function choose(primary: string, backup = ''): Promise<string> {
    const main = gameServerUrl(primary);
    if (!backup) return main; // original single-server behavior
    const standby = gameServerUrl(backup);
    if (main === standby) return main;

    if (await probe(main)) return main;
    if (await probe(standby)) return standby;
    throw Object.assign(Error('server-unavailable'), {code: 'functions/unavailable'});
  }

  function fail(url: string) {
    const base = gameServerUrl(url);
    cache.set(base, {healthy: false, until: now() + UNHEALTHY_MS});
  }

  return {choose, fail};
}

const defaultSelector = createGameServerSelector();
export const selectGameServer = defaultSelector.choose;
export const markGameServerFailed = defaultSelector.fail;

export function isBackendUnavailable(error: any) {
  return error?.name === 'TypeError' ||
    error?.name === 'AbortError' ||
    ['functions/unavailable', 'functions/deadline-exceeded', 'unavailable', 'server-unavailable', 'database-connection-failed'].includes(String(error?.code || ''));
}
