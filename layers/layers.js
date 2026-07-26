var wms_layers = [];


        var lyr_googleroadmap_0 = new ol.layer.Tile({
            'title': 'google roadmap',
            'opacity': 1.000000,
            
            
            source: new ol.source.XYZ({
            attributions: ' ',
                url: 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}'
            })
        });
var format_SIDOARJO_1 = new ol.format.GeoJSON();
var features_SIDOARJO_1 = format_SIDOARJO_1.readFeatures(json_SIDOARJO_1, 
            {dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857'});
var jsonSource_SIDOARJO_1 = new ol.source.Vector({
    attributions: ' ',
});
jsonSource_SIDOARJO_1.addFeatures(features_SIDOARJO_1);
var lyr_SIDOARJO_1 = new ol.layer.Vector({
                declutter: false,
                source:jsonSource_SIDOARJO_1, 
                style: style_SIDOARJO_1,
                popuplayertitle: 'SIDOARJO',
                interactive: true,
                title: '<img src="styles/legend/SIDOARJO_1.png" /> SIDOARJO'
            });
var format_surabaya_2 = new ol.format.GeoJSON();
var features_surabaya_2 = format_surabaya_2.readFeatures(json_surabaya_2, 
            {dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857'});
var jsonSource_surabaya_2 = new ol.source.Vector({
    attributions: ' ',
});
jsonSource_surabaya_2.addFeatures(features_surabaya_2);
var lyr_surabaya_2 = new ol.layer.Vector({
                declutter: false,
                source:jsonSource_surabaya_2, 
                style: style_surabaya_2,
                popuplayertitle: 'surabaya',
                interactive: true,
                title: '<img src="styles/legend/surabaya_2.png" /> surabaya'
            });

lyr_googleroadmap_0.setVisible(true);lyr_SIDOARJO_1.setVisible(true);lyr_surabaya_2.setVisible(true);
var layersList = [lyr_googleroadmap_0,lyr_SIDOARJO_1,lyr_surabaya_2];
lyr_SIDOARJO_1.set('fieldAliases', {'NAMOBJ': 'NAMOBJ', 'WADMKC': 'WADMKC', 'WADMKK': 'WADMKK', });
lyr_surabaya_2.set('fieldAliases', {'KABUPATEN': 'KABUPATEN', 'KECAMATAN': 'KECAMATAN', 'DESA': 'DESA', });
lyr_SIDOARJO_1.set('fieldImages', {'NAMOBJ': 'TextEdit', 'WADMKC': 'TextEdit', 'WADMKK': 'TextEdit', });
lyr_surabaya_2.set('fieldImages', {'KABUPATEN': 'TextEdit', 'KECAMATAN': 'TextEdit', 'DESA': 'TextEdit', });
lyr_SIDOARJO_1.set('fieldLabels', {'NAMOBJ': 'no label', 'WADMKC': 'no label', 'WADMKK': 'no label', });
lyr_surabaya_2.set('fieldLabels', {'KABUPATEN': 'no label', 'KECAMATAN': 'no label', 'DESA': 'no label', });
lyr_surabaya_2.on('precompose', function(evt) {
    evt.context.globalCompositeOperation = 'normal';
});