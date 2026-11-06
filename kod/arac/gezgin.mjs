#!/usr/bin/env node
// Ürün Test Ajanı · Müşteri gezgini
// Bir müşterinin yaptığını yapar: sayfayı telefondan açar, ilk ekrana bakar, aşağı kaydırır, sekmeleri açar,
// sepete ekler, sepete gider ve ödeme kapısında durur. Hiçbir forma bilgi yazmaz, ödeme yapmaz, sipariş vermez.
//
// Kullanım:
//   node arac/gezgin.mjs <ilan-linki> [--masaustu] [--gizli] [--sepetsiz] [--klasor raporlar/deneme]
//   node arac/gezgin.mjs ornek          Kitapla gelen Örnek Mağaza'yı gezer.

import { chromium, devices } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { magazayiAc } from './ornek-magaza.mjs';

const KOK = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// Reklam ve analiz kodları engellenir. Böylece bu ziyaret reklam verilerine sahte müşteri olarak yazılmaz.
const TAKIP = /(facebook\.(net|com\/tr)|connect\.facebook|google-analytics|googletagmanager|googleadservices|doubleclick|analytics\.tiktok|hotjar|clarity\.ms|mc\.yandex|criteo|snap\.licdn|ads\.linkedin|pinterest\.com\/ct|bat\.bing)/i;

// Bu yazıları taşıyan hiçbir şeye tıklanmaz.
const YASAK = /(ödemeyi tamamla|siparişi (tamamla|onayla|ver)|ödeme yap|satın almayı onayla|kartla öde|^öde$|pay now|place order|complete order|üye ol|kayıt ol|giriş yap|sign in|log ?in|çıkış|kaldır|^sil$)/i;

// Türkçe harflerde \b çalışmaz, bu yüzden sözcük sonu elle yazılır. Yazılar karşılaştırmadan önce küçültülür.
const basta = (s) => new RegExp(`^(${s})(?=$|[^a-zçğıöşü0-9])`, 'i');
const SEPETE_EKLE = basta('sepete ekle|sepete at|sepete ekleyin|add to cart|add to bag|sepet ekle');
const HEMEN_AL = basta('hemen al|şimdi al|satın al|buy now|buy it now');
const SEPETE_GIT = basta('sepete git|sepeti görüntüle|sepetim|sepetime git|sepeti gör|alışverişi tamamla|view cart|go to cart');
const ODEMEYE_GEC = basta('ödemeye geç|ödeme adımına geç|ödeme sayfasına geç|sepeti onayla|alışverişi tamamla|satın al|devam et|güvenli ödeme|checkout|proceed to checkout');
const SEKME = basta('ürün özellikleri|özellikler|teknik özellikler|ürün açıklaması|ürün detayı|ürün bilgileri|açıklama|detaylar|iade koşulları|iade ve değişim|iade|kargo|teslimat|ödeme seçenekleri|taksit seçenekleri|yorumlar|değerlendirmeler|ürün yorumları|soru cevap|sorular');
const POPUP_KAPAT = [/^(reddet|tümünü reddet|sadece gerekli|yalnızca gerekli|reject all|decline)/i, /^(kapat|close|×|x|hayır teşekkürler|no thanks|şimdi değil|daha sonra)$/i, /^(kabul et|kabul ediyorum|tümünü kabul et|anladım|tamam|accept|accept all|ok)$/i];

const KONULAR = {
  kargo: /kargo|teslimat|gönderim|shipping/i,
  ucretsiz_kargo: /ücretsiz kargo|kargo bedava|free shipping/i,
  kargo_suresi: /(\d+\s*[-–]?\s*\d*\s*(iş )?gün(de|ü)? (içinde )?(kargo|teslim))|aynı gün kargo|yarın kargoda|hızlı teslimat/i,
  iade: /iade|değişim|cayma/i,
  garanti: /garanti/i,
  taksit: /taksit/i,
  kapida_odeme: /kapıda ödeme/i,
  yorum: /yorum|değerlendirme|review/i,
  guvenli_odeme: /güvenli ödeme|3d secure|256.?bit|ssl/i,
  iletisim: /whatsapp|müşteri hizmetleri|bize ulaşın|iletişim|0\s?\(?[2-5]\d\d\)?/i,
  stok: /stokta|tükendi|son \d+ ürün|stok/i
};

function secenekleriOku(argv) {
  const s = { link: null, masaustu: false, gizli: false, sepetsiz: false, klasor: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--masaustu') s.masaustu = true;
    else if (a === '--gizli') s.gizli = true;
    else if (a === '--sepetsiz') s.sepetsiz = true;
    else if (a === '--klasor') s.klasor = argv[++i];
    else if (!s.link) s.link = a;
  }
  return s;
}

function klasorAdi(link) {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  const zaman = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
  let ad = 'ilan';
  try { ad = new URL(link).hostname.replace(/^www\./, '').replace(/[^a-z0-9]+/gi, '-'); } catch {}
  return path.join('raporlar', `${zaman}-${ad}`);
}

async function tarayiciAc(gizli) {
  const denemeler = [{ channel: 'chrome' }, { channel: 'msedge' }, {}];
  let son;
  for (const d of denemeler) {
    try {
      return await chromium.launch({ headless: gizli, ...d, args: ['--disable-blink-features=AutomationControlled'] });
    } catch (e) { son = e; }
  }
  throw new Error(`Tarayıcı açılamadı. Chrome ya da Edge kurulu olmalı. Ayrıntı: ${String(son?.message || son).split('\n')[0]}`);
}

// Görünen ve tıklanabilir öğeyi yazısına göre işaretler, Playwright ile gerçek fare tıklaması yapar.
async function yazidanTikla(sayfa, desen, { sinir = 4000, enAlt = false } = {}) {
  const bulundu = await sayfa.evaluate(({ kaynak, bayrak, yasakKaynak, enAlt }) => {
    document.querySelectorAll('[data-gezgin]').forEach((e) => e.removeAttribute('data-gezgin'));
    const desen = new RegExp(kaynak, bayrak);
    const yasak = new RegExp(yasakKaynak, 'i');
    const uyar = (d, y) => d.test(y.toLocaleLowerCase('tr')) || d.test(y.toLowerCase());
    const adaylar = [...document.querySelectorAll('button,a,[role=button],[role=tab],input[type=submit],input[type=button],label,summary,li,span,div,h2,h3,h4')];
    const uygun = [];
    for (const e of adaylar) {
      const yazi = (e.innerText || e.value || e.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ');
      if (!yazi || yazi.length > 45 || !uyar(desen, yazi) || uyar(yasak, yazi)) continue;
      const r = e.getBoundingClientRect();
      const st = getComputedStyle(e);
      if (r.width < 8 || r.height < 8 || st.visibility === 'hidden' || st.display === 'none' || +st.opacity === 0) continue;
      if (e.disabled || e.getAttribute('aria-disabled') === 'true') continue;
      const etiket = e.tagName;
      const puan = (['BUTTON', 'A', 'INPUT'].includes(etiket) ? 3 : 0) + (e.getAttribute('role') ? 2 : 0) - yazi.length / 100;
      uygun.push({ e, yazi, puan, y: r.top + scrollY });
    }
    if (!uygun.length) return null;
    uygun.sort((a, b) => b.puan - a.puan || (enAlt ? b.y - a.y : a.y - b.y));
    uygun[0].e.setAttribute('data-gezgin', '1');
    return uygun[0].yazi;
  }, { kaynak: desen.source, bayrak: desen.flags, yasakKaynak: YASAK.source, enAlt });
  if (!bulundu) return null;
  try {
    await sayfa.locator('[data-gezgin="1"]').first().click({ timeout: sinir });
    return bulundu;
  } catch {
    try {
      await sayfa.locator('[data-gezgin="1"]').first().evaluate((e) => e.click());
      return bulundu;
    } catch { return null; }
  }
}

async function bekle(sayfa, ms = 1500) {
  await sayfa.waitForLoadState('domcontentloaded', { timeout: 8000 }).catch(() => {});
  await sayfa.waitForTimeout(ms);
}

// Müşterinin gördüğünü ölçer: konular ilk ekranda mı, ne kadar aşağıda, görsel ve açıklama ne durumda.
async function sinyalOku(sayfa, konular) {
  return sayfa.evaluate(({ konular, sepetKaynak }) => {
    const ekran = innerHeight;
    const metin = document.body?.innerText || '';
    const gorunur = (e) => {
      const r = e.getBoundingClientRect();
      const st = getComputedStyle(e);
      return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none';
    };
    const sonuc = { konular: {} };
    const yuruyucu = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const metinler = [];
    while (yuruyucu.nextNode()) {
      const n = yuruyucu.currentNode;
      const t = n.textContent.trim();
      if (t.length < 2 || t.length > 400) continue;
      const u = n.parentElement;
      if (!u || ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(u.tagName) || !gorunur(u)) continue;
      metinler.push({ t, y: Math.round(u.getBoundingClientRect().top + scrollY) });
    }
    for (const [ad, kaynak] of Object.entries(konular)) {
      const d = new RegExp(kaynak, 'i');
      const bulunan = metinler.find((m) => d.test(m.t.toLocaleLowerCase('tr')));
      sonuc.konular[ad] = bulunan
        ? { var: true, y: bulunan.y, ilk_ekranda: bulunan.y < ekran, ornek: bulunan.t.slice(0, 120) }
        : { var: false };
    }
    const fiyatDesen = /(?:₺\s?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?|\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?\s?(?:TL|₺))/g;
    const fiyatlar = [];
    for (const m of metinler) {
      for (const f of m.t.match(fiyatDesen) || []) {
        if (!fiyatlar.some((x) => x.deger === f)) fiyatlar.push({ deger: f, y: m.y, ilk_ekranda: m.y < ekran });
      }
    }
    // Tutar ile TL ayrı öğelerdeyse sayfa metninden yakalanır, konumu bilinmez.
    for (const f of metin.replace(/\s+/g, ' ').match(fiyatDesen) || []) {
      if (!fiyatlar.some((x) => x.deger.replace(/\s/g, '') === f.replace(/\s/g, ''))) fiyatlar.push({ deger: f, y: null, ilk_ekranda: null });
    }
    sonuc.fiyatlar = fiyatlar.slice(0, 8);
    const resimler = [...document.images].filter(gorunur);
    sonuc.gorsel = {
      buyuk: resimler.filter((i) => i.getBoundingClientRect().width >= 150).length,
      kirik: resimler.filter((i) => i.complete && i.naturalWidth === 0 && i.src).length,
      video: document.querySelectorAll('video,iframe[src*="youtube"],iframe[src*="vimeo"]').length
    };
    const sepet = new RegExp(sepetKaynak, 'i');
    const dugmeler = [...document.querySelectorAll('button,a,[role=button],input[type=submit]')]
      .filter((e) => gorunur(e) && sepet.test((e.innerText || e.value || '').trim().toLocaleLowerCase('tr')))
      .map((e) => {
        const r = e.getBoundingClientRect();
        const sabit = getComputedStyle(e).position === 'fixed' || getComputedStyle(e.parentElement || e).position === 'fixed';
        return { yazi: (e.innerText || e.value).trim().slice(0, 40), y: sabit ? Math.round(r.top) : Math.round(r.top + scrollY), sabit };
      })
      .sort((a, b) => a.y - b.y);
    sonuc.sepet_dugmesi = dugmeler[0] ? { ...dugmeler[0], ilk_ekranda: dugmeler[0].y < ekran } : null;
    const bloklar = [...document.querySelectorAll('[id*="desc" i],[class*="desc" i],[id*="aciklama" i],[class*="aciklama" i],[id*="detail" i],[class*="detail" i],article')];
    const en = bloklar.map((e) => e.innerText || '').sort((a, b) => b.length - a.length)[0] || '';
    sonuc.aciklama_uzunlugu = en.trim().length;
    sonuc.h1 = (document.querySelector('h1')?.innerText || '').trim().slice(0, 200);
    sonuc.baslik = document.title.slice(0, 200);
    sonuc.yatay_tasma = document.documentElement.scrollWidth > innerWidth + 4;
    const urun = [];
    for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        const v = JSON.parse(s.textContent);
        for (const o of [].concat(v['@graph'] || v)) if (String(o['@type']).includes('Product')) urun.push(o);
      } catch {}
    }
    const o = urun[0];
    sonuc.yapisal_veri = o ? {
      ad: o.name,
      fiyat: [].concat(o.offers || [])[0]?.price,
      stok: [].concat(o.offers || [])[0]?.availability,
      puan: o.aggregateRating?.ratingValue,
      yorum_sayisi: o.aggregateRating?.reviewCount
    } : null;
    sonuc.sayfa_metni = metin.replace(/\n{2,}/g, '\n').slice(0, 9000);
    return sonuc;
  }, { konular: Object.fromEntries(Object.entries(konular).map(([k, v]) => [k, v.source])), sepetKaynak: `${SEPETE_EKLE.source}|${HEMEN_AL.source}` });
}

function engelVarMi(durum, baslik, metin) {
  const kisa = metin.trim().length < 1500;
  const yazi = `${baslik} ${metin.slice(0, 1500)}`;
  return [403, 429, 503].includes(durum) || (kisa && /access denied|just a moment|captcha|are you a robot|robot olmadığ|güvenlik doğrulaması|bot detected|erişim engellendi/i.test(yazi));
}

async function gez(secenek) {
  let magaza = null;
  let link = secenek.link;
  if (link === 'ornek') {
    magaza = await magazayiAc();
    link = magaza.adres;
  }
  if (!link || !/^https?:\/\//i.test(link)) throw new Error('Link https:// ile başlamalı. Örnek: node arac/gezgin.mjs https://siten.com/urun');

  const klasor = path.resolve(KOK, secenek.klasor || klasorAdi(link));
  const ekranKlasoru = path.join(klasor, 'ekran');
  fs.mkdirSync(ekranKlasoru, { recursive: true });

  const kanit = {
    link, tarih: new Date().toISOString(), cihaz: secenek.masaustu ? 'Masaüstü' : 'Telefon', adimlar: [], sekmeler: [],
    hatalar: { konsol: 0, istek: 0, kirik_kaynak: 0 }, takip_engellenen: 0, durdu: null, engellendi: false
  };
  const adim = (ad, durum, not, gorsel = null) => {
    kanit.adimlar.push({ no: kanit.adimlar.length + 1, ad, durum, not, gorsel });
    console.log(`${String(kanit.adimlar.length).padStart(2, '0')} ${durum === 'tamam' ? '✓' : durum === 'sorun' ? '!' : '-'} ${ad}: ${not}`);
  };

  const tarayici = await tarayiciAc(secenek.gizli);
  const baglam = await tarayici.newContext({
    ...(secenek.masaustu ? { viewport: { width: 1366, height: 800 } } : { ...devices['Pixel 7'], deviceScaleFactor: 1.5 }),
    locale: 'tr-TR', timezoneId: 'Europe/Istanbul'
  });
  await baglam.route('**/*', (r) => {
    if (TAKIP.test(r.request().url())) { kanit.takip_engellenen++; return r.abort(); }
    return r.continue();
  });
  const sayfa = await baglam.newPage();
  sayfa.on('dialog', (d) => d.dismiss().catch(() => {}));
  sayfa.on('pageerror', () => kanit.hatalar.konsol++);
  sayfa.on('response', (y) => {
    if (y.status() >= 400 && new URL(y.url()).hostname === new URL(link).hostname) kanit.hatalar.kirik_kaynak++;
  });
  sayfa.on('requestfailed', (i) => { if (!TAKIP.test(i.url())) kanit.hatalar.istek++; });

  let sira = 0;
  const cek = async (ad) => {
    sira++;
    const dosya = `${String(sira).padStart(2, '0')}-${ad}.jpg`;
    await sayfa.screenshot({ path: path.join(ekranKlasoru, dosya), type: 'jpeg', quality: 72, timeout: 15000 }).catch(() => {});
    return `ekran/${dosya}`;
  };

  try {
    // 1. Sayfaya geliş
    const t0 = Date.now();
    let yanit;
    try {
      yanit = await sayfa.goto(link, { waitUntil: 'domcontentloaded', timeout: 45000 });
    } catch (e) {
      adim('Sayfaya giriş', 'sorun', `Sayfa açılmadı: ${String(e.message).split('\n')[0]}`);
      kanit.durdu = 'Sayfa açılmadığı için gezinti bitti.';
      return { kanit, klasor };
    }
    await sayfa.waitForLoadState('load', { timeout: 15000 }).catch(() => {});
    const yuklenme = Date.now() - t0;
    await sayfa.waitForTimeout(2500);
    kanit.hiz = await sayfa.evaluate(() => new Promise((coz) => {
      const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime;
      let lcp = null;
      try {
        new PerformanceObserver((l) => { const e = l.getEntries(); lcp = e[e.length - 1]?.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
      } catch {}
      setTimeout(() => coz({ ilk_icerik_ms: fcp ? Math.round(fcp) : null, en_buyuk_icerik_ms: lcp ? Math.round(lcp) : null }), 300);
    }));
    kanit.hiz.yuklenme_ms = yuklenme;
    const metin0 = await sayfa.evaluate(() => document.body?.innerText || '');
    const baslik0 = await sayfa.title();
    const gorsel1 = await cek('ilk-ekran');
    if (engelVarMi(yanit?.status(), baslik0, metin0)) {
      kanit.engellendi = true;
      kanit.durdu = 'Site otomatik ziyareti engelledi. Engel aşılmaz; ekran görüntüsü ile devam edilir.';
      adim('Sayfaya giriş', 'sorun', `Site otomatik ziyareti engelledi (durum ${yanit?.status()}).`, gorsel1);
      return { kanit, klasor };
    }
    adim('Sayfaya giriş', 'tamam', `Sayfa ${(yuklenme / 1000).toFixed(1)} saniyede açıldı.`, gorsel1);
    kanit.ilk_sinyal = await sinyalOku(sayfa, KONULAR);

    // 2. Açılır pencereler: müşteri önce bunları kapatır
    const kapatilan = [];
    for (const desen of POPUP_KAPAT) {
      const k = await yazidanTikla(sayfa, desen, { sinir: 2500 });
      if (k) { kapatilan.push(k); await sayfa.waitForTimeout(700); }
    }
    if (kapatilan.length) adim('Açılır pencere', 'tamam', `Müşteri önce şunu kapatmak zorunda kaldı: ${kapatilan.join(', ')}.`, await cek('pencere-kapandi'));
    else adim('Açılır pencere', 'atlandi', 'Kapatılması gereken pencere yok.');

    // 3. Ürün görselleri: müşteri galeriyi kaydırır
    const galeri = [];
    const galeriAdresi = sayfa.url();
    for (let i = 1; i <= 3; i++) {
      const var_mi = await sayfa.evaluate(() => {
        document.querySelectorAll('[data-gezgin-galeri]').forEach((e) => e.removeAttribute('data-gezgin-galeri'));
        const e = [...document.querySelectorAll('.swiper-button-next,.slick-next,.owl-next,[class*="next" i],[aria-label*="next" i],[aria-label*="sonraki" i]')].find((x) => {
          const r = x.getBoundingClientRect();
          return r.width > 8 && r.height > 8 && r.top >= 0 && r.top < innerHeight && getComputedStyle(x).visibility !== 'hidden' && !/disabled/i.test(x.className);
        });
        if (e) e.setAttribute('data-gezgin-galeri', '1');
        return !!e;
      });
      if (!var_mi) break;
      await sayfa.locator('[data-gezgin-galeri="1"]').first().click({ timeout: 2000 }).catch(() => {});
      await sayfa.waitForTimeout(700);
      if (sayfa.url() !== galeriAdresi) {
        await sayfa.goto(galeriAdresi, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
        await bekle(sayfa, 1200);
        break;
      }
      const yol = await cek(`galeri-${i}`);
      const dosya = path.join(klasor, yol);
      const onceki = galeri.length ? path.join(klasor, galeri[galeri.length - 1]) : null;
      if (onceki && fs.existsSync(dosya) && fs.readFileSync(dosya).equals(fs.readFileSync(onceki))) {
        fs.rmSync(dosya);
        break;
      }
      galeri.push(yol);
    }
    // Görsel büyütme penceresi açıldıysa kapatılır.
    await sayfa.keyboard.press('Escape').catch(() => {});
    await sayfa.waitForTimeout(400);
    kanit.galeri_gorselleri = galeri;
    if (galeri.length) adim('Ürün görselleri', 'tamam', `Galeride ${galeri.length} görsel daha açıldı.`, galeri[0]);
    else adim('Ürün görselleri', 'atlandi', 'Kaydırılacak galeri bulunamadı.');

    // 4. Aşağı kaydırma
    const boy = await sayfa.evaluate(() => [document.documentElement.scrollHeight, innerHeight]);
    kanit.sayfa_boyu_ekran = +(boy[0] / boy[1]).toFixed(1);
    const kaydirmalar = [];
    const enFazla = Math.min(7, Math.ceil(boy[0] / (boy[1] * 0.9)) - 1);
    for (let i = 1; i <= enFazla; i++) {
      await sayfa.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), i * boy[1] * 0.9);
      await sayfa.waitForTimeout(650);
      kaydirmalar.push(await cek(`kaydirma-${i}`));
    }
    adim('Aşağı kaydırma', 'tamam', `Sayfa ${kanit.sayfa_boyu_ekran} ekran boyunda. ${kaydirmalar.length} kaydırma yapıldı.`, kaydirmalar[0] || null);
    kanit.kaydirma_gorselleri = kaydirmalar;
    await sayfa.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));

    // 4. Sekmeler: meraklı müşteri ayrıntıları açar
    const adlar = await sayfa.evaluate((kaynak) => {
      const d = new RegExp(kaynak, 'i');
      const gorulen = new Set();
      for (const e of document.querySelectorAll('button,a,[role=tab],li,summary,label,h2,h3,h4,span,div')) {
        const t = (e.innerText || '').trim().replace(/\s+/g, ' ');
        const kap = e.children.length && !['BUTTON', 'A', 'SUMMARY', 'LABEL'].includes(e.tagName);
        if (t && !kap && t.length < 30 && d.test(t.toLocaleLowerCase('tr')) && e.getBoundingClientRect().height > 0) gorulen.add(t);
      }
      return [...gorulen].slice(0, 6);
    }, SEKME.source);
    const urunAdresi = sayfa.url();
    const metniAl = async () => {
      for (let i = 0; i < 3; i++) {
        try { return await sayfa.evaluate(() => document.body.innerText); }
        catch { await bekle(sayfa, 900); }
      }
      return '';
    };
    for (const ad of adlar) {
      try {
        const once = new Set((await metniAl()).split('\n').map((s) => s.trim()));
        const kac = ad.toLocaleLowerCase('tr').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const tiklandi = await yazidanTikla(sayfa, new RegExp(`^${kac}`, 'i'), { sinir: 2500 });
        if (!tiklandi) continue;
        await bekle(sayfa, 900);
        const yeni = (await metniAl()).split('\n').map((s) => s.trim()).filter((s) => s && !once.has(s));
        kanit.sekmeler.push({ ad, yeni_metin: yeni.join('\n').slice(0, 1800), bos: yeni.join('').length < 25 });
        // Sekme başka sayfaya götürdüyse müşteri gibi ürüne geri dönülür.
        if (sayfa.url().split('#')[0] !== urunAdresi.split('#')[0]) {
          await sayfa.goto(urunAdresi, { waitUntil: 'domcontentloaded', timeout: 30000 });
          await bekle(sayfa, 1500);
        }
      } catch { kanit.hatalar.sekme = (kanit.hatalar.sekme || 0) + 1; }
    }
    const dolu = kanit.sekmeler.filter((s) => !s.bos).length;
    if (kanit.sekmeler.length) adim('Sekmeler', dolu ? 'tamam' : 'sorun', `${kanit.sekmeler.length} sekme açıldı, ${dolu} tanesinde yeni bilgi çıktı.`, await cek('sekmeler'));
    else adim('Sekmeler', 'atlandi', 'Açılacak sekme bulunamadı.');
    kanit.sinyal = await sinyalOku(sayfa, KONULAR);

    if (secenek.sepetsiz) {
      kanit.durdu = 'Sepete eklenmedi (--sepetsiz).';
      return { kanit, klasor };
    }

    // 5. Sepete ekleme
    await sayfa.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    let eklendi = await yazidanTikla(sayfa, SEPETE_EKLE);
    await bekle(sayfa, 1800);
    let uyari = await sayfa.evaluate(() => (document.body.innerText.match(/[^\n]*(lütfen|seçiniz|seçin|select)[^\n]*/i) || [''])[0].slice(0, 120));
    if (eklendi && uyari) {
      const secti = await sayfa.evaluate(() => {
        const s = [...document.querySelectorAll('select')].find((x) => x.options.length > 1 && x.getBoundingClientRect().height > 0);
        if (s) { s.selectedIndex = 1; s.dispatchEvent(new Event('change', { bubbles: true })); return true; }
        const v = document.querySelector('[class*="variant" i] a,[class*="variant" i] button,[class*="variant" i] label,[class*="secenek" i] a,[class*="option" i] label');
        if (v) { v.click(); return true; }
        return false;
      });
      if (secti) {
        await sayfa.waitForTimeout(900);
        eklendi = (await yazidanTikla(sayfa, SEPETE_EKLE)) || eklendi;
        await bekle(sayfa, 1800);
      }
    }
    if (!eklendi) {
      adim('Sepete ekleme', 'sorun', 'Görünür bir "Sepete Ekle" düğmesi bulunamadı ya da tıklanamadı.', await cek('sepete-eklenemedi'));
      kanit.durdu = 'Sepete eklenemediği için gezinti bitti.';
      return { kanit, klasor };
    }
    adim('Sepete ekleme', 'tamam', `"${eklendi}" düğmesine basıldı.`, await cek('sepete-eklendi'));

    // 6. Sepet
    const adres = sayfa.url();
    const baglanti = await sayfa.evaluate(() => [...document.querySelectorAll('a[href]')].map((a) => a.href).find((h) => /\/(sepet|sepetim|cart|basket|shopping-cart)(\.[a-z]+)?([/?#]|$)/i.test(h)));
    const gitti = await yazidanTikla(sayfa, SEPETE_GIT, { sinir: 3000 });
    if (gitti) {
      await sayfa.waitForURL((u) => u.href !== adres, { timeout: 6000 }).catch(() => {});
      await bekle(sayfa, 1800);
    }
    if (sayfa.url() === adres) {
      const koku = new URL(sayfa.url()).origin;
      for (const hedef of [baglanti, `${koku}/sepet`, `${koku}/sepetim`, `${koku}/cart`].filter(Boolean)) {
        const y = await sayfa.goto(hedef, { waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => null);
        if (y && y.status() < 400) { await bekle(sayfa, 1800); break; }
      }
    }
    const sepetMetni = await sayfa.evaluate(() => document.body.innerText || '');
    const bos = /sepetiniz boş|sepetin boş|sepetinizde ürün bulunmamaktadır|your cart is empty|sepetiniz şu an boş/i.test(sepetMetni.toLocaleLowerCase('tr'));
    kanit.sepet = {
      adres: sayfa.url(), bos,
      satirlar: sepetMetni.split('\n').map((s) => s.trim()).filter((s) => /kargo|toplam|tutar|indirim|kupon|hizmet|ücret|kdv/i.test(s.toLocaleLowerCase('tr')) && s.length < 90).slice(0, 14),
      metin: sepetMetni.replace(/\n{2,}/g, '\n').slice(0, 2500)
    };
    const sepetGorseli = await cek('sepet');
    if (bos) {
      adim('Sepet', 'sorun', 'Sepete gidildi ama sepet boş görünüyor.', sepetGorseli);
      kanit.durdu = 'Sepet boş olduğu için gezinti bitti.';
      return { kanit, klasor };
    }
    adim('Sepet', 'tamam', `Sepet açıldı. ${kanit.sepet.satirlar.length} tutar satırı okundu.`, sepetGorseli);

    // 7. Ödeme kapısı: burada durulur, hiçbir şey yazılmaz
    const once = sayfa.url();
    const gecti = await yazidanTikla(sayfa, ODEMEYE_GEC, { sinir: 3000, enAlt: true });
    if (gecti) await bekle(sayfa, 2500);
    const odeme = await sayfa.evaluate(() => {
      const m = document.body.innerText || '';
      const kucuk = m.toLocaleLowerCase('tr');
      const alanlar = [...document.querySelectorAll('input,select,textarea')].filter((e) => e.type !== 'hidden' && e.getBoundingClientRect().height > 0);
      return {
        alan_sayisi: alanlar.length,
        zorunlu_alan: alanlar.filter((e) => e.required).length,
        sifre_var: alanlar.some((e) => e.type === 'password'),
        misafir_var: /üye olmadan|misafir|guest|üyeliksiz/i.test(kucuk),
        odeme_yollari: ['kredi kartı', 'kapıda ödeme', 'havale', 'eft', 'taksit', 'cüzdan'].filter((y) => kucuk.includes(y)),
        metin: (() => {
          const secenekler = new Set([...document.querySelectorAll('option')].map((o) => o.textContent.trim()));
          return m.split('\n').map((s) => s.trim()).filter((s) => s && !secenekler.has(s)).join('\n').slice(0, 2500);
        })()
      };
    });
    kanit.odeme = { adres: sayfa.url(), gecildi: !!gecti && sayfa.url() !== once, dugme: gecti, ...odeme };
    const not = kanit.odeme.gecildi
      ? `Ödeme kapısına gelindi. ${odeme.alan_sayisi} alan var. ${odeme.sifre_var && !odeme.misafir_var ? 'Şifre isteniyor, üyeliksiz seçenek görünmüyor.' : 'Üyelik zorunlu görünmüyor.'}`
      : 'Ödemeye geçiş düğmesi bulunamadı ya da sayfa değişmedi.';
    adim('Ödeme kapısı', kanit.odeme.gecildi ? 'tamam' : 'sorun', not, await cek('odeme-kapisi'));
    kanit.durdu = 'Ödeme kapısında durdu. Hiçbir bilgi girilmedi, sipariş verilmedi.';
    return { kanit, klasor };
  } finally {
    fs.writeFileSync(path.join(klasor, 'kanit.json'), JSON.stringify(kanit, null, 2));
    await tarayici.close().catch(() => {});
    if (magaza) magaza.sunucu.close();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const secenek = secenekleriOku(process.argv.slice(2));
  try {
    const { kanit, klasor } = await gez(secenek);
    console.log(`\nKANIT KLASÖRÜ: ${path.relative(KOK, klasor).replace(/\\/g, '/')}`);
    console.log(kanit.durdu || 'Gezinti bitti.');
    process.exit(kanit.engellendi ? 3 : 0);
  } catch (e) {
    console.error(`HATA: ${e.message}`);
    process.exit(1);
  }
}

export { gez };
