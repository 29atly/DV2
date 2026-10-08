# Wildlife observation maps

Run from this folder:

```sh
python3 -m http.server 8000
```

Open http://localhost:8000. Choose a species below the map and hover over a point to see its species, date, location and coordinates.

- `DotMap.vg.json`: existing editable point map (uses the Vega-Lite schema).
- `HotspotMap.vl.json`: editable Vega-Lite binned map.
- `HotspotMap.vg.json`: compiled binned map for tools that expect Vega.
- `data/observations-794195.csv`: local copy of your supplied CSV. The original path is a folder; the CSV is inside it.
- `data/australia_states.geojson`: Australian state boundaries from [rowanhogan/australian-states](https://github.com/rowanhogan/australian-states).

The chart uses geographic longitude/latitude encodings and a Mercator projection. Species colours remain stable when filtering. The dot map shows the 10 species with the most valid, geolocated records (4,271 observations), with a distinct colour for each species. Its legend and dropdown list species in descending observation count. The binned map continues to use the full dataset. Names fall back to scientific name or species guess when a common name is missing. Offshore observations are included in the map extent. The supplied dataset contains mammals only.

The binned map bins longitude and latitude into a geographic grid, then aggregates the number of observations in each occupied cell. Its derived `grid_cell` identifies the cell by its west/south corner and grid size; `observation_count` counts its records. The default is 0.5° × 0.5°; the dropdown also offers 0.25°, 1° and 2° cells. Tooltips show the count and cell boundaries. Colours show six fixed count ranges: 1–4, 5–19, 20–49, 50–199, 200–499 and 500+. The legend stays the same when changing spatial bin size. Tooltips also show the count range. Empty cells are uncoloured, and physical cell areas vary with latitude, so this map shows record counts rather than density per square kilometre.

Hotspots may reflect both wildlife presence and where people are more likely to observe and report animals. Changing grid size helps reveal how aggregation affects the apparent hotspots. The existing `HotspotMap` filenames are retained for compatibility.

The preview loads the Vega libraries from a CDN, so it needs internet access. Data paths are relative to the project root. Keep the `data` folder alongside the specifications when hosting or previewing them.

Dot map selection (ranked by observation count):

- Koala: 1,978
- Platypus: 679
- Grey-headed Flying-fox: 525
- Greater Glider: 239
- European Rabbit: 176
- Quokka: 155
- Tasmanian Devil: 153
- Spotted-tailed Quoll: 124
- Australian Sea Lion: 123
- Eastern Quoll: 119
