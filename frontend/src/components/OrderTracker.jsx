import React from 'react';
import { Package, Truck, MapPin, CheckCircle2, Clock } from 'lucide-react';

const orderStatuses = [
 { 
 key: 'pending', 
 label: 'Pending', 
 icon: Clock,
 color: 'text-yellow-600',
 bgColor: 'bg-yellow-100',
 borderColor: 'border-yellow-500'
 },
 { 
 key: 'processing', 
 label: 'Processing', 
 icon: Package,
 color: 'text-blue-600',
 bgColor: 'bg-blue-100',
 borderColor: 'border-blue-500'
 },
 { 
 key: 'shipped', 
 label: 'Shipped', 
 icon: Truck,
 color: 'text-purple-600',
 bgColor: 'bg-purple-100',
 borderColor: 'border-purple-500'
 },
 { 
 key: 'outForDelivery', 
 label: 'Out for Delivery', 
 icon: MapPin,
 color: 'text-orange-600',
 bgColor: 'bg-orange-100',
 borderColor: 'border-orange-500'
 },
 { 
 key: 'delivered', 
 label: 'Delivered', 
 icon: CheckCircle2,
 color: 'text-green-600',
 bgColor: 'bg-green-100',
 borderColor: 'border-green-500'
 }
];

export const OrderTracker = ({ currentStatus, trackingNumber, estimatedDelivery }) => {
 const currentIndex = orderStatuses.findIndex(status => status.key === currentStatus);
 const safeIndex = currentIndex < 0 ? 0 : currentIndex;
 const progressWidth = (safeIndex / (orderStatuses.length - 1)) * 100;

 return (
 <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg p-3.5 sm:p-6 md:p-8">
 {/* Header */}
 <div className="mb-3.5 sm:mb-8">
 <h2 className="text-[1.9rem] sm:text-2xl font-bold text-gray-900 mb-1.5 sm:mb-2 leading-tight">Order Tracking</h2>
 {trackingNumber && (
 <p className="text-sm text-gray-600 leading-snug">
 Tracking Number: <span className="font-semibold text-gray-900">{trackingNumber}</span>
 </p>
 )}
 {estimatedDelivery && (
 <p className="text-sm text-gray-600 leading-snug">
 Estimated Delivery: <span className="font-semibold text-gray-900">{estimatedDelivery}</span>
 </p>
 )}
 </div>

 {/* Progress Tracker - Desktop */}
 <div className="hidden md:block">
 <div className="relative">
 {/* Progress Line */}
 <div className="absolute top-8 left-0 right-0 h-1 bg-gray-200">
 <div 
 className="h-full bg-gradient-to-r from-green-500 to-emerald-500"
 style={{ width: `${progressWidth}%` }}
 />
 </div>

 {/* Status Steps */}
 <div className="relative flex justify-between">
 {orderStatuses.map((status, index) => {
 const Icon = status.icon;
 const isCompleted = index <= safeIndex;
 const isCurrent = index === safeIndex;

 return (
 <div key={status.key} className="flex flex-col items-center" style={{ width: `${100 / orderStatuses.length}%` }}>
 {/* Icon Circle */}
 <div className={`relative z-10 w-16 h-16 rounded-full flex items-center justify-center border-4 ${
 isCompleted 
 ? `${status.bgColor} ${status.borderColor}` 
 : 'bg-white border-gray-300'
 } ${isCurrent ? 'scale-110 shadow-lg' : ''}`}>
 <Icon className={`w-7 h-7 ${isCompleted ? status.color : 'text-gray-400'}`} />
 </div>

 {/* Label */}
 <div className="mt-3 text-center">
 <p className={`text-sm font-semibold ${isCompleted ? 'text-gray-900' : 'text-gray-400'}`}>
 {status.label}
 </p>
 {isCurrent && (
 <span className="inline-block mt-1 px-2 py-1 text-xs font-medium text-white bg-gradient-to-r from-green-600 to-emerald-600 rounded-full">
 Current
 </span>
 )}
 </div>
 </div>
 );
 })}
 </div>
 </div>
 </div>

 {/* Progress Tracker - Mobile */}
 <div className="md:hidden">
 <div className="relative">
 <div className="absolute left-0 right-0 top-4 h-1 rounded-full bg-gray-200" />
 <div
 className="absolute left-0 top-4 h-1 rounded-full bg-gradient-to-r from-green-500 to-emerald-500"
 style={{ width: `${progressWidth}%` }}
 />

 <div className="relative grid grid-cols-5 gap-1">
 {orderStatuses.map((status, index) => {
 const Icon = status.icon;
 const isCompleted = index <= safeIndex;
 const isCurrent = index === safeIndex;

 return (
 <div key={status.key} className="flex flex-col items-center text-center">
 <div className={`relative z-10 mt-1 h-7 w-7 rounded-full border-2 bg-white flex items-center justify-center ${
 isCompleted ? `${status.borderColor} ${status.bgColor}` : 'border-gray-300'
 } ${isCurrent ? 'ring-2 ring-emerald-200' : ''}`}>
 <Icon className={`h-3.5 w-3.5 ${isCompleted ? status.color : 'text-gray-400'}`} />
 </div>
 <p className={`mt-1 text-[10px] leading-tight font-semibold ${isCompleted ? 'text-gray-800' : 'text-gray-400'}`}>
 {status.label}
 </p>
 </div>
 );
 })}
 </div>
 </div>

 <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-xs text-emerald-800">
 <span className="font-semibold">Current:</span>{" "}
 {orderStatuses[safeIndex]?.label || 'Pending'}
 </div>

 <details className="mt-2.5 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-2">
 <summary className="cursor-pointer text-xs font-semibold text-gray-700">
 View full timeline
 </summary>
 <div className="mt-2 space-y-2">
 {orderStatuses.map((status, index) => {
 const isCompleted = index <= safeIndex;
 return (
 <div key={`${status.key}-mobile-detail`} className="flex items-center justify-between text-xs">
 <span className={`${isCompleted ? 'text-gray-800 font-medium' : 'text-gray-400'}`}>
 {status.label}
 </span>
 <span className={`${isCompleted ? 'text-emerald-700' : 'text-gray-400'}`}>
 {index === safeIndex ? 'In Progress' : isCompleted ? 'Completed' : 'Pending'}
 </span>
 </div>
 );
 })}
 </div>
 </details>
 </div>

 {/* Status Description */}
 <div className="mt-3.5 sm:mt-8 p-3 sm:p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-200">
 <p className="text-sm text-gray-700">
 {currentStatus === 'pending' && '🕐 Your order has been received and is awaiting processing.'}
 {currentStatus === 'processing' && '📦 Your order is being prepared for shipment.'}
 {currentStatus === 'shipped' && '🚚 Your order has been shipped and is on its way.'}
 {currentStatus === 'outForDelivery' && '🚛 Your order is out for delivery and will arrive soon!'}
 {currentStatus === 'delivered' && '✅ Your order has been successfully delivered. Enjoy!'}
 </p>
 </div>
 </div>
 );
};
