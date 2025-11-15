export async function onRequestPost(context) {
  const { request, env } = context;

  const { password } = await request.json();

  // Read secret from Cloudflare Pages environment
  const master = env.MASTER_PASSWORD;

  if (!master) {
    return new Response(
      JSON.stringify({ error: "MASTER_PASSWORD missing in environment." }),
      { status: 500 }
    );
  }

  if (password !== master) {
    return new Response(
      JSON.stringify({ error: "Invalid password" }),
      { status: 401 }
    );
  }

  // Create a simple session token
  const token = crypto.randomUUID();

  // Store the session in Cloudflare D1
  await env.DB.prepare(
    "INSERT INTO sessions (token, created_at) VALUES (?, strftime('%s','now'))"
  ).bind(token).run();

  return new Response(JSON.stringify({ token }), {
    headers: { "Content-Type": "application/json" },
  });
}
