import express from 'express';
import cors from 'cors';
import axios from 'axios';
import * as cheerio from 'cheerio';
import nlp from 'compromise'; 

const app = express();
app.use(cors());
const PORT = 8083;

// 🌍 BASE DE DONNÉES ÉLARGIE DES CANAUX OSINT
const TARGET_CHANNELS = [
    'Faytuks',         // Info militaire occidentale
    'DDGeopolitics',   // Geopolitique globale
    'BellumActaNews',  // Conflits armés
    'clashreport',     // Rapports de combats très fréquents
    'ragipsoylu',      // Moyen-Orient / Turquie
    'Liveuamap',       // Alertes mondiales / Ukraine / Gaza
    'intelslava',      // Renseignement Europe de l'Est
    'OAlexanderDK',    // OSINT Maritime et Aérien
    'disclosetv'       // Alertes "Breaking News" mondiales
];

let globalOsintFeed = []; 

const CRITICAL_WORDS = ['strike', 'missile', 'attack', 'explosion', 'dead', 'killed', 'war', 'fire', 'bomb', 'intercept'];
const WARNING_WORDS = ['deployed', 'troops', 'border', 'tension', 'drone', 'clash', 'protest', 'alert', 'siren'];

async function geocodeLocation(placeName) {
    try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(placeName)}&format=json&limit=1`;
        const response = await axios.get(url, {
            headers: { 'User-Agent': 'Tarmak-OSINT-System/1.1' } // Mis à jour
        });
        
        if (response.data && response.data.length > 0) {
            return {
                lat: parseFloat(response.data[0].lat),
                lon: parseFloat(response.data[0].lon)
            };
        }
    } catch (e) {
        // Mode silencieux pour les erreurs de geocoding pour garder la console propre
    }
    return null;
}

function getSeverity(text) {
    const lowerText = text.toLowerCase();
    if (CRITICAL_WORDS.some(word => lowerText.includes(word))) return "CRITICAL";
    if (WARNING_WORDS.some(word => lowerText.includes(word))) return "WARNING";
    return "INFO";
}

async function scanTelegramChannels() {
    console.log("OSINT // SOCMINT: Lancement du scan global (Deep Scan)...");
    let newEvents = [];

    for (const channel of TARGET_CHANNELS) {
        try {
            console.log(`OSINT // Scraping de @${channel}...`);
            const response = await axios.get(`https://t.me/s/${channel}`);
            const $ = cheerio.load(response.data);

            // 🚀 MODIFICATION ICI : On prend les 30 derniers messages de chaque canal au lieu de 5 !
            const messages = $('.tgme_widget_message').slice(-30).toArray();

            for (const msg of messages) {
                const text = $(msg).find('.tgme_widget_message_text').text();
                if (!text || text.length < 15) continue; 

                const msgId = $(msg).attr('data-post');
                const timestampStr = $(msg).find('time').attr('datetime');
                
                if (globalOsintFeed.find(e => e.id === msgId)) continue;

                // Extraction NLP
                const doc = nlp(text);
                const places = doc.places().out('array');

                if (places.length > 0) {
                    const mainPlace = places[0]; 
                    
                    const coords = await geocodeLocation(mainPlace);
                    
                    if (coords) {
                        newEvents.push({
                            id: msgId,
                            source: `Telegram / @${channel}`,
                            author: channel.toUpperCase(),
                            avatar: "📡",
                            timestamp: timestampStr || new Date().toISOString(),
                            lat: coords.lat,
                            lon: coords.lon,
                            text: text,
                            severity: getSeverity(text),
                            media: null
                        });
                        console.log(`📍 CIBLE : ${mainPlace} (${channel})`);
                    }
                    
                    // On garde la pause de 1.5s car on fait beaucoup plus de requêtes !
                    await new Promise(resolve => setTimeout(resolve, 1500));
                }
            }
        } catch (error) {
            // Silencieux si un canal a fermé
        }
    }

    // 🚀 MODIFICATION ICI : On garde jusqu'à 100 événements en mémoire
    globalOsintFeed = [...newEvents, ...globalOsintFeed].slice(0, 100);
    console.log(`OSINT // SOCMINT: Scan terminé. ${globalOsintFeed.length} événements actifs sur le globe.`);
}

app.get('/api/socmint', (req, res) => {
    res.json(globalOsintFeed);
});

app.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(`🛰️ TARMAK SOCMINT RELAY DÉMARRÉ (PORT ${PORT})`);
    console.log(`=========================================`);
    
    scanTelegramChannels();
    setInterval(scanTelegramChannels, 120000); // Tourne toutes les 2 minutes
});