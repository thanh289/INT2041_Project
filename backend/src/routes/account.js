import express from "express";
import crypto from "node:crypto";

import { getDb, sqlGetOne } from "../db.js";
import { signToken } from "../auth.js";

export function accountRouter(config) {
  const router = express.Router();

  router.post("/register", async (req, res) => {
    const username = String(
      req.body?.Username ?? req.body?.username ?? "",
    ).trim();
    if (!username)
      return res.status(400).json({ errors: ["Username is required"] });

    const { db, persist } = await getDb(config);
    const existing = sqlGetOne(
      db,
      "SELECT id, username, created_at FROM users WHERE username = ?",
      [username],
    );
    if (existing)
      return res.status(400).json({ Errors: ["Username already exists"] });

    const user = {
      id: crypto.randomUUID(),
      username,
      createdAt: new Date().toISOString(),
    };

    try {
      db.run("INSERT INTO users (id, username, created_at) VALUES (?, ?, ?)", [
        user.id,
        user.username,
        user.createdAt,
      ]);
      await persist();
    } catch (e) {
      const msg = String(e?.message ?? e ?? "");
      if (
        msg.toLowerCase().includes("unique") ||
        msg.toLowerCase().includes("constraint")
      ) {
        return res.status(400).json({ Errors: ["Username already exists"] });
      }
      throw e;
    }

    const token = signToken(config, user);

    return res.json({
      Message: "User registered successfully",
      User: {
        Username: user.username,
        Token: token,
      },
    });
  });

  router.post("/login", async (req, res) => {
    const username = String(
      req.body?.Username ?? req.body?.username ?? "",
    ).trim();
    if (!username)
      return res.status(400).json({ errors: ["Username is required"] });

    const { db } = await getDb(config);
    const user = sqlGetOne(
      db,
      "SELECT id, username, created_at FROM users WHERE username = ?",
      [username],
    );
    if (!user) {
      return res.status(401).send("Invalid username or password");
    }

    const token = signToken(config, {
      id: String(user.id),
      username: String(user.username),
    });

    return res.json({
      Message: "Login successful",
      User: {
        Username: String(user.username),
        Token: token,
      },
    });
  });

  return router;
}
