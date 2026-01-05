# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A React-based web application that finds nearby gas stations in South Korea and calculates cost-efficiency including travel costs. Features include real-time fuel price data from Opinet API, interactive map with route navigation, and responsive design for mobile and desktop.

## Development Commands

### Frontend (React)
- `npm start` - Start development server on http://localhost:3000
- `npm run build` - Build production bundle
- `npm test` - Run tests in watch mode

### Backend (Express Proxy Server)
- `cd server && node server.js` - Start backend proxy server on http://localhost:3001
- Backend must be running for API calls to work (falls back to empty data if unavailable)

## Architecture

### Two-Server Setup
The application uses a client-server architecture to handle API keys securely:

1. **Frontend (React)**: Single-page application that handles UI, user interactions, and map display
2. **Backend (Express)**: Proxy server that makes Opinet/Kakao API calls and handles coordinate transformations

### Key Technical Components

**Coordinate System Handling**
- Frontend uses WGS84 coordinates (standard GPS format)
- Backend converts WGS84 → TM_OPINET (custom Transverse Mercator projection) using proj4
  - TM_OPINET definition: `+proj=tmerc +lat_0=38 +lon_0=128 +k=0.9999 +x_0=400000 +y_0=600000 +ellps=bessel +units=m +towgs84=-115.80,474.99,674.11,1.16,-2.31,-1.63,6.43 +no_defs`
- Opinet API requires TM_OPINET coordinates for accurate results
- Backend performs reverse transformation (TM_OPINET → WGS84) for station coordinates
- Kakao Maps API (loaded in public/index.html) provides geocoding, address search, and map display

**External APIs**
- **Opinet API**: Real-time fuel price data (requires API key in server/.env)
- **Kakao Maps SDK**: Map rendering, geocoding, markers, polylines (loaded via CDN in public/index.html)
- **Kakao Mobility Directions API**: Route calculation with turn-by-turn guidance (requires REST API key)
- **Daum Postcode API**: Address search UI (loaded via CDN in public/index.html)
- **Kakao Reverse Geocoding API**: Converts coordinates to addresses for stations without address data

**Data Flow - Station Search**
1. User enters address → Daum Postcode API provides address selection
2. Address → Kakao Geocoding API converts to WGS84 coordinates (lat/lng)
3. WGS84 coordinates → Backend server converts to TM_OPINET using proj4
4. Backend calls Opinet API with TM_OPINET coordinates and radius (max 5km)
5. Backend converts station coordinates (TM_OPINET → WGS84) for map display
6. Backend performs reverse geocoding for stations without address data (batch processing)
7. Response parsed and displayed with cost-efficiency calculations

**Data Flow - Route Navigation**
1. User clicks station card → `handleStationClick()` triggered
2. Frontend calls backend `/api/route` with origin/destination (lng,lat format)
3. Backend proxies request to Kakao Mobility Directions API
4. Route data returned with polyline coordinates and turn-by-turn guides
5. Frontend draws blue polyline on map using Kakao Maps Polyline API
6. Map auto-fits bounds to show entire route
7. Route panel displays distance, duration, toll, and step-by-step directions

### Main Application Logic (src/App.js)

**State Management**
- `stations`: Array of nearby gas stations (filtered by radius)
- `allStations`: Cache of all stations within 5km (Opinet API max radius)
- `coordinates`: Current search location (WGS84 lat/lng)
- `radius`: Search radius in kilometers (0.5-5km range)
- `sortMode`: Display sorting ('price', 'distance', or 'efficiency')
- `isMobile`: Responsive layout flag (window.innerWidth < 768)
- `sidebarCollapsed`: Desktop sidebar visibility state
- `bottomSheetOpen`: Mobile bottom sheet visibility state
- `selectedStation`: Currently selected station for route navigation
- `routeData`: Route information from Kakao Mobility API
- `showRoutePanel`: Route panel visibility
- `routeLoading`: Route fetch loading state
- `routeError`: Route fetch error message

**Core Functions**
- `fetchNearbyStations(lat, lng, radius)`: Calls backend `/api/stations`, returns empty array on failure
- `addressToCoordinates(address)`: Uses Kakao Geocoder to convert address to WGS84
- `calculateSavings(stationPrice, avgPrice, distance)`: Computes net savings accounting for travel cost (assumes 12km/L fuel efficiency, 40L refuel, round-trip)
- `calculateTravelCost(distance, fuelPrice)`: Calculates round-trip travel cost
- `openAddressSearch()`: Opens Daum Postcode UI for address selection
- `loadStations(lat, lng)`: Fetches stations and updates map (always fetches 5km data)
- `fetchRoute(originLat, originLng, destLat, destLng)`: Calls backend `/api/route` for route data
- `drawRouteOnMap(route)`: Draws blue polyline on Kakao map from route data
- `fitMapToRoute(originLat, originLng, destLat, destLng)`: Adjusts map bounds to show entire route
- `handleStationClick(station)`: Handles station selection and initiates route fetch
- `closeRoutePanel()`: Closes route panel and removes polyline from map
- `getDirectionIcon(type)`: Maps Kakao guide types to emoji icons (⬅️, ➡️, ⬆️, etc.)

**Map Integration (Kakao Maps)**
- Map instance stored in `mapInstanceRef`
- Red marker shows current search location
- Blue circle shows search radius
- Blue markers show gas stations (regular stations)
- Trophy emoji (🏆) shows best station based on current sort mode
- Blue polyline shows route to selected station
- Custom InfoWindows show station details on marker click
- Map supports drag, zoom, and double-click

## Features

### 1. Gas Station Search
- Search by address or current GPS location
- Adjustable search radius (0.5km - 5km)
- Real-time fuel price data from Opinet API
- Automatic reverse geocoding for stations without addresses

### 2. Sorting & Analysis
- **Price**: Lowest fuel price per liter
- **Distance**: Closest gas stations
- **Efficiency**: Best value considering both price and travel cost
- Cost-efficiency analysis: shows refuel savings, travel cost, and net profit

### 3. Interactive Map
- Kakao Maps integration with markers and overlays
- Trophy marker (🏆) highlights best station for current sort mode
- Clickable markers with station details
- Draggable map with zoom controls

### 4. Route Navigation (Car Mode)
- Click any station to see route from current location
- Blue polyline shows route on map
- Route panel displays:
  - Total distance (km)
  - Estimated duration (minutes)
  - Toll fees
  - Step-by-step turn-by-turn directions with emoji icons
- Map auto-fits to show entire route
- Desktop: Centered modal overlay
- Mobile: Bottom sheet

### 5. Responsive Design
- **Desktop**: Collapsible sidebar (450px) + map view
  - Toggle button to collapse/expand sidebar
  - Sticky sidebar with station list
  - Full-screen map on right side
- **Mobile**: Bottom sheet + compact controls
  - Top 3 best stations (price/distance/efficiency) shown on main view
  - "View All" button opens bottom sheet with complete station list
  - Compact address search and radius slider

### 6. Best Station Highlighting
- Automatically identifies best station for each category
- Trophy marker on map
- Blue border on station cards
- Dynamic based on current sort mode

## Environment Setup

Backend requires `.env` file in `/server` directory:
```
OPINET_API_KEY=your_opinet_api_key_here
KAKAO_REST_API_KEY=your_kakao_rest_api_key_here
```

**Getting API Keys:**
- Opinet API: https://www.opinet.co.kr/
- Kakao REST API: https://developers.kakao.com/

## File Structure

```
/src
  App.js              Main React component (2000+ lines)
  index.css           Global styles and animations
  index.js            React entry point

/server
  server.js           Express proxy server
  .env                API keys (not committed to git)

/public
  index.html          HTML template with Kakao Maps SDK and Daum Postcode CDN
```

## API Endpoints (Backend)

### GET `/api/stations`
Query parameters:
- `lat`: Latitude (WGS84)
- `lng`: Longitude (WGS84)
- `radius`: Search radius in km (max 5)

Returns: Array of gas stations with WGS84 coordinates, prices, distances, addresses

### GET `/api/route`
Query parameters:
- `origin`: Origin coordinates in `lng,lat` format
- `destination`: Destination coordinates in `lng,lat` format

Returns: Route data from Kakao Mobility Directions API (routes, sections, roads, guides)

### GET `/health`
Health check endpoint

## Important Notes

- **Korean language UI**: All text in Korean
- **Backend ports**: Backend runs on port 3001, frontend on port 3000
- **Inline styles**: All component styles defined in `styles` object (no separate CSS modules)
- **Kakao Maps API key**: Embedded in public/index.html (loaded via CDN)
- **Currency**: Korean Won (₩)
- **Units**: Distance in kilometers, fuel in liters
- **Fuel efficiency assumption**: 12km/L for travel cost calculations
- **Fixed refuel amount**: 40L for cost-efficiency analysis
- **Opinet API max radius**: 5km (enforced by API)
- **Route mode**: Car only (static route preview, not real-time GPS tracking)
- **Coordinate precision**: Rounded to nearest meter for TM_OPINET coordinates
- **Reverse geocoding**: Batch processing (10 stations at a time) to avoid rate limits

## Performance Optimizations

1. **5km Data Caching**: Always fetch 5km radius data, filter client-side for smaller radii
2. **Batch Reverse Geocoding**: Process 10 stations at a time with parallel requests
3. **Map Marker Optimization**: Only render markers for filtered stations
4. **Responsive Layout Switching**: Complete map reinitialization when switching mobile/desktop
5. **useRef for Map State**: Avoid unnecessary re-renders with map instance refs

## Deployment

- **Frontend**: Deployed to Vercel (auto-deploy on push to main)
- **Backend**: Deployed to Render (auto-deploy on push to main)
- **Environment variables**: Set in Vercel/Render dashboard
- **CORS**: Backend allows all origins (`origin: '*'` in production)

## GitHub Actions Workflows

### Deployment History Tracking
- Location: `.github/workflows/deployment-history.yml`
- Triggers: Push to main branch
- Records to Google Sheets:
  - Date/Time (KST)
  - Commit SHA
  - Full commit message (with bullet points)
  - Author
  - Changed files
  - Deploy status
- Separate sheets for Frontend (Vercel) and Backend (Render)
- Waits for Render deployment completion before recording backend deploys
