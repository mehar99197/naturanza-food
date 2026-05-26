import { useEffect, useState } from "react";
import { X, Activity } from "lucide-react";
import { adminAPI } from "@/services/api";
import { formatDistanceToNow } from "date-fns";

export function ActivityDrawer({ admin, onClose }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (admin?.id) {
      loadLogs();
    }
  }, [admin?.id]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const data = await adminAPI.getAdminLogs(admin.id, 20);
      setLogs(data);
    } catch (error) {
      console.error("Failed to load activity logs:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!admin) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-end bg-slate-900/40 backdrop-blur-[2px] sm:items-stretch"
      onClick={onClose}
    >
      <div
        className="h-[85vh] w-full max-w-full animate-slide-in-right rounded-t-3xl border border-emerald-100 bg-white shadow-2xl sm:h-full sm:max-w-md sm:rounded-none sm:border-l"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-emerald-100 bg-emerald-50 px-4 py-3 sm:px-6 sm:py-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100">
                <Activity className="h-5 w-5 text-emerald-700" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Activity Log</h3>
                <p className="text-xs text-slate-600 sm:text-sm">{admin.name}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-slate-500 transition hover:bg-emerald-100 hover:text-slate-700"
              aria-label="Close activity drawer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
              </div>
            ) : logs.length === 0 ? (
              <div className="py-12 text-center">
                <Activity className="mx-auto h-12 w-12 text-slate-300" />
                <p className="mt-4 text-sm text-slate-500">No activity logs found</p>
              </div>
            ) : (
              <div className="space-y-3 sm:space-y-4">
                {logs.map((log, index) => (
                  <div
                    key={index}
                    className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-3 shadow-sm sm:p-4"
                  >
                    <p className="text-sm font-semibold text-slate-800 sm:text-[15px]">
                      {log.action}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500 sm:text-xs">
                      <span className="rounded-full bg-white px-2 py-0.5 text-slate-500">
                        {formatDistanceToNow(new Date(log.created_at), {
                          addSuffix: true,
                        })}
                      </span>
                      {log.ip_address ? (
                        <span className="rounded-full bg-white px-2 py-0.5 font-mono text-slate-500">
                          {log.ip_address}
                        </span>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
