import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function RefundPolicy() {
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
          <h1 className="text-3xl font-bold tracking-tight mb-6">Kebijakan Pengembalian Dana (Refund Policy)</h1>
          
          <p className="text-muted-foreground">Terakhir diperbarui: {new Date().toLocaleDateString('id-ID')}</p>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">1. Ketentuan Umum</h2>
            <p>
              Terima kasih telah berbelanja di platform kami. Jika Anda tidak sepenuhnya puas dengan pembelian Anda, kami siap membantu. Produk yang dapat dikembalikan adalah produk fisik yang memenuhi kriteria tertentu, seperti kerusakan saat pengiriman, ketidaksesuaian deskripsi, atau kesalahan pengiriman.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">2. Pengembalian Barang</h2>
            <p>
              Anda memiliki waktu 7 hari kalender untuk mengembalikan barang dari tanggal Anda menerimanya.
            </p>
            <p>Agar memenuhi syarat untuk pengembalian, barang Anda harus:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Tidak digunakan dan dalam kondisi yang sama seperti saat Anda menerimanya</li>
              <li>Dalam kemasan aslinya atau dalam keadaan segel utuh</li>
              <li>Menyertakan tanda terima atau bukti pembelian</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">3. Pengembalian Dana</h2>
            <p>
              Setelah kami menerima barang Anda, kami akan memeriksa dan memberitahu Anda bahwa barang pengembalian telah kami terima. Kami akan segera memberitahu Anda tentang status pengembalian dana setelah barang diperiksa.
            </p>
            <p>
              Jika pengembalian dana Anda disetujui, kami akan memulai proses pengembalian dana ke metode metode pembayaran asli yang Anda gunakan. Waktu penerimaan kredit akan bergantung pada kebijakan penerbit kartu atau penyedia layanan pembayaran Anda.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">4. Barang yang Tidak Dapat Dikembalikan Dana</h2>
            <p>Berikut adalah barang-barang yang tidak bisa dikembalikan dana:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Materi virtual, kursus digital, atau unduhan digital (setelah diakses/diunduh)</li>
              <li>Kartu hadiah atau kupon</li>
              <li>Produk diskon (kecuali jika dikonfirmasi cacat/rusak saat diantarkan)</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">5. Biaya Pengiriman</h2>
            <p>
              Anda akan bertanggung jawab untuk membayar biaya pengiriman Anda sendiri untuk mengembalikan barang Anda. Biaya pengiriman awal tidak dapat dikembalikan.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
