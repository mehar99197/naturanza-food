import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { NoIndexSEO } from "@/components/SEO";

export function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 via-white to-emerald-50 px-4">
      <NoIndexSEO title="Page Not Found" />
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center max-w-md"
      >
        {/* Large 404 */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.6, type: "spring" }}
          className="relative mb-6"
        >
          <span className="text-[140px] font-black text-green-100 select-none leading-none block">
            404
          </span>
          <span className="absolute inset-0 flex items-center justify-center text-4xl">
            🌿
          </span>
        </motion.div>

        <h1 className="text-3xl font-bold text-gray-800 mb-3">
          Page Not Found
        </h1>
        <p className="text-gray-500 mb-8 leading-relaxed">
          Oops! The page you're looking for seems to have wandered off into the
          wild. Let's get you back to nature.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-green-600 text-white font-semibold hover:bg-green-700 transition-colors duration-200 shadow-md hover:shadow-lg"
          >
            🏠 Go Home
          </Link>
          <Link
            to="/shop"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full border-2 border-green-600 text-green-700 font-semibold hover:bg-green-50 transition-colors duration-200"
          >
            🛒 Browse Shop
          </Link>
        </div>
      </motion.div>
    </div>
  );
}

export default NotFound;
