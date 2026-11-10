# Apartman Yonetim Sistemi

Turkiye'deki kucuk ve orta olcekli apartmanlar icin gelistirilmis, mobil oncelikli **Progressive Web App (PWA)** tabanli apartman yonetim sistemidir. Aidat takibi, odeme yonetimi, duyurular, ariza/talep yonetimi, gelir-gider muhasebesi ve PDF belge uretimi gibi temel apartman yonetim ihtiyaclarini tek bir platformda karsilar.

Uygulama tamamen **Turkce** arayuze sahiptir. Para birimi TRY (Turk Lirasi), saat dilimi `Europe/Istanbul` olarak yapilandirilmistir.

---

## Ozellikler

### Yonetici (Manager) Paneli

- **Apartman ve daire yonetimi** -- birden fazla apartman, blok, kat ve daire tanimlama
- **Aidat / borc takibi** -- aylik toplu aidat olusturma, tek seferlik borc tanimlama, kismi odeme destegi
- **Odeme kaydi** -- nakit, havale/EFT ve diger odeme yontemleri; idempotency key ile cift kayit onleme
- **Odeme bildirimi is akisi** -- sakinlerin gonderdigi odeme bildirimlerini onaylama veya reddetme
- **Gelir / gider takibi** -- kategorili gider ve gelir kayitlari, donemsel finansal ozet
- **Duyurular** -- sabitleme, yayin durumu, ek dosya yukleme
- **Ariza ve talep yonetimi** -- durum takibi (yeni / devam ediyor / cozuldu), yorum sistemi
- **PDF belge uretimi** -- makbuz, hesap dokumu, rapor ve duyuru PDF'leri (jsPDF)
- **WhatsApp paylasimi** -- `wa.me` click-to-chat linkleri ile sakinlere hizli mesaj (API entegrasyonu yoktur)
- **Davet sistemi** -- guvenli token ile sakin daveti (48 saat gecerlilik suresi)
- **Bildirimler** -- uygulama ici bildirim merkezi + Web Push bildirimleri (VAPID)
- **Ayarlar** -- banka bilgileri, apartman detaylari

### Sakin (Resident) Paneli

- Borclarini goruntuleme ve odeme durumu takibi
- Odeme bildirimi gonderme (dekont yukleme destegi)
- Duyurulari okuma
- Ariza / talep olusturma ve takip etme
- Bildirim merkezi
- Profil yonetimi

### Genel

- **PWA** -- ana ekrana eklenebilir, cevrimdisi temel destek (Service Worker / Workbox)
- **Web Push Notifications** -- VAPID tabanli push bildirimleri
- **Responsive tasarim** -- mobil oncelikli, Tailwind CSS ile

---

## Teknoloji Yigini

| Katman | Teknoloji |
|---|---|
| Frontend | React 18, TypeScript, Vite 6 |
| Stil | Tailwind CSS 3, Lucide React (ikonlar) |
| Durum Yonetimi | Zustand 5, TanStack React Query 5 |
| Routing | React Router v6 (lazy loading, korumali rotalar) |
| Backend / BaaS | Supabase (PostgreSQL, Auth, Storage, Edge Functions, RLS) |
| PWA | vite-plugin-pwa 0.21 (Workbox) |
| PDF | jsPDF + jspdf-autotable |
| Bildirimler | Web Push (VAPID), web-push paketi |
| Toast | react-hot-toast |
| Tarih | date-fns, date-fns-tz |
| Telefon | libphonenumber-js |
| Test | Vitest 2, Testing Library (React + jest-dom), jsdom |

---

## On Kosullar

- **Node.js** 18+ (onerilen: 20 LTS)
- **npm** 9+ (veya pnpm / yarn)
- **Supabase hesabi** -- [supabase.com](https://supabase.com) uzerinden ucretsiz proje olusturabilirsiniz
- **VAPID anahtar cifti** -- Web Push bildirimleri icin (`web-push generate-vapid-keys` ile olusturulabilir)

---

## Kurulum

### 1. Depoyu klonlayin

```bash
git clone <repo-url>
cd apartmanYonetim
```

### 2. Bagimliliklari yukleyin

```bash
npm install
```

### 3. Ortam degiskenlerini yapilandirin

Proje kokunde `.env.example` dosyasini `.env` olarak kopyalayin ve degerleri doldurun:

```bash
cp .env.example .env
```

`.env` dosyasi icerigi:

```env
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Web Push (VAPID)
VITE_VAPID_PUBLIC_KEY=your-vapid-public-key
VAPID_PRIVATE_KEY=your-vapid-private-key

# Supabase Service Role (sadece sunucu tarafi / Edge Functions icin)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

VAPID anahtari olusturma:

```bash
npx web-push generate-vapid-keys
```

### 4. Supabase veritabanini hazirlayin

Supabase Dashboard uzerinden SQL Editor'u acin ve asagidaki migration dosyasini calistirin:

```
supabase/migrations/001_initial_schema.sql
```

Bu dosya 18 tabloyu, RLS politikalarini, yardimci fonksiyonlari ve RPC islevlerini olusturur.

Alternatif olarak Supabase CLI ile:

```bash
npx supabase db push
```

### 5. Storage Bucket'larini olusturun

Supabase Dashboard > Storage bolumunde asagidaki bucket'lari olusturun (tumunu **private** yapin):

| Bucket | Aciklama |
|---|---|
| `receipts` | Odeme dekontlari |
| `attachments` | Duyuru ve gider ekleri |
| `request-photos` | Ariza/talep fotograflari |

Her bucket icin uygun RLS politikalari tanimlanmalidir (yoneticiler kendi apartmanlarina ait dosyalari yonetebilmeli, sakinler kendi dosyalarini yukleyebilmeli).

### 6. Supabase Auth yapilandirmasi

Supabase Dashboard > Authentication > Settings:

- **Site URL**: `http://localhost:3000` (gelistirme) veya uretim URL'niz
- E-posta girisini etkinlestirin

Uygulama telefon numarasini pseudo-email formatina donusturerek Supabase Auth altyapisini kullanir:

```
${phone.replace('+', '')}@apartman.local
```

Ornegin `+905551234567` numarasi `905551234567@apartman.local` olarak kaydedilir.

### 7. VAPID anahtarlarini olusturun

```bash
npx web-push generate-vapid-keys
```

Cikti olarak alinan public ve private key'leri `.env` dosyasina ekleyin.

---

## Calistirma

### Gelistirme sunucusu

```bash
npm run dev
```

Uygulama varsayilan olarak `http://localhost:3000` adresinde baslar.

### Testleri calistirma

```bash
npm test              # tek seferlik calistirma
npm run test:watch    # izleme modunda
```

### Lint

```bash
npm run lint
```

### Uretim derlemesi

```bash
npm run build
```

Derlenmis dosyalar `dist/` klasorune cikartilir.

### Onizleme

```bash
npm run preview
```

---

## Proje Yapisi

```
apartmanYonetim/
├── public/
│   └── icons/                    # PWA ikonlari (192x192, 512x512)
├── src/
│   ├── components/
│   │   ├── layout/               # AuthLayout, ManagerLayout, ResidentLayout
│   │   ├── shared/               # StatusBadge, BankInfoCard, WhatsAppButton,
│   │   │                           FileUpload, InstallPWAPrompt, PushPermissionCard
│   │   └── ui/                   # Button, Card, Input, Modal, Badge, Select,
│   │                               Tabs, EmptyState, LoadingSpinner
│   ├── contexts/
│   │   └── QueryProvider.tsx     # TanStack React Query provider
│   ├── hooks/                    # Ozel hook'lar
│   │   ├── useAuth.ts
│   │   ├── useApartments.ts
│   │   ├── useUnits.ts
│   │   ├── useResidents.ts
│   │   ├── useDues.ts
│   │   ├── usePayments.ts
│   │   ├── usePaymentNotifications.ts
│   │   ├── useFinancials.ts
│   │   ├── useAnnouncements.ts
│   │   ├── useRequests.ts
│   │   ├── useInvitations.ts
│   │   ├── useNotifications.ts
│   │   ├── usePushNotifications.ts
│   │   ├── useDashboard.ts
│   │   └── useResidentContext.ts
│   ├── lib/
│   │   ├── supabase.ts           # Supabase istemci yapilandirmasi
│   │   ├── format.ts             # Para birimi, tarih, telefon formatlama
│   │   ├── pdf.ts                # jsPDF ile PDF uretim fonksiyonlari
│   │   ├── pushNotifications.ts  # Web Push yardimci islevleri
│   │   ├── utils.ts              # Genel yardimci fonksiyonlar
│   │   └── format.test.ts        # Formatlama birim testleri
│   ├── pages/
│   │   ├── auth/                 # LoginPage, RegisterPage, InvitationPage,
│   │   │                           PasswordResetPage
│   │   ├── manager/              # ManagerDashboard, ApartmentListPage,
│   │   │                           ApartmentDetailPage, UnitListPage,
│   │   │                           UnitDetailPage, DuesPage, PaymentsPage,
│   │   │                           FinancialsPage, AnnouncementsPage,
│   │   │                           RequestsPage, NotificationsPage,
│   │   │                           DocumentsPage, SettingsPage
│   │   └── resident/             # ResidentDashboard, MyDuesPage,
│   │                               MyPaymentsPage, PaymentNotificationForm,
│   │                               ResidentAnnouncementsPage,
│   │                               ResidentRequestsPage, NewRequestPage,
│   │                               ResidentNotificationsPage, ProfilePage
│   ├── store/
│   │   └── authStore.ts          # Zustand auth durum yonetimi
│   ├── test/                     # Test yapilandirmasi ve test dosyalari
│   │   ├── setup.ts
│   │   ├── utils.test.ts
│   │   ├── components.test.tsx
│   │   └── business-logic.test.ts
│   ├── types/
│   │   └── index.ts              # TypeScript tip tanimlari
│   ├── App.tsx                   # Ana routing yapilandirmasi
│   ├── main.tsx                  # Uygulama giris noktasi
│   └── index.css                 # Tailwind CSS direktifleri
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql  # Veritabani semasi (18 tablo + RLS + RPC)
├── .env.example                  # Ortam degiskenleri sablonu
├── package.json
├── vite.config.ts                # Vite + PWA yapilandirmasi
├── tsconfig.json
├── tailwind.config.js
└── postcss.config.js
```

### Rota Yapisi

Uygulama Turkce URL yollari kullanir:

| Yol | Sayfa | Erisim |
|---|---|---|
| `/giris` | Giris sayfasi | Herkese acik |
| `/kayit` | Kayit sayfasi | Herkese acik |
| `/sifre-sifirla` | Sifre sifirlama | Herkese acik |
| `/davet/:token` | Davet kabul sayfasi | Herkese acik |
| `/yonetici` | Yonetici panosu | Yonetici |
| `/yonetici/apartmanlar` | Apartman listesi | Yonetici |
| `/yonetici/apartman/:id` | Apartman detayi | Yonetici |
| `/yonetici/daireler` | Daire listesi | Yonetici |
| `/yonetici/daire/:id` | Daire detayi | Yonetici |
| `/yonetici/aidatlar` | Aidat yonetimi | Yonetici |
| `/yonetici/odemeler` | Odeme yonetimi | Yonetici |
| `/yonetici/gelir-gider` | Gelir-gider takibi | Yonetici |
| `/yonetici/duyurular` | Duyuru yonetimi | Yonetici |
| `/yonetici/talepler` | Talep yonetimi | Yonetici |
| `/yonetici/bildirimler` | Bildirim merkezi | Yonetici |
| `/yonetici/belgeler` | Belge uretimi (PDF) | Yonetici |
| `/yonetici/ayarlar` | Ayarlar | Yonetici |
| `/sakin` | Sakin panosu | Sakin |
| `/sakin/borclarim` | Borclarim | Sakin |
| `/sakin/odemelerim` | Odemelerim | Sakin |
| `/sakin/odeme-bildirimi` | Odeme bildirimi gonder | Sakin |
| `/sakin/duyurular` | Duyurular | Sakin |
| `/sakin/talepler` | Talepler | Sakin |
| `/sakin/yeni-talep` | Yeni talep olustur | Sakin |
| `/sakin/bildirimler` | Bildirim merkezi | Sakin |
| `/sakin/profil` | Profil | Sakin |

---

## Veritabani Semasi

Uygulama Supabase (PostgreSQL) uzerinde **18 tablo** kullanir. Tam sema `supabase/migrations/001_initial_schema.sql` dosyasindadir.

| # | Tablo | Aciklama |
|---|---|---|
| 1 | `profiles` | Kullanici profilleri (`auth.users` uzantisi) |
| 2 | `apartments` | Apartman binalari (ad, adres, banka bilgileri, baslangic bakiyesi) |
| 3 | `apartment_managers` | Apartman-yonetici iliskisi |
| 4 | `units` | Daireler (numara, kat, blok, aylik aidat tutari) |
| 5 | `unit_residents` | Daire sakinleri (ev sahibi / kiraci, aktiflik durumu) |
| 6 | `invitations` | Sakin davet baglantilari (sureli token, 48 saat gecerlilik) |
| 7 | `dues` | Aidat ve borc kayitlari (aylik / tek seferlik, kismi odeme durumu) |
| 8 | `payments` | Onaylanmis odeme kayitlari (makbuz no, idempotency key) |
| 9 | `payment_notifications` | Sakin odeme bildirimleri (beklemede / onaylandi / reddedildi) |
| 10 | `incomes` | Aidat disi gelirler |
| 11 | `expenses` | Apartman giderleri (kategorili) |
| 12 | `announcements` | Duyurular (sabitleme, yayin durumu) |
| 13 | `maintenance_requests` | Ariza ve bakim talepleri (yeni / devam ediyor / cozuldu) |
| 14 | `request_comments` | Talep yorumlari |
| 15 | `notifications` | Uygulama ici bildirimler |
| 16 | `push_subscriptions` | Web Push abonelikleri (cihaz bazli) |
| 17 | `notification_log` | Bildirim gonderim kaydi (tekrar onleme) |
| 18 | `audit_log` | Finansal islem denetim kaydi (JSONB detay) |

### Onemli RPC Fonksiyonlari

| Fonksiyon | Aciklama |
|---|---|
| `record_payment` | Atomik odeme kaydi + aidat durumu guncelleme + denetim logu |
| `cancel_payment` | Odeme iptali (silmez, durum degistirir) + aidat yeniden hesaplama |
| `approve_payment_notification` | Sakin bildirimini onaylayip gercek odeme olusturma |
| `reject_payment_notification` | Sakin bildirimini reddetme |
| `create_bulk_dues` | Tum aktif daireler icin toplu aylik aidat olusturma |
| `get_financial_summary` | Donemsel gelir/gider/bakiye ozeti |
| `accept_invitation` | Davet kabulu ve sakin-daire eslestirmesi |
| `get_invitation_by_token` | Token ile davet sorgulama (sure ve durum kontrolu) |
| `get_overdue_dues` | Gecmis tarihli odenmemis aidatlari listeleme |
| `get_due_remaining` | Bir aidat icin kalan borc tutarini hesaplama |
| `generate_receipt_no` | Apartman bazinda benzersiz makbuz numarasi uretimi |

### Yardimci Fonksiyonlar

| Fonksiyon | Aciklama |
|---|---|
| `is_apartment_manager(apt_id, uid)` | Kullanicinin belirtilen apartmanin yoneticisi olup olmadigini kontrol eder |
| `is_unit_resident(unit_id, uid)` | Kullanicinin belirtilen dairenin sakini olup olmadigini kontrol eder |
| `get_user_apartment_ids(uid)` | Kullanicinin erisim yetkisi olan tum apartman ID'lerini dondurur |
| `get_user_unit_ids(uid)` | Kullanicinin aktif sakin oldugu tum daire ID'lerini dondurur |

---

## Guvenlik Ozellikleri

- **Row Level Security (RLS)** -- Tum 18 tabloda etkin. Yoneticiler yalnizca kendi apartmanlarinin, sakinler yalnizca kendi dairelerinin verilerine erisebilir. RLS politikalari yardimci fonksiyonlar (`is_apartment_manager`, `is_unit_resident`, `get_user_apartment_ids`, `get_user_unit_ids`) uzerinden degerlendirilir.
- **SECURITY DEFINER fonksiyonlar** -- Hassas islemler (odeme kaydi, davet kabulu, odeme bildirimi onay/red) sunucu tarafinda guvenli fonksiyonlar uzerinden gerceklestirilir.
- **Idempotency key** -- Cift odeme kaydini onleyen benzersiz anahtar mekanizmasi. Ayni idempotency key ile ikinci kez odeme kaydedilmeye calisildiginda mevcut kayit dondurulur.
- **VAPID tabanli Web Push** -- Bildirimler sifrelenmis kanal uzerinden gonderilir.
- **Davet token suresi** -- Davet baglantilari kriptografik rastgele token ile olusturulur ve 48 saat sonra otomatik olarak gecersiz olur. Tek kullanimliktir.
- **Denetim logu (Audit Log)** -- Tum finansal islemler (odeme olusturma, iptal, toplu aidat) `audit_log` tablosunda JSONB detayi ile kayit altina alinir.
- **Bildirim tekrar onleme** -- `notification_log` tablosu ile ayni bildirimin tekrar gonderilmesi unique constraint ile engellenir.
- **Makbuz numarasi benzersizligi** -- Apartman bazinda benzersiz makbuz numarasi uretimi (`MKB-YYYYMMDD-NNNN` formati).
- **Aylik aidat tekrar onleme** -- Ayni daire + donem + aciklama icin cift aidat kaydi unique index ile engellenir.
- **Private Storage bucket'lari** -- Dosyalar (`receipts`, `attachments`, `request-photos`) public erisime kapalidir, RLS ile kontrol edilir.
- **Sifre guvenligi** -- Supabase Auth tarafindan bcrypt ile hash'lenir.

---

## Kimlik Dogrulama

Uygulama telefon numarasi tabanli kimlik dogrulama kullanir. Supabase e-posta auth altyapisinin uzerine, telefon numarasi pseudo-email formatina donusturulerek calisir:

```
${phone.replace('+', '')}@apartman.local
```

Ornegin `+905551234567` numarasi icin `905551234567@apartman.local` e-posta adresi Supabase Auth'a kaydedilir.

### Roller

| Rol | Turkce | Erisim | Rota Oneki |
|---|---|---|---|
| `manager` | Yonetici | Apartman yonetim paneli | `/yonetici/*` |
| `resident` | Sakin | Sakin paneli | `/sakin/*` |

Rol belirleme otomatiktir:
- `apartment_managers` tablosunda kaydi olan kullanici **yonetici** olarak tanimlanir.
- `unit_residents` tablosunda aktif kaydi olan kullanici **sakin** olarak tanimlanir.
- Her iki tabloda da kaydi olmayan kullanici yeni kullanici olarak apartman olusturma sayfasina yonlendirilir.

### Sakin Rolleri

Daire sakinleri iki alt role sahip olabilir:

| Rol | Aciklama |
|---|---|
| `owner` | Ev sahibi |
| `tenant` | Kiraci |

Bir dairede birden fazla sakin (ev sahibi + kiraci) olabilir.

---

## Yayinlama (Deployment)

### Frontend

Uygulama statik bir SPA olarak derlenir ve herhangi bir statik hosting servisinde yayinlanabilir:

**Vercel:**
```bash
npm run build
```
Framework preset olarak "Vite" secin. `dist/` klasoru otomatik deploy edilir.

**Netlify:**
- Build komutu: `npm run build`
- Publish dizini: `dist/`
- SPA yonlendirmesi icin `public/_redirects` dosyasi veya `netlify.toml` ekleyin:
  ```
  /*    /index.html   200
  ```

**Diger:** Herhangi bir statik dosya sunucusu (nginx, Cloudflare Pages vb.) kullanilabilir. Tum rotalarin `index.html`'e yonlendirilmesi gerekir (SPA fallback).

### Backend

- **Supabase** bulut projesi uretim icin kullanilir.
- Edge Functions kullaniyorsaniz `supabase functions deploy` ile deploy edin.
- Ortam degiskenlerini (VAPID anahtarlari, service role key) hosting platformunuzda tanimlayin.

### Uretim ortam degiskenleri

Hosting platformunuzda asagidaki degiskenleri tanimlayin:

| Degisken | Aciklama |
|---|---|
| `VITE_SUPABASE_URL` | Uretim Supabase proje URL'si |
| `VITE_SUPABASE_ANON_KEY` | Uretim Supabase anon key |
| `VITE_VAPID_PUBLIC_KEY` | VAPID public key |

`VAPID_PRIVATE_KEY` ve `SUPABASE_SERVICE_ROLE_KEY` yalnizca sunucu tarafinda (Edge Functions) kullanilir, frontend'e dahil edilmemelidir.

---

## PWA Kurulumu

### Android (Chrome)
1. Uygulamayi Chrome'da acin
2. Adres cubugundaki "Ana ekrana ekle" secenegine tiklayin
3. Veya menuden "Uygulamayi yukle" secenegini kullanin

### iOS (Safari)
1. Uygulamayi Safari'de acin
2. Paylas butonuna dokunun
3. "Ana Ekrana Ekle" secenegini secin
4. **Not**: iOS'ta push bildirimleri yalnizca PWA ana ekrana eklendikten sonra calisir

### Masaustu (Chrome/Edge)
- Adres cubugundaki yukleme simgesine tiklayin

---

## Mimari Kararlar

- **Para birimleri**: Veritabaninda `NUMERIC(12,2)` ile saklanir.
- **Telefon numaralari**: E.164 formatinda saklanir (`+905551234567`). Goruntulemede `libphonenumber-js` ile formatlanir.
- **Kimlik dogrulama**: Telefon numarasindan turetilmis pseudo-email ile Supabase Auth kullanilir (gercek SMS dogrulama gerektirmez).
- **Yetkilendirme**: Tum tablolarda Row Level Security (RLS) politikalari uygulanir. Hassas islemler SECURITY DEFINER fonksiyonlar uzerinden yapilir.
- **Zaman dilimi**: Tum tarih hesaplamalari ve goruntuleme `Europe/Istanbul` zaman diliminde yapilir (`date-fns-tz`).
- **Durum yonetimi**: Zustand global auth state icin, TanStack React Query sunucu verisi icin kullanilir.
- **Kod bolme**: Tum sayfa bilesenleri `React.lazy()` ile lazy-load edilir.
- **API onbellekleme**: Supabase API cagrilari Workbox `NetworkFirst` stratejisi ile onbelleklenir (5 dakika, maks 50 girdi).
- **Path alias**: `@/` prefiksi `src/` klasorune isaret eder.

---

## Bilinen Sinirlamalar / MVP Notlari

- **SMS dogrulamasi yok** -- Telefon numarasi pseudo-email yontemiyle kaydedilir; gercek SMS OTP entegrasyonu henuz eklenmemistir.
- **WhatsApp API entegrasyonu yok** -- Yalnizca `wa.me` click-to-chat linkleri kullanilir; WhatsApp Business API entegrasyonu yoktur.
- **Tek dil** -- Arayuz yalnizca Turkce destekler; coklu dil (i18n) altyapisi yoktur.
- **Cevrimdisi destek sinirli** -- PWA Service Worker ile temel asset onbellekleme mevcuttur, ancak tam cevrimdisi veri senkronizasyonu yoktur.
- **Online odeme yok** -- Uygulama dogrudan odeme almaz. Odeme sakin tarafindan banka/nakit ile yapilir, yonetici onaylar.
- **Dosya yukleme boyut siniri** -- Supabase Storage ucretsiz katman sinirlarina tabidir.
- **Sakin coklu apartman** -- Yonetici birden fazla apartmani yonetebilir, ancak sakin ayni anda yalnizca bir apartmana bagli calisir.
- **E-posta bildirimleri yok** -- Bildirimler yalnizca uygulama ici ve Web Push uzerinden iletilir.
- **Sifre kurtarma** -- E-posta servisi (SMTP) Supabase'de yapilandirilmadiysa calismaz.
- **Turkce karakter PDF** -- jsPDF varsayilan fontunda bazi ozel Turkce karakterler duzgun gorunmeyebilir. Ozel font dosyasi eklenerek cozulebilir.
- **Push bildirim guvenirliligi** -- Web Push her zaman teslim edilmeyi garanti etmez. Uygulama ici bildirim merkezi her zaman guncellenir.

---

## Test Akisi (Gelistirme)

1. Yonetici olarak kayit olun
2. Yeni apartman olusturun
3. Daireler ekleyin
4. Aidat olusturun (tekil veya toplu)
5. Bir daire icin sakin daveti olusturun
6. Farkli tarayicida sakin olarak davet baglantisidan giris yapin
7. Sakin olarak odeme bildirimi yapin
8. Yonetici olarak bildirimi onaylayin veya reddedin
9. PDF makbuz ve rapor olusturun

---

## Lisans

Bu proje henuz bir lisans altinda yayinlanmamistir. Telif hakki sahibi ile iletisime gecin.
