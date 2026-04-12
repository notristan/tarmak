import * as Cesium from 'cesium';

let earthquakeEntities = [];

/**
 * Charge et affiche les données sismiques mondiales (USGS)
 * @param {Cesium.Viewer} viewer 
 */
export async function loadSeismicData(viewer) {
    console.log("OSINT // USGS: Analyse de l'activité tectonique en cours...");
    
    // URL du flux GeoJSON Magnitude 2.5+ (Dernières 24h)
    const url = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson";

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Erreur HTTP: ${response.status}`);
        
        const data = await response.json();
        if (!data.features) return;

        // Nettoyage préventif
        clearSeismic(viewer);

        data.features.forEach(feature => {
            const [lon, lat, depth] = feature.geometry.coordinates;
            const props = feature.properties;
            const mag = props.mag;

            // Création d'une entité visuelle proportionnelle à la magnitude
            const entity = viewer.entities.add({
                name: `SÉISME: ${props.place}`,
                position: Cesium.Cartesian3.fromDegrees(lon, lat),
                ellipse: {
                    // Calcul du rayon : magnitude x 25 km pour une visibilité globale
                    semiMinorAxis: mag * 25000,
                    semiMajorAxis: mag * 25000,
                    material: Cesium.Color.RED.withAlpha(0.4),
                    outline: true,
                    outlineColor: Cesium.Color.WHITE,
                    height: 0,
                    heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
                },
                description: `
                    <div style="background: rgba(0, 0, 0, 0.8); padding: 10px; border: 1px solid #00e5ff; font-family: monospace;">
                        <b style="color: #ff3d00;">ALERTE SISMIQUE</b><br/>
                        <hr/>
                        LIEU: ${props.place}<br/>
                        MAGNITUDE: ${mag} MW<br/>
                        PROFONDEUR: ${depth} km<br/>
                        HEURE: ${new Date(props.time).toLocaleString()}<br/>
                        <hr/>
                        <a href="${props.url}" target="_blank" style="color: #00e5ff;">PLUS D'INFOS (USGS)</a>
                    </div>
                `
            });

            earthquakeEntities.push(entity);
        });

        console.log(`OSINT // USGS: ${earthquakeEntities.length} alertes actives sur le globe.`);

    } catch (err) {
        console.error("OSINT // Seismic Manager Fail:", err);
    }
}

/**
 * Supprime toutes les entités sismiques du viewer
 * @param {Cesium.Viewer} viewer 
 */
export function clearSeismic(viewer) {
    earthquakeEntities.forEach(entity => {
        viewer.entities.remove(entity);
    });
    earthquakeEntities = [];
    console.log("OSINT // USGS: Purge des données effectuée.");
}