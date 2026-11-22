# 幹線圖誌 · Hong Kong Route Atlas

An independent, Traditional Chinese map explorer for Hong Kong's ten strategic routes. Built with vanilla JavaScript, CSS, and a locally vendored MapLibre GL JS 5.14.0. No build step, backend, accounts, or API keys are required.

Live site: https://heliangrape.github.io/hkroutes/

## Deployment

Push to `main` to publish `dist/` through the GitHub Pages workflow in `.github/workflows/pages.yml`. The workflow runs the existing regression checks before deployment. GitHub Pages uses GitHub Actions as its publishing source. All local asset URLs are relative so the site works under `/hkroutes/`.

## Run locally

```sh
python3 -m http.server 4173 --directory dist --bind 127.0.0.1
```

Open http://127.0.0.1:4173. The basemap and optional web font require network access. Route geometries and metadata are served locally. A slow basemap falls back to a route-only view; a non-WebGL browser can still browse the route list and descriptions.

## Interaction

The map is one continuous overview-to-detail experience, with no separate route or infrastructure tabs.

- Start with a Hong Kong overview and soft, route-coloured traffic. The map retains its coastlines, green areas, local roads and buildings. A small fixed header offers whole-network reset and one unified search; no route-number badges or mode tabs.
- Zoom gradually from regional context to facility names, local streets and parks. At a useful scale, a bridge/tunnel/interchange near the viewport centre reveals a photo and principal measurement automatically. This preview never changes the selected route, camera, URL or panel expansion. Zooming out or panning away releases it; selecting it opens full details.
- Search finds routes, places and facilities together, including common simplified Chinese names; `/` focuses search and Enter opens the first match.
- Select a road or its number to focus the route. Along-route bridge, tunnel and interchange names are direct map links; zooming in reveals more names. The same items are available as plain text in the pull-up details.
- Select a facility to enter its detail scene. Click an interchange ramp or mainline to isolate it and read its source road, destination road, direction and available lane/destination tags.
- Tap empty space or Escape: facility → originating route → whole network. In the whole-network scene, empty space returns to the last visited route. On a first visit, select a route to start. Each scene retains its own camera, including manual pan/zoom.
- The pull-up panel opens or closes only when the user drags or toggles its handle. Selecting another object preserves expansion; expanding changes visual center without changing zoom.
- Facilities have one stable identity shared by all their parent routes. Each visit retains its originating route separately, including in shareable hash links.
- Bridges and tunnels show their route number, neighbouring route destinations and a principal measurement on the map, with photos, parameters and source credits in the pull-up.
- Whole-network traffic is balanced across mapped route numbers and retains each route colour. Traffic is an illustrative effect, not live traffic data. Animation honours reduced-motion preferences and pauses in background tabs. Construction segments carry no traffic animation.

Run regression checks with `node --test tests/*.test.mjs`.

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

## Interchange connections and geography

Route focus uses light trails with quiet settlement and geographical labels from `dist/data/places.json`. Facility focus replaces these labels with road and connection annotations, using collision avoidance adapted to the current viewport.

Three interchange pilot scenes use actual clipped OpenStreetMap geometry: North West Tsing Yi, Lai Wan and Butterfly Valley. Mainlines retain their strategic route colour. Ramps transition from the source route colour to the destination route colour; grey represents local/un-numbered or unresolved roads. Road layer ordering supplies dark edges at crossings.

`scripts/prepare-connections.py` derives movements by traversing shared OSM nodes in the legal way direction, stopping at a non-link road. Lines crossing without a shared node do not connect. Upstream/downstream ramp distances maintain colour progress along split ways. Each feature retains OSM way identity, source/destination references and road names, geographic direction, available lane/destination tags, and whether its terminals were resolved. Labels flag incomplete connections as illustrations. These are inferred structural relationships, not turn-by-turn instructions or survey-grade engineering data. The map and code-native SVG diagrams use the same enriched geometry and colours.

Regenerate in this order (Node 24 for the final step):

```sh
python3 scripts/prepare-data.py
python3 scripts/prepare-structures.py
python3 scripts/prepare-interchanges.py
python3 scripts/prepare-connections.py
python3 scripts/prepare-places.py
python3 scripts/prepare-context-map.py
node scripts/prepare-diagrams.mjs
```

Raw interchange ways are retained in `scripts/interchanges-ways.json`, retrieved from Overpass on 2026-11-22. The same ODbL attribution applies to derived geometry and diagrams. Further official route context: [Transport Department — Driving along Tsing Sha Highway](https://www.td.gov.hk/tc/publications_and_press_releases/publications/free_publications/driving_along_tsing_sha_highway/index.html), [Highways Department — New Territories roads](https://www.hyd.gov.hk/tc/road_and_railway/road_network/new.html).
