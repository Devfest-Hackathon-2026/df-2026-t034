// React Native's fetch polyfill reads Blob responses through FileReader.
// These small JSON APIs use XHR text directly, keeping one request and the
// caller's existing cancellation/deadline; no automatic POST retries.
// https://reactnative.dev/docs/network#using-other-networking-libraries
export const jsonTransport: typeof fetch = async (input, init) => {
  if (typeof XMLHttpRequest === 'undefined' || (typeof input !== 'string' && !(input instanceof URL))) {
    return fetch(input, init);
  }
  if (init?.body !== undefined && init.body !== null && typeof init.body !== 'string') {
    throw new TypeError('JSON transport requires a string body');
  }
  return new Promise<Response>((resolve, reject) => {
    const signal = init?.signal;
    const xhr = new XMLHttpRequest();
    let settled = false;
    const finish = (error?: Error, response?: Response) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener('abort', cancel);
      xhr.onload = xhr.onerror = xhr.onabort = xhr.ontimeout = null;
      if (error) reject(error); else resolve(response!);
    };
    const cancel = () => { finish(new DOMException('Request cancelled', 'AbortError')); xhr.abort(); };
    if (signal?.aborted) { cancel(); return; }
    try {
      xhr.open(init?.method ?? 'GET', String(input), true);
      xhr.responseType = 'text';
      xhr.timeout = 105000;
      new Headers(init?.headers).forEach((value, key) => xhr.setRequestHeader(key, value));
      xhr.onload = () => {
        try {
          if (xhr.status < 200 || xhr.status > 599) throw new TypeError('Network response unavailable');
          if (xhr.responseText.length > 262144) throw new TypeError('JSON response too large');
          const headers = new Headers();
          for (const key of ['content-type', 'retry-after']) {
            const value = xhr.getResponseHeader(key); if (value) headers.set(key, value);
          }
          finish(undefined, new Response([204, 205, 304].includes(xhr.status) ? null : xhr.responseText, { status: xhr.status, headers }));
        } catch { finish(new TypeError('Unable to read JSON response')); }
      };
      xhr.onerror = () => finish(new TypeError('Network request failed'));
      xhr.onabort = () => finish(new DOMException('Request cancelled', 'AbortError'));
      xhr.ontimeout = () => finish(new DOMException('Request timed out', 'TimeoutError'));
      signal?.addEventListener('abort', cancel, { once: true });
      xhr.send(init?.body as string | null | undefined);
    } catch { finish(new TypeError('Unable to start JSON request')); }
  });
};
