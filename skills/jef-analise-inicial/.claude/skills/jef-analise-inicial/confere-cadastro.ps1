# confere-cadastro.ps1 — jef-analise-inicial: veredito DETERMINÍSTICO do cadastro das partes (desenvolvido na 7ª Vara Federal da Paraíba)
#
# Por que existe: o veredito do cadastro não pode depender do juízo de cada agente. Cadastro regular classificado
# como irregular provoca o cancelamento indevido da distribuição. O veredito sai deste script, a partir das linhas
# PP: e OI: lidas na tela (T| do arquivo de andamento, ou o arquivo de tela do processo); o relatório e a coluna
# CADASTRO do CSV têm de seguir o veredito — o montador do CSV recusa divergência.
#
# Cadastro correto:
#   Polo passivo ........ INSS, CNPJ 29.979.036/0001-40, com a Procuradoria Geral Federal (PGF/AGU) vinculada;
#   Outros interessados . o órgão de cumprimento configurado (cadastroOI.nome, CNPJ cadastroOI.cnpj), como ÓRGÃO DE
#                         CUMPRIMENTO, com a procuradoria configurada (cadastroOI.procuradoria). O MPF como FISCAL DA LEI
#                         em outros interessados é aceito (parte menor/incapaz).
#   A configuração vem do JSON gerado de docs/configuracao-unidade.md (SKILL.md, "Como a configuração chega aos
#   scripts"), indicado por -Config. Sem ela, o script recusa.
#
# O que NÃO é irregularidade: a grafia do NOME do INSS na tela ("INSS - INSTITUTO NACIONAL DE SEGURO SOCIAL" etc.)
# quando o CNPJ e a PGF vinculada estão corretos — é o mesmo ente; só é anotado como informação.
#
# Veredito (uma das três saídas):
#   REGULAR      — tudo confere. Nada a prescrever.
#   IRREGULAR    — defeito objetivo e inequívoco (ente ausente, CNPJ diferente, PGF não vinculada, CEAB-DJ ausente,
#                  sem a procuradoria da CEAB-DJ, qualidade diferente de órgão de cumprimento, CEAB-DJ no polo passivo,
#                  outros interessados vazio). Só neste caso se prescreve CANCELAR DISTRIBUIÇÃO.
#   VERIFICAR    — qualquer outra diferença que o script não saiba qualificar (ex.: ente estranho em outros
#                  interessados, MPF com outra qualidade). NUNCA vira CANCELAR DISTRIBUIÇÃO sem conferência humana:
#                  o relatório registra o texto exato da tela e a coluna CADASTRO do CSV recebe VERIFICAR.
#   NÃO VERIFICADO — linha PP ausente.
#
# Uso:
#   . .\confere-cadastro.ps1 -Config <config.json>   (carrega a função Get-VeredictoCadastro -PP '<texto>' -OI '<texto>')
#   pwsh -File confere-cadastro.ps1 -Config <config.json> -Tela <arquivo de tela do processo> | -Andamento <andamento.txt> [-Processo <n>]
param([string]$Tela, [string]$Andamento, [string]$Processo, [string]$Config)

# Configuração da unidade: órgão de cumprimento esperado em Outros interessados (padrão vazio).
$CadOI = $null
$CadFalta = @('cadastroOI.nome', 'cadastroOI.cnpj', 'cadastroOI.procuradoria')
if ($Config -and (Test-Path -LiteralPath $Config)) {
  $cj = (Get-Content -LiteralPath $Config -Raw -Encoding utf8 | ConvertFrom-Json).cadastroOI
  if ($cj) {
    $CadOI = $cj
    $CadFalta = @(foreach ($k in 'nome', 'cnpj', 'procuradoria') { $v = [string]$cj.$k; if (-not $v.Trim() -or $v.Trim() -eq 'PENDENTE') { "cadastroOI.$k" } })
  }
}
$CadMsg = 'configure a unidade antes de iniciar: passe -Config com o JSON gerado de docs/configuracao-unidade.md (SKILL.md, "Como a configuração chega aos scripts")'

function Get-VeredictoCadastro {
  param([string]$PP, [string]$OI)
  if ($CadFalta.Count) { throw "$CadMsg — falta $($CadFalta -join ', ')" }
  $oiNome = [string]$CadOI.nome; $oiCnpj = [string]$CadOI.cnpj; $oiProc = [string]$CadOI.procuradoria
  $pp = ($PP -replace '^\s*(PP:|Polo passivo)\s*', '').Trim()
  $oi = ($OI -replace '^\s*(OI:|Outros Interessados)\s*', '').Trim()
  if (-not $pp) { return [pscustomobject]@{ Veredito = 'NÃO VERIFICADO'; Motivos = @('polo passivo não lido na tela'); Info = @() } }
  $irreg = @(); $verif = @(); $info = @()

  # --- Polo passivo ---
  $cnpjInss = '29\.979\.036/0001-40'
  if ($pp -notmatch "CNPJ:\s*$cnpjInss") {
    $irreg += 'polo passivo sem o INSS com CNPJ 29.979.036/0001-40'
  } else {
    $m = [regex]::Match($pp, "CNPJ:\s*$cnpjInss(.*)$")
    $depois = $m.Groups[1].Value
    $prox = [regex]::Match($depois, 'CNPJ:')
    if ($prox.Success) { $depois = $depois.Substring(0, $prox.Index) }
    if ($depois -notmatch 'Procuradoria Geral Federal \(PGF/AGU\)') { $irreg += 'polo passivo: INSS sem a PGF/AGU vinculada' }
    $nomeInss = ($pp -split 'CNPJ:')[0]
    if ($nomeInss -notmatch '^\s*INSTITUTO NACIONAL DO SEGURO SOCIAL - INSS\s*-?\s*$' -and $pp -match "^(.*?)\s*-?\s*CNPJ:\s*$cnpjInss") {
      $info += 'nome do INSS na tela fora do padrão ("' + $Matches[1].Trim() + '"); CNPJ confere — não é irregularidade'
    }
  }
  if ($pp -match 'CNPJ:\s*(?!29\.979\.036/0001-40)[\d./-]+') { $irreg += 'polo passivo com outro ente além do INSS (CNPJ diferente)' }
  if ($pp -match 'CEAB') { $irreg += 'CEAB-DJ no polo passivo' }
  # Ente a mais no polo passivo (mesmo sem CNPJ, ex.: "AGÊNCIA DA PREVIDÊNCIA SOCIAL - APS ... (REU)"): tira do texto a
  # entrada do INSS (nome + CNPJ + (REU) + PGF/AGU + (REPRESENTANTE)) e vê se sobrou algo.
  $mi = [regex]::Match($pp, "^(.*?)CNPJ:\s*$cnpjInss\s*\(REU\)(\s*Procuradoria Geral Federal \(PGF/AGU\))?(\s*\(REPRESENTANTE\))?(.*)$")
  if ($mi.Success) {
    $antes = $mi.Groups[1].Value; $sobra = $mi.Groups[4].Value.Trim()
    $ult = $antes.LastIndexOf(')')
    if ($ult -ge 0) { $sobra = ($antes.Substring(0, $ult + 1).Trim() + ' ' + $sobra).Trim() }
    if ($sobra -and (($irreg -join ' ') -notmatch 'outro ente|CEAB')) {
      # Só a PGF/AGU repetida (como "representante") não é defeito objetivo: vai para conferência humana, nunca para cancelamento.
      $resto = ($sobra -replace 'Procuradoria Geral Federal \(PGF/AGU\)', '' -replace '\(REPRESENTANTE\)', '').Trim()
      if ($resto) { $irreg += 'polo passivo com ente a mais além do INSS: "' + $sobra + '"' }
      else { $verif += 'polo passivo: a PGF/AGU aparece repetida também como representante ("' + $sobra + '")' }
    }
  }

  # --- Outros interessados ---
  $oi1 = $oi
  if (-not $oi1 -or $oi1 -match '^\(?nenhum\)?$' -or $oi1 -match '^\[?ausente\]?$') {
    $irreg += "outros interessados vazio: faltam a $oiNome e a $oiProc"
  } else {
    $mpfFiscal = 'MINIST[ÉE]RIO P[ÚU]BLICO FEDERAL - MPF - CNPJ: [\d./-]+ \(FISCAL DA LEI\)( Procuradoria da Rep[úu]blica \(MPF\))?'
    if ($oi1 -match $mpfFiscal) { $info += 'MPF como fiscal da lei em outros interessados (aceito)'; $oi1 = ([regex]::Replace($oi1, $mpfFiscal, '', 'IgnoreCase')).Trim() }
    $idOI = [regex]::Escape("$oiNome - CNPJ: $oiCnpj")
    $ceabOk = $idOI + [regex]::Escape(' (ÓRGÃO DE CUMPRIMENTO) ' + $oiProc)
    if ($oi1 -match $ceabOk) {
      $oi1 = ([regex]::Replace($oi1, $ceabOk, '')).Trim()
      if ($oi1) { $verif += "outros interessados com ente a mais além da ${oiNome}: `"$oi1`"" }
    } else {
      if ($oi1 -notmatch $idOI) { $irreg += "outros interessados sem a $oiNome com CNPJ $oiCnpj" }
      else {
        if ($oi1 -notmatch '\(ÓRGÃO DE CUMPRIMENTO\)') { $irreg += "$oiNome sem a qualidade de órgão de cumprimento" }
        if ($oi1 -notmatch [regex]::Escape($oiProc)) { $irreg += "$oiNome sem a $oiProc vinculada" }
        if (-not $irreg -and -not $verif) { $verif += 'outros interessados com texto diferente do padrão: "' + $oi1 + '"' }
      }
    }
  }

  if ($irreg.Count) { $v = 'IRREGULAR'; $mot = $irreg + $verif }
  elseif ($verif.Count) { $v = 'VERIFICAR'; $mot = $verif }
  else { $v = 'REGULAR'; $mot = @() }
  [pscustomobject]@{ Veredito = $v; Motivos = $mot; Info = $info }
}

function Get-VeredictoDeTela {
  param([string]$Texto)
  $pp = ([regex]::Match($Texto, '(?m)^PP: ?(.*)$')).Groups[1].Value
  $oi = ([regex]::Match($Texto, '(?m)^OI: ?(.*)$')).Groups[1].Value
  Get-VeredictoCadastro -PP $pp -OI $oi
}

if (($Tela -or $Andamento) -and $CadFalta.Count) { "RECUSADO: $CadMsg — falta $($CadFalta -join ', ')"; return }
if ($Tela) {
  $r =Get-VeredictoDeTela -Texto ([IO.File]::ReadAllText($Tela, [Text.Encoding]::UTF8))
  "$($r.Veredito) | $($r.Motivos -join '; ') | $($r.Info -join '; ')"
} elseif ($Andamento) {
  $porProc = @{}
  foreach ($l in Get-Content -LiteralPath $Andamento -Encoding utf8) {
    if ($l -match '^T\|([\d.\-]+)\|(.*)$') { if (-not $porProc.ContainsKey($Matches[1])) { $porProc[$Matches[1]] = @() }; $porProc[$Matches[1]] += $Matches[2] }
  }
  foreach ($n in ($porProc.Keys | Sort-Object)) {
    if ($Processo -and $n -ne $Processo) { continue }
    $r = Get-VeredictoDeTela -Texto ($porProc[$n] -join "`n")
    "$n | $($r.Veredito) | $($r.Motivos -join '; ') | $($r.Info -join '; ')"
  }
}
