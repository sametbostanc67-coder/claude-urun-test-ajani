# analiz.json yapısı

Rapor aracı bu yapıyı bekler. Bütün alanlar Türkçe yazılır. Görsel yolları `ekran/01-ilk-ekran.jpg` biçimindedir.

```json
{
  "ilan": { "ad": "Ürün adı", "fiyat": "899,00 TL" },
  "tek_cumle": "5 müşteriden hiçbiri almadı, en çok sepette kaçıldı.",
  "musteriler": [
    {
      "ad": "Bütçeli anne",
      "karar": "ALMAM",
      "kactigi_yer": "Sepet",
      "soz": "Müşterinin günlük Türkçeyle söyleyeceği tek cümle.",
      "neden": "Kaçmasına yol açan, ekranda görülen gerçek eksik."
    }
  ],
  "kacis_haritasi": [
    { "adim": "İlk ekran", "kalan": 5, "neden": "", "gorsel": "ekran/01-ilk-ekran.jpg" },
    { "adim": "Ürün bilgisi", "kalan": 4, "neden": "Bu adımda kaçan müşterinin nedeni." },
    { "adim": "Güven", "kalan": 3, "neden": "" },
    { "adim": "Sepete ekleme", "kalan": 3, "neden": "" },
    { "adim": "Sepet", "kalan": 1, "neden": "" },
    { "adim": "Ödeme kapısı", "kalan": 0, "neden": "" }
  ],
  "sepet_neden_birakildi": "Sepete gelen müşteri neden bıraktı? İki cümleyle.",
  "sorunlar": [
    {
      "baslik": "Kargo ücreti ilk kez sepette çıkıyor",
      "nerede": "Sepet",
      "kanit": "Ekranda gördüğün gerçek durum.",
      "gorsel": "ekran/06-sepet.jpg",
      "duzeltme": "Bugün yapılacak tek iş.",
      "hazir_metin": "İsteğe bağlı. Kopyalanacak hazır metin. Bilinmeyen bilgi için [buraya gerçek değeri yaz] bırak."
    }
  ],
  "iyi_olanlar": ["Ekranda görülen güçlü yan."],
  "okunamayanlar": ["Göremediğin bölüm."]
}
```

## Kurallar

- `karar` yalnız `ALIRIM`, `TEREDDÜT` ya da `ALMAM` olur.
- `kacis_haritasi` içinde `kalan` sayısı hiç artmaz.
- Son adımdaki `kalan`, ALIRIM diyen müşteri sayısına eşit olur.
- `kacis_haritasi` altı adımı da taşır. Ajan bir adıma ulaşamadıysa `neden` alanına bunu yazar.
- `sorunlar` kaç müşterinin kaçtığına göre sıralanır, en önemlisi ilk sıradadır.
