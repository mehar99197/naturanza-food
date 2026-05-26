import { Check, Leaf } from "lucide-react";

const LeftPanel = ({
  heading,
  description,
  trustPoints = [],
  logoSrc = "/images/logo.png",
  logoAlt = "Naturanza Food",
}) => {
  return (
    <aside className="relative hidden h-screen w-full overflow-hidden bg-gradient-to-b from-green-700 via-green-800 to-emerald-900 lg:flex">
      <div className="pointer-events-none absolute inset-0">
        <Leaf className="absolute left-[10%] top-[12%] h-28 w-28 text-white/10" />
        <Leaf className="absolute right-[12%] top-[24%] h-24 w-24 -rotate-12 text-white/10" />
        <Leaf className="absolute left-[20%] bottom-[22%] h-24 w-24 rotate-[20deg] text-white/10" />
        <Leaf className="absolute right-[18%] bottom-[12%] h-28 w-28 -rotate-[18deg] text-white/10" />
      </div>

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(34,197,94,0.2),transparent_40%),radial-gradient(circle_at_80%_78%,rgba(16,185,129,0.14),transparent_34%)]" />

      <div className="relative z-10 flex w-full flex-col px-10 pb-12 pt-8 xl:px-14">
        <img
          src={logoSrc}
          alt={logoAlt}
          className="h-11 w-auto object-contain brightness-0 invert"
        />

        <div className="my-auto w-full max-w-xl">
          <h2 className="text-4xl font-bold leading-[1.08] tracking-[-0.02em] text-white xl:text-5xl">
            {heading}
          </h2>

          <p className="mt-6 max-w-lg text-base leading-relaxed text-green-50/90 xl:text-lg">
            {description}
          </p>

          <ul className="mt-9 space-y-4">
            {trustPoints.map((point) => (
              <li key={point} className="flex items-center gap-3.5">
                <span className="inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-white/25 bg-white/15 text-white">
                  <Check className="h-4 w-4" />
                </span>
                <span className="text-base font-medium text-green-50">{point}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </aside>
  );
};

export default LeftPanel;
