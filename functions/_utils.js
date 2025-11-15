// functions/_utils.js

// Simple auth helper using sessions table
export async function requireAuth(env, request) {
  const authHeader = request.headers.get("Authorization") || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;

  if (!token) {
    return {
      ok: false,
      response: new Response("Unauthorized", { status: 401 })
    };
  }

  try {
    const row = await env.DB.prepare(
      "SELECT token FROM sessions WHERE token=?"
    )
      .bind(token)
      .first();

    if (!row) {
      return {
        ok: false,
        response: new Response("Unauthorized", { status: 401 })
      };
    }

    return { ok: true, token };
  } catch (err) {
    console.error("Auth check error", err);
    return {
      ok: false,
      response: new Response("Auth error", { status: 500 })
    };
  }
}

// Settings helpers
export async function getSetting(env, key) {
  const row = await env.DB.prepare(
    "SELECT value FROM settings WHERE key=?"
  )
    .bind(key)
    .first();
  return row ? row.value : null;
}

export async function setSetting(env, key, value) {
  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare(
    `
    INSERT INTO settings (key, value, created_at, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at
  `
  )
    .bind(key, value, now, now)
    .run();
}

// Attachments meta helper
export async function getAttachmentsMeta(env, chatId) {
  const { results } = await env.DB.prepare(
    "SELECT id, name, mime_type, r2_key, created_at FROM attachments WHERE chat_id=? ORDER BY created_at ASC"
  )
    .bind(chatId)
    .all();
  return results || [];
}

// small helper for base64 encoding ArrayBuffer
export function arrayBufferToBase64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
