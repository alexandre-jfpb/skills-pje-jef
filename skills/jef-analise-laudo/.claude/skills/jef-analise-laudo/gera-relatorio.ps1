param([Parameter(Mandatory)][string]$Andamento, [Parameter(Mandatory)][string]$Saida)
# jef-analise-laudo — gera o .xlsx (aba Triagem, 16 colunas, Arial) a partir do arquivo de andamento, nunca da memória da conversa.
# Andamento:
#   L|<n>|<processo>                       lista do lote, na ordem
#   P|<processo>|<15 colunas B..P>         resultado; a última linha P de cada processo vale
#                                          (linha antiga, com 12 colunas, ganha em branco as 3 colunas de 16/11/2026)
#   F|<processo>|<motivo>                  fora do relatório: não sai na planilha, só no relato final
# Colunas P: Grau | Subgrau | Duração | Classificação | Etiqueta | Providência | Movimentar para | Curatela | Documento não lido |
#            Petições após o laudo | Proposta de acordo | Intimação do laudo | MPF | Fundamento | Sigiloso  (15 campos depois do número)
$cab = @('Processo', 'Grau do laudo', 'Subgrau (só se C)', 'Duração ≥ 2 anos ou definitiva', 'Classificação', 'Etiqueta prescrita', 'Providência',
  'Movimentar para', 'Curatela', 'Documento não lido', 'Petições após o laudo', 'Proposta de acordo', 'Intimação do laudo', 'MPF', 'Fundamento', 'Sigiloso')
$linhas = [ordered]@{}
$fora = @{}
foreach ($l in [IO.File]::ReadAllLines($Andamento, [Text.Encoding]::UTF8)) {
  if ($l -match '^L\|\d+\|(.+)$') { if (-not $linhas.Contains($Matches[1])) { $linhas[$Matches[1]] = $null } }
  elseif ($l -match '^F\|([^|]+)\|') { $fora[$Matches[1]] = $true }
  elseif ($l -match '^P\|') {
    $c = $l.Split('|'); $v = $c[1..($c.Count - 1)]
    if ($v.Count -eq 13) { $v = $v[0..10] + @('', '', '') + $v[11..12] }
    $linhas[$c[1]] = $v
  }
}
foreach ($k in @($linhas.Keys)) {
  $v = $linhas[$k]
  if ($v -and $v.Count -ne 16 -and -not $fora.ContainsKey($k)) { throw "Última linha P de $k com $($v.Count - 1) colunas (esperadas 15 depois do número)" }
}
$xl = New-Object -ComObject Excel.Application
$xl.Visible = $false; $xl.DisplayAlerts = $false
try {
  $wb = $xl.Workbooks.Add()
  $ws = $wb.Worksheets.Item(1); $ws.Name = 'Triagem'
  for ($j = 0; $j -lt $cab.Count; $j++) { $c = $ws.Cells.Item(1, $j + 1); $c.NumberFormat = '@'; $c.Value2 = $cab[$j] }
  $r = 2; $semRes = @()
  foreach ($k in $linhas.Keys) {
    if ($fora.ContainsKey($k)) { continue }
    $v = $linhas[$k]
    if (-not $v) { $semRes += $k; $v = @($k, '', '', '', 'NÃO ANALISADO', '', '', '', '', '', '', '', '', '', 'sem resultado no andamento', '') }
    for ($j = 0; $j -lt $cab.Count; $j++) { $c = $ws.Cells.Item($r, $j + 1); $c.NumberFormat = '@'; $c.Value2 = [string]$v[$j] }
    $r++
  }
  $u = $ws.UsedRange
  $u.Font.Name = 'Arial'; $u.Font.Size = 10; $u.VerticalAlignment = -4160
  $h = $ws.Range($ws.Cells.Item(1, 1), $ws.Cells.Item(1, $cab.Count)); $h.Font.Bold = $true; $h.Interior.Color = 0x3F2316; $h.Font.Color = 0xFFFFFF
  foreach ($j in 11, 12, 13, 15) { $ws.Columns.Item($j).ColumnWidth = $(if ($j -eq 15) { 90 } else { 45 }); $ws.Columns.Item($j).WrapText = $true }
  foreach ($j in 1..10 + 14 + 16) { $ws.Columns.Item($j).AutoFit() | Out-Null }
  $ws.Range('A2').Select() | Out-Null; $xl.ActiveWindow.FreezePanes = $true
  $wb.SaveAs($Saida, 51)
  $wb.Close($false)
  "gerado: $Saida ($($r - 2) linhas; fora do relatório: $($fora.Count); sem resultado: $($semRes.Count) $($semRes -join ', '))"
} finally { $xl.Quit(); [Runtime.InteropServices.Marshal]::ReleaseComObject($xl) | Out-Null }
