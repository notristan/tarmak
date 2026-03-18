import { WebSocketServer, WebSocket } from 'ws';

const wss = new WebSocketServer({ port: 8080 });
console.log("OSINT // BACKEND: Relai Tactique DÉMARRÉ sur le port 8080.");

wss.on('connection', (localClient) => {
    console.log("OSINT // BACKEND: Navigateur connecté.");
    let aisSocket = null;

    // 📩 ÉCOUTE DES ORDRES DE TARMAK
    localClient.on('message', (message) => {
        try {
            const req = JSON.parse(message);
            
            if (req.type === 'update_bbox' && req.bbox) {
                console.log(`OSINT // BACKEND: Demande de zone reçue. Connexion à AISStream...`);
                
                // 1. Si une ancienne connexion existe, on la ferme proprement
                if (aisSocket && aisSocket.readyState === WebSocket.OPEN) {
                    aisSocket.close();
                }

                // 2. On ouvre une NOUVELLE connexion fraîche pour éviter le timeout
                aisSocket = new WebSocket("wss://stream.aisstream.io/v0/stream");

                aisSocket.on('open', () => {
                    const subscriptionMessage = {
                        APIKey: "0e93bc164fe17cf85fdcbc491c015c0aaa86a039",
                        BoundingBoxes: [req.bbox], 
                        FilterMessageTypes: ["PositionReport"]
                    };
                    aisSocket.send(JSON.stringify(subscriptionMessage));
                    console.log(`OSINT // BACKEND: Radar verrouillé avec succès sur la zone !`);
                });

                aisSocket.on('message', (data) => {
                    if (localClient.readyState === WebSocket.OPEN) {
                        localClient.send(data.toString());
                    }
                });

                aisSocket.on('error', (err) => {
                    console.error("OSINT // BACKEND ERREUR AISStream:", err.message);
                });
            }
        } catch (err) {
            console.error("OSINT // BACKEND: Erreur lors de la réception de la commande.");
        }
    });

    localClient.on('close', () => {
        if (aisSocket && aisSocket.readyState === WebSocket.OPEN) aisSocket.terminate();
        console.log("OSINT // BACKEND: Navigateur déconnecté.");
    });
}); 