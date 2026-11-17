# gera-relatorio.ps1 — jef-controle-prazo (desenvolvido na 7ª Vara Federal da Paraíba; versão para compartilhamento)
#
# Monta a planilha .xlsx (Arial, quatro abas) a partir do arquivo de andamento
# gravado durante a execução em lote. Não depende da memória da conversa.
#
#   .\gera-relatorio.ps1 -Andamento "<...>_andamento.txt" -Saida "<...>.xlsx" -TarefaComManifestacao "<...>" -EtiquetaIndefinido "<...>"
#   .\gera-relatorio.ps1 -Andamento "<...>_andamento.txt" -SoResumo -TarefaComManifestacao "<...>" -EtiquetaIndefinido "<...>"   (só conta, não gera planilha)
#
# -TarefaComManifestacao e -EtiquetaIndefinido vêm de docs/configuracao-unidade.md, seção jef-controle-prazo
# (tarefa_com_manifestacao e etiqueta_indefinido), copiados sem alteração.
#
# Linhas do andamento (as mesmas que analise-lote.js devolve, mais L):
#   L|<processo>                         processo da rodada (para saber o que falta)
#   <cód>|<processo>|<ato>|<data do ato>|<destinatários>|<intimações com falha>|<suprimento>|<sem intimação válida>|<data-limite>|<destino>|<observação>|<sigiloso>
# Códigos: M movimentar · N nova intimação · F sem falha · C prazo em curso · V revisar · I indefinido · X não analisado
# Para o mesmo processo, vale a última linha (correções e retomadas).
param(
    [Parameter(Mandatory = $true)][string]$Andamento,
    [string]$Saida,
    [switch]$SoResumo,
    [string]$TarefaComManifestacao,
    [string]$EtiquetaIndefinido
)

if (-not $TarefaComManifestacao -or -not $EtiquetaIndefinido) {
    throw 'Configure antes de gerar: informe -TarefaComManifestacao e -EtiquetaIndefinido com os valores de docs/configuracao-unidade.md (seção jef-controle-prazo).'
}

$lote = [System.Collections.Generic.List[string]]::new()
$linhas = [ordered]@{}
foreach ($l in Get-Content -LiteralPath $Andamento -Encoding utf8) {
    if (-not $l.Trim()) { continue }
    $c = $l -split '\|'
    switch -Regex ($c[0]) {
        '^L$' { if (-not $lote.Contains($c[1])) { $lote.Add($c[1]) }; continue }
        '^[MNFCVIX]$' {
            if ($linhas.Contains($c[1])) { $linhas.Remove($c[1]) }
            while ($c.Count -lt 12) { $c += '' }
            $linhas[$c[1]] = $c
        }
    }
}

$porCodigo = @{}
foreach ($c in $linhas.Values) { $porCodigo[$c[0]] = 1 + [int]$porCodigo[$c[0]] }
$n = { param($k) [int]$porCodigo[$k] }
$faltam = @($lote | Where-Object { -not $linhas.Contains($_) })
$com = @($linhas.Values | Where-Object { $_[0] -eq 'M' -and $_[9] -eq $TarefaComManifestacao }).Count

"Processos na rodada: $($lote.Count) | com resultado: $($linhas.Count) | faltam: $($faltam.Count)"
"Situação 1 - movimentar (M): $(& $n 'M') (com manifestação: $com | sem manifestação: $((& $n 'M') - $com))"
"Situação 2 - nova intimação (N): $(& $n 'N')"
"Sem falha (F): $(& $n 'F') | prazo em curso (C): $(& $n 'C')"
"Indefinidos (I): $(& $n 'I') | a revisar (V): $(& $n 'V')"
"Não analisados (X): $(& $n 'X')"
if ($faltam.Count) { "FALTAM: " + ($faltam -join ', ') }
if ($SoResumo) { return }

$mov = @(); $nova = @(); $indef = @(); $naoAn = @()
foreach ($c in $linhas.Values) {
    $proc, $ato, $dAto, $dest, $falhas, $supr, $semVal, $lim, $destino, $obs, $sig = $c[1..11]
    $atoTxt = if ($ato) { "$ato ($dAto)" } else { '' }
    switch ($c[0]) {
        'M' { $mov += , @($proc, $atoTxt, $dest, $falhas, $supr, $lim, $destino, $obs, $sig) }
        'N' { $nova += , @($proc, $atoTxt, $dest, $semVal, $(if ($falhas) { $falhas } else { 'não expedida' }), $obs, $sig) }
        { $_ -in 'I', 'V' } { $indef += , @($proc, $(if ($c[0] -eq 'V') { "não revisado: $obs" } else { $obs }), $EtiquetaIndefinido, $sig) }
        'X' { $naoAn += , @($proc, $obs) }
    }
}
foreach ($p in $faltam) { $naoAn += , @($p, 'não chegou a ser analisado (execução interrompida)') }

$abas = @(
    @{ Nome = 'Movimentar'; Cab = @('Processo', 'Ato (ID e data)', 'Destinatários', 'Intimação com falha', 'Intimação válida que supriu', 'Data-limite', 'Tarefa de destino', 'Observação', 'Sigiloso'); Larg = @(28, 24, 16, 40, 34, 14, 36, 70, 10); Linhas = $mov },
    @{ Nome = 'Nova intimação'; Cab = @('Processo', 'Ato (ID e data)', 'Destinatários devidos', 'Parte(s) sem intimação válida', 'Intimação com falha', 'Observação', 'Sigiloso'); Larg = @(28, 24, 18, 22, 40, 70, 10); Linhas = $nova },
    @{ Nome = 'Indefinidos'; Cab = @('Processo', 'Motivo', 'Etiqueta', 'Sigiloso'); Larg = @(28, 80, 22, 10); Linhas = $indef },
    @{ Nome = 'Não analisados'; Cab = @('Processo', 'Motivo'); Larg = @(28, 80); Linhas = $naoAn }
)

$xl = New-Object -ComObject Excel.Application
$xl.Visible = $false
$xl.DisplayAlerts = $false
$xl.ScreenUpdating = $false
try {
    $wb = $xl.Workbooks.Add()
    while ($wb.Worksheets.Count -lt $abas.Count) { [void]$wb.Worksheets.Add([Type]::Missing, $wb.Worksheets.Item($wb.Worksheets.Count)) }
    for ($i = 0; $i -lt $abas.Count; $i++) {
        $a = $abas[$i]
        $ws = $wb.Worksheets.Item($i + 1)
        $ws.Name = $a.Nome
        $ws.Cells.Font.Name = 'Arial'
        $ws.Cells.Font.Size = 10
        for ($k = 0; $k -lt $a.Cab.Count; $k++) {
            $ws.Columns.Item($k + 1).NumberFormat = '@'
            $ws.Columns.Item($k + 1).ColumnWidth = $a.Larg[$k]
            $cel = $ws.Cells.Item(1, $k + 1)
            $cel.Value2 = $a.Cab[$k]
            $cel.Font.Bold = $true
            $cel.Interior.Color = 0xF2E1D9
            $cel.WrapText = $true
        }
        # Célula a célula: no PowerShell 7 o Excel não aceita gravar uma matriz de uma vez (converte tudo em texto).
        if ($a.Linhas.Count) {
            for ($r = 0; $r -lt $a.Linhas.Count; $r++) { for ($k = 0; $k -lt $a.Cab.Count; $k++) { $ws.Cells.Item($r + 2, $k + 1).Value2 = [string]$a.Linhas[$r][$k] } }
            $rg = $ws.Range($ws.Cells.Item(2, 1), $ws.Cells.Item($a.Linhas.Count + 1, $a.Cab.Count))
            $rg.WrapText = $true
            $rg.VerticalAlignment = -4160
        }
    }
    $wb.Worksheets.Item(1).Activate()
    $wb.SaveAs($Saida, 51)
    $wb.Close($false)
    "Planilha: $Saida"
}
finally {
    $xl.Quit()
    [void][Runtime.InteropServices.Marshal]::ReleaseComObject($xl)
}
