// Run a task without blocking — or being able to break — the HTTP response.
//
// On Vercel serverless, work started after res.json() is NOT guaranteed to
// finish: the instance can be frozen the moment the response is sent. The
// official primitive for "keep running after responding" is @vercel/functions
// waitUntil(), which holds the invocation open until the promise settles.
//
// On a long-running server (Railway) there is no such constraint — a detached
// promise simply runs in the background of the persistent process.
//
// Either way the deferred work can never reject into the request: any failure
// is caught and logged so a broken analysis pass never costs the user their
// reply.

let waitUntilFn = null;
try {
  // Present on Vercel; absent on Railway/local — both are fine.
  const mod = await import('@vercel/functions');
  if (typeof mod.waitUntil === 'function') waitUntilFn = mod.waitUntil;
} catch {
  // Not on Vercel — background promises run normally on a persistent process.
}

export function deferTask(run, label = 'task') {
  const promise = Promise.resolve()
    .then(run)
    .catch((err) => {
      console.warn(`[defer] ${label} failed:`, err?.message || err);
    });

  // Only reach for waitUntil inside the Vercel runtime; calling it elsewhere
  // throws ("outside a request scope"), which we swallow — the promise still runs.
  if (waitUntilFn && process.env.VERCEL) {
    try {
      waitUntilFn(promise);
    } catch {
      /* not in a request scope — promise runs on its own */
    }
  }

  return promise;
}
