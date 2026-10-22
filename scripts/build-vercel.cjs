// Vercel serves these dependency assets directly from public/.
const fs=require('node:fs');
const path=require('node:path');
fs.mkdirSync('public/vendor/leaflet',{recursive:true});
const leaflet=path.join(path.dirname(require.resolve('leaflet/package.json')),'dist');
fs.copyFileSync(path.join(leaflet,'leaflet.js'),'public/vendor/leaflet/leaflet.js');
fs.copyFileSync(path.join(leaflet,'leaflet.css'),'public/vendor/leaflet/leaflet.css');
fs.cpSync(path.join(leaflet,'images'),'public/vendor/leaflet/images',{recursive:true});
fs.copyFileSync(path.join(path.dirname(require.resolve('html5-qrcode/package.json')),'html5-qrcode.min.js'),'public/vendor/html5-qrcode.js');
fs.copyFileSync(path.join(path.dirname(require.resolve('socket.io-client/package.json')),'dist/socket.io.min.js'),'public/vendor/socket.io.min.js');
console.log('Browser vendor assets prepared. No database writes or seeds run during builds.');
