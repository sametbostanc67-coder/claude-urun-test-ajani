#!/usr/bin/env node
// Ürün Test Ajanı · Rapor üretici
// kanit.json ve analiz.json dosyalarından tek dosyalık rapor.html yapar. Görseller dosyanın içine gömülür.
//
// Kullanım: node arac/rapor.mjs raporlar/<klasor>

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const KOK = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const KARARLAR = ['ALIRIM', 'TEREDDÜT', 'ALMAM'];

const kacis = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function denetle(a, klasor) {
  const h = [];
  const liste = (ad) => (Array.isArray(a[ad]) ? a[ad] : (h.push(`"${ad}" liste olmalı`), []));
  if (!a.tek_cumle) h.push('"tek_cumle" boş');
  if (!a.ilan?.ad) h.push('"ilan.ad" boş');
  const m = liste('musteriler');
  if (m.length < 3) h.push('En az 3 müşteri olmalı');
  m.forEach((x, i) => {
    if (!KARARLAR.includes(x.karar)) h.push(`musteriler[${i}].karar ALIRIM, TEREDDÜT ya da ALMAM olmalı`);
    for (const alan of ['ad', 'neden', 'soz']) if (!x[alan]) h.push(`musteriler[${i}].${alan} boş`);
    if (x.karar !== 'ALIRIM' && !x.kactigi_yer) h.push(`musteriler[${i}].kactigi_yer boş`);
  });
  const k = liste('kacis_haritasi');
  if (!k.length) h.push('kacis_haritasi boş');
  let onceki = m.length;
  k.forEach((x, i) => {
    if (typeof x.kalan !== 'number' || x.kalan < 0 || x.kalan > onceki) h.push(`kacis_haritasi[${i}].kalan ${onceki} ile 0 arasında olmalı`);
    else onceki = x.kalan;
    if (!x.adim) h.push(`kacis_haritasi[${i}].adim boş`);
  });
  const alan = m.filter((x) => x.karar === 'ALIRIM').length;
  if (k.length && k[k.length - 1].kalan !== alan) h.push(`Son adımda kalan sayısı ALIRIM diyen müşteri sayısına (${alan}) eşit olmalı`);
  const s = liste('sorunlar');
  if (!s.length) h.push('sorunlar boş');
  s.forEach((x, i) => {
    for (const alanAdi of ['baslik', 'nerede', 'kanit', 'duzeltme']) if (!x[alanAdi]) h.push(`sorunlar[${i}].${alanAdi} boş`);
  });
  for (const x of [...k, ...s]) {
    if (x.gorsel && !fs.existsSync(path.join(klasor, x.gorsel))) h.push(`Görsel yok: ${x.gorsel}`);
  }
  return h;
}

function gorselGom(klasor, yol) {
  const dosya = path.join(klasor, yol);
  if (!yol || !fs.existsSync(dosya)) return '';
  return `data:image/jpeg;base64,${fs.readFileSync(dosya).toString('base64')}`;
}

export function raporYaz(klasor) {
  const kanit = JSON.parse(fs.readFileSync(path.join(klasor, 'kanit.json'), 'utf8'));
  const a = JSON.parse(fs.readFileSync(path.join(klasor, 'analiz.json'), 'utf8'));
  const hatalar = denetle(a, klasor);
  if (hatalar.length) {
    const e = new Error(`analiz.json eksik:\n- ${hatalar.join('\n- ')}`);
    e.denetim = true;
    throw e;
  }

  const adet = (k) => a.musteriler.filter((m) => m.karar === k).length;
  const toplam = a.musteriler.length;
  const renk = { ALIRIM: 'yesil', 'TEREDDÜT': 'sari', ALMAM: 'kirmizi' };
  const tarih = new Date(kanit.tarih).toLocaleString('tr-TR', { dateStyle: 'long', timeStyle: 'short' });

  const noktalar = a.musteriler.map((m) => `<i class="nokta ${renk[m.karar]}"></i>`).join('');
  const harita = a.kacis_haritasi.map((x, i) => {
    const onceki = i ? a.kacis_haritasi[i - 1].kalan : toplam;
    const kacan = onceki - x.kalan;
    return `<li class="${kacan ? 'kayip' : ''}">
      <div class="adim-ust"><strong>${kacis(x.adim)}</strong><span>${x.kalan} / ${toplam} kaldı</span></div>
      <div class="cubuk"><b style="width:${toplam ? (x.kalan / toplam) * 100 : 0}%"></b></div>
      ${kacan ? `<p>${kacan} müşteri burada kaçtı: ${kacis(x.neden)}</p>` : x.neden ? `<p class="soluk">${kacis(x.neden)}</p>` : ''}
    </li>`;
  }).join('');
  const kartlar = a.musteriler.map((m) => `<article class="kart">
      <div class="kart-ust"><h3>${kacis(m.ad)}</h3><span class="rozet ${renk[m.karar]}">${m.karar}</span></div>
      <blockquote>${kacis(m.soz)}</blockquote>
      <p>${kacis(m.neden)}</p>
      ${m.kactigi_yer ? `<small>Kaçtığı yer: ${kacis(m.kactigi_yer)}</small>` : ''}
    </article>`).join('');
  const sorunlar = a.sorunlar.map((s, i) => `<article class="sorun">
      ${s.gorsel ? `<img src="${gorselGom(klasor, s.gorsel)}" alt="${kacis(s.nerede)} ekranı">` : ''}
      <div>
        <span class="sira">${i + 1}</span><small>${kacis(s.nerede)}</small>
        <h3>${kacis(s.baslik)}</h3>
        <p><strong>Gördüğüm:</strong> ${kacis(s.kanit)}</p>
        <p><strong>Düzelt:</strong> ${kacis(s.duzeltme)}</p>
        ${s.hazir_metin ? `<pre>${kacis(s.hazir_metin)}</pre>` : ''}
      </div>
    </article>`).join('');
  const film = kanit.adimlar.filter((x) => x.gorsel).map((x) => `<figure><img src="${gorselGom(klasor, x.gorsel)}" alt="${kacis(x.ad)}"><figcaption><strong>${x.no}. ${kacis(x.ad)}</strong>${kacis(x.not)}</figcaption></figure>`).join('');
  const iyi = (a.iyi_olanlar || []).map((x) => `<li>${kacis(x)}</li>`).join('');
  const eksik = (a.okunamayanlar || []).map((x) => `<li>${kacis(x)}</li>`).join('');
  const hiz = kanit.hiz?.en_buyuk_icerik_ms ? `${(kanit.hiz.en_buyuk_icerik_ms / 1000).toFixed(1)} sn` : '-';

  const html = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Müşteri Raporu · ${kacis(a.ilan.ad)}</title><style>
:root{--mor:#5b2bd9;--koyu:#17132b;--yazi:#2a2640;--soluk:#6f6a85;--cizgi:#e7e4f0;--zemin:#f7f6fb;--yesil:#16a06b;--sari:#d99400;--kirmizi:#dc3250}
*{box-sizing:border-box}body{margin:0;font-family:"Segoe UI",system-ui,-apple-system,Arial,sans-serif;color:var(--yazi);background:var(--zemin);line-height:1.5}
.sayfa{max-width:980px;margin:0 auto;padding:0 18px 56px}header.ust{background:linear-gradient(135deg,#1c1138,#3a1b86 60%,#6a2bd9);color:#fff;padding:34px 0 40px}header.ust .sayfa{padding-bottom:0}
.etiket{font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#ffd84d;font-weight:700}h1{font-size:clamp(26px,5vw,40px);line-height:1.15;margin:8px 0 10px}.alt{color:#d9d2f3;margin:0;font-size:14px}
.sonuc{display:flex;gap:18px;align-items:center;flex-wrap:wrap;background:#fff;border:1px solid var(--cizgi);border-radius:16px;padding:20px 22px;margin:-22px 0 26px;position:relative}
.noktalar{display:flex;gap:7px}.nokta{width:22px;height:22px;border-radius:50%;display:block}.nokta.yesil,.rozet.yesil{background:var(--yesil)}.nokta.sari,.rozet.sari{background:var(--sari)}.nokta.kirmizi,.rozet.kirmizi{background:var(--kirmizi)}
.sonuc p{margin:0;font-size:18px;font-weight:600;flex:1;min-width:240px}.sayilar{font-size:14px;color:var(--soluk);width:100%}
h2{font-size:22px;margin:34px 0 12px;color:var(--koyu)}ol.harita{list-style:none;margin:0;padding:18px 20px;background:#fff;border:1px solid var(--cizgi);border-radius:16px}
ol.harita li{padding:10px 0;border-bottom:1px solid var(--cizgi)}ol.harita li:last-child{border:0}.adim-ust{display:flex;justify-content:space-between;gap:12px}.adim-ust span{color:var(--soluk);font-size:14px;white-space:nowrap}
.cubuk{height:10px;border-radius:6px;background:#eeebf6;margin:7px 0}.cubuk b{display:block;height:100%;border-radius:6px;background:var(--mor)}ol.harita p{margin:4px 0 0;font-size:15px;color:var(--kirmizi)}ol.harita p.soluk{color:var(--soluk)}
.kartlar{display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:14px}.kart{background:#fff;border:1px solid var(--cizgi);border-radius:16px;padding:16px 18px}.kart-ust{display:flex;justify-content:space-between;align-items:center;gap:8px}
.kart h3{margin:0;font-size:17px}.rozet{color:#fff;font-size:12px;font-weight:800;padding:4px 9px;border-radius:7px}blockquote{margin:10px 0;font-style:italic;color:var(--koyu)}.kart p{margin:0 0 6px;font-size:14px;color:var(--soluk)}.kart small{color:var(--mor);font-weight:700}
.sorun{display:grid;grid-template-columns:190px 1fr;gap:18px;background:#fff;border:1px solid var(--cizgi);border-radius:16px;padding:16px;margin-bottom:14px}.sorun img{width:100%;border-radius:10px;border:1px solid var(--cizgi)}
.sira{display:inline-grid;place-items:center;width:26px;height:26px;background:var(--mor);color:#fff;border-radius:50%;font-weight:800;font-size:14px;margin-right:8px}.sorun small{color:var(--soluk);font-weight:700}.sorun h3{margin:8px 0;font-size:18px}.sorun p{margin:0 0 8px;font-size:15px}
pre{white-space:pre-wrap;background:#faf8ff;border:1px dashed #cfc5ef;border-radius:10px;padding:12px;font:14px/1.5 "Segoe UI",system-ui,sans-serif;margin:8px 0 0}
.film{display:flex;gap:12px;overflow-x:auto;padding-bottom:10px}.film figure{flex:0 0 200px;margin:0;background:#fff;border:1px solid var(--cizgi);border-radius:12px;padding:8px}.film img{width:100%;border-radius:8px;display:block}.film figcaption{font-size:12px;color:var(--soluk);margin-top:6px}.film strong{display:block;color:var(--koyu)}
.iki{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px}.kutu{background:#fff;border:1px solid var(--cizgi);border-radius:16px;padding:6px 20px 14px}.kutu h3{font-size:16px}.kutu ul{margin:0;padding-left:18px;font-size:15px}
.not{margin-top:30px;font-size:13px;color:var(--soluk)}@media(max-width:620px){.sorun{grid-template-columns:1fr}.sorun img{max-width:240px}}@media print{.film{flex-wrap:wrap}}
</style></head><body>
<header class="ust"><div class="sayfa"><div class="etiket">Ürün Test Ajanı · Müşteri Raporu</div><h1>${kacis(a.ilan.ad)}</h1><p class="alt">${kacis(a.ilan.fiyat || '')} · ${kacis(kanit.cihaz)} · ${kacis(tarih)}</p></div></header>
<main class="sayfa">
<section class="sonuc"><div class="noktalar">${noktalar}</div><p>${kacis(a.tek_cumle)}</p><div class="sayilar">${adet('ALIRIM')} ALIRIM · ${adet('TEREDDÜT')} TEREDDÜT · ${adet('ALMAM')} ALMAM · En büyük içerik ${hiz} · Sayfa ${kanit.sayfa_boyu_ekran ?? '-'} ekran</div></section>
<h2>Müşteri nerede kaçtı?</h2><ol class="harita">${harita}</ol>
${a.sepet_neden_birakildi ? `<h2>Sepet neden bırakıldı?</h2><div class="kutu" style="padding:14px 20px">${kacis(a.sepet_neden_birakildi)}</div>` : ''}
<h2>Bugün düzelt</h2>${sorunlar}
<h2>Beş müşteri ne dedi?</h2><div class="kartlar">${kartlar}</div>
<h2>Müşterinin gördüğü yol</h2><div class="film">${film}</div>
<div class="iki" style="margin-top:22px">${iyi ? `<div class="kutu"><h3>İyi olanlar</h3><ul>${iyi}</ul></div>` : ''}${eksik ? `<div class="kutu"><h3>Göremediklerim</h3><ul>${eksik}</ul></div>` : ''}</div>
<p class="not">Sanal müşteri yorumları yapay görüştür, satış tahmini değildir. ${kacis(kanit.durdu || '')} Reklam ve analiz kodları ${kanit.takip_engellenen} kez engellendi.</p>
</main></body></html>`;
  const hedef = path.join(klasor, 'rapor.html');
  fs.writeFileSync(hedef, html);
  return hedef;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const hedef = process.argv[2];
  if (!hedef) { console.error('Kullanım: node arac/rapor.mjs raporlar/<klasor>'); process.exit(1); }
  try {
    const dosya = raporYaz(path.resolve(KOK, hedef));
    console.log(`RAPOR HAZIR: ${path.relative(KOK, dosya).replace(/\\/g, '/')}`);
  } catch (e) {
    console.error(e.message);
    process.exit(e.denetim ? 2 : 1);
  }
}
