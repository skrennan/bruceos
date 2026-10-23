// Use the QR encoder already included with qrcode-terminal; no CDN required.
const QRCode = require('qrcode-terminal/vendor/QRCode');
const levels = require('qrcode-terminal/vendor/QRCode/QRErrorCorrectLevel');

module.exports = function createQRImage(value) {
    const qr = new QRCode(-1, levels.M);
    qr.addData(value);
    qr.make();
    const count = qr.getModuleCount();
    const size = count + 8; // Four-module quiet zone on every side.
    const cells = [];
    for (let row = 0; row < count; row++) {
        for (let col = 0; col < count; col++) {
            if (qr.isDark(row, col)) cells.push(`M${col + 4} ${row + 4}h1v1h-1z`);
        }
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="white"/><path d="${cells.join('')}" fill="black"/></svg>`;
    return 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
};
