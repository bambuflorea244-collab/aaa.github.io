export async function onRequestPost(context) {
  const { request, env } = context;

  // 1. Read JSON body safely
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // 2. Normalize password and MASTER_PASSWORD (trim spaces)
  const password = (body.password ?? "").toString().trim();
  const masterRaw = env.MASTER_PASSWORD;
  const master = (masterRaw ?? "").toString().trim();

  // 3. If MASTER_PASSWORD is missing, tell us clearly
  if (!master) {
    return new Response(
      JSON.stringify({
        error:
          "MASTER_PASSWORD is NOT set in Cloudflare. Go to Workers & Pages → your project → Settings → Variables and add it."
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  // 4. Compare
  if (password !== master) {
    return new Response(
      JSON.stringify({ error: "Invalid password." }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  // 5. Create session
  const token = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const expires = now + 60 * 60 * 24 * 90; // 90 days

  await env.DB.prepare(
    "INSERT INTO sessions (token, created_at, expires_at) VALUES (?, ?, ?)"
  )
    .bind(token, now, expires)
    .run();

  return new Response(
    JSON.stringify({ token }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}
