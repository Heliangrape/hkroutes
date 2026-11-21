# 幹線圖誌 · Hong Kong Route Atlas

An independent, Traditional Chinese map explorer for Hong Kong's ten strategic routes. Built with vanilla JavaScript, CSS, and a locally vendored MapLibre GL JS 5.14.0. No build step, backend, accounts, or API keys are required.

## Run locally

```sh
python3 -m http.server 4173 --directory dist --bind 127.0.0.1
```

Open http://127.0.0.1:4173. The basemap and optional web font require network access. Route geometries and metadata are served locally. A slow basemap falls back to a route-only view; a non-WebGL browser can still browse the route list and descriptions.

## Features

- Two explicit modes: routes and bridges/tunnels, with a single unified browsing panel.
- Mobile panel has swipe/tap controlled collapsed and expanded states. Its state is stored locally and is never changed by route selection, mode changes, zoom, overview, tours, or navigation.
- Map visual center follows the panel continuously; route fitting always calculates zoom from the collapsed panel area. Swiping never changes zoom.
- Selected route retains its color; all others and their route shields become grayscale. No ambiguous circular route markers or glow effects.
- Bridge/tunnel mode renders every route in gray and shows 5 blue bridge markers plus 16 amber tunnel markers. Each item includes measurements, a short description, official photographs, and source credits.
- Search by route, district, bridge, or tunnel; sequential route tour and shareable links.
- Source credits are a secondary inline disclosure in the panel footer.

Run geometry/data regression checks with `node --test tests/camera.test.mjs`.

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
