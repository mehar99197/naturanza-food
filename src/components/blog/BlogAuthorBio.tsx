import { authorInitial } from "./postFields";

/** The author strip below the article, unchanged from BlogPost.jsx. */
export function BlogAuthorBio({ author }: { author: string }) {
  return (
    <div className="flex items-center gap-5 bg-white rounded-2xl border border-green-100 shadow-sm p-5 sm:p-6 mb-8">
      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-green-500 to-emerald-700 text-white text-2xl font-bold shadow-md ring-4 ring-green-50">
        {authorInitial(author)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-bold text-slate-900 text-base">{author}</p>
          <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-700 border border-green-100">
            ✍️ Writer
          </span>
        </div>
        <p className="text-xs text-green-600 font-medium mt-0.5">Naturanza Food</p>
        <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">
          Writing about natural food, traditional remedies, and healthy living for Pakistani families.
        </p>
      </div>
    </div>
  );
}
