import { useState } from "react";

export function ConfirmRemoveModal({ admin, onConfirm, onClose }) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="mb-2 text-lg font-bold text-slate-900">Remove Admin Role?</h3>
        <p className="mb-6 text-sm text-slate-600">
          Are you sure you want to remove admin role from{" "}
          <strong className="text-slate-900">{admin?.name}</strong>?
          <br />
          <span className="text-red-600">This action cannot be undone.</span>
        </p>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? "Removing..." : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
