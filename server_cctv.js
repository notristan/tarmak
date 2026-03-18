import http from 'http';

const PORT = 8082; // Port exclusif pour le réseau vidéo

http.createServer(async (req, res) => {
    // 💥 LE CASSE-BÉLIER ANTI-CORS 💥
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    if (req.url.startsWith('/cctv-data')) {
        // L'URL officielle de la base de données des caméras du Grand Lyon
        const targetUrl = "https://data.grandlyon.com/fr/geoserv/ogc/features/v1/collections/metropole-de-lyon:pvo_patrimoine_voirie.pvocameracriter/items?f=application/geo%2Bjson&limit=500";
        
        console.log(`OSINT // INTERCEPTION CCTV : Téléchargement de la matrice vidéo...`);

        try {
            // Node.js attaque directement l'API (pas de blocage CORS ici)
            const apiRes = await fetch(targetUrl, {
                headers: { 'User-Agent': 'TARMAK-CCTV-Relay/1.0' }
            });

            if (!apiRes.ok) throw new Error(`HTTP Error: ${apiRes.status}`);

            const data = await apiRes.text();
            
            try {
                const parsedData = JSON.parse(data);
                const count = parsedData.features ? parsedData.features.length : 0;
                console.log(`OSINT // SUCCÈS : ${count} noeuds vidéo trouvés.`);
            } catch(e) {}

            res.writeHead(apiRes.status, { 'Content-Type': 'application/json' });
            res.end(data);
            
        } catch (e) {
            console.error(`OSINT // Erreur de relai CCTV : ${e.message}`);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: "Base de données Grand Lyon injoignable" }));
        }
    } else {
        res.writeHead(404);
        res.end();
    }
}).listen(PORT, () => {
    console.log(`OSINT // CCTV RELAY DÉMARRÉ : Écoute sur le port ${PORT}`);
});