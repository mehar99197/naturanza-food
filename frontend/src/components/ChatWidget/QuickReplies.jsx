const QuickReplies = ({ options = [], onSelect }) => {
  return (
    <div
      className="animate-[fadeSlideIn_0.3s_ease-out]"
      style={{ animationDelay: "0.2s" }}
    >
      <p className="text-[11px] text-gray-500">Jaldi poochein:</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onSelect?.(option.value)}
            className="rounded-full border-2 border-green-300 px-3 py-1 text-xs font-semibold text-green-700 transition hover:bg-green-600 hover:text-white"
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default QuickReplies;
