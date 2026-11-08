import type { Metadata } from "next";

import { Capabilities } from "@/components/landing/capabilities";
import { Close } from "@/components/landing/close";
import { Faq } from "@/components/landing/faq";
import { Hero } from "@/components/landing/hero";
// TODO(payment): disabled until payment gateway chosen — see docs/projects/NOTE-payment-disabled.md
// import { Pricing } from "@/components/landing/pricing";
import { Reveal } from "@/components/landing/reveal";
import { Steps } from "@/components/landing/steps";

export const metadata: Metadata = {
  title: "SahFund — dana nikah, tercatat berdua",
};

export default function Home() {
  return (
    <main className="bg-pearl text-ink [--focus-ring:var(--color-emerald)]">
      <Reveal />
      <Hero />
      <Steps />
      <Capabilities />
      {/* TODO(payment): disabled until payment gateway chosen — see docs/projects/NOTE-payment-disabled.md */}
      {/* <Pricing /> */}
      <Faq />
      <Close />
    </main>
  );
}
