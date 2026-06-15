# Tutorial Supabase Database - Hemodialysis Care

Panduan ini menjelaskan cara membuat database Supabase untuk aplikasi Hemodialysis Care dari awal sampai siap dipakai.

## File Yang Tersedia

- `supabase/migrations/20260604000100_create_hemodialysis_care_schema.sql`
  File utama untuk membuat tabel, index, trigger, RLS, grant, dan policy.
- `supabase/verify_database.sql`
  Query untuk mengecek apakah tabel, RLS, dan policy sudah berhasil dibuat.
- `supabase_schema.sql`
  Versi satu-file yang bisa langsung ditempel ke Supabase SQL Editor.
- `.env.example`
  Contoh variabel koneksi Supabase.
- `supabase-config.example.js`
  Contoh konfigurasi frontend kalau aplikasi static HTML ingin membaca Supabase dari JavaScript.

## Struktur Database

Database memakai 5 tabel:

1. `profiles`
   Menyimpan data user/pasien.
2. `schedules`
   Menyimpan jadwal hemodialisis.
3. `daily_summaries`
   Menyimpan ringkasan harian: berat badan, tekanan darah, cairan, dan obat.
4. `complaints`
   Menyimpan catatan keluhan pasien.
5. `complaint_tags`
   Menyimpan tag dari setiap keluhan.

## Langkah 1 - Buat Project Supabase

1. Buka https://supabase.com.
2. Login atau buat akun.
3. Klik `New project`.
4. Isi:
   - `Project name`: `Hemodialysis Care`
   - `Database password`: buat password yang kuat dan simpan baik-baik.
   - `Region`: pilih yang paling dekat, misalnya Singapore jika tersedia.
5. Klik `Create new project`.
6. Tunggu sampai project selesai dibuat.

## Langkah 2 - Jalankan SQL Database

1. Masuk ke dashboard project Supabase.
2. Buka menu `SQL Editor`.
3. Klik `New query`.
4. Buka file:

   ```text
   supabase/migrations/20260604000100_create_hemodialysis_care_schema.sql
   ```

5. Salin semua isi file tersebut.
6. Tempel ke SQL Editor.
7. Klik `Run`.

Jika berhasil, Supabase akan membuat tabel:

```text
profiles
schedules
daily_summaries
complaints
complaint_tags
```

## Langkah 3 - Validasi Database

1. Masih di `SQL Editor`, klik `New query`.
2. Buka file:

   ```text
   supabase/verify_database.sql
   ```

3. Salin semua isi file tersebut.
4. Tempel ke SQL Editor.
5. Klik `Run`.

Hasil yang benar:

- Query pertama menampilkan 5 tabel.
- Query kedua menampilkan `rowsecurity = true` untuk semua tabel.
- Query ketiga menampilkan policy untuk setiap tabel.

## Langkah 4 - Cek Table Editor

1. Buka menu `Table Editor`.
2. Pastikan tabel berikut muncul:

   ```text
   profiles
   schedules
   daily_summaries
   complaints
   complaint_tags
   ```

3. Klik masing-masing tabel untuk memastikan kolomnya muncul.

## Langkah 5 - Ambil URL Dan Anon Key

1. Buka `Project Settings`.
2. Buka menu `API`.
3. Salin:
   - `Project URL`
   - `anon public key`

Nilai ini nanti dipakai oleh aplikasi frontend.

## Langkah 6 - Siapkan File Config Frontend

1. Duplikasi file:

   ```text
   supabase-config.example.js
   ```

2. Ubah nama hasil duplikasi menjadi:

   ```text
   supabase-config.js
   ```

3. Isi dengan data Supabase asli:

   ```js
   const SUPABASE_URL = 'https://project-kamu.supabase.co';
   const SUPABASE_ANON_KEY = 'anon-key-kamu';
   ```

Jangan pakai `service_role key` di frontend. Frontend hanya boleh memakai `anon public key`.

## Langkah 7 - Hubungkan Ke Aplikasi

Setelah database selesai, aplikasi perlu diubah dari `localStorage` ke Supabase.

Minimal yang perlu dilakukan:

1. Tambahkan Supabase JS CDN ke `index.html` dan `auth.html`.
2. Tambahkan `supabase-config.js`.
3. Ubah login/register agar memakai `supabase.auth`.
4. Ubah operasi jadwal, ringkasan harian, profil, dan keluhan agar memakai tabel Supabase.

Contoh CDN:

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="supabase-config.js"></script>
```

Contoh inisialisasi:

```js
const supabaseClient = supabase.createClient(
  window.HEMODIALYSIS_CARE_SUPABASE.url,
  window.HEMODIALYSIS_CARE_SUPABASE.anonKey,
);
```

## Langkah 8 - Tes Akhir

Tes yang perlu dilakukan:

1. Register user baru.
2. Login user tersebut.
3. Isi profil.
4. Tambahkan jadwal.
5. Isi ringkasan harian.
6. Tambahkan keluhan dan tag.
7. Logout.
8. Login ulang dan pastikan data masih ada.

## Catatan Penting

- `RLS` sudah aktif, jadi user hanya bisa membaca dan mengubah datanya sendiri.
- `auth.uid()` dipakai untuk membatasi akses per user.
- `service_role key` tidak boleh ditaruh di file frontend.
- Kalau query insert gagal dengan error RLS, biasanya user belum login atau `user_id` tidak sama dengan user yang sedang login.
- File SQL ini aman dijalankan ulang karena sebagian besar objek memakai `if not exists` atau `drop policy if exists`.
