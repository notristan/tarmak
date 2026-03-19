import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import axios from 'axios';
import * as cheerio from 'cheerio';
import nlp from 'compromise';

const app = express();
// On ouvre les vannes pour que ton interface spatiale puisse pomper la data
app.use(cors({
    origin: '*', // Autorise toutes les requêtes (idéal pour un portfolio)
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 8080;

// ==========================================
// 🛰️ OSINT TOOLS (Geocoding & Severity)
// ==========================================
async function geocodeLocation(placeName) {
    try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(placeName)}&format=json&limit=1`;
        const response = await axios.get(url, { headers: { 'User-Agent': 'TARMAK-Backend/2.0' } });
        return response.data?.[0] ? { lat: parseFloat(response.data[0].lat), lon: parseFloat(response.data[0].lon) } : null;
    } catch (e) { return null; }
}

const CRITICAL_WORDS = ['strike', 'missile', 'attack', 'explosion', 'dead', 'war', 'intercept', 'kharkiv', 'kyiv', 'gaza'];
const WARNING_WORDS = ['deployed', 'troops', 'border', 'tension', 'drone', 'alert', 'military'];

function getSeverity(text) {
    const lower = text.toLowerCase();
    if (CRITICAL_WORDS.some(w => lower.includes(w))) return "CRITICAL";
    if (WARNING_WORDS.some(w => lower.includes(w))) return "WARNING";
    return "INFO";
}

// ==========================================
// 🛰️ RELAI SATELLITE (TLE)
// ==========================================
app.get('/satellites-tle', async (req, res) => {
    try {
        console.log("OSINT // BUNKER: Requête TLE transmise à Celestrak...");
        const response = await axios.get("https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle");
        res.send(response.data);
    } catch (e) {
        console.error("🚨 OSINT // BUNKER: Erreur Celestrak");
        res.status(500).send("Erreur Celestrak");
    }
});

// ==========================================
// ✈️ RELAIS DATA (ADSB & CCTV)
// ==========================================
app.get('/radar/*', async (req, res) => {
    const targetUrl = `https://api.adsb.lol/v2/${req.params[0]}`;
    try {
        const apiRes = await axios.get(targetUrl, { headers: { 'User-Agent': 'TARMAK-Relay/2.0' } });
        res.json(apiRes.data);
    } catch (e) { res.status(500).json({ error: "ADSB Offline" }); }
});

app.get('/cctv-data', async (req, res) => {
    const targetUrl = "https://data.grandlyon.com/fr/geoserv/ogc/features/v1/collections/metropole-de-lyon:pvo_patrimoine_voirie.pvocameracriter/items?f=application/geo%2Bjson&limit=500";
    try {
        const apiRes = await axios.get(targetUrl);
        res.json(apiRes.data);
    } catch (e) { res.status(500).json({ error: "CCTV Lyon Offline" }); }
});

// ==========================================
// 📡 SOCMINT (TELEGRAM MONITOR)
// ==========================================
let globalOsintFeed = [];
const CHANNELS = ['Faytuks', 'clashreport', 'Liveuamap', 'disclosetv', 'DDGeopolitics'];

async function scanTelegram() {
    console.log("OSINT // SOCMINT: Lancement du scan des canaux...");
    let newEvents = [];
    
    for (const channel of CHANNELS) {
        try {
            const res = await axios.get(`https://t.me/s/${channel}`);
            const $ = cheerio.load(res.data);
            const messages = $('.tgme_widget_message').slice(-8).toArray();

            for (const msg of messages) {
                const text = $(msg).find('.tgme_widget_message_text').text();
                if (!text || text.length < 20) continue;
                
                const places = nlp(text).places().out('array');
                if (places.length > 0) {
                    const coords = await geocodeLocation(places[0]);
                    if (coords) {
                        newEvents.push({
                            id: $(msg).attr('data-post') || Math.random().toString(36).substr(2, 9),
                            author: channel.toUpperCase(),
                            avatar: channel.charAt(0).toUpperCase(),
                            source: `t.me/${channel}`,
                            timestamp: new Date().toISOString(),
                            lat: coords.lat, lon: coords.lon,
                            text: text.substring(0, 280), // On limite pour l'UI
                            severity: getSeverity(text),
                            media: text.includes('video') || text.includes('photo')
                        });
                    }
                }
            }
        } catch (e) {
            console.error(`🚨 OSINT // SOCMINT: Erreur sur le canal ${channel}`);
        }
    }
    
    // On garde les 50 plus récents
    globalOsintFeed = [...newEvents, ...globalOsintFeed].slice(0, 50);
    console.log(`OSINT // SOCMINT: Scan terminé. ${newEvents.length} nouveaux renseignements géolocalisés.`);
}

// Cycle de scan (Toutes les 5 mins)
setInterval(scanTelegram, 300000);

app.get('/api/socmint', (req, res) => res.json(globalOsintFeed));

// ==========================================
// 🚢 MARITIME (WEBSOCKET BRIDGE)
// ==========================================
wss.on('connection', (localClient) => {
    console.log("⚓ MARITIME // BUNKER: Nouvelle liaison WebSocket établie.");
    let aisSocket = null;

    localClient.on('message', (msg) => {
        try {
            const data = JSON.parse(msg);
            if (data.type === 'update_bbox') {
                if (aisSocket) aisSocket.terminate();
                
                aisSocket = new WebSocket("wss://stream.aisstream.io/v0/stream");
                
                aisSocket.on('open', () => {
                    aisSocket.send(JSON.stringify({
                        APIKey: process.env.AIS_API_KEY || "0e93bc164fe17cf85fdcbc491c015c0aaa86a039",
                        BoundingBoxes: [data.bbox],
                        FilterMessageTypes: ["PositionReport"]
                    }));
                });

                aisSocket.on('message', (aisData) => {
                    if (localClient.readyState === WebSocket.OPEN) {
                        localClient.send(aisData.toString());
                    }
                });
            }
        } catch (e) { console.error("🚨 MARITIME // ERROR:", e.message); }
    });

    localClient.on('close', () => {
        console.log("⚓ MARITIME // BUNKER: Liaison coupée.");
        aisSocket?.terminate();
    });
});

// ==========================================
// 🚀 STARTUP SEQUENCE
// ==========================================
server.listen(PORT, () => {
    console.log(`🚀 TARMAK_BUNKER_ONLINE // PORT: ${PORT}`);
    console.log(`📡 URL_SATELLITES: /satellites-tle`);
    console.log(`📡 URL_SOCMINT: /api/socmint`);
    
    // FORCE LE PREMIER SCAN IMMÉDIATEMENT
    scanTelegram();
});