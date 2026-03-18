import * as Cesium from 'cesium';

let socialEntities = [];
let clickHandler = null;
let liveInterval = null;
let drawnMsgIds = new Set(); // Empêche de redessiner les vieux messages

export async function loadSocialFeed(viewer) {
    console.log("OSINT // SOCMINT: Connexion au relai Telegram en continu (Port 8083)...");
    clearSocialFeed(viewer);

    const fetchAndDraw = async () => {
        try {
            const response = await fetch('http://localhost:8083/api/socmint');
            const liveData = await response.json();

            liveData.forEach(msg => {
                // Si l'alerte est déjà sur la carte, on passe (évite les doublons)
                if (drawnMsgIds.has(msg.id)) return;
                drawnMsgIds.add(msg.id);

                let baseColor;
                if (msg.severity === "CRITICAL") baseColor = Cesium.Color.RED;
                else if (msg.severity === "WARNING") baseColor = Cesium.Color.ORANGE;
                else baseColor = Cesium.Color.DEEPSKYBLUE;

                // Pulsation radar continue
                const pulsingAlpha = new Cesium.CallbackProperty((time, result) => {
                    const seconds = viewer.clock.currentTime.secondsOfDay;
                    const alpha = 0.5 + Math.sin(seconds * 5) * 0.5;
                    return baseColor.withAlpha(alpha);
                }, false);

                // On donne un ID unique préfixé par 'SOCMINT-' pour que le clic le reconnaisse
                const entityId = `SOCMINT-${msg.id}`;

                const entity = viewer.entities.add({
                    id: entityId,
                    position: Cesium.Cartesian3.fromDegrees(msg.lon, msg.lat, 0),
                    properties: { intel: msg, color: baseColor.toCssColorString() },
                    
                    point: {
                        pixelSize: 6,
                        color: Cesium.Color.WHITE,
                        outlineColor: baseColor,
                        outlineWidth: 2,
                        disableDepthTestDistance: Number.POSITIVE_INFINITY
                    },
                    
                    ellipse: {
                        semiMinorAxis: 15000.0,
                        semiMajorAxis: 15000.0,
                        material: new Cesium.ColorMaterialProperty(pulsingAlpha),
                        outline: true,
                        outlineColor: baseColor,
                        height: 50 
                    }
                });

                // Laser de repérage vertical
                viewer.entities.add({
                    id: `${entityId}-LINE`,
                    polyline: {
                        positions: [
                            Cesium.Cartesian3.fromDegrees(msg.lon, msg.lat, 0),
                            Cesium.Cartesian3.fromDegrees(msg.lon, msg.lat, 800000)
                        ],
                        width: 1,
                        material: new Cesium.PolylineGlowMaterialProperty({
                            glowPower: 0.2,
                            color: baseColor.withAlpha(0.3)
                        })
                    }
                });

                socialEntities.push(entity);
                socialEntities.push(viewer.entities.getById(`${entityId}-LINE`));
            });

        } catch (error) {
            console.error("OSINT // SOCMINT ERREUR: Serveur injoignable. Le relai Node.js est-il lancé ?");
        }
    };

    // 1. Premier chargement immédiat
    await fetchAndDraw();
    
    // 2. Boucle de mise à jour (toutes les 30 secondes) EN CONTINU
    liveInterval = setInterval(fetchAndDraw, 30000);

    // 3. Activation de la zone de clic
    setupSocialClickHandler(viewer);
}

function setupSocialClickHandler(viewer) {
    if (!clickHandler) {
        clickHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
        clickHandler.setInputAction((click) => {
            const picked = viewer.scene.pick(click.position);
            
            // On vérifie que le clic tombe bien sur un objet préfixé "SOCMINT-"
            if (Cesium.defined(picked) && picked.id && picked.id.id && picked.id.id.startsWith('SOCMINT-')) {
                const intel = picked.id.properties.intel.getValue();
                const color = picked.id.properties.color.getValue();
                showSocialPanel(intel, color);
            } else if (!Cesium.defined(picked) || !picked.id || (picked.id.id && !picked.id.id.startsWith('AIR-') && !picked.id.id.startsWith('SHIP-') && !picked.id.id.startsWith('CAM-'))) {
                hideSocialPanel();
            }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    }
}

export function clearSocialFeed(viewer) {
    // Si on décoche la case, on tue la boucle de rafraîchissement
    if (liveInterval) clearInterval(liveInterval);
    
    socialEntities.forEach(e => viewer.entities.remove(e));
    socialEntities = [];
    drawnMsgIds.clear();
    
    if (clickHandler) {
        clickHandler.destroy();
        clickHandler = null;
    }
    hideSocialPanel();
}

// ==========================================
// 📱 INTERFACE UI (Ton Design préservé)
// ==========================================
function showSocialPanel(intel, colorCss) {
    let panel = document.getElementById('tarmak-social-panel');
    
    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'tarmak-social-panel';
        panel.style.position = 'absolute';
        panel.style.top = '100px'; 
        panel.style.left = '50%';
        panel.style.transform = 'translateX(-50%)'; 
        panel.style.width = '350px';
        panel.style.background = 'rgba(15, 15, 20, 0.9)'; 
        panel.style.backdropFilter = 'blur(10px)';
        panel.style.borderRadius = '12px';
        panel.style.padding = '15px';
        panel.style.color = '#eee';
        panel.style.fontFamily = 'sans-serif'; 
        panel.style.zIndex = '9999';
        panel.style.boxShadow = '0 10px 40px rgba(0, 0, 0, 0.8)';
        document.body.appendChild(panel);
    }

    panel.style.border = `1px solid ${colorCss}`;
    panel.style.borderTop = `4px solid ${colorCss}`;

    const date = new Date(intel.timestamp).toLocaleString();

    let mediaHtml = '';
    if (intel.media) {
        mediaHtml = `
            <div style="width: 100%; height: 160px; background: #000; margin-top: 10px; border-radius: 8px; display: flex; align-items: center; justify-content: center; border: 1px solid #333;">
                <span style="color: #666; font-size: 24px;">▶ VIDEO MEDIA</span>
            </div>
        `;
    }

    panel.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
            <div style="display: flex; align-items: center; gap: 10px;">
                <div style="width: 36px; height: 36px; background: #222; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 18px; border: 1px solid #444;">
                    ${intel.avatar}
                </div>
                <div>
                    <div style="font-weight: bold; font-size: 14px; color: #fff;">${intel.author}</div>
                    <div style="color: #888; font-size: 11px; font-family: monospace;">${intel.source}</div>
                </div>
            </div>
            <div style="color: ${colorCss}; font-size: 10px; font-weight: bold; font-family: monospace; padding: 2px 6px; border: 1px solid ${colorCss}; border-radius: 4px;">
                ${intel.severity}
            </div>
        </div>
        
        <div style="font-size: 13px; line-height: 1.5; color: #ddd; margin-bottom: 10px;">
            ${intel.text}
        </div>

        ${mediaHtml}

        <div style="margin-top: 12px; border-top: 1px solid #333; padding-top: 8px; display: flex; justify-content: space-between; color: #666; font-size: 11px; font-family: monospace;">
            <span>${date}</span>
            <span>LAT: ${intel.lat.toFixed(4)} | LON: ${intel.lon.toFixed(4)}</span>
        </div>
    `;
    
    panel.style.display = 'block';
}

export function hideSocialPanel() {
    const panel = document.getElementById('tarmak-social-panel');
    if (panel) panel.style.display = 'none';
}