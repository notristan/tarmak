# TARMAK — Spy Satellite Simulator

Real-time geospatial intelligence dashboard built with CesiumJS. Tracks satellites, live flights, maritime traffic, seismic activity, weather, CCTV feeds and OSINT/Telegram signals on an interactive 3D globe.

## Architecture

| Layer | Stack | Hosting |
|---|---|---|
| Frontend | Vite + CesiumJS | Vercel |
| Backend | Express + WebSocket | Render |

**Frontend** → `https://tarmak.vercel.app`  
**Backend** → `https://tarmak-backend.onrender.com`

## Features

- Satellite tracking (TLE via Celestrak)
- ADS-B flight radar (adsb.lol)
- Maritime AIS traffic (AISStream.io WebSocket)
- Seismic monitoring
- Weather overlay
- CCTV feeds (Lyon Metropole)
- SOCMINT — Telegram channel scanner with geolocation
- FLIR / NVG / God's Eye shader modes

## Local development

### Frontend
```bash
npm install
npm run dev
```

### Backend
```bash
cd server
cp .env.example .env   # then fill in your keys
npm install
npm start
```

## Environment variables

### Backend (`server/.env`)
```
AIS_API_KEY=   # https://aisstream.io
PORT=8080
```

> Never commit `.env`. Set variables in the Render dashboard for production.
