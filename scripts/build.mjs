import { mkdir, copyFile, cp } from 'node:fs/promises';
// Only this allowlist is public. Server code, credentials, tests and personal files stay out.
await mkdir('dist', {recursive:true});
for (const file of ['index.html','styles.css','orders.css','app.js','domain.js','orders-ui.js','manifest.webmanifest','sw.js']) {
  await copyFile(file, `dist/${file}`);
}
await cp('assets', 'dist/assets', {recursive:true});
console.log('Built static frontend in dist; Vercel serves api/shop.js separately.');
