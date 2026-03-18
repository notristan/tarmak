import * as Cesium from 'cesium';

let bordersDataSource = null;

export async function loadBorders(viewer) {
    console.log("OSINT // GEO_POLITICAL: Extraction du maillage frontalier (Mode Lignes Flottantes)...");

    if (bordersDataSource) {
        viewer.dataSources.remove(bordersDataSource);
    }

    const geojsonUrl = "https://raw.githubusercontent.com/martynafford/natural-earth-geojson/master/110m/cultural/ne_110m_admin_0_countries.json";

    try {
        bordersDataSource = await Cesium.GeoJsonDataSource.load(geojsonUrl, {
            // On configure la source pour qu'elle soit invisible par défaut
            stroke: Cesium.Color.TRANSPARENT,
            fill: Cesium.Color.TRANSPARENT
        });

        // 💥 LE FIX MAGIQUE : On force l'altitude pour chaque pays
        const entities = bordersDataSource.entities.values;
        for (let i = 0; i < entities.length; i++) {
            const entity = entities[i];

            if (entity.polygon) {
                // On fait flotter la ligne à 15km d'altitude (évite le crash du relief 3D)
                entity.polygon.height = 15000; 
                entity.polygon.fill = false; // Pas de remplissage, juste la ligne
                entity.polygon.outline = true;
                entity.polygon.outlineColor = Cesium.Color.CYAN.withAlpha(0.6);
                entity.polygon.outlineWidth = 2;

                // Ajout du nom du pays
                const name = entity.properties.NAME ? entity.properties.NAME.getValue() : "INCONNU";
                entity.label = {
                    text: name.toUpperCase(),
                    font: 'bold 12px monospace',
                    fillColor: Cesium.Color.WHITE,
                    outlineColor: Cesium.Color.BLACK,
                    outlineWidth: 3,
                    style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                    heightReference: Cesium.HeightReference.NONE, 
                    // Visible quand la caméra est entre 2000 km et 15000 km
                    distanceDisplayCondition: new Cesium.DistanceDisplayCondition(2000000, 15000000) 
                };
            }
        }

        viewer.dataSources.add(bordersDataSource);
        console.log(`OSINT // GEO_POLITICAL: Réseau frontalier actif avec Noms de cibles.`);

    } catch (error) {
        console.error("OSINT // GEO Error: Impossible de charger les frontières.", error);
    }
}

export function clearBorders(viewer) {
    if (bordersDataSource) {
        viewer.dataSources.remove(bordersDataSource);
        bordersDataSource = null;
    }
}