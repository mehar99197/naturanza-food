import Link from "next/link";

/**
 * What `notFound()` renders for an unknown or unpublished slug.
 *
 * The same markup BlogPost.jsx showed for a failed fetch — but served with a real
 * 404 status. The SPA answered 200 for every slug that had never existed, which
 * is how a mistyped or retired URL ends up indexed as a valid, empty page.
 */
export default function BlogPostNotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#faf8f3]">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">Post Not Found</h1>
        <Link href="/blog" className="text-green-600 hover:underline">
          Back to Blog
        </Link>
      </div>
    </div>
  );
}
