// Örnek Mağaza: kurulumu denemek için bilgisayarında çalışan sahte mağaza. Gerçek ödeme ve gerçek ürün yoktur.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const KOK = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'ornek-magaza');
const TUR = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml' };

export function magazayiAc(port = 4173) {
  const sunucu = http.createServer((istek, yanit) => {
    const yol = decodeURIComponent(new URL(istek.url, 'http://x').pathname);
    const dosya = path.normalize(path.join(KOK, yol === '/' ? 'index.html' : yol));
    if (!dosya.startsWith(KOK) || !fs.existsSync(dosya) || fs.statSync(dosya).isDirectory()) {
      yanit.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      return yanit.end('Sayfa yok');
    }
    yanit.writeHead(200, { 'content-type': TUR[path.extname(dosya)] || 'application/octet-stream' });
    fs.createReadStream(dosya).pipe(yanit);
  });
  return new Promise((coz, reddet) => {
    sunucu.once('error', reddet);
    sunucu.listen(port, '127.0.0.1', () => coz({ sunucu, adres: `http://127.0.0.1:${port}/` }));
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { adres } = await magazayiAc();
  console.log(`Örnek Mağaza açıldı: ${adres} (kapatmak için Ctrl+C)`);
}
