#!/usr/bin/env node
// Ürün Test Ajanı · Kurulum kontrolü
// Tarayıcıyı açar, Örnek Mağaza'yı baştan sona gezer ve örnek rapor üretir. Her şey tamamsa "KURULUM TAMAM" yazar.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gez } from './gezgin.mjs';
import { raporYaz } from './rapor.mjs';

const KOK = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const surum = Number(process.versions.node.split('.')[0]);
if (surum < 20) {
  console.error(`Node ${process.versions.node} eski. Node 20 ya da üstü gerekli.`);
  process.exit(1);
}

const klasorAdi = path.join('raporlar', 'kurulum-kontrol');
const klasor = path.join(KOK, klasorAdi);
fs.rmSync(klasor, { recursive: true, force: true });

try {
  const { kanit } = await gez({ link: 'ornek', gizli: true, klasor: klasorAdi });
  const gecen = kanit.adimlar.filter((a) => a.durum === 'tamam').length;
  if (!kanit.odeme?.gecildi) throw new Error(`Gezinti ödeme kapısına ulaşmadı (${gecen} adım tamam).`);
  fs.copyFileSync(path.join(KOK, 'arac', 'ornek-analiz.json'), path.join(klasor, 'analiz.json'));
  const rapor = raporYaz(klasor);
  console.log(`\nKURULUM TAMAM. ${gecen} adım geçti.`);
  console.log(`Örnek rapor: ${path.relative(KOK, rapor).replace(/\\/g, '/')}`);
} catch (e) {
  console.error(`\nKURULUM TAMAMLANMADI: ${e.message}`);
  process.exit(1);
}
