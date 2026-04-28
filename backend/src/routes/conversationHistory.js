import express from "express";

import { getDb, sqlGetAll, sqlGetOne } from "../db.js";
import { requireAuth } from "../auth.js";

export function conversationHistoryRouter(config) {
  const router = express.Router();

  router.get("/", requireAuth(config), async (req, res) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const limitRaw = req.query?.limit;
    const limit = limitRaw === undefined ? undefined : Number(limitRaw);
    if (limit !== undefined && (!Number.isFinite(limit) || limit <= 0)) {
      return res
        .status(400)
        .json({ message: "limit must be a positive number" });
    }

    const { db } = await getDb(config);

    const history = sqlGetOne(
      db,
      "SELECT id FROM conversation_histories WHERE user_id = ?",
      [userId],
    );
    if (!history) {
      return res.json({
        Message: "No conversation history found for the user.",
      });
    }

    const historyId = Number(history.id);

    if (limit !== undefined) {
      const lastN = sqlGetAll(
        db,
        "SELECT id, sender_type, content, created_at FROM messages WHERE conversation_history_id = ? ORDER BY created_at DESC LIMIT ?",
        [historyId, limit],
      );
      const messagesAsc = lastN.reverse();

      return res.json({
        Id: historyId,
        Messages: messagesAsc.map((m) => ({
          Id: Number(m.id),
          SenderType: Number(m.sender_type),
          Content: String(m.content),
          CreatedAt: new Date(m.created_at).toISOString(),
        })),
      });
    }

    const messages = sqlGetAll(
      db,
      "SELECT id, sender_type, content, created_at FROM messages WHERE conversation_history_id = ? ORDER BY created_at ASC",
      [historyId],
    );

    return res.json({
      Id: historyId,
      Messages: messages.map((m) => ({
        Id: Number(m.id),
        SenderType: Number(m.sender_type),
        Content: String(m.content),
        CreatedAt: new Date(m.created_at).toISOString(),
      })),
    });
  });

  return router;
}
