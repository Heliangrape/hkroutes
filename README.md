# 幹線圖誌 · Hong Kong Route Atlas

An independent, Traditional Chinese map explorer for Hong Kong's ten strategic routes. Built with vanilla JavaScript, CSS, and a locally vendored MapLibre GL JS 5.14.0. No build step, backend, accounts, or API keys are required.

## Run locally

```sh
python3 -m http.server 4173 --directory dist --bind 127.0.0.1
```

Open http://127.0.0.1:4173. The basemap and optional web font require network access. Route geometries and metadata are served locally. A slow basemap falls back to a route-only view; a non-WebGL browser can still browse the route list and descriptions.

## Features

- Ten geographically accurate route overlays, including separately styled construction segments.
- Search by route number, district, bridge, or tunnel; filter by route orientation.
- Select routes from the map, numbered shields, or sidebar.
- 66 editorial landmarks with map focus and a sequential guided exploration.
- Bridge and tunnel landmark layers, route share links, GeoJSON download, responsive mobile layout, keyboard controls, and reduced-motion support.
- `/#route=8` opens a specific route. `/` focuses search and Escape ends exploration.
- The initial view contains no intro or route-detail card, including when loading a route link. Select a route to open its details; close with × or Escape while keeping the route highlighted. Panning is unrestricted by a Hong Kong bounding box, and window resizing preserves the current map location.

## Data

Route names and places were checked against Hong Kong Transport Department's strategic route maps:
https://www.td.gov.hk/tc/transport_in_hong_kong/hk_strategic_route_and_exit_number_system/map/index_t.html

Road geometry: © OpenStreetMap contributors, available under the Open Database License (ODbL), retrieved via Overpass on 2026-11-21. The distributable derived dataset is `dist/data/routes.geojson`. It is offered under ODbL: https://www.openstreetmap.org/copyright and https://opendatacommons.org/licenses/odbl/1-0/ . This data license is separate from the application code. The Overpass query used:

```overpass
[out:json][timeout:90];
way["highway"]["ref"~"^(1|2|3|4|5|6|7|8|9|10)$"](22.18,113.82,22.57,114.38);
out geom;
```

`scripts/prepare-data.py` retains motorway, trunk, primary, and construction features, filters unrelated numbered footpaths/platforms, and projects manually curated landmark anchors onto road segments. Both carriageways are included. Landmark lists are illustrative selections, not complete exit lists. Construction markings reflect the snapshot and are not a current traffic feed.

Basemap: CARTO Dark Matter / OpenStreetMap, with locally adjusted colors. Its source attribution is retained in the map. MapLibre GL JS is BSD-3-Clause; see `dist/vendor/LICENSE.maplibre.txt`.

## Project structure

- `dist/` — deployable static website, local library assets, and route data.
- `scripts/prepare-data.py` — reproducible geometry processing.
- `scripts/osm-raw.json` — original Overpass snapshot.
- `.openai/hosting.json` — Sites deployment identity.

This is a geographic learning experience. Refer to the Transport Department for road opening schedules, driving restrictions, and current conditions.
