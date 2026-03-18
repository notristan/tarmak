import * as satellite from 'satellite.js';
import * as Cesium from 'cesium';
// 📡 IMPORTATION DE LA CONFIGURATION DYNAMIQUE
import { TARMAK_CONFIG } from '../main.js';

let satEntities = [];

export async function loadSatellites(viewer) {
    console.log(`OSINT // ORBITAL: Synchronisation via Bunker (${TARMAK_CONFIG.API_BASE})...`);
    
    try {
        // ✅ PLUS DE PROXY EXTERNE : On tape directement sur ton serveur Render
        const target = `${TARMAK_CONFIG.API_BASE}/satellites-tle`;
        
        const response = await fetch(target);
        
        if (!response.ok) throw new Error(`Signal satellite perdu via Relai: ${response.status}`);
        
        const rawTle = await response.text();
        const lines = rawTle.split('\n').filter(l => l.trim().length > 0);

        satEntities.forEach(e => viewer.entities.remove(e));
        satEntities = [];

        // Traitement des données TLE (identique)
        for (let i = 0; i < 1800; i += 3) { 
            if (!lines[i]) continue;
            const name = lines[i].trim();
            createSatelliteEntity(viewer, name, lines[i+1], lines[i+2]);
        }
        console.log(`OSINT // Orbital Tracking: ${satEntities.length} systèmes modélisés.`);
    } catch (err) { 
        console.error("🚨 OSINT // SAT_RELAY_ERROR:", err.message); 
    }
}

function createSatelliteEntity(viewer, name, tle1, tle2) {
    const position = new Cesium.SampledPositionProperty();
    const now = viewer.clock.currentTime;
    
    // 🌍 MAGIE ORBITALE : On calcule la position sur une fenêtre de 100 minutes (1 orbite LEO classique)
    // On fait des sauts de 3 minutes pour ne pas surcharger le processeur
    for (let i = -50; i <= 50; i += 3) {
        const time = Cesium.JulianDate.addMinutes(now, i, new Cesium.JulianDate());
        const pos = calculatePos(tle1, tle2, Cesium.JulianDate.toDate(time));
        if (pos) position.addSample(time, pos);
    }

    // Permet à la timeline de deviner la suite si tu sors de la fenêtre des 100 min
    position.forwardExtrapolationType = Cesium.ExtrapolationType.EXTRAPOLATE;
    position.backwardExtrapolationType = Cesium.ExtrapolationType.EXTRAPOLATE;

    const entity = viewer.entities.add({
        id: `SAT-${name.replace(/\s+/g, '_')}-${Math.random().toString(36).substr(2, 5)}`, 
        name: name,
        position: position,
        point: { 
            pixelSize: 4, 
            color: Cesium.Color.DEEPSKYBLUE,
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 1
        },
        label: { 
            text: name, 
            font: '9px Monaco', 
            fillColor: Cesium.Color.DEEPSKYBLUE, 
            showBackground: true,
            backgroundColor: new Cesium.Color(0, 0, 0, 0.7),
            pixelOffset: new Cesium.Cartesian2(0, -15),
            distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 15000000) 
        },
        // 💫 LA TRAJECTOIRE DE L'ORBITE
        path: {
            show: true,
            width: 1,
            material: new Cesium.PolylineGlowMaterialProperty({ 
                glowPower: 0.1, 
                color: Cesium.Color.DEEPSKYBLUE.withAlpha(0.4) 
            }),
            leadTime: 3000, // Trace la ligne 50 minutes en avant
            trailTime: 3000 // Trace la ligne 50 minutes en arrière
        }
    });
    satEntities.push(entity);
}

function calculatePos(tle1, tle2, date) {
    try {
        const satrec = satellite.twoline2satrec(tle1, tle2);
        const posVel = satellite.propagate(satrec, date);
        const gmst = satellite.gstime(date);
        if (!posVel.position) return undefined;
        const gd = satellite.eciToGeodetic(posVel.position, gmst);
        return Cesium.Cartesian3.fromRadians(gd.longitude, gd.latitude, gd.height * 1000);
    } catch (e) { return undefined; }
}

export function clearSatellites(viewer) {
    satEntities.forEach(e => viewer.entities.remove(e));
    satEntities = [];
}