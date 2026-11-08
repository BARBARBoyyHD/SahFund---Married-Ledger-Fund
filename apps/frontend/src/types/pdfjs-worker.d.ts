/**
 * pdf.js ships `build/pdf.worker.min.mjs` without declarations. The client imports it for
 * its side effect only — it registers `globalThis.pdfjsWorker`, which pdf.js uses as the
 * main-thread message handler (see `app/dashboard/imports/import-flow.tsx`).
 */
declare module "pdfjs-dist/build/pdf.worker.min.mjs";
