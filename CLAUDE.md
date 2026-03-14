# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm start           # Run with .env.production config
npm run start:uat   # Run with .env.uat config (local GeoServer)

# Build
npm run build       # Production build
npm run build:uat   # UAT build

# Test
npm test            # Run tests

# Deploy
npm run deploy      # Build and deploy to GitHub Pages
```

## Architecture

This is a **Web GIS application** built with React and OpenLayers that connects to a GeoServer backend. Users authenticate, then view/edit geographic data via WMS (raster tiles) and WFS (vector features) layers.

### Environment-driven routing

`src/App.js` checks `REACT_APP_GEOSERVER_URL` to decide which map interface to render:
- `.env.production` → remote server (`https://163.245.209.231/geoserver`) → `MapPage`
- `.env.uat` → local GeoServer (`http://localhost:8080/geoserver`) → `MapPage1` (Mappls-styled variant)

### Data flow

1. **LoginPage** authenticates against GeoServer REST API using Basic Auth, stores base64 auth token in `localStorage`
2. **MapPage** initializes via three hooks in parallel:
   - `useMapInit` — creates the OpenLayers map, base layers (OSM/Satellite/Toner), right-click context menu, and TerraDraw drawing adapter
   - `useLayerLoader` — fetches WMS/WFS capabilities XML, creates `TileLayer`s for WMS and `VectorLayer`s for WFS, stores WFS metadata (typeName, geometryName, bbox) per layer
   - `useDrawTools` — wraps TerraDraw modes (circle, rectangle, polygon, line, point, freehand)
3. User interactions:
   - **Layer toggle** → `LayerControl` sets OL layer visibility
   - **Map click** → `useFeaturePopup` checks vector features first, then falls back to WMS `GetFeatureInfo`; WFS features can have properties edited and saved via WFS-T Update
   - **WFS edit mode** → `useWfsEdit` activates OL Select/Modify/Snap interactions; supports geometry edits, insert (point click or polyline draw), delete, and save via WFS-T transactions
   - **Search** → `SearchBar` queries Nominatim API, pans/zooms map to result

### Key layers of abstraction

| Layer | File | Responsibility |
|---|---|---|
| Config | `src/config/geoserver.js` | GeoServer URL, auth headers, GML→OL type map |
| API | `src/services/geoserverApi.js` | Fetch/parse WMS & WFS capabilities XML; send WFS-T requests |
| WFS-T builder | `src/utils/wfstBuilder.js` | Build Insert/Update/Delete transaction XML; convert OL geometries to GML |
| Map init | `src/hooks/useMapInit.js` | OL map, base layers, TerraDraw setup |
| Layer loading | `src/hooks/useLayerLoader.js` | WMS TileLayers + WFS VectorLayers from capabilities |
| Draw tools | `src/hooks/useDrawTools.js` | TerraDraw mode activation/deactivation |
| Feature popup | `src/hooks/useFeaturePopup.js` | Click-to-inspect with property editing |
| WFS editing | `src/hooks/useWfsEdit.js` | Full geometry + attribute editing with OL interactions |

### Authentication

Basic Auth credentials are base64-encoded and stored in `localStorage`. `getAuthHeaders()` in `src/config/geoserver.js` reads them back for every API call. Both HTTP 200 and 403 responses from GeoServer REST are treated as successful login (403 = authenticated non-admin user).
