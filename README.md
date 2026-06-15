# Hemodialysis Care

Hemodialysis Care adalah aplikasi web untuk membantu pasien hemodialisis memantau jadwal, ringkasan kesehatan harian, profil pribadi, edukasi, video, catatan keluhan, dan chatbot bantuan sederhana.

Aplikasi ini memakai HTML, CSS, JavaScript, dan Supabase untuk autentikasi serta database.

## Fitur Utama

- Login dan daftar akun dengan Supabase Auth.
- Profil pasien.
- Jadwal hemodialisis.
- Ringkasan harian:
  - berat badan,
  - tekanan darah,
  - cairan,
  - obat.
- Catatan keluhan.
- Tag keluhan.
- Edukasi artikel dan video lokal.
- Chatbot bantuan sederhana.
- Mode siang dan mode malam.
- Navigasi sidebar untuk desktop.
- Bottom navigation untuk tablet dan HP.
- Efek RGBW pada navigasi aktif.

## Struktur Project

```text
coba coba/
├─ index.html
├─ auth.html
├─ app.js
├─ auth.js
├─ style.css
├─ supabase-client.js
├─ supabase-config.js
├─ supabase-config.example.js
├─ .env.example
├─ supabase_schema.sql
├─ SUPABASE_SETUP.md
├─ README.md
├─ assets/
│  ├─ images/
│  ├─ pdf/
│  └─ videos/
└─ supabase/
   ├─ verify_database.sql
   └─ migrations/
      └─ 20260604000100_create_hemodialysis_care_schema.sql
```

## Database Supabase

Database memakai 5 tabel utama:

```text
profiles
schedules
daily_summaries
complaints
complaint_tags
```

Penjelasan singkat:

- `profiles`: data user atau pasien.
- `schedules`: jadwal hemodialisis.
- `daily_summaries`: ringkasan kesehatan harian.
- `complaints`: catatan keluhan pasien.
- `complaint_tags`: tag untuk setiap keluhan.

## Membuat Project Supabase

1. Buka https://supabase.com.
2. Login atau buat akun.
3. Klik `New project`.
4. Isi nama project, contoh:

   ```text
   Hemodialysis-Care
   ```

5. Buat database password yang kuat.
6. Pilih region terdekat.
7. Klik `Create new project`.
8. Tunggu sampai project selesai dibuat.

## Menjalankan SQL Database

1. Buka Supabase Dashboard.
2. Masuk ke `SQL Editor`.
3. Klik `New query`.
4. Copy semua isi file:

   ```text
   supabase/migrations/20260604000100_create_hemodialysis_care_schema.sql
   ```

5. Paste ke SQL Editor.
6. Klik `Run`.
7. Jika muncul status success, database berhasil dibuat.

## Verifikasi Database

1. Buka file:

   ```text
   supabase/verify_database.sql
   ```

2. Copy semua isinya.
3. Buka `SQL Editor`.
4. Klik `New query`.
5. Paste isi file tersebut.
6. Klik `Run`.

Hasil yang benar:

- Tabel `profiles`, `schedules`, `daily_summaries`, `complaints`, dan `complaint_tags` muncul.
- `rowsecurity` bernilai `true`.
- Policy RLS muncul untuk masing-masing tabel.

## Konfigurasi Supabase Frontend

Ambil data dari Supabase:

1. Buka `Project Settings`.
2. Buka menu `API`.
3. Copy:
   - `Project URL`
   - `anon public key`

Isi file `supabase-config.js`:

```js
const SUPABASE_URL = 'https://project-kamu.supabase.co';
const SUPABASE_ANON_KEY = 'anon-public-key-kamu';

window.HEMODIALYSIS_CARE_SUPABASE = {
  url: SUPABASE_URL,
  anonKey: SUPABASE_ANON_KEY,
};
```

Penting:

- Gunakan `anon public key`.
- Jangan gunakan `service_role key` di frontend.
- `SUPABASE_URL` harus URL dasar project, contoh:

  ```text
  https://project-kamu.supabase.co
  ```

- Jangan memakai URL dengan tambahan path seperti:

  ```text
  /rest/v1/
  ```

## Script Supabase

`index.html` dan `auth.html` sudah memuat script berikut:

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="supabase-config.js"></script>
<script src="supabase-client.js"></script>
```

Urutannya harus seperti itu:

1. Supabase library.
2. Config URL dan anon key.
3. Supabase client helper.
4. File aplikasi, yaitu `app.js` atau `auth.js`.

## Menjalankan Aplikasi

Karena aplikasi ini static HTML, bisa dibuka langsung dari file:

```text
index.html
auth.html
```

Namun untuk hasil yang lebih stabil, jalankan dengan server lokal sederhana, misalnya memakai VS Code Live Server.

Alur awal:

1. Buka `auth.html`.
2. Daftar akun baru.
3. Jika Supabase meminta konfirmasi email, buka inbox dan klik link konfirmasi.
4. Login.
5. Aplikasi akan masuk ke `index.html`.

## Install Aplikasi Di Laptop Dan HP

Aplikasi ini sudah dibuat sebagai PWA, sehingga bisa di-install dari browser modern.

File PWA yang dipakai:

```text
manifest.webmanifest
service-worker.js
pwa-register.js
assets/icons/icon-192.png
assets/icons/icon-512.png
```

Syarat agar tombol install muncul:

1. Aplikasi dibuka lewat HTTPS, misalnya Vercel:

   ```text
   https://hemodialysis-care.vercel.app
   ```

2. `manifest.webmanifest` bisa diakses.
3. `service-worker.js` berhasil terdaftar.
4. Browser tidak sedang memakai cache lama.

### Install Di Laptop

Untuk Chrome atau Edge:

1. Buka aplikasi dari domain Vercel.
2. Klik ikon install di address bar.
3. Jika ikon belum muncul, klik menu titik tiga.
4. Pilih `Install Hemodialysis Care`.
5. Aplikasi akan muncul seperti aplikasi desktop.

### Install Di HP Android

Untuk Chrome Android:

1. Buka aplikasi dari domain Vercel.
2. Klik menu titik tiga di kanan atas.
3. Pilih `Add to Home screen` atau `Install app`.
4. Ikuti instruksi pemasangan.
5. Aplikasi akan muncul di home screen.

### Install Di iPhone

Untuk Safari iPhone:

1. Buka aplikasi di Safari.
2. Tekan tombol `Share`.
3. Pilih `Add to Home Screen`.
4. Tekan `Add`.

Catatan: iPhone biasanya memakai istilah `Add to Home Screen`, bukan tombol install otomatis seperti Android.

## Pengaturan Email Confirmation

Jika setelah daftar muncul pesan:

```text
Email belum dikonfirmasi. Cek inbox email Anda.
```

Artinya Supabase mengaktifkan email confirmation.

Untuk testing, bisa dimatikan:

1. Buka Supabase Dashboard.
2. Masuk ke `Authentication`.
3. Buka `Providers`.
4. Pilih `Email`.
5. Matikan `Confirm email`.
6. Simpan.

Untuk aplikasi production, sebaiknya email confirmation tetap aktif.

## Alur Testing

Tes aplikasi dari awal:

1. Buka `auth.html`.
2. Daftar user baru.
3. Login.
4. Isi profil:
   - tanggal lahir,
   - nomor telepon,
   - alamat.
5. Tambahkan jadwal hemodialisis.
6. Isi ringkasan harian:
   - berat badan,
   - tekanan darah,
   - cairan,
   - obat.
7. Tambahkan catatan keluhan.
8. Tambahkan tag keluhan.
9. Logout.
10. Login ulang.
11. Pastikan data masih muncul.
12. Cek Supabase `Table Editor` untuk memastikan data tersimpan di database.

## Mapping Data Ke Supabase

| Fitur aplikasi | Tabel Supabase |
| --- | --- |
| Akun login/register | `auth.users` |
| Profil pasien | `profiles` |
| Jadwal hemodialisis | `schedules` |
| Ringkasan harian | `daily_summaries` |
| Catatan keluhan | `complaints` |
| Tag keluhan | `complaint_tags` |

## Catatan Keamanan

- RLS sudah aktif di semua tabel.
- User hanya bisa membaca dan mengubah data miliknya sendiri.
- Akses dibatasi dengan `auth.uid()`.
- Jangan pernah menaruh `service_role key` di file JavaScript frontend.
- `anon public key` aman untuk frontend selama RLS aktif dan policy benar.

## Troubleshooting

### Error: Invalid path specified in request URL

Penyebab umum: `SUPABASE_URL` salah.

Gunakan:

```js
const SUPABASE_URL = 'https://project-kamu.supabase.co';
```

Jangan gunakan:

```js
const SUPABASE_URL = 'https://project-kamu.supabase.co/rest/v1/';
```

### Error: Email belum dikonfirmasi

Penyebab: email confirmation aktif.

Solusi:

- buka inbox email,
- klik link konfirmasi,
- login ulang.

Atau matikan `Confirm email` di Supabase untuk testing.

### Data tidak masuk ke tabel

Cek hal berikut:

1. User sudah login.
2. `supabase-config.js` memakai URL dan anon key yang benar.
3. RLS policy sudah dibuat.
4. Buka console browser untuk melihat error.
5. Cek `Table Editor` di Supabase.

### Aplikasi tidak bisa login

Cek:

1. Email dan password benar.
2. Email sudah dikonfirmasi.
3. `SUPABASE_URL` benar.
4. `SUPABASE_ANON_KEY` benar.
5. Script Supabase dimuat sebelum `auth.js`.

## File Penting

- `auth.js`: login dan daftar akun dengan Supabase Auth.
- `app.js`: data utama aplikasi dan komunikasi dengan Supabase.
- `supabase-client.js`: membuat Supabase client.
- `supabase-config.js`: menyimpan URL dan anon key.
- `supabase/migrations/20260604000100_create_hemodialysis_care_schema.sql`: schema database.
- `supabase/verify_database.sql`: query validasi database.

## Status Project

Status saat ini:

- Database Supabase sudah disiapkan.
- Auth Supabase sudah terhubung.
- Data utama aplikasi sudah diarahkan ke Supabase.
- Mode siang/malam sudah tersedia.
- Layout desktop, tablet, dan HP sudah disesuaikan.
