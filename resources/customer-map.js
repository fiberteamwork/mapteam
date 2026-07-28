/* =========================================================
   CUSTOMER MAP
   CSV : ./data/customer.csv
   Separator : ;
   ========================================================= */

const DATA_URL = "./data/customer.csv";

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
   NORMALIZE TEXT
   ========================================================= */

function normalize(value) {

    return String(value ?? "")
        .trim()
        .replace(/\s+/g, " ");

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

    text = text.replace(/^\uFEFF/, "");

    const lines = text
        .split(/\r?\n/)
        .filter(line => line.trim() !== "");

    if (!lines.length)
        return [];

    const headers = lines[0]
        .split(";")
        .map(h => normalize(h));

    console.log("CSV HEADER:", headers);

    const result = [];

    for (let i = 1; i < lines.length; i++) {

        const cols = lines[i].split(";");

        const row = {};

        headers.forEach((header, index) => {

            row[header] =
                normalize(cols[index] ?? "");

        });

        result.push(row);
    }

    return result;

}


/* =========================================================
   PARSE CUSTOMER DATA
   ========================================================= */

function parseCustomerData(text) {

    const raw = parseCSV(text);

    console.log(
        "CSV RAW ROW:",
        raw.length
    );

    return raw
        .map(row => {

            /*
             * CSV utama:
             *
             * ID Customer
             * Username
             * City
             * District
             * Ward
             * CEK SITE NAME SYSTEM
             * Team
             * Status Instalasi/Maintenance
             * Visit Date
             * Latitude
             * Longitude
             */

            const team =
                normalize(
                    row["Team"]
                );

            /*
             * Jika CSV memiliki Vendor
             * gunakan Vendor.
             *
             * Kalau tidak ada,
             * Vendor otomatis = Team.
             */

            const vendor =
                normalize(
                    row["Vendor"]
                ) || team;

            const lat =
                parseFloat(
                    normalize(
                        row["Latitude"]
                    ).replace(",", ".")
                );

            const lon =
                parseFloat(
                    normalize(
                        row["Longitude"]
                    ).replace(",", ".")
                );

            return {

                id:
                    normalize(
                        row["ID Customer"]
                    ),

                username:
                    normalize(
                        row["Username"]
                    ),

                city:
                    normalize(
                        row["City"]
                    ),

                district:
                    normalize(
                        row["District"]
                    ),

                ward:
                    normalize(
                        row["Ward"]
                    ),

                site:
                    normalize(
                        row["CEK SITE NAME SYSTEM"]
                    ),

                team: team,

                vendor: vendor,

                status:
                    normalize(
                        row[
                            "Status Instalasi/Maintenance"
                        ]
                    ),

                visitDate:
                    normalize(
                        row["Visit Date"]
                    ),

                latitude: lat,

                longitude: lon

            };

        })
        .filter(row => {

            return (
                row.id !== "" &&
                Number.isFinite(row.latitude) &&
                Number.isFinite(row.longitude) &&
                row.latitude !== 0 &&
                row.longitude !== 0
            );

        });

}


/* =========================================================
   MARKER STYLE
   ========================================================= */

function createMarkerStyle(customer) {

    const color =
        getStatusColor(
            customer.status
        );

    return new ol.style.Style({

        image:
            new ol.style.Circle({

                radius: 7,

                fill:
                    new ol.style.Fill({
                        color: color
                    }),

                stroke:
                    new ol.style.Stroke({
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

    customerSource =
        new ol.source.Vector();

    customerLayer =
        new ol.layer.Vector({

            source: customerSource,

            properties: {
                title: "Customer"
            },

            zIndex: 999

        });

    map.addLayer(
        customerLayer
    );

}


/* =========================================================
   DRAW MARKERS
   ========================================================= */

function drawCustomers(data) {

    if (!customerSource)
        return;

    customerSource.clear();

    data.forEach(customer => {

        const feature =
            new ol.Feature({

                geometry:
                    new ol.geom.Point(
                        ol.proj.fromLonLat([
                            customer.longitude,
                            customer.latitude
                        ])
                    ),

                customer:
                    customer

            });

        feature.setStyle(
            createMarkerStyle(
                customer
            )
        );

        customerSource.addFeature(
            feature
        );

    });

    console.log(
        "MARKER DITAMPILKAN:",
        data.length
    );

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
        Number.isFinite(
            customer.latitude
        ) &&
        Number.isFinite(
            customer.longitude
        )
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

    const city =
        document.getElementById(
            "filter-city"
        )?.value || "";

    const district =
        document.getElementById(
            "filter-district"
        )?.value || "";

    const team =
        document.getElementById(
            "filter-team"
        )?.value || "";

    const status =
        document.getElementById(
            "filter-status"
        )?.value || "";


    let temp =
        customers.filter(c => {

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

            );

        });


    fillSelect(
        "filter-district",

        uniqueValues(
            temp,
            "district"
        ),

        "Semua District"
    );


    fillSelect(
        "filter-ward",

        uniqueValues(
            temp,
            "ward"
        ),

        "Semua Ward"
    );


    /*
     * Pertahankan pilihan
     */

    const districtSelect =
        document.getElementById(
            "filter-district"
        );

    if (
        district &&
        uniqueValues(
            temp,
            "district"
        ).includes(district)
    ) {

        districtSelect.value =
            district;

    }


    /*
     * Ward bergantung pada district
     */

    let wardData =
        temp;

    if (district) {

        wardData =
            temp.filter(
                c =>
                    c.district ===
                    district
            );

    }


    fillSelect(
        "filter-ward",

        uniqueValues(
            wardData,
            "ward"
        ),

        "Semua Ward"
    );

}


/* =========================================================
   APPLY FILTER
   ========================================================= */

function applyFilters() {

    const team =
        document.getElementById(
            "filter-team"
        )?.value || "";

    const status =
        document.getElementById(
            "filter-status"
        )?.value || "";

    const city =
        document.getElementById(
            "filter-city"
        )?.value || "";

    const district =
        document.getElementById(
            "filter-district"
        )?.value || "";

    const ward =
        document.getElementById(
            "filter-ward"
        )?.value || "";


    const filtered =
        customers.filter(c => {

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

            );

        });


    drawCustomers(
        filtered
    );

    updateSummary(
        filtered
    );

    updateChart(
        filtered
    );

}


/* =========================================================
   SUMMARY
   ========================================================= */

function updateSummary(data) {

    const total =
        document.getElementById(
            "total-customer"
        );

    const ward =
        document.getElementById(
            "total-ward"
        );

    if (total)
        total.textContent =
            data.length;

    if (ward) {

        ward.textContent =
            new Set(
                data
                    .map(
                        c =>
                            c.ward
                    )
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

    if (!canvas)
        return;


    if (wardChart)
        wardChart.destroy();


    wardChart =
        new Chart(
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

        console.log(
            "Membaca:",
            DATA_URL
        );


        const response =
            await fetch(
                DATA_URL +
                "?v=" +
                Date.now()
            );


        console.log(
            "CSV STATUS:",
            response.status
        );


        if (!response.ok) {

            throw new Error(
                "CSV gagal dibaca. HTTP " +
                response.status
            );

        }


        const text =
            await response.text();


        console.log(
            "CSV BERHASIL DIBACA"
        );


        console.log(
            "Jumlah karakter:",
            text.length
        );


        customers =
            parseCustomerData(
                text
            );


        console.log(
            "TOTAL CUSTOMER:",
            customers.length
        );


        console.table(
            customers.slice(
                0,
                10
            )
        );


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

        console.error(
            "CUSTOMER CSV ERROR:",
            error
        );


        alert(
            "Gagal membaca customer.csv\n\n" +
            error.message +
            "\n\n" +
            "Pastikan file berada di:\n" +
            "data/customer.csv"
        );

    }

}


/* =========================================================
   START
   ========================================================= */

function startCustomerMap() {

    if (
        typeof map ===
        "undefined"
    ) {

        console.error(
            "OpenLayers map belum tersedia."
        );

        return;

    }

    loadData();

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
