type ApiEnvelope<T> = { code: number; message: string; data: T };

const fetch = globalThis.fetch;

function dateToLocalDate(date: Date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

async function api<T>(baseUrl: string, path: string, opts?: { method?: string; token?: string; body?: unknown }) {
  const resp = await fetch(`${baseUrl}${path}`, {
    method: opts?.method ?? "GET",
    headers: {
      Accept: "application/json",
      ...(opts?.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      ...(opts?.body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: opts?.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const json = (await resp.json()) as ApiEnvelope<T>;
  if (typeof json?.code !== "number") throw new Error(`invalid response for ${path}`);
  if (json.code !== 0) throw new Error(`api error ${json.code} ${json.message} (${path})`);
  return json.data;
}

async function main() {
  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  const baseUrl = process.env.SMOKE_BASE_URL ?? `http://127.0.0.1:${port}`;
  const now = Date.now();
  const email = `smoke+${now}@example.com`;
  const password = "123456";
  const displayName = `smoke-${now}`;
  const today = dateToLocalDate(new Date());

  console.log(`[smoke] baseUrl=${baseUrl}`);
  await api<{ ok: boolean }>(baseUrl, "/health");

  const auth = await api<{ token: string; user: { id: string; points: number } }>(baseUrl, "/api/auth/register", {
    method: "POST",
    body: { email, password, displayName },
  });
  console.log(`[smoke] registered user=${auth.user.id}`);

  const createHabit = async (name: string) => {
    const habit = await api<{ id: string; name: string }>(baseUrl, "/api/habits", {
      method: "POST",
      token: auth.token,
      body: { name, frequency: "DAILY", targetCount: 1 },
    });
    return habit.id;
  };

  const habit1 = await createHabit("smoke-habit-1");
  const habit2 = await createHabit("smoke-habit-2");

  await api(baseUrl, "/api/checkins", { method: "PUT", token: auth.token, body: { habitId: habit1, localDate: today, count: 1 } });
  await api(baseUrl, "/api/checkins", { method: "PUT", token: auth.token, body: { habitId: habit2, localDate: today, count: 1 } });

  const me = await api<{ points: number }>(baseUrl, "/api/me", { token: auth.token });
  console.log(`[smoke] points=${me.points}`);

  await api(baseUrl, `/api/analytics/habit?habitId=${encodeURIComponent(habit1)}`, { token: auth.token });

  const group = await api<{ id: string; inviteCode?: string | null }>(baseUrl, "/api/groups", {
    method: "POST",
    token: auth.token,
    body: { name: "smoke-group", joinType: "INVITE" },
  });
  await api(baseUrl, `/api/groups/${encodeURIComponent(group.id)}/members`, { token: auth.token });
  await api(baseUrl, `/api/groups/${encodeURIComponent(group.id)}/leaderboard?page=1&pageSize=20`, { token: auth.token });

  await api(baseUrl, "/api/assets?type=BADGE", { token: auth.token });

  await api(baseUrl, "/api/gamification/redeem", { method: "POST", token: auth.token, body: { assetKey: "badge_bronze" } });
  const owned = await api<{ items: Array<{ assetKey: string }> }>(baseUrl, "/api/assets/owned?type=BADGE", { token: auth.token });
  if (!owned.items.some((it) => it.assetKey === "badge_bronze")) throw new Error("expected badge_bronze owned");

  console.log("[smoke] OK");
}

main().catch((err) => {
  console.error("[smoke] FAILED", err);
  process.exitCode = 1;
});
