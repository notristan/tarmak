import * as Cesium from 'cesium';

let flightEntities = new Map();
let updateInterval = null;
let clickHandler = null;

const flightIconSvg = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23ff6600'%3E%3Cpath d='M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z'/%3E%3C/svg%3E";

export function loadFlights(viewer) {
    console.log("OSINT // AIR_TRAFFIC: Initialisation du radar ADSB.lol...");

    async function fetchFlights() {
        const center = getCameraCenter(viewer);
        
        try {
            // TENTATIVE UNIQUE : ADSB.lol via corsproxy.io
            const radiusNm = 250;
            const targetUrl = `https://api.adsb.lol/v2/lat/${center.lat}/lon/${center.lon}/dist/${radiusNm}`;
            const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;
            
            const response = await fetch(proxyUrl);
            if (!response.ok) throw new Error("ADSB.lol injoignable via Proxy");
            
            const data = await response.json();
            if (data.ac) {
                processFlights(viewer, data.ac);
            }
        } catch (e) {
            console.error("OSINT // Erreur radar ADSB :", e.message);
        }
    }

    fetchFlights();
    updateInterval = setInterval(fetchFlights, 10000);

    // ==========================================
    // 🎯 GESTION DU CLIC & PANNEAU LATÉRAL SUR MESURE
    // ==========================================
    if (!clickHandler) {
        clickHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
        clickHandler.setInputAction((click) => {
            const picked = viewer.scene.pick(click.position);
            
            if (Cesium.defined(picked) && picked.id && picked.id.id && picked.id.id.startsWith('AIR-')) {
                // 1. Verrouiller la caméra
                viewer.trackedEntity = picked.id;
                
                // 2. Récupérer les données stockées dans l'entité et afficher notre panneau perso
                const intelData = picked.id.properties.intel.getValue();
                showCustomIntelPanel(intelData);
                
            } else if (!Cesium.defined(picked) || !picked.id || (picked.id.id && !picked.id.id.startsWith('SHIP-'))) {
                // Si on clique dans le vide : on libère la caméra et on cache le panneau
                viewer.trackedEntity = undefined;
                hideCustomIntelPanel();
            }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    }
}

function processFlights(viewer, aircraftList) {
    const time = viewer.clock.currentTime;

    aircraftList.forEach(ac => {
        const hex = ac.hex;
        if (!ac.lat || !ac.lon || !hex) return;

        const lat = ac.lat;
        const lon = ac.lon;
        const altFt = ac.alt_baro === "ground" ? 0 : ac.alt_baro;
        const altMeters = altFt * 0.3048 || 0;
        const callsign = ac.flight ? ac.flight.trim() : `SQK:${ac.squawk || hex}`;
        const speed = ac.gs || 0;
        const track = ac.track || 0;
        const isMilitary = ac.t === "MIL" || ac.mlat;
        
        // Constitution du paquet de données "INTEL" à sauvegarder dans l'entité
        const intelData = {
            hex: hex,
            callsign: callsign,
            altFt: altFt,
            speed: speed,
            track: track,
            isMilitary: isMilitary,
            reg: ac.r || "N/A",
            type: ac.t || "N/A",
            desc: ac.desc || "N/A",
            squawk: ac.squawk || "N/A",
            vRate: ac.baro_rate || 0,
            owner: ac.ownOp || "INCONNU"
        };

        const pos = Cesium.Cartesian3.fromDegrees(lon, lat, altMeters);
        let entity = flightEntities.get(hex);

        if (!entity) {
            const posProp = new Cesium.SampledPositionProperty();
            posProp.forwardExtrapolationType = Cesium.ExtrapolationType.HOLD;
            posProp.backwardExtrapolationType = Cesium.ExtrapolationType.HOLD;
            posProp.addSample(time, pos);

            entity = viewer.entities.add({
                id: `AIR-${hex}`,
                name: callsign,
                position: posProp,
                // ON STOCKE LES DONNÉES ICI POUR LES RÉCUPÉRER AU CLIC
                properties: { intel: intelData },
                
                label: {
                    text: callsign,
                    font: '11px monospace',
                    fillColor: isMilitary ? Cesium.Color.RED : Cesium.Color.ORANGE,
                    outlineColor: Cesium.Color.BLACK,
                    outlineWidth: 2,
                    style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                    pixelOffset: new Cesium.Cartesian2(0, -20),
                    distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 400000)
                },
                billboard: {
                    image: flightIconSvg,
                    width: 20, height: 20,
                    rotation: Cesium.Math.toRadians(track),
                    heightReference: altMeters < 50 ? Cesium.HeightReference.CLAMP_TO_GROUND : Cesium.HeightReference.NONE,
                    disableDepthTestDistance: Number.POSITIVE_INFINITY
                },
                path: {
                    // AFFICHAGE DIRECT ET PERMANENT DE LA TRAJECTOIRE
                    show: true,
                    resolution: 1,
                    material: new Cesium.PolylineGlowMaterialProperty({ 
                        glowPower: 0.3, color: isMilitary ? Cesium.Color.RED : Cesium.Color.ORANGE 
                    }),
                    width: 2, 
                    leadTime: 0,
                    trailTime: 600 // Traînée de 10 minutes
                }
            });
            flightEntities.set(hex, entity);
        } else {
            entity.position.addSample(time, pos);
            // Mise à jour des données internes en direct
            entity.properties.intel = intelData;
            entity.billboard.rotation = Cesium.Math.toRadians(track);
            
            // Si le panneau est ouvert sur CET avion, on met à jour les stats en direct
            updateCustomIntelPanelIfOpen(hex, intelData);
        }
    });
}

function getCameraCenter(viewer) {
    const windowPosition = new Cesium.Cartesian2(viewer.canvas.clientWidth / 2, viewer.canvas.clientHeight / 2);
    const pickRay = viewer.camera.getPickRay(windowPosition);
    const intersection = viewer.scene.globe.pick(pickRay, viewer.scene);
    if (intersection) {
        const carto = Cesium.Cartographic.fromCartesian(intersection);
        return { lat: Cesium.Math.toDegrees(carto.latitude), lon: Cesium.Math.toDegrees(carto.longitude) };
    }
    const carto = viewer.camera.positionCartographic;
    return { lat: Cesium.Math.toDegrees(carto.latitude), lon: Cesium.Math.toDegrees(carto.longitude) };
}

export function clearFlights(viewer) {
    if (updateInterval) clearInterval(updateInterval);
    flightEntities.forEach(e => viewer.entities.remove(e));
    flightEntities.clear();
    
    if (clickHandler) { clickHandler.destroy(); clickHandler = null; }
    if (viewer.trackedEntity && viewer.trackedEntity.id && viewer.trackedEntity.id.startsWith('AIR-')) viewer.trackedEntity = undefined;
    
    hideCustomIntelPanel();
}

// ==========================================
// 🎨 CRÉATION DU PANNEAU HTML (UI)
// ==========================================
let currentPanelHex = null;

function showCustomIntelPanel(intel) {
    currentPanelHex = intel.hex;
    let panel = document.getElementById('tarmak-air-intel-panel');
    
    // Si le panneau n'existe pas dans la page web, on le crée
    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'tarmak-air-intel-panel';
        // Style "Glassmorphism" positionné en bas à gauche
        panel.style.position = 'absolute';
        panel.style.top = '320px'; // En dessous de ton menu "Data Fusion"
        panel.style.left = '20px';
        panel.style.width = '320px';
        panel.style.background = 'rgba(5, 10, 15, 0.7)';
        panel.style.backdropFilter = 'blur(10px)';
        panel.style.WebkitBackdropFilter = 'blur(10px)';
        panel.style.borderRadius = '8px';
        panel.style.padding = '15px';
        panel.style.color = '#eee';
        panel.style.fontFamily = 'monospace';
        panel.style.fontSize = '12px';
        panel.style.zIndex = '9999';
        panel.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.8)';
        panel.style.pointerEvents = 'none'; // Permet de cliquer à travers
        document.body.appendChild(panel);
    }

    const color = intel.isMilitary ? "#ff0000" : "#ff6600";
    panel.style.border = `1px solid ${color}`;
    
    panel.innerHTML = `
        <h3 style="color: ${color}; margin-top: 0; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px;">AIRCRAFT INTEL: ${intel.callsign}</h3>
        <table style="width: 100%; text-align: left; border-spacing: 0 6px;">
            <tr><th style="color: #888;">REG:</th><td>${intel.reg}</td><th style="color: #888;">HEX:</th><td>${intel.hex}</td></tr>
            <tr><th style="color: #888;">TYPE:</th><td>${intel.type}</td><th style="color: #888;">SQUAWK:</th><td>${intel.squawk}</td></tr>
            <tr><th style="color: #888;">DESC:</th><td colspan="3">${intel.desc}</td></tr>
            <tr><th style="color: #888;">OWNER:</th><td colspan="3" style="color: #fff;">${intel.owner}</td></tr>
            <tr><td colspan="4" style="border-bottom: 1px dashed rgba(255, 255, 255, 0.2); padding-top: 5px;"></td></tr>
            <tr><th style="color: #888; padding-top: 10px;">ALT:</th><td style="padding-top: 10px; color: #fff;">${intel.altFt} ft</td><th style="color: #888; padding-top: 10px;">V.RATE:</th><td style="padding-top: 10px;">${intel.vRate} ft/m</td></tr>
            <tr><th style="color: #888;">SPD:</th><td style="color: #fff;">${intel.speed} kts</td><th style="color: #888;">TRACK:</th><td>${intel.track}°</td></tr>
            <tr><th style="color: #888;">CAT:</th><td colspan="3" style="color: ${intel.isMilitary ? '#ff0000' : '#00ff00'}; font-weight: bold;">${intel.isMilitary ? "MILITARY / ALERT" : "CIVILIAN"}</td></tr>
        </table>
    `;
    panel.style.display = 'block';
}

function updateCustomIntelPanelIfOpen(hex, intelData) {
    if (currentPanelHex === hex) {
        showCustomIntelPanel(intelData); // Rafraîchit les données sans faire clignoter
    }
}

function hideCustomIntelPanel() {
    currentPanelHex = null;
    const panel = document.getElementById('tarmak-air-intel-panel');
    if (panel) panel.style.display = 'none';
}