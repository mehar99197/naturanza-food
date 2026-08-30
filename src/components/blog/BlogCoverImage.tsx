import { blogImageSrc } from "./postFields";

/**
 * The card cover, unchanged from Blog.jsx — including the reasoning behind
 * `object-contain`, which is worth keeping because the choice looks like a
 * mistake otherwise:
 *
 *   Blog covers are product photographs, and they are taller than the card slot:
 *   the ispaghol shot is 602x630 in a 393x176 box. object-cover therefore showed
 *   a middle band of roughly 43% of the image, cutting the lid off the top and
 *   the base off the bottom. contain on a white field keeps the whole jar, which
 *   is also how the category cards present the very same photographs.
 *
 * A plain <img>, not next/image: the wrapper next/image needs would change this
 * markup, and being a Server Component this ships no JavaScript at all.
 */
export function BlogCoverImage({
  post,
  className,
  emojiClass = "text-4xl",
}: {
  post: { title: string; imageUrl: string | null };
  className: string;
  emojiClass?: string;
}) {
  if (post.imageUrl) {
    return (
      <div className={`${className} flex items-center justify-center overflow-hidden bg-white`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={blogImageSrc(post.imageUrl)}
          alt={post.title}
          loading="lazy"
          className="h-full w-full object-contain p-3"
        />
      </div>
    );
  }

  return (
    <div
      className={`${className} bg-gradient-to-br from-green-100 to-emerald-50 flex items-center justify-center`}
    >
      <span className={emojiClass}>🌿</span>
    </div>
  );
}
