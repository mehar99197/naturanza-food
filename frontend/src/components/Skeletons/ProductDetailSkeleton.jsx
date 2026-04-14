import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';

export function ProductDetailSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 pt-20 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          
          {/* Left Column - Image */}
          <div className="space-y-4">
            {/* Main Image */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <Skeleton 
                height={500}
                baseColor="#f0fdf4"
                highlightColor="#dcfce7"
              />
            </div>
            
            {/* Thumbnail Gallery */}
            <div className="grid grid-cols-4 gap-3">
              {[...Array(4)].map((_, i) => (
                <Skeleton 
                  key={i}
                  height={100}
                  borderRadius="1rem"
                  baseColor="#f0fdf4"
                  highlightColor="#dcfce7"
                />
              ))}
            </div>
          </div>

          {/* Right Column - Details */}
          <div className="space-y-6">
            {/* Breadcrumb */}
            <Skeleton 
              width={200} 
              height={16}
              baseColor="#f0fdf4"
              highlightColor="#dcfce7"
            />
            
            {/* Category badge */}
            <Skeleton 
              width={100} 
              height={24} 
              borderRadius="9999px"
              baseColor="#f0fdf4"
              highlightColor="#dcfce7"
            />
            
            {/* Title */}
            <Skeleton 
              height={40} 
              width="80%"
              baseColor="#f0fdf4"
              highlightColor="#dcfce7"
            />
            
            {/* Rating */}
            <div className="flex items-center gap-3">
              <Skeleton 
                width={120} 
                height={20}
                baseColor="#f0fdf4"
                highlightColor="#dcfce7"
              />
              <Skeleton 
                width={80} 
                height={16}
                baseColor="#f0fdf4"
                highlightColor="#dcfce7"
              />
            </div>
            
            {/* Price */}
            <div className="bg-green-50 rounded-xl p-4">
              <Skeleton 
                width={150} 
                height={36}
                baseColor="#dcfce7"
                highlightColor="#bbf7d0"
              />
            </div>
            
            {/* Description */}
            <div className="space-y-2">
              <Skeleton 
                height={20} 
                width={100}
                baseColor="#f0fdf4"
                highlightColor="#dcfce7"
              />
              <Skeleton 
                count={4} 
                height={16}
                baseColor="#f0fdf4"
                highlightColor="#dcfce7"
              />
            </div>
            
            {/* Variant Selector */}
            <div className="space-y-3">
              <Skeleton 
                height={20} 
                width={80}
                baseColor="#f0fdf4"
                highlightColor="#dcfce7"
              />
              <div className="flex gap-2">
                {[...Array(4)].map((_, i) => (
                  <Skeleton 
                    key={i}
                    width={80} 
                    height={40}
                    borderRadius="0.5rem"
                    baseColor="#f0fdf4"
                    highlightColor="#dcfce7"
                  />
                ))}
              </div>
            </div>
            
            {/* Quantity Selector */}
            <div className="flex items-center gap-4">
              <Skeleton 
                width={120} 
                height={48}
                borderRadius="0.75rem"
                baseColor="#f0fdf4"
                highlightColor="#dcfce7"
              />
            </div>
            
            {/* Action Buttons */}
            <div className="flex gap-3">
              <Skeleton 
                width={200} 
                height={50}
                borderRadius="0.75rem"
                baseColor="#22c55e"
                highlightColor="#16a34a"
              />
              <Skeleton 
                width={50} 
                height={50}
                borderRadius="0.75rem"
                baseColor="#f0fdf4"
                highlightColor="#dcfce7"
              />
            </div>
            
            {/* Additional Info */}
            <div className="grid grid-cols-2 gap-4 pt-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton 
                    width={60} 
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
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
