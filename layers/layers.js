var wms_layers = [];


        var lyr_googleroadmap_0 = new ol.layer.Tile({
            'title': 'google roadmap',
            'opacity': 1.000000,
            
            
            source: new ol.source.XYZ({
            attributions: ' ',
                url: 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}'
            })
        });
var format_ADMINISTRASIDESA_AR_25Kshp_1 = new ol.format.GeoJSON();
var features_ADMINISTRASIDESA_AR_25Kshp_1 = format_ADMINISTRASIDESA_AR_25Kshp_1.readFeatures(json_ADMINISTRASIDESA_AR_25Kshp_1, 
            {dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857'});
var jsonSource_ADMINISTRASIDESA_AR_25Kshp_1 = new ol.source.Vector({
    attributions: ' ',
});
jsonSource_ADMINISTRASIDESA_AR_25Kshp_1.addFeatures(features_ADMINISTRASIDESA_AR_25Kshp_1);
var lyr_ADMINISTRASIDESA_AR_25Kshp_1 = new ol.layer.Vector({
                declutter: false,
                source:jsonSource_ADMINISTRASIDESA_AR_25Kshp_1, 
                style: style_ADMINISTRASIDESA_AR_25Kshp_1,
                popuplayertitle: 'ADMINISTRASIDESA_AR_25K.shp',
                interactive: true,
                title: '<img src="styles/legend/ADMINISTRASIDESA_AR_25Kshp_1.png" /> ADMINISTRASIDESA_AR_25K.shp'
            });
var format_ADMINISTRASI_LN_25Kshp_2 = new ol.format.GeoJSON();
var features_ADMINISTRASI_LN_25Kshp_2 = format_ADMINISTRASI_LN_25Kshp_2.readFeatures(json_ADMINISTRASI_LN_25Kshp_2, 
            {dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857'});
var jsonSource_ADMINISTRASI_LN_25Kshp_2 = new ol.source.Vector({
    attributions: ' ',
});
jsonSource_ADMINISTRASI_LN_25Kshp_2.addFeatures(features_ADMINISTRASI_LN_25Kshp_2);
var lyr_ADMINISTRASI_LN_25Kshp_2 = new ol.layer.Vector({
                declutter: false,
                source:jsonSource_ADMINISTRASI_LN_25Kshp_2, 
                style: style_ADMINISTRASI_LN_25Kshp_2,
                popuplayertitle: 'ADMINISTRASI_LN_25K.shp',
                interactive: true,
                title: '<img src="styles/legend/ADMINISTRASI_LN_25Kshp_2.png" /> ADMINISTRASI_LN_25K.shp'
            });
var format_11032026_batas_kel11032026_BATAS_KEL_3 = new ol.format.GeoJSON();
var features_11032026_batas_kel11032026_BATAS_KEL_3 = format_11032026_batas_kel11032026_BATAS_KEL_3.readFeatures(json_11032026_batas_kel11032026_BATAS_KEL_3, 
            {dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857'});
var jsonSource_11032026_batas_kel11032026_BATAS_KEL_3 = new ol.source.Vector({
    attributions: ' ',
});
jsonSource_11032026_batas_kel11032026_BATAS_KEL_3.addFeatures(features_11032026_batas_kel11032026_BATAS_KEL_3);
var lyr_11032026_batas_kel11032026_BATAS_KEL_3 = new ol.layer.Vector({
                declutter: false,
                source:jsonSource_11032026_batas_kel11032026_BATAS_KEL_3, 
                style: style_11032026_batas_kel11032026_BATAS_KEL_3,
                popuplayertitle: '11032026_batas_kel — 11032026_BATAS_KEL',
                interactive: true,
                title: '<img src="styles/legend/11032026_batas_kel11032026_BATAS_KEL_3.png" /> 11032026_batas_kel — 11032026_BATAS_KEL'
            });
var format_11032026_batas_kec11032026_BATAS_KEC_4 = new ol.format.GeoJSON();
var features_11032026_batas_kec11032026_BATAS_KEC_4 = format_11032026_batas_kec11032026_BATAS_KEC_4.readFeatures(json_11032026_batas_kec11032026_BATAS_KEC_4, 
            {dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857'});
var jsonSource_11032026_batas_kec11032026_BATAS_KEC_4 = new ol.source.Vector({
    attributions: ' ',
});
jsonSource_11032026_batas_kec11032026_BATAS_KEC_4.addFeatures(features_11032026_batas_kec11032026_BATAS_KEC_4);
var lyr_11032026_batas_kec11032026_BATAS_KEC_4 = new ol.layer.Vector({
                declutter: false,
                source:jsonSource_11032026_batas_kec11032026_BATAS_KEC_4, 
                style: style_11032026_batas_kec11032026_BATAS_KEC_4,
                popuplayertitle: '11032026_batas_kec — 11032026_BATAS_KEC',
                interactive: true,
                title: '<img src="styles/legend/11032026_batas_kec11032026_BATAS_KEC_4.png" /> 11032026_batas_kec — 11032026_BATAS_KEC'
            });
var group_LapakGIScomKABSIDOARJO = new ol.layer.Group({
                                layers: [lyr_ADMINISTRASIDESA_AR_25Kshp_1,lyr_ADMINISTRASI_LN_25Kshp_2,],
                                fold: 'open',
                                title: '[LapakGIS.com] KAB. SIDOARJO'});

lyr_googleroadmap_0.setVisible(true);lyr_ADMINISTRASIDESA_AR_25Kshp_1.setVisible(true);lyr_ADMINISTRASI_LN_25Kshp_2.setVisible(true);lyr_11032026_batas_kel11032026_BATAS_KEL_3.setVisible(true);lyr_11032026_batas_kec11032026_BATAS_KEC_4.setVisible(true);
var layersList = [lyr_googleroadmap_0,group_LapakGIScomKABSIDOARJO,lyr_11032026_batas_kel11032026_BATAS_KEL_3,lyr_11032026_batas_kec11032026_BATAS_KEC_4];
lyr_ADMINISTRASIDESA_AR_25Kshp_1.set('fieldAliases', {'KDPPUM': 'KDPPUM', 'NAMOBJ': 'NAMOBJ', 'REMARK': 'REMARK', 'KDPBPS': 'KDPBPS', 'FCODE': 'FCODE', 'LUASWH': 'LUASWH', 'UUPP': 'UUPP', 'SRS_ID': 'SRS_ID', 'LCODE': 'LCODE', 'METADATA': 'METADATA', 'KDEBPS': 'KDEBPS', 'KDEPUM': 'KDEPUM', 'KDCBPS': 'KDCBPS', 'KDCPUM': 'KDCPUM', 'KDBBPS': 'KDBBPS', 'KDBPUM': 'KDBPUM', 'WADMKD': 'WADMKD', 'WIADKD': 'WIADKD', 'WADMKC': 'WADMKC', 'WIADKC': 'WIADKC', 'WADMKK': 'WADMKK', 'WIADKK': 'WIADKK', 'WADMPR': 'WADMPR', 'WIADPR': 'WIADPR', 'TIPADM': 'TIPADM', 'SHAPE_Leng': 'SHAPE_Leng', 'SHAPE_Area': 'SHAPE_Area', });
lyr_ADMINISTRASI_LN_25Kshp_2.set('fieldAliases', {'KARKTR': 'KARKTR', 'STSBTS': 'STSBTS', 'FCODE': 'FCODE', 'KELAS': 'KELAS', 'UUPP': 'UUPP', 'LOKASI': 'LOKASI', 'REMARK': 'REMARK', 'NAMOBJ': 'NAMOBJ', 'ADMIN1': 'ADMIN1', 'ADMIN2': 'ADMIN2', 'SRS_ID': 'SRS_ID', 'LCODE': 'LCODE', 'METADATA': 'METADATA', 'WAKLD1': 'WAKLD1', 'WAKLD2': 'WAKLD2', 'WADKC1': 'WADKC1', 'WADKC2': 'WADKC2', 'WAKBK1': 'WAKBK1', 'WAKBK2': 'WAKBK2', 'WAPRO1': 'WAPRO1', 'WAPRO2': 'WAPRO2', 'TIPTBT': 'TIPTBT', 'PJGBTS': 'PJGBTS', 'KLBADM': 'KLBADM', 'TIPLOK': 'TIPLOK', 'SHAPE_Leng': 'SHAPE_Leng', });
lyr_11032026_batas_kel11032026_BATAS_KEL_3.set('fieldAliases', {'OBJECTID': 'OBJECTID', 'PROVINSI': 'PROVINSI', 'KABUPATEN': 'KABUPATEN', 'KECAMATAN': 'KECAMATAN', 'DESA': 'DESA', 'SUMBER': 'SUMBER', 'Shape_Leng': 'Shape_Leng', 'Shape_Area': 'Shape_Area', 'NAMOBJ': 'NAMOBJ', 'FCODE': 'FCODE', 'REMARK': 'REMARK', 'METADATA': 'METADATA', 'SRS_ID': 'SRS_ID', 'KDBBPS': 'KDBBPS', 'KDCBPS': 'KDCBPS', 'KDCPUM': 'KDCPUM', 'KDEBPS': 'KDEBPS', 'KDEPUM': 'KDEPUM', 'KDPBPS': 'KDPBPS', 'KDPKAB': 'KDPKAB', 'KDPPUM': 'KDPPUM', 'LUASWH': 'LUASWH', 'TIPADM': 'TIPADM', 'WADMKC': 'WADMKC', 'WADMKD': 'WADMKD', 'WADMKK': 'WADMKK', 'WADMPR': 'WADMPR', 'WIADKC': 'WIADKC', 'WIADKK': 'WIADKK', 'WIADPR': 'WIADPR', 'WIADKD': 'WIADKD', });
lyr_11032026_batas_kec11032026_BATAS_KEC_4.set('fieldAliases', {'OBJECTID_1': 'OBJECTID_1', 'OBJECTID': 'OBJECTID', 'K': 'K', 'KODE': 'KODE', 'LUAS_KM': 'LUAS_KM', 'LUAS_HA': 'LUAS_HA', 'Keterangan': 'Keterangan', 'Shape_Leng': 'Shape_Leng', 'Shape_Le_1': 'Shape_Le_1', 'Shape_Area': 'Shape_Area', });
lyr_ADMINISTRASIDESA_AR_25Kshp_1.set('fieldImages', {'KDPPUM': 'TextEdit', 'NAMOBJ': 'TextEdit', 'REMARK': 'TextEdit', 'KDPBPS': 'TextEdit', 'FCODE': 'TextEdit', 'LUASWH': 'TextEdit', 'UUPP': 'TextEdit', 'SRS_ID': 'TextEdit', 'LCODE': 'TextEdit', 'METADATA': 'TextEdit', 'KDEBPS': 'TextEdit', 'KDEPUM': 'TextEdit', 'KDCBPS': 'TextEdit', 'KDCPUM': 'TextEdit', 'KDBBPS': 'TextEdit', 'KDBPUM': 'TextEdit', 'WADMKD': 'TextEdit', 'WIADKD': 'TextEdit', 'WADMKC': 'TextEdit', 'WIADKC': 'TextEdit', 'WADMKK': 'TextEdit', 'WIADKK': 'TextEdit', 'WADMPR': 'TextEdit', 'WIADPR': 'TextEdit', 'TIPADM': 'TextEdit', 'SHAPE_Leng': 'TextEdit', 'SHAPE_Area': 'TextEdit', });
lyr_ADMINISTRASI_LN_25Kshp_2.set('fieldImages', {'KARKTR': '', 'STSBTS': '', 'FCODE': '', 'KELAS': '', 'UUPP': '', 'LOKASI': '', 'REMARK': '', 'NAMOBJ': '', 'ADMIN1': '', 'ADMIN2': '', 'SRS_ID': '', 'LCODE': '', 'METADATA': '', 'WAKLD1': '', 'WAKLD2': '', 'WADKC1': '', 'WADKC2': '', 'WAKBK1': '', 'WAKBK2': '', 'WAPRO1': '', 'WAPRO2': '', 'TIPTBT': '', 'PJGBTS': '', 'KLBADM': '', 'TIPLOK': '', 'SHAPE_Leng': '', });
lyr_11032026_batas_kel11032026_BATAS_KEL_3.set('fieldImages', {'OBJECTID': 'TextEdit', 'PROVINSI': 'TextEdit', 'KABUPATEN': 'TextEdit', 'KECAMATAN': 'TextEdit', 'DESA': 'TextEdit', 'SUMBER': 'TextEdit', 'Shape_Leng': 'TextEdit', 'Shape_Area': 'TextEdit', 'NAMOBJ': 'TextEdit', 'FCODE': 'TextEdit', 'REMARK': 'TextEdit', 'METADATA': 'TextEdit', 'SRS_ID': 'TextEdit', 'KDBBPS': 'TextEdit', 'KDCBPS': 'TextEdit', 'KDCPUM': 'TextEdit', 'KDEBPS': 'TextEdit', 'KDEPUM': 'TextEdit', 'KDPBPS': 'TextEdit', 'KDPKAB': 'TextEdit', 'KDPPUM': 'TextEdit', 'LUASWH': 'TextEdit', 'TIPADM': 'TextEdit', 'WADMKC': 'TextEdit', 'WADMKD': 'TextEdit', 'WADMKK': 'TextEdit', 'WADMPR': 'TextEdit', 'WIADKC': 'TextEdit', 'WIADKK': 'TextEdit', 'WIADPR': 'TextEdit', 'WIADKD': 'TextEdit', });
lyr_11032026_batas_kec11032026_BATAS_KEC_4.set('fieldImages', {'OBJECTID_1': 'TextEdit', 'OBJECTID': 'TextEdit', 'K': 'TextEdit', 'KODE': 'TextEdit', 'LUAS_KM': 'TextEdit', 'LUAS_HA': 'TextEdit', 'Keterangan': 'TextEdit', 'Shape_Leng': 'TextEdit', 'Shape_Le_1': 'TextEdit', 'Shape_Area': 'TextEdit', });
lyr_ADMINISTRASIDESA_AR_25Kshp_1.set('fieldLabels', {'KDPPUM': 'no label', 'NAMOBJ': 'no label', 'REMARK': 'no label', 'KDPBPS': 'no label', 'FCODE': 'no label', 'LUASWH': 'no label', 'UUPP': 'no label', 'SRS_ID': 'no label', 'LCODE': 'no label', 'METADATA': 'no label', 'KDEBPS': 'no label', 'KDEPUM': 'no label', 'KDCBPS': 'no label', 'KDCPUM': 'no label', 'KDBBPS': 'no label', 'KDBPUM': 'no label', 'WADMKD': 'no label', 'WIADKD': 'no label', 'WADMKC': 'no label', 'WIADKC': 'no label', 'WADMKK': 'no label', 'WIADKK': 'no label', 'WADMPR': 'no label', 'WIADPR': 'no label', 'TIPADM': 'no label', 'SHAPE_Leng': 'no label', 'SHAPE_Area': 'no label', });
lyr_ADMINISTRASI_LN_25Kshp_2.set('fieldLabels', {'KARKTR': 'no label', 'STSBTS': 'no label', 'FCODE': 'no label', 'KELAS': 'no label', 'UUPP': 'no label', 'LOKASI': 'no label', 'REMARK': 'no label', 'NAMOBJ': 'no label', 'ADMIN1': 'no label', 'ADMIN2': 'no label', 'SRS_ID': 'no label', 'LCODE': 'no label', 'METADATA': 'no label', 'WAKLD1': 'no label', 'WAKLD2': 'no label', 'WADKC1': 'no label', 'WADKC2': 'no label', 'WAKBK1': 'no label', 'WAKBK2': 'no label', 'WAPRO1': 'no label', 'WAPRO2': 'no label', 'TIPTBT': 'no label', 'PJGBTS': 'no label', 'KLBADM': 'no label', 'TIPLOK': 'no label', 'SHAPE_Leng': 'no label', });
lyr_11032026_batas_kel11032026_BATAS_KEL_3.set('fieldLabels', {'OBJECTID': 'no label', 'PROVINSI': 'no label', 'KABUPATEN': 'no label', 'KECAMATAN': 'no label', 'DESA': 'no label', 'SUMBER': 'no label', 'Shape_Leng': 'no label', 'Shape_Area': 'no label', 'NAMOBJ': 'no label', 'FCODE': 'no label', 'REMARK': 'no label', 'METADATA': 'no label', 'SRS_ID': 'no label', 'KDBBPS': 'no label', 'KDCBPS': 'no label', 'KDCPUM': 'no label', 'KDEBPS': 'no label', 'KDEPUM': 'no label', 'KDPBPS': 'no label', 'KDPKAB': 'no label', 'KDPPUM': 'no label', 'LUASWH': 'no label', 'TIPADM': 'no label', 'WADMKC': 'no label', 'WADMKD': 'no label', 'WADMKK': 'no label', 'WADMPR': 'no label', 'WIADKC': 'no label', 'WIADKK': 'no label', 'WIADPR': 'no label', 'WIADKD': 'no label', });
lyr_11032026_batas_kec11032026_BATAS_KEC_4.set('fieldLabels', {'OBJECTID_1': 'no label', 'OBJECTID': 'no label', 'K': 'no label', 'KODE': 'no label', 'LUAS_KM': 'no label', 'LUAS_HA': 'no label', 'Keterangan': 'no label', 'Shape_Leng': 'no label', 'Shape_Le_1': 'no label', 'Shape_Area': 'no label', });
lyr_11032026_batas_kec11032026_BATAS_KEC_4.on('precompose', function(evt) {
    evt.context.globalCompositeOperation = 'normal';
});