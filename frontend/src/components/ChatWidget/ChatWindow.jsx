import { useEffect, useRef, useState } from "react";
import ChatMessage from "./ChatMessage";
import TypingIndicator from "./TypingIndicator";
import QuickReplies from "./QuickReplies";

const WELCOME_MESSAGE = {
  id: "welcome",
  role: "assistant",
  content:
    "Assalam o Alaikum! 👋 Main Naturanza ka assistant hon. Aap kuch poochna chahte hain? 🌿",
  timestamp: new Date().toISOString(),
};

const QUICK_REPLIES = [
  { label: "🍯 Our Products", value: "Tell me about your products" },
  { label: "💰 Prices", value: "What are your product prices?" },
  { label: "🚚 Shipping Info", value: "Tell me about shipping" },
  { label: "📞 Contact Us", value: "How can I contact Naturanza?" },
];

const ChatWindow = ({ sessionId, onClose, onNewMessage }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const inputRef = useRef(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    let isActive = true;

    const loadHistory = async () => {
      if (!sessionId) {
        setMessages([WELCOME_MESSAGE]);
        setIsLoadingHistory(false);
        return;
      }

      setIsLoadingHistory(true);
      try {
        const response = await fetch(
          `/api/chat/history/${encodeURIComponent(sessionId)}`,
        );
        if (!response.ok) {
          throw new Error("Failed to load history");
        }

        const data = await response.json();
        const history = Array.isArray(data?.messages) ? data.messages : [];

        if (isActive) {
          if (history.length > 0) {
            setMessages(
              history.map((message) => ({
                ...message,
                timestamp: message.timestamp || new Date().toISOString(),
              })),
            );
          } else {
            setMessages([WELCOME_MESSAGE]);
          }
        }
      } catch (error) {
        if (isActive) {
          setMessages([WELCOME_MESSAGE]);
        }
      } finally {
        if (isActive) {
          setIsLoadingHistory(false);
          setTimeout(() => inputRef.current?.focus(), 300);
        }
      }
    };

    loadHistory();

    return () => {
      isActive = false;
    };
  }, [sessionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isLoading, isLoadingHistory]);

  const sendMessage = async (text) => {
    const trimmed = String(text || "").trim();
    if (!trimmed || isLoading || !sessionId) {
      return;
    }

    const userMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat/message", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sessionId, message: trimmed }),
      });

      if (!response.ok) {
        throw new Error("Failed to send message");
      }

      const data = await response.json();
      const botMessage = {
        id: data.messageId ? `assistant-${data.messageId}` : `assistant-${Date.now()}`,
        role: "assistant",
        content: data.reply || "",
        timestamp: data.timestamp || new Date().toISOString(),
      };

      setMessages((prev) => [...prev, botMessage]);
      onNewMessage?.();
    } catch (error) {
      const errorMessage = {
        id: `error-${Date.now()}`,
        role: "assistant",
        isError: true,
        content:
          "Maafi chahta hon! Abhi technical masla hai. WhatsApp par rabta karein: **+92 347 4147400** 🙏",
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage(input);
    }
  };

  const canSend = input.trim().length > 0 && !isLoading;
  const quickReplyRow = QUICK_REPLIES.slice(0, 3);

  return (
    <div className="fixed bottom-28 right-6 z-50 flex h-[580px] w-[380px] max-h-[calc(100vh-7rem)] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-3xl border border-green-100 bg-white shadow-3d auth-premium-font animate-[chatSlideUp_0.35s_cubic-bezier(0.34,1.56,0.64,1)]">
      <div className="flex items-center justify-between bg-gradient-to-r from-[#1a5c26] via-[#2d7a3a] to-[#3d9e4a] px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="relative flex h-11 w-11 items-center justify-center rounded-full bg-white/20 text-lg text-white">
            🌿
            <span className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-[#2d7a3a] bg-green-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Naturanza Assistant</p>
            <p className="text-xs text-green-200">Online • Abhi jawab dega</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="https://wa.me/923474147400"
            target="_blank"
            rel="noreferrer"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
            aria-label="WhatsApp Naturanza"
          >
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <path d="M20.52 3.48A11.82 11.82 0 0 0 12 0C5.37 0 .03 5.34.03 11.96c0 2.11.55 4.18 1.6 6L0 24l6.2-1.6a11.88 11.88 0 0 0 5.78 1.48h.02c6.62 0 11.97-5.34 11.97-11.96 0-3.2-1.25-6.21-3.45-8.44ZM12 21.9h-.02a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.68.95.98-3.59-.24-.37a9.89 9.89 0 0 1-1.52-5.34c.01-5.46 4.47-9.91 9.95-9.91a9.9 9.9 0 0 1 9.95 9.91c0 5.46-4.46 9.94-9.93 9.94Zm5.45-7.45c-.3-.15-1.76-.86-2.03-.96-.27-.1-.46-.15-.66.15-.2.3-.76.96-.93 1.16-.17.2-.34.22-.64.07-.3-.15-1.25-.46-2.38-1.46-.88-.78-1.48-1.75-1.65-2.05-.17-.3-.02-.46.13-.61.13-.13.3-.34.45-.51.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.66-1.6-.9-2.19-.24-.58-.48-.5-.66-.51h-.56c-.2 0-.52.08-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.48.71.31 1.27.49 1.7.62.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2.01-1.42.25-.7.25-1.3.17-1.42-.08-.12-.27-.2-.57-.35Z" />
            </svg>
          </a>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
            aria-label="Close chat"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-[#f0f7f1] px-4 py-4 thin-scrollbar">
        {isLoadingHistory ? (
          <div className="flex h-full items-center justify-center">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 animate-bounce rounded-full bg-green-400 [animation-delay:-0.2s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-green-400" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-green-400 [animation-delay:0.2s]" />
            </div>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}
            {isLoading && <TypingIndicator />}
            {!isLoading && messages.length <= 1 && (
              <div className="mt-4">
                <QuickReplies options={QUICK_REPLIES} onSelect={sendMessage} />
              </div>
            )}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-green-100 bg-white px-4 pb-3 pt-2">
        {messages.length > 1 && (
          <div className="mb-2 flex items-center gap-2 overflow-x-auto pb-1">
            {quickReplyRow.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => sendMessage(option.value)}
                className="whitespace-nowrap rounded-full border border-green-200 px-3 py-1 text-xs font-medium text-green-700 transition hover:bg-green-600 hover:text-white"
              >
                {option.label}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            className="min-h-[48px] flex-1 resize-none rounded-2xl border border-green-100 px-4 py-3 text-[16px] text-gray-800 outline-none transition focus:border-green-300 focus:ring-2 focus:ring-green-200"
          />
          <button
            type="button"
            onClick={() => sendMessage(input)}
            disabled={!canSend}
            className={`flex h-11 w-11 items-center justify-center rounded-2xl text-white transition ${
              canSend
                ? "bg-gradient-to-br from-[#2d7a3a] to-[#4caf50] shadow-md"
                : "bg-gray-300"
            }`}
            aria-label="Send message"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
        <p className="mt-2 text-center text-[10px] text-gray-400">
          Powered by 🌿 Naturanza AI
        </p>
      </div>
    </div>
  );
};

export default ChatWindow;
