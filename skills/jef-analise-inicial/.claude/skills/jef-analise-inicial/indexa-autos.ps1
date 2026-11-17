# indexa-autos.ps1 — jef-analise-inicial: leitura local dos autos baixados (desenvolvido na 7ª Vara Federal da Paraíba; não usa dado da unidade)
#
# Para cada <número do processo>.pdf da subpasta de trabalho, extrai o texto de todas as páginas (pdftotext,
# do Poppler), identifica cada página pelo rodapé do PJe "Num. <ID> - Pág. <n>" e separa as páginas
# digitalizadas (sem texto além do rodapé). Grava, na subpasta "texto" da pasta de trabalho:
#   <processo>.txt                 texto integral, página a página, com o cabeçalho
#                                  "=== p<página do PDF> | ID <ID> p.<n>" (e "[DIGITALIZADA]" quando for o caso)
#   <processo>_indice.txt          capa, documentos (ID, páginas no PDF, quantas digitalizadas), páginas
#                                  digitalizadas (página do PDF -> ID e página) e pistas (CID, outros processos,
#                                  renúncia, CEP), cada uma com ID e página
#                                  e as faixas de páginas digitalizadas do PDF dos autos, de até 20 páginas,
#                                  para a leitura visual direto no PDF dos autos
# As pistas só apontam onde ler; a análise é feita pela leitura do texto e das páginas digitalizadas.
# Esses arquivos trazem dados dos autos: são apagados na limpeza, junto com os PDFs.
#
# Com -Andamento, compara os documentos do PDF com a lista da tela (linha "T|<processo>|IDS: ..." do arquivo de
# andamento) e aponta no índice os que ficaram FORA DO PDF.
#
# Uso: pwsh -File indexa-autos.ps1 [-Pasta "<Downloads>\Análise inicial"] [-Processos 0000000-00.2026.4.05.0000,...]
#                                  [-Andamento "Relatórios\Analise_inicial_AAAA-MM-DD_andamento.txt"]
param(
  [string]$Pasta = (Join-Path $env:USERPROFILE 'Downloads\Análise inicial'),
  [string[]]$Processos,
  [string]$Andamento   # arquivo de andamento: as linhas "T|<processo>|IDS: ..." trazem os documentos da tela
)
$ErrorActionPreference = 'Stop'
$bin = Split-Path (Get-Command pdftotext).Source
$saida = Join-Path $Pasta 'texto'
New-Item -ItemType Directory -Force $saida | Out-Null

$pdfs = Get-ChildItem $Pasta -Filter '*.pdf' | Where-Object { $_.BaseName -match '^\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}$' }
if ($Processos) { $pdfs = $pdfs | Where-Object { $Processos -contains $_.BaseName } }

$idsTela = @{}
if ($Andamento) {
  foreach ($l in Get-Content $Andamento -Encoding utf8) { if ($l -match '^T\|([\d.\-]+)\|IDS: ([\d,]*)') { $idsTela[$Matches[1]] = $Matches[2].Split(',') | Where-Object { $_ } } }
}

# Linhas do rodapé e da assinatura eletrônica, que não contam como texto da página.
$rodape = '^\s*(Num\.\s*\d+\s*-\s*P[áa]g\.\s*\d+|Assinado eletronicamente por|https?://|N[úu]mero do documento:|Este documento foi gerado pelo usu[áa]rio|Documento assinado eletronicamente)'

foreach ($f in $pdfs) {
  $num = $f.BaseName
  # As ferramentas do Poppler não gravam em caminho com acento ("Análise inicial"): extrai numa pasta
  # temporária sem acento.
  $tmpDir = Join-Path ([IO.Path]::GetTempPath()) ('idx_' + $num)
  New-Item -ItemType Directory -Force $tmpDir | Out-Null
  $tmp = Join-Path $tmpDir 'raw.txt'
  & "$bin\pdftotext.exe" -q -enc UTF-8 $f.FullName $tmp
  $paginas = ([IO.File]::ReadAllText($tmp, [Text.Encoding]::UTF8)) -split "`f"
  if ($paginas[-1].Trim() -eq '') { $paginas = $paginas[0..($paginas.Count - 2)] }
  # A capa (lista de documentos em tabela) sai melhor com o layout preservado.
  & "$bin\pdftotext.exe" -q -enc UTF-8 -layout -f 1 -l 4 $f.FullName $tmp
  $capaLayout = ([IO.File]::ReadAllText($tmp, [Text.Encoding]::UTF8)) -split "`f"

  $txt = [Text.StringBuilder]::new()
  $docs = [ordered]@{}
  $capa = [Text.StringBuilder]::new()
  $digit = @()
  $pistas = @{ CID = @(); PROC = @(); RENUNCIA = @(); CEP = @() }
  for ($i = 0; $i -lt $paginas.Count; $i++) {
    $p = $i + 1
    $linhas = $paginas[$i] -split "`r?`n"
    $m = [regex]::Matches($paginas[$i], 'Num\.\s*(\d+)\s*-\s*P[áa]g\.\s*(\d+)')
    $id = ''; $pg = ''
    if ($m.Count) { $id = $m[$m.Count - 1].Groups[1].Value; $pg = $m[$m.Count - 1].Groups[2].Value }
    $corpo = ($linhas | Where-Object { $_ -notmatch $rodape } | ForEach-Object { ($_ -replace '\s+', ' ').Trim() } | Where-Object { $_ }) -join "`n"
    $letras = ([regex]::Matches($corpo, '\p{L}')).Count
    $scan = $id -and $letras -lt 40
    if (-not $id) { [void]$capa.AppendLine($(if ($i -lt $capaLayout.Count) { (($capaLayout[$i] -split "`r?`n") | ForEach-Object { $_.TrimEnd() } | Where-Object { $_ }) -join "`n" } else { $corpo })) }
    else {
      if (-not $docs.Contains($id)) { $docs[$id] = [ordered]@{ ini = $p; fim = $p; n = 0; dig = 0 } }
      $docs[$id].fim = $p; $docs[$id].n++
      if ($scan) { $docs[$id].dig++; $digit += [pscustomobject]@{ p = $p; id = $id; pg = $pg } }
    }
    $ref = if ($id) { "ID $id p.$pg" } else { 'capa' }
    [void]$txt.AppendLine("=== p$p | $ref$(if ($scan) { ' [DIGITALIZADA]' })")
    [void]$txt.AppendLine($corpo)
    if ($id) {
      foreach ($c in [regex]::Matches($corpo, '(?i)CID[\s\-:–]*(?:10)?[\s\-:–]*((?:[A-TV-Z]\s?\d{2}(?:\.\d{1,2})?[\s,;e/]*)+)')) {
        foreach ($k in [regex]::Matches($c.Groups[1].Value, '[A-TV-Z]\s?\d{2}(?:\.\d{1,2})?')) { $pistas.CID += "$($k.Value -replace '\s','') ($ref)" }
      }
      foreach ($k in [regex]::Matches($corpo, '\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}')) { if ($k.Value -ne $num) { $pistas.PROC += "$($k.Value) ($ref)" } }
      if ($corpo -match '(?i)ren[úu]nci') { $pistas.RENUNCIA += $ref }
      foreach ($k in [regex]::Matches($corpo, '\b\d{2}\.?\d{3}-\d{3}\b')) { $pistas.CEP += "$($k.Value) ($ref)" }
    }
  }
  [IO.File]::WriteAllText((Join-Path $saida "$num.txt"), $txt.ToString(), [Text.UTF8Encoding]::new($false))

  Remove-Item $tmpDir -Recurse -Force

  # Faixas de páginas digitalizadas do PDF dos autos, de até 20 páginas cada, para a leitura visual.
  $faixas = @(); $ini = $null; $ant = $null
  foreach ($d in $digit) {
    if ($null -ne $ini -and $d.p -eq $ant + 1 -and $d.p - $ini -lt 20) { $ant = $d.p; continue }
    if ($null -ne $ini) { $faixas += $(if ($ant -ne $ini) { "$ini-$ant" } else { "$ini" }) }
    $ini = $d.p; $ant = $d.p
  }
  if ($null -ne $ini) { $faixas += $(if ($ant -ne $ini) { "$ini-$ant" } else { "$ini" }) }

  $ind = [Text.StringBuilder]::new()
  [void]$ind.AppendLine("PROCESSO $num | $($paginas.Count) páginas no PDF | $($digit.Count) digitalizadas | $($docs.Count) documentos")
  [void]$ind.AppendLine('--- CAPA')
  [void]$ind.AppendLine($capa.ToString().Trim())
  [void]$ind.AppendLine('--- DOCUMENTOS (ID: páginas no PDF, digitalizadas)')
  foreach ($k in $docs.Keys) { $d = $docs[$k]; [void]$ind.AppendLine("$k`: p$($d.ini)$(if ($d.fim -ne $d.ini) { "-$($d.fim)" }) ($($d.n) pág.)$(if ($d.dig) { " — $($d.dig) digitalizada(s)" })") }
  $fora = ''
  if ($idsTela.ContainsKey($num)) {
    $fora = @($idsTela[$num] | Where-Object { -not $docs.Contains($_) })
    [void]$ind.AppendLine($(if ($fora.Count) { "--- FORA DO PDF ($($fora.Count) de $($idsTela[$num].Count) documentos da tela): $($fora -join ', ') — ler pelas linhas EXTRA do script ou por AI.texto(id)" } else { "--- todos os $($idsTela[$num].Count) documentos da tela estão no PDF" }))
  } elseif ($Andamento) { [void]$ind.AppendLine('--- documentos da tela: sem linha IDS no andamento — conferir') }
  [void]$ind.AppendLine("--- DIGITALIZADAS ($($digit.Count)) — ler visualmente no PDF dos autos, nestas faixas: $($faixas -join ', ')")
  foreach ($d in $digit) { [void]$ind.AppendLine("p$($d.p) -> ID $($d.id) p.$($d.pg)") }
  [void]$ind.AppendLine('--- PISTAS (só apontam onde ler)')
  foreach ($c in 'CID', 'PROC', 'RENUNCIA', 'CEP') { [void]$ind.AppendLine("$c`: $(($pistas[$c] | Select-Object -Unique) -join '; ')") }
  [IO.File]::WriteAllText((Join-Path $saida "${num}_indice.txt"), $ind.ToString(), [Text.UTF8Encoding]::new($false))
  "$num | $($paginas.Count) pág. | $($digit.Count) digitalizadas | $($docs.Count) documentos$(if ($fora) { " | FORA DO PDF: $($fora -join ', ')" })"
}
