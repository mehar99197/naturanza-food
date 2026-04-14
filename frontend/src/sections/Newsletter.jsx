import { useState } from 'react';
import { Mail, Send } from 'lucide-react';

export function Newsletter() {
 const [email, setEmail] = useState('');
 const [status, setStatus] = useState('idle'); // idle, loading, success, error

 const handleSubmit = (e) => {
 e.preventDefault();
 if (!email) return;

 setStatus('loading');
 
 // Simulate API call
 setTimeout(() => {
 setStatus('success');
 setEmail('');
 setTimeout(() => setStatus('idle'), 3000);
 }, 1000);
 };

 return (
 <section className="mt-15 mb-15 py-12 sm:py-16 md:py-20 bg-gradient-to-br from-green-600 via-green-700 to-emerald-800 relative overflow-hidden">
 {/* Background decorative elements */}
 <div className="absolute inset-0 overflow-hidden">
 <div className="absolute top-10 left-10 w-48 sm:w-72 h-48 sm:h-72 bg-white/10 rounded-full blur-3xl"></div>
 <div className="absolute bottom-10 right-10 w-64 sm:w-96 h-64 sm:h-96 bg-amber-400/10 rounded-full blur-3xl"></div>
 </div>

 <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-4 relative z-10">
 <div className="max-w-3xl mx-auto text-center">
 <div className="w-8 h-8 sm:w-12 sm:h-12 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-6 backdrop-blur-sm">
 <Mail className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
 </div>
 
 <h2 className="text-lg sm:text-2xl md:text-3xl font-bold text-white mb-3 sm:mb-4">
 Stay Connected with Nature
 </h2>
 
 <p className="text-sm sm:text-base md:text-base text-green-100 mb-4 sm:mb-8 px-4 sm:px-0 leading-relaxed">
 Subscribe to our newsletter for exclusive offers, wellness tips, and updates on our latest organic products
 </p>

 {/* Stacked layout on mobile */}
 <form onSubmit={handleSubmit} className="max-w-md mx-auto">
 <div className="flex flex-col gap-3">
 <input
 type="email"
 value={email}
 onChange={(e) => setEmail(e.target.value)}
 placeholder="Enter your email"
 className="w-full px-3 sm:px-5 py-2 sm:py-3 rounded-full text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-4 focus:ring-white/30 text-xs sm:text-sm"
 required
 />
 <button
 type="submit"
 disabled={status === 'loading'}
 className="w-full bg-white text-green-700 px-5 sm:px-6 py-2 sm:py-3 rounded-full font-bold md:hover:bg-green-50 shadow-lg md:hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-xs sm:text-sm active:scale-95"
 >
 {status === 'loading' ? (
 <span>Subscribing...</span>
 ) : status === 'success' ? (
 <span>✓ Subscribed!</span>
 ) : (
 <>
 Subscribe
 <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
 </>
 )}
 </button>
 </div>
 </form>

 {status === 'success' && (
 <p className="text-green-100 mt-3 sm:mt-4 text-xs sm:text-sm">
 Thank you for subscribing! Check your inbox for a special welcome offer.
 </p>
 )}

 <p className="text-green-200 text-[10px] sm:text-xs mt-3 sm:mt-6">
 We respect your privacy. Unsubscribe at any time.
 </p>
 </div>
 </div>
 </section>
 );
}
