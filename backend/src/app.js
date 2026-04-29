import express from "express";
import cors from "cors";

import { accountRouter } from "./routes/account.js";
import { capabilitiesRouter } from "./routes/capabilities.js";
import { messagesRouter } from "./routes/messages.js";
import { conversationHistoryRouter } from "./routes/conversationHistory.js";

export function createApp(config) {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use("/api/account", accountRouter(config));
  app.use("/api/capabilities", capabilitiesRouter(config));
  app.use("/api/messages", messagesRouter(config));
  app.use("/api/conversation-history", conversationHistoryRouter(config));

  app.use((req, res) => {
    res.status(404).json({ message: "Not found" });
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  });

  return app;
}
