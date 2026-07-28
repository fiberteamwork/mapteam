const DATA_URL = './data/customer.csv';

let customers = [];
let customerSource = null;
let customerLayer = null;
let wardChart = null;


// =====================================================
// PARSE CSV SEMICOLON
// =====================================================

function parseCustomerData(text) {

    // Hilangkan BOM
    text = text.replace(/^\uFEFF/, '');

    const lines = text
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line.length > 0);

    if (lines.length < 2) {
        throw new Error('CSV tidak memiliki data.');
    }

    // Header
    const headers = lines[0]
        .split(';')
        .map(x => x.trim());

    console.log('HEADER:', headers);

    const data = [];

    for (let i = 1; i < lines.length; i++) {

        const cols = lines[i].split(';');

        // Skip baris kosong
        if (!cols.length) continue;

        const row = {};

        headers.forEach((header, index) => {

            row[header] =
                (cols[index] || '').trim();

        });

        // Hanya data yang punya ID Customer
        if (
            row['ID Customer'] &&
            row['ID Customer'] !== ''
        ) {

            data.push(row);

        }

    }

    return data;
}


// =====================================================
// LOAD CSV
// =====================================================

async function loadData() {

    try {

        console.log(
            'Membaca CSV:',
            DATA_URL
        );

        const response =
            await fetch(
                DATA_URL +
                '?v=' +
                Date.now()
            );

        console.log(
            'HTTP:',
            response.status
        );

        if (!response.ok) {

            throw new Error(
                'File customer.csv tidak ditemukan. HTTP ' +
                response.status
            );

        }

        const text =
            await response.text();

        console.log(
            'CSV berhasil dibaca.'
        );

        console.log(
            'Jumlah karakter:',
            text.length
        );

        console.log(
            'Preview:',
            text.substring(0, 500)
        );


        // =================================================
        // PARSE
        // =================================================

        customers =
            parseCustomerData(text);


        console.log(
            'TOTAL CUSTOMER:',
            customers.length
        );


        console.table(
            customers.slice(0, 10)
        );


        if (
            customers.length === 0
        ) {

            throw new Error(
                'CSV berhasil dibaca tetapi tidak ada data customer.'
            );

        }


        // =================================================
        // CEK KOLOM
        // =================================================

        console.log(
            'Kolom:',
            Object.keys(customers[0])
        );


        // =================================================
        // TEAM
        // =================================================

        fillSelect(
            'filter-team',

            customers.map(
                row =>
                    row['Team']
            ),

            'Semua Vendor'
        );


        // =================================================
        // CITY
        // =================================================

        fillSelect(
            'filter-city',

            customers.map(
                row =>
                    row['City']
            ),

            'Semua City'
        );


        // =================================================
        // DISTRICT
        // =================================================

        fillSelect(
            'filter-district',

            customers.map(
                row =>
                    row['District']
            ),

            'Semua District'
        );


        // =================================================
        // WARD
        // =================================================

        fillSelect(
            'filter-ward',

            customers.map(
                row =>
                    row['Ward']
            ),

            'Semua Ward'
        );


        // =================================================
        // BUAT CUSTOMER LAYER
        // =================================================

        if (typeof map !== 'undefined') {

            customerSource =
                new ol.source.Vector();

            customerLayer =
                new ol.layer.Vector({

                    source:
                        customerSource,

                    zIndex:
                        9999

                });

            map.addLayer(
                customerLayer
            );

        }


        // =================================================
        // TAMPILKAN MARKER
        // =================================================

        updateDashboard();


        console.log(
            'CUSTOMER MAP BERHASIL DIMUAT.'
        );

    }
    catch (error) {

        console.error(
            'ERROR CUSTOMER CSV:',
            error
        );

        alert(
            'Gagal membaca customer.csv\n\n' +
            error.message +
            '\n\nBuka F12 → Console untuk detail.'
        );

    }

}


// =====================================================
// SELECT
// =====================================================

function fillSelect(
    id,
    values,
    defaultText
) {

    const select =
        document.getElementById(id);

    if (!select) {

        console.warn(
            'Select tidak ditemukan:',
            id
        );

        return;

    }


    // Hapus pilihan lama

    select.innerHTML = '';


    // Default

    const defaultOption =
        document.createElement('option');

    defaultOption.value = '';

    defaultOption.textContent =
        defaultText;

    select.appendChild(
        defaultOption
    );


    // Unik

    const uniqueValues =
        [...new Set(

            values

                .map(
                    value =>
                        String(
                            value || ''
                        ).trim()
                )

                .filter(
                    value =>
                        value !== ''
                )

        )];


    uniqueValues.sort(
        (a, b) =>
            a.localeCompare(b)
    );


    uniqueValues.forEach(
        value => {

            const option =
                document.createElement(
                    'option'
                );

            option.value =
                value;

            option.textContent =
                value;

            select.appendChild(
                option
            );

        }
    );


    console.log(
        id,
        'jumlah pilihan:',
        uniqueValues.length
    );

}


// =====================================================
// INIT
// =====================================================

document.addEventListener(
    'DOMContentLoaded',
    function() {

        console.log(
            'Customer Map INIT'
        );

        loadData();

    }
);
