// functions/api/auth/login.js
import { v4 as uuidv4 } from "uuid";

export async function onRequestPost(context) {
  const { env, request } = context;

  try {
    const body = await request.json();
    const password = (body.password || "").toString();

    const expected = env.MASTER_PASSWORD || "";
    if (!expected || password !== expected) {
      return new Response("Invalid password", { status: 401 });
    }

    const token = uuidv4();
    const now = Math.floor(Date.now() / 1000);
    const expires = now + 60 * 60 * 24 * 7; // 7 days

    await env.DB.prepare(
      "INSERT INTO sessions (token, created_at, expires_at) VALUES (?, ?, ?)"
    )
      .bind(token, now, expires)
      .run();

    return Response.json({ token });
  } catch (err) {
    console.error("auth/login error", err);
    return new Response("Internal error", { status: 500 });
  }
}
