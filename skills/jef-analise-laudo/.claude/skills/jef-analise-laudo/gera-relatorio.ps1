param([Parameter(Mandatory)][string]$Andamento, [Parameter(Mandatory)][string]$Saida)
# jef-analise-laudo — gera o .xlsx (aba Triagem, 19 colunas, Arial) a partir do arquivo de andamento, nunca da memória da conversa.
# Andamento:
#   L|<n>|<processo>                       lista do lote, na ordem
#   P|<processo>|<18 colunas B..S>         resultado; a última linha P de cada processo vale
#                                          (linha com 15 colunas ganha em branco as 3 colunas de 18/11/2026; com 12, também
#                                          as 3 de 16/11/2026)
#   F|<processo>|<motivo>                  fora do relatório: não sai na planilha, só no relato final
# Colunas P: Grau | Subgrau | Duração | Classificação | Etiqueta | Ação | Etiqueta controle | Perícia social | Providência |
#            Movimentar para | Curatela | Documento não lido | Petições após o laudo | Proposta de acordo | Intimação do laudo |
#            MPF | Fundamento | Sigiloso  (18 campos depois do número)
$cab = @('Processo', 'Grau do laudo', 'Subgrau (só se C)', 'Duração ≥ 2 anos ou definitiva', 'Classificação', 'Etiqueta prescrita',
  'Ação', 'Etiqueta controle', 'Perícia social', 'Providência', 'Movimentar para', 'Curatela', 'Documento não lido',
  'Petições após o laudo', 'Proposta de acordo', 'Intimação do laudo', 'MPF', 'Fundamento', 'Sigiloso')
$linhas = [ordered]@{}
$fora = @{}
foreach ($l in [IO.File]::ReadAllLines($Andamento, [Text.Encoding]::UTF8)) {
  if ($l -match '^L\|\d+\|(.+)$') { if (-not $linhas.Contains($Matches[1])) { $linhas[$Matches[1]] = $null } }
  elseif ($l -match '^F\|([^|]+)\|') { $fora[$Matches[1]] = $true }
  elseif ($l -match '^P\|') {
    $c = $l.Split('|'); $v = $c[1..($c.Count - 1)]
    # 12 campos (antes de 16/11/2026): Proposta, Intimação e MPF em branco, antes do Fundamento.
    if ($v.Count -eq 13) { $v = $v[0..10] + @('', '', '') + $v[11..12] }
    # 15 campos (antes da v6 de 18/11/2026): Ação, Etiqueta controle e Perícia social em branco, depois da Etiqueta.
    if ($v.Count -eq 16) { $v = $v[0..5] + @('', '', '') + $v[6..15] }
    $linhas[$c[1]] = $v
  }
}
foreach ($k in @($linhas.Keys)) {
  $v = $linhas[$k]
  if ($v -and $v.Count -ne 19 -and -not $fora.ContainsKey($k)) { throw "Última linha P de $k com $($v.Count - 1) colunas (esperadas 18 depois do número)" }
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
    if (-not $v) { $semRes += $k; $v = @($k, '', '', '', 'NÃO ANALISADO', '', '', '', '', '', '', '', '', '', '', '', '', 'sem resultado no andamento', '') }
    for ($j = 0; $j -lt $cab.Count; $j++) { $c = $ws.Cells.Item($r, $j + 1); $c.NumberFormat = '@'; $c.Value2 = [string]$v[$j] }
    $r++
  }
  $u = $ws.UsedRange
  $u.Font.Name = 'Arial'; $u.Font.Size = 10; $u.VerticalAlignment = -4160
  $h = $ws.Range($ws.Cells.Item(1, 1), $ws.Cells.Item(1, $cab.Count)); $h.Font.Bold = $true; $h.Interior.Color = 0x3F2316; $h.Font.Color = 0xFFFFFF
  # Colunas de texto longo: Petições após o laudo (14), Proposta (15), Intimação (16), Fundamento (18).
  foreach ($j in 14, 15, 16, 18) { $ws.Columns.Item($j).ColumnWidth = $(if ($j -eq 18) { 90 } else { 45 }); $ws.Columns.Item($j).WrapText = $true }
  foreach ($j in 1..13 + 17 + 19) { $ws.Columns.Item($j).AutoFit() | Out-Null }
  $ws.Range('A2').Select() | Out-Null; $xl.ActiveWindow.FreezePanes = $true
  $wb.SaveAs($Saida, 51)
  $wb.Close($false)
  "gerado: $Saida ($($r - 2) linhas; fora do relatório: $($fora.Count); sem resultado: $($semRes.Count) $($semRes -join ', '))"
} finally { $xl.Quit(); [Runtime.InteropServices.Marshal]::ReleaseComObject($xl) | Out-Null }
