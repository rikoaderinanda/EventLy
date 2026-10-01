import {
  CalendarPlus,
  CalendarDays,
  Gift,
  Mail,
  Phone,
  ScanLine,
  Search,
  Trash2,
  Users,
  UserPlus,
  BarChart3,
  Settings,
  CircleCheck,
} from 'lucide-react'
import { useState } from 'react'
import { EventCard } from '@/components/event/EventCard'
import { GuestCard } from '@/components/event/GuestCard'
import { StatisticCard } from '@/components/event/StatisticCard'
import { Avatar } from '@/components/ui/Avatar'
import { Badge, CheckInBadge, EventStatusBadge, PaymentBadge, RsvpBadge } from '@/components/ui/Badge'
import { Button, ButtonLink, IconButton } from '@/components/ui/Button'
import { Card, PageHeader, SectionHeader } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { MiniBars, Notice, ProgressBar, ProgressRing } from '@/components/ui/Feedback'
import { Select, Switch, TextArea, TextField } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Loading, Skeleton } from '@/components/ui/Spinner'
import '@/features/invitation/fonts'

/**
 * Development-only gallery of the design system (/dev/ui), to review components in one place.
 * Not built into production routes.
 */
export function UiShowcasePage() {
  const [modal, setModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [on, setOn] = useState(true)

  return (
    <div className="mx-auto max-w-6xl space-y-14 px-4 py-8 sm:px-6 sm:py-12">
      <PageHeader
        eyebrow="Design system"
        title="EventLy UI"
        subtitle="Komponen dasar, warna dan tipografi. Halaman ini hanya ada di Development."
        actions={
          <>
            <Button variant="secondary" icon={Settings}>
              Pengaturan
            </Button>
            <Button icon={CalendarPlus} block="mobile">
              Tambah acara
            </Button>
          </>
        }
      />

      <section>
        <SectionHeader
          title="Warna"
          description="Krem hangat sebagai dasar, terakota untuk aksi, emas champagne untuk aksen."
        />
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6 lg:grid-cols-11">
          {[
            ['brand-50', 'bg-brand-50'],
            ['brand-100', 'bg-brand-100'],
            ['brand-200', 'bg-brand-200'],
            ['champagne 300', 'bg-brand-300'],
            ['brand-500', 'bg-brand-500'],
            ['terracotta 600', 'bg-brand-600'],
            ['brown 900', 'bg-brand-900'],
            ['gold-500', 'bg-gold-500'],
            ['success', 'bg-success-500'],
            ['warning', 'bg-warning-500'],
            ['danger', 'bg-danger-500'],
          ].map(([name, bg]) => (
            <div key={name}>
              <div className={`h-14 rounded-xl border border-black/5 ${bg}`} />
              <p className="mt-1.5 text-xs text-stone-500">{name}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionHeader title="Tipografi dashboard" description="Inter" level={3} />
          <p className="text-page-responsive">Judul halaman</p>
          <p className="mt-3 text-section">Judul bagian</p>
          <p className="mt-2 text-card">Judul kartu</p>
          <p className="mt-2 text-body text-stone-600">
            Teks isi 15px dengan jarak baris yang lega, supaya mudah dibaca di layar HP saat acara
            berlangsung.
          </p>
        </Card>
        <Card className="bg-linear-to-b from-white to-brand-50">
          <SectionHeader
            title="Tipografi undangan"
            description="Cormorant Garamond · Playfair Display"
            level={3}
          />
          <p className="font-serif text-5xl font-medium text-brand-900">Rina &amp; Budi</p>
          <p className="mt-2 font-display text-2xl text-brand-700 italic">The Wedding Celebration</p>
          <p className="mt-3 text-body text-stone-600">Sabtu, 12 Desember 2026 · Gedung Serbaguna</p>
        </Card>
      </section>

      <section>
        <SectionHeader
          title="Button"
          description="Primary, Secondary, Danger, Ghost · sm / md / lg · loading · lebar penuh di HP"
        />
        <Card className="space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <Button icon={UserPlus}>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="danger" icon={Trash2}>
              Hapus
            </Button>
            <Button variant="ghost">Ghost</Button>
            <Button disabled>Disabled</Button>
            <Button
              loading={loading}
              onClick={() => {
                setLoading(true)
                setTimeout(() => setLoading(false), 1500)
              }}
            >
              Simpan
            </Button>
            <IconButton icon={Search} label="Cari" variant="secondary" />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg" icon={ScanLine}>
              Large
            </Button>
            <ButtonLink to="/dev/ui" variant="secondary" size="sm">
              Link sebagai tombol
            </ButtonLink>
          </div>
          <Button block="mobile" size="lg">
            Lebar penuh di HP
          </Button>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionHeader
            title="Input"
            description="Label melayang, ikon, helper, validasi, loading"
            level={3}
          />
          <div className="space-y-4">
            <TextField label="Nama tamu" name="demo-name" required hint="Nama seperti di undangan." />
            <TextField label="Nomor WhatsApp" name="demo-phone" icon={Phone} placeholder="0812…" />
            <TextField
              label="Email"
              name="demo-email"
              icon={Mail}
              defaultValue="rina@"
              error="Format email belum benar."
            />
            <TextField label="Kode undangan" name="demo-code" defaultValue="QV64bRUWha55" valid />
            <TextField label="Memeriksa…" name="demo-loading" loading defaultValue="Keluarga Wijaya" />
            <TextField label="Tanggal" name="demo-date" type="date" icon={CalendarDays} />
            <Select label="Kategori" name="demo-category" defaultValue="Wedding">
              <option value="Wedding">Pernikahan</option>
              <option value="Birthday">Ulang tahun</option>
            </Select>
            <TextArea label="Deskripsi" name="demo-desc" hint="Muncul sebagai cerita di undangan." />
            <Switch
              label="Tamu boleh memotret"
              description="Kamera tamu di halaman undangan."
              checked={on}
              onChange={(e) => setOn(e.target.checked)}
            />
          </div>
        </Card>
        <div className="space-y-6">
          <Card>
            <SectionHeader title="Badge" level={3} />
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {['Draft', 'PendingPayment', 'Active', 'Completed', 'Cancelled'].map((s) => (
                  <EventStatusBadge key={s} status={s} />
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {['Pending', 'Attending', 'NotAttending'].map((s) => (
                  <RsvpBadge key={s} status={s} />
                ))}
                <CheckInBadge checkedInAt={null} />
                <CheckInBadge checkedInAt="2026-12-12T02:32:00Z" />
              </div>
              <div className="flex flex-wrap gap-2">
                {['Pending', 'Paid', 'Failed', 'Expired'].map((s) => (
                  <PaymentBadge key={s} status={s} />
                ))}
                <Badge tone="gold" icon={CircleCheck}>
                  Premium
                </Badge>
              </div>
            </div>
          </Card>
          <Card>
            <SectionHeader title="Pesan dan progres" level={3} />
            <div className="space-y-3">
              <Notice tone="info">Paket acara ini tidak termasuk kamera tamu.</Notice>
              <Notice tone="success" title="Check-in berhasil">
                Keluarga Wijaya · 4 orang
              </Notice>
              <Notice tone="warning">Tamu ini tidak diundang ke sesi ini.</Notice>
              <Notice tone="danger">Koneksi terputus. Coba lagi.</Notice>
              <div className="flex items-center gap-5 pt-2">
                <ProgressRing value={182} max={250} label="RSVP terjawab" />
                <ProgressRing value={96} max={250} label="Sudah check-in" tone="success" />
                <div className="flex-1 space-y-3">
                  <ProgressBar value={182} max={250} label="RSVP" />
                  <MiniBars values={[2, 5, 9, 14, 22, 18, 30, 26]} />
                </div>
              </div>
            </div>
          </Card>
          <Card>
            <SectionHeader title="Modal dan loading" level={3} />
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="secondary" onClick={() => setModal(true)}>
                Buka modal / bottom sheet
              </Button>
              <Avatar name="Andi Pratama" />
              <Avatar name="Keluarga Wijaya" />
              <Avatar name="Sari" />
            </div>
            <Loading className="py-4" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </Card>
        </div>
      </section>

      <section>
        <SectionHeader title="Kartu statistik" />
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatisticCard icon={Users} label="Total tamu" value="250" caption="dari 300 kuota paket" />
          <StatisticCard
            icon={CircleCheck}
            label="RSVP"
            value="182"
            trend={{ value: '+12 hari ini', up: true }}
            visual={<ProgressRing value={182} max={250} label="RSVP terjawab" size={52} stroke={6} />}
          />
          <StatisticCard
            icon={ScanLine}
            label="Check-in"
            value="96"
            tone="success"
            visual={<MiniBars values={[1, 4, 8, 12, 20]} className="w-14" />}
          />
          <StatisticCard icon={Gift} label="Hadiah" value="34" tone="gold" caption="konfirmasi hadiah" />
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SectionHeader title="Kartu acara" />
          <div className="grid gap-4 sm:grid-cols-2">
            <EventCard
              to="/dev/ui"
              name="Resepsi Rina & Budi"
              category="Wedding"
              status="Active"
              date="Sabtu, 12 Desember 2026 · 11.00 WIB"
              venue="Gedung Serbaguna, Bandung"
              guests={250}
              rsvp={{ answered: 182, total: 250 }}
            />
            <EventCard
              to="/dev/ui"
              name="Ulang Tahun Uni ke-7"
              category="Birthday"
              status="PendingPayment"
              date="Minggu, 4 Oktober 2026 · 15.00 WIB"
              venue="Rumah keluarga"
              guests={40}
            />
          </div>
        </div>
        <div>
          <SectionHeader title="Kartu tamu (HP)" />
          <ul className="space-y-3">
            <li>
              <GuestCard
                to="/dev/ui"
                name="Andi Pratama"
                people={1}
                rsvp="Attending"
                checkedInAt="2026-12-12T02:32:00Z"
                detail="0812 3456 7890"
              />
            </li>
            <li>
              <GuestCard to="/dev/ui" name="Keluarga Wijaya" people={4} rsvp="Pending" checkedInAt={null} />
            </li>
          </ul>
        </div>
      </section>

      <section>
        <SectionHeader title="Empty state" />
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <EmptyState
              kind="events"
              title="Belum ada acara"
              description="Buat acara pertama Anda, lalu undang tamu."
              action={<Button icon={CalendarPlus}>Tambah acara</Button>}
            />
          </Card>
          <Card>
            <EmptyState
              kind="guests"
              title="Belum ada tamu"
              description="Tambahkan satu per satu atau impor dari Excel."
            />
          </Card>
          <Card>
            <EmptyState
              kind="payments"
              title="Belum ada pembayaran"
              description="Pilih paket untuk mengaktifkan acara."
            />
          </Card>
        </div>
      </section>

      <section>
        <SectionHeader title="Ikon" description="Lucide, garis 1.5–2px, selalu disertai teks atau label" />
        <div className="flex flex-wrap gap-3 text-brand-700">
          {[Users, CalendarDays, ScanLine, Gift, BarChart3, Settings, Mail, Phone].map((Icon, i) => (
            <span
              key={i}
              className="flex size-11 items-center justify-center rounded-xl bg-white shadow-soft"
            >
              <Icon aria-hidden className="size-5" />
            </span>
          ))}
        </div>
      </section>

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="Hapus tamu?"
        description="Undangan dan QR-nya tidak bisa dipakai lagi."
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(false)} block="mobile">
              Batal
            </Button>
            <Button variant="danger" icon={Trash2} onClick={() => setModal(false)} block="mobile">
              Hapus
            </Button>
          </>
        }
      >
        <p className="text-sm text-stone-600">
          Di HP ini tampil sebagai bottom sheet (geser ke bawah untuk menutup), di desktop sebagai modal di
          tengah.
        </p>
      </Modal>
    </div>
  )
}
