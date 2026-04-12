import * as Cesium from 'cesium';

export function initShaderBar(viewer) {
    const shaderButtons = document.querySelectorAll('.shader-btn');
    
    // Initialisation de la collection complète des spectres
    const stages = {
        crt: createCRTStage(),
        nvg: createNVGStage(),
        flir: createFLIRStage(),
        anime: createAnimeStage(),
        noir: createNoirStage(),
        snow: createSnowStage()
    };

    // Injection dans le moteur de rendu (désactivés par défaut)
    Object.values(stages).forEach(stage => {
        viewer.scene.postProcessStages.add(stage);
        stage.enabled = false;
    });

    shaderButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const selected = btn.getAttribute('data-shader');
            
            // UI Update
            shaderButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // LOGIQUE DE COMMUTATION
            // Si 'normal' est sélectionné, on désactive tout.
            // Sinon, on n'active que le stage correspondant.
            Object.keys(stages).forEach(key => {
                stages[key].enabled = (key === selected);
            });
            
            console.log(`TARMAK // Spectrum: ${selected ? selected.toUpperCase() : 'NORMAL'}`);
        });
    });
}

// --- SHADERS TACTIQUES ---

function createNVGStage() {
    return new Cesium.PostProcessStage({
        name: 'nvg',
        fragmentShader: `
            uniform sampler2D colorTexture;
            in vec2 v_textureCoordinates;
            void main() {
                vec4 color = texture(colorTexture, v_textureCoordinates);
                float lum = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
                out_FragColor = vec4(0.0, lum * 1.8, 0.0, 1.0); // Boost vert
            }
        `
    });
}

function createFLIRStage() {
    return new Cesium.PostProcessStage({
        name: 'flir',
        fragmentShader: `
            uniform sampler2D colorTexture;
            in vec2 v_textureCoordinates;
            void main() {
                vec4 color = texture(colorTexture, v_textureCoordinates);
                float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
                // Look thermique "White Hot" (Inversion pour isoler les signatures)
                out_FragColor = vec4(vec3(gray * 1.2), 1.0);
            }
        `
    });
}

function createCRTStage() {
    return new Cesium.PostProcessStage({
        name: 'crt',
        fragmentShader: `
            uniform sampler2D colorTexture;
            in vec2 v_textureCoordinates;
            void main() {
                vec4 color = texture(colorTexture, v_textureCoordinates);
                // Scanlines dynamiques basées sur la coordonnée Y
                float scanline = sin(v_textureCoordinates.y * 1200.0) * 0.08;
                out_FragColor = color + scanline;
            }
        `
    });
}

function createAnimeStage() {
    return new Cesium.PostProcessStage({
        name: 'anime',
        fragmentShader: `
            uniform sampler2D colorTexture;
            in vec2 v_textureCoordinates;
            void main() {
                vec4 color = texture(colorTexture, v_textureCoordinates);
                // Cel-shading (Postérisation Ghibli-style)
                vec3 posterized = floor(color.rgb * 5.0) / 5.0;
                out_FragColor = vec4(posterized, 1.0);
            }
        `
    });
}

function createNoirStage() {
    return new Cesium.PostProcessStage({
        name: 'noir',
        fragmentShader: `
            uniform sampler2D colorTexture;
            in vec2 v_textureCoordinates;
            void main() {
                vec4 color = texture(colorTexture, v_textureCoordinates);
                float gray = dot(color.rgb, vec3(0.3, 0.59, 0.11));
                // Augmentation du contraste pour le mode Noir
                float contrast = 1.2;
                vec3 final = vec3(pow(gray, contrast));
                out_FragColor = vec4(final, 1.0);
            }
        `
    });
}

function createSnowStage() {
    return new Cesium.PostProcessStage({
        name: 'snow',
        fragmentShader: `
            uniform sampler2D colorTexture;
            in vec2 v_textureCoordinates;
            // Fonction de bruit pseudo-aléatoire
            float noise(vec2 co){
                return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
            }
            void main() {
                vec4 color = texture(colorTexture, v_textureCoordinates);
                float grain = noise(v_textureCoordinates) * 0.15;
                out_FragColor = color + grain; // Ajoute du grain type neige/interférences
            }
        `
    });
}