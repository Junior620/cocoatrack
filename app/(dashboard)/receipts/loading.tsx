// CocoaTrack V2 - Receipts Loading State

export default function ReceiptsLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="h-8 w-64 bg-gray-200 rounded animate-pulse" />
          <div className="mt-1 h-4 w-48 bg-gray-100 rounded animate-pulse" />
        </div>
        <div className="h-10 w-48 bg-gray-200 rounded animate-pulse" />
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="h-10 flex-1 min-w-[200px] bg-gray-100 rounded animate-pulse" />
        <div className="h-10 w-40 bg-gray-100 rounded animate-pulse" />
        <div className="h-10 w-32 bg-gray-100 rounded animate-pulse" />
        <div className="h-10 w-32 bg-gray-100 rounded animate-pulse" />
      </div>

      {/* Table skeleton */}
      <div className="overflow-hidden rounded-lg bg-white shadow">
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
          <div className="flex gap-4">
            {[...Array(7)].map((_, i) => (
              <div key={i} className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
            ))}
          </div>
        </div>
        <div className="divide-y divide-gray-200">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="px-6 py-4">
              <div className="flex items-center gap-4">
                <div className="h-4 w-4 bg-gray-200 rounded animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
                  <div className="h-3 w-24 bg-gray-100 rounded animate-pulse" />
                </div>
                <div className="h-4 w-40 bg-gray-100 rounded animate-pulse" />
                <div className="h-4 w-32 bg-gray-100 rounded animate-pulse" />
                <div className="h-4 w-24 bg-gray-100 rounded animate-pulse" />
                <div className="h-6 w-20 bg-gray-100 rounded-full animate-pulse" />
                <div className="h-4 w-16 bg-gray-100 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
