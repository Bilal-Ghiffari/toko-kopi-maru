# 🎤 Voice Commands - Quick Guide

Fitur Voice Commands untuk Toko Kopi Maru POS memungkinkan kasir berinteraksi dengan AI Assistant menggunakan suara.

> 📚 **Untuk Developer**: Lihat [VOICE_COMMANDS_FLOW.md](./VOICE_COMMANDS_FLOW.md) untuk dokumentasi lengkap flow dan architecture.

## ✨ Fitur

- **Speech Recognition**: Support Bahasa Indonesia dan English
- **Real-time Transcript**: Lihat apa yang terdeteksi secara real-time
- **Auto-submit**: Otomatis kirim pesan setelah selesai bicara
- **Keyboard Shortcut**: Tekan `Ctrl+M` (Windows/Linux) atau `Cmd+M` (Mac)
- **Visual Feedback**: Animasi waveform dan status indicators
- **Browser Support**: Chrome, Edge, Safari (Firefox experimental)

## 🚀 Cara Menggunakan

### Metode 1: Klik Button

1. Klik tombol **Mic** (🎤) di sebelah kiri input field
2. Tunggu indikator "Mendengarkan..." muncul
3. Bicara dengan jelas (contoh: "Cari kopi americano")
4. Pesan akan otomatis terkirim

### Metode 2: Keyboard Shortcut

- Tekan **`Ctrl + M`** (Windows/Linux) atau **`Cmd + M`** (Mac)
- Voice command akan toggle on/off

## 💡 Tips

### Untuk Hasil Terbaik:

- 🔇 Gunakan di tempat yang **tidak terlalu berisik**
- 🗣️ Bicara dengan **jelas dan tidak terlalu cepat**
- 📏 Jarak ideal: **15-30 cm** dari mic
- 🌐 Pastikan koneksi internet **stabil**

### Contoh Perintah:

```
"Cari kopi pahit"
"Tampilkan semua kopi dingin"
"Stok apa yang menipis?"
"Penjualan hari ini gimana?"
"Hitung diskon sepuluh persen dari seratus ribu"
```

## 🔧 Troubleshooting

### "Browser tidak mendukung Voice Commands"

✅ Gunakan Chrome, Edge, atau Safari terbaru

### "Permission microphone ditolak"

✅ Klik icon **lock** (🔒) di address bar → Allow microphone

### "Tidak ada suara terdeteksi"

✅ Pastikan mic tidak di-mute
✅ Test mic di System Settings
✅ Check level input mic

### "Koneksi internet diperlukan"

✅ Speech recognition membutuhkan internet
✅ Gunakan WiFi untuk stability

## 🎯 Technical Details

### Components:

- **`useVoiceCommand`** - Custom hook untuk Web Speech API
- **`VoiceCommandButton`** - Button dengan visual states
- **`VoiceTranscriptDisplay`** - Real-time transcript display

### Browser Compatibility:

```typescript
const SpeechRecognition =
  window.SpeechRecognition ||
  window.webkitSpeechRecognition || // Chrome/Safari
  window.mozSpeechRecognition || // Firefox
  window.msSpeechRecognition; // Edge
```

### Features:

- ✅ Auto-stop after 30 seconds
- ✅ Interim results (real-time feedback)
- ✅ Error handling dengan user-friendly messages
- ✅ Cleanup on unmount
- ✅ Accessibility support (ARIA labels)

## 🔐 Privacy

- Audio **TIDAK disimpan** di server
- Processing dilakukan oleh **browser's built-in API**
- Transcript dikirim ke AI Assistant (sama seperti text input)
- Permission dapat dicabut kapan saja

## 📚 Developer Notes

### Hook Usage:

```typescript
const {
  transcript, // Final transcript text
  interimTranscript, // Real-time temporary text
  isListening, // Currently listening
  isSupported, // Browser support
  error, // Error message
  toggleListening, // Toggle on/off
} = useVoiceCommand({
  onResult: (text) => handleSubmit(text),
  language: "id-ID",
  continuous: false,
  autoStop: 30000,
});
```

### Keyboard Shortcut:

```typescript
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "m") {
      e.preventDefault();
      toggleListening();
    }
  };
  window.addEventListener("keydown", handleKeyDown);
  return () => window.removeEventListener("keydown", handleKeyDown);
}, [toggleListening]);
```

---

**Happy selling! 🎤☕**
