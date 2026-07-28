(function () {

    const DATA_URL = './data/customer.csv';

    let customers = [];
    let customerSource = null;
    let customerLayer = null;
    let wardChart = null;

    const colors = [
        '#2563eb',
        '#16a34a',
        '#dc2626',
        '#9333ea',
        '#ea580c',
        '#0891b2',
        '#ca8a04',
        '#db2777',
        '#4f46e5',
        '#059669'
    ];

    // =========================
    // PARSER CSV ;
    // =========================

    function parseCSV(text) {

        const lines = text
            .replace(/\r/g, '')
            .split('\n')
            .filter(line => line.trim() !== '');

        const headers = lines[0]
            .split(';')
            .map(x => x.trim());

        return lines.slice(1).map(line => {

            const values = line.split(';');

            const obj = {};

            headers.forEach((header, index) => {

                obj[header] =
                    (values[index] || '').trim();

            });

            return obj;

        });

    }

    // =========================
    // KOORDINAT
    // =========================

    function convertCoordinate(value) {

        if (
            value === undefined ||
            value === null ||
            value === '' ||
            value === '0'
        ) {
            return null;
        }

        let number =
            parseFloat(
                String(value)
                    .replace(',', '.')
                    .trim()
            );

        if (!Number.isFinite(number))
            return null;

        /*
         * Data Anda:
         * -7359554  → -7.359554
         * 112758676 → 112.758676
         */

        if (Math.abs(number) > 180) {

            number =
                number / 1000000;

        }

        return number;

    }

    // =========================
    // UNIQUE
    // =========================

    function unique(values) {

        return [
            ...new Set(
                values
                    .filter(x =>
                        x !== undefined &&
                        x !== null &&
                        String(x).trim() !== ''
                    )
                    .map(x =>
                        String(x).trim()
                    )
            )
        ].sort();

    }

    // =========================
    // SELECT
    // =========================

    function fillSelect(
        id,
        values,
        firstText
    ) {

        const select =
            document.getElementById(id);

        if (!select)
            return;

        select.innerHTML = '';

        const first =
            document.createElement('option');

        first.value = '';
        first.textContent = firstText;

        select.appendChild(first);

        unique(values).forEach(value => {

            const option =
                document.createElement('option');

            option.value = value;
            option.textContent = value;

            select.appendChild(option);

        });

    }

    // =========================
    // FILTER
    // =========================

    function filteredData() {

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
                city &&
                row.City !== city
            )
                return false;

            if (
                district &&
                row.District !== district
            )
                return false;

            if (
                ward &&
                row.Ward !== ward
            )
                return false;

            return true;

        });

    }

    // =========================
    // COUNT WARD
    // =========================

    function countWard(data) {

        const result = {};

        data.forEach(row => {

            const ward =
                row.Ward ||
                'Tidak diketahui';

            result[ward] =
                (result[ward] || 0) + 1;

        });

        return result;

    }

    // =========================
    // WARNA
    // =========================

    function markerColor(count, max) {

        if (max <= 1)
            return colors[0];

        const index =
            Math.min(
                colors.length - 1,
                Math.floor(
                    (
                        (count - 1) /
                        Math.max(max - 1, 1)
                    ) *
                    (colors.length - 1)
                )
            );

        return colors[index];

    }

    // =========================
    // MARKER
    // =========================

    function drawMarkers(data) {

        customerSource.clear();

        const counts =
            countWard(data);

        const max =
            Math.max(
                ...Object.values(counts),
                1
            );

        data.forEach(row => {

            const lat =
                convertCoordinate(
                    row.Latitude
                );

            const lon =
                convertCoordinate(
                    row.Longitude
                );

            // Skip GPS 0,0
            if (
                lat === null ||
                lon === null ||
                lat === 0 ||
                lon === 0
            ) {
                return;
            }

            const ward =
                row.Ward ||
                'Tidak diketahui';

            const count =
                counts[ward] || 1;

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

                    wardCount: count

                });

            feature.setStyle(
                new ol.style.Style({

                    image:
                        new ol.style.Circle({

                            radius:
                                Math.min(
                                    7 +
                                    count * 0.7,
                                    18
                                ),

                            fill:
                                new ol.style.Fill({
                                    color:
                                        markerColor(
                                            count,
                                            max
                                        )
                                }),

                            stroke:
                                new ol.style.Stroke({
                                    color: '#ffffff',
                                    width: 2
                                })

                        })

                })
            );

            customerSource.addFeature(
                feature
            );

        });

    }

    // =========================
    // PIE CHART
    // =========================

    function drawPie(data) {

        const counts =
            countWard(data);

        const labels =
            Object.keys(counts);

        const values =
            Object.values(counts);

        const canvas =
            document.getElementById(
                'ward-chart'
            );

        if (!canvas)
            return;

        if (wardChart)
            wardChart.destroy();

        wardChart =
            new Chart(canvas, {

                type: 'pie',

                data: {

                    labels: labels,

                    datasets: [{

                        data: values,

                        backgroundColor:
                            labels.map(
                                (_, i) =>
                                    colors[
                                        i %
                                        colors.length
                                    ]
                            ),

                        borderColor:
                            '#ffffff',

                        borderWidth: 2

                    }]

                },

                options: {

                    responsive: true,

                    plugins: {

                        legend: {

                            position: 'bottom',

                            labels: {

                                boxWidth: 12

                            }

                        }

                    }

                }

            });

    }

    // =========================
    // LEGEND
    // =========================

    function updateLegend(data) {

        const container =
            document.getElementById(
                'legend'
            );

        container.innerHTML = '';

        const counts =
            countWard(data);

        const max =
            Math.max(
                ...Object.values(counts),
                1
            );

        Object.entries(counts)

            .sort(
                (a, b) =>
                    b[1] - a[1]
            )

            .forEach(
                ([ward, count]) => {

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
                                background:${markerColor(
                                    count,
                                    max
                                )}
                            ">
                        </span>

                        <span>
                            ${ward}
                            —
                            <b>${count}</b>
                            customer
                        </span>

                    `;

                    container.appendChild(
                        item
                    );

                }
            );

    }

    // =========================
    // DASHBOARD
    // =========================

    function updateDashboard() {

        const data =
            filteredData();

        document.getElementById(
            'total-customer'
        ).textContent =
            data.length.toLocaleString();

        document.getElementById(
            'total-ward'
        ).textContent =
            unique(
                data.map(x => x.Ward)
            ).length;

        drawMarkers(data);

        drawPie(data);

        updateLegend(data);

    }

    // =========================
    // CITY → DISTRICT
    // =========================

    function updateDistrict() {

        const city =
            document.getElementById(
                'filter-city'
            ).value;

        const data =
            customers.filter(row =>
                !city ||
                row.City === city
            );

        fillSelect(
            'filter-district',
            data.map(x => x.District),
            'Semua District'
        );

        fillSelect(
            'filter-ward',
            [],
            'Semua Ward'
        );

        updateDashboard();

    }

    // =========================
    // DISTRICT → WARD
    // =========================

    function updateWard() {

        const city =
            document.getElementById(
                'filter-city'
            ).value;

        const district =
            document.getElementById(
                'filter-district'
            ).value;

        const data =
            customers.filter(row => {

                if (
                    city &&
                    row.City !== city
                )
                    return false;

                if (
                    district &&
                    row.District !== district
                )
                    return false;

                return true;

            });

        fillSelect(
            'filter-ward',
            data.map(x => x.Ward),
            'Semua Ward'
        );

        updateDashboard();

    }

    // =========================
    // POPUP
    // =========================

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

        const gps =
            'https://www.google.com/maps/search/?api=1&query=' +
            encodeURIComponent(
                lat + ',' + lon
            );

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
                            ${row['Status Instalasi/Maintenance'] || '-'}
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

    // =========================
    // LOAD DATA
    // =========================

    async function loadData() {

        try {

            console.log(
                'Mengambil data:',
                DATA_URL
            );

            const response =
                await fetch(
                    DATA_URL
                );

            if (!response.ok) {

                throw new Error(
                    'HTTP ' +
                    response.status
                );

            }

            const text =
                await response.text();

            customers =
                parseCSV(text);

            console.log(
                'TOTAL DATA:',
                customers.length
            );

            console.table(
                customers.slice(
                    0,
                    10
                )
            );

            // =========================
            // CITY
            // =========================

            fillSelect(
                'filter-city',
                customers.map(
                    x => x.City
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

            // =========================
            // LAYER
            // =========================

            customerSource =
                new ol.source.Vector();

            customerLayer =
                new ol.layer.Vector({

                    title:
                        'Customer GPS',

                    source:
                        customerSource,

                    zIndex:
                        9999

                });

            map.addLayer(
                customerLayer
            );

            updateDashboard();

            // =========================
            // CLICK MARKER
            // =========================

            map.on(
                'singleclick',
                function (event) {

                    const feature =
                        map.forEachFeatureAtPixel(
                            event.pixel,
                            function (
                                feature
                            ) {

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
                'CUSTOMER DATA ERROR:',
                error
            );

            alert(
                'Gagal membaca customer.csv. ' +
                'Pastikan data/customer.csv tersedia.'
            );

        }

    }

    // =========================
    // START
    // =========================

    document.addEventListener(
        'DOMContentLoaded',
        function () {

            document
                .getElementById(
                    'filter-city'
                )
                .addEventListener(
                    'change',
                    updateDistrict
                );

            document
                .getElementById(
                    'filter-district'
                )
                .addEventListener(
                    'change',
                    updateWard
                );

            document
                .getElementById(
                    'filter-ward'
                )
                .addEventListener(
                    'change',
                    updateDashboard
                );

            document
                .getElementById(
                    'dashboard-close'
                )
                .addEventListener(
                    'click',
                    function () {

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

            document
                .getElementById(
                    'dashboard-toggle'
                )
                .addEventListener(
                    'click',
                    function () {

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

            loadData();

        }
    );

})();