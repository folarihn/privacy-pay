export function isSolDomain(input: string): boolean {
  return input.trim().toLowerCase().endsWith(".sol");
}

export async function resolveSolDomain(domain: string): Promise<string | null> {
  const name = domain.trim().toLowerCase().replace(/\.sol$/, "");
  if (!name) return null;

  try {
    const res = await fetch(
      `https://sns-sdk-proxy.bonfida.workers.dev/resolve/${encodeURIComponent(name)}`,
      { headers: { Accept: "application/json" } },
    );
    if (!res.ok) return null;

    const data = (await res.json()) as { s: string; result?: string };
    if (data.s === "ok" && typeof data.result === "string") {
      return data.result;
    }
    return null;
  } catch {
    return null;
  }
}
