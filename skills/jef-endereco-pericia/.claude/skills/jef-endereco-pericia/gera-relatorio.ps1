# gera-relatorio.ps1 — jef-endereco-pericia (desenvolvido na 7ª Vara Federal da Paraíba; versão para compartilhamento)
#
# Não tem dado da unidade embutido: os nomes dos peritos vêm das linhas M do próprio andamento,
# gravadas a partir da seção "Comum — Peritos médicos" de docs/configuracao-unidade.md.
#
# Monta a planilha .xlsx (Arial, quatro abas) a partir do arquivo de andamento
# gravado durante a execução em lote. Não depende da memória da conversa.
#
#   .\gera-relatorio.ps1 -Andamento "<...>_andamento.txt" -Saida "<...>.xlsx"
#   .\gera-relatorio.ps1 -Andamento "<...>_andamento.txt" -SoResumo   (só conta, não gera planilha)
#
# Linhas do andamento (as mesmas que analise-lote.js devolve, mais M e L):
#   M|<índice>|<nome do perito>          lista de peritos médicos da execução
#   L|<processo>                         processo do lote (para saber o que falta)
#   E|<chave>|<endereço>                 dicionário de endereços
#   <cód>|<processo>|<id nomeação>|<índice perito>|<data>|<documentos>|<chave(s) endereço>|<observação>|<sigiloso>
# Para a mesma chave processo + id da nomeação, vale a última linha (correções e retomadas).
param(
    [Parameter(Mandatory = $true)][string]$Andamento,
    [string]$Saida,
    [switch]$SoResumo
)

$peritos = @{}
$ends = @{}
$lote = [System.Collections.Generic.List[string]]::new()
$linhas = [ordered]@{}
foreach ($l in Get-Content -LiteralPath $Andamento -Encoding utf8) {
    if (-not $l.Trim()) { continue }
    $c = $l -split '\|'
    switch -Regex ($c[0]) {
        '^M$' { $peritos[$c[1]] = $c[2]; continue }
        '^E$' { $ends[$c[1]] = ($c[2..($c.Count - 1)] -join '|'); continue }
        '^L$' { if (-not $lote.Contains($c[1])) { $lote.Add($c[1]) }; continue }
        '^[OSBDRNVXI]$' {
            $chave = $c[1] + '|' + $c[2]
            if ($linhas.Contains($chave)) { $linhas.Remove($chave) }
            $linhas[$chave] = $c
        }
    }
}

$feitos = @($linhas.Values | ForEach-Object { $_[1] } | Sort-Object -Unique)
$porCodigo = @{}
foreach ($c in $linhas.Values) {
    if (-not $porCodigo[$c[0]]) { $porCodigo[$c[0]] = [System.Collections.Generic.HashSet[string]]::new() }
    [void]$porCodigo[$c[0]].Add($c[1])
}
$n = { param($k) if ($porCodigo[$k]) { $porCodigo[$k].Count } else { 0 } }
$faltam = @($lote | Where-Object { $feitos -notcontains $_ })

"Processos no lote: $($lote.Count) | com resultado: $($feitos.Count) | faltam: $($faltam.Count)"
"Certidão em ordem (O): $(& $n 'O')"
"Sem certidão de endereço (S): $(& $n 'S')"
"Certidão com endereço em branco (B): $(& $n 'B')"
"Certidão com perito divergente (D): $(& $n 'D')"
"Perícia já realizada (R): $(& $n 'R')"
"Sem nomeação de perito médico ou com a última nomeação de perícia social (N): $(& $n 'N')"
"Indefinidos (I): $(& $n 'I') | a revisar (V): $(& $n 'V')"
"Não analisados (X): $(& $n 'X')"
if ($faltam.Count) { "FALTAM: " + ($faltam -join ', ') }
if ($SoResumo) { return }

$nomePerito = { param($i) if ($i -ne '' -and $peritos.ContainsKey($i)) { $peritos[$i] } else { '' } }
$situacao = @{ S = 'Sem certidão de endereço'; B = 'Certidão com endereço em branco'; D = 'Certidão com perito divergente' }
$semEnd = @(); $emOrdem = @(); $indef = @(); $naoAn = @()
foreach ($c in $linhas.Values) {
    $proc, $nom, $pi, $data, $docs, $ek, $obs, $sig = $c[1], $c[2], $c[3], $c[4], $c[5], $c[6], $c[7], $c[8]
    switch ($c[0]) {
        { $_ -in 'S', 'B', 'D' } {
            $o = @("certidão de nomeação $nom", $obs) | Where-Object { $_ }
            $semEnd += , @($proc, (& $nomePerito $pi), $data, $situacao[$c[0]], ($o -join '; '), $sig)
        }
        'O' {
            $e = ($ek -split ',' | Where-Object { $_ -ne '' } | ForEach-Object { $ends[$_] }) -join ' | '
            $emOrdem += , @($proc, (& $nomePerito $pi), $data, $e, $docs)
        }
        { $_ -in 'I', 'V' } { $indef += , @($proc, $(if ($c[0] -eq 'V') { "não revisado: $obs" } else { $obs }), $sig) }
        'X' { $naoAn += , @($proc, $obs) }
    }
}
foreach ($p in $faltam) { $naoAn += , @($p, 'não chegou a ser analisado (execução interrompida)') }

$abas = @(
    @{ Nome = 'Sem endereço de perícia'; Cab = @('Processo', 'Perito nomeado', 'Data da certidão de nomeação', 'Situação', 'Observação', 'Sigiloso'); Larg = @(28, 40, 28, 34, 60, 10); Linhas = $semEnd },
    @{ Nome = 'Certidão em ordem'; Cab = @('Processo', 'Perito nomeado', 'Data da certidão de nomeação', 'Endereço da perícia', 'Documento'); Larg = @(28, 40, 28, 70, 24); Linhas = $emOrdem },
    @{ Nome = 'Indefinidos'; Cab = @('Processo', 'Motivo', 'Sigiloso'); Larg = @(28, 80, 10); Linhas = $indef },
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
