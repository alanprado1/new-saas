/** Each retry uses the original SM-2 state, so an ambiguous response cannot
 * increment progress twice: the server upserts the same resulting answer. */
export async function saveWithRetry<T>(save: () => Promise<T>, wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms)), signal?: AbortSignal): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    signal?.throwIfAborted();
    try { return await save(); }
    catch (error) {
      if (attempt >= 2) throw error;
      await wait(300 * (attempt + 1));
    }
  }
}
