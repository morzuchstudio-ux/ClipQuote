// The same Web API handlers run in Vercel Functions and the Vite dev server.
export const nodeHandler = (handler) => async (req, res) => {
  try {
    const response = await handler(new Request(new URL(req.url, "https://clipquote.local"), { method: req.method }));
    response.headers.forEach((v, k) => res.setHeader(k, v));
    res.statusCode = response.status;
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Request could not be completed." }));
  }
};
