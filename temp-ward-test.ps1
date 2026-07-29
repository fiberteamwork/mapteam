function Normalize([string]$value){ if($null -eq $value){return ''}; $v=[string]$value; $v=$v -replace '[\r\n\t]',' '; $v=$v.Trim(); while($v -match '  '){$v=$v -replace '  ',' '} ; return $v }
function NormalizeKey([string]$value){ return (Normalize $value).ToLower(); }
function StripAdminPrefixes([string]$s){ if([string]::IsNullOrWhiteSpace($s)){return ''}; $s=$s.Trim(); $s=$s -replace '^(kab\.|kabupaten|kota|kotamadya)','' -replace '^(kabupaten\s+|kab\s+|kota\s+)',''; return Normalize $s }
function ShortWardName([string]$s){ if([string]::IsNullOrWhiteSpace($s)){return ''}; $s=$s -replace '\bRW\b.*$','' -replace '\bRT\b.*$','' -replace '\(.*\)','' -replace '[\.,]+','.'; return Normalize $s }
function AddWardKey([string]$k,$coord,$index){ $key = NormalizeKey($k); if(-not $index.ContainsKey($key)){ $index[$key]=$coord } }
$wardIndex = @{}
foreach($path in @('layers\surabaya_2.js','layers\SIDOARJO_1.js')){
    $text = Get-Content $path -Raw -Encoding UTF8
    $json = $text -replace '^[^=]*=','' -replace ';\s*$',''
    $obj = ConvertFrom-Json $json
    foreach($f in $obj.features){
        $props = $f.properties
        $rawCity=Normalize($props.CITY)
        $rawDistrict=Normalize($props.KECAMATAN)
        if(-not $rawDistrict){ $rawDistrict=Normalize($props.DISTRICT) }
        $rawWard=Normalize($props.DESA)
        if(-not $rawWard){ $rawWard=Normalize($props.WARD) }
        if(-not $rawWard){ $rawWard=Normalize($props.Ward) }
        if(-not $rawWard){ $rawWard=Normalize($props.name) }
        $strippedCity=Normalize(StripAdminPrefixes($rawCity))
        $strippedDistrict=Normalize(StripAdminPrefixes($rawDistrict))
        $wardShort=Normalize(ShortWardName($rawWard))
        $coords = $null
        if($f.geometry){ if($f.geometry.type -eq 'Polygon'){ $coords=$f.geometry.coordinates[0] } elseif($f.geometry.type -eq 'MultiPolygon'){ $coords=$f.geometry.coordinates[0][0] } }
        if($coords){ $n=0; $sx=0; $sy=0; foreach($c in $coords){ if($c -is [System.Array] -and $c.Length -ge 2){ $x=[double]$c[0]; $y=[double]$c[1]; if(-not [double]::IsNaN($x) -and -not [double]::IsNaN($y)){ $sx+=$x; $sy+=$y; $n++ } } }; if($n -gt 0){ $coord = @{latitude=($sy/$n); longitude=($sx/$n)}; AddWardKey("$rawCity||$rawDistrict||$rawWard", $coord, $wardIndex); AddWardKey("$strippedCity||$rawDistrict||$rawWard", $coord, $wardIndex); AddWardKey("$rawCity||$strippedDistrict||$rawWard", $coord, $wardIndex); AddWardKey("$strippedCity||$strippedDistrict||$rawWard", $coord, $wardIndex); AddWardKey("$rawCity||$rawDistrict||$wardShort", $coord, $wardIndex); AddWardKey("$strippedCity||$strippedDistrict||$wardShort", $coord, $wardIndex); AddWardKey("||$rawDistrict||$rawWard", $coord, $wardIndex); AddWardKey("||$rawDistrict||$wardShort", $coord, $wardIndex); AddWardKey("||$strippedDistrict||$wardShort", $coord, $wardIndex); AddWardKey("||$rawWard", $coord, $wardIndex); AddWardKey("||$wardShort", $coord, $wardIndex); } } }
}
$count0=0; $resolved=0; $sample=@()
$csv = Import-Csv data\customer.csv -Delimiter ';'
foreach($row in $csv){ $lat=$row.Latitude; $lon=$row.Longitude; if((([string]::IsNullOrWhiteSpace($lat) -or $lat -eq '0' -or $lat -eq '0.0') -and ([string]::IsNullOrWhiteSpace($lon) -or $lon -eq '0' -or $lon -eq '0.0'))){ $count0++; $nc=Normalize($row.City); $nd=Normalize($row.District); $nw=Normalize($row.Ward); $candidates = @("$nc||$nd||$nw","$(StripAdminPrefixes($nc))||$nd||$nw","$nc||$(StripAdminPrefixes($nd))||$nw","$(StripAdminPrefixes($nc))||$(StripAdminPrefixes($nd))||$nw","$nc||$nd||$(StripAdminPrefixes($nw))","$nc||$nd||$(ShortWardName($nw))","||$(StripAdminPrefixes($nd))||$nw","||$(StripAdminPrefixes($nd))||$(StripAdminPrefixes($nw))","||$(StripAdminPrefixes($nd))||$(ShortWardName($nw))","||$nd||$nw","||$nw") | ForEach-Object { NormalizeKey($_) }; $found=$false; foreach($k in $candidates){ if($wardIndex.ContainsKey($k)){ $found=$true; break } }; if($found){ $resolved++ } else { if($sample.Count -lt 10){ $sample += @{City=$nc; District=$nd; Ward=$nw; Cand1=$candidates[0]} } } } }
Write-Host "zero rows: $count0, resolved: $resolved"
$sample | Format-Table -AutoSize
