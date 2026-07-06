import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-4xl py-12 px-4 sm:px-6 lg:px-8">
        <Button 
          variant="ghost" 
          onClick={() => navigate(-1)}
          className="mb-8"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Kembali
        </Button>
        
        <div className="space-y-8 text-foreground prose prose-slate dark:prose-invert max-w-none">
          <h1 className="text-3xl font-bold tracking-tight mb-6">Kebijakan Privasi (Privacy Policy)</h1>
          
          <p className="text-muted-foreground">Terakhir diperbarui: {new Date().toLocaleDateString('id-ID')}</p>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">1. Pengumpulan Informasi</h2>
            <p>
              Kami mengumpulkan informasi dari Anda ketika Anda mendaftar di situs kami, masuk ke akun Anda, melakukan pembelian, dan/atau ketika Anda keluar. Data yang dikumpulkan mencakup nama Anda, alamat email, nomor telepon, dan informasi profil lainnya.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">2. Penggunaan Informasi</h2>
            <p>Rincian informasi yang kami kumpulkan dari Anda dapat digunakan untuk:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Mempersonalisasi pengalaman dan menanggapi kebutuhan Anda</li>
              <li>Menyediakan konten iklan yang disesuaikan</li>
              <li>Meningkatkan situs web kami</li>
              <li>Meningkatkan layanan pelanggan dan kebutuhan dukungan Anda</li>
              <li>Menghubungi Anda melalui email atau telepon</li>
              <li>Mengatur kontes, promosi, atau survei</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">3. Privasi E-Commerce</h2>
            <p>
              Kami adalah pemilik tunggal dari informasi yang dikumpulkan di situs ini. Informasi pribadi Anda tidak akan dijual, dipertukarkan, ditransfer, atau diberikan kepada perusahaan lain dengan alasan apa pun, tanpa persetujuan Anda, selain hanya untuk memenuhi permintaan dan/atau transaksi, misalnya untuk pengiriman pesanan.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">4. Pengungkapan kepada Pihak Ketiga</h2>
            <p>
              Kami tidak menjual, memperdagangkan, atau mentransfer informasi pribadi Anda kepada pihak luar. Ini tidak termasuk pihak ketiga tepercaya yang membantu kami dalam mengoperasikan situs web kami atau menjalankan bisnis kami, selama pihak-pihak tersebut setuju untuk menjaga kerahasiaan informasi ini.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">5. Keamanan Informasi</h2>
            <p>
              Kami menerapkan berbagai langkah keamanan untuk menjaga keamanan informasi pribadi Anda. Kami menggunakan enkripsi mutakhir untuk melindungi informasi sensitif yang dikirim secara online. Kami juga melindungi informasi Anda secara offline. Hanya karyawan yang perlu melakukan pekerjaan khusus (seperti penagihan atau layanan pelanggan) yang diberikan akses ke informasi pribadi yang dapat diidentifikasi.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">6. Persetujuan</h2>
            <p>
              Dengan menggunakan situs web kami, Anda menyetujui kebijakan privasi kami.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
