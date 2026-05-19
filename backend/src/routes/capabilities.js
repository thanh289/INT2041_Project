import express from "express";

const modes = [
  {
    id: "object_detection",
    label: "Object Detection",
    description: "Camera-first mode for asking what the assistant can see.",
    phrases: ["object detection", "detect objects", "what do you see"],
  },
  {
    id: "chat",
    label: "Chat",
    description: "Conversation mode for asking general questions.",
    phrases: ["chat", "chatbox", "ask a question"],
  },
  {
    id: "files",
    label: "Read Files",
    description: "File mode for reading or summarizing local documents.",
    phrases: ["read files", "summarize file", "read my pdf"],
  },
];

export function capabilitiesRouter() {
  const router = express.Router();

  router.get("/", (_req, res) => {
    res.json({ modes });
  });

  return router;
}
