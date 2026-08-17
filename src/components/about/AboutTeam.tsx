"use client";

// "use client": reveal-on-scroll plus the mobile auto-scrolling member track.
// The roster itself is fetched on the server and arrives as a prop.

import { useScrollReveal } from "@/hooks/useScrollReveal";
import { getAbsoluteImageUrl } from "@/lib/imageUtils";

import type { AboutTeamContent, TeamMember } from "./types";
import { useAutoScrollCarousel } from "./useAutoScrollCarousel";

const getMemberImageSrc = (imageUrl: string | null): string =>
  getAbsoluteImageUrl(imageUrl, { defaultFolder: 'avatars' });

/** Up to two initials, shown when a member has no photo. */
const initialsOf = (name: string): string =>
  String(name)
    .split(' ')
    .map((part) => part[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();

/**
 * The team grid.
 *
 * The SPA fetched the roster from the browser and showed a spinner meanwhile.
 * With the query moved to the server the members are in the initial HTML, so
 * the spinner branch has no state that can reach it and is gone. The empty
 * state is kept — an admin who has not added anyone still sees it.
 */
export function AboutTeam({
  team,
  members,
}: {
  team: AboutTeamContent;
  members: TeamMember[];
}) {
  const { ref: teamRef, isVisible: teamVisible } = useScrollReveal({ threshold: 0.2 });
  const teamTrackRef = useAutoScrollCarousel<HTMLDivElement>(members.length);

  return (
    <section className="section-padding bg-white relative z-10">
      <div className="container-custom">
        <div className={`text-center mb-8 sm:mb-12 md:mb-16 reveal reveal-left ${teamVisible ? 'active' : ''}`} ref={teamRef}>
          <span className="text-[#3d7a3d] font-medium text-sm uppercase tracking-wider">
            {team.eyebrow}
          </span>
          <h2 className="font-display text-2xl md:text-3xl font-bold text-[#2d3a2d] mt-2 mb-3">
            {team.heading}
          </h2>
        </div>

        <div className={`reveal reveal-right ${teamVisible ? 'active' : ''}`}>
          {members.length === 0 ? (
            <div className="text-center py-12 text-gray-500">No team members added yet.</div>
          ) : (
            <div
              ref={teamTrackRef}
              className="flex flex-nowrap items-stretch overflow-x-auto gap-0 md:px-0 md:grid md:grid-cols-3 md:gap-10 max-w-4xl lg:max-w-5xl xl:max-w-6xl mx-auto scrollbar-hide snap-x snap-mandatory scroll-smooth md:overflow-visible md:snap-none"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
            >
              {members.map((member, index) => (
                <div
                  key={member.id}
                  className="text-center snap-center flex-shrink-0 w-full min-w-full md:w-auto md:min-w-0 md:max-w-none min-h-[200px] sm:min-h-[220px] md:min-h-0 flex flex-col items-center"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  {member.image && member.image.trim() ? (
                    /* eslint-disable-next-line @next/next/no-img-element -- source
                       markup preserved; avatars may live on an arbitrary host. */
                    <img
                      src={getMemberImageSrc(member.image)}
                      alt={member.name}
                      className="w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 rounded-full mx-auto mb-3 sm:mb-4 object-cover shadow-lg"
                    />
                  ) : (
                    <div className="w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 rounded-full mx-auto mb-3 sm:mb-4 object-cover shadow-lg bg-green-100 flex items-center justify-center">
                      <span className="text-green-700 font-semibold text-xl">
                        {initialsOf(member.name)}
                      </span>
                    </div>
                  )}
                  <h3 className="font-display font-semibold text-[15px] sm:text-base md:text-lg mb-1 min-h-[42px] sm:min-h-[48px] flex items-end justify-center">{member.name}</h3>
                  <p className="text-[#6b7a6b] text-sm min-h-[20px]">{member.role}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
