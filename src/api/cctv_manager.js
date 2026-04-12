import * as Cesium from 'cesium';
// 📡 IMPORTATION DE LA CONFIGURATION DYNAMIQUE
import { TARMAK_CONFIG } from '../main.js';

let cctvEntities = [];
let liveFeedInterval = null;

const CCTV_ICON = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiMwMGU1ZmYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMjMgN2wtNyA1IDcgNXoiLz48cmVjdCB4PSIxIiB5PSI1IiB3aWR0aD0iMTUiIGhlaWdodD0iMTQiIHJ4PSIyIiByeT0iMiIvPjwvc3ZnPg==';

export async function loadCCTV(viewer) {
    console.log("OSINT // CCTV Lyon: Tentative d'accès à la matrice vidéo...");
    
    // 🔗 UTILISATION DE L'API CENTRALE
    const targetUrl = `${TARMAK_CONFIG.API_BASE}/cctv-data`;

    try {
        const response = await fetch(targetUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        
        if (!data.features || data.features.length === 0) {
            console.warn("OSINT // CCTV: Réseau vide ou accès refusé par le relai.");
            return;
        }

        clearCCTV(viewer);

        data.features.forEach(feature => {
            const coords = feature.geometry.coordinates; 
            const props = feature.properties;

            if (!props.url) return;

            const entity = viewer.entities.add({
                id: `CAM-${props.gid}`,
                name: props.nom || `Node CCTV ${props.gid}`,
                position: Cesium.Cartesian3.fromDegrees(coords[0], coords[1]),
                properties: {
                    gid: props.gid,
                    name: props.nom,
                    url: props.url, 
                    commune: props.commune || "INCONNU"
                },
                
                label: {
                    text: `CCTV-${props.gid}`,
                    font: '10px monospace',
                    fillColor: Cesium.Color.CYAN,
                    outlineColor: Cesium.Color.BLACK,
                    outlineWidth: 2,
                    style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                    pixelOffset: new Cesium.Cartesian2(0, -25),
                    distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 80000) 
                },
                billboard: {
                    image: CCTV_ICON,
                    width: 24, height: 24,
                    heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                    disableDepthTestDistance: Number.POSITIVE_INFINITY 
                }
            });
            cctvEntities.push(entity);
        });
        
        console.log(`OSINT // CCTV Lyon: ${cctvEntities.length} capteurs synchronisés.`);
    } catch (err) { 
        console.error("🚨 OSINT // CCTV_RELAY_ERROR: " + err.message); 
    }

    // Gestion du clic (Identique)
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction((click) => {
        const picked = viewer.scene.pick(click.position);
        
        if (Cesium.defined(picked) && picked.id && picked.id.id && picked.id.id.startsWith('CAM-')) {
            viewer.trackedEntity = picked.id;
            openCCTVPanel(picked.id.properties);
        } else if (!Cesium.defined(picked) || !picked.id || (picked.id.id && !picked.id.id.startsWith('AIR-') && !picked.id.id.startsWith('SHIP-'))) {
            viewer.trackedEntity = undefined;
            closeCCTVPanel();
        }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
}

// ==========================================
// 📺 PANNEAU VIDÉO DYNAMIQUE
// ==========================================
function openCCTVPanel(properties) {
    let panel = document.getElementById('tarmak-cctv-panel');
    
    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'tarmak-cctv-panel';
        panel.style.position = 'absolute';
        panel.style.bottom = '150px'; 
        panel.style.left = '30px';
        panel.style.width = '320px';
        panel.style.background = 'rgba(0, 15, 20, 0.85)';
        panel.style.backdropFilter = 'blur(10px)';
        panel.style.WebkitBackdropFilter = 'blur(10px)';
        panel.style.borderRadius = '8px';
        panel.style.padding = '15px';
        panel.style.color = '#eee';
        panel.style.fontFamily = 'monospace';
        panel.style.fontSize = '12px';
        panel.style.zIndex = '9999';
        panel.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.8)';
        panel.style.border = '1px solid #00e5ff';
        document.body.appendChild(panel);
    }
    
    const directUrl = properties.url.getValue();
    const separator = directUrl.includes('?') ? '&' : '?';

    panel.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(0, 229, 255, 0.3); padding-bottom: 8px; margin-bottom: 10px;">
            <h3 style="color: #00e5ff; margin: 0; font-size: 14px;">LIVE INTERCEPT</h3>
            <span class="live-tag" style="position: relative; top: 0; left: 0;">● REC</span>
        </div>
        
        <div class="cctv-preview">
            <img id="tarmak-cctv-img" src="${directUrl}${separator}t=${new Date().getTime()}" alt="Flux Live">
            <div class="scanline"></div>
        </div>

        <table style="width: 100%; text-align: left; border-spacing: 0 4px; margin-top: 10px; font-size: 11px;">
            <tr><th style="color: #888;">NODE:</th><td style="color: #fff;">${properties.gid.getValue()}</td><th style="color: #888;">STATUS:</th><td style="color: #00ff00;">ONLINE</td></tr>
            <tr><th style="color: #888;">LOC:</th><td colspan="3" style="color: #fff;">${properties.name.getValue() || "N/A"}</td></tr>
            <tr><th style="color: #888;">CITY:</th><td colspan="3">${properties.commune.getValue()}</td></tr>
        </table>
    `;
    
    panel.style.display = 'block';

    if (liveFeedInterval) clearInterval(liveFeedInterval);
    
    liveFeedInterval = setInterval(() => {
        const imgElement = document.getElementById('tarmak-cctv-img');
        if (imgElement) {
            imgElement.src = `${directUrl}${separator}t=${new Date().getTime()}`;
        }
    }, 4000); 
}

export function closeCCTVPanel() {
    const panel = document.getElementById('tarmak-cctv-panel');
    if (panel) panel.style.display = 'none';
    
    if (liveFeedInterval) {
        clearInterval(liveFeedInterval);
        liveFeedInterval = null;
    }
}

export function clearCCTV(viewer) {
    cctvEntities.forEach(e => viewer.entities.remove(e));
    cctvEntities = [];
    closeCCTVPanel();
}