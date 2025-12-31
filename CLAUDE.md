# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A React-based web application that finds nearby gas stations in South Korea and calculates cost-efficiency including travel costs. Uses the Opinet API (Korea Petroleum Quality & Distribution Authority) for real-time fuel price data.

## Development Commands

### Frontend (React)
- `npm start` - Start development server on http://localhost:3000
- `npm run build` - Build production bundle
- `npm test` - Run tests in watch mode

### Backend (Express Proxy Server)
- `cd server && node server.js` - Start backend proxy server on http://localhost:3001
- Backend must be running for API calls to work (falls back to mock data if unavailable)

## Architecture

### Two-Server Setup
The application uses a client-server architecture to handle API keys securely:

1. **Frontend (React)**: Single-page application that handles UI and user interactions
2. **Backend (Express)**: Proxy server that makes Opinet API calls and handles coordinate transformations

### Key Technical Components

**Coordinate System Handling**
- Frontend uses WGS84 coordinates (standard GPS format)
- Backend converts WGS84 → EPSG:5181 (TM 중부원점/Korea 2000 Central Belt) using proj4
- Opinet API requires EPSG:5181 coordinates for accurate results
- Kakao Maps API (loaded in public/index.html) provides geocoding and address search

**External APIs**
- Opinet API: Fuel price data (requires API key in server/.env)
- Kakao Maps SDK: Geocoding service to convert addresses to coordinates
- Daum Postcode: Address search UI (loaded via CDN in public/index.html)

**Data Flow**
1. User enters address → Daum Postcode API provides address selection
2. Address → Kakao Geocoding API converts to WGS84 coordinates (lat/lng)
3. WGS84 coordinates → Backend server converts to EPSG:5181 using proj4
4. Backend calls Opinet API with EPSG:5181 coordinates and radius
5. Response parsed and displayed with cost-efficiency calculations

### Main Application Logic (src/App.js)

**State Management**
- `stations`: Array of nearby gas stations with price/distance data
- `coordinates`: Current search location (WGS84 lat/lng)
- `radius`: Search radius in kilometers (0.5-10km range)
- `sortMode`: Display sorting ('price', 'distance', or 'efficiency')
- `refuelAmount`: Expected refuel volume in liters (used for savings calculation)

**Core Functions**
- `fetchNearbyStations(lat, lng, radius)`: Calls backend API, returns empty array on failure
- `addressToCoordinates(address)`: Uses Kakao Geocoder to convert address to WGS84
- `calculateSavings(stationPrice, avgPrice, distance, refuelAmount)`: Computes net savings accounting for travel cost (assumes 12km/L fuel efficiency, round-trip)
- `openAddressSearch()`: Opens Daum Postcode UI for address selection

## Environment Setup

Backend requires `.env` file in `/server` directory:
```
OPINET_API_KEY=your_api_key_here
```

Get an API key from: https://www.opinet.co.kr/

## Important Notes

- Korean language UI (all text in Korean)
- Backend server must run on port 3001 (hardcoded in src/App.js:6)
- Inline styles used throughout (no separate CSS files except src/index.css)
- Kakao Maps API key is embedded in public/index.html:17 (not secure - should be moved to backend)
- Currency calculations in Korean Won (₩)
- Distance in kilometers, fuel in liters
