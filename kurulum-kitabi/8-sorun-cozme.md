# 8. Sorun çözme

Takıldığın yerde hatayı Claude'a yapıştır ve "Bunu düzelt" yaz. Çoğu sorunu kendisi çözer.

| Ne oldu? | Ne yapmalısın? |
| --- | --- |
| Code sekmesi yükseltme istiyor | Claude Code ücretli planlarda var. [9. bölüme](9-claude-code-yoksa.md) bak. |
| `node` tanınmıyor | Node.js kurulmamış. [nodejs.org](https://nodejs.org) adresinden LTS sürümünü kur, Claude uygulamasını kapatıp aç. |
| `Tarayıcı açılamadı` | Chrome ya da Edge kur. Olmazsa klasörde `npx playwright-core install chromium` çalıştır. |
| `/musteri-testi` komutu görünmüyor | Yanlış klasördesin. Yeni oturumda `urun-test-ajani` klasörünü aç. |
| Site otomatik ziyareti engelledi | Ajan engeli aşmaz. İlanın, sepetin ve ödeme sayfasının ekran görüntüsünü Claude'a gönder. |
| `Sepete Ekle` bulunamadı | Düğmenin adı farklı olabilir ya da seçenek seçmek gerekebilir. Ekran görüntüsü gönder. |
| Sepet boş görünüyor | Site sepeti başka bir sayfada tutuyor olabilir. `--masaustu` ile tekrar dene. |
| Rapor oluşmadı, `analiz.json eksik` yazıyor | Claude'a "Eksikleri düzelt ve raporu yeniden üret" yaz. |
| Sayfa çok yavaş açıldı | Ölçüm senin internetine bağlıdır. Sonucu tek başına kesin kabul etme. |

## Ajanı silmek

Masaüstündeki `urun-test-ajani` klasörünü sil. Başka hiçbir şey kurulmaz. Node.js ayrı bir programdır, istersen onu da kaldırabilirsin.

---

**Sonraki:** [9. Claude Code yoksa](9-claude-code-yoksa.md)
