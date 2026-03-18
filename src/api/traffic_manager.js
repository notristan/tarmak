import * as Cesium from 'cesium';

let vehicles = [];

export async function loadTraffic(viewer) {
    const canvas = viewer.scene.canvas;
    const center = viewer.camera.pickEllipsoid(new Cesium.Cartesian2(canvas.clientWidth / 2, canvas.clientHeight / 2));
    if (!center) return;
    
    const carto = Cesium.Cartographic.fromCartesian(center);
    const delta = 0.005; 
    
    const query = `[out:json];way["highway"~"primary|secondary|tertiary|residential"](${Cesium.Math.toDegrees(carto.latitude)-delta},${Cesium.Math.toDegrees(carto.longitude)-delta},${Cesium.Math.toDegrees(carto.latitude)+delta},${Cesium.Math.toDegrees(carto.longitude)+delta});out geom;`;
    
    try {
        const response = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`);
        
        // SÉCURITÉ : On vérifie si c'est bien du JSON (et pas du HTML d'erreur)
        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
            console.warn("OSINT // Traffic: Le serveur OSM est surchargé. On réessaiera au prochain mouvement.");
            return;
        }

        const data = await response.json();
        if (!data.elements) return;

        clearTraffic(viewer);

        data.elements.forEach(way => {
            if (way.geometry && way.geometry.length > 1) {
                createTacticalVehicle(viewer, way);
            }
        });
    } catch (e) { 
        console.warn("OSINT // OSM : Interruption de flux temporaire."); 
    }
}

// createTacticalVehicle et clearTraffic restent identiques à ta version
function createTacticalVehicle(viewer, way) {
    const coords = way.geometry.map(p => Cesium.Cartesian3.fromDegrees(p.lon, p.lat, 0));
    const speed = 0.02 + Math.random() * 0.04; 
    const startTime = Date.now();

    const positionCallback = new Cesium.CallbackProperty((time, result) => {
        const elapsed = (Date.now() - startTime) * speed;
        const totalSegments = coords.length - 1;
        const t = (elapsed / 1000) % totalSegments;
        const index = Math.floor(t);
        const fraction = t - index;
        return Cesium.Cartesian3.lerp(coords[index], coords[index + 1], fraction, new Cesium.Cartesian3());
    }, false);

    const vehicle = viewer.entities.add({
        id: `VEH-${way.id}`,
        position: positionCallback,
        point: {
            pixelSize: 4,
            color: Cesium.Color.ORANGE, 
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 1,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND 
        },
        label: {
            text: `VEH-${way.id.toString().slice(-4)}`,
            font: '10px Monaco, monospace',
            fillColor: Cesium.Color.ORANGE,
            showBackground: true,
            backgroundColor: new Cesium.Color(0, 0, 0, 0.9),
            pixelOffset: new Cesium.Cartesian2(0, -15),
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 1000)
        }
    });
    vehicles.push(vehicle);
}

export function clearTraffic(viewer) {
    vehicles.forEach(v => viewer.entities.remove(v));
    vehicles = [];
}