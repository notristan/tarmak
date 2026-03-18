export async function initTicker() {
    console.log("OSINT // TICKER: Connexion au flux d'actualités mondiales en direct...");
    
    const container = document.getElementById('ticker-content');
    if (!container) return;

    try {
        // 🌍 FETCH EN TEMPS RÉEL : On récupère le flux RSS de BBC World News converti en JSON
        // Tu peux remplacer par Al Jazeera : https://www.aljazeera.com/xml/rss/all.xml
        const rssUrl = "http://feeds.bbci.co.uk/news/world/rss.xml";
        const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;
        
        const response = await fetch(apiUrl);
        const data = await response.json();

        if (data.status === 'ok') {
            let html = '';
            
            // On clone les articles pour que l'animation CSS tourne en boucle sans coupure visuelle
            const articles = [...data.items, ...data.items];

            articles.forEach(item => {
                // Pour garder le style "Marché prédictif" de tes captures Polyglobe, 
                // on génère un faux indice de volatilité basé sur la donnée (en attendant de brancher la vraie API Polymarket si tu le souhaites un jour)
                const hash = item.title.length; 
                const prob = (hash % 60) + 30; // Chiffre entre 30 et 90
                
                let colorClass = 'prob-high';
                if (prob < 50) colorClass = 'prob-low';
                else if (prob < 80) colorClass = 'prob-med';

                let trendIcon = prob % 2 === 0 ? '▲' : '▼';

                // On nettoie le titre de l'article pour un affichage "Terminal"
                const cleanTitle = item.title.toUpperCase().replace(/[^A-Z0-9 \-:/]/g, '');

                html += `
                    <div class="ticker-item">
                        <span>${cleanTitle}</span>
                        <span class="ticker-prob ${colorClass}">
                            VOL: ${prob} <span style="font-size:8px;">${trendIcon}</span>
                        </span>
                    </div>
                `;
            });

            container.innerHTML = html;
            console.log(`OSINT // TICKER: ${data.items.length} titres d'actualité chargés.`);
        }
    } catch (error) {
        console.error("OSINT // TICKER ERREUR: Impossible de récupérer le flux mondial.", error);
        container.innerHTML = `<div class="ticker-item"><span style="color:red;">ERREUR DE CONNEXION AU FLUX D'ACTUALITÉS</span></div>`;
    }
}