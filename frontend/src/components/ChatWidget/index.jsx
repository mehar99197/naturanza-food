import { useEffect, useState } from "react";
import ChatWindow from "./ChatWindow";

const STORAGE_KEY = "naturanza_session_id";

const createSessionId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `session-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
};

const ChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [hasNewMessage, setHasNewMessage] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    const storedSessionId = localStorage.getItem(STORAGE_KEY);
    if (storedSessionId) {
      setSessionId(storedSessionId);
      return;
    }

    const newSessionId = createSessionId();
    localStorage.setItem(STORAGE_KEY, newSessionId);
    setSessionId(newSessionId);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setPulse(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  const handleToggle = () => {
    if (isOpen) {
      setIsOpen(false);
      return;
    }

    setIsOpen(true);
    setHasNewMessage(false);
    setPulse(false);
  };

  const handleNewMessage = () => {
    setHasNewMessage(true);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <button
        type="button"
        onClick={handleToggle}
        className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[#2d7a3a] to-[#4caf50] text-white shadow-glow-green transition-transform duration-200 hover:scale-[1.03]"
        aria-label={isOpen ? "Close chat" : "Open chat"}
      >
        {!isOpen && pulse && (
          <span className="absolute inset-0 rounded-full bg-green-300/40 animate-ping" />
        )}
        {hasNewMessage && !isOpen && (
          <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-red-500 ring-2 ring-white" />
        )}
        {isOpen ? (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-7 w-7"
            aria-hidden="true"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-7 w-7"
            aria-hidden="true"
          >
            <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
          </svg>
        )}
      </button>

      {isOpen && (
        <ChatWindow
          sessionId={sessionId}
          onClose={() => setIsOpen(false)}
          onNewMessage={handleNewMessage}
        />
      )}
    </div>
  );
};

export default ChatWidget;
