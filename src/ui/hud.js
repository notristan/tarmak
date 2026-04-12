// src/ui/hud.js
export function initHUD() {
    // On récupère les éléments du Dashboard que nous avons créés dans l'index.html
    const latEl = document.getElementById('val-lat');
    const lonEl = document.getElementById('val-lon');
    const altEl = document.getElementById('val-alt');

    return {
        update: (lat, lon, alt) => {
            // Mise à jour des spans dans le panneau de droite (Telemetry)
            if (latEl) latEl.innerText = lat.toFixed(4);
            if (lonEl) lonEl.innerText = lon.toFixed(4);
            if (altEl) altEl.innerText = (alt / 1000).toFixed(1) + "KM";
        }
    };
}