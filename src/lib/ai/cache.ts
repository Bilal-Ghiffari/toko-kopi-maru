// ============================================================
// SEARCH CACHE SYSTEM
// ============================================================
// Sistem caching untuk menyimpan hasil pencarian produk
// Tujuan: Mengurangi beban AI parsing dan database query untuk query yang sama
// Cache disimpan di memory (Map) dengan TTL 5 menit

// Map untuk menyimpan cache hasil pencarian
// Key: query string (lowercase)
// Value: { result: hasil pencarian, timestamp: waktu cache dibuat }
const searchCache = new Map<string, { result: unknown; timestamp: number }>();

// Time To Live (TTL) untuk cache dalam milidetik
// 5 menit = 5 * 60 detik * 1000 milidetik
const CACHE_TTL = 5 * 60 * 1000; // 5 menit dalam milidetik

/**
 * Mengambil hasil pencarian dari cache jika masih valid
 * @param query - Query pencarian dari user
 * @returns Hasil pencarian dari cache atau null jika tidak ada/expired
 */
export function getCachedSearch(query: string) {
  // Ambil data cache berdasarkan query (dikonversi ke lowercase untuk case-insensitive)
  const cached = searchCache.get(query.toLowerCase());

  // Cek apakah cache ada DAN belum expired (masih dalam TTL)
  // Date.now() = waktu sekarang dalam milidetik
  // cached.timestamp = waktu cache dibuat
  // Jika selisihnya kurang dari CACHE_TTL, berarti masih valid
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.result; // Return hasil dari cache
  }

  // Return null jika cache tidak ada atau sudah expired
  return null;
}

/**
 * Menyimpan hasil pencarian ke dalam cache
 * @param query - Query pencarian dari user
 * @param result - Hasil pencarian yang akan di-cache
 */
export function setCachedSearch(query: string, result: unknown) {
  // Simpan hasil ke cache dengan key query (lowercase) dan timestamp saat ini
  searchCache.set(query.toLowerCase(), { result, timestamp: Date.now() });

  // Limit ukuran cache maksimal 1000 entri untuk menghindari memory leak
  if (searchCache.size > 1000) {
    // Konversi Map ke Array untuk bisa di-sort berdasarkan timestamp
    const entries = Array.from(searchCache.entries());

    // Sort array berdasarkan timestamp (ascending = terlama dulu)
    // a[1].timestamp = timestamp dari entry a
    // b[1].timestamp = timestamp dari entry b
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

    // Ambil key dari entry paling lama (index 0 setelah di-sort)
    const oldestKey = entries[0][0];

    // Hapus entry paling lama dari cache
    searchCache.delete(oldestKey);
  }
}
