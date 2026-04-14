import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';

export function DashboardSkeleton() {
  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton 
          width={200} 
          height={32}
          baseColor="#f0fdf4"
          highlightColor="#dcfce7"
        />
        <Skeleton 
          width={300} 
          height={16}
          baseColor="#f0fdf4"
          highlightColor="#dcfce7"
        />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl shadow-md p-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton 
                  width={60} 
                  height={16}
                  baseColor="#f0fdf4"
                  highlightColor="#dcfce7"
                />
                <Skeleton 
                  circle 
                  width={40} 
                  height={40}
                  baseColor="#22c55e"
                  highlightColor="#16a34a"
                />
              </div>
              <Skeleton 
                width={100} 
                height={32}
                baseColor="#f0fdf4"
                highlightColor="#dcfce7"
              />
              <Skeleton 
                width={80} 
                height={14}
                baseColor="#f0fdf4"
                highlightColor="#dcfce7"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1 */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <Skeleton 
            width={150} 
            height={24} 
            className="mb-4"
            baseColor="#f0fdf4"
            highlightColor="#dcfce7"
          />
          <Skeleton 
            height={300}
            baseColor="#f0fdf4"
            highlightColor="#dcfce7"
          />
        </div>

        {/* Chart 2 */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <Skeleton 
            width={150} 
            height={24} 
            className="mb-4"
            baseColor="#f0fdf4"
            highlightColor="#dcfce7"
          />
          <Skeleton 
            height={300}
            baseColor="#f0fdf4"
            highlightColor="#dcfce7"
          />
        </div>
      </div>

      {/* Recent Orders Table */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <Skeleton 
          width={150} 
          height={24} 
          className="mb-4"
          baseColor="#f0fdf4"
          highlightColor="#dcfce7"
        />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-4 flex-1">
                <Skeleton 
                  circle 
                  width={40} 
                  height={40}
                  baseColor="#f0fdf4"
                  highlightColor="#dcfce7"
                />
                <div className="space-y-2 flex-1">
                  <Skeleton 
                    width={150} 
                    height={16}
                    baseColor="#f0fdf4"
                    highlightColor="#dcfce7"
                  />
                  <Skeleton 
                    width={100} 
                    height={14}
                    baseColor="#f0fdf4"
                    highlightColor="#dcfce7"
                  />
                </div>
              </div>
              <Skeleton 
                width={80} 
                height={32} 
                borderRadius="9999px"
                baseColor="#22c55e"
                highlightColor="#16a34a"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
