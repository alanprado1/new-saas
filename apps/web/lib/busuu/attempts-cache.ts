// In-memory copy of the last validated `/api/course/attempts?include=active` response, per owner.
// The course map and Home show it immediately on return visits, then refresh from the server.
// It lives for the browser tab's session only and is never written to storage.

export type CachedAttempts = { attempts: unknown[]; inProgress: unknown };

const byOwner = new Map<string, CachedAttempts>();

export function getCachedAttempts(owner: string): CachedAttempts | null {
  return byOwner.get(owner) ?? null;
}

export function setCachedAttempts(owner: string, data: CachedAttempts) {
  byOwner.set(owner, data);
}

export function clearCachedAttempts(owner?: string) {
  if (owner) byOwner.delete(owner);
  else byOwner.clear();
}
