# 幹線圖誌 · Hong Kong Route Atlas

An independent, Traditional Chinese map explorer for Hong Kong's ten strategic routes. Built with vanilla JavaScript, CSS, and a locally vendored MapLibre GL JS 5.14.0. No build step, backend, accounts, or API keys are required.

## Run locally

```sh
python3 -m http.server 4173 --directory dist --bind 127.0.0.1
```

Open http://127.0.0.1:4173. The basemap and optional web font require network access. Route geometries and metadata are served locally. A slow basemap falls back to a route-only view; a non-WebGL browser can still browse the route list and descriptions.

## Features

- Browse routes and bridges/tunnels, then enter a unified full-map focus scene by selecting any item. Unrelated labels and navigation disappear; only a 34-pixel pull-up detail tab remains. Details work on desktop and mobile.
- Tap empty map space or press Escape to return to the full browser view. The Hong Kong overview button enters a control-free whole-network display; clicking a road enters route focus directly.
- Route detail bridge/tunnel entries open their facility focus immediately. Facility details place parent-route return links above the photo.
- Focus dims all other roads and emphasizes the selected route or physical bridge/tunnel geometry. Directional light streaks follow connected road polylines; construction segments carry no animated traffic.
- Traffic is a visual effect, not live traffic data. Animation stops for reduced-motion preferences and pauses in background tabs.
- Panel visual center linkage remains continuous; expansion does not change map zoom. Browse expansion preference is stored locally; selecting an item explicitly starts a clean collapsed focus scene.
- Twenty-four infrastructure entries include measurements, descriptions, official photographs, and source credits. Credits remain a secondary panel disclosure; map attribution is a small text footer.

Run geometry, data and traffic regression checks with `node --test tests/*.test.mjs`.

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

## Bridge and tunnel data

`dist/data/structures.json` records per-item measurements, official source URLs, photo credits, and WGS84 positions projected onto matching route geometry. Facts are checked against the Transport Department details page and Highways Department bridge factsheets. Measurements explicitly distinguish main span, overall bridge length, and tunnel length. The Central Kowloon Bypass entry uses the Yau Ma Tei section tunnel, not the entire future Route 6.

Photos are sourced from the Hong Kong Transport Department, Information Services Department, and Film Promotion and Facilitation Section; each photo retains a direct source link and credit. `scripts/prepare-structures.py` downloads and optimizes the original public photographs with macOS sips.

## Route context and interchange pilot

Route focus uses slightly longer, brighter light trails and non-interactive, low-contrast labels for major districts, settlements and water/land features. Labels are curated editorial anchors in `dist/data/places.json`; collision culling adapts to narrow views and an expanded panel. Facility focus and the full overview keep their label-free presentation.

The bridge/tunnel catalog also includes three interchange pilot scenes: North West Tsing Yi, Lai Wan and Butterfly Valley. `dist/data/interchanges.geojson` contains clipped motorway/trunk/primary mainlines and ramps from OpenStreetMap. Dark-to-light silver represents the data's lower-to-upper road layers, with dark deck edges at crossings. Relative ordering is a structural illustration, not a survey-grade 3D engineering model. Per-item SVGs are geometry drawings, clearly identified as diagrams.

Regenerate base structures before appending interchange entries:

```sh
python3 scripts/prepare-structures.py
python3 scripts/prepare-interchanges.py
python3 scripts/prepare-places.py
```

Raw interchange ways are retained in `scripts/interchanges-ways.json`, retrieved from the public Overpass API on 2026-11-22. The same ODbL attribution applies to derived geometry and diagrams.
