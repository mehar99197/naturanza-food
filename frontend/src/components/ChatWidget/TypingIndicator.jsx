const TypingIndicator = () => {
  return (
    <div className="mb-4 flex items-end gap-2 animate-[fadeSlideIn_0.25s_ease-out]">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#2d7a3a] to-[#4caf50] text-sm text-white">
        🌿
      </div>
      <div className="rounded-2xl rounded-bl-sm border border-green-100 bg-white px-4 py-3">
        <div className="flex items-center gap-1">
          {[0, 1, 2].map((index) => (
            <span
              key={index}
              className="h-2 w-2 rounded-full bg-green-400"
              style={{
                animation: "typingBounce 1.2s infinite",
                animationDelay: `${index * 0.2}s`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default TypingIndicator;
