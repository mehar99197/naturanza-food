const chatPool = require("../db/connection");
const { getChatResponse } = require("../services/claudeService");

const MAX_MESSAGE_LENGTH = 1000;
const CONTEXT_LIMIT = 20;
const HISTORY_LIMIT = 50;

const normalizeIp = (req) => {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    return String(forwarded).split(",")[0].trim();
  }
  return req.ip || null;
};

const sendMessage = async (req, res) => {
  try {
    const sessionId = String(req.body?.sessionId || "").trim();
    const message = String(req.body?.message || "").trim();

    if (!sessionId || !message) {
      return res.status(400).json({
        success: false,
        error: "sessionId and message are required",
      });
    }

    if (sessionId.length > 36) {
      return res.status(400).json({
        success: false,
        error: "sessionId must be a valid UUID",
      });
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({
        success: false,
        error: "message must be 1000 characters or less",
      });
    }

    const ipAddress = normalizeIp(req);
    const userAgent = req.headers["user-agent"] || null;

    await chatPool.query(
      "INSERT IGNORE INTO chat_sessions (id, ip_address, user_agent) VALUES (?, ?, ?)",
      [sessionId, ipAddress, userAgent],
    );

    const [recentMessages] = await chatPool.query(
      "SELECT role, content FROM chat_messages WHERE session_id = ? ORDER BY created_at DESC LIMIT ?",
      [sessionId, CONTEXT_LIMIT],
    );

    await chatPool.query(
      "INSERT INTO chat_messages (session_id, role, content) VALUES (?, 'user', ?)",
      [sessionId, message],
    );

    const conversationHistory = recentMessages
      .reverse()
      .map((row) => ({ role: row.role, content: row.content }));
    conversationHistory.push({ role: "user", content: message });

    const reply = await getChatResponse(conversationHistory);

    const [botResult] = await chatPool.query(
      "INSERT INTO chat_messages (session_id, role, content) VALUES (?, 'assistant', ?)",
      [sessionId, reply],
    );

    await chatPool.query(
      "UPDATE chat_sessions SET updated_at = NOW() WHERE id = ?",
      [sessionId],
    );

    res.json({
      success: true,
      reply,
      messageId: botResult.insertId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Chat sendMessage error:", error);
    res.status(500).json({
      success: false,
      error: "Server error",
    });
  }
};

const getChatHistory = async (req, res) => {
  try {
    const sessionId = String(req.params.sessionId || "").trim();

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: "sessionId is required",
      });
    }

    const [rows] = await chatPool.query(
      `SELECT id, role, content, created_at
       FROM (
         SELECT id, role, content, created_at
         FROM chat_messages
         WHERE session_id = ?
         ORDER BY created_at DESC
         LIMIT ?
       ) AS recent
       ORDER BY created_at ASC`,
      [sessionId, HISTORY_LIMIT],
    );

    res.json({
      success: true,
      sessionId,
      messages: rows.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        timestamp: message.created_at,
      })),
    });
  } catch (error) {
    console.error("Chat history error:", error);
    res.status(500).json({
      success: false,
      error: "Server error",
    });
  }
};

module.exports = { sendMessage, getChatHistory };
