import { Check, Leaf, Moon, Shield, Smile, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * The desktop "Key Benefits" grid.
 *
 * PRESERVED AS FOUND, AND WORTH FLAGGING: these six claims are hard-coded and
 * identical on every product page. They are not read from the product's own
 * `benefits` column — that copy appears further down, in the Benefits tab. So a
 * jar of honey and a bottle of coconut oil both advertise "Improves Sleep
 * Quality" here. That is a content decision for the business, not something to
 * fix inside a port, so the list is reproduced exactly.
 */

interface KeyBenefit {
  icon: LucideIcon;
  label: string;
  /** Tailwind classes for the icon's circle and its stroke. */
  circleClass: string;
  iconClass: string;
}

const KEY_BENEFITS: readonly KeyBenefit[] = [
  {
    icon: Leaf,
    label: "Reduces Stress & Anxiety",
    circleClass: "bg-emerald-50",
    iconClass: "text-emerald-600",
  },
  {
    icon: Shield,
    label: "Supports Immune Health",
    circleClass: "bg-blue-50",
    iconClass: "text-blue-600",
  },
  {
    icon: Moon,
    label: "Improves Sleep Quality",
    circleClass: "bg-indigo-50",
    iconClass: "text-indigo-600",
  },
  {
    icon: Smile,
    label: "Balances Mood Naturally",
    circleClass: "bg-amber-50",
    iconClass: "text-amber-600",
  },
  {
    icon: Zap,
    label: "Boosts Energy & Focus",
    circleClass: "bg-yellow-50",
    iconClass: "text-yellow-600",
  },
  {
    icon: Check,
    label: "100% Natural & Safe",
    circleClass: "bg-green-50",
    iconClass: "text-green-600",
  },
];

export function ProductKeyBenefits() {
  return (
    <div className="mt-5">
      <h3 className="text-sm font-bold text-gray-900 mb-3">Key Benefits</h3>
      <div className="grid grid-cols-2 gap-3">
        {KEY_BENEFITS.map(({ icon: Icon, label, circleClass, iconClass }) => (
          <div key={label} className="flex items-start gap-2.5">
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-full ${circleClass} flex-shrink-0`}
            >
              <Icon className={`h-5 w-5 ${iconClass}`} strokeWidth={2} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 leading-tight">{label}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
