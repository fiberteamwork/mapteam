(function () {

    const DATA_URL = './data/customer.csv';

    let customers = [];
    let customerSource = null;
    let customerLayer = null;
    let statusChart = null;

    // =====================================================
    // WARNA STATUS
    // =====================================================

    const STATUS_COLORS = {
        pending: '#ef4444',      // 🔴 Merah
        reschedule: '#3b82f6',   // 🔵 Biru
        done: '#22c55e',         // 🟢 Hijau
        cancel: '#a855f7',       // 🟣 Ungu
        unknown: '#6b7280'       // Abu-abu
    };

    // =====================================================
    // NORMALISASI STATUS
    // =====================================================

    function getStatus(value) {

        const text =
            String(value || '')
                .toLowerCase()
                .trim();

        if (text.includes('pending')) {
            return 'pending';
        }

        if (text.includes('reschedule')) {
            return 'reschedule';
        }

        if (text.includes('done')) {
            return 'done';
        }

        if (text.includes('cancel')) {
            return 'cancel';
        }

        return 'unknown';
    }

    function getStatusLabel(status) {

        const labels = {
            pending: '🔴 Pending',
            reschedule: '🔵 Reschedule',
            done: '🟢 Done',
            cancel: '🟣 Cancel',
            unknown: '⚪ Lainnya'
        };

        return labels[status] || labels.unknown;

    }

    // =====================================================
    // PARSER CSV ;
    // =====================================================

    function parseCustomerData(text) {

        const lines =
            text
                .replace(/\r/g, '')
                .split('\n')
                .filter(
                    line =>
                        line.trim() !== ''
                );

        if (lines.length < 2) {

            throw new Error(
                'customer.csv kosong atau tidak mempunyai data'
            );

        }

        const headers =
            lines[0]
                .split(';')
                .map(
                    x => x.trim()
                );

        console.log(
            'HEADER:',
            headers
        );

        const result = [];

        lines
            .slice(1)
            .forEach(line => {

                const values =
                    line.split(';');

                const row = {};

                headers.forEach(
                    (header, index) => {

                        row[header] =
                            (
                                values[index] ||
                                ''
                            ).trim();

                    }
                );

                result.push(row);

            });

        return result;

    }

    // =====================================================
    // KOORDINAT
    // =====================================================

    function getCoordinate(value) {

        if (
            value === undefined ||
            value === null ||
            value === ''
        ) {
            return null;
        }

        const number =
            parseFloat(
                String(value)
                    .replace(',', '.')
                    .trim()
            );

        if (!Number.isFinite(number)) {
            return null;
        }

        return number;

    }

    // =====================================================
    // UNIQUE
    // =====================================================

    function unique(values) {

        return [
            ...new Set(
                values
                    .filter(
                        x =>
                            x !== undefined &&
                            x !== null &&
                            String(x).trim() !== ''
                    )
                    .map(
                        x =>
                            String(x).trim()
                    )
            )
        ].sort();

    }

    // =====================================================
    // SELECT
    // =====================================================

    function fillSelect(
        id,
        values,
        firstText
    ) {

        const select =
            document.getElementById(id);

        if (!select) {
            return;
        }

        select.innerHTML = '';

        const first =
            document.createElement('option');

        first.value = '';
        first.textContent = firstText;

        select.appendChild(first);

        unique(values)
            .forEach(value => {

                const option =
                    document.createElement(
                        'option'
                    );

                option.value = value;
                option.textContent = value;

                select.appendChild(option);

            });

    }

    // =====================================================
    // FILTER DATA
    // =====================================================

function getFilteredData() {

    const team =
        document.getElementById(
            'filter-team'
        ).value;

    const city =
        document.getElementById(
            'filter-city'
        ).value;

    const district =
        document.getElementById(
            'filter-district'
        ).value;

    const ward =
        document.getElementById(
            'filter-ward'
        ).value;

    return customers.filter(row => {

        if (
            team &&
            row.team !== team
        ) {
            return false;
        }

        if (
            city &&
            row.City !== city
        ) {
            return false;
        }

        if (
            district &&
            row.District !== district
        ) {
            return false;
        }

        if (
            ward &&
            row.Ward !== ward
        ) {
            return false;
        }

        return true;

    });

}
    // =====================================================
    // STATUS COUNT
    // =====================================================

    function countStatus(data) {

        const result = {

            pending: 0,

            reschedule: 0,

            done: 0,

            cancel: 0,

            unknown: 0

        };

        data.forEach(row => {

            const status =
                getStatus(
                    row[
                        'Status Instalasi/Maintenance'
                    ]
                );

            result[status]++;

        });

        return result;

    }

    // =====================================================
    // MARKER STYLE
    // =====================================================

    function createMarkerStyle(status) {

        const color =
            STATUS_COLORS[status] ||
            STATUS_COLORS.unknown;

        return new ol.style.Style({

            image:
                new ol.style.Circle({

                    radius: 9,

                    fill:
                        new ol.style.Fill({
                            color: color
                        }),

                    stroke:
                        new ol.style.Stroke({

                            color: '#ffffff',

                            width: 2

                        })

                })

        });

    }

    // =====================================================
    // DRAW MARKER
    // =====================================================

    function drawMarkers(data) {

        if (!customerSource) {
            return;
        }

        customerSource.clear();

        data.forEach(row => {

            const lat =
                getCoordinate(
                    row.Latitude
                );

            const lon =
                getCoordinate(
                    row.Longitude
                );

            // Tidak membuat marker untuk 0,0
            if (
                lat === null ||
                lon === null ||
                lat === 0 ||
                lon === 0
            ) {
                return;
            }

            const status =
                getStatus(
                    row[
                        'Status Instalasi/Maintenance'
                    ]
                );

            const feature =
                new ol.Feature({

                    geometry:
                        new ol.geom.Point(
                            ol.proj.fromLonLat([
                                lon,
                                lat
                            ])
                        ),

                    customer: row,

                    latitude: lat,

                    longitude: lon,

                    status: status

                });

            feature.setStyle(
                createMarkerStyle(status)
            );

            customerSource.addFeature(
                feature
            );

        });

    }

    // =====================================================
    // PIE CHART STATUS
    // =====================================================

    function drawStatusChart(data) {

        const counts =
            countStatus(data);

        const canvas =
            document.getElementById(
                'ward-chart'
            );

        if (!canvas) {
            return;
        }

        if (statusChart) {
            statusChart.destroy();
        }

        statusChart =
            new Chart(
                canvas,
                {

                    type: 'pie',

                    data: {

                        labels: [

                            '🔴 Pending',

                            '🔵 Reschedule',

                            '🟢 Done',

                            '🟣 Cancel'

                        ],

                        datasets: [{

                            data: [

                                counts.pending,

                                counts.reschedule,

                                counts.done,

                                counts.cancel

                            ],

                            backgroundColor: [

                                STATUS_COLORS.pending,

                                STATUS_COLORS.reschedule,

                                STATUS_COLORS.done,

                                STATUS_COLORS.cancel

                            ],

                            borderColor:
                                '#ffffff',

                            borderWidth: 2

                        }]

                    },

                    options: {

                        responsive: true,

                        maintainAspectRatio: false,

                        plugins: {

                            legend: {

                                position:
                                    'bottom'

                            },

                            tooltip: {

                                callbacks: {

                                    label:
                                        function (
                                            context
                                        ) {

                                            const value =
                                                context.raw;

                                            const total =
                                                context.dataset
                                                    .data
                                                    .reduce(
                                                        (
                                                            a,
                                                            b
                                                        ) =>
                                                            a + b,
                                                        0
                                                    );

                                            const percent =
                                                total
                                                    ? (
                                                        value /
                                                        total *
                                                        100
                                                    ).toFixed(
                                                        1
                                                    )
                                                    : 0;

                                            return (
                                                ' ' +
                                                value +
                                                ' customer (' +
                                                percent +
                                                '%)'
                                            );

                                        }

                                }

                            }

                        }

                    }

                }
            );

    }

    // =====================================================
    // LEGEND STATUS
    // =====================================================

    function updateLegend(data) {

        const container =
            document.getElementById(
                'legend'
            );

        if (!container) {
            return;
        }

        const counts =
            countStatus(data);

        container.innerHTML = '';

        const statuses = [

            'pending',

            'reschedule',

            'done',

            'cancel'

        ];

        statuses.forEach(status => {

            const item =
                document.createElement(
                    'div'
                );

            item.className =
                'legend-item';

            item.innerHTML = `

                <span
                    class="legend-color"
                    style="
                        background:
                        ${STATUS_COLORS[status]};
                    ">
                </span>

                <span>
                    ${getStatusLabel(status)}
                    —
                    <b>${counts[status]}</b>
                    customer
                </span>

            `;

            container.appendChild(
                item
            );

        });

    }

    // =====================================================
    // DASHBOARD
    // =====================================================

    function updateDashboard() {

        const data =
            getFilteredData();

        const totalCustomer =
            document.getElementById(
                'total-customer'
            );

        const totalWard =
            document.getElementById(
                'total-ward'
            );

        if (totalCustomer) {

            totalCustomer.textContent =
                data.length.toLocaleString(
                    'id-ID'
                );

        }

        if (totalWard) {

            totalWard.textContent =
                unique(
                    data.map(
                        x => x.Ward
                    )
                ).length;

        }

        drawMarkers(data);

        drawStatusChart(data);

        updateLegend(data);

    }

    // =====================================================
    // CITY → DISTRICT
    // =====================================================
    
    function updateteam() {

    const team =
        document.getElementById(
            'filter-team'
        ).value;


    const data =
        customers.filter(
            row => {

                return (
                    !team ||
                    row.team === team
                );

            }
        );


    fillSelect(

        'filter-city',

        data.map(
            row =>
                row.City
        ),

        'Semua City'

    );


    fillSelect(

        'filter-district',

        [],

        'Semua District'

    );


    fillSelect(

        'filter-ward',

        [],

        'Semua Ward'

    );


    updateDashboard();

}
    
function updateDistrict() {

    const team =
        document.getElementById(
            'filter-team'
        ).value;

    const city =
        document.getElementById(
            'filter-city'
        ).value;


    const data =
        customers.filter(
            row => {

                if (
                    team &&
                    row.team !== team
                ) {

                    return false;

                }


                if (
                    city &&
                    row.City !== city
                ) {

                    return false;

                }


                return true;

            }
        );


    fillSelect(

        'filter-district',

        data.map(
            row =>
                row.District
        ),

        'Semua District'

    );


    fillSelect(

        'filter-ward',

        [],

        'Semua Ward'

    );


    updateDashboard();

}
    
function updateWard() {

    const team =
        document.getElementById(
            'filter-team'
        ).value;

    const city =
        document.getElementById(
            'filter-city'
        ).value;

    const district =
        document.getElementById(
            'filter-district'
        ).value;


    const data =
        customers.filter(
            row => {

                if (
                    team &&
                    row.team !== team
                ) {

                    return false;

                }


                if (
                    city &&
                    row.City !== city
                ) {

                    return false;

                }


                if (
                    district &&
                    row.District !== district
                ) {

                    return false;

                }


                return true;

            }
        );


    fillSelect(

        'filter-ward',

        data.map(
            row =>
                row.Ward
        ),

        'Semua Ward'

    );


    updateDashboard();

}
    // =====================================================
    // POPUP CUSTOMER
    // =====================================================

    function showPopup(feature) {

        const row =
            feature.get(
                'customer'
            );

        const lat =
            feature.get(
                'latitude'
            );

        const lon =
            feature.get(
                'longitude'
            );

        const status =
            feature.get(
                'status'
            );

        const gps =
            'https://www.google.com/maps/search/?api=1&query=' +
            encodeURIComponent(
                lat + ',' + lon
            );

        const statusColor =
            STATUS_COLORS[status] ||
            STATUS_COLORS.unknown;

        const html = `

            <div class="customer-popup">

                <h3>
                    ${row['ID Customer'] || '-'}
                </h3>

                <table>

                    <tr>
                        <td>Username</td>
                        <td>
                            ${row.Username || '-'}
                        </td>
                    </tr>

                    <tr>
                        <td>City</td>
                        <td>
                            ${row.City || '-'}
                        </td>
                    </tr>

                    <tr>
                        <td>District</td>
                        <td>
                            ${row.District || '-'}
                        </td>
                    </tr>

                    <tr>
                        <td>Ward</td>
                        <td>
                            ${row.Ward || '-'}
                        </td>
                    </tr>

                    <tr>
                        <td>Site</td>
                        <td>
                            ${row['CEK SITE NAME SYSTEM'] || '-'}
                        </td>
                    </tr>

                    <tr>
                        <td>Team</td>
                        <td>
                            ${row.Team || '-'}
                        </td>
                    </tr>

                    <tr>
                        <td>Status</td>

                        <td>
                            <b
                                style="
                                    color:${statusColor};
                                "
                            >
                                ${getStatusLabel(status)}
                            </b>
                        </td>

                    </tr>

                    <tr>
                        <td>Visit Date</td>
                        <td>
                            ${row['Visit Date'] || '-'}
                        </td>
                    </tr>

                    <tr>
                        <td>Latitude</td>
                        <td>
                            ${lat}
                        </td>
                    </tr>

                    <tr>
                        <td>Longitude</td>
                        <td>
                            ${lon}
                        </td>
                    </tr>

                </table>

                <a
                    href="${gps}"
                    target="_blank"
                    rel="noopener"
                    class="gps-button"
                >
                    📍 Buka GPS
                </a>

            </div>

        `;

        document.getElementById(
            'popup-content'
        ).innerHTML = html;

        if (
            typeof overlay !==
            'undefined'
        ) {

            overlay.setPosition(
                feature
                    .getGeometry()
                    .getCoordinates()
            );

        }

    }

    // =====================================================
    // LOAD CSV
    // =====================================================

async function loadData() {

    try {

        console.log(
            '===================================='
        );

        console.log(
            'Membaca customer CSV:',
            DATA_URL
        );

        // =====================================================
        // AMBIL CSV
        // =====================================================

        const response =
            await fetch(
                DATA_URL +
                '?v=' +
                Date.now()
            );

        console.log(
            'CSV STATUS:',
            response.status
        );

        console.log(
            'CSV OK:',
            response.ok
        );

        if (!response.ok) {

            throw new Error(
                'CSV tidak dapat dibaca. HTTP ' +
                response.status
            );

        }


        // =====================================================
        // BACA TEXT CSV
        // =====================================================

        const text =
            await response.text();


        if (!text.trim()) {

            throw new Error(
                'customer.csv kosong.'
            );

        }


        console.log(
            'CSV BERHASIL DIBACA'
        );

        console.log(
            'Ukuran CSV:',
            text.length,
            'karakter'
        );


        // =====================================================
        // PARSE CSV
        // =====================================================

        customers =
            parseCustomerData(text);


        if (
            !Array.isArray(customers)
        ) {

            throw new Error(
                'Format data customer tidak valid.'
            );

        }


        console.log(
            'TOTAL CUSTOMER:',
            customers.length
        );


        // =====================================================
        // CEK DATA
        // =====================================================

        console.table(
            customers.slice(
                0,
                10
            )
        );


        if (
            customers.length === 0
        ) {

            throw new Error(
                'Tidak ada data customer di CSV.'
            );

        }


        // =====================================================
        // CEK HEADER
        // =====================================================

        const firstRow =
            customers[0];


        const requiredColumns = [

            'ID Customer',

            'Username',

            'City',

            'District',

            'Ward',

            'CEK SITE NAME SYSTEM',

            'Team',

            'team',

            'Status Instalasi/Maintenance',

            'Visit Date',

            'Latitude',

            'Longitude'

        ];


        const missingColumns =
            requiredColumns.filter(
                column =>
                    !Object.prototype
                        .hasOwnProperty
                        .call(
                            firstRow,
                            column
                        )
            );


        if (
            missingColumns.length > 0
        ) {

            console.warn(
                'Kolom tidak ditemukan:',
                missingColumns
            );

            console.warn(
                'Kolom yang tersedia:',
                Object.keys(firstRow)
            );

        }


        // =====================================================
        // FILTER team
        // =====================================================

        fillSelect(

            'filter-team',

            customers.map(
                row =>
                    row.team
            ),

            'Semua team'

        );


        // =====================================================
        // FILTER CITY
        // =====================================================

        fillSelect(

            'filter-city',

            customers.map(
                row =>
                    row.City
            ),

            'Semua City'

        );


        // =====================================================
        // RESET DISTRICT
        // =====================================================

        fillSelect(

            'filter-district',

            [],

            'Semua District'

        );


        // =====================================================
        // RESET WARD
        // =====================================================

        fillSelect(

            'filter-ward',

            [],

            'Semua Ward'

        );


        // =====================================================
        // BUAT SOURCE CUSTOMER
        // =====================================================

        customerSource =
            new ol.source.Vector();


        // =====================================================
        // BUAT LAYER CUSTOMER
        // =====================================================

        customerLayer =
            new ol.layer.Vector({

                title:
                    'Customer',

                source:
                    customerSource,

                zIndex:
                    9999

            });


        // =====================================================
        // TAMBAHKAN LAYER KE MAP
        // =====================================================

        map.addLayer(
            customerLayer
        );


        console.log(
            'Customer layer berhasil dibuat.'
        );


        // =====================================================
        // TAMPILKAN DATA AWAL
        // =====================================================

        updateDashboard();


        // =====================================================
        // CLICK MARKER
        // =====================================================

        map.on(
            'singleclick',
            function(event) {

                const feature =
                    map.forEachFeatureAtPixel(

                        event.pixel,

                        function(feature) {

                            if (
                                feature &&
                                feature.get(
                                    'customer'
                                )
                            ) {

                                return feature;

                            }

                            return null;

                        }

                    );


                // Tidak klik customer

                if (!feature) {

                    return;

                }


                // =================================================
                // TAMPILKAN POPUP
                // =================================================

                showPopup(
                    feature
                );

            }
        );


        console.log(
            '===================================='
        );

        console.log(
            'CUSTOMER MAP SIAP'
        );

        console.log(
            'Customer:',
            customers.length
        );

        console.log(
            '===================================='
        );

    }
    catch (error) {

        // =====================================================
        // ERROR
        // =====================================================

        console.error(
            '===================================='
        );

        console.error(
            'CUSTOMER CSV ERROR'
        );

        console.error(
            error
        );

        console.error(
            '===================================='
        );


        alert(

            'Gagal membaca customer.csv\n\n' +

            error.message +

            '\n\n' +

            'Periksa Console browser (F12).'

        );

    }

}

            // CITY

            fillSelect(

                'filter-city',

                customers.map(
                    x => x.City
                ),

                'Semua City'

            );

            // DISTRICT

            fillSelect(

                'filter-district',

                [],

                'Semua District'

            );

            // WARD

            fillSelect(

                'filter-ward',

                [],

                'Semua Ward'

            );

            // OPENLAYERS SOURCE

            customerSource =
                new ol.source.Vector();

            customerLayer =
                new ol.layer.Vector({

                    title:
                        'Customer',

                    source:
                        customerSource,

                    zIndex:
                        9999

                });

            map.addLayer(
                customerLayer
            );

            updateDashboard();

            // CLICK MARKER

            map.on(
                'singleclick',
                function(event) {

                    const feature =
                        map.forEachFeatureAtPixel(

                            event.pixel,

                            function(feature) {

                                if (
                                    feature.get(
                                        'customer'
                                    )
                                ) {

                                    return feature;

                                }

                                return null;

                            }

                        );

                    if (feature) {

                        showPopup(
                            feature
                        );

                    }

                }
            );

        }
        catch (error) {

            console.error(
                'CUSTOMER CSV ERROR:',
                error
            );

            alert(
                'Gagal membaca customer.csv\n\n' +
                error.message
            );

        }

    }

    // =====================================================
    // START
    // =====================================================

    document.addEventListener(
        'DOMContentLoaded',
        function() {
            const team =
                document.getElementById(
                    'filter-team'
                );
            
            const city =
                document.getElementById(
                    'filter-city'
                );

            const district =
                document.getElementById(
                    'filter-district'
                );

            const ward =
                document.getElementById(
                    'filter-ward'
                );

            if (city) {

                city.addEventListener(
                    'change',
                    updateDistrict
                );

            }

            if (district) {

                district.addEventListener(
                    'change',
                    updateWard
                );

            }

            if (ward) {

                ward.addEventListener(
                    'change',
                    updateDashboard
                );

            }

            const close =
                document.getElementById(
                    'dashboard-close'
                );

            if (close) {

                close.addEventListener(
                    'click',
                    function() {

                        document
                            .getElementById(
                                'dashboard'
                            )
                            .style.display =
                            'none';

                        document
                            .getElementById(
                                'dashboard-toggle'
                            )
                            .style.display =
                            'block';

                    }
                );

            }

            const toggle =
                document.getElementById(
                    'dashboard-toggle'
                );

            if (toggle) {

                toggle.addEventListener(
                    'click',
                    function() {

                        document
                            .getElementById(
                                'dashboard'
                            )
                            .style.display =
                            'block';

                        this.style.display =
                            'none';

                    }
                );

            }

            loadData();

        }
    );

})();
