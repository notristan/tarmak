import * as Cesium from 'cesium';

let issEntity = null;
let issInterval = null;
let clickHandler = null;

// Icône de l'ISS
const issIcon = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23ff003c'%3E%3Cpath d='M22 12l-4-4v2h-4V7h-4v3H6V8L2 12l4 4v-2h4v3h4v-3h4v2l4-4zM8 12H6v-1h2v1zm4 3h-2v-6h2v6zm4-3h-2v-1h2v1z'/%3E%3C/svg%3E";

export async function loadISS(viewer) {
    console.log("OSINT // SPACE_CMD: Acquisition du signal de l'ISS...");

    // On crée l'entité ISS si elle n'existe pas
    if (!issEntity) {
        const posProp = new Cesium.SampledPositionProperty();
        posProp.forwardExtrapolationType = Cesium.ExtrapolationType.EXTRAPOLATE;
        posProp.backwardExtrapolationType = Cesium.ExtrapolationType.EXTRAPOLATE;

        issEntity = viewer.entities.add({
            id: 'ISS-LIVE',
            name: "INTERNATIONAL SPACE STATION",
            position: posProp,
            billboard: {
                image: issIcon,
                width: 32,
                height: 32,
                pixelOffset: new Cesium.Cartesian2(0, 0)
            },
            label: {
                text: "ISS LIVE FEED",
                font: 'bold 11px monospace',
                fillColor: Cesium.Color.RED,
                outlineColor: Cesium.Color.BLACK,
                outlineWidth: 3,
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                pixelOffset: new Cesium.Cartesian2(0, -25)
            },
            path: {
                show: true,
                width: 2,
                material: new Cesium.PolylineGlowMaterialProperty({ 
                    glowPower: 0.2, 
                    color: Cesium.Color.RED 
                }),
                leadTime: 0,
                trailTime: 5400 // Laisse une traînée sur 90 min (1 orbite complète)
            }
        });
    }

    // Boucle de mise à jour (toutes les 4 secondes)
    const updatePosition = async () => {
        try {
            // API Publique WhereTheISS
            const res = await fetch('https://api.wheretheiss.at/v1/satellites/25544');
            const data = await res.json();

            const time = viewer.clock.currentTime;
            const position = Cesium.Cartesian3.fromDegrees(data.longitude, data.latitude, data.altitude * 1000);
            
            issEntity.position.addSample(time, position);
            
            // Stocke les données pour l'UI
            issEntity.properties = {
                lat: data.latitude.toFixed(4),
                lon: data.longitude.toFixed(4),
                alt: data.altitude.toFixed(1),
                vel: data.velocity.toFixed(0)
            };

            // Mise à jour de l'UI si le panneau est ouvert
            updateISSPanelData(issEntity.properties);
        } catch (e) {
            console.error("OSINT // ISS: Perte de télémétrie.");
        }
    };

    updatePosition();
    issInterval = setInterval(updatePosition, 4000);

    // ==========================================
    // 🎯 GESTION DU CLIC (Ouverture Vidéo)
    // ==========================================
    if (!clickHandler) {
        clickHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
        clickHandler.setInputAction((click) => {
            const picked = viewer.scene.pick(click.position);
            
            if (Cesium.defined(picked) && picked.id && picked.id.id === 'ISS-LIVE') {
                viewer.trackedEntity = picked.id;
                showISSPanel(picked.id.properties);
            } else if (!Cesium.defined(picked) || !picked.id || (picked.id.id && !picked.id.id.startsWith('AIR-') && !picked.id.id.startsWith('SHIP-') && !picked.id.id.startsWith('CAM-'))) {
                viewer.trackedEntity = undefined;
                hideISSPanel();
            }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    }
}

// ==========================================
// 📺 CRÉATION DU PANNEAU VIDÉO ISS
// ==========================================
function showISSPanel(data) {
    let panel = document.getElementById('tarmak-iss-panel');
    
    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'tarmak-iss-panel';
        panel.style.position = 'absolute';
        panel.style.top = '30px'; 
        panel.style.right = '300px'; // En haut à droite, à côté de tes stats
        panel.style.width = '380px';
        panel.style.background = 'rgba(10, 0, 0, 0.85)';
        panel.style.backdropFilter = 'blur(10px)';
        panel.style.borderRadius = '8px';
        panel.style.padding = '15px';
        panel.style.color = '#eee';
        panel.style.fontFamily = 'monospace';
        panel.style.fontSize = '12px';
        panel.style.zIndex = '9999';
        panel.style.border = '1px solid #ff003c'; // Bordure Rouge
        panel.style.boxShadow = '0 8px 32px rgba(255, 0, 60, 0.2)';
        document.body.appendChild(panel);

        // L'intégration de la vidéo YouTube de Sen (ID: fO9e9jnhYK8)
        // Les paramètres : autoplay=1 (démarre direct), mute=1 (obligatoire pour l'autoplay), controls=0 (cache l'UI Youtube)
        panel.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255, 0, 60, 0.4); padding-bottom: 8px; margin-bottom: 10px;">
                <h3 style="color: #ff003c; margin: 0; font-size: 14px; letter-spacing: 2px;">LIVE ISS CAM</h3>
                <span style="color: #ff003c; font-size: 9px; animation: blink 1s infinite;">● REC</span>
            </div>
            
            <div style="width: 100%; height: 200px; background: #000; border: 1px solid rgba(255, 255, 255, 0.2); position: relative; overflow: hidden; margin-bottom: 10px;">
                <iframe width="100%" height="150%" src="https://www.youtube.com/embed/fO9e9jnhYK8?autoplay=1&mute=1&controls=0&modestbranding=1" frameborder="0" allow="autoplay; encrypted-media" style="position: absolute; top: -25%; pointer-events: none;"></iframe>
                <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: linear-gradient(to bottom, transparent 50%, rgba(255, 0, 60, 0.05) 51%); background-size: 100% 4px; pointer-events: none;"></div>
            </div>

            <table style="width: 100%; text-align: left; border-spacing: 0 4px; font-size: 11px;">
                <tr><th style="color: #888;">LAT:</th><td id="iss-ui-lat">${data.lat}°</td><th style="color: #888;">ALT:</th><td id="iss-ui-alt">${data.alt} km</td></tr>
                <tr><th style="color: #888;">LON:</th><td id="iss-ui-lon">${data.lon}°</td><th style="color: #888;">SPD:</th><td id="iss-ui-vel">${data.vel} km/h</td></tr>
            </table>
        `;
    }
    
    panel.style.display = 'block';
}

function updateISSPanelData(data) {
    if (document.getElementById('tarmak-iss-panel') && document.getElementById('tarmak-iss-panel').style.display !== 'none') {
        document.getElementById('iss-ui-lat').innerText = `${data.lat}°`;
        document.getElementById('iss-ui-lon').innerText = `${data.lon}°`;
        document.getElementById('iss-ui-alt').innerText = `${data.alt} km`;
        document.getElementById('iss-ui-vel').innerText = `${data.vel} km/h`;
    }
}

export function hideISSPanel() {
    const panel = document.getElementById('tarmak-iss-panel');
    if (panel) panel.style.display = 'none';
}

export function clearISS(viewer) {
    if (issInterval) clearInterval(issInterval);
    if (issEntity) {
        viewer.entities.remove(issEntity);
        issEntity = null;
    }
    hideISSPanel();
}