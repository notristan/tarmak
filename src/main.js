import { initEngine } from './core/engine';
import { initHUD } from './ui/hud';
import { initOSINTPanel } from './ui/osint_panel'; 
import { initShaderBar } from './ui/shader_bar'; 
import { initTicker } from './ui/ticker_manager';
import { loadSatellites } from './api/satellite_manager';
import * as Cesium from 'cesium';
import './assets/styles.css';

// ==========================================
// 🌐 CONFIGURATION TACTIQUE (LIVE RENDER)
// ==========================================
export const TARMAK_CONFIG = {
    API_BASE: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:8080'
        : 'https://tarmak-backend.onrender.com',
    get WS_BASE() {
        // Gère proprement le passage de HTTPS à WSS pour le cloud
        return this.API_BASE.replace('https', 'wss').replace('http', 'ws');
    }
};

// Injection globale pour les modules legacy
window.TARMAK_CONFIG = TARMAK_CONFIG;

document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log(`📡 CONNECTING TO BACKEND: ${TARMAK_CONFIG.API_BASE}`);
        
        const viewer = await initEngine('cesiumContainer');
        const coordHUD = initHUD();
        
        // Initialisation des interfaces
        initOSINTPanel(viewer); 
        initShaderBar(viewer); 
        initTicker();

        // Fonction globale de vol
        window.flyTo = (lon, lat, alt) => {
            viewer.camera.flyTo({
                destination: Cesium.Cartesian3.fromDegrees(lon, lat, alt),
                orientation: {
                    heading: Cesium.Math.toRadians(0.0),
                    pitch: Cesium.Math.toRadians(-35.0),
                    roll: 0.0
                },
                duration: 3
            });
        };

        // Démarrage tactique sur Lyon
        window.flyTo(4.8322, 45.7578, 1200);

        // Chargement orbital
        loadSatellites(viewer).catch(err => console.error("OSINT Error:", err));

        // Télémétrie en temps réel
        viewer.scene.postRender.addEventListener(() => {
            const pos = viewer.camera.positionCartographic;
            if (pos) {
                const rawHeight = pos.height;
                let displayHeight = rawHeight;

                if (rawHeight < 2500) {
                    const groundHeight = viewer.scene.sampleHeight(pos) || 0;
                    displayHeight = Math.max(0, rawHeight - groundHeight);
                }

                coordHUD.update(
                    Cesium.Math.toDegrees(pos.latitude),
                    Cesium.Math.toDegrees(pos.longitude),
                    displayHeight
                );
            }
        });

        console.log("TARMAK // SYSTEM_ONLINE // RADAR_READY");
    } catch (error) {
        console.error("TARMAK // BOOT_FAILURE:", error);
    }
});