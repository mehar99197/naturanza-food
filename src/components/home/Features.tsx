"use client";

// "use client": the delivery card quotes the live free-shipping threshold from
// SettingsProvider, which is a client store. Everything else in here is static,
// but the copy has to come from the same render as the rest of the card.

import { useSettings } from "@/providers/SettingsProvider";

import { RevealTrack } from "./CarouselTrack";
import { buildFeatures, readShippingFree } from "./featureItems";
import { Reveal } from "./Reveal";

/**
 * "Why Choose Naturanza?" — the four benefit cards, ported from
 * frontend/src/sections/Features.jsx.
 *
 * The cards are a horizontal snap-scroller under 768px and a 2/4-column grid
 * above it; `RevealTrack` owns the mobile auto-advance and the reveal. Because
 * `settings` starts at `DEFAULT_SETTINGS` and is refreshed by a poll, the
 * threshold in the delivery copy can change after hydration — exactly as it did
 * in the source, and with the same default, so the first paint matches.
 */
export function Features() {
  const { settings } = useSettings();
  const features = buildFeatures(
    readShippingFree(settings.shippingFree),
    settings.currency,
  );

  return (
    <section className="py-5 sm:py-6 md:py-7 bg-gradient-to-b from-green-50 to-white relative overflow-hidden">
      {/* Decorative Background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(61,122,61,0.05),transparent_50%),radial-gradient(circle_at_70%_80%,rgba(61,122,61,0.05),transparent_50%)]"></div>

      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-4 relative z-10">
        <Reveal className="text-center mb-5 sm:mb-8 md:mb-10 reveal reveal-left">
          <span className="inline-block text-white font-bold text-xs uppercase tracking-wider mb-2 sm:mb-3 px-3 sm:px-4 py-1 sm:py-1.5 bg-green-600 rounded-full shadow-md">Our Benefits</span>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4">
            <span className="bg-gradient-to-r from-green-700 to-emerald-600 bg-clip-text text-transparent">Why Choose Naturanza?</span>
          </h2>
          <p className="text-xs sm:text-sm text-gray-600 max-w-2xl mx-auto px-4 sm:px-0">
            We&apos;re committed to bringing you the finest organic products with unmatched quality and care
          </p>
        </Reveal>

        {/* Single horizontal row with controlled scrolling */}
        <RevealTrack
          itemCount={features.length}
          className="flex flex-nowrap overflow-x-auto gap-0 md:grid md:grid-cols-2 lg:grid-cols-4 md:gap-5 lg:gap-6 pb-2 scrollbar-hide snap-x snap-mandatory scroll-smooth md:overflow-visible md:snap-none md:pb-0 reveal reveal-right"
        >
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div
                key={index}
                className="snap-center flex-shrink-0 w-full min-w-full md:w-auto md:min-w-0 text-center p-4 sm:p-6 md:p-7 lg:p-8 rounded-2xl sm:rounded-3xl bg-white shadow-md md:hover:shadow-2xl md:hover:-translate-y-2 transition-all duration-500 ease-out group border-2 border-green-100 md:hover:border-green-300"
              >
                <div className="w-10 h-10 sm:w-14 sm:h-14 md:w-16 md:h-16 bg-gradient-to-br from-green-500 to-green-700 rounded-xl sm:rounded-2xl flex items-center justify-center mx-auto mb-3 sm:mb-4 md:mb-5 lg:mb-6 md:group-hover:rotate-12 md:group-hover:scale-110 transition-all duration-500 ease-out shadow-lg md:group-hover:shadow-xl">
                  <Icon className="w-5 h-5 sm:w-7 sm:h-7 md:w-8 md:h-8 text-white transition-transform duration-500" />
                </div>
                <h3 className="text-base sm:text-lg md:text-base lg:text-lg font-bold text-gray-900 mb-2 sm:mb-3">
                  {feature.title}
                </h3>
                <p className="text-sm sm:text-base md:text-sm text-gray-700 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </RevealTrack>
      </div>
    </section>
  );
}
