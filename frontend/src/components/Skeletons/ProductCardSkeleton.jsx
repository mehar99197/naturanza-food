import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';

export function ProductCardSkeleton({ count = 8, viewMode = 'grid', compact = false }) {
  const isListView = viewMode === 'list';

  if (isListView) {
    return (
      <>
        {Array(count).fill(0).map((_, index) => (
          <div key={index} className="glass-card rounded-2xl overflow-hidden p-2.5 sm:p-3">
            <div className="flex items-center gap-3 sm:gap-4">
              {/* Image skeleton */}
              <div className="w-24 h-20 sm:w-32 sm:h-24 flex-shrink-0">
                <Skeleton 
                  height="100%" 
                  width="100%" 
                  borderRadius="0.75rem"
                  baseColor="#f0fdf4"
                  highlightColor="#dcfce7"
                />
              </div>

              {/* Content skeleton */}
              <div className="min-w-0 flex-1 space-y-2">
                {/* Stars */}
                <Skeleton 
                  width={100} 
                  height={14}
                  baseColor="#f0fdf4"
                  highlightColor="#dcfce7"
                />
                
                {/* Title */}
                <Skeleton 
                  height={16} 
                  width="80%"
                  baseColor="#f0fdf4"
                  highlightColor="#dcfce7"
                />
                
                {/* Description */}
                <Skeleton 
                  height={14} 
                  width="60%"
                  baseColor="#f0fdf4"
                  highlightColor="#dcfce7"
                />
                
                {/* Price and button */}
                <div className="flex items-center justify-between gap-3">
                  <Skeleton 
                    width={60} 
                    height={20}
                    baseColor="#f0fdf4"
                    highlightColor="#dcfce7"
                  />
                  <Skeleton 
                    circle 
                    width={32} 
                    height={32}
                    baseColor="#22c55e"
                    highlightColor="#16a34a"
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </>
    );
  }

  // Grid view skeleton
  return (
    <>
      {Array(count).fill(0).map((_, index) => (
        <div 
          key={index} 
          className="bg-white rounded-2xl overflow-hidden h-full flex flex-col shadow-md border border-gray-100"
        >
          {/* Image skeleton */}
          <div className={`${compact ? 'aspect-[16/9]' : 'aspect-[16/10] sm:aspect-[5/4]'}`}>
            <Skeleton 
              height="100%" 
              width="100%"
              baseColor="#f0fdf4"
              highlightColor="#dcfce7"
            />
          </div>

          {/* Content skeleton */}
          <div className={`flex flex-col flex-1 ${compact ? 'p-2.5 sm:p-3' : 'p-3 sm:p-4'} space-y-2`}>
            {/* Category badge */}
            <Skeleton 
              width={80} 
              height={20} 
              borderRadius="9999px"
              baseColor="#f0fdf4"
              highlightColor="#dcfce7"
            />
            
            {/* Title */}
            <Skeleton 
              height={compact ? 16 : 20} 
              width="85%"
              baseColor="#f0fdf4"
              highlightColor="#dcfce7"
            />
            
            {/* Description */}
            <Skeleton 
              count={2} 
              height={14}
              baseColor="#f0fdf4"
              highlightColor="#dcfce7"
            />
            
            {/* Stars */}
            <Skeleton 
              width={100} 
              height={14}
              baseColor="#f0fdf4"
              highlightColor="#dcfce7"
            />
            
            {/* Price and button */}
            <div className="flex items-center justify-between mt-auto pt-2">
              <Skeleton 
                width={70} 
                height={24}
                baseColor="#f0fdf4"
                highlightColor="#dcfce7"
              />
              <Skeleton 
                width={compact ? 60 : 80} 
                height={compact ? 32 : 36} 
                borderRadius="0.75rem"
                baseColor="#22c55e"
                highlightColor="#16a34a"
              />
            </div>
          </div>
        </div>
      ))}
    </>
  );
}
