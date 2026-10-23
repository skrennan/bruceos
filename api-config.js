// Live Server serves the UI; Express on port 3000 serves WhatsApp and store data.
(function () {
    const current = new URL(window.location.href);
    const liveServer = Number(current.port) >= 5500 && Number(current.port) <= 5599;
    if (current.protocol === 'file:') {
        window.BRUCE_API_URL = 'http://localhost:3000';
    } else if (liveServer) {
        current.port = '3000';
        window.BRUCE_API_URL = current.origin;
    } else {
        window.BRUCE_API_URL = current.origin;
    }
})();
