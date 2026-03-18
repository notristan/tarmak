import http from 'http';

const PORT = 8081;

http.createServer(async (req, res) => {
    // 💥 LE CASSE-BÉLIER ANTI-CORS 💥
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    if (req.url.startsWith('/radar/')) {
        const targetPath = req.url.replace('/radar', '');
        const targetUrl = `https://api.adsb.lol/v2${targetPath}`;

        console.log(`OSINT // INTERCEPTION AÉRIENNE : Demande de scan sur ${targetUrl}`);

        try {
            // Utilisation du Fetch natif (beaucoup plus robuste que https.get)
            const apiRes = await fetch(targetUrl, {
                headers: { 'User-Agent': 'TARMAK-Relay/2.0' }
            });

            if (!apiRes.ok) throw new Error(`HTTP Error: ${apiRes.status}`);

            const data = await apiRes.text();
            
            // Le Mouchard pour compter les avions
            try {
                const parsedData = JSON.parse(data);
                const count = parsedData.ac ? parsedData.ac.length : 0;
                console.log(`OSINT // SUCCÈS : ${count} aéronefs transmis au radar.`);
            } catch(e) {}

            res.writeHead(apiRes.status, { 'Content-Type': 'application/json' });
            res.end(data);
            
        } catch (e) {
            console.error(`OSINT // Erreur de relai (ignorée) : ${e.message}`);
            // On renvoie un code 500 propre au lieu de crasher le serveur
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: "ADSB.lol temporairement injoignable" }));
        }
    } else {
        res.writeHead(404);
        res.end();
    }
}).listen(PORT, () => {
    console.log(`OSINT // AIR RELAY DÉMARRÉ : Écoute sur le port ${PORT}`);
});