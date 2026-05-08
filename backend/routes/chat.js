const express = require("express");
const {
  sendMessage,
  getChatHistory,
} = require("../controllers/chatController");

module.exports = (chatLimiter) => {
  const router = express.Router();

  router.post("/message", chatLimiter, sendMessage);
  router.get("/history/:sessionId", getChatHistory);

  return router;
};
