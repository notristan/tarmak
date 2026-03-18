import { initEngine } from './core/engine';
import { initHUD } from './ui/hud';
import { initOSINTPanel } from './ui/osint_panel'; 
import { initShaderBar } from './ui/shader_bar'; 
// 1. L'import est bien là
import { initTicker } from './ui/ticker_manager';
import { loadSatellites } from './api/satellite_manager';
import * as Cesium from 'cesium';
import './assets/styles.css';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const viewer = await initEngine('cesiumContainer');
        const coordHUD = initHUD();
        
        // Initialisation des interfaces
        initOSINTPanel(viewer); 
        initShaderBar(viewer); 
        
        // 2. L'APPEL AU TICKER EST ICI
        initTicker();

        // Création de la fonction globale de vol pour les boutons du bas
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

        // On force le démarrage sur Lyon
        window.flyTo(4.8322, 45.7578, 1200);

        loadSatellites(viewer).catch(err => console.error("OSINT Error:", err));

        // Mise à jour de la télémétrie en temps réel
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

        console.log("TARMAK // LYON_HUB // SYSTEM_ONLINE");
    } catch (error) {
        console.error("TARMAK // BOOT_FAILURE:", error);
    }
});