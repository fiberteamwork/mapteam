/* =========================================================
   CUSTOMER MAP
   CSV : ./data/customer.csv
   Separator : ;
   ========================================================= */

console.log('[CUSTOMER_MAP] loaded version 20260730.1');

const DATA_URL = "./data/customer.csv";
// Debug: when true, markers are rendered as large bright red circles to aid visibility while debugging
// Toggle to true to force-visible markers
const DEBUG_HIGHLIGHT_MARKERS = false;

let customers = [];
let customerLayer = null;
let customerSource = null;
let wardChart = null;
let customerDrawVersion = 0;
let customerDrawTimeout = null;

// Remove stale customer layers or layers that accidentally contain customer features
function removeStaleCustomerLayers() {
    try {
        if (typeof map === 'undefined' || !map || typeof map.getLayers !== 'function') return;
        const stack = map.getLayers().getArray().slice();
        while (stack.length) {
            const layer = stack.shift();
            try {
                if (!layer) continue;
                // If layer is a group, enqueue its children
                if (typeof layer.getLayers === 'function') {
                    const childLayers = layer.getLayers().getArray() || [];
                    for (const cl of childLayers) stack.push(cl);
                }
                const isCustomerLayer = (layer.get && (layer.get('customerLayer') === true || layer.get('title') === 'Customer'));
                if (isCustomerLayer) {
                    map.removeLayer(layer);
                    console.log('removeStaleCustomerLayers: removed explicit customer layer');
                    continue;
                }
                // check source features for 'customer' property
                const src = layer.getSource && layer.getSource();
                if (src && typeof src.getFeatures === 'function') {
                    const feats = src.getFeatures() || [];
                    if (feats.some(f => f && typeof f.get === 'function' && (f.get('customer') !== undefined || f.get('groupMembers') !== undefined))) {
                        map.removeLayer(layer);
                        console.log('removeStaleCustomerLayers: removed layer containing customer features');
                    }
                }
            } catch (e) {
                // ignore per-layer errors
            }
        }
    } catch (e) {
        console.warn('removeStaleCustomerLayers failed', e);
    }
}


/* =========================================================
   STATUS COLORS
   ========================================================= */

const STATUS_CONFIG = {

    "pending": {
        label: "🔴 Pending",
        color: "#ef4444"
    },

    "reschedule": {
        label: "🔵 Reschedule",
        color: "#3b82f6"
    },

    "done": {
        label: "🟢 Done",
        color: "#22c55e"
    },

    "cancel": {
        label: "🟣 Cancel",
        color: "#a855f7"
    },

    "default": {
        label: "⚪ Lainnya",
        color: "#6b7280"
    }

};


/* =========================================================
ORMALIZE TEXT
   ========================================================= */

function normalize(value){

    return String(value ?? "")
        .replace(/^\uFEFF/,"")
        .replace(/\u00A0/g," ")
        .trim()
        .replace(/\s+/g," ");

}

function normalizeKey(value){
    return normalize(value)
        .toLowerCase()
        .replace(/[^a-z0-9\s]+/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function maybeLonLat(coord){
    if (!Array.isArray(coord) || coord.length < 2) return null;
    const x = Number(coord[0]);
    const y = Number(coord[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    // If coordinate is already in lon/lat range, return it directly.
    if (Math.abs(x) <= 180 && Math.abs(y) <= 90) {
        return { longitude: x, latitude: y };
    }
    // Otherwise assume the input is in WebMercator and transform to lon/lat.
    try {
        const lonlat = ol.proj.toLonLat([x, y]);
        return { longitude: lonlat[0], latitude: lonlat[1] };
    } catch (e) {
        return null;
    }
}

function getFeatureInteriorCoordinate(feature){
    try {
        const geom = feature && feature.getGeometry && feature.getGeometry();
        if (!geom) return null;

        if (typeof geom.getInteriorPoint === 'function') {
            const interior = geom.getInteriorPoint();
            if (interior && typeof interior.getCoordinates === 'function') {
                const coords = interior.getCoordinates();
                const maybe = maybeLonLat(coords);
                if (maybe) return { latitude: maybe.latitude, longitude: maybe.longitude };
            }
        }

        const center = ol.extent.getCenter(geom.getExtent());
        const maybe = maybeLonLat(center);
        if (maybe) return { latitude: maybe.latitude, longitude: maybe.longitude };
    } catch (e) {
        // ignore geometry errors
    }
    return null;
}

function sanitizeNumberString(s){
    s = String(s ?? '');
    // common decimal comma to dot
    s = s.replace(/,/g, '.');
    // remove any character except digits, dot and minus
    s = s.replace(/[^0-9.\-]/g, '');
    // collapse multiple dots into one (keep first as decimal separator)
    const parts = s.split('.');
    if(parts.length > 2){
        s = parts.shift() + '.' + parts.join('');
    }
    if(s === '' || s === '.' || s === '-' ) return NaN;
    return parseFloat(s);
}

function isWithinIndonesiaBounds(lat, lon){
    return Number.isFinite(lat) && Number.isFinite(lon) &&
        lat >= -12.0 && lat <= 6.0 &&
        lon >= 95.0 && lon <= 141.0;
}


/* =========================================================
   STATUS KEY
   ========================================================= */

function getStatusKey(status) {

    const s = normalize(status).toLowerCase();

    if (s.includes("pending"))
        return "pending";

    if (s.includes("reschedule"))
        return "reschedule";

    if (
        s.includes("done") ||
        s.includes("complete") ||
        s.includes("completed") ||
        s.includes("success")
    )
        return "done";

    if (
        s.includes("cancel") ||
        s.includes("canceled") ||
        s.includes("cancelled")
    )
        return "cancel";

    return "default";
}


/* =========================================================
   STATUS COLOR
   ========================================================= */

function getStatusColor(status) {

    return STATUS_CONFIG[
        getStatusKey(status)
    ].color;

}


/* =========================================================
   CSV PARSER
   ========================================================= */

function parseCSV(text) {

    // Hilangkan BOM
    text = text.replace(/^\uFEFF/, "");

    const lines = text
        .split(/\r?\n/)
        .filter(line => line.trim() !== "");

    if (lines.length === 0) return [];

    // Header
    const headers = lines[0]
        .split(";")
        .map(h =>
            String(h)
                .replace(/^\uFEFF/, "")
                .trim()
                .replace(/\s+/g, " ")
        );

    // Perbaiki kemungkinan "lD Customer"
    headers[0] = headers[0]
        .replace(/^lD Customer$/i, "ID Customer")
        .replace(/^Id Customer$/i, "ID Customer");

    const result = [];

    for (let i = 1; i < lines.length; i++) {

        const cols = lines[i].split(";");

        const row = {};

        headers.forEach((header, index) => {
            row[header] = (cols[index] ?? "").trim();
        });

        result.push(row);
    }

    return result;
}

function fallbackParseCustomerRows(raw) {
    const customers = [];
    if (!Array.isArray(raw) || raw.length === 0) return customers;

    raw.forEach((row, index) => {
        const keys = Object.keys(row);
        const id = normalize(row["ID Customer"] ?? row["lD Customer"] ?? row["Id Customer"] ?? row[keys[0]] ?? "");
        if (!id) {
            if (index < 5) console.warn('[CUSTOMER_MAP] fallbackParseCustomerRows missing id on row', index, row);
            return;
        }
        const username = normalize(row["Username"]);
        const city = normalize(row["City"]);
        const district = normalize(row["District"]);
        const ward = normalize(row["Ward"]);
        const team = normalize(row["Team"]);
        const vendor = normalize(row["Vendor"] || team);
        const site = normalize(row["Site Name"] ?? row["CEK SITE NAME SYSTEM"] ?? "");
        const status = normalize(row["Status Instalasi/Maintenence"] ?? row["Status Instalasi/Maintenance"] ?? "");
        const visitDate = normalize(row["Visit Date"]);
        const latKey = keys.find(k => /lat/i.test(k)) || "Latitude";
        const lonKey = keys.find(k => /lon|lng|long|longitude|x/i.test(k)) || "Longitude";
        let rawLat = sanitizeNumberString(row[latKey] ?? row["Latitude"] ?? "");
        let rawLon = sanitizeNumberString(row[lonKey] ?? row["Longitude"] ?? "");
        let swapped = false;
        if (Number.isFinite(rawLat) && Number.isFinite(rawLon)){
            if (Math.abs(rawLat) > 90 && Math.abs(rawLon) <= 90) {
                const t = rawLat; rawLat = rawLon; rawLon = t; swapped = true;
            } else if ((rawLat >= 111 && rawLat <= 115) && (rawLon <= -6 && rawLon >= -8)) {
                const t = rawLat; rawLat = rawLon; rawLon = t; swapped = true;
            }
        }
        let lat = rawLat;
        let lon = rawLon;
        if (Number.isFinite(lat) && Math.abs(lat) > 90) lat /= 1000000;
        if (Number.isFinite(lon) && Math.abs(lon) > 180) lon /= 1000000;
        if (swapped) {
            // diagnostic swap fallback
        }
        if (!isWithinIndonesiaBounds(lat, lon) || !Number.isFinite(lat) || !Number.isFinite(lon)) {
            const coord = getCoordinateFromWard(city, district, ward);
            if (coord) {
                lat = coord.latitude;
                lon = coord.longitude;
            }
        }
        customers.push({
            id,
            username,
            city,
            district,
            ward,
            site,
            team,
            vendor,
            status,
            visitDate,
            latitude: lat,
            longitude: lon
        });
    });
    return customers;
}

function getCoordinateFromWard_old(city, district, ward) {

    const layers = [
        lyr_surabaya_2,
        lyr_SIDOARJO_1
    ];

    city = normalize(city);
    district = normalize(district);
    ward = normalize(ward);

    for (const layer of layers) {

        const features =
            layer.getSource().getFeatures();

        for (const feature of features) {

            const fCity = normalize(feature.get("CITY"));

            const fDistrict = normalize(feature.get("KECAMATAN"));

            const fWard = normalize(feature.get("DESA"));

            if (
                fCity === city &&
                fDistrict === district &&
                fWard === ward
            ) {

                const center =
                    ol.extent.getCenter(
                        feature
                            .getGeometry()
                            .getExtent()
                    );

                const lonlat =
                    ol.proj.toLonLat(center);

                return {

                    latitude: lonlat[1],
                    longitude: lonlat[0]

                };

            }

        }

    }

    return null;

}

let wardIndex = new Map();
let wardFallbackCache = new Map();
let csvWardCoordinateIndex = new Map();

function compactKey(value) {
    return normalizeKey(value)
        .replace(/\s+/g, '');
}

function normalizeLocationKey(city, district, ward) {
    return [city, district, ward]
        .map(value => normalizeKey(value || ""))
        .join("||");
}

function normalizeLocationKeyCompact(city, district, ward) {
    return [city, district, ward]
        .map(value => String(normalize(value || "")).toLowerCase().replace(/[^a-z0-9]+/g, ''))
        .join("||");
}

function buildCsvWardCoordinateIndex(rawRows) {
    csvWardCoordinateIndex.clear();

    if (!Array.isArray(rawRows) || rawRows.length === 0)
        return;

    rawRows.forEach(row => {
        const city = normalize(row["City"] || "");
        const district = normalize(row["District"] || "");
        const ward = normalize(row["Ward"] || "");
        const strippedCity = normalize(stripAdminPrefixes(city));
        const strippedDistrict = normalize(stripAdminPrefixes(district));
        const wardShort = normalize(shortWardName(ward));

        const keys = Object.keys(row);
        const latKey = keys.find(k => /lat/i.test(k)) || "Latitude";
        const lonKey = keys.find(k => /lon|lng|long|longitude|x/i.test(k)) || "Longitude";

        let rawLat = sanitizeNumberString(row[latKey] ?? row["Latitude"] ?? "");
        let rawLon = sanitizeNumberString(row[lonKey] ?? row["Longitude"] ?? "");

        if (Number.isFinite(rawLat) && Number.isFinite(rawLon)) {
            if (Math.abs(rawLat) > 90 && Math.abs(rawLon) <= 90) {
                [rawLat, rawLon] = [rawLon, rawLat];
            } else if ((rawLat >= 111 && rawLat <= 115) && (rawLon <= -6 && rawLon >= -8)) {
                [rawLat, rawLon] = [rawLon, rawLat];
            }
        }

        let lat = rawLat;
        let lon = rawLon;
        if (Number.isFinite(lat) && Math.abs(lat) > 90) lat /= 1000000;
        if (Number.isFinite(lon) && Math.abs(lon) > 180) lon /= 1000000;

        if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) < 1e-6 || Math.abs(lon) < 1e-6)
            return;

        const coord = { latitude: lat, longitude: lon };
        const wardVariants = [ward, normalize(stripAdminPrefixes(ward)), wardShort, ...splitWardVariants(ward)].filter(Boolean);
        const uniqueWardVariants = [...new Set(wardVariants)];
        const cityVariants = [city, strippedCity].filter(Boolean);
        const districtVariants = [district, strippedDistrict].filter(Boolean);

        const addKey = (cityValue, districtValue, wardValue) => {
            const key = normalizeLocationKey(cityValue, districtValue, wardValue);
            if (!csvWardCoordinateIndex.has(key)) {
                csvWardCoordinateIndex.set(key, coord);
            }
        };

        const addKeyCompact = (cityValue, districtValue, wardValue) => {
            const key = normalizeLocationKeyCompact(cityValue, districtValue, wardValue);
            if (!csvWardCoordinateIndex.has(key)) {
                csvWardCoordinateIndex.set(key, coord);
            }
        };

        const addAllKeys = (cityValue, districtValue, wardValue) => {
            addKey(cityValue, districtValue, wardValue);
            addKeyCompact(cityValue, districtValue, wardValue);
        };

        if (uniqueWardVariants.length === 0) {
            cityVariants.forEach(cityVariant => {
                if (districtVariants.length > 0) {
                    districtVariants.forEach(districtVariant => {
                        addAllKeys(cityVariant, districtVariant, "");
                        addAllKeys(cityVariant, "", "");
                        addAllKeys("", districtVariant, "");
                    });
                } else {
                    addAllKeys(cityVariant, "", "");
                }
            });
            districtVariants.forEach(districtVariant => addAllKeys("", districtVariant, ""));
            addAllKeys("", "", "");
            return;
        }

        uniqueWardVariants.forEach(wardVariant => {
            cityVariants.forEach(cityVariant => {
                if (districtVariants.length > 0) {
                    districtVariants.forEach(districtVariant => {
                        addAllKeys(cityVariant, districtVariant, wardVariant);
                        addAllKeys(cityVariant, districtVariant, "");
                        addAllKeys(cityVariant, "", wardVariant);
                        addAllKeys("", districtVariant, wardVariant);
                    });
                } else {
                    addAllKeys(cityVariant, "", wardVariant);
                    addAllKeys(cityVariant, "", "");
                }
            });
            if (districtVariants.length > 0) {
                districtVariants.forEach(districtVariant => {
                    addAllKeys("", districtVariant, wardVariant);
                    addAllKeys("", districtVariant, "");
                });
            }
            addAllKeys("", "", wardVariant);
            addAllKeys("", "", "");
        });
    });
}

function getCoordinateFromCsvWard(city, district, ward) {
    if (csvWardCoordinateIndex.size === 0)
        return null;

    const normalizedCity = normalize(city || "");
    const normalizedDistrict = normalize(district || "");
    const strippedCity = normalize(stripAdminPrefixes(normalizedCity));
    const strippedDistrict = normalize(stripAdminPrefixes(normalizedDistrict));
    const cityVariants = [normalizedCity, strippedCity].filter(Boolean);
    const districtVariants = [normalizedDistrict, strippedDistrict].filter(Boolean);

    const wardVariants = [
        normalize(ward),
        normalize(stripAdminPrefixes(ward)),
        normalize(shortWardName(ward)),
        ...splitWardVariants(ward)
    ].filter(Boolean);

    const candidateKeys = new Set();

    if (wardVariants.length === 0) {
        cityVariants.forEach(cityVariant => {
            if (districtVariants.length > 0) {
                districtVariants.forEach(districtVariant => {
                    candidateKeys.add(normalizeLocationKey(cityVariant, districtVariant, ""));
                    candidateKeys.add(normalizeLocationKeyCompact(cityVariant, districtVariant, ""));
                    candidateKeys.add(normalizeLocationKey(cityVariant, "", ""));
                    candidateKeys.add(normalizeLocationKeyCompact(cityVariant, "", ""));
                    candidateKeys.add(normalizeLocationKey("", districtVariant, ""));
                    candidateKeys.add(normalizeLocationKeyCompact("", districtVariant, ""));
                });
            } else {
                candidateKeys.add(normalizeLocationKey(cityVariant, "", ""));
                candidateKeys.add(normalizeLocationKeyCompact(cityVariant, "", ""));
            }
        });

        districtVariants.forEach(districtVariant => {
            candidateKeys.add(normalizeLocationKey("", districtVariant, ""));
            candidateKeys.add(normalizeLocationKeyCompact("", districtVariant, ""));
        });
    }

    wardVariants.forEach(wardVariant => {
        if (cityVariants.length > 0) {
            cityVariants.forEach(cityVariant => {
                if (districtVariants.length > 0) {
                    districtVariants.forEach(districtVariant => {
                        candidateKeys.add(normalizeLocationKey(cityVariant, districtVariant, wardVariant));
                        candidateKeys.add(normalizeLocationKeyCompact(cityVariant, districtVariant, wardVariant));
                        candidateKeys.add(normalizeLocationKey(cityVariant, districtVariant, ""));
                        candidateKeys.add(normalizeLocationKeyCompact(cityVariant, districtVariant, ""));
                        candidateKeys.add(normalizeLocationKey(cityVariant, "", wardVariant));
                        candidateKeys.add(normalizeLocationKeyCompact(cityVariant, "", wardVariant));
                        candidateKeys.add(normalizeLocationKey("", districtVariant, wardVariant));
                        candidateKeys.add(normalizeLocationKeyCompact("", districtVariant, wardVariant));
                    });
                } else {
                    candidateKeys.add(normalizeLocationKey(cityVariant, "", wardVariant));
                    candidateKeys.add(normalizeLocationKeyCompact(cityVariant, "", wardVariant));
                    candidateKeys.add(normalizeLocationKey(cityVariant, "", ""));
                    candidateKeys.add(normalizeLocationKeyCompact(cityVariant, "", ""));
                }
            });
        }

        if (cityVariants.length === 0 && districtVariants.length > 0) {
            districtVariants.forEach(districtVariant => {
                candidateKeys.add(normalizeLocationKey("", districtVariant, wardVariant));
                candidateKeys.add(normalizeLocationKeyCompact("", districtVariant, wardVariant));
                candidateKeys.add(normalizeLocationKey("", districtVariant, ""));
                candidateKeys.add(normalizeLocationKeyCompact("", districtVariant, ""));
            });
        }

        candidateKeys.add(normalizeLocationKey("", "", wardVariant));
        candidateKeys.add(normalizeLocationKeyCompact("", "", wardVariant));
    });

    for (const key of candidateKeys) {
        if (csvWardCoordinateIndex.has(key))
            return csvWardCoordinateIndex.get(key);
    }

    // Loose fallback using partial ward/district matches to recover misspellings or alternate naming conventions.
    const targetWard = normalizeKey(ward);
    const targetDistrict = normalizeKey(district);
    const targetCity = normalizeKey(city);

    if (targetWard || targetDistrict || targetCity) {
        for (const [key, coord] of csvWardCoordinateIndex.entries()) {
            const [cityKey, distKey, wardKey] = key.split('||').map(part => normalizeKey(part || ''));
            const wardMatch = targetWard && wardKey && (wardKey.includes(targetWard) || targetWard.includes(wardKey));
            const districtMatch = !targetDistrict || (distKey && (distKey.includes(targetDistrict) || targetDistrict.includes(distKey)));
            const cityMatch = !targetCity || (cityKey && (cityKey.includes(targetCity) || targetCity.includes(cityKey)));
            if ((wardMatch || (!targetWard && distKey && districtMatch)) && districtMatch && cityMatch) {
                return coord;
            }
        }
    }

    return null;
}

function getCoordinateFromCity(city) {
    const normalizedCity = normalize(city).toLowerCase();
    const cityFallbacks = {
        "kota surabaya": { latitude: -7.257472, longitude: 112.752088 },
        "surabaya": { latitude: -7.257472, longitude: 112.752088 },
        "kab. sidoarjo": { latitude: -7.4485, longitude: 112.7152 },
        "sidoarjo": { latitude: -7.4485, longitude: 112.7152 },
        "kota denpasar": { latitude: -8.6500, longitude: 115.2167 },
        "denpasar": { latitude: -8.6500, longitude: 115.2167 }
    };
    return cityFallbacks[normalizedCity] || null;
}

function stripAdminPrefixes(s){
    return s.replace(/^kab(\.|upaten)?\s+/i, '')
            .replace(/^kota\s+/i, '')
            .replace(/^kabupaten\s+/i, '')
            .replace(/^provinsi\s+/i, '')
            .replace(/["'\.]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
}

function shortWardName(s){
    // remove RW/RT suffixes, common local prefixes, and content in parentheses
    return s.replace(/^\s*(desa|kelurahan)\s+/i, '')
            .replace(/\bRW\b.*$/i, '')
            .replace(/\bRT\b.*$/i, '')
            .replace(/\(.*\)/g, '')
            .replace(/[\.,]+/g, '.')
            .replace(/\s+/g, ' ')
            .trim();
}

function splitWardVariants(raw){
    const s = String(raw || '').trim();
    if (!s) return [];
    const parts = s.split(/[|\/]+/).map(p => normalize(p)).filter(Boolean);
    return [...new Set(parts)];
}

function getFeatureValue(feature, keys){
    const normalizedLookup = new Set(
        keys
            .map(key => normalize(String(key)).toLowerCase())
            .filter(Boolean)
    );

    if (typeof feature.getKeys === 'function') {
        const keysList = feature.getKeys();
        for (const key of keysList) {
            if (!normalizedLookup.has(normalize(String(key)).toLowerCase()))
                continue;
            const value = feature.get(key);
            if (value !== undefined && value !== null && String(value).trim() !== '') {
                return String(value);
            }
        }
    }

    for (const key of keys) {
        const value = feature.get(key);
        if (value !== undefined && value !== null && String(value).trim() !== '') {
            return String(value);
        }
    }

    return '';
}

function addWardKey(key, coord){
    const normalizedKey = normalizeKey(key);
    if (!wardIndex.has(normalizedKey)) wardIndex.set(normalizedKey, coord);
    const normalizedCompact = compactKey(key);
    if (normalizedCompact && !wardIndex.has(normalizedCompact)) wardIndex.set(normalizedCompact, coord);
}
function buildWardIndex(){

    try{
        wardIndex.clear();
        wardFallbackCache.clear();
        const layerPairs = [
            {layerVar: (typeof lyr_surabaya_2 !== 'undefined' ? lyr_surabaya_2 : null), jsonVarName: 'json_surabaya_2'},
            {layerVar: (typeof lyr_SIDOARJO_1 !== 'undefined' ? lyr_SIDOARJO_1 : null), jsonVarName: 'json_SIDOARJO_1'}
        ];

        layerPairs.forEach(pair => {
            const layer = pair.layerVar;

            // If we have an OpenLayers layer object, use its features
            if (layer && layer.getSource && typeof layer.getSource().getFeatures === 'function') {
                const features = layer.getSource().getFeatures() || [];
                features.forEach(feature => {
                    const rawCity = normalize(getFeatureValue(feature, ['CITY','city','City','CITYNAME']));
                    const rawDistrict = normalize(getFeatureValue(feature, ['KECAMATAN','kecamatan','district','District','DistrictName']));
                    const rawWard = normalize(getFeatureValue(feature, ['DESA','desa','Ward','WARD','NAMOBJ','name']));
                    const strippedCity = normalize(stripAdminPrefixes(rawCity));
                    const strippedDistrict = normalize(stripAdminPrefixes(rawDistrict));
                    const wardShort = normalize(shortWardName(rawWard));
                    try {
                        const coord = getFeatureInteriorCoordinate(feature) || (() => {
                            const center = ol.extent.getCenter(feature.getGeometry().getExtent());
                            const lonlat = ol.proj.toLonLat(center);
                            return { latitude: lonlat[1], longitude: lonlat[0] };
                        })();
                        addWardKey(`${rawCity}||${rawDistrict}||${rawWard}`, coord);
                        addWardKey(`${strippedCity}||${rawDistrict}||${rawWard}`, coord);
                        addWardKey(`${rawCity}||${strippedDistrict}||${rawWard}`, coord);
                        addWardKey(`${strippedCity}||${strippedDistrict}||${rawWard}`, coord);
                        addWardKey(`${rawCity}||${rawDistrict}||${wardShort}`, coord);
                        addWardKey(`${strippedCity}||${strippedDistrict}||${wardShort}`, coord);
                        addWardKey(`${rawCity}||${rawDistrict}||`, coord);
                        addWardKey(`${strippedCity}||${rawDistrict}||`, coord);
                        addWardKey(`${rawCity}||${strippedDistrict}||`, coord);
                        addWardKey(`${strippedCity}||${strippedDistrict}||`, coord);
                        addWardKey(`${rawCity}|||`, coord);
                        addWardKey(`${strippedCity}|||`, coord);
                        addWardKey(`||${rawDistrict}||`, coord);
                        addWardKey(`||${strippedDistrict}||`, coord);
                        addWardKey(`||${rawDistrict}||${rawWard}`, coord);
                        addWardKey(`||${rawDistrict}||${wardShort}`, coord);
                        addWardKey(`||${strippedDistrict}||${wardShort}`, coord);
                        addWardKey(`||${rawWard}`, coord);
                        addWardKey(`||${wardShort}`, coord);
                    } catch (e) { /* ignore per-feature errors */ }
                });
                return; // continue to next pair
            }

            // Otherwise try to read the JSON variable embedded in the page
            try {
                const jsonVar = (typeof window !== 'undefined' ? window[pair.jsonVarName] : undefined) || (typeof globalThis !== 'undefined' ? globalThis[pair.jsonVarName] : undefined);
                if (jsonVar && Array.isArray(jsonVar.features)) {
                    jsonVar.features.forEach(f => {
                        const props = f.properties || {};
                        const rawCity = normalize(String(props.CITY || props.city || ''));
                        const rawDistrict = normalize(String(props.KECAMATAN || props.kecamatan || props.DISTRICT || props.district || ''));
                        const rawWard = normalize(String(props.DESA || props.desa || props.WARD || props.Ward || props.NAMOBJ || props.name || ''));
                        const strippedCity = normalize(stripAdminPrefixes(rawCity));
                        const strippedDistrict = normalize(stripAdminPrefixes(rawDistrict));
                        const wardShort = normalize(shortWardName(rawWard));
                        try {
                            let coords = null;
                            if (f.geometry && f.geometry.type === 'Polygon' && Array.isArray(f.geometry.coordinates) && f.geometry.coordinates[0]) coords = f.geometry.coordinates[0];
                            else if (f.geometry && f.geometry.type === 'MultiPolygon' && Array.isArray(f.geometry.coordinates) && f.geometry.coordinates[0] && f.geometry.coordinates[0][0]) coords = f.geometry.coordinates[0][0];
                            if (coords && coords.length) {
                                let sx = 0, sy = 0, n = 0;
                                for (const c of coords) {
                                    if (!Array.isArray(c) || c.length < 2) continue;
                                    const x = Number(c[0]), y = Number(c[1]);
                                    if (!isFinite(x) || !isFinite(y)) continue;
                                    sx += x; sy += y; n++;
                                }
                                if (n > 0) {
                                    let average = [sx / n, sy / n];
                                    const maybe = maybeLonLat(average);
                                    if (maybe) {
                                        const coord = { latitude: maybe.latitude, longitude: maybe.longitude };
                                        addWardKey(`${rawCity}||${rawDistrict}||${rawWard}`, coord);
                                        addWardKey(`${strippedCity}||${rawDistrict}||${rawWard}`, coord);
                                        addWardKey(`${rawCity}||${strippedDistrict}||${rawWard}`, coord);
                                        addWardKey(`${strippedCity}||${strippedDistrict}||${rawWard}`, coord);
                                        addWardKey(`${rawCity}||${rawDistrict}||${wardShort}`, coord);
                                        addWardKey(`${strippedCity}||${strippedDistrict}||${wardShort}`, coord);
                                        addWardKey(`${rawCity}||${rawDistrict}||`, coord);
                                        addWardKey(`${strippedCity}||${rawDistrict}||`, coord);
                                        addWardKey(`${rawCity}||${strippedDistrict}||`, coord);
                                        addWardKey(`${strippedCity}||${strippedDistrict}||`, coord);
                                        addWardKey(`${rawCity}|||`, coord);
                                        addWardKey(`${strippedCity}|||`, coord);
                                        addWardKey(`||${rawDistrict}||`, coord);
                                        addWardKey(`||${strippedDistrict}||`, coord);
                                        addWardKey(`||${rawDistrict}||${rawWard}`, coord);
                                        addWardKey(`||${rawDistrict}||${wardShort}`, coord);
                                        addWardKey(`||${strippedDistrict}||${wardShort}`, coord);
                                        addWardKey(`||${rawWard}`, coord);
                                        addWardKey(`||${wardShort}`, coord);
                                    }
                                }
                            }
                        } catch (e) { /* ignore */ }
                    });
                    return;
                }
            } catch (e) { /* ignore */ }

        });

    } catch (e) {
        console.error('buildWardIndex error', e);
    }

}

function getCoordinateFromWard(city, district, ward){
    if (wardIndex.size === 0) buildWardIndex();
    const nc_raw = String(city || '');
    const nd_raw = String(district || '');
    const nw_raw = String(ward || '');
    const nc = normalize(nc_raw);
    const nd = normalize(nd_raw);
    const nw = normalize(nw_raw);
    const nw_stripped = normalize(stripAdminPrefixes(nw_raw));
    const nw_short = normalize(shortWardName(nw_raw));
    const cacheKey = `${nc}||${nd}||${nw}`;

    if (wardFallbackCache.has(cacheKey)) {
        return wardFallbackCache.get(cacheKey);
    }

    const addCandidate = (arr, item) => {
        if (!item) return;
        const normalized = normalizeKey(item);
        if (normalized && !arr.includes(normalized)) arr.push(normalized);
    };

    const possibleWardParts = [nw, nw_stripped, nw_short, ...splitWardVariants(nw_raw)];
    const wardVariants = [...new Set(possibleWardParts.filter(Boolean))];

    const candidates = [];
    for (const wardVariant of wardVariants) {
        addCandidate(candidates, `${nc}||${nd}||${wardVariant}`);
        addCandidate(candidates, `${stripAdminPrefixes(nc)}||${nd}||${wardVariant}`);
        addCandidate(candidates, `${nc}||${stripAdminPrefixes(nd)}||${wardVariant}`);
        addCandidate(candidates, `${stripAdminPrefixes(nc)}||${stripAdminPrefixes(nd)}||${wardVariant}`);
        addCandidate(candidates, `${nc}||${nd}||${normalize(stripAdminPrefixes(wardVariant))}`);
        addCandidate(candidates, `${nc}||${nd}||${normalize(shortWardName(wardVariant))}`);
        addCandidate(candidates, `${nc}||${nd}||`);
        addCandidate(candidates, `${stripAdminPrefixes(nc)}||${nd}||`);
        addCandidate(candidates, `${nc}||${stripAdminPrefixes(nd)}||`);
        addCandidate(candidates, `${stripAdminPrefixes(nc)}||${stripAdminPrefixes(nd)}||`);
        addCandidate(candidates, `${nc}|||`);
        addCandidate(candidates, `${stripAdminPrefixes(nc)}|||`);
        addCandidate(candidates, `||${stripAdminPrefixes(nd)}||${wardVariant}`);
        addCandidate(candidates, `||${stripAdminPrefixes(nd)}||${normalize(stripAdminPrefixes(wardVariant))}`);
        addCandidate(candidates, `||${stripAdminPrefixes(nd)}||${normalize(shortWardName(wardVariant))}`);
        addCandidate(candidates, `||${nd}||${wardVariant}`);
        addCandidate(candidates, `||${nd}||`);
        addCandidate(candidates, `||${wardVariant}`);
        addCandidate(candidates, `||${normalize(shortWardName(wardVariant))}`);
    }

    if (wardVariants.length === 0) {
        addCandidate(candidates, `${nc}||${nd}||`);
        addCandidate(candidates, `${stripAdminPrefixes(nc)}||${nd}||`);
        addCandidate(candidates, `${nc}||${stripAdminPrefixes(nd)}||`);
        addCandidate(candidates, `${stripAdminPrefixes(nc)}||${stripAdminPrefixes(nd)}||`);
        addCandidate(candidates, `${nc}|||`);
        addCandidate(candidates, `${stripAdminPrefixes(nc)}|||`);
        addCandidate(candidates, `||${nd}||`);
        addCandidate(candidates, `||${stripAdminPrefixes(nd)}||`);
    }

    for (const k of candidates) {
        if (wardIndex.has(k)) {
            const c = Object.assign({matchedKey: k}, wardIndex.get(k));
            wardFallbackCache.set(cacheKey, c);
            return c;
        }
    }

    // If exact ward lookup fails, try compact no-space variants
    for (const k of candidates) {
        const compact = k.replace(/\s+/g, '');
        if (wardIndex.has(compact)) {
            const c = Object.assign({matchedKey: compact}, wardIndex.get(compact));
            wardFallbackCache.set(cacheKey, c);
            return c;
        }
    }

    const alnum = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g,'');
    const targetWard = alnum(nw);
    const targetDistrict = alnum(nd);
    const targetCity = alnum(nc);

    if (targetWard || targetDistrict || targetCity) {
        for (const [k, v] of wardIndex.entries()) {
            try {
                const parts = k.split('||');
                const kCity = alnum(parts[0] || '');
                const kDistrict = alnum(parts[1] || '');
                const kWard = alnum(parts[2] || '');

                const wardMatch = targetWard && kWard && (kWard.includes(targetWard) || targetWard.includes(kWard));
                const districtMatch = !targetDistrict || (kDistrict && (kDistrict.includes(targetDistrict) || targetDistrict.includes(kDistrict)));
                const cityMatch = !targetCity || (kCity && (kCity.includes(targetCity) || targetCity.includes(kCity)));

                if (wardMatch && districtMatch && cityMatch) {
                    const c = Object.assign({matchedKey: k}, v);
                    wardFallbackCache.set(cacheKey, c);
                    return c;
                }
            } catch (e) { }
        }
    }

    // fallback: if we have a district or city but not ward specifics, try any matching district or city
    if (targetDistrict || targetCity) {
        for (const [k, v] of wardIndex.entries()) {
            try {
                const parts = k.split('||');
                const kCity = alnum(parts[0] || '');
                const kDistrict = alnum(parts[1] || '');
                const cityMatch = !targetCity || (kCity && (kCity.includes(targetCity) || targetCity.includes(kCity)));
                const districtMatch = !targetDistrict || (kDistrict && (kDistrict.includes(targetDistrict) || targetDistrict.includes(kDistrict)));
                if (cityMatch && districtMatch) {
                    const c = Object.assign({matchedKey: k}, v);
                    wardFallbackCache.set(cacheKey, c);
                    return c;
                }
            } catch (e) { }
        }
    }

    wardFallbackCache.set(cacheKey, null);
    return null;
}

/* =========================================================
   PARSE CUSTOMER DATA
   ========================================================= */

function parseCustomerData(text){

    const raw = parseCSV(text);
    console.log('[CUSTOMER_MAP] parseCustomerData raw rows=', raw.length);

    if(raw.length===0) return [];

    buildCsvWardCoordinateIndex(raw);

    const customers = [];

    let wardResolvedCount = 0;
    let defaultedCount = 0;
    let invalidCoordCount = 0;
    let swappedCount = 0;
    let outOfBoundsCount = 0;
    const wardResolvedSamples = [];
    const unresolvedSamples = [];

    for(let index=0; index<raw.length; index++){
        const row = raw[index];
        const keys = Object.keys(row);

        const latKey = keys.find(k => /lat/i.test(k)) || "Latitude";
        const lonKey = keys.find(k => /lon|lng|long|longitude|x/i.test(k)) || "Longitude";

        const origLatStr = (row[latKey] ?? row["Latitude"] ?? "").trim();
        const origLonStr = (row[lonKey] ?? row["Longitude"] ?? "").trim();

        const id = normalize(
                row["ID Customer"] ??
                row["lD Customer"] ??
                row["Id Customer"] ??
                row[keys[0]] ??
                ""
            );

        if(id==="") continue;

        const username = normalize(row["Username"]);
        const city = normalize(row["City"]);
        const district = normalize(row["District"]);
        const ward = normalize(row["Ward"]);
        const team = normalize(row["Team"]);
        const vendor = normalize(row["Vendor"]||team);
        const site = normalize(row["Site Name"] ?? row["CEK SITE NAME SYSTEM"] ?? "");
        const status = normalize(row["Status Instalasi/Maintenence"] ?? row["Status Instalasi/Maintenance"] ?? "");
        const visitDate = normalize(row["Visit Date"]);

        // Read raw numeric tokens first
        let rawLat = sanitizeNumberString(row[latKey] ?? row["Latitude"] ?? "");
        let rawLon = sanitizeNumberString(row[lonKey] ?? row["Longitude"] ?? "");

        // Detect likely swapped lat/lon BEFORE scaling (CSV sometimes has lon in latitude column)
        let swapped = false;
        if (Number.isFinite(rawLat) && Number.isFinite(rawLon)){
            if (Math.abs(rawLat) > 90 && Math.abs(rawLon) <= 90) {
                const t = rawLat; rawLat = rawLon; rawLon = t; swapped = true;
            } else if ((rawLat >= 111 && rawLat <= 115) && (rawLon <= -6 && rawLon >= -8)) {
                const t = rawLat; rawLat = rawLon; rawLon = t; swapped = true;
            }
        }

        // Apply million-scale correction AFTER swap detection
        let lat = rawLat;
        let lon = rawLon;
        if (Number.isFinite(lat) && Math.abs(lat) > 90) lat /= 1000000;
        if (Number.isFinite(lon) && Math.abs(lon) > 180) lon /= 1000000;

        if (swapped) {
            swappedCount++;
        }

        const origZero = (origLatStr !== '' && origLonStr !== '' && Number(origLatStr) === 0 && Number(origLonStr) === 0);
        let invalidCoord = (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) < 1e-6 || Math.abs(lon) < 1e-6 || origZero);

        if (!invalidCoord && !isWithinIndonesiaBounds(lat, lon)) {
            // If the coordinate resolves to a point outside our target area, prefer ward centroid.
            outOfBoundsCount++;
            invalidCoord = true;
        }

        let resolvedBy = 'original';
        if (invalidCoord) {
            invalidCoordCount++;
            let coord = getCoordinateFromCsvWard(city, district, ward);
            resolvedBy = 'csvWard';

            if (!coord) {
                coord = getCoordinateFromWard(city, district, ward);
                resolvedBy = 'wardIndex';
            }

            if (coord) {
                wardResolvedCount++;
                if (wardResolvedSamples.length < 50) wardResolvedSamples.push({ id, city, district, ward, originalLat: origLatStr, originalLon: origLonStr, resolvedBy, matchedKey: coord.matchedKey || null, resolvedLat: coord.latitude, resolvedLon: coord.longitude });
                lat = coord.latitude;
                lon = coord.longitude;
            } else {
                defaultedCount++;
                if (unresolvedSamples.length < 50) unresolvedSamples.push({ id, city, district, ward, originalLat: origLatStr, originalLon: origLonStr });
                const cityFallback = getCoordinateFromCity(city);
                if (cityFallback) {
                    lat = cityFallback.latitude;
                    lon = cityFallback.longitude;
                    resolvedBy = 'cityFallback';
                } else {
                    lat = -7.33;
                    lon = 112.73;
                    resolvedBy = 'default';
                }
            }
        }

        const customer = {
            id,
            username,
            city,
            district,
            ward,
            site,
            team,
            vendor,
            status,
            visitDate,
            latitude: lat,
            longitude: lon,
            resolvedBy
        };

        customers.push(customer);
    }

    // diagnostics to console (not required)
    console.log('parseCustomerData: totalRaw=', raw.length,
        'customersParsed=', customers.length,
        'invalidCoordCount=', invalidCoordCount,
        'wardResolved=', wardResolvedCount,
        'defaulted=', defaultedCount,
        'swapped=', swappedCount,
        'outOfBounds=', outOfBoundsCount);

    if (unresolvedSamples.length > 0) {
        console.warn('[CUSTOMER_MAP] unresolvedSamples=', unresolvedSamples.slice(0, 20));
    }

    if (wardResolvedSamples.length > 0) {
        console.log('[CUSTOMER_MAP] wardResolvedSamples=', wardResolvedSamples.slice(0, 20));
    }

    return customers;

}

/* =========================================================
   MARKER STYLE
   ========================================================= */

function createMarkerStyle(customer) {

    if (typeof DEBUG_HIGHLIGHT_MARKERS !== 'undefined' && DEBUG_HIGHLIGHT_MARKERS) {
        // High-visibility debug style
        return new ol.style.Style({
            image: new ol.style.Circle({
                radius: 12,
                fill: new ol.style.Fill({ color: 'rgba(220,20,60,0.95)' }), // crimson
                stroke: new ol.style.Stroke({ color: '#000000', width: 2 })
            })
        });
    }

    return new ol.style.Style({

        image: new ol.style.Circle({

            radius: 7,

            fill: new ol.style.Fill({
                color: getStatusColor(customer.status)
            }),

            stroke: new ol.style.Stroke({
                color: "#ffffff",
                width: 2
            })

        })

    });

}

/* =========================================================
   CREATE MAP LAYER
   ========================================================= */

function createCustomerLayer() {

    // Avoid recreating layer if it already exists (prevents other scripts from wiping it)
    if (customerLayer && customerSource) {
        try { if (typeof customerLayer.setZIndex === 'function') customerLayer.setZIndex(99999); } catch(e){}
        try {
            if (typeof map !== 'undefined' && map && typeof map.getLayers === 'function') {
                const layers = map.getLayers().getArray();
                if (!layers.includes(customerLayer)) {
                    map.addLayer(customerLayer);
                }
            }
        } catch (e) {
            console.warn('createCustomerLayer: failed to re-add existing customer layer', e);
        }
        return;
    }

    // remove any stale customer layers remaining from previous script reloads
    try {
        removeStaleCustomerLayers();
    } catch (e) {
        console.warn('createCustomerLayer: failed to cleanup existing customer layers', e);
    }

    customerSource = new ol.source.Vector();

    // Shared style cache and style function to avoid creating one style per feature (big perf win)
    if (!window._customer_style_cache) window._customer_style_cache = {};
    const customerStyleFunction = function(feature) {
        const status = feature.get('customer') && feature.get('customer').status ? feature.get('customer').status : '';
        const key = getStatusKey(status);
        if (window._customer_style_cache[key]) return window._customer_style_cache[key];
        // Create a single shared style per status
        const st = new ol.style.Style({
            image: new ol.style.Circle({
                radius: (typeof DEBUG_HIGHLIGHT_MARKERS !== 'undefined' && DEBUG_HIGHLIGHT_MARKERS) ? 12 : 7,
                fill: new ol.style.Fill({ color: (typeof DEBUG_HIGHLIGHT_MARKERS !== 'undefined' && DEBUG_HIGHLIGHT_MARKERS) ? 'rgba(220,20,60,0.95)' : getStatusColor(status) }),
                stroke: new ol.style.Stroke({ color: (typeof DEBUG_HIGHLIGHT_MARKERS !== 'undefined' && DEBUG_HIGHLIGHT_MARKERS) ? '#000' : '#ffffff', width: 2 })
            })
        });
        window._customer_style_cache[key] = st;
        return st;
    };

    customerLayer = new ol.layer.Vector({

            source: customerSource,

            // render as image for faster drawing of many points (reduces DOM/Canvas pressure)
            renderMode: 'image',
            declutter: true,

            style: customerStyleFunction,

            properties: {
                title: "Customer",
                customerLayer: true
            }

        });

    if (typeof map === 'undefined') {
        console.error('createCustomerLayer: OpenLayers map is undefined.');
        return;
    }

    map.addLayer(customerLayer);
    try {
        if (typeof customerLayer.setZIndex === 'function') customerLayer.setZIndex(99999);
    } catch(e){ }
}

/* =========================================================
   DRAW MARKERS
   ========================================================= */

function drawCustomers(data){

    customerDrawVersion++;

    console.log('drawCustomers: incoming data length=', Array.isArray(data)?data.length:0, 'drawVersion=', customerDrawVersion);

    if(!customerSource) {
        console.error('drawCustomers: customerSource is not initialized');
        return;
    }

    if (customerDrawTimeout) {
        try { clearTimeout(customerDrawTimeout); } catch (e) { }
        customerDrawTimeout = null;
    }

    try { if (customerSource && typeof customerSource.clear === 'function') customerSource.clear(); } catch (e) {}
    try { if (customerLayer && customerLayer.getSource && customerLayer.getSource() && typeof customerLayer.getSource().clear === 'function') customerLayer.getSource().clear(); } catch (e) {}

    const originalFeatures = [];
    const adjustedFeatures = [];
    const skippedSamples = [];

    // Group customers by ID: if multiple rows share same ID, aggregate them into single marker
    const idMap = new Map();

    data.forEach((customer, idx) => {
        if (idx < 10) {
            try { console.log(`drawCustomers: sample[${idx}] id=${customer.id} lat=${customer.latitude} lon=${customer.longitude} resolvedBy=${customer.resolvedBy || 'original'}`); } catch(e) {}
        }
        const id = String(customer.id || '');
        if (!idMap.has(id)) idMap.set(id, []);
        idMap.get(id).push(customer);
    });

    const makeFeature = customer => {
        const feat = new ol.Feature({
            geometry: new ol.geom.Point(
                ol.proj.fromLonLat([
                    Number(customer.longitude),
                    Number(customer.latitude)
                ])
            ),
            customer
        });
        try{ feat.set('drawVersion', customerDrawVersion); }catch(e){}
        try{ if (customer && typeof customer === 'object') customer.__drawVersion = customerDrawVersion; }catch(e){}
        return feat;
    };

    let individualCount = 0;
    for (const [id, members] of idMap.entries()) {
        if (!members || members.length === 0) continue;

        const chooseRepresentative = items => items.find(m => {
            const la = Number(m.latitude);
            const lo = Number(m.longitude);
            return Number.isFinite(la) && Number.isFinite(lo) && Math.abs(la) > 1e-6 && Math.abs(lo) > 1e-6;
        }) || items[0];

        if (members.length === 1) {
            const customer = members[0];
            const lat = Number(customer.latitude);
            const lon = Number(customer.longitude);
            if (Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) > 1e-6 && Math.abs(lon) > 1e-6) {
                const feature = makeFeature(customer);
                if (customer.resolvedBy && customer.resolvedBy !== 'original') {
                    adjustedFeatures.push(feature);
                } else {
                    originalFeatures.push(feature);
                }
                individualCount++;
            } else {
                if (skippedSamples.length < 20) skippedSamples.push({id: customer.id, lat: customer.latitude, lon: customer.longitude});
            }
        } else {
            const rep = chooseRepresentative(members);
            const lat = Number(rep.latitude);
            const lon = Number(rep.longitude);
            if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) <= 1e-6 || Math.abs(lon) <= 1e-6) {
                if (skippedSamples.length < 20) skippedSamples.push({id: id, count: members.length, lat: rep.latitude, lon: rep.longitude});
                continue;
            }
            const sampleCustomer = {
                id: id,
                username: rep.username || '',
                city: rep.city || '',
                district: rep.district || '',
                ward: rep.ward || '',
                site: rep.site || '',
                team: rep.team || '',
                vendor: rep.vendor || '',
                status: rep.status || '',
                visitDate: rep.visitDate || '',
                latitude: lat,
                longitude: lon,
                groupCount: members.length,
                groupMembers: members,
                resolvedBy: rep.resolvedBy || 'original'
            };
            const feature = makeFeature(sampleCustomer);
            if (sampleCustomer.resolvedBy && sampleCustomer.resolvedBy !== 'original') {
                adjustedFeatures.push(feature);
            } else {
                originalFeatures.push(feature);
            }
        }
    }

    const totalFeatures = originalFeatures.length + adjustedFeatures.length;
    console.log('drawCustomers: immediateFeatures=', originalFeatures.length, 'adjustedFeatures=', adjustedFeatures.length, 'skippedSamples=', skippedSamples.length, 'individualCount=', individualCount, 'idGroups=', idMap.size, 'totalFeatures=', totalFeatures);

    try {
        if (typeof map !== 'undefined' && map && map.getView && typeof map.getView === 'function') {
            const center = ol.proj.toLonLat(map.getView().getCenter());
            console.log('drawCustomers: map center (lon,lat)=', center, 'zoom=', map.getView().getZoom());
        }
    } catch (e) {}

    const addFeaturesInBatches = (features, chunkSize = 5000) => {
        const drawVersion = customerDrawVersion;
        let added = 0;
        const addBatch = () => {
            if (drawVersion !== customerDrawVersion) return;
            const chunk = features.slice(added, added + chunkSize);
            if (chunk.length === 0) return;
            try {
                customerSource.addFeatures(chunk);
                added += chunk.length;
                if (typeof map !== 'undefined' && map && typeof map.render === 'function') {
                    try { map.render(); } catch (e) {}
                }
                // remove any leftover features from previous draws whose drawVersion doesn't match
                try{
                    const all = customerSource.getFeatures();
                    for (let i = all.length - 1; i >= 0; i--) {
                        const f = all[i];
                        const dv = f.get && f.get('drawVersion');
                        if (dv !== drawVersion) {
                            customerSource.removeFeature(f);
                        }
                    }
                }catch(e){}
            } catch (e) {
                console.error('drawCustomers: error adding feature chunk', e);
            }
            if (added < features.length && drawVersion === customerDrawVersion) {
                customerDrawTimeout = setTimeout(addBatch, 0);
            }
        };
        addBatch();
    };

    if (originalFeatures.length > 0) {
        if (originalFeatures.length <= 5000) {
            customerSource.addFeatures(originalFeatures);
        } else {
            addFeaturesInBatches(originalFeatures, 5000);
        }
    }

    if (adjustedFeatures.length > 0) {
        customerDrawTimeout = setTimeout(() => {
            const active = (drawVersion => {
                if (drawVersion !== customerDrawVersion) return false;
                addFeaturesInBatches(adjustedFeatures, 3000);
                return true;
            })(customerDrawVersion);
            if (!active) customerDrawTimeout = null;
        }, 0);
    }

    if (originalFeatures.length === 0 && adjustedFeatures.length === 0) {
        console.warn('drawCustomers: no features added after grouping');
    }

    try {
        if (typeof map !== 'undefined' && map && typeof map.getLayers === 'function') {
            if (customerLayer && typeof customerLayer.setZIndex === 'function') customerLayer.setZIndex(99999);
        }
    } catch (e) {}
}


/* =========================================================
   POPUP
   ========================================================= */

function showCustomerPopup(customer) {

    const popup =
        document.getElementById(
            "popup-content"
        );

    const statusKey =
        getStatusKey(
            customer.status
        );

    const statusColor =
        STATUS_CONFIG[
            statusKey
        ].color;

    let gps = "";

    if (
Number.isFinite(customer.latitude) &&
Number.isFinite(customer.longitude)
    ) {

        gps =
            `
            <a
                class="gps-button"
                target="_blank"
                href="https://www.google.com/maps/dir/?api=1&destination=${customer.latitude},${customer.longitude}"
            >
                📍 Buka GPS / Google Maps
            </a>
            `;

    }

    // If this feature represents an aggregated customer ID, render members list with full details.
    let membersHtml = '';
    if (customer && customer.groupCount && Array.isArray(customer.groupMembers)) {
        const membersToShow = customer.groupMembers.slice(0, 200);
        const listItems = membersToShow.map(m => {
            const details = [
                m.username,
                m.site,
                m.status,
                m.visitDate,
                m.city && m.district && m.ward ? `${m.city} / ${m.district} / ${m.ward}` : ''
            ].filter(Boolean).join(' — ');
            return `<li>${m.id}${details ? ' — ' + details : ''}</li>`;
        }).join('');
        const truncatedNote = customer.groupCount > membersToShow.length
            ? `<li>...dan ${customer.groupCount - membersToShow.length} data lain tidak ditampilkan</li>`
            : '';
        membersHtml = `
            <tr>
                <td>Group Members (${customer.groupCount})</td>
                <td style="max-height:260px; overflow:auto;">
                    <ul style="margin:0; padding-left:16px;">${listItems}${truncatedNote}</ul>
                </td>
            </tr>
        `;
    }

    const idDisplay = customer.id || '';

    popup.innerHTML = `

        <div class="customer-popup">

            <table>

                <tr>
                    <td>ID Customer</td>
                    <td>${idDisplay}</td>
                </tr>

                ${customer.groupCount && customer.groupCount > 1 ? `
                <tr>
                    <td>Jumlah ID Customer</td>
                    <td>${customer.groupCount}</td>
                </tr>
                ` : ''}

                <tr>
                    <td>Username</td>
                    <td>${customer.username}</td>
                </tr>

                <tr>
                    <td>Vendor / Team</td>
                    <td>${customer.vendor}</td>
                </tr>

                <tr>
                    <td>City</td>
                    <td>${customer.city}</td>
                </tr>

                <tr>
                    <td>District</td>
                    <td>${customer.district}</td>
                </tr>

                <tr>
                    <td>Ward</td>
                    <td>${customer.ward}</td>
                </tr>

                <tr>
                    <td>Site</td>
                    <td>${customer.site}</td>
                </tr>

                ${customer.resolvedBy && customer.resolvedBy !== 'original' ? `
                <tr>
                    <td>Resolved By</td>
                    <td>${customer.resolvedBy}</td>
                </tr>
                ` : ''}

                <tr>
                    <td>Status</td>

                    <td style="
                        font-weight:bold;
                        color:${statusColor};
                    ">
                        ${customer.status}
                    </td>
                </tr>
                <tr>
                    <td>Visit Date</td>
                    <td>${customer.visitDate}</td>
                </tr>

                <tr>
                    <td>Latitude</td>
                    <td>${customer.latitude}</td>
                </tr>

                <tr>
                    <td>Longitude</td>
                    <td>${customer.longitude}</td>
                </tr>

                ${membersHtml}

            </table>

            ${gps}

        </div>

    `;

    if (
        typeof overlay !==
        "undefined"
    ) {

        overlay.setPosition(
            ol.proj.fromLonLat([
                customer.longitude,
                customer.latitude
            ])
        );

    }

}


/* =========================================================
   MAP CLICK
   ========================================================= */

function setupMapClick() {

    map.on(
        "singleclick",
        function(event) {

            const feature =
                map.forEachFeatureAtPixel(
                    event.pixel,
                    function(feature) {

                        return feature;

                    }
                );

            if (!feature)
                return;

            const customer =
                feature.get(
                    "customer"
                );

            if (customer)
                showCustomerPopup(
                    customer
                );

        }
    );

}


/* =========================================================
   UNIQUE VALUES
   ========================================================= */

function uniqueValues(
    data,
    field
) {

    return [
        ...new Set(

            data
                .map(
                    item =>
normalize(
                            item[field]
                        )
                )
                .filter(Boolean)

        )
    ]
    .sort(
        (a, b) =>
            a.localeCompare(
                b,
                "id"
            )
    );

}


/* =========================================================
   FILL SELECT
   ========================================================= */

function fillSelect(
    id,
    values,
    firstText
) {

    const select =
        document.getElementById(id);

    if (!select)
        return;

    select.innerHTML =
        `<option value="">
            ${firstText}
        </option>`;

    values.forEach(value => {

        const option =
            document.createElement(
                "option"
            );

        option.value = value;

        option.textContent =
            value;

        select.appendChild(
            option
        );

    });

}


/* =========================================================
   FILTER OPTIONS
   ========================================================= */

function updateFilters() {

    const normalizeFilterValue = value => {
        const normalized = normalize(value || "").toLowerCase();
        if (normalized.startsWith("semua") || normalized.startsWith("all")) return "";
        return value || "";
    };

    const team =
        normalizeFilterValue(document.getElementById("filter-team")?.value || "");

    const status =
        normalizeFilterValue(document.getElementById("filter-status")?.value || "");

    const city =
        normalizeFilterValue(document.getElementById("filter-city")?.value || "");

    const district =
        normalizeFilterValue(document.getElementById("filter-district")?.value || "");

    const ward =
        normalizeFilterValue(document.getElementById("filter-ward")?.value || "");


    // Filter dasar (TIDAK memakai search-id)
    let temp = customers.filter(c => {

        return (

            (!team ||
                c.vendor === team ||
                c.team === team)

            &&

            (!status ||
                c.status === status)

            &&

            (!city ||
                c.city === city)

        );

    });


    // ==========================
    // District
    // ==========================

    const districtValues =
        uniqueValues(temp, "district");

    fillSelect(
        "filter-district",
        districtValues,
        "Semua Kecamatan"
    );

    if (
        district &&
        districtValues.includes(district)
    ) {
        document.getElementById(
            "filter-district"
        ).value = district;
    }


    // ==========================
    // Ward
    // ==========================

    let wardData = temp;

    if (district) {

        wardData = temp.filter(
            c => c.district === district
        );

    }

    const wardValues =
        uniqueValues(wardData, "ward");

    fillSelect(
        "filter-ward",
        wardValues,
        "Semua Kelurahan"
    );

    if (
        ward &&
        wardValues.includes(ward)
    ) {
        document.getElementById(
            "filter-ward"
        ).value = ward;
    }

}

/* =========================================================
   APPLY FILTER
   ========================================================= */

function applyFilters() {

    const normalizeFilterValue = value => {
        const normalized = normalize(value || "").toLowerCase();
        if (normalized.startsWith("semua") || normalized.startsWith("all")) return "";
        return value || "";
    };

    const team =
        normalizeFilterValue(document.getElementById("filter-team")?.value || "");

    const status =
        normalizeFilterValue(document.getElementById("filter-status")?.value || "");

    const city =
        normalizeFilterValue(document.getElementById("filter-city")?.value || "");

    const district =
        normalizeFilterValue(document.getElementById("filter-district")?.value || "");

    const ward =
        normalizeFilterValue(document.getElementById("filter-ward")?.value || "");

    const keyword =
normalize(
            document.getElementById("search-id")?.value
        ).toLowerCase();


    const filtered = customers.filter(c => {

        return (

            (!team ||
                c.vendor === team ||
                c.team === team
            )

            &&

            (!status ||
                c.status === status
            )

            &&

            (!city ||
                c.city === city
            )

            &&

            (!district ||
                c.district === district
            )

            &&

            (!ward ||
                c.ward === ward
            )

            &&

            (!keyword ||
normalize(c.id)
                .toLowerCase()
                .includes(keyword)
            )

        );

    });


    drawCustomers(filtered);

    updateSummary(filtered);

    updateChart(filtered);

}

/* =========================================================
   SUMMARY
   ========================================================= */

function updateSummary(data) {

    const total = document.getElementById("total-customer");
    const ward = document.getElementById("total-ward");

    // Total customer
    const totalCustomer = data.length;

    // Total status DONE
    const totalDone = data.filter(c =>
        getStatusKey(c.status) === "done"
    ).length;

    if (total) {
        total.innerHTML = `${totalDone} / ${totalCustomer}`;
        // atau:
        // total.innerHTML = `${totalDone}<br><small>of ${totalCustomer}</small>`;
    }

    if (ward) {
        ward.textContent = new Set(
            data
                .map(c => c.ward)
                .filter(Boolean)
        ).size;
    }

}

/* =========================================================
   CHART STATUS
   ========================================================= */

function updateChart(data) {

    const count = {

        pending: 0,

        reschedule: 0,

        done: 0,

        cancel: 0,

        default: 0

    };


    data.forEach(c => {

        count[
            getStatusKey(
                c.status
            )
        ]++;

    });


    const labels = [

        "🔴 Pending",

        "🔵 Reschedule",

        "🟢 Done",

        "🟣 Cancel",

        "⚪ Lainnya"

    ];


    const values = [

        count.pending,

        count.reschedule,

        count.done,

        count.cancel,

        count.default

    ];


    const colors = [

        STATUS_CONFIG.pending.color,

        STATUS_CONFIG.reschedule.color,

        STATUS_CONFIG.done.color,

        STATUS_CONFIG.cancel.color,

        STATUS_CONFIG.default.color

    ];


    const canvas =
        document.getElementById(
            "ward-chart"
        );

    if (!canvas || typeof Chart !== "function")
        return;

    if (wardChart)
        wardChart.destroy();

    wardChart = new Chart(
            canvas,
            {

                type: "pie",

                data: {

                    labels: labels,

                    datasets: [{

                        data: values,

                        backgroundColor:
                            colors

                    }]

                },

                options: {

                    responsive: true,

                    plugins: {

                        legend: {

                            position:
                                "bottom"

                        }

                    }

                }

            }
        );


    updateLegend(
        count
    );

}


/* =========================================================
   LEGEND
   ========================================================= */

function updateLegend(count) {

    const legend =
        document.getElementById(
            "legend"
        );

    if (!legend)
        return;

    legend.innerHTML = "";


    Object.keys(
        STATUS_CONFIG
    ).forEach(key => {

        const config =
            STATUS_CONFIG[key];

        const item =
            document.createElement(
                "div"
            );

        item.className =
            "legend-item";


        item.innerHTML = `

            <span
                class="legend-color"
                style="
                    background:${config.color}
                "
            ></span>

            <span>
                ${config.label}
                :
                ${count[key] || 0}
            </span>

        `;


        legend.appendChild(
            item
        );

    });

}


/* =========================================================
   EVENTS
   ========================================================= */

function setupFilters() {

const search = document.getElementById("search-id");

if (search) {
    search.addEventListener("input", function () {
        applyFilters();
    });
}
    
    const team =
    document.getElementById(
            "filter-team"
        );

    const status =
        document.getElementById(
            "filter-status"
        );

    const city =
        document.getElementById(
            "filter-city"
        );

    const district =
        document.getElementById(
            "filter-district"
        );

    const ward =
        document.getElementById(
            "filter-ward"
        );

    if (team) {

        team.addEventListener(
            "change",
            function() {

                updateFilters();
                applyFilters();

            }
        );

    }


    if (status) {

        status.addEventListener(
            "change",
            function() {

                updateFilters();
                applyFilters();

            }
        );

    }


    if (city) {

        city.addEventListener(
            "change",
            function() {

                updateFilters();
                applyFilters();

            }
        );

    }


    if (district) {

        district.addEventListener(
            "change",
            function() {

                updateFilters();
                applyFilters();

            }
        );

    }


    if (ward) {

        ward.addEventListener(
            "change",
            applyFilters
        );

    }

}


/* =========================================================
   DASHBOARD BUTTON
   ========================================================= */

function setupDashboard() {

    const dashboard =
        document.getElementById(
            "dashboard"
        );

    const close =
        document.getElementById(
            "dashboard-close"
        );

    const toggle =
        document.getElementById(
            "dashboard-toggle"
        );


    if (close) {

        close.onclick =
            function() {

                dashboard.style.display =
                    "none";

                toggle.style.display =
                    "block";

            };

    }


    if (toggle) {

        toggle.onclick =
            function() {

                dashboard.style.display =
                    "block";

                toggle.style.display =
                    "none";

            };

    }

}


/* =========================================================
   LOAD CSV
   ========================================================= */

async function loadData() {

    try {

        // Ensure polygon layers are ready so ward index is accurate
        await waitForLayersReady(5000, 5);
        try { buildWardIndex(); } catch(e){ console.warn('buildWardIndex failed (pre-fetch)', e); }

        // Remove any stale customer layers before loading fresh CSV data
        try { removeStaleCustomerLayers(); } catch(e) { }

        const response = await fetch(DATA_URL + "?v=" + Date.now());

        if (!response.ok) {
            throw new Error("CSV gagal dibaca. HTTP " + response.status);
        }

        const text = await response.text();

        console.log('[CUSTOMER_MAP] loadData start');
        // Faster initial render: show a small immediate subset while full CSV is parsed in the background
        const IMMEDIATE_ROWS = 500;
        const lines = text.split(/\r?\n/).filter(line => line.trim() !== "");

        const t0 = performance.now();

        if (lines.length > 1 + IMMEDIATE_ROWS) {
            // Build a small CSV text containing only header + first IMMEDIATE_ROWS rows
            const previewText = [lines[0]].concat(lines.slice(1, 1 + IMMEDIATE_ROWS)).join('\n');
            customers = parseCustomerData(previewText);
            const t1 = performance.now();
            console.log('[CUSTOMER_MAP] loadData preview customers count=', customers.length, 'previewParseMs=', Math.round(t1 - t0));

            // Populate UI and draw the preview immediately
            fillSelect("filter-team", uniqueValues(customers, "vendor"), "Semua Vendor / Team");
            fillSelect("filter-status", uniqueValues(customers, "status"), "Semua Status");
            fillSelect("filter-city", uniqueValues(customers, "city"), "Semua City");
            fillSelect("filter-district", uniqueValues(customers, "district"), "Semua District");
            fillSelect("filter-ward", uniqueValues(customers, "ward"), "Semua Ward");

            setupFilters();
            setupDashboard();
            setupMapClick();
            createCustomerLayer();
            drawCustomers(customers);
            updateSummary(customers);
            updateChart(customers);

            // Parse the full CSV shortly after to update the UI completely (may be slow on main thread)
            setTimeout(() => {
                const tStartFull = performance.now();
                const fullCustomers = parseCustomerData(text);
                const tEndFull = performance.now();
                console.log('[CUSTOMER_MAP] loadData full customers count=', fullCustomers.length, 'fullParseMs=', Math.round(tEndFull - tStartFull));

                // Replace customers with full set and refresh UI
                customers = fullCustomers;
                fillSelect("filter-team", uniqueValues(customers, "vendor"), "Semua Vendor / Team");
                fillSelect("filter-status", uniqueValues(customers, "status"), "Semua Status");
                fillSelect("filter-city", uniqueValues(customers, "city"), "Semua City");
                fillSelect("filter-district", uniqueValues(customers, "district"), "Semua District");
                fillSelect("filter-ward", uniqueValues(customers, "ward"), "Semua Ward");

                // Re-apply current filters (if any) and redraw
                try { updateFilters(); } catch (e) {}
                applyFilters();

            }, 50);

        } else {
            // Small dataset — parse normally
            customers = parseCustomerData(text);
            const t1 = performance.now();
            console.log('[CUSTOMER_MAP] loadData parsed customers count=', customers.length, 'parseMs=', Math.round(t1 - t0));

            if (customers.length === 0) {
                console.warn('[CUSTOMER_MAP] loadData: no customers parsed from CSV, attempting fallback parse');
                const raw = parseCSV(text);
                customers = fallbackParseCustomerRows(raw);
                console.log('[CUSTOMER_MAP] loadData fallback customers count=', customers.length);
            }

            fillSelect("filter-team", uniqueValues(customers, "vendor"), "Semua Vendor / Team");
            fillSelect("filter-status", uniqueValues(customers, "status"), "Semua Status");
            fillSelect("filter-city", uniqueValues(customers, "city"), "Semua City");
            fillSelect("filter-district", uniqueValues(customers, "district"), "Semua District");
            fillSelect("filter-ward", uniqueValues(customers, "ward"), "Semua Ward");

            setupFilters();
            setupDashboard();
            setupMapClick();
            createCustomerLayer();
            drawCustomers(customers);
            updateSummary(customers);
            updateChart(customers);
        }


    }
catch (error) {

    console.error(error);

    alert(
        "ERROR\n\n" +
        error.name + "\n\n" +
        error.message
    );

}


}

/* =========================================================
   START
   ========================================================= */

async function waitForLayersReady(timeout = 3000, interval = 5) {
    const layers = [lyr_surabaya_2, lyr_SIDOARJO_1];
    const start = Date.now();
    return new Promise(resolve => {
        const check = () => {
            try {
                const ready = layers.every(layer => !layer || !(layer.getSource && typeof layer.getSource().getFeatures === 'function') || layer.getSource().getFeatures().length > 0);
                if (ready || Date.now() - start > timeout) {
                    resolve();
                } else {
                    setTimeout(check, interval);
                }
            } catch (e) {
                resolve();
            }
        };
        check();
    });
}

async function startCustomerMap() {
    const start = Date.now();
    while (typeof map === "undefined" || !map) {
        if (Date.now() - start > 5000) {
            console.error("OpenLayers map belum tersedia setelah 5000ms.");
            return;
        }
        await new Promise(resolve => setTimeout(resolve, 5));
    }

    // Wait a short while for polygon layers to populate features (helps ward lookup)
    await waitForLayersReady(3000, 5);

    try {
        buildWardIndex();
    } catch (e) {
        console.warn('buildWardIndex failed during start', e);
    }

    await loadData();
}

/*
 * Tunggu qgis2web selesai membuat map
 */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        function() {

            setTimeout(
                startCustomerMap,
                5
            );

        }
    );

}
else {

    setTimeout(
        startCustomerMap,
        5
    );

}




