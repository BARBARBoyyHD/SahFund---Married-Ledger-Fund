# Migrasi Data D1 & Secret Workers via CLI (SahFund)

Panduan operasional: memindahkan **data** antar database D1 (lokal ↔ `sahfunddb` ↔ `sahfund-preview`) dan mengelola **secret** Worker lewat CLI. Fokusnya CLI + urutan aman, bukan teori.

- **App:** `apps/frontend` — Next.js 16 di Cloudflare Workers via OpenNext.
- **Binding:** `DB` → D1 `sahfunddb` (produksi), `env.preview` → `sahfund-preview` (belum dibuat).
- **Semua command dijalankan dari** `apps/frontend`.

```powershell
cd D:\project\nextjs\SahFund\apps\frontend
npx wrangler --version   # 4.156.1 saat dokumen ini ditulis
```

> **Versi CLI itu penting.** Perintah D1 berubah antar major Wrangler (`d1 copy` sudah tidak ada di v4 — lihat §3.4). Kalau `npx wrangler --version` di mesinmu beda jauh, cek ulang help sebelum menyalin command di bawah.

---

## 0. Perintah yang sudah diverifikasi

Dicek terhadap Wrangler **4.156.1** yang terpasang di repo ini (`npx wrangler <cmd> --help`). Kolom "Dijalankan" menandai yang benar-benar dieksekusi.

| Perintah | Status | Catatan |
|---|---|---|
| `wrangler d1 list` / `d1 info <name>` | help ✓ | `d1 info` punya `--json`; `d1 list` butuh login Cloudflare |
| `wrangler d1 create <name>` | help ✓ | opsi `--location`, `--jurisdiction`, `--binding`, `--update-config` |
| `wrangler d1 export <name>` | dijalankan (lokal) | butuh `--local` atau `--remote` + `--output` (wajib) |
| `wrangler d1 execute <db>` | dijalankan (lokal) | butuh `--command` atau `--file` |
| `wrangler d1 migrations create|list|apply` | `list` help ✓, `apply` dijalankan (lokal) | `list` hanya menampilkan migrasi yang **belum** diterapkan |
| `wrangler d1 time-travel info|restore` | help ✓ | restore = in-place (bukan copy); `--bookmark`, `--timestamp` |
| `wrangler secret put|list|delete|bulk` | help ✓ | `bulk` menerima file `.env`/JSON atau stdin, maks. 100 secret |
| `wrangler deploy --env preview` | help ✓ (`-e/--env` global) | belum dieksekusi karena Worker preview belum ada |

**Yang TIDAK ada di v4.156.1:**

- `wrangler d1 copy` — tidak ada. Copy DB = export → `d1 create` → import (§3.4).
- `wrangler d1 time-travel fork/clone` — belum ada; Time Travel hanya `info` dan `restore` (in-place). Ini juga dinyatakan di [docs Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/).
- Flag `--preview` pada `d1 execute`/`migrations apply` **bukan** untuk `env.preview`. Itu membaca field lama `preview_database_id` yang tidak dipakai repo ini. Pakai `--env preview` (§1).

Belum dieksekusi di dokumen ini (karena butuh DB/Worker nyata): semua command `--remote` ke `sahfund-preview`, semua `secret put/delete/bulk`, dan `deploy --env preview`. Semuanya ditulis dari help output yang terverifikasi.

---

## 1. Model mental: tiga database, satu binding

| Lokasi | Nama / binding | Dipakai oleh | Isi |
|---|---|---|---|
| Lokal | binding `DB`, file SQLite di `.wrangler\state\v3\d1\miniflare-D1DatabaseObject\*.sqlite` | hanya command dengan `--local`, dan `wrangler dev` **kalau** `remote: false` | data dev, gitignored, aman dihapus |
| Remote produksi | `sahfunddb` (`a7495b0b-…`), binding `DB` top-level | Worker `sahfund`, `next dev`, `wrangler dev` | **data pengguna asli** |
| Remote preview | `sahfund-preview`, binding `DB` di `env.preview` | Worker `sahfund-preview` | belum ada — `database_id` masih placeholder |

`wrangler.jsonc` saat ini punya `"remote": true` pada binding produksi. Artinya:

> **`next dev` dan `wrangler dev` menulis ke database PRODUKSI, bukan ke `.wrangler/state`.** Command D1 tanpa flag juga default-nya remote. Jadi: **selalu tulis `--local` atau `--remote` secara eksplisit di setiap command.**

Yang sudah terbukti dari eksekusi lokal:

- `d1 execute DB --local` mencetak `Resource location: local … from .wrangler\state\v3\d1`. Flag `--local` **menang** atas `remote: true` — jadi kamu tetap bisa memakai DB lokal tanpa mengubah config.
- ID database yang dicetak untuk mode lokal sama dengan ID produksi (karena config-nya menunjuk ke sana). **Jangan pakai baris itu sebagai bukti kamu menyentuh DB lokal** — baca baris `Resource location:`.

Aturan penamaan yang dipakai dokumen ini:

- `--local` / `--remote` menentukan **lokasi**.
- `--env preview` menentukan **environment** (`env.preview` di `wrangler.jsonc`).
- Posisi `<database>` menerima **nama atau binding** di `execute`/`migrations`, tapi `d1 export` meminta **nama database** (`sahfunddb`, `sahfund-preview`) untuk mode remote.

---

## 2. Migrasi schema (ringkas)

Schema bukan ditulis tangan; sumbernya `src/lib/db/schema.ts` → `drizzle/`.

```powershell
npx drizzle-kit generate                                  # SQL baru ke drizzle/
npx wrangler d1 migrations list DB --local                # yang belum diterapkan (lokal)
npx wrangler d1 migrations apply DB --local               # lokal
npx wrangler d1 migrations list DB --remote               # yang belum diterapkan (produksi)
npx wrangler d1 migrations apply DB --remote              # produksi (sahfunddb)
```

- `d1_migrations` adalah tabel bookkeeping Wrangler. Jangan diedit tangan; isinya ikut terbawa saat export (§3.2), jadi database hasil import tidak akan menjalankan ulang migrasi lama.
- `migrations list` hanya menampilkan yang **belum** diterapkan. Kalau kosong, semua sudah masuk.
- Migrasi harus **expand/contract** (tambah kolom nullable dulu, backfill, baru wajibkan) — rollback Worker tidak boleh bertemu schema yang tidak kompatibel (AGENTS §2, ITA §5).
- Detail auth + migrasi awal: [`cloudflare-better-auth-setup.md`](cloudflare-better-auth-setup.md) §2.6.

---

## 3. Migrasi data antar environment

### 3.1 Ringkasan flag (terverifikasi)

| Perintah | Flag penting | Arti |
|---|---|---|
| `d1 export <name>` | `--local` / `--remote` | sumber export |
| | `--output <file>` | **wajib** |
| | `--table <nama>` (boleh diulang) | batasi ke tabel tertentu |
| | `--no-data` | schema saja |
| | `--no-schema` | data saja |
| | `-y`, `--skip-confirmation` | lewati konfirmasi |
| `d1 execute <db>` | `--command "<sql>"` / `--file <file>` | salah satu wajib |
| | `--local` / `--remote` | target |
| | `-y`, `--yes` | jawab "yes" untuk prompt |
| | `--json` | output JSON (enak untuk cek count) |
| | `--persist-to <dir>` | ganti direktori state lokal (harus dengan `--local`) |
| `d1 migrations apply <db>` | `--local` / `--remote` / `--env <env>` | target |

### 3.2 Export (backup / ambil data)

Export bersifat **baca saja** — tidak mengubah database — tapi **memblokir request lain selama berjalan** (keterangan resmi Cloudflare), jadi jalankan di jam sepi untuk DB produksi.

```powershell
# folder backup: di dalam .wrangler/ yang sudah gitignored — jangan taruh di docs/ atau src/
New-Item -ItemType Directory -Force .wrangler\backups | Out-Null
$ts = Get-Date -Format 'yyyyMMdd-HHmm'

# 1) PRODUKSI: full schema + data
npx wrangler d1 export sahfunddb --remote --output ".wrangler\backups\sahfunddb-$ts.sql" -y

# 2) schema saja (untuk review/diff)
npx wrangler d1 export sahfunddb --remote --output ".wrangler\backups\sahfunddb-schema-$ts.sql" --no-data

# 3) satu tabel saja (mis. transactions)
npx wrangler d1 export sahfunddb --remote --table transactions --output ".wrangler\backups\transactions-$ts.sql"
```

Lokal (dijalankan & terverifikasi):

```powershell
npx wrangler d1 export DB --local --output ".wrangler\backups\local-$ts.sql"
```

Isi file export yang perlu kamu tahu:

- Diawali `PRAGMA defer_foreign_keys=TRUE;` lalu `CREATE TABLE …` dan `INSERT INTO …`.
- **Ikut menyertakan `d1_migrations`** → setelah import, `migrations list` tidak akan menawarkan migrasi yang sudah ada.
- Sebagian `CREATE TABLE` **tanpa** `IF NOT EXISTS` (mengikuti SQL asli dari migrasi drizzle). Konsekuensi: **import ke database yang sudah punya tabel akan gagal** (`table … already exists`). Import selalu ke DB kosong.
- `INSERT INTO` biasa (bukan `OR REPLACE`) → import dua kali = `UNIQUE constraint failed`.
- Tabel internal `_cf_KV` tidak ikut (bagus, tidak perlu).
- Angka besar bisa kehilangan presisi saat export (batas 52-bit JavaScript). Nominal rupiah dalam minor units jauh di bawah 2^53, jadi aman untuk repo ini — tetap verifikasi dengan `SUM` setelah import (§3.3).
- Batas ukuran file import: **5 GiB**. Lebih dari itu, pecah per tabel.

### 3.3 Import / execute SQL

Selalu cek target dulu dengan query read-only, baru tulis.

```powershell
# target: preview (butuh database_id asli dulu — §3.5)
npx wrangler d1 execute DB --remote --env preview --command "SELECT name FROM sqlite_schema WHERE type='table' ORDER BY name;"

# target: produksi (hati-hati)
npx wrangler d1 execute DB --remote --command "SELECT COUNT(*) AS n FROM transactions;"

# import file ke preview
npx wrangler d1 execute DB --remote --env preview --file ".wrangler\backups\sahfunddb-20261108-2100.sql" -y
```

Cek hasil import (bandingkan dengan sumber):

```powershell
npx wrangler d1 execute DB --remote --env preview --json --command "SELECT (SELECT COUNT(*) FROM transactions) AS transactions, (SELECT COUNT(*) FROM imports) AS imports, (SELECT COUNT(*) FROM user) AS users;"
```

Jebakan yang sudah diketahui (dari docs Cloudflare):

- `Statement too long` → pecah satu `INSERT` besar jadi beberapa `INSERT` lebih kecil.
- `cannot start a transaction within a transaction` → file berasal dari dump `sqlite3` yang masih mengandung `BEGIN TRANSACTION`/`COMMIT;`; hapus dua baris itu.
- `FOREIGN KEY constraint failed` → file export menaruh `PRAGMA defer_foreign_keys=TRUE;` di baris pertama supaya urutan tabel tidak masalah. Jangan hapus baris itu; kalau file dipecah manual, pastikan tabel induk dibuat sebelum anaknya.
- File `.sqlite3` mentah tidak bisa diimport langsung; konversi dulu dengan `sqlite3 db.sqlite3 .dump > db.sql` lalu bersihkan seperti di atas.

### 3.4 Copy database → database baru

Di Wrangler 4.156.1 **tidak ada** `d1 copy`, dan Time Travel belum bisa fork/clone. Resep resminya:

1. **Export** sumber: `npx wrangler d1 export sahfunddb --remote --output ".wrangler\backups\src-<ts>.sql" -y`
2. **Create** target: `npx wrangler d1 create <nama-baru>` → catat `database_id` yang dicetak.
3. **Daftarkan** id itu di `wrangler.jsonc` (binding `DB` di blok yang sesuai).
4. **Import**: `npx wrangler d1 execute DB --remote [--env <env>] --file ".wrangler\backups\src-<ts>.sql" -y`
5. **Verifikasi** count di kedua sisi, lalu deploy Worker yang memakai DB baru.

Alternatif "backup tanpa export": `npx wrangler d1 time-travel info sahfunddb` (ambil bookmark) dan `time-travel restore` — tapi ini **menimpa in-place**, bukan membuat salinan. Simpan bookmark sebelum migrasi berisiko; jendelanya 30 hari (paid) / 7 hari (free).

### 3.5 Resep A — membuat & mengisi `sahfund-preview` (yang repo ini butuh)

`wrangler.jsonc` masih memakai `"database_id": "REPLACE_WITH_ID_FROM_wrangler-d1-create-sahfund-preview"`. Selama placeholder itu ada, semua command `--env preview` akan gagal.

```powershell
# 1) lihat DB yang sudah ada (nama + id)
npx wrangler d1 list

# 2) buat database preview
npx wrangler d1 create sahfund-preview
```

3. Salin `database_id` dari output ke `wrangler.jsonc` → `env.preview.d1_databases[0].database_id`, lalu commit. **ID database adalah konfigurasi, bukan secret.**

```powershell
# 4) terapkan schema ke preview (bukan menyalin data produksi)
npx wrangler d1 migrations apply DB --remote --env preview

# 5) verifikasi
npx wrangler d1 execute DB --remote --env preview --command "SELECT COUNT(*) AS migrations FROM d1_migrations;"
```

Kalau preview benar-benar butuh data contoh:

```powershell
npx wrangler d1 export sahfunddb --remote --output ".wrangler\backups\prod-seed-<ts>.sql" -y
npx wrangler d1 execute DB --remote --env preview --file ".wrangler\backups\prod-seed-<ts>.sql" -y
```

> **Peringatan privasi:** file export produksi berisi data keuangan pengguna asli. Menyalinnya ke preview berarti data asli ikut pindah ke environment yang mungkin diakses lebih longgar. Untuk preview, default-nya **schema saja** + workspace baru lewat UI. Kalau tetap menyalin, hapus file `.sql` setelah selesai.

Deploy Worker preview (belum dieksekusi di sini):

```powershell
npx wrangler deploy --env preview
```

### 3.6 Resep B — sinkron lokal ↔ remote untuk developer

**Remote → lokal** (mulai dari data produksi, kerja aman di lokal):

```powershell
# 1) matikan `next dev` / `wrangler dev` dulu (hindari file SQLite terkunci + WAL)
# 2) export dari produksi
npx wrangler d1 export sahfunddb --remote --output ".wrangler\backups\prod-<ts>.sql" -y

# 3) kosongkan state D1 lokal (INI menghapus data lokal saja)
Remove-Item -Recurse -Force .wrangler\state\v3\d1

# 4) import ke lokal — file export sudah membawa schema + d1_migrations
npx wrangler d1 execute DB --local --file ".wrangler\backups\prod-<ts>.sql" -y

# 5) verifikasi
npx wrangler d1 execute DB --local --command "SELECT COUNT(*) AS n FROM transactions;"
```

**Lokal → preview** (kirim dataset uji ke environment bersama):

```powershell
npx wrangler d1 export DB --local --output ".wrangler\backups\local-<ts>.sql"
# target harus kosong; kalau tidak, buat DB preview baru dulu (§3.4)
npx wrangler d1 execute DB --remote --env preview --file ".wrangler\backups\local-<ts>.sql" -y
```

**Jangan** arahkan import lokal ke `sahfunddb`.

Soal menyalin file `.sqlite` mentah dari `.wrangler\state\v3\d1\miniflare-D1DatabaseObject\`: tidak disarankan. Nama file-nya hash, ada `-wal`/`-shm` yang bisa membuat salinan tidak konsisten kalau server masih jalan. Pakai `d1 export --local`.

### 3.7 Checklist urutan aman

1. **Tahu targetnya.** Tulis `--local` atau `--remote`, plus `--env` bila perlu. Tanpa flag = remote.
2. **Export dulu**, baru import. Tidak ada import ke produksi tanpa file backup baru pada hari yang sama.
3. **Cek read-only** di target: daftar tabel + `COUNT(*)` sebelum menulis.
4. **Import hanya ke DB kosong.** Kalau target sudah berisi, jangan "refresh" dengan import ulang — bikin DB baru atau kosongkan state lokal.
5. **Verifikasi setelah import**: jumlah baris tabel utama + `SUM` nominal, bandingkan dengan sumber.
6. **Update `wrangler.jsonc`** kalau database baru, lalu deploy Worker yang benar (`--env preview` untuk preview).
7. **Hapus file `.sql`** dari `.wrangler\backups` setelah selesai; jangan pernah commit.

---

## 4. Secret via CLI

Secret adalah nilai sensitif yang di-inject sebagai env var Worker. Yang dibahas di sini mekanik CLI-nya; asal-usul `BETTER_AUTH_SECRET`, gejalanya (503), dan contoh nilainya ada di [`cloudflare-better-auth-setup.md`](cloudflare-better-auth-setup.md) §2.2–2.5.

| Kebutuhan | Perintah | Target |
|---|---|---|
| Set/ubah secret produksi | `npx wrangler secret put BETTER_AUTH_SECRET` | Worker `sahfund` |
| Set/ubah secret preview | `npx wrangler secret put BETTER_AUTH_SECRET --env preview` | Worker `sahfund-preview` |
| URL auth produksi (opsional) | `npx wrangler secret put BETTER_AUTH_URL` | Worker `sahfund` |
| Daftar nama secret | `npx wrangler secret list` | produksi |
| Daftar secret preview | `npx wrangler secret list --env preview` | preview |
| Hapus | `npx wrangler secret delete BETTER_AUTH_SECRET --env preview` | sesuai `--env` |
| Banyak sekaligus | `npx wrangler secret bulk .dev.vars` | sesuai `--env` |

Detail yang terbukti dari help 4.156.1:

- `secret put` **tidak punya flag nilai**. Nilai diketik saat prompt (atau lewat stdin). **Jangan** menaruh nilai di command line / history shell.
- `secret list` default output JSON; `--format pretty` untuk tabel. Yang tampil hanya **nama**, bukan nilai.
- `secret bulk <file>` menerima `.env` (`KEY=VALUE`) atau JSON (`{"KEY":"value"}`), maksimal **100** secret per panggilan. Key yang tidak ada di file **tidak** dihapus. Penghapusan hanya bisa lewat JSON dengan nilai `null` (tidak didukung di `.env`). Tanpa argumen file, input dibaca dari stdin.
- `--name <worker>` menimpa nama Worker dari config; biasanya tidak perlu.

Contoh alur lengkap untuk preview (belum dieksekusi):

```powershell
npx wrangler secret bulk .dev.vars --env preview
npx wrangler secret list --env preview --format pretty
```

> **Hati-hati `secret bulk .dev.vars`**: file itu berisi nilai lokal, termasuk `BETTER_AUTH_URL=http://localhost:…`. Untuk Worker, URL lokal itu salah. Bulk = "salin semua", jadi bersihkan/ sesuaikan dulu atau set satu per satu dengan `secret put --env preview`.

Soal kapan berlaku:

- Secret di-bind ke versi Worker. Set secret **sebelum** deploy versi baru; kalau ragu, deploy ulang setelah set (`npx wrangler deploy` untuk produksi, `--env preview` untuk preview).
- Secret yang di-set di top-level **tidak** otomatis ada di `--env preview` (dan sebaliknya). Dua Worker, dua set secret.
- Kalau `secret put --env preview` gagal karena Worker `sahfund-preview` belum ada, deploy preview dulu, lalu set secret.
- Alternatif untuk CI: `npx wrangler deploy --secrets-file <file>` (ada di help 4.156.1) mengunggah secret sekaligus saat deploy. File-nya tetap tidak boleh masuk git.
- Verifikasi efeknya di runtime: `npx wrangler tail sahfund` (atau `--env preview`). Log hanya memuat route/status, bukan nilai secret.

---

## 5. Troubleshooting

| Gejala | Penyebab | Fix |
|---|---|---|
| Data yang muncul di `next dev` ternyata data produksi | `"remote": true` di `wrangler.jsonc` — dev memakai DB remote | Selalu `--local` untuk eksperimen; hapus `remote: true` kalau mau dev terisolasi (§1) |
| Command D1 tak sengaja menyentuh produksi | Tidak ada `--local`/`--remote`; default Wrangler = remote | Tambahkan flag eksplisit; cek baris `Resource location:` di output; pulihkan dengan `d1 time-travel restore` bila data rusak |
| `table account already exists` saat import | Target sudah punya tabel (export memakai `CREATE TABLE` tanpa `IF NOT EXISTS` untuk sebagian tabel) | Import hanya ke DB kosong; untuk lokal hapus `.wrangler\state\v3\d1`, untuk remote buat DB baru |
| `UNIQUE constraint failed` saat import | File yang sama diimport dua kali (export memakai `INSERT INTO` biasa) | Pakai DB kosong; jangan "refresh" dengan import ulang |
| `Statement too long` | Satu `INSERT` melebihi batas D1 | Pecah jadi beberapa `INSERT` lebih kecil, atau export `--table` per tabel |
| `cannot start a transaction within a transaction` | File dari `sqlite3 .dump` masih berisi `BEGIN TRANSACTION`/`COMMIT;` | Hapus kedua baris itu, lalu import ulang |
| `no such table` di tengah import | Urutan tabel / foreign key | Import file export utuh; jangan pecah per tabel sembarangan |
| `--env preview` error "couldn't find DB" / "binding DB" | `env.preview` tidak ada atau `database_id` masih placeholder | §3.5: `d1 create sahfund-preview`, tempel id, commit |
| Import ke preview sukses tapi Worker preview tetap kosong | Worker preview menunjuk DB lain / belum deploy ulang | Cek `env.preview.d1_databases`, lalu `npx wrangler deploy --env preview` |
| Export gagal / lambat / request lain timeout | Export memblokir database selama berjalan | Jalankan di jam sepi; batasi dengan `--table` |
| Sign-in 503 padahal secret sudah di-set | Versi Worker lama masih jalan, atau secret di-set di env yang salah | `secret list` (dan `--env preview`), lalu deploy ulang; lihat guide auth §2.5 |
| `secret put` sukses tapi `list` kosong | Salah Worker (`--name`/`--env`/config `name`) | Cek `name` di `wrangler.jsonc`; `sahfund` vs `sahfund-preview` |
| File export besar tidak bisa diimport | Batas 5 GiB per file | Pecah per tabel dengan `--table` |

---

## 6. Konvensi yang wajib dipegang

- **File export = data pengguna.** Simpan hanya di `.wrangler/` (gitignored), jangan di `docs/`, `src/`, atau folder yang di-commit. Hapus setelah selesai. Jangan pernah menempelkan isinya ke issue/chat.
- **`.dev.vars` tidak pernah masuk git.** Hanya `.dev.vars.example` (placeholder) yang boleh. `.env*` juga gitignored.
- **Nilai secret tidak pernah ada di dokumen, issue, chat, atau command line.** `secret list` hanya menampilkan nama — itu cukup untuk verifikasi.
- **`database_id` bukan secret.** Dia konfigurasi di `wrangler.jsonc` dan memang harus di-commit.
- **Satu environment, satu database.** `env.preview` tidak boleh menunjuk `sahfunddb`; produksi tidak boleh jadi target import tanpa backup baru.
- **Schema dari `drizzle/` + bookkeeping `d1_migrations`.** Jangan edit migrasi yang sudah diterapkan; perubahan schema selalu lewat `drizzle-kit generate` → `migrations apply`.
- **Eksplisit selalu.** Setiap command D1 di dokumen/runbook/CI menulis `--local`, `--remote`, dan `--env` bila relevan. Tidak ada command "default".
- **Verifikasi dengan angka**, bukan perasaan: `COUNT(*)`/`SUM` sebelum dan sesudah import.

## Referensi

- [Cloudflare D1 — Import and export data](https://developers.cloudflare.com/d1/best-practices/import-export-data/)
- [Cloudflare D1 — Time Travel and backups](https://developers.cloudflare.com/d1/reference/time-travel/)
- [Cloudflare D1 — Local development](https://developers.cloudflare.com/d1/best-practices/local-development/)
- [`cloudflare-better-auth-setup.md`](cloudflare-better-auth-setup.md) — setup Worker, `BETTER_AUTH_SECRET`, gejala 503
- `AGENTS.md` §2–§3 — aturan batch/migrasi dan invariant database
