import type { DemoMember } from "@/lib/landing-demo";

/** The couple-attribution chip: Ayu emerald, Budi gold, stable per workspace. */
export function MemberChip({
  member,
  name = true,
}: {
  member: DemoMember;
  name?: boolean;
}) {
  const ayu = member === "ayu";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-small font-bold ${
        ayu ? "bg-emerald text-pearl" : "bg-gold text-emerald"
      }`}
    >
      {name ? (ayu ? "Ayu" : "Budi") : null}
    </span>
  );
}
