# Cloudflare Workers + Better Auth Setup (SahFund)

Panduan end-to-end: dari deploy Worker di Cloudflare sampai halaman `/login` benar-benar tampil dan sign-in/sign-up berhasil.

- **Project:** `D:\project\nextjs\SahFund` (bukan monorepo p3-ste — dokumen ini disimpan di sini hanya sebagai catatan).
- **App:** `apps/frontend` — Next.js 16 (App Router) di Cloudflare Workers via OpenNext.
- **Worker name:** `sahfund`. **Database:** Cloudflare D1, binding `env.DB`.
- **Auth:** `better-auth` 1.7.15, session disimpan di D1 (bukan layanan pihak ketiga).

Semua command di bawah dijalankan dari `apps/frontend`, kecuali disebutkan lain.

```powershell
cd D:\project\nextjs\SahFund\apps\frontend
```

---

## 1. Cloudflare / Workers setup

### 1.1 Bentuk deploy

| Bagian | Nilai | Sumber |
|---|---|---|
| Worker name | `sahfund` | `wrangler.jsonc` → `"name"` |
| Entry point | `.open-next/worker.js` | hasil build OpenNext |
| Static assets | binding `ASSETS` | `wrangler.jsonc` → `assets` |
| Database | binding `DB` (D1 `sahfunddb`) | `wrangler.jsonc` → `d1_databases` |
| Build | `npx opennextjs-cloudflare build` | Workers Builds / manual |
| Deploy | `npx wrangler deploy` | Workers Builds / manual |

Binding D1 adalah **konfigurasi**, bukan secret: `database_id` boleh masuk git, tidak ada connection string yang perlu disembunyikan.

### 1.2 Fix error 10143 (`WORKER_SELF_REFERENCE` → `frontend`)

**Gejala**

```
[ERROR] A request to the Cloudflare API (.../workers/scripts/sahfund/versions) failed.
Service binding 'WORKER_SELF_REFERENCE' references Worker 'frontend' which was not found.
[code: 10143]
```

**Penyebab**

OpenNext membutuhkan service binding `WORKER_SELF_REFERENCE` (dipakai untuk `res.revalidate`). Kalau binding ini tidak dideklarasikan di `wrangler.jsonc`, build system Cloudflare menurunkannya dari `package.json` → `"name": "frontend"`. Worker `frontend` tidak pernah dibuat, jadi upload versi untuk `sahfund` ditolak.

Ringkasnya: `wrangler.jsonc` bilang `sahfund`, `package.json` bilang `frontend`, dan binding mengikuti yang kedua.

**Fix (2 perubahan, keduanya di `apps/frontend`)**

1. `wrangler.jsonc` — deklarasikan binding secara eksplisit, tepat setelah blok `assets`:

```jsonc
  "assets": {
    "directory": ".open-next/assets",
    "binding": "ASSETS",
  },
  // OpenNext butuh ini untuk res.revalidate; `service` harus sama dengan "name" di atas.
  // Kalau dibiarkan implisit, Workers Builds menurunkannya dari package.json -> error 10143.
  "services": [
    { "binding": "WORKER_SELF_REFERENCE", "service": "sahfund" },
  ],
```

2. `package.json` — samakan nama paket supaya tidak ada lagi sumber nama yang salah:

```json
  "name": "sahfund",
```

`package.json` bersifat `private: true` dan tidak direferensikan workspace lain, jadi rename ini aman.

> Catatan: binding ini hanya dipakai oleh `res.revalidate` (Page Router ISR). App ini App Router dengan static-assets cache dan tanpa ISR, jadi binding-nya tidak pernah dipanggil — tapi tetap harus menunjuk ke Worker yang benar agar deploy lolos.

### 1.3 Setelan Workers Builds (dashboard)

Worker `sahfund` → **Settings → Build**:

| Setelan | Nilai |
|---|---|
| Root directory | `apps/frontend` |
| Build command | `npx opennextjs-cloudflare build` |
| Deploy command | `npx wrangler deploy` |
| Node version | 24 (sama dengan CI) |

Yang sering kelewat:

- **Root directory salah** (mis. repo root). Repo root tidak punya `package.json`; wrangler tidak menemukan `wrangler.jsonc`, lalu autoconfig membuat konfigurasi sendiri dan menebak nama dari `package.json` — persis jalur yang memunculkan `service: "frontend"`.
- **Bindings di dashboard** — binding yang pernah dibuat lewat dashboard tidak terlihat di git. Cek **Settings → Bindings**, hapus service binding `WORKER_SELF_REFERENCE` yang masih menunjuk `frontend`.
- **Environment variables** di dashboard bukan penyebab error ini (tidak ada env var yang mengisi nama service). Jangan menaruh secret auth di sini kalau bisa pakai `wrangler secret put` (lihat §2.4).

### 1.4 Local dev basics

```powershell
cd D:\project\nextjs\SahFund\apps\frontend
npm install
npx wrangler d1 migrations apply DB --local   # siapkan D1 lokal (state di .wrangler/, gitignored)
npm run dev
```

- `.env` / `.env.*` / `.dev.vars` gitignored — hanya `.env.example` (dan `.dev.vars.example` bila dibuat) yang boleh di-commit.
- Jangan pernah membaca atau menyalin isi file secret ke dalam dokumen/issue/chat.

---

## 2. Better Auth setup (`BETTER_AUTH_SECRET`)

### 2.1 Di mana auth-nya

| File | Isi |
|---|---|
| `src/lib/auth/auth.ts` | `getAuth()` → `betterAuth({ database: drizzleAdapter(...), secret, baseURL, emailAndPassword })`; dibuat lazy per isolate karena butuh binding D1 |
| `src/app/api/auth/route.ts` | `POST /api/auth`, validasi Zod, rate limit, panggil `auth.api.signUpEmail` / `signInEmail`, teruskan cookie session |
| `src/app/login/page.tsx` | halaman `/login` (server component) |
| `src/app/login/auth-form.tsx` | form klien, `fetch("/api/auth", { mode: "sign-up" \| "sign-in", ... })`, redirect ke `redirectTo` |
| `src/lib/auth/schema.ts` | aturan validasi bersama form + API (password min. 10 karakter, nama min. 2) |
| `src/lib/db/schema.ts` | tabel `user` / `session` / `account` / `verification` (hasil generate CLI) |

### 2.2 Secret-nya dari mana?

`BETTER_AUTH_SECRET` **dibuat sendiri**, bukan didapat dari website/console mana pun. Fungsinya sama seperti `JWT_SECRET` yang di-set manual: dipakai Better Auth untuk menandatangani/mengenkripsi session dan token.

Generate (pilih salah satu):

```powershell
npx @better-auth/cli secret
# atau
openssl rand -base64 32
```

Simpan nilainya di secret store, jangan di repo.

### 2.3 Local: `.dev.vars`

Buat `apps/frontend/.dev.vars` (gitignored, **jangan commit**):

```
BETTER_AUTH_SECRET=<hasil generate>
BETTER_AUTH_URL=http://localhost:<port-yang-kamu-buka>
```

Soal port: `next dev` default-nya 3000, suite Playwright memakai 3100, dan komentar di `auth.ts` memakai `http://localhost:3141` sebagai contoh. Pakai port yang benar-benar kamu buka — kalau `BETTER_AUTH_URL` tidak cocok, cookie/session bisa ditolak.

`BETTER_AUTH_URL` opsional (bisa diinfer dari request), tapi lebih aman di-set eksplisit supaya `trustedOrigins` juga ikut terisi.

Repo ini belum punya `.dev.vars.example`; kalau mau menambahkannya, cukup berisi placeholder (tanpa nilai asli) dan pastikan tetap ter-track (`!.dev.vars.example` sudah ada di `.gitignore`).

### 2.4 Production: `wrangler secret put`

```powershell
cd D:\project\nextjs\SahFund\apps\frontend
npx wrangler secret put BETTER_AUTH_SECRET   # paste nilainya saat diminta
npx wrangler secret list                     # verifikasi nama secret sudah terdaftar (nilai tidak ditampilkan)
```

Secret langsung dipakai oleh versi Worker berikutnya, jadi jalankan/lanjutkan deploy setelahnya. Untuk environment preview (`env.preview` di `wrangler.jsonc`), set juga secret-nya dengan `--env preview` bila environment itu dipakai.

### 2.5 Gejala kalau secret belum di-set

`createAuth()` melakukan `throw new Error("BETTER_AUTH_SECRET is not set")`. Route menangkapnya dan mengembalikan:

```
HTTP 503
{ "message": "Layanan masuk sedang tidak tersedia. Coba lagi sebentar lagi." }
```

Jadi **sign-in selalu 503 = secret belum ter-set** (atau binding D1 bermasalah). Detail aslinya hanya muncul di log:

```
auth: request failed { route: "POST /api/auth", status: 503, cause: "BETTER_AUTH_SECRET is not set" }
```

Lihat log dengan:

```powershell
npx wrangler tail sahfund
```

### 2.6 Tabel auth & migrasi

Tabel auth **digenerate**, jangan ditulis tangan (konvensi project: CLI jadi sumber kebenaran, hand-written table akan drift saat upgrade):

```powershell
npx @better-auth/cli generate      # hasilkan/tinjau schema -> src/lib/db/schema.ts
npx drizzle-kit generate           # SQL migrasi ke drizzle/
npx wrangler d1 migrations apply DB --local     # lokal
npx wrangler d1 migrations apply DB --remote    # database Cloudflare (sahfunddb)
```

Kalau tabel belum ada di D1, request auth tetap gagal dan route mengembalikan 503 yang sama — bedanya di `cause` pada log.

---

## 3. Verifikasi

### 3.1 Cek binding sebelum deploy

```powershell
cd D:\project\nextjs\SahFund\apps\frontend
npx wrangler deploy --dry-run
```

Yang harus terlihat di tabel bindings: `WORKER_SELF_REFERENCE` → `sahfund` (bukan `frontend`), `DB` → D1 `sahfunddb`, `ASSETS`.

Setelah deploy sungguhan:

```powershell
npx wrangler deployments list --name sahfund
```

### 3.2 Smoke test halaman login

1. Buka `https://<worker-domain>/login` → form "Masuk atau buat akun" tampil (tab `Daftar` / `Masuk`).
2. Daftar: nama ≥ 2 karakter, email valid, password ≥ 10 karakter → harus redirect ke `/` dan cookie session ter-set.
3. Logout / buka private window → mode `Masuk` (`/login?mode=masuk`) dengan kredensial yang sama → berhasil.
4. Password salah → `401` dengan pesan "Email atau kata sandi belum cocok." (bukan 503).

Cek langsung tanpa UI (ganti nilainya, jangan pakai password asli di tempat publik):

```bash
curl -i -X POST "https://<worker-domain>/api/auth" \
  -H "content-type: application/json" \
  -d '{"mode":"sign-in","email":"you@example.com","password":"<password>"}'
```

Sukses = `200` + `{"redirectTo":"/"}` + header `set-cookie`. `503` = lihat §2.5.

### 3.3 Troubleshooting

| Gejala | Penyebab | Fix |
|---|---|---|
| Error 10143 `references Worker 'frontend'` | `WORKER_SELF_REFERENCE` tidak dideklarasikan → diturunkan dari `package.json` | §1.2: tambah `services` di `wrangler.jsonc` + rename `package.json` |
| Build jalan tapi konfigurasi yang dipakai bukan dari repo | Root directory Workers Builds salah (repo root) | Set root directory ke `apps/frontend` |
| Error 10143 tetap muncul walau config sudah benar | Binding lama tersimpan di dashboard (tidak terlihat di git) | Settings → Bindings, hapus binding `frontend` |
| Sign-in selalu `503` "Layanan masuk sedang tidak tersedia" | `BETTER_AUTH_SECRET` belum di-set di Worker | `npx wrangler secret put BETTER_AUTH_SECRET`, lalu deploy ulang |
| Sign-in `503` tapi secret sudah ada | Tabel auth belum ada di D1 / binding `DB` salah | §2.6: generate schema, migrasi ke D1, cek binding `DB` |
| Login sukses tapi balik ke halaman login | `BETTER_AUTH_URL` / origin tidak cocok, cookie ditolak | Samakan `BETTER_AUTH_URL` dengan domain/port yang dibuka |
| `429` "Terlalu banyak percobaan" | Rate limit route auth | Tunggu 60 detik |

---

## 4. Konvensi yang wajib dipegang

- **Secret tidak pernah masuk git.** Lokal: `.dev.vars` (gitignored). Produksi: `npx wrangler secret put`. Dokumen/issue/chat juga tidak boleh memuat nilainya.
- **`.env*` tidak dibaca/dibagikan.** Hanya `.env.example` yang boleh dilihat sebagai referensi.
- **D1 bukan secret.** `database_id` di `wrangler.jsonc` memang bagian dari konfigurasi.
- **Nama Worker konsisten di tiga tempat:** `wrangler.jsonc` → `name`, `WORKER_SELF_REFERENCE.service`, dan project Workers Builds. Salah satu beda = error 10143 atau deploy ke Worker yang salah.
- **Schema auth dari CLI**, bukan tulis tangan; migrasi lewat `drizzle-kit` + `wrangler d1 migrations apply`.
