# Dokumentasi API GraphQL — GraphQL Playground

> **Alamat lokal:** <http://localhost:3000/graphql>  
> **Protokol:** GraphQL melalui HTTP POST  
> **Autentikasi:** JWT Bearer untuk semua operasi selain registrasi, login, validasi token, dan `authHealth`.

Dokumen ini menjelaskan cara memakai GraphQL Playground, operasi yang tersedia, argumen, tipe data, role yang bisa mengakses, dan aturan bisnis yang perlu diketahui saat mencoba API.

## Membuka Playground

Jalankan backend beserta dependensinya. Untuk setup lokal menggunakan Docker Compose, ikuti langkah di [README](../README.md#menjalankan-dengan-docker-compose). Setelah API Gateway aktif, buka <http://localhost:3000/graphql>.

GraphQL Playground menyediakan panel **Docs** untuk melihat schema dan deskripsi resolver. Tulis operasi di panel editor, isi **Query Variables** dengan JSON bila operasi memakai variabel, lalu tekan tombol jalankan.

Untuk operasi terautentikasi, buka panel **HTTP HEADERS** dan isi token hasil login:

~~~json
{
  "Authorization": "Bearer <accessToken>"
}
~~~

Pakai token akun dengan role yang sesuai. Token kedaluwarsa atau token yang sudah logout ditolak. Karena header Playground digunakan bersama, ganti token saat berpindah akun/role.

### Akun demo lokal

Seed akun admin lokal:

- Email: `admin@rata.test`
- Password: `RataDemo!2026`

Akun ini hanya disiapkan oleh seed untuk pengembangan dan technical test lokal. Jangan gunakan kredensial contoh sebagai akun produksi.

## Autentikasi dan role

API memakai tiga role:

| Role | Kegunaan |
| --- | --- |
| `ADMIN` | Mengelola akun, profil dokter/customer, seluruh janji temu, dan workflow klinik. |
| `DOCTOR` | Melihat janji temu miliknya, mengatur ketersediaan miliknya, serta mengonfirmasi atau menyelesaikan janji temu yang menjadi tanggung jawabnya. |
| `CUSTOMER` | Mengelola janji temu miliknya dan melihat profil customer yang terhubung ke akunnya. |

`register` membuat akun `CUSTOMER`. Akun `DOCTOR` atau `ADMIN` dibuat oleh admin melalui `createManagedUser`. Untuk membuat dokter dapat masuk dan mengatur jadwal, hubungkan akun tersebut ke profil dokter lewat `createDoctor` dengan `userId` akun.

## Scalar, enum, pagination, dan waktu

### Scalar

| Scalar | Arti |
| --- | --- |
| `ID` | ID/UUID resource. Gunakan ID yang dikembalikan API. |
| `DateTime` | Waktu ISO-8601, misalnya `2026-11-09T02:00:00.000Z`. |
| `String`, `Int`, `Boolean` | Tipe GraphQL standar. |

Tanggal dan jam praktik/janji temu disimpan dalam **UTC**. Nilai `dayOfWeek` memakai `0` untuk Minggu sampai `6` untuk Sabtu. `startTime` dan `endTime` memakai format 24 jam `HH:mm`, misalnya `09:00`.

### Enum

~~~graphql
enum UserRole { ADMIN DOCTOR CUSTOMER }
enum ScheduleStatus { REQUESTED CONFIRMED CANCELLED COMPLETED }
enum CustomerStatus { ACTIVE WAITING COMPLETED }
~~~

### Pagination

Query berhalaman menerima `page` dan `limit`. Nilai default adalah `page: 1` dan `limit: 20`. `page` harus bilangan bulat minimal 1; `limit` harus 1–100.

Semua hasil halaman memiliki field `items`, `page`, `limit`, `total`, dan `totalPages`.

## Tipe hasil

GraphQL mengembalikan hanya field yang diminta di selection set. Password tidak pernah dikembalikan.

### AuthUser

| Field | Tipe | Keterangan |
| --- | --- | --- |
| `id` | `String!` | ID akun. |
| `email` | `String!` | Email akun. |
| `name` | `String` | Nama akun, bisa kosong. |
| `role` | `UserRole!` | Role akun saat ini. |
| `createdAt` | `String!` | Waktu pembuatan akun. |

### LoginResult

| Field | Tipe | Keterangan |
| --- | --- | --- |
| `accessToken` | `String!` | JWT yang dipakai pada header `Authorization`. |
| `tokenType` | `String!` | Jenis token, umumnya `Bearer`. |
| `expiresIn` | `Float!` | Masa berlaku token dalam detik. |
| `user` | `AuthUser!` | Profil akun yang berhasil login. |

### Customer

| Field | Tipe | Keterangan |
| --- | --- | --- |
| `id` | `ID!` | ID profil customer. |
| `userId` | `ID` | ID akun yang tertaut, jika ada. |
| `name`, `email` | `String!` | Nama dan email customer. |
| `phone`, `gender`, `address`, `treatment`, `note` | `String` | Data tambahan yang boleh kosong. |
| `birthDate`, `nextVisit` | `DateTime` | Tanggal lahir dan rencana kunjungan berikutnya. |
| `status` | `CustomerStatus` | Status customer bila diatur. |
| `createdAt`, `updatedAt` | `DateTime!` | Waktu pembuatan dan pembaruan profil. |

### Doctor

| Field | Tipe | Keterangan |
| --- | --- | --- |
| `id` | `ID!` | ID profil dokter. |
| `name` | `String!` | Nama dokter. |
| `createdAt`, `updatedAt` | `DateTime!` | Waktu pembuatan dan pembaruan profil. |

### DoctorAvailability

| Field | Tipe | Keterangan |
| --- | --- | --- |
| `id` | `ID!` | ID rentang jam praktik. |
| `doctorId` | `ID!` | ID profil dokter. |
| `dayOfWeek` | `Int!` | Hari dalam UTC: Minggu `0` hingga Sabtu `6`. |
| `startTime`, `endTime` | `String!` | Batas waktu praktik format `HH:mm` UTC. |
| `slotMinutes` | `Int!` | Durasi setiap slot dalam menit. |

### Schedule

| Field | Tipe | Keterangan |
| --- | --- | --- |
| `id` | `ID!` | ID janji temu. |
| `objective` | `String!` | Tujuan konsultasi. |
| `customerId`, `doctorId` | `ID!` | ID profil customer dan dokter. |
| `scheduledAt` | `DateTime!` | Waktu mulai janji temu dalam UTC. |
| `status` | `ScheduleStatus!` | Status saat ini. |
| `durationMinutes` | `Int!` | Durasi slot. |
| `cancelReason` | `String` | Alasan pembatalan, bila dibatalkan. |
| `createdAt`, `updatedAt` | `DateTime!` | Waktu pembuatan dan pembaruan. |
| `customer`, `doctor` | `Customer!`, `Doctor!` | Profil pihak yang terkait. |

### Notification

| Field | Tipe | Keterangan |
| --- | --- | --- |
| `id` | `ID!` | ID notifikasi. |
| `scheduleId` | `ID` | ID janji temu terkait, jika ada. |
| `title`, `message` | `String!` | Judul dan isi notifikasi. |
| `createdAt` | `DateTime!` | Waktu notifikasi dibuat. |
| `readAt` | `DateTime` | Waktu dibaca; `null` berarti belum dibaca. |

### WorkflowStep

| Field | Tipe | Keterangan |
| --- | --- | --- |
| `id` | `ID!` | ID langkah workflow. |
| `title`, `description` | `String!` | Nama dan keterangan langkah. |
| `position` | `Int!` | Urutan langkah. |

## Referensi operasi

Semua nama operasi di bawah adalah field langsung pada root `Query` atau `Mutation`. Argumen bertanda `!` wajib diisi. Argumen lain opsional atau punya nilai default.

### Kesehatan service

| Operasi | Jenis | Akses | Deskripsi |
| --- | --- | --- | --- |
| `authHealth` | Query → `String!` | Publik | Memeriksa Auth Service. Tidak perlu token. |
| `scheduleHealth` | Query → `String!` | Semua role | Memeriksa Schedule Service. Perlu token Bearer yang valid. |

### Akun dan autentikasi

| Operasi | Jenis | Argumen | Akses dan perilaku |
| --- | --- | --- | --- |
| `register` | Mutation → `AuthUser!` | `email: String!`, `password: String!`, `name: String` | Publik. Membuat akun customer baru. Email harus belum dipakai dan data harus memenuhi validasi auth. |
| `login` | Mutation → `LoginResult!` | `email: String!`, `password: String!` | Publik. Memverifikasi kredensial dan mengembalikan JWT. Percobaan berulang dibatasi rate limit. |
| `validateToken` | Query → `AuthUser!` | `token: String!` | Publik; token dikirim sebagai argumen. Memvalidasi JWT dan mengembalikan profil akun. Untuk operasi aplikasi, tetap gunakan Bearer header. |
| `logout` | Mutation → `Boolean!` | Tidak ada | Semua role yang sudah login. Mencabut token dari header Bearer. Hasil `true` berarti logout berhasil. |
| `adminUsers` | Query → `[AuthUser!]!` | Tidak ada | Admin. Mengambil daftar akun untuk pengelolaan. |
| `createManagedUser` | Mutation → `AuthUser!` | `email: String!`, `password: String!`, `role: UserRole!`, `name: String` | Admin. Membuat akun dengan role pilihan. Email harus unik. Simpan `id` hasilnya jika akan ditautkan ke profil. |
| `setUserRole` | Mutation → `AuthUser!` | `userId: ID!`, `role: UserRole!` | Admin. Mengubah role akun. Admin tidak dapat mengubah role akunnya sendiri. |

### Customer

| Operasi | Jenis | Argumen | Akses dan perilaku |
| --- | --- | --- | --- |
| `customers` | Query → `CustomerPage!` | `page: Int = 1`, `limit: Int = 20` | Admin saja. Mengambil daftar semua customer dengan pagination. |
| `customer` | Query → `Customer!` | `id: ID!` | Admin atau customer yang memiliki profil tersebut. |
| `createCustomer` | Mutation → `Customer!` | `name: String!`, `email: String!`; opsional `userId: ID`, `phone`, `gender`, `birthDate: DateTime`, `address`, `treatment`, `status: CustomerStatus`, `nextVisit: DateTime`, `note` | Admin. Membuat profil; `userId` mengaitkan profil ke akun yang sudah ada. |
| `updateCustomer` | Mutation → `Customer!` | `id: ID!`; field profil seperti `createCustomer`, semuanya opsional | Admin. Memperbarui field yang dikirim. |
| `deleteCustomer` | Mutation → `Boolean!` | `id: ID!` | Admin. Hanya bisa menghapus customer tanpa janji temu terkait. |

### Dokter

| Operasi | Jenis | Argumen | Akses dan perilaku |
| --- | --- | --- | --- |
| `doctors` | Query → `DoctorPage!` | `page: Int = 1`, `limit: Int = 20` | Semua role terautentikasi. |
| `doctor` | Query → `Doctor!` | `id: ID!` | Semua role terautentikasi. |
| `myDoctor` | Query → `Doctor!` | Tidak ada | Akun dokter. Mengambil profil yang tertaut ke akun saat ini; admin harus menautkan profil terlebih dahulu. |
| `unlinkedDoctors` | Query → `[Doctor!]!` | Tidak ada | Admin. Mengambil profil yang belum tertaut ke akun dokter. |
| `doctorAccountLinks` | Query → `[DoctorAccountLink!]!` | Tidak ada | Admin. Mengambil nama profil dokter beserta ID akun yang sudah tertaut. |
| `createDoctor` | Mutation → `Doctor!` | `name: String!`, `userId: ID` | Admin. Membuat profil; `userId` opsional untuk menautkan akun yang sudah dibuat. Satu akun hanya dapat tertaut ke satu profil. |
| `updateDoctor` | Mutation → `Doctor!` | `id: ID!`, `name: String!`, `userId: ID` | Admin. Mengubah profil/tautan. Kirim `userId: null` untuk melepas tautan. |
| `deleteDoctor` | Mutation → `Boolean!` | `id: ID!` | Admin. Dokter tidak dapat dihapus jika masih punya janji temu. |

### Ketersediaan dan slot

| Operasi | Jenis | Argumen | Akses dan perilaku |
| --- | --- | --- | --- |
| `doctorAvailabilities` | Query → `[DoctorAvailability!]!` | `doctorId: ID!` | Admin atau dokter yang tertaut ke profil tersebut. |
| `setDoctorAvailability` | Mutation → `DoctorAvailability!` | `doctorId: ID!`, `dayOfWeek: Int!`, `startTime: String!`, `endTime: String!`, `slotMinutes: Int = 30` | Admin atau dokter terkait. Hari `0–6`, waktu `HH:mm` UTC, mulai sebelum selesai, slot `5–240` menit dan rentang habis dibagi slot. Rentang bertumpang tindih ditolak. |
| `deleteDoctorAvailability` | Mutation → `Boolean!` | `id: ID!` | Admin atau dokter pemilik ketersediaan. |
| `availableSlots` | Query → `[DateTime!]!` | `doctorId: ID!`, `date: DateTime!` | Semua role terautentikasi. Mengembalikan slot masa depan yang cocok dengan jam praktik dan belum bentrok. |

### Janji temu

| Operasi | Jenis | Argumen | Akses dan perilaku |
| --- | --- | --- | --- |
| `createSchedule` | Mutation → `Schedule!` | `objective: String!`, `doctorId: ID!`, `scheduledAt: DateTime!`, `customerId: ID` | Customer memesan untuk profilnya sendiri; `customerId` tidak perlu dikirim. Admin harus mengirim `customerId`. Dokter tidak dapat membuat permintaan. Waktu harus slot tersedia di masa depan. Status awal `REQUESTED`. |
| `schedules` | Query → `SchedulePage!` | `page: Int = 1`, `limit: Int = 20`; opsional `customerId: ID`, `doctorId: ID`, `status: ScheduleStatus`, `from: DateTime`, `to: DateTime` | Customer melihat miliknya; dokter melihat janji untuk dirinya; admin dapat melihat/filter semua. Customer tidak dapat meminta filter `doctorId`; dokter tidak dapat meminta filter `customerId`. `from` harus sebelum atau sama dengan `to`. |
| `schedule` | Query → `Schedule!` | `id: ID!` | Admin atau customer/dokter yang terkait dengan janji. |
| `updateScheduleStatus` | Mutation → `Schedule!` | `id: ID!`, `status: ScheduleStatus!`, `cancelReason: String` | Dokter terkait/admin dapat konfirmasi, menyelesaikan, atau membatalkan. Customer hanya dapat membatalkan janji miliknya minimal 24 jam sebelum jadwal. Pembatalan wajib menyertakan alasan. Status akhir tidak dapat diubah. |
| `reschedule` | Mutation → `Schedule!` | `id: ID!`, `scheduledAt: DateTime!` | Customer pemilik atau admin; hanya untuk status `REQUESTED`. Waktu baru harus slot tersedia di masa depan. |
| `deleteSchedule` | Mutation → `Boolean!` | `id: ID!` | Admin. Menghapus janji temu dan mengirim pemberitahuan kepada pihak terkait. |

Alur status:

~~~text
REQUESTED ── dokter/admin konfirmasi ──> CONFIRMED ── setelah waktunya selesai ──> COMPLETED
    │                                      │
    └──────────── pembatalan ──────────────┴──> CANCELLED
~~~

`updateScheduleStatus` hanya menerima perubahan ke `CONFIRMED`, `CANCELLED`, atau `COMPLETED`. `REQUESTED` adalah status awal dari `createSchedule`, bukan status tujuan mutation.

### Notifikasi

| Operasi | Jenis | Argumen | Akses dan perilaku |
| --- | --- | --- | --- |
| `notifications` | Query → `NotificationPage!` | `page: Int = 1`, `limit: Int = 20` | Semua role terautentikasi. Hanya notifikasi akun yang sedang login. |
| `markNotificationRead` | Mutation → `Boolean!` | `id: ID!` | Pemilik notifikasi. Menandai notifikasi sebagai sudah dibaca. |

Notifikasi aplikasi dibuat untuk customer dan dokter terkait saat janji temu dibuat, dikonfirmasi, dibatalkan, dijadwalkan ulang, atau dihapus. Notifikasi disimpan per akun; login ke akun yang benar untuk melihatnya. Email janji temu diproses lewat antrean RabbitMQ secara terpisah dari daftar notifikasi dalam aplikasi.

### Workflow klinik

| Operasi | Jenis | Argumen | Akses dan perilaku |
| --- | --- | --- | --- |
| `workflowSteps` | Query → `[WorkflowStep!]!` | Tidak ada | Admin. Mengambil langkah workflow klinik. |
| `saveWorkflowSteps` | Mutation → `[WorkflowStep!]!` | `steps: [WorkflowStepInput!]!` dengan `title: String!`, `description: String` | Admin. Mengganti seluruh daftar. Urutan `position` mengikuti urutan item dalam array. |

## Contoh operasi yang bisa langsung dicoba

### Login admin demo

~~~graphql
mutation Login($email: String!, $password: String!) {
  login(email: $email, password: $password) {
    accessToken
    tokenType
    expiresIn
    user { id email name role }
  }
}
~~~

~~~json
{
  "email": "admin@rata.test",
  "password": "RataDemo!2026"
}
~~~

Salin `accessToken` ke HTTP header Playground untuk operasi berikutnya.

### Buat akun dokter dan tautkan profil

Buat akun dokter sebagai admin:

~~~graphql
mutation CreateDoctorAccount($email: String!, $password: String!, $role: UserRole!, $name: String) {
  createManagedUser(email: $email, password: $password, role: $role, name: $name) {
    id email name role
  }
}
~~~

~~~json
{
  "email": "dokter@example.com",
  "password": "DoctorPass123",
  "role": "DOCTOR",
  "name": "Dr. Contoh"
}
~~~

Gunakan `id` hasilnya sebagai `userId` ketika membuat profil:

~~~graphql
mutation CreateDoctor($name: String!, $userId: ID) {
  createDoctor(name: $name, userId: $userId) { id name createdAt }
}
~~~

~~~json
{
  "name": "Dr. Contoh",
  "userId": "<id-akun-dokter>"
}
~~~

### Atur jam praktik dan cari slot

~~~graphql
mutation SetAvailability($doctorId: ID!, $day: Int!, $start: String!, $end: String!, $slot: Int!) {
  setDoctorAvailability(doctorId: $doctorId, dayOfWeek: $day, startTime: $start, endTime: $end, slotMinutes: $slot) {
    id doctorId dayOfWeek startTime endTime slotMinutes
  }
}
~~~

~~~json
{
  "doctorId": "<id-dokter>",
  "day": 1,
  "start": "09:00",
  "end": "12:00",
  "slot": 30
}
~~~

Cari slot pada tanggal UTC:

~~~graphql
query AvailableSlots($doctorId: ID!, $date: DateTime!) {
  availableSlots(doctorId: $doctorId, date: $date)
}
~~~

~~~json
{
  "doctorId": "<id-dokter>",
  "date": "2026-11-09T00:00:00.000Z"
}
~~~

### Customer membuat janji temu

Login sebagai customer terlebih dahulu. Customer memesan untuk akun sendiri, jadi tidak perlu mengirim `customerId`.

~~~graphql
mutation CreateSchedule($objective: String!, $doctorId: ID!, $scheduledAt: DateTime!) {
  createSchedule(objective: $objective, doctorId: $doctorId, scheduledAt: $scheduledAt) {
    id objective status scheduledAt durationMinutes
    doctor { id name }
    customer { id name email }
  }
}
~~~

~~~json
{
  "objective": "Konsultasi umum",
  "doctorId": "<id-dokter>",
  "scheduledAt": "<salin-waktu-slot-dari-availableSlots>"
}
~~~

### Dokter mengonfirmasi janji temu

Login dengan akun dokter yang ditautkan ke profil dokter terkait.

~~~graphql
mutation ConfirmSchedule($id: ID!, $status: ScheduleStatus!) {
  updateScheduleStatus(id: $id, status: $status) {
    id status scheduledAt doctor { name } customer { name }
  }
}
~~~

~~~json
{
  "id": "<id-janji-temu>",
  "status": "CONFIRMED"
}
~~~

### Lihat janji temu dan notifikasi akun

~~~graphql
query MySchedules($page: Int = 1, $limit: Int = 20) {
  schedules(page: $page, limit: $limit) {
    items { id objective status scheduledAt doctor { name } customer { name email } }
    page limit total totalPages
  }
}
~~~

~~~graphql
query MyNotifications($page: Int = 1, $limit: Int = 20) {
  notifications(page: $page, limit: $limit) {
    items { id scheduleId title message createdAt readAt }
    page limit total totalPages
  }
}
~~~

## Error dan pemecahan masalah

Respons GraphQL dapat memuat `data` dan/atau `errors`. Untuk operasi yang gagal, periksa `errors[0].message` dan `errors[0].extensions.code` pada tab **Response** atau **Preview** di DevTools.

| Kode umum | Makna |
| --- | --- |
| `UNAUTHENTICATED` | Header Bearer hilang, token tidak valid, kedaluwarsa, atau sudah dicabut. Login lagi dan perbarui header Playground. |
| `FORBIDDEN` | Akun terautentikasi, tetapi role atau kepemilikannya tidak memenuhi akses operasi. |
| `BAD_USER_INPUT` | Argumen tidak valid, format waktu salah, atau data wajib belum diberikan. |
| `NOT_FOUND` | ID resource tidak ditemukan atau tidak tersedia untuk akun tersebut. |
| `CONFLICT` | Operasi bertentangan dengan kondisi saat ini, misalnya slot bentrok atau status janji temu tidak bisa berpindah. |
| `TOO_MANY_REQUESTS` | Batas percobaan login/registrasi tercapai. Untuk rate limit login, backend mengirim header `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`, dan `Retry-After`. |
| `INTERNAL_SERVER_ERROR` | Gangguan tak terduga di service. Lihat log service backend untuk detail teknis. |

GraphQL umumnya mengirim HTTP `200` untuk respons yang berhasil diproses oleh endpoint GraphQL, termasuk saat resolver mengembalikan `errors`. Untuk mengetahui hasil bisnis operasi, periksa isi JSON GraphQL dan `extensions.code`, bukan hanya status HTTP.

Jika header CORS atau respons tidak muncul sama sekali di browser, pastikan `CORS_ORIGINS` backend mencakup origin frontend, API Gateway dapat dijangkau, dan host/port dalam konfigurasi FE menunjuk ke backend yang aktif.
