/* =========================================================
   CUSTOMER MAP
   CSV : ./data/customer.csv
   Separator : ;
   ========================================================= */

const DATA_URL = "./data/customer.csv";
// Debug: when true, markers are rendered as large bright red circles to aid visibility while debugging
// Toggle to true to force-visible markers
const DEBUG_HIGHLIGHT_MARKERS = false;

let customers = [];
let customerLayer = null;
let customerSource = null;
let wardChart = null;


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

function isWithinSurabayaBounds(lat, lon){
    return Number.isFinite(lat) && Number.isFinite(lon) &&
        lat >= -8.5 && lat <= -6.0 &&
        lon >= 112.0 && lon <= 113.0;
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
                        const center = ol.extent.getCenter(feature.getGeometry().getExtent());
                        const lonlat = ol.proj.toLonLat(center);
                        const coord = { latitude: lonlat[1], longitude: lonlat[0] };
                        addWardKey(`${rawCity}||${rawDistrict}||${rawWard}`, coord);
                        addWardKey(`${strippedCity}||${rawDistrict}||${rawWard}`, coord);
                        addWardKey(`${rawCity}||${strippedDistrict}||${rawWard}`, coord);
                        addWardKey(`${strippedCity}||${strippedDistrict}||${rawWard}`, coord);
                        addWardKey(`${rawCity}||${rawDistrict}||${wardShort}`, coord);
                        addWardKey(`${strippedCity}||${strippedDistrict}||${wardShort}`, coord);
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
                                    const coord = { latitude: sy / n, longitude: sx / n };
                                    addWardKey(`${rawCity}||${rawDistrict}||${rawWard}`, coord);
                                    addWardKey(`${strippedCity}||${rawDistrict}||${rawWard}`, coord);
                                    addWardKey(`${rawCity}||${strippedDistrict}||${rawWard}`, coord);
                                    addWardKey(`${strippedCity}||${strippedDistrict}||${rawWard}`, coord);
                                    addWardKey(`${rawCity}||${rawDistrict}||${wardShort}`, coord);
                                    addWardKey(`${strippedCity}||${strippedDistrict}||${wardShort}`, coord);
                                    addWardKey(`||${rawDistrict}||${rawWard}`, coord);
                                    addWardKey(`||${rawDistrict}||${wardShort}`, coord);
                                    addWardKey(`||${strippedDistrict}||${wardShort}`, coord);
                                    addWardKey(`||${rawWard}`, coord);
                                    addWardKey(`||${wardShort}`, coord);
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
        addCandidate(candidates, `||${stripAdminPrefixes(nd)}||${wardVariant}`);
        addCandidate(candidates, `||${stripAdminPrefixes(nd)}||${normalize(stripAdminPrefixes(wardVariant))}`);
        addCandidate(candidates, `||${stripAdminPrefixes(nd)}||${normalize(shortWardName(wardVariant))}`);
        addCandidate(candidates, `||${nd}||${wardVariant}`);
        addCandidate(candidates, `||${wardVariant}`);
    }

    for(const k of candidates){
        if(wardIndex.has(k)){
            const c = Object.assign({matchedKey: k}, wardIndex.get(k));
            wardFallbackCache.set(cacheKey, c);
            return c;
        }
    }

    // fallback: try partial/alphanumeric match where ward includes provided ward text (loose)
    const alnum = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g,'');
    const target = alnum(nw);
    if(target){
        for(const [k,v] of wardIndex.entries()){
            try{
                const parts = k.split('||');
                const kWard = parts[2] || '';
                const kWardA = alnum(kWard);
                if(kWardA && (kWardA.includes(target) || target.includes(kWardA))){
                    const c = Object.assign({matchedKey: k}, v);
                    wardFallbackCache.set(cacheKey, c);
                    return c;
                }
            }catch(e){ }
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

    if(raw.length===0) return [];

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

        if (!invalidCoord && !isWithinSurabayaBounds(lat, lon)) {
            // If the coordinate resolves to a point outside our target area, prefer ward centroid.
            outOfBoundsCount++;
            invalidCoord = true;
        }

        if (invalidCoord) {
            invalidCoordCount++;
            const coord = getCoordinateFromWard(city, district, ward);

            if (coord) {
                wardResolvedCount++;
                if (wardResolvedSamples.length < 50) wardResolvedSamples.push({ id, city, district, ward, originalLat: origLatStr, originalLon: origLonStr, matchedKey: coord.matchedKey || null, resolvedLat: coord.latitude, resolvedLon: coord.longitude });
                lat = coord.latitude;
                lon = coord.longitude;
            } else {
                defaultedCount++;
                if (unresolvedSamples.length < 50) unresolvedSamples.push({ id, city, district, ward, originalLat: origLatStr, originalLon: origLonStr });
                // leave as NaN? choose default so marker shows but not grouped
                lat = -7.33;
                lon = 112.73;
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
            longitude: lon
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
        return;
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
                title: "Customer"
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

    console.log('drawCustomers: incoming data length=', Array.isArray(data)?data.length:0);

    if(!customerSource) {
        console.error('drawCustomers: customerSource is not initialized');
        return;
    }

    customerSource.clear();

        const featuresArr = [];

        // log a small sample of incoming customers for debugging
        const skippedSamples = [];

        // Group customers by ID: if multiple rows share same ID, aggregate them into single marker
        const idMap = new Map();

        data.forEach((customer, idx) => {
            // debug: log first few coordinates and ensure they look sane
            if (idx < 10) {
                try{ console.log(`drawCustomers: sample[${idx}] id=${customer.id} lat=${customer.latitude} lon=${customer.longitude}`); } catch(e){}
            }
            const id = String(customer.id || '');
            if (!idMap.has(id)) idMap.set(id, []);
            idMap.get(id).push(customer);
        });

        let individualCount = 0;
        for (const [id, members] of idMap.entries()) {
            if (!members || members.length === 0) continue;
            if (members.length === 1) {
                const customer = members[0];
                const lat = Number(customer.latitude);
                const lon = Number(customer.longitude);
                if (Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) > 1e-6 && Math.abs(lon) > 1e-6) {
                    const feature = new ol.Feature({
                        geometry: new ol.geom.Point(
                            ol.proj.fromLonLat([
                                lon,
                                lat
                            ])
                        ),
                        customer: customer
                    });
                    featuresArr.push(feature);
                    individualCount++;
                } else {
                    if (skippedSamples.length < 20) skippedSamples.push({id: customer.id, lat: customer.latitude, lon: customer.longitude});
                }
            } else {
                // aggregate members into one marker (id collision)
                // pick first member with valid coords as representative
                let rep = members.find(m => {
                    const la = Number(m.latitude); const lo = Number(m.longitude);
                    return Number.isFinite(la) && Number.isFinite(lo) && Math.abs(la) > 1e-6 && Math.abs(lo) > 1e-6;
                }) || members[0];
                const lat = Number(rep.latitude); const lon = Number(rep.longitude);
                if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
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
                    groupMembers: members
                };
                const feature = new ol.Feature({
                    geometry: new ol.geom.Point(
                        ol.proj.fromLonLat([
                            lon,
                            lat
                        ])
                    ),
                    customer: sampleCustomer
                });
                featuresArr.push(feature);
            }
        }

        console.log('drawCustomers: features to add=', featuresArr.length, 'skippedSamples=', skippedSamples.length, 'individualCount=', individualCount, 'idGroups=', idMap.size);

        try{ if (typeof map !== 'undefined' && map && map.getView && typeof map.getView === 'function'){
            const center = ol.proj.toLonLat(map.getView().getCenter());
            console.log('drawCustomers: map center (lon,lat)=', center, 'zoom=', map.getView().getZoom());
        }}catch(e){}

        if (featuresArr.length) {
            // If the dataset is small, add all features at once for fastest rendering
            if (featuresArr.length <= 5000) {
                customerSource.addFeatures(featuresArr);
                try{ if (typeof map !== 'undefined' && map && typeof map.render === 'function') map.render(); }catch(e){}
            } else {
                // Large dataset: add in larger batches with minimal yielding
                const batchSize = 10000; // larger batch for speed
                let added = 0;
                function addBatch(){
                    const chunk = featuresArr.slice(added, added + batchSize);
                    if (chunk.length === 0) return;
                    try{
                        customerSource.addFeatures(chunk);
                        added += chunk.length;
                        if (typeof map !== 'undefined' && map && typeof map.render === 'function') try{ map.render(); }catch(e){}
                    }catch(e){
                        console.error('drawCustomers: error adding feature chunk', e);
                    }
                    if (added < featuresArr.length) {
                        // yield to the event loop but as little as possible
                        setTimeout(addBatch, 0);
                    }
                }
                addBatch();
            }
        }

        // Log map layer list and ensure the customer layer is present and top-most
        try{
            if (typeof map !== 'undefined' && map && typeof map.getLayers === 'function'){
                // ensure the customer layer remains on top
                if (customerLayer && typeof customerLayer.setZIndex === 'function') customerLayer.setZIndex(99999);
            }
        }catch(e){ }

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

    // If this feature represents an aggregated ward group, render members list
    let membersHtml = '';
    if (customer && customer.groupCount && Array.isArray(customer.groupMembers)) {
        const listItems = customer.groupMembers.slice(0,50).map(m => `<li>${m.id}${m.username ? ' — ' + m.username : ''}${m.site ? ' — ' + m.site : ''}</li>`).join('');
        membersHtml = `
            <tr>
                <td>Group Members (${customer.groupCount})</td>
                <td style="max-height:200px; overflow:auto;">
                    <ul style="margin:0; padding-left:16px;">${listItems}</ul>
                </td>
            </tr>
        `;
    }

    popup.innerHTML = `

        <div class="customer-popup">

            <table>

                <tr>
                    <td>ID Customer</td>
                    <td>${customer.id}</td>
                </tr>

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

    const team =
        document.getElementById("filter-team")?.value || "";

    const status =
        document.getElementById("filter-status")?.value || "";

    const city =
        document.getElementById("filter-city")?.value || "";

    const district =
        document.getElementById("filter-district")?.value || "";

    const ward =
        document.getElementById("filter-ward")?.value || "";


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

    const team =
        document.getElementById("filter-team")?.value || "";

    const status =
        document.getElementById("filter-status")?.value || "";

    const city =
        document.getElementById("filter-city")?.value || "";

    const district =
        document.getElementById("filter-district")?.value || "";

    const ward =
        document.getElementById("filter-ward")?.value || "";

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
        await waitForLayersReady(5000, 200);
        try { buildWardIndex(); } catch(e){ console.warn('buildWardIndex failed (pre-fetch)', e); }

        const response = await fetch(DATA_URL + "?v=" + Date.now());

        if (!response.ok) {
            throw new Error("CSV gagal dibaca. HTTP " + response.status);
        }

        const text = await response.text();

        const t0 = performance.now();
        customers = parseCustomerData(text);
        const t1 = performance.now();
        console.log('loadData: parsed customers count=', customers.length, 'parseMs=', Math.round(t1-t0));
        if (customers.length === 0) console.warn('loadData: no customers parsed from CSV');

        // Update filters and summary immediately for fast UI response (<5ms for typical datasets)
        const t2 = performance.now();
        fillSelect('filter-team', uniqueValues(customers, 'vendor'), 'Semua Vendor / Team');
        fillSelect('filter-status', uniqueValues(customers, 'status'), 'Semua Status');
        fillSelect('filter-city', uniqueValues(customers, 'city'), 'Semua City');
        fillSelect('filter-district', uniqueValues(customers, 'district'), 'Semua District');
        fillSelect('filter-ward', uniqueValues(customers, 'ward'), 'Semua Ward');
        updateSummary(customers);
        updateChart(customers);
        const t3 = performance.now();
        console.log('loadData: updated UI controls ms=', Math.round(t3-t2));

        // Defer heavy marker rendering to next tick so UI becomes interactive quickly
        setTimeout(()=>{
            drawCustomers(customers);
        }, 0);


        /*
         * Buat layer
         */

        createCustomerLayer();


        /*
         * Isi Vendor / Team
         */

        fillSelect(

            "filter-team",

            uniqueValues(
                customers,
                "vendor"
            ),

            "Semua Vendor / Team"

        );


        /*
         * Isi Status
         */

        fillSelect(

            "filter-status",

            uniqueValues(
                customers,
                "status"
            ),

            "Semua Status"

        );


        /*
         * Isi City
         */

        fillSelect(

            "filter-city",

            uniqueValues(
                customers,
                "city"
            ),

            "Semua City"

        );


        /*
         * Isi District
         */

        fillSelect(

            "filter-district",

            uniqueValues(
                customers,
                "district"
            ),

            "Semua District"

        );


        /*
         * Isi Ward
         */

        fillSelect(

            "filter-ward",

            uniqueValues(
                customers,
                "ward"
            ),

            "Semua Ward"

        );


        setupFilters();
        setupDashboard();

        setupMapClick();


        /*
         * Tampilkan marker
         */

        drawCustomers(
            customers
        );


        updateSummary(
            customers
        );


        updateChart(
            customers
        );


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

async function waitForLayersReady(timeout = 3000, interval = 200) {
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
    if (typeof map === "undefined") {
        console.error("OpenLayers map belum tersedia.");
        return;
    }

    // Wait a short while for polygon layers to populate features (helps ward lookup)
    await waitForLayersReady(3000, 200);

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
                500
            );

        }
    );

}
else {

    setTimeout(
        startCustomerMap,
        500
    );

}




