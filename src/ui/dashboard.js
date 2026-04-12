// src/ui/dashboard.js

export function initDashboard(viewer) {
    console.log("TARMAK Dashboard // Initializing OSINT Interface...");

    // 1. Gestion des Shaders
    const shaderButtons = document.querySelectorAll('.shader-btn');
    shaderButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const shaderType = btn.getAttribute('data-shader');
            updateShaderPipeline(viewer, shaderType);
            
            // UI Update
            shaderButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });

    // 2. Télémétrie en temps réel
    viewer.scene.postRender.addEventListener(() => {
        const camera = viewer.camera;
        const cartographic = camera.positionCartographic;
        
        document.getElementById('val-lat').innerText = Cesium.Math.toDegrees(cartographic.latitude).toFixed(4);
        document.getElementById('val-lon').innerText = Cesium.Math.toDegrees(cartographic.longitude).toFixed(4);
        document.getElementById('val-alt').innerText = (cartographic.height / 1000).toFixed(1) + "KM";
    });
}

function updateShaderPipeline(viewer, type) {
    // Ici, nous activerons les PostProcessStages définis dans engine.js
    console.log(`Switching to Shader: ${type}`);
}