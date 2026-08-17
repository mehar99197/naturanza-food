"use client";

// "use client": reveal-on-scroll, as with the other sections.

import { useScrollReveal } from "@/hooks/useScrollReveal";
import { getAbsoluteImageUrl } from "@/lib/imageUtils";

import type { AboutStoryContent } from "./types";

const DEFAULT_STORY_IMAGE = "/images/about-herbs.jpg";

/**
 * Resolves whatever the admin stored for the story image.
 *
 * The bundled default is passed through untouched; anything else is either an
 * absolute URL or an upload, and uploads default to the `blog` folder because
 * the editor reuses the blog uploader (see `aboutAPI.uploadImage`).
 */
const resolveStoryImage = (image: string): string => {
  const value = String(image || '').trim();
  if (!value) return DEFAULT_STORY_IMAGE;
  if (value === DEFAULT_STORY_IMAGE) return value; // bundled default asset
  if (/^https?:\/\//i.test(value)) return value;
  return getAbsoluteImageUrl(value, { defaultFolder: 'blog' });
};

export function AboutStory({ story }: { story: AboutStoryContent }) {
  const { ref: storyRef, isVisible: storyVisible } = useScrollReveal<HTMLElement>();

  return (
    <section className="section-padding bg-white" ref={storyRef}>
      <div className="container-custom">
        <div className="grid md:grid-cols-2 gap-5 sm:gap-8 md:gap-10 lg:gap-12 items-center">
          <div className={`reveal reveal-left ${storyVisible ? 'active' : ''}`}>
            {/* eslint-disable-next-line @next/next/no-img-element -- the source
                markup is preserved verbatim; the admin can point this at any
                host, which next/image would need remotePatterns to accept. */}
            <img
              src={resolveStoryImage(story.image)}
              alt="Our story"
              className="rounded-3xl shadow-2xl w-full h-[260px] sm:h-[320px] md:h-[420px] lg:h-[440px] xl:h-[500px] object-cover"
            />
          </div>
          <div className={`mt-1 sm:mt-2 lg:mt-0 reveal reveal-right ${storyVisible ? 'active' : ''}`}>
            <h2 className="font-display text-xl md:text-2xl font-bold text-[#2d3a2d] mb-4 md:mb-6">
              {story.heading}
            </h2>
            <div className="max-w-xl space-y-3 md:space-y-4 text-[#6b7a6b] text-[13px] sm:text-sm md:text-base lg:text-[17px] leading-6 sm:leading-7 md:leading-relaxed lg:leading-8">
              {story.paragraphs.map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
