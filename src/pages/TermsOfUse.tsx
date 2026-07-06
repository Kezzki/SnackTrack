import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function TermsOfUse() {
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
          <h1 className="text-3xl font-bold tracking-tight mb-6">Syarat dan Ketentuan (Terms of Use)</h1>
          
          <p className="text-muted-foreground">Terakhir diperbarui: {new Date().toLocaleDateString('id-ID')}</p>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">1. Penggunaan Layanan</h2>
            <p>
              Dengan mengakses situs web ini, kami menganggap Anda menerima syarat dan ketentuan ini. Jangan melanjutkan penggunaan situs web ini jika Anda tidak setuju untuk mematuhi semua syarat dan ketentuan yang tercantum di halaman ini.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">2. Hak Kekayaan Intelektual</h2>
            <p>
              Kecuali dinyatakan lain, platform kami dan/atau pemberi lisensinya memiliki hak kekayaan intelektual atas semua materi di situs web ini. Semua hak kekayaan intelektual dilindungi undang-undang. Anda diizinkan mengakses situs web ini untuk penggunaan pribadi Anda dengan tunduk pada batasan yang ditetapkan dalam syarat dan ketentuan ini.
            </p>
            <p>Anda tidak boleh:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Menerbitkan ulang materi dari platform kami</li>
              <li>Menjual, menyewakan, atau mensublisensikan materi dari platform kami</li>
              <li>Mereproduksi, menggandakan, atau menyalin materi dari platform kami</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">3. Tautan ke Situs Web Lain</h2>
            <p>
              Layanan kami dapat berisi tautan ke situs web atau layanan pihak ketiga yang tidak dimiliki atau dikendalikan oleh platform kami. Kami tidak memiliki kendali atas, dan tidak bertanggung jawab atas konten, kebijakan privasi, atau praktik dari situs web atau layanan pihak ketiga mana pun.
            </p>
            <p>
              Kami sangat menyarankan Anda untuk membaca syarat dan ketentuan serta kebijakan privasi dari setiap situs web pihak ketiga atau layanan yang Anda kunjungi.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">4. Akun Pengguna</h2>
            <p>
              Saat Anda membuat akun di kami, Anda harus memberikan informasi yang akurat, lengkap, dan terkini setiap saat. Kegagalan untuk melakukannya merupakan pelanggaran terhadap Ketentuan, yang dapat mengakibatkan penghentian segera akun Anda di layanan kami.
            </p>
            <p>
              Anda bertanggung jawab untuk melindungi kata sandi yang Anda gunakan untuk mengakses layanan dan untuk setiap aktivitas atau tindakan di bawah kata sandi Anda.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">5. Perubahan Ketentuan</h2>
            <p>
              Kami berhak, atas kebijakan kami sendiri, untuk mengubah atau mengganti Syarat-syarat ini kapan saja. Apabila revisi bersifat material, kami akan berusaha memberikan pemberitahuan setidaknya 30 hari sebelum ketentuan baru mulai berlaku. Apa yang merupakan perubahan material akan ditentukan atas kebijakan kami sendiri.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">6. Hubungi Kami</h2>
            <p>
              Jika Anda memiliki pertanyaan tentang Syarat dan Ketentuan, silakan hubungi kami.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
