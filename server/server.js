import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import axios from 'axios';
import * as cheerio from 'cheerio';
import nlp from 'compromise';

const app = express();
app.use(cors());
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

const CRITICAL_WORDS = ['strike', 'missile', 'attack', 'explosion', 'dead', 'war', 'intercept'];
const WARNING_WORDS = ['deployed', 'troops', 'border', 'tension', 'drone', 'alert'];

function getSeverity(text) {
    const lower = text.toLowerCase();
    if (CRITICAL_WORDS.some(w => lower.includes(w))) return "CRITICAL";
    if (WARNING_WORDS.some(w => lower.includes(w))) return "WARNING";
    return "INFO";
}

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
const CHANNELS = ['Faytuks', 'clashreport', 'Liveuamap', 'disclosetv'];

async function scanTelegram() {
    console.log("OSINT // SOCMINT: Scanning...");
    let newEvents = [];
    for (const channel of CHANNELS) {
        try {
            const res = await axios.get(`https://t.me/s/${channel}`);
            const $ = cheerio.load(res.data);
            const messages = $('.tgme_widget_message').slice(-10).toArray();

            for (const msg of messages) {
                const text = $(msg).find('.tgme_widget_message_text').text();
                if (!text || text.length < 15) continue;
                
                const places = nlp(text).places().out('array');
                if (places.length > 0) {
                    const coords = await geocodeLocation(places[0]);
                    if (coords) {
                        newEvents.push({
                            id: $(msg).attr('data-post'),
                            author: channel.toUpperCase(),
                            timestamp: new Date().toISOString(),
                            lat: coords.lat, lon: coords.lon,
                            text: text, severity: getSeverity(text)
                        });
                    }
                }
            }
        } catch (e) {}
    }
    globalOsintFeed = [...newEvents, ...globalOsintFeed].slice(0, 50);
}
setInterval(scanTelegram, 300000); // Toutes les 5 mins
app.get('/api/socmint', (req, res) => res.json(globalOsintFeed));

// ==========================================
// 🚢 MARITIME (WEBSOCKET BRIDGE)
// ==========================================
wss.on('connection', (localClient) => {
    let aisSocket = null;
    localClient.on('message', (msg) => {
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
            aisSocket.on('message', (aisData) => localClient.send(aisData.toString()));
        }
    });
    localClient.on('close', () => aisSocket?.terminate());
});

server.listen(PORT, () => console.log(`🚀 TARMAK_BUNKER_ONLINE // PORT: ${PORT}`));