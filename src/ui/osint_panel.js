import { loadTraffic, clearTraffic } from '../api/traffic_manager';
import { loadFlights, clearFlights } from '../api/flight_manager'; 
import { loadCCTV, clearCCTV } from '../api/cctv_manager';
import { loadSeismicData, clearSeismic } from '../api/seismic_manager';
import { loadMaritimeTraffic, clearMaritime } from '../api/maritime_manager';
import { loadGPSJamming, clearGPSJamming } from '../api/gpsjam_manager';
import { loadBorders, clearBorders } from '../api/borders_manager';
import { loadWeather, clearWeather } from '../api/weather_manager';
import { loadISS, clearISS } from '../api/iss_manager';
import { loadSocialFeed, clearSocialFeed } from '../api/social_manager';

export function initOSINTPanel(viewer) {
    const toggles = {
        sat: document.getElementById('toggle-satellites'),
        air: document.getElementById('toggle-flights'),
        road: document.getElementById('toggle-traffic'),
        cctv: document.getElementById('toggle-cctv'),
        maritime: document.getElementById('toggle-maritime'),
        weather: document.getElementById('toggle-weather'),
        seismic: document.getElementById('toggle-seismic'),
        // Nouveaux sélecteurs ajoutés ici
        gpsjam: document.getElementById('toggle-gpsjam'),
        borders: document.getElementById('toggle-borders'),
        iss: document.getElementById('toggle-iss'),
        social: document.getElementById('toggle-social')
    };

    // 1. SATELLITES (Orbital Tracking)
    if (toggles.sat) {
        toggles.sat.addEventListener('change', (e) => {
            viewer.entities.values.forEach(entity => {
                const id = entity.id || "";
                if (id.startsWith('SAT-')) entity.show = e.target.checked;
            });
        });
    }

    // 2. TRAFIC ROUTIER (Ground Flow)
    if (toggles.road) {
        toggles.road.addEventListener('change', (e) => {
            if (e.target.checked) loadTraffic(viewer); else clearTraffic(viewer);
        });
    }

    // 3. VOLS (Air Traffic Hybrid)
    if (toggles.air) {
        toggles.air.addEventListener('change', (e) => {
            if (e.target.checked) loadFlights(viewer); else clearFlights(viewer);
        });
    }

    // 4. CCTV NODES (Tactical Intelligence)
    if (toggles.cctv) {
        toggles.cctv.addEventListener('change', (e) => {
            if (e.target.checked) {
                loadCCTV(viewer);
            } else {
                clearCCTV(viewer);
                const panel = document.getElementById('cctv-control-panel');
                if (panel) panel.style.display = 'none';
            }
        });
    }

    // 5. MARITIME TRAFFIC (AIS)
    if (toggles.maritime) {
        toggles.maritime.addEventListener('change', (e) => {
            if (e.target.checked) loadMaritimeTraffic(viewer); else clearMaritime(viewer);
        });
    }

    // 6. ATMOSPHERIC DATA (Weather Layers)
    if (toggles.weather) {
        toggles.weather.addEventListener('change', (e) => {
            if (e.target.checked) loadWeather(viewer); else clearWeather(viewer);
        });
    }

    // 7. SEISMIC ACTIVITY (USGS Global)
    if (toggles.seismic) {
        toggles.seismic.addEventListener('change', (e) => {
            if (e.target.checked) loadSeismicData(viewer); else clearSeismic(viewer);
        });
    }

    // 8. GNSS JAMMING (Electronic Warfare)
    if (toggles.gpsjam) {
        toggles.gpsjam.addEventListener('change', (e) => {
            if (e.target.checked) loadGPSJamming(viewer); else clearGPSJamming(viewer);
        });
    }

    // 9. COUNTRY BORDERS (Geo-Political)
    if (toggles.borders) {
        toggles.borders.addEventListener('change', (e) => {
            if (e.target.checked) loadBorders(viewer); else clearBorders(viewer);
        });
    }
    // 10. STATION SPATIALE INTERNATIONALE (ISS Live)
    if (toggles.iss) {
        toggles.iss.addEventListener('change', (e) => {
            if (e.target.checked) loadISS(viewer); else clearISS(viewer);
        });
    }
    // 11. SOCIAL OSINT (Telegram Mock)
    if (toggles.social) {
        toggles.social.addEventListener('change', (e) => {
            if (e.target.checked) loadSocialFeed(viewer); else clearSocialFeed(viewer);
        });
    }
}