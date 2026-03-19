import * as Cesium from 'cesium';
// 📡 IMPORTATION DE LA CONFIGURATION
import { TARMAK_CONFIG } from '../main.js';

let shipEntities = new Map();
let socket = null;
let updateInterval = null;
let clickHandler = null;
let isLocationSelected = false;
let detectCount = 0;

const MAX_SHIPS = 800;
const shipIconSvg = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2300e5ff'%3E%3Cpath d='M20 21c-1.39 0-2.78-.47-4-1.32-2.44 1.71-5.56 1.71-8 0C6.78 20.53 5.39 21 4 21H2v2h2c1.38 0 2.74-.35 4-.99 2.52 1.29 5.48 1.29 8 0 1.26.65 2.62.99 4 .99h2v-2h-2zM3.95 19H4c1.6 0 3.02-.88 4-2 .98 1.12 2.4 2 4 2s3.02-.88 4-2c.98 1.12 2.4 2 4 2h.05l1.89-6.68c.08-.26.06-.54-.06-.78s-.34-.42-.6-.5L20 10.62V6c0-1.1-.9-2-2-2h-3V1H9v3H6c-1.1 0-2 .9-2 2v4.62l-1.29.42c-.26.08-.48.26-.6.5s-.15.52-.06.78L3.95 19zM6 6h12v3.97L12 8 6 9.97V6z'/%3E%3C/svg%3E";

export function loadMaritimeTraffic(viewer) {
    console.log(`OSINT // NAVAL: Connexion au Sonar via ${TARMAK_CONFIG.WS_BASE}...`);
    
    // Création de l'interface de ciblage
    createSearchUI(viewer);

    // 🔗 UTILISATION DU BON TUNNEL WEBSOCKET
    socket = new WebSocket(TARMAK_CONFIG.WS_BASE);

    socket.onopen = () => {
        console.log("OSINT // NAVAL: Liaison WebSocket établie avec le Bunker.");
    };

    socket.onmessage = (event) => {
        if (!isLocationSelected) return; 
        try {
            const data = JSON.parse(event.data);
            if (data.Message && data.Message.PositionReport) {
                detectCount++;
                const counterEl = document.getElementById('ship-counter');
                if (counterEl) counterEl.innerText = `PING RADAR : ${detectCount}`;
                processShip(viewer, data);
            }
        } catch (e) {}
    };

    socket.onerror = (err) => {
        console.error("🚨 MARITIME_WS_ERROR: Échec de connexion au relai tactique.");
    };

    // Gestion des clics sur les navires
    if (!clickHandler) {
        clickHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
        clickHandler.setInputAction((click) => {
            const picked = viewer.scene.pick(click.position);
            if (Cesium.defined(picked) && picked.id?.id?.startsWith('SHIP-')) {
                viewer.trackedEntity = picked.id;
                showMaritimeIntelPanel(picked.id.properties.intel.getValue());
            } else if (!Cesium.defined(picked) || !picked.id || (picked.id.id && !picked.id.id.startsWith('AIR-') && !picked.id.id.startsWith('CAM-') && !picked.id.id.startsWith('SOCMINT-'))) {
                viewer.trackedEntity = undefined;
                hideMaritimeIntelPanel();
            }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    }
}

// --- FENÊTRE DÉPLAÇABLE AVEC COMPTEUR ---
function createSearchUI(viewer) {
    if (document.getElementById('tarmak-maritime-search')) return;

    const searchBox = document.createElement('div');
    searchBox.id = 'tarmak-maritime-search';
    
    searchBox.style = `
        position: absolute; top: 120px; left: 20px; width: 280px;
        background: rgba(0, 20, 25, 0.8); backdrop-filter: blur(10px);
        border: 1px solid #00e5ff; border-radius: 4px;
        z-index: 10000; font-family: 'monospace'; color: #00e5ff;
        box-shadow: 0 0 20px rgba(0, 229, 255, 0.2);
        display: flex; flex-direction: column;
    `;

    searchBox.innerHTML = `
        <div id="maritime-drag-handle" style="padding: 5px; background: rgba(0, 229, 255, 0.2); cursor: grab; font-size: 10px; font-weight: bold; text-align: center; border-bottom: 1px solid #00e5ff; letter-spacing: 2px;">
            ≡ RADAR ACQUISITION ≡
        </div>
        <div style="padding: 15px;">
            <input type="text" id="maritime-target-input" placeholder="PORT, CITY, REGION..." 
                style="width: 100%; box-sizing: border-box; background: rgba(0,0,0,0.5); border: 1px solid #00e5ff; color: #fff; padding: 8px; font-family: monospace; outline: none; margin-bottom: 10px;">
            <button id="maritime-lock-btn" 
                style="width: 100%; box-sizing: border-box; background: #00e5ff; color: #000; border: none; padding: 8px; font-weight: bold; cursor: pointer;">
                LOCK RADAR ZONE
            </button>
            <div id="search-status" style="font-size: 9px; margin-top: 10px; color: #888; text-align: center;">STATUS: STANDBY</div>
            <div id="ship-counter" style="font-size: 11px; margin-top: 5px; color: #00e5ff; font-weight: bold; text-align: center;">PING RADAR : 0</div>
        </div>
    `;

    document.body.appendChild(searchBox);
    document.getElementById('maritime-lock-btn').onclick = () => performSearch(viewer);

    makeDraggable(searchBox, document.getElementById('maritime-drag-handle'));
}

function makeDraggable(element, handle) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    handle.onmousedown = dragMouseDown;

    function dragMouseDown(e) {
        e = e || window.event;
        e.preventDefault();
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;
        handle.style.cursor = "grabbing";
    }

    function elementDrag(e) {
        e = e || window.event;
        e.preventDefault();
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        element.style.top = (element.offsetTop - pos2) + "px";
        element.style.left = (element.offsetLeft - pos1) + "px";
    }

    function closeDragElement() {
        document.onmouseup = null;
        document.onmousemove = null;
        handle.style.cursor = "grab";
    }
}

async function performSearch(viewer) {
    const input = document.getElementById('maritime-target-input').value;
    const status = document.getElementById('search-status');
    const counterEl = document.getElementById('ship-counter');
    if (!input) return;

    status.innerText = "STATUS: GEOCODING...";
    detectCount = 0; 
    counterEl.innerText = "PING RADAR : 0";

    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(input)}`);
        const results = await response.json();

        if (results && results.length > 0) {
            const best = results[0];
            const lat = parseFloat(best.lat);
            const lon = parseFloat(best.lon);

            status.innerText = "STATUS: FLYING TO TARGET...";

            viewer.camera.flyTo({
                destination: Cesium.Cartesian3.fromDegrees(lon, lat, 150000),
                duration: 2,
                complete: () => {
                    const bbox = [[lat - 1.5, lon - 1.5], [lat + 1.5, lon + 1.5]];
                    shipEntities.forEach(e => viewer.entities.remove(e));
                    shipEntities.clear();
                    
                    isLocationSelected = true;
                    // ✅ ENVOI DE LA BBOX VIA LE SOCKET S'IL EST OUVERT
                    if (socket && socket.readyState === WebSocket.OPEN) {
                        socket.send(JSON.stringify({ type: 'update_bbox', bbox: bbox }));
                    } else {
                        status.innerText = "STATUS: WS_OFFLINE";
                        status.style.color = "#ff4444";
                        return;
                    }
                    status.innerText = "STATUS: RADAR_LOCKED";
                    status.style.color = "#00e5ff";
                }
            });
        } else {
            status.innerText = "STATUS: NOT FOUND";
            status.style.color = "#ff4444";
        }
    } catch (e) { status.innerText = "STATUS: ERROR"; }
}

function processShip(viewer, msg) {
    const time = viewer.clock.currentTime;
    const report = msg.Message.PositionReport;
    const meta = msg.MetaData || {};
    const mmsi = report.UserID;

    if (!report.Latitude || !report.Longitude) return;

    const pos = Cesium.Cartesian3.fromDegrees(report.Longitude, report.Latitude, 0);
    const heading = report.TrueHeading === 511 ? report.Cog : report.TrueHeading;
    const shipName = meta.ShipName ? meta.ShipName.trim() : `MMSI:${mmsi}`;

    const intelData = { mmsi, name: shipName, sog: report.Sog || 0, cog: report.Cog || 0, heading, time: meta.time_utc || "LIVE" };

    let entity = shipEntities.get(mmsi);
    if (!entity) {
        if (shipEntities.size > MAX_SHIPS) {
            const oldest = shipEntities.keys().next().value;
            viewer.entities.remove(shipEntities.get(oldest));
            shipEntities.delete(oldest);
        }

        const posProp = new Cesium.SampledPositionProperty();
        posProp.forwardExtrapolationType = Cesium.ExtrapolationType.HOLD;
        posProp.addSample(time, pos);

        entity = viewer.entities.add({
            id: `SHIP-${mmsi}`, name: shipName, position: posProp,
            properties: { intel: intelData },
            label: { text: shipName, font: '10px monospace', fillColor: Cesium.Color.CYAN, outlineColor: Cesium.Color.BLACK, outlineWidth: 2, style: Cesium.LabelStyle.FILL_AND_OUTLINE, pixelOffset: new Cesium.Cartesian2(0, -20), distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 150000) },
            billboard: { image: shipIconSvg, width: 24, height: 24, rotation: Cesium.Math.toRadians(heading || 0), disableDepthTestDistance: Number.POSITIVE_INFINITY }
        });
        shipEntities.set(mmsi, entity);
    } else {
        entity.position.addSample(time, pos);
        entity.properties.intel = intelData;
        entity.billboard.rotation = Cesium.Math.toRadians(heading || 0);
        updateMaritimeIntelPanelIfOpen(mmsi, intelData);
    }
}

export function clearMaritime(viewer) {
    if (socket) { socket.close(); socket = null; }
    isLocationSelected = false;
    detectCount = 0;
    const ui = document.getElementById('tarmak-maritime-search');
    if (ui) ui.remove();
    shipEntities.forEach(e => viewer.entities.remove(e));
    shipEntities.clear();
    if (clickHandler) { clickHandler.destroy(); clickHandler = null; }
    hideMaritimeIntelPanel();
}

// UI PANEL (Intel)
let currentPanelMmsi = null;
function showMaritimeIntelPanel(intel) {
    currentPanelMmsi = intel.mmsi;
    let p = document.getElementById('tarmak-sea-intel-panel') || createPanel();
    p.innerHTML = `<h3 style="color:#00e5ff;margin:0 0 8px 0;border-bottom:1px solid rgba(0,229,255,0.3);padding-bottom:5px;">VESSEL: ${intel.name}</h3>
        <table style="width:100%;text-align:left;border-spacing:0 4px;font-size:11px;">
            <tr><th style="color:#888;">MMSI:</th><td>${intel.mmsi}</td><th style="color:#888;">SPD:</th><td>${intel.sog} kts</td></tr>
            <tr><th style="color:#888;">COG:</th><td>${intel.cog}°</td><th style="color:#888;">TIME:</th><td>LIVE</td></tr>
        </table>`;
    p.style.display = 'block';
}
function createPanel() {
    const p = document.createElement('div'); p.id = 'tarmak-sea-intel-panel';
    p.style = "position:absolute;top:320px;left:20px;width:300px;background:rgba(0,15,20,0.85);backdrop-filter:blur(10px);color:white;padding:15px;font-family:monospace;border:1px solid #00e5ff;border-radius:8px;z-index:9999;pointer-events:none;box-shadow:0 8px 32px rgba(0,0,0,0.8);";
    document.body.appendChild(p); return p;
}
function updateMaritimeIntelPanelIfOpen(mmsi, data) { if (currentPanelMmsi === mmsi) showMaritimeIntelPanel(data); }
function hideMaritimeIntelPanel() { currentPanelMmsi = null; const p = document.getElementById('tarmak-sea-intel-panel'); if (p) p.style.display = 'none'; }