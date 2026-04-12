import * as Cesium from 'cesium';

let jamEntities = [];

const THEATERS = {
    'MIDDLE_EAST': { lat: 31.5, lon: 66.4, name: "MOYEN-ORIENT" },
    'EASTERN_EUROPE': { lat: 48.3, lon: 31.1, name: "UKRAINE / RUS" },
    'BALTIC_SEA': { lat: 56.0, lon: 19.0, name: "MER BALTIQUE" }
};

export function loadGPSJamming(viewer) {
    console.log("OSINT // EW_WARFARE: Interface de ciblage GNSS activée.");
    showJammingMenu(viewer);
}

function showJammingMenu(viewer) {
    let panel = document.getElementById('tarmak-ew-panel');
    
    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'tarmak-ew-panel';
        panel.style.position = 'absolute';
        panel.style.top = '30px';
        panel.style.left = '300px'; 
        panel.style.width = '240px';
        panel.style.background = 'rgba(15, 5, 0, 0.8)';
        panel.style.backdropFilter = 'blur(10px)';
        panel.style.border = '1px solid rgba(255, 152, 0, 0.4)';
        panel.style.borderRadius = '8px';
        panel.style.padding = '15px';
        panel.style.fontFamily = 'monospace';
        panel.style.zIndex = '9999';
        document.body.appendChild(panel);
    }

    const btnStyle = "background: #080808; border: 1px solid #ff9800; color: #ff9800; font-family: monospace; font-size: 10px; padding: 8px; margin-bottom: 8px; width: 100%; cursor: pointer; text-align: left; transition: 0.2s;";

    let buttonsHtml = '';
    for (const [key, data] of Object.entries(THEATERS)) {
        buttonsHtml += `<button class="ew-target-btn" data-region="${key}" style="${btnStyle}" onmouseover="this.style.background='#ff9800'; this.style.color='#000';" onmouseout="this.style.background='#080808'; this.style.color='#ff9800';">[ ] ${data.name}</button>`;
    }

    panel.innerHTML = `
        <h3 style="margin-top: 0; color: #ff9800; border-bottom: 1px dashed rgba(255, 152, 0, 0.4); padding-bottom: 8px; font-size: 14px; letter-spacing: 2px;">EW COMMAND</h3>
        
        <p style="color: #888; font-size: 10px; margin-bottom: 5px;">CIBLAGE MANUEL :</p>
        <div style="display: flex; gap: 5px; margin-bottom: 15px;">
            <input type="text" id="ew-search-input" placeholder="Lieu cible..." style="width: 100%; background: #000; border: 1px solid #ff9800; color: #ff9800; font-family: monospace; padding: 5px; font-size: 10px;">
            <button id="ew-search-btn" style="background: #ff9800; border: none; color: #000; font-weight: bold; cursor: pointer; padding: 5px 10px;">GO</button>
        </div>

        <p style="color: #888; font-size: 10px; margin-bottom: 5px;">ZONES CHAUDES :</p>
        ${buttonsHtml}
    `;
    panel.style.display = 'block';

    const buttons = panel.querySelectorAll('.ew-target-btn');
    buttons.forEach(btn => {
        btn.onclick = () => deployHexGrid(viewer, THEATERS[btn.getAttribute('data-region')]);
    });

    document.getElementById('ew-search-btn').onclick = async () => {
        const query = document.getElementById('ew-search-input').value;
        if (!query) return;
        
        document.getElementById('ew-search-btn').innerText = "...";
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`);
            const data = await res.json();
            
            if (data && data.length > 0) {
                const lat = parseFloat(data[0].lat);
                const lon = parseFloat(data[0].lon);
                deployHexGrid(viewer, { lat, lon, name: query.toUpperCase() });
            } else {
                alert("OSINT // Cible géographique introuvable.");
            }
        } catch (e) {
            console.error("Erreur Geocoding:", e);
        }
        document.getElementById('ew-search-btn').innerText = "GO";
    };
}

function deployHexGrid(viewer, region) {
    jamEntities.forEach(e => viewer.entities.remove(e));
    jamEntities = [];

    const { lat: baseLat, lon: baseLon } = region;
    
    const radius = 0.25; 
    const rowSpacing = radius * 1.5;
    const colSpacing = radius * Math.sqrt(3);

    for (let row = -15; row <= 15; row++) {
        for (let col = -15; col <= 15; col++) {
            
            const isOffset = Math.abs(row % 2) === 1;
            const centerLat = baseLat + row * rowSpacing;
            const centerLon = baseLon + col * colSpacing + (isOffset ? colSpacing / 2 : 0);
            
            const distanceFromCenter = Math.sqrt(Math.pow(row, 2) + Math.pow(col, 2));
            const jamProbability = 1 - (distanceFromCenter / 12); 
            
            const noise = Math.random();
            if (noise > jamProbability) continue;

            const isHighJamming = Math.random() < 0.35; 
            // Couleur bien opaque pour être sûr de la voir !
            const fillColor = isHighJamming ? Cesium.Color.RED.withAlpha(0.6) : Cesium.Color.YELLOW.withAlpha(0.6);

            const entity = viewer.entities.add({
                polygon: {
                    hierarchy: Cesium.Cartesian3.fromDegreesArray(computeHexagon(centerLat, centerLon, radius * 0.95)),
                    material: fillColor,
                    outline: true,
                    outlineColor: Cesium.Color.BLACK.withAlpha(0.5),
                    // ALTITUDE FORCÉE : Évite tous les bugs avec le sol !
                    height: 15000 
                }
            });
            jamEntities.push(entity);
        }
    }

    viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(baseLon, baseLat - 5, 2500000), 
        orientation: {
            heading: Cesium.Math.toRadians(0),
            pitch: Cesium.Math.toRadians(-60),
            roll: 0.0
        },
        duration: 2.0
    });
}

function computeHexagon(lat, lon, radius) {
    const positions = [];
    for (let i = 0; i < 6; i++) {
        const angle = Cesium.Math.toRadians(60 * i + 30);
        const x = lon + radius * Math.cos(angle);
        const y = lat + radius * Math.sin(angle);
        positions.push(x, y);
    }
    return positions;
}

export function clearGPSJamming(viewer) {
    jamEntities.forEach(e => viewer.entities.remove(e));
    jamEntities = [];
    
    const panel = document.getElementById('tarmak-ew-panel');
    if (panel) panel.style.display = 'none';
}