const renderLineBreaks = (text, keyPrefix) => {
  const lines = String(text || "").split("\n");
  return lines.map((line, index) => (
    <span key={`${keyPrefix}-${index}`}>
      {line}
      {index < lines.length - 1 ? <br /> : null}
    </span>
  ));
};

const ChatMessage = ({ message }) => {
  const isUser = message.role === "user";
  const isError = Boolean(message.isError);
  const containerClass = isUser ? "flex-row-reverse" : "flex-row";
  const bubbleBase = "max-w-[75%] px-4 py-3 text-sm leading-relaxed";

  const bubbleClass = isUser
    ? "bg-gradient-to-br from-[#2d7a3a] to-[#4caf50] text-white rounded-2xl rounded-br-sm"
    : isError
      ? "bg-red-50 border border-red-200 text-red-700 rounded-2xl rounded-bl-sm"
      : "bg-white border border-green-100 text-gray-800 rounded-2xl rounded-bl-sm";

  const segments = String(message.content || "").split("**");

  let timeLabel = "";
  if (message.timestamp) {
    const date = new Date(message.timestamp);
    if (!Number.isNaN(date.getTime())) {
      timeLabel = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
  }

  return (
    <div className={`mb-4 flex items-end gap-2 ${containerClass} animate-[fadeSlideIn_0.25s_ease-out]`}>
      {!isUser && (
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#2d7a3a] to-[#4caf50] text-sm text-white">
          🌿
        </div>
      )}
      <div>
        <div className={`${bubbleBase} ${bubbleClass}`}>
          {segments.map((segment, index) => {
            const content = renderLineBreaks(segment, `segment-${index}`);
            if (index % 2 === 1) {
              return (
                <strong key={`bold-${index}`} className="font-semibold">
                  {content}
                </strong>
              );
            }
            return (
              <span key={`text-${index}`}>
                {content}
              </span>
            );
          })}
        </div>
        {timeLabel && (
          <div className={`mt-1 text-[10px] text-gray-400 ${isUser ? "text-right" : "text-left"}`}>
            {timeLabel}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatMessage;
