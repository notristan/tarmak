import * as Cesium from 'cesium';

let weatherEntities = [];

// Liste de "Noeuds Stratégiques" (Strategic Nodes) à surveiller
const STRATEGIC_NODES = [
    { name: "LYON_HUB", lat: 45.75, lon: 4.85 },
    { name: "PARIS_HQ", lat: 48.85, lon: 2.35 },
    { name: "LONDON_TOC", lat: 51.50, lon: -0.12 },
    { name: "NEW_YORK_COM", lat: 40.71, lon: -74.00 },
    { name: "DUBAI_BASE", lat: 25.20, lon: 55.27 },
    { name: "TOKYO_LINK", lat: 35.67, lon: 139.65 },
    { name: "ORMUZ_STRAIT", lat: 26.56, lon: 56.24 } // Détroit d'Ormuz (Tactique)
];

export async function loadWeather(viewer) {
    console.log("OSINT // WEATHER: Connexion au réseau atmosphérique (Open-Meteo)...");

    // On prépare les coordonnées par lots pour l'API
    const lats = STRATEGIC_NODES.map(n => n.lat).join(',');
    const lons = STRATEGIC_NODES.map(n => n.lon).join(',');

    // API Open-Meteo (Gratuite, sans clé)
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}&current_weather=true&windspeed_unit=kn`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        clearWeather(viewer);

        // Open-Meteo renvoie un tableau si on demande plusieurs lieux
        const results = Array.isArray(data) ? data : [data];

        results.forEach((nodeData, index) => {
            const node = STRATEGIC_NODES[index];
            const current = nodeData.current_weather;
            
            if (!current) return;

            // Dessin du vecteur de vent (Trajectoire de l'air)
            const windSpeed = current.windspeed; // en Noeuds
            const windDir = current.winddirection; // en Degrés
            const temp = current.temperature;

            // Point de départ (la ville)
            const origin = Cesium.Cartesian3.fromDegrees(node.lon, node.lat, 1000); // À 1km d'altitude
            
            // Calcul du point d'arrivée de la flèche (plus le vent est fort, plus la flèche est longue)
            const length = windSpeed * 2000; // Multiplicateur visuel
            const hRad = Cesium.Math.toRadians(windDir);
            const direction = new Cesium.Cartesian3(Math.sin(hRad), Math.cos(hRad), 0);
            
            const endpoint = new Cesium.Cartesian3();
            Cesium.Cartesian3.add(origin, Cesium.Cartesian3.multiplyByScalar(direction, length, new Cesium.Cartesian3()), endpoint);

            // Couleur selon la température (froid = bleu, chaud = rouge)
            let color = Cesium.Color.YELLOW;
            if (temp < 5) color = Cesium.Color.CYAN;
            if (temp > 25) color = Cesium.Color.ORANGERED;

            const entity = viewer.entities.add({
                id: `WX-${node.name}`,
                name: `ATMOS_DATA: ${node.name}`,
                position: origin,
                point: {
                    pixelSize: 6,
                    color: color,
                    outlineColor: Cesium.Color.BLACK,
                    outlineWidth: 2
                },
                label: {
                    text: `${node.name}\n${temp}°C | ${windSpeed}kts`,
                    font: '11px monospace',
                    fillColor: color,
                    showBackground: true,
                    backgroundColor: new Cesium.Color(0, 0, 0, 0.7),
                    pixelOffset: new Cesium.Cartesian2(0, -25),
                    distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 5000000)
                },
                // La flèche dynamique pour le vent
                polyline: {
                    positions: [origin, endpoint],
                    width: 5,
                    material: new Cesium.PolylineArrowMaterialProperty(color.withAlpha(0.8))
                }
            });

            weatherEntities.push(entity);
        });

        console.log(`OSINT // WEATHER: Données intégrées pour ${results.length} noeuds stratégiques.`);

    } catch (error) {
        console.error("OSINT // WEATHER Error:", error);
    }
}

export function clearWeather(viewer) {
    weatherEntities.forEach(e => viewer.entities.remove(e));
    weatherEntities = [];
}