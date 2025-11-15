// functions/api/chats/[id]/messages.js
import {
  requireAuth,
  getSetting,
  getAttachmentsMeta
} from "../../_utils";

const MODEL = "gemini-2.5-flash";

async function getMessages(env, chatId, limit = 40) {
  const { results } = await env.DB.prepare(
    "SELECT id, chat_id, role, content, created_at FROM messages WHERE chat_id=? ORDER BY created_at ASC LIMIT ?"
  )
    .bind(chatId, limit)
    .all();
  return results || [];
}

async function storeMessage(env, chatId, role, content) {
  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare(
    "INSERT INTO messages (chat_id, role, content, created_at) VALUES (?, ?, ?, ?)"
  )
    .bind(chatId, role, content, now)
    .run();
}

export async function onRequestGet(context) {
  const { env, request, params } = context;
  const auth = await requireAuth(env, request);
  if (!auth.ok) return auth.response;

  const chatId = params.id;

  try {
    const messages = await getMessages(env, chatId, 200);
    return Response.json(messages);
  } catch (err) {
    console.error("GET /api/chats/:id/messages error", err);
    return new Response("Failed to load messages", { status: 500 });
  }
}

export async function onRequestPost(context) {
  const { env, request, params } = context;
  const auth = await requireAuth(env, request);
  if (!auth.ok) return auth.response;
  const chatId = params.id;

  try {
    const body = await request.json();
    const message = (body.message || "").toString();
    if (!message) {
      return new Response("Message required", { status: 400 });
    }

    const chat = await env.DB.prepare(
      "SELECT id, system_prompt FROM chats WHERE id=?"
    )
      .bind(chatId)
      .first();
    if (!chat) {
      return new Response("Chat not found", { status: 404 });
    }

    const history = await getMessages(env, chatId, 40);
    const contents = history.map((m) => ({
      role: m.role === "model" ? "model" : "user",
      parts: [{ text: m.content }]
    }));

    // System prompt first if exists
    if (chat.system_prompt) {
      contents.unshift({
        role: "system",
        parts: [{ text: chat.system_prompt }]
      });
    }

    // Add a textual reference to attachments so Gemini knows they exist
    const attachments = await getAttachmentsMeta(env, chatId);
    if (attachments.length > 0) {
      const desc = attachments
        .map((a) => `${a.name} (${a.mime_type})`)
        .join(", ");
      contents.push({
        role: "user",
        parts: [
          {
            text:
              "These files are attached to this chat and should be considered if relevant: " +
              desc
          }
        ]
      });
    }

    contents.push({
      role: "user",
      parts: [{ text: message }]
    });

    await storeMessage(env, chatId, "user", message);

    const apiKey = await getSetting(env, "gemini_api_key");
    if (!apiKey) {
      return new Response(
        "Gemini API key not set. Configure it in Settings.",
        { status: 500 }
      );
    }

    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({ model: MODEL, contents })
      }
    );

    if (!resp.ok) {
      const text = await resp.text();
      console.error("Gemini error", resp.status, text);
      return new Response("Gemini API error: " + text, { status: 500 });
    }

    const data = await resp.json();
    const reply =
      data?.candidates?.[0]?.content?.parts
        ?.map((p) => p.text || "")
        .join("\n") || "";

    await storeMessage(env, chatId, "model", reply);

    return Response.json({ reply });
  } catch (err) {
    console.error("POST /api/chats/:id/messages error", err);
    return new Response("Failed to send message", { status: 500 });
  }
}
