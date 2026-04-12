import * as Cesium from 'cesium';
import "cesium/Build/Cesium/Widgets/widgets.css";

export const initEngine = async (containerId) => {
    // 1. Initialisation du Viewer avec les ressources Cesium gratuites
    const viewer = new Cesium.Viewer(containerId, {
        // On utilise le terrain mondial par défaut de Cesium
        terrainProvider: await Cesium.createWorldTerrainAsync(),
        baseLayerPicker: false,
        geocoder: true,
        // ==========================================
        // ⏱️ MACHINE À REMONTER LE TEMPS ACTIVÉE
        // ==========================================
        timeline: true,
        animation: true,
        sceneModePicker: true,
        selectionIndicator: false,
        infoBox: false,
    });

    // 2. CHARGEMENT DES BÂTIMENTS 3D (OpenStreetMap - GRATUIT)
    try {
        const buildings = await Cesium.createOsmBuildingsAsync();
        viewer.scene.primitives.add(buildings);
        
        // On force un gris neutre pour que tes Shaders (FLIR, NVG) 
        // fonctionnent sans être pollués par des textures couleurs.
        buildings.style = new Cesium.Cesium3DTileStyle({
            color: 'color("rgba(180, 180, 180, 0.9)")',
            show: true
        });

        console.log("TARMAK: OSM 3D Buildings actifs (Flux gratuit)");
    } catch (error) {
        console.error("Erreur de chargement des bâtiments :", error);
    }

    // 3. CONFIGURATION DE LA CAMÉRA TACTIQUE
    const scene = viewer.scene;
    scene.screenSpaceCameraController.enableTilt = true;
    scene.screenSpaceCameraController.enableRotate = true;
    
    // Inertie pour le côté "drone de surveillance"
    scene.screenSpaceCameraController.inertiaSpin = 0.85;

    // 4. RENDU "GOD'S EYE" DE BASE
    // Ciel noir pour faire ressortir les satellites oranges
    scene.skyAtmosphere.show = false;
    scene.globe.enableLighting = true; 

    // Vue de départ sur New York
    viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(-74.006, 40.7128, 4000),
        orientation: {
            heading: Cesium.Math.toRadians(0.0),
            pitch: Cesium.Math.toRadians(-45.0),
            roll: 0.0
        }
    });

    // ==========================================
    // ⏱️ CONFIGURATION DE L'HORLOGE (BUFFER REPLAY)
    // ==========================================
    const clock = viewer.clock;
    // On autorise un retour en arrière de 24 heures
    clock.startTime = Cesium.JulianDate.addDays(Cesium.JulianDate.now(), -1, new Cesium.JulianDate());
    // On autorise une projection dans le futur (prédiction) de 2 heures
    clock.stopTime = Cesium.JulianDate.addDays(Cesium.JulianDate.now(), 0.1, new Cesium.JulianDate());
    clock.currentTime = Cesium.JulianDate.now();
    clock.clockRange = Cesium.ClockRange.UNBOUNDED; 
    clock.multiplier = 1.0; // Vitesse d'écoulement du temps (x1)
    clock.shouldAnimate = true;

    return viewer;
};