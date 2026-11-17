# monta-rodada.ps1 — montador genérico da rodada da jef-analise-inicial (formato de 22/10/2026, 13 colunas).
#   Entradas: o andamento; -Mdr = pasta dos relatórios <processo>.md; -Rows = pasta das linhas de etiquetas <processo>.txt
#   (MEDICA=, SOCIAL=, PREVENCAO=, INCOMPETENCIA=, EMENDAR=); -CsvOrigem = CSV do PJe (assunto principal). Ver SKILL.md, passo 6.
#   (sem -Build)  valida os relatórios prontos e grava no andamento a linha R dos que passaram e ainda não têm R
#                 (-Refaz regrava a R dos que já têm, quando o relatório mudou)
#   -Build        gera o CSV (das linhas R e N do andamento) e os .zip por servidor; recusa se faltar algo ou houver divergência
#   -Config       JSON gerado de docs/configuracao-unidade.md (SKILL.md, "Como a configuração chega aos scripts"): etiquetas
#                 de perícia médica e social aceitas, assessoria por assunto, fases e etiquetas de encaminhamento. Obrigatório.
#   Desenvolvido na 7ª Vara Federal da Paraíba.
param(
  [Parameter(Mandatory)][string]$Andamento,
  [Parameter(Mandatory)][string]$Mdr,
  [Parameter(Mandatory)][string]$Rows,
  [Parameter(Mandatory)][string]$DataAnalise,
  [Parameter(Mandatory)][string]$Servidores,   # 'Maria Silva:1-60;João Souza:61-120;...'
  [string]$CsvOrigem,                          # CSV do PJe (assuntoPrincipal por processo)
  [string]$Config,                             # configuração da unidade (JSON)
  [switch]$Build, [switch]$Refaz, [string]$Saida
)
$ErrorActionPreference = 'Stop'

# --- Configuração da unidade (padrão vazio: sem ela, recusa) ---
$cfgMsg = 'RECUSADO: configure a unidade antes de iniciar: passe -Config com o JSON gerado de docs/configuracao-unidade.md (SKILL.md, "Como a configuração chega aos scripts")'
if (-not $Config -or -not (Test-Path -LiteralPath $Config)) { "$cfgMsg — arquivo de configuração não informado ou não encontrado"; return }
$cfg = Get-Content -LiteralPath $Config -Raw -Encoding utf8 | ConvertFrom-Json
function Vazio($v) { $s = [string]$v; -not $s.Trim() -or $s.Trim() -eq 'PENDENTE' }
$cfgFalta = @()
$E = $cfg.etiquetas
foreach ($k in 'cancelarDistribuicao', 'verificarCadastro', 'prevencao', 'incompetencia', 'emendar', 'designarPericia', 'citar') { if (-not $E -or (Vazio $E.$k)) { $cfgFalta += "etiquetas.$k" } }
if (Vazio $cfg.fasePericia) { $cfgFalta += 'fasePericia' }
$fasesAC = @($cfg.fasesAssessoriaCitar | Where-Object { -not (Vazio $_) })
if (-not $fasesAC.Count) { $cfgFalta += 'fasesAssessoriaCitar' }
$medOk = @($cfg.etiquetasMedicas | Where-Object { -not (Vazio $_) })
if (-not $medOk.Count) { $cfgFalta += 'etiquetasMedicas' }
$socOk = @($cfg.etiquetasSociais | Where-Object { -not (Vazio $_) })
if (-not $socOk.Count) { $cfgFalta += 'etiquetasSociais' }
$assProps = @(if ($cfg.assessoria) { $cfg.assessoria.PSObject.Properties | Where-Object { -not (Vazio $_.Name) -and -not (Vazio $_.Value) } })
if (-not $assProps.Count) { $cfgFalta += 'assessoria' }
if ($cfgFalta.Count) { "$cfgMsg — falta $($cfgFalta -join ', ')"; return }
$sub = if ($Saida) { $Saida } else { Join-Path $env:USERPROFILE 'Downloads\Análise inicial' }
$utf8 = [Text.UTF8Encoding]::new($false)
$serv = @(); foreach ($s in $Servidores.Split(';')) { $p = $s.Split(':'); $r = $p[1].Split('-'); $serv += ,@($p[0], [int]$r[0], [int]$r[1]) }
function ZipDe([int]$pos) { foreach ($s in $serv) { if ($pos -ge $s[1] -and $pos -le $s[2]) { return "Analise_inicial_$($s[0] -replace ' ','_')_$DataAnalise.zip" } }; '' }
function Norm([string]$x) {
  $d = $x.Normalize([Text.NormalizationForm]::FormD); $sb = New-Object Text.StringBuilder
  foreach ($c in $d.ToCharArray()) { if ([Globalization.CharUnicodeInfo]::GetUnicodeCategory($c) -ne 'NonSpacingMark') { [void]$sb.Append($c) } }
  $y = $sb.ToString().ToLowerInvariant() -replace '[–—]', '-' -replace '\s+', ''
  $y
}

# Etiquetas de perícia médica e social aceitas ($medOk, $socOk) vêm da configuração (acima).

# Assessoria: assunto principal da capa -> etiqueta (configuração; SKILL.md, "Etiquetas de encaminhamento")
$assMap = @{}
foreach ($p in $assProps) { $assMap[$p.Name] = [string]$p.Value }
$assNorm = @{}; foreach ($k in $assMap.Keys) { $assNorm[(Norm $k)] = $assMap[$k] }

# assunto principal por processo (CSV do PJe)
$assCsv = @{}
if ($CsvOrigem) { foreach ($r in Import-Csv -Delimiter ';' -Encoding UTF8 $CsvOrigem) { $assCsv[$r.numeroProcesso] = [string]$r.assuntoPrincipal } }

$and = [IO.File]::ReadAllLines($Andamento, [Text.Encoding]::UTF8)
$lista = [ordered]@{}; $tela = @{}; $cadv = @{}; $Rmap = @{}; $Nmap = @{}
foreach ($l in $and) {
  $l = $l.TrimStart([char]0xFEFF)
  if ($l -match '^L\|(\d+)\|([\d.\-]+)$') { $lista[$Matches[2]] = [int]$Matches[1] }
  elseif ($l -match '^T\|([\d.\-]+)\|(.*)$') { if (-not $tela.ContainsKey($Matches[1])) { $tela[$Matches[1]] = @() }; $tela[$Matches[1]] += $Matches[2] }
  elseif ($l -match '^CADV\|([\d.\-]+)\|(\S+)') { $cadv[$Matches[1]] = $Matches[2] }
  elseif ($l -match '^R\|') { $c = $l.Split('|'); $Rmap[$c[2]] = $l }
  elseif ($l -match '^N\|([\d.\-]+)\|(.*)$') { $Nmap[$Matches[1]] = $Matches[2] }
}

function QuadroLinha([string]$txt, [string]$rotulo) {
  foreach ($x in $txt -split "`n") { if ($x -match [regex]::Escape($rotulo)) { return $x } }
  return $null
}

function Valida($n) {
  $err = @(); $av = @()
  $t = $tela[$n] -join "`n"
  $tarefa = ([regex]::Match($t, '\|tarefa ([^|]*)\|')).Groups[1].Value.Trim()
  $assuntoTela = ([regex]::Match($t, '(?m)^DET: .*?Assunto (.*?) \(\d+\)')).Groups[1].Value.Trim()
  $assunto = if ($assCsv.ContainsKey($n) -and $assCsv[$n]) { $assCsv[$n].Trim() } else { $assuntoTela }
  if (-not $tarefa -or $tarefa -eq '?') { $err += 'tarefa não lida na tela' }
  if (-not $assunto) { $err += 'assunto não lido' }
  $v = $cadv[$n]; if (-not $v) { $err += 'sem CADV' }
  $md = Join-Path $Mdr "$n.md"; $rw = Join-Path $Rows "$n.txt"
  if (-not (Test-Path -LiteralPath $md) -or -not (Test-Path -LiteralPath $rw)) { return @{ pronto = $false } }
  $txt = [IO.File]::ReadAllText($md, [Text.Encoding]::UTF8)
  $kv = @{}; foreach ($x in [IO.File]::ReadAllLines($rw, [Text.Encoding]::UTF8)) { if ($x -match '^﻿?(\w+)=(.*)$') { $kv[$Matches[1]] = $Matches[2].Trim() } }
  if ($kv.ERRO) { $err += "agente: ERRO=$($kv.ERRO)" }
  foreach ($k in 'MEDICA', 'SOCIAL', 'PREVENCAO', 'INCOMPETENCIA', 'EMENDAR') { if (-not $kv.ContainsKey($k)) { $err += "linha $k ausente" } }
  $med = [string]$kv.MEDICA; $soc = [string]$kv.SOCIAL; $prev = [string]$kv.PREVENCAO; $inc = [string]$kv.INCOMPETENCIA; $eme = [string]$kv.EMENDAR
  if ($txt -notmatch [regex]::Escape("# Análise inicial — $n")) { $err += 'título do relatório sem o número do processo' }
  $irr = $txt -match 'CADASTRO DAS PARTES IRREGULAR: CANCELAR DISTRIBUIÇÃO'
  $ver = $txt -match 'Cadastro das partes — A VERIFICAR'
  $reg = $txt -match 'Cadastro das partes[:\*\s]+conferido na tela.*— regular\.'
  switch ($v) {
    'IRREGULAR' { if (-not $irr -or $ver -or $reg) { $err += 'relatório diverge do veredito IRREGULAR' }; $cad = [string]$E.cancelarDistribuicao }
    'VERIFICAR' { if (-not $ver -or $irr -or $reg) { $err += 'relatório diverge do veredito VERIFICAR' }; $cad = [string]$E.verificarCadastro }
    'REGULAR'   { if (-not $reg -or $irr -or $ver) { $err += 'relatório diverge do veredito REGULAR' }; $cad = '' }
    default     { $err += "veredito $v"; $cad = '' }
  }
  $temPrev = $txt -match 'Ação anterior entre as mesmas partes — possível prevenção'
  if ($prev -and $prev -ne [string]$E.prevencao) { $err += "PREVENCAO inválida: $prev" }
  if ($temPrev -ne [bool]$prev) { $err += "PREVENCAO ($prev) diverge do relatório (título presente: $temPrev)" }
  if ($inc -and $inc -ne [string]$E.incompetencia) { $err += "INCOMPETENCIA inválida: $inc" }
  if ($eme -and $eme -ne [string]$E.emendar) { $err += "EMENDAR inválida: $eme" }
  foreach ($par in @(@('INCOMPETÊNCIA', $inc), @('EMENDAR', $eme))) {
    $ln = QuadroLinha $txt ("Etiqueta " + $par[0])
    if (-not $ln) { $err += "quadro resumo sem a linha 'Etiqueta $($par[0])'" }
    else { $naoSeAplica = $ln -match '(?i)n[ãa]o se aplica'; if ([bool]$par[1] -eq $naoSeAplica) { $err += "linha 'Etiqueta $($par[0])' do quadro diverge da linha de etiquetas ($($par[1]))" } }
  }
  if ($med -and $medOk -notcontains $med) { $err += "etiqueta médica fora da lista: $med" }
  if ($soc -and $socOk -notcontains $soc) { $err += "etiqueta social fora da lista: $soc" }
  if ($med -and -not $txt.Contains($med)) { $err += 'etiqueta médica não aparece no relatório' }
  if ($soc -and -not $txt.Contains($soc)) { $err += 'etiqueta social não aparece no relatório' }
  if ($soc -and $assunto -notmatch 'Defici|Idoso|Assistencial') { $av += "etiqueta social em assunto '$assunto'" }
  if ($med -and $assunto -match '^Idoso$') { $av += 'etiqueta médica em LOAS idoso' }
  if (-not $med -and $assunto -match 'Incapacidade|Invalidez|Acidente|Defici') { $av += "sem etiqueta médica em '$assunto'" }
  if (-not $soc -and $assunto -match 'Defici|Idoso') { $av += "sem etiqueta social em '$assunto'" }
  # colunas calculadas
  $fase = Norm $tarefa
  $imp = ($cad -ne '') -or [bool]$prev -or [bool]$inc -or [bool]$eme
  $designar = ''; $assess = ''; $citar = ''
  if ($fase -eq (Norm $cfg.fasePericia)) { if (-not $imp) { $designar = [string]$E.designarPericia } }
  elseif (@($fasesAC | ForEach-Object { Norm $_ }) -contains $fase) {
    $na = Norm $assunto; if ($assNorm.ContainsKey($na)) { $assess = $assNorm[$na] } else { $av += "assunto fora da tabela de assessoria: '$assunto'" }
    if (-not $imp) { $citar = [string]$E.citar }
  }
  $pos = $lista[$n]
  return @{ pronto = $true; err = $err; av = $av; linha = "R|$tarefa|$n|$(ZipDe $pos)|$med|$soc|$cad|$prev|$inc|$eme|$designar|$assess|$citar|$assunto" }
}

if (-not $Build) {
  $novas = New-Object System.Collections.Generic.List[string]; $falhas = @(); $avisos = @()
  foreach ($n in $lista.Keys) {
    if ($Nmap.ContainsKey($n) -or -not $tela.ContainsKey($n)) { continue }
    if ($Rmap.ContainsKey($n) -and -not $Refaz) { continue }
    $res = Valida $n
    if (-not $res.pronto) { continue }
    if ($res.err.Count) { $falhas += "$($lista[$n]) $n :: $($res.err -join ' | ')"; continue }
    if ($Rmap.ContainsKey($n) -and $Rmap[$n] -eq $res.linha) { continue }
    $novas.Add($res.linha); if ($res.av.Count) { $avisos += "$($lista[$n]) $n :: $($res.av -join ' | ')" }
  }
  if ($novas.Count) { [IO.File]::AppendAllLines($Andamento, $novas, $utf8) }
  $jaR = @($Rmap.Keys | Where-Object { $lista.Contains($_) }).Count
  "R gravadas agora: $($novas.Count) | total R (aprox.): $($jaR + $novas.Count) de $($lista.Count) | N: $($Nmap.Count)"
  if ($falhas) { '--- FALHAS (não gravadas):'; $falhas }
  if ($avisos) { '--- avisos (gravadas, conferir):'; $avisos }
  return
}

# -Build
$falta = @($lista.Keys | Where-Object { -not $Rmap.ContainsKey($_) -and -not $Nmap.ContainsKey($_) })
if ($falta.Count) { "RECUSADO: $($falta.Count) processos sem R nem N: $($falta -join ', ')"; return }
$div = @(); foreach ($n in $Rmap.Keys) { if (-not $lista.Contains($n)) { continue }; $res = Valida $n; if (-not $res.pronto -or $res.err.Count -or $res.linha -ne $Rmap[$n]) { $div += "$n :: $($res.err -join ' | ')$(if ($res.pronto -and $res.linha -ne $Rmap[$n]) { ' | R difere do relatório atual' })" } }
if ($div.Count) { 'RECUSADO — divergências:'; $div; return }
$csv = New-Object System.Collections.Generic.List[string]
$csv.Add('Fase de origem;Processo;Arquivo .zip;Perícia médica;Perícia social;CADASTRO;PREVENÇÃO;INCOMPETÊNCIA;EMENDAR;Designar perícia;Assessoria;CITAR;Assunto')
foreach ($n in $lista.Keys) {
  if ($Rmap.ContainsKey($n)) { $c = $Rmap[$n].Split('|'); $csv.Add((($c[1..13]) | ForEach-Object { $_ -replace ';', ',' }) -join ';') }
  else { $t = $tela[$n] -join "`n"; $tarefa = ([regex]::Match($t, '\|tarefa ([^|]*)\|')).Groups[1].Value.Trim(); $as = if ($assCsv.ContainsKey($n)) { $assCsv[$n] } else { '' }; $csv.Add("$tarefa;$n;;;;;;;;;;;$as") }
}
$csvPath = Join-Path $sub "Analise_inicial_$DataAnalise.csv"
if (Test-Path -LiteralPath $csvPath) { $k = 2; while (Test-Path -LiteralPath ($csvPath -replace '\.csv$', "_$k.csv")) { $k++ }; $csvPath = $csvPath -replace '\.csv$', "_$k.csv" }
[IO.File]::WriteAllLines($csvPath, $csv, [Text.UTF8Encoding]::new($true))
"CSV: $csvPath ($($csv.Count - 1) linhas)"
foreach ($s in $serv) {
  $arqs = @($lista.Keys | Where-Object { $lista[$_] -ge $s[1] -and $lista[$_] -le $s[2] -and $Rmap.ContainsKey($_) } | ForEach-Object { Join-Path $Mdr "$_.md" })
  $zip = Join-Path $sub "Analise_inicial_$($s[0] -replace ' ','_')_$DataAnalise.zip"
  if (Test-Path -LiteralPath $zip) { $k = 2; while (Test-Path -LiteralPath ($zip -replace '\.zip$', "_$k.zip")) { $k++ }; $zip = $zip -replace '\.zip$', "_$k.zip" }
  Compress-Archive -LiteralPath $arqs -DestinationPath $zip
  "ZIP: $zip ($($arqs.Count) relatórios)"
}
