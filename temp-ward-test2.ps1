$normalize = { param($v) if($null -eq $v){return ''}; $s=[string]$v; $s=$s.Trim(); $s=$s -replace '[\r\n\t]',' '; while($s -match '  '){$s=$s -replace '  ',' '} ; return $s }
$normalizeKey = { param($v) return (&$normalize $v).ToLower() }
$stripAdmin = { param($s) if([string]::IsNullOrWhiteSpace($s)){return ''}; $s=[string]$s; $s=$s.Trim(); $s=$s -replace '^(kab\.|kabupaten|kota|kotamadya)','' -replace '^(kabupaten\s+|kab\s+|kota\s+)',''; return (&$normalize $s) }
$shortWard = { param($s) if([string]::IsNullOrWhiteSpace($s)){return ''}; $s=[string]$s; $s=$s -replace '\bRW\b.*$','' -replace '\bRT\b.*$','' -replace '\(.*\)','' -replace '[\.,]+','.'; return (&$normalize $s) }
$wardIndex = @{}
foreach($path in @('layers\surabaya_2.js','layers\SIDOARJO_1.js')){
    $text = Get-Content $path -Raw -Encoding UTF8
    $json = $text -replace '^[^=]*=','' -replace ';\s*$',''
    $obj = ConvertFrom-Json $json
    foreach($f in $obj.features){
        $props = $f.properties
        $rawCity = &$normalize $props.CITY
        $rawDistrict = &$normalize $props.KECAMATAN
        if(-not $rawDistrict){ $rawDistrict = &$normalize $props.District }
        $rawWard = &$normalize $props.DESA
        if(-not $rawWard){ $rawWard = &$normalize $props.Ward }
        $strippedCity = &$stripAdmin $rawCity
        $strippedDistrict = &$stripAdmin $rawDistrict
        $wardShort = &$shortWard $rawWard
        $coords = $null
        if($f.geometry){ if($f.geometry.type -eq 'Polygon'){ $coords = $f.geometry.coordinates[0] } elseif($f.geometry.type -eq 'MultiPolygon'){ $coords = $f.geometry.coordinates[0][0] } }
        if($coords){ $n=0; $sx=0; $sy=0; foreach($c in $coords){ if($c -is [System.Array] -and $c.Length -ge 2){ $x=[double]$c[0]; $y=[double]$c[1]; if(-not [double]::IsNaN($x) -and -not [double]::IsNaN($y)){ $sx+=$x; $sy+=$y; $n++ } } }; if($n -gt 0){ $coord=@{latitude=($sy/$n); longitude=($sx/$n)}; foreach($key in @("$rawCity||$rawDistrict||$rawWard","$strippedCity||$rawDistrict||$rawWard","$rawCity||$strippedDistrict||$rawWard","$strippedCity||$strippedDistrict||$rawWard","$rawCity||$rawDistrict||$wardShort","$strippedCity||$strippedDistrict||$wardShort","||$rawDistrict||$rawWard","||$rawDistrict||$wardShort","||$strippedDistrict||$wardShort","||$rawWard","||$wardShort")){ $wardIndex[(&$normalizeKey $key)] = $coord } } }
    }
}
$csv = Import-Csv data\customer.csv -Delimiter ';' | Where-Object { ([string]::IsNullOrWhiteSpace($_.Latitude) -or $_.Latitude -eq '0' -or $_.Latitude -eq '0.0') -and ([string]::IsNullOrWhiteSpace($_.Longitude) -or $_.Longitude -eq '0' -or $_.Longitude -eq '0.0') }
$count=0; $resolved=0
foreach($row in $csv){
    $count++
    $nc=&$normalize $row.City
    $nd=&$normalize $row.District
    $nw=&$normalize $row.Ward
    $stripNd = &$stripAdmin $nd
    $stripNw = &$stripAdmin $nw
    $shortNw = &$shortWard $nw
    $candidates = @()
    $candidates += (&$normalizeKey ($nc + '||' + $nd + '||' + $nw))
    $candidates += (&$normalizeKey (($stripAdmin $nc) + '||' + $nd + '||' + $nw))
    $candidates += (&$normalizeKey ($nc + '||' + $stripNd + '||' + $nw))
    $candidates += (&$normalizeKey (($stripAdmin $nc) + '||' + $stripNd + '||' + $nw))
    $candidates += (&$normalizeKey ($nc + '||' + $nd + '||' + $stripNw))
    $candidates += (&$normalizeKey ($nc + '||' + $nd + '||' + $shortNw))
    $candidates += (&$normalizeKey ('||' + $stripNd + '||' + $nw))
    $candidates += (&$normalizeKey ('||' + $stripNd + '||' + $stripNw))
    $candidates += (&$normalizeKey ('||' + $stripNd + '||' + $shortNw))
    $candidates += (&$normalizeKey ('||' + $nd + '||' + $nw))
    $candidates += (&$normalizeKey ('||' + $nw))
    if($candidates | Where-Object { $wardIndex.ContainsKey($_) }){ $resolved++ }
}
Write-Host "zero rows: $count, resolved: $resolved, resolution %=$([math]::Round(($resolved/$count*100),2))"
