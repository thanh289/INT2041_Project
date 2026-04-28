import express from "express";

import { getDb, sqlGetOne } from "../db.js";
import { requireAuth } from "../auth.js";

function toIsoDate(value) {
  if (!value) return new Date().toISOString();
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return new Date().toISOString();
  return d.toISOString();
}

export function messagesRouter(config) {
  const router = express.Router();

  router.post("/", requireAuth(config), async (req, res) => {
    if (!Array.isArray(req.body)) {
      return res
        .status(400)
        .json({ message: "Body must be an array of messages" });
    }

    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { db, persist } = await getDb(config);

    let history = sqlGetOne(
      db,
      "SELECT id, user_id, created_at, updated_at FROM conversation_histories WHERE user_id = ?",
      [userId],
    );

    if (!history) {
      const now = new Date().toISOString();
      db.run(
        "INSERT INTO conversation_histories (user_id, created_at, updated_at) VALUES (?, ?, ?)",
        [userId, now, now],
      );
      history = sqlGetOne(db, "SELECT last_insert_rowid() AS id", []);
      history = {
        id: Number(history?.id ?? 0),
        user_id: userId,
        created_at: now,
        updated_at: now,
      };
    }

    const created = [];

    for (const raw of req.body) {
      const senderType = Number(raw?.SenderType ?? raw?.senderType ?? 0);
      const content = String(raw?.Content ?? raw?.content ?? "");
      const createdAt = toIsoDate(raw?.CreatedAt ?? raw?.createdAt);

      if (
        !Number.isFinite(senderType) ||
        (senderType !== 0 && senderType !== 1)
      ) {
        return res.status(400).json({ message: "SenderType must be 0 or 1" });
      }
      if (!content) {
        return res.status(400).json({ message: "Content is required" });
      }

      db.run(
        "INSERT INTO messages (conversation_history_id, sender_type, content, created_at) VALUES (?, ?, ?, ?)",
        [Number(history.id), senderType, content, createdAt],
      );
      const row = sqlGetOne(db, "SELECT last_insert_rowid() AS id", []);
      const id = Number(row?.id ?? 0);

      created.push({
        Id: id,
        SenderType: senderType,
        Content: content,
        CreatedAt: createdAt,
      });
    }

    db.run("UPDATE conversation_histories SET updated_at = ? WHERE id = ?", [
      new Date().toISOString(),
      Number(history.id),
    ]);
    await persist();

    return res.json(created);
  });

  return router;
}
