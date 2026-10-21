// Keep Axios request/response transforms, strict JSON parsing, status handling and cancellation real.
// Replace only its fetch adapter's network boundary; no request reaches a server.
function attachAxiosTransport(client, respond) {
  client.defaults.adapter = 'fetch';
  client.defaults.env = {
    ...client.defaults.env,
    Request, Response,
    fetch: async (input, init) => {
      const request = input instanceof Request ? input : new Request(input, init);
      const body = request.method === 'GET' ? undefined : await request.clone().text();
      const options = {
        method: request.method, body, signal: request.signal,
        headers: Object.fromEntries(request.headers), credentials: request.credentials,
      };
      // Preserve the exact Request for same-origin credential assertions.
      const result = await respond(request.url, options, request);
      if (result instanceof Response) return result;
      let data;
      try {
        data = await result.json();
        data = JSON.stringify(data);
      } catch {
        data = '{invalid JSON';
      }
      return new Response(data, { status: result.status, headers: { 'Content-Type': 'application/json' } });
    },
  };
}

module.exports = { attachAxiosTransport };
