import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "SahFund — dana nikah, tercatat berdua",
    template: "%s · SahFund",
  },
  description:
    "SahFund mencocokkan mutasi rekening kalian dengan saldo yang dicetak bank, lalu menghitung apakah dananya cukup sampai hari H.",
};

/**
 * The `js` class arms the reveal transitions (globals.css) before first paint, so sections
 * never flash their finished state first. Without script the page is simply visible.
 * The same pre-paint pass restores the collapsed dashboard sidebar before hydration.
 */
const ARM_REVEAL = `document.documentElement.classList.add('js');
try {
  if (localStorage.getItem('sahfund.sidebar') === 'collapsed') {
    document.documentElement.dataset.sidebar = 'collapsed';
  }
} catch (e) {}
setTimeout(function () {
  if (!document.documentElement.classList.contains('revealed')) {
    document.documentElement.classList.remove('js');
  }
}, 3000);`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // `js` is set on <html> by ARM_REVEAL before hydration; that class diff is intended.
    // `data-scroll-behavior` tells Next the global CSS smooth scroll (globals.css:90) is deliberate.
    <html
      lang="id"
      className={`${jakarta.variable} h-full`}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <body className="min-h-full bg-surface font-sans text-body text-tertiary antialiased">
        <script dangerouslySetInnerHTML={{ __html: ARM_REVEAL }} />
        {children}
      </body>
    </html>
  );
}
