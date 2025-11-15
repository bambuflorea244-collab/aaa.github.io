// functions/api/chats/[id]/delete.js
import { requireAuth, getAttachmentsMeta } from "../../_utils";

export async function onRequestPost(context) {
  const { env, request, params } = context;
  const auth = await requireAuth(env, request);
  if (!auth.ok) return auth.response;

  const chatId = params.id;

  try {
    const attachments = await getAttachmentsMeta(env, chatId);
    // delete R2 objects
    for (const a of attachments) {
      try {
        await env.FILES.delete(a.r2_key);
      } catch (e) {
        console.warn("Failed to delete R2 object", a.r2_key, e);
      }
    }

    await env.DB.batch([
      env.DB.prepare("DELETE FROM attachments WHERE chat_id=?").bind(chatId),
      env.DB.prepare("DELETE FROM messages WHERE chat_id=?").bind(chatId),
      env.DB.prepare("DELETE FROM chats WHERE id=?").bind(chatId)
    ]);

    return Response.json({ ok: true });
  } catch (err) {
    console.error("DELETE chat error", err);
    return new Response("Failed to delete chat", { status: 500 });
  }
}
