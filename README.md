# Ürün Test Ajanı: Claude'da beş sanal müşteri

Axcorvia videosundaki kurulum. Bu ajan ilanına beş farklı müşteri gözüyle bakar, neden almadıklarını tek tek söyler ve bugün düzeltmen gereken üç şeyi yazar.

Sanal müşteri yorumu satış tahmini değildir. İlanı yayınlamadan önceki ilk filtredir.

## Ne lazım

- Claude hesabı: [claude.ai](https://claude.ai)
- Test edeceğin ilanın linki ve ekran görüntüsü

## Kurulum

1. Claude'da **Projeler** bölümünü aç, yeni proje oluştur. Adını `Ürün Test Ajanı` koy.
2. Aşağıdaki ajan kodunu kopyala, projenin talimat alanına yapıştır.
3. Proje içinde yeni sohbet aç. İlanının linkini ve ekran görüntüsünü gönder.

Proje açamıyorsan kodu doğrudan yeni bir sohbete yapıştır, ilan bilgilerini altına ekle. Kod yazmayı bilmen gerekmez, bu yalnız kopyalanacak bir metin.

## Ajan kodu

Kutunun sağ üstündeki kopyala düğmesine bas. Aynı metin [ajan-kodu.txt](ajan-kodu.txt) dosyasında da var.

```text
Sen bir e-ticaret müşteri heyetisin. Sana bir ürün ilanı vereceğim. İlana beş ayrı Türk müşteri gözüyle bak:

1) Bütçeli anne: parasının karşılığını arar.
2) Teknoloji meraklısı: abartı ve uydurma özelliği hemen yakalar.
3) Şüpheci alıcı: gerçekte böyle mi gelir diye sorar.
4) Hediye arayan: sunuma ve ilk izlenime bakar.
5) Acemi alıcı: ne olduğunu ve nasıl kullanılacağını anlamazsa iade eder.

Her biri için ALIRIM, TEREDDÜT ya da ALMAM de ve günlük Türkçeyle tek cümle neden yaz.
Yumuşatma, ilanda olmayan özelliği varsayma.
Linki açamazsan ya da açıklama ve görseli göremezsen bunu söyle, tahmin etme.

En sonda en sık itirazı ve ilanda bugün değiştirmem gereken 3 şeyi yaz.
Bu satış tahmini değil, ilk filtredir.
```

## Kullanırken

- Link açılmazsa başlığı, fiyatı ve açıklamayı metin olarak yapıştır.
- Ekran görüntüsü ekle. Ajan görselleri ve yorumları yalnız linkten göremeyebilir.
- İlanı düzelttikten sonra yeniden test et, kararlar değişiyor mu bak.
- Kendi müşterine göre tipleri değiştir. Örneğin "Toptan alıcı" ya da "Hızlı kargo arayan" ekle.
- Müşterilerinin adını, telefonunu ve adresini yükleme.

## Sınırlar

- Yorumlar yapay görüştür, gerçek müşteri davranışının yerini tutmaz.
- Kullanım sınırları ve özellikler Claude planına göre değişebilir.

---

[Axcorvia](https://www.instagram.com/axcorvia/)
