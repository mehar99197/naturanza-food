import { RevealTrack } from "./CarouselTrack";
import { CategoryCard } from "./CategoryCard";
import type { HomeCategoryCard } from "./categoryCards";
import { Reveal } from "./Reveal";

/**
 * "Shop by Category" — ported from frontend/src/sections/Categories.jsx.
 *
 * A Server Component. The source fetched the categories from the browser and
 * then re-fetched them every 15 seconds, plus on window focus, on tab
 * visibility, and on a `categories:updated` event — four freshness mechanisms
 * for a list that changes when an admin edits it. The rows are read on the
 * server here and the page's own cache policy decides freshness, so the tiles
 * are in the first response and an idle tab stops polling the API forever.
 *
 * ⚠ That does change one thing: a category an admin edits in another tab no
 * longer appears in this one within 15 seconds. It appears on the next
 * navigation or reload. Called out for the integrator in case the admin
 * workflow depended on it.
 */
export function Categories({ categories }: { categories: HomeCategoryCard[] }) {
  const isCategoriesExist = categories.length > 0;

  return (
    <section className="py-5 sm:py-6 md:py-7 bg-gradient-to-b from-white via-green-50/30 to-white relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(61,122,61,0.05),transparent_50%)]"></div>

      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-4 relative z-10">
        <Reveal className="text-center mb-6 sm:mb-10 md:mb-14 lg:mb-20 reveal reveal-left">
          <span className="inline-block text-white font-bold text-xs uppercase tracking-wider mb-3 md:mb-4 px-4 py-1.5 md:px-6 md:py-2 bg-green-600 rounded-full shadow-md animate-fade-in-up opacity-0 [animation-fill-mode:forwards]">
            Categories
          </span>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 md:mb-5 lg:mb-6 animate-fade-in-up opacity-0 [animation-delay:0.1s] [animation-fill-mode:forwards]">
            <span className="bg-gradient-to-r from-green-700 to-emerald-600 bg-clip-text text-transparent">
              Shop by Category
            </span>
          </h2>
          <p className="text-sm sm:text-base md:text-base text-gray-600 max-w-2xl mx-auto px-4 md:px-0 animate-fade-in-up opacity-0 [animation-delay:0.2s] [animation-fill-mode:forwards]">
            Browse our diverse range of organic products tailored to your wellness needs
          </p>
        </Reveal>

        {/* Single horizontal row with controlled auto-scroll */}
        <RevealTrack
          itemCount={categories.length}
          className="flex flex-nowrap overflow-x-auto gap-0 md:grid md:grid-cols-2 lg:grid-cols-4 md:gap-5 lg:gap-4 pb-2 scrollbar-hide snap-x snap-mandatory scroll-smooth md:overflow-x-visible md:snap-none md:pb-0 reveal reveal-right"
        >
          {isCategoriesExist ? (
            categories.map((category, index) => (
              <CategoryCard key={category.id} category={category} index={index} />
            ))
          ) : (
            <div className="col-span-full text-center py-12">
              <p className="text-gray-500 text-base">No categories available yet.</p>
            </div>
          )}
        </RevealTrack>
      </div>
    </section>
  );
}
