export function AdminPageSkeleton({
  cards = 4,
  rows = 6,
  showCharts = false,
  showSidebar = false,
}) {
  return (
    <div className="mx-auto w-full max-w-7xl animate-pulse space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-2">
          <div className="h-9 w-56 rounded-xl bg-gray-200" />
          <div className="h-4 w-80 rounded-lg bg-gray-100" />
        </div>
        <div className="h-10 w-28 rounded-xl bg-gray-200" />
      </div>

      {cards > 0 ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: cards }).map((_, index) => (
            <div
              key={`card-${index}`}
              className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
            >
              <div className="mb-3 h-4 w-24 rounded bg-gray-100" />
              <div className="h-7 w-20 rounded bg-gray-200" />
            </div>
          ))}
        </div>
      ) : null}

      {showCharts ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="mb-4 h-5 w-36 rounded bg-gray-200" />
            <div className="h-64 rounded-xl bg-gray-100" />
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="mb-4 h-5 w-36 rounded bg-gray-200" />
            <div className="h-64 rounded-xl bg-gray-100" />
          </div>
        </div>
      ) : null}

      {showSidebar ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[40%_60%]">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-3 h-10 w-full rounded-xl bg-gray-100" />
            <div className="space-y-2">
              {Array.from({ length: rows }).map((_, index) => (
                <div key={`left-${index}`} className="h-16 rounded-xl bg-gray-100" />
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="space-y-3">
              <div className="h-6 w-1/2 rounded bg-gray-200" />
              <div className="h-4 w-3/4 rounded bg-gray-100" />
              <div className="h-28 rounded-xl bg-gray-100" />
              <div className="h-10 rounded-xl bg-gray-100" />
              <div className="h-10 rounded-xl bg-gray-100" />
            </div>
          </div>
        </div>
      ) : null}

      {!showCharts && !showSidebar ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-4 h-5 w-44 rounded bg-gray-200" />
          <div className="space-y-3">
            {Array.from({ length: rows }).map((_, index) => (
              <div key={`row-${index}`} className="h-14 rounded-xl bg-gray-100" />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
