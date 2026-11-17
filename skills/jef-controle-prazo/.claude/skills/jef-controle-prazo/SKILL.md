---
name: "jef-controle-prazo"
description: "Para processos da tarefa de controle de prazo em curso do PJe (o nome da tarefa é configurado pela unidade), verifica na aba Expedientes se a última intimação falhou (intimação sem ciência e sem data-limite, em geral por erro de publicação no Diário Eletrônico) e separa em relatório .xlsx os processos que só precisam ser movimentados para a tarefa de expediente com ou sem manifestação (falha suprida por outra intimação válida) dos que precisam de nova intimação (parte sem nenhuma intimação válida) — sem gravar nada no PJe. Para o PJe 1º grau do TRF5. Desenvolvida na 7ª Vara Federal da Paraíba."
---

# Controle de prazo — intimações com falha que prendem o processo

Desenvolvida na 7ª Vara Federal da Paraíba. As regras de classificação refletem as decisões dessa Vara e devem ser revistas pela unidade antes do uso com processos reais.

Use quando o usuário fornecer a lista de processos da tarefa de controle de prazo em curso (a configurada em `jef-controle-prazo.tarefa_controle_prazo`) e pedir a verificação dos que estão parados por falha de intimação.

**Contexto.** O processo sai da tarefa de controle de prazo em curso (`jef-controle-prazo.tarefa_controle_prazo`) e vai para a tarefa de expediente **com manifestação** (`jef-controle-prazo.tarefa_com_manifestacao`) ou **sem manifestação** (`jef-controle-prazo.tarefa_sem_manifestacao`) quando o prazo das partes intimadas decorre ou quando elas se manifestam. Por erro do PJe — em geral, falha na publicação no Diário Eletrônico —, uma intimação fica sem ciência e sem data-limite, continua aberta, e o processo não é movimentado, embora o prazo já tenha decorrido. Esta skill localiza esses processos e distingue as duas situações, que pedem providências diferentes da secretaria.

## Limite de atuação — leia antes de tudo

Esta skill **só lê**. Nesta rotina **não se clica em MARCAR TODOS COMO LIDOS** — por decisão do usuário, os documentos não lidos permanecem como estão.

Nunca, em hipótese alguma:
- movimentar o processo, transferir tarefa, encerrar expediente ou expedir intimação (a movimentação e a nova intimação são providências manuais da secretaria, a partir do relatório);
- inserir ou retirar etiqueta; protocolar, juntar documento, cancelar distribuição ou qualquer comunicação;
- preencher minuta, selecionar tipo de documento ou clicar em ASSINAR DOCUMENTO(S);
- digitar senha, certificado, token ou PIN. Aparecendo tela de login, pare e peça ao usuário que se autentique.

Todo o resto desta skill deve ser mantido intacto de uma versão para a outra: nenhuma alteração além da que o usuário pediu expressamente deve ser feita sem consulta prévia.

## Configuração da unidade — antes de tudo

Os dados próprios da unidade (nomes de tarefas do PJe e de etiqueta) não estão nesta skill: ficam em `docs/configuracao-unidade.md`, na pasta do projeto.

- Leia `docs/configuracao-unidade.md` no início de toda execução, antes da pergunta da data de corte.
- Se o arquivo não existir, crie-o com o título `# Configuração da unidade`.
- Se faltar a seção abaixo, ou algum item dela estiver `PENDENTE`, **pare antes de abrir qualquer processo** e faça ao usuário as perguntas que faltam, todas de uma vez, explicando o que é cada item. Grave as respostas no arquivo (uma linha `- <chave>: <valor>` por item; o que ficar sem resposta, com o valor `PENDENTE`), mostre o resumo e peça o "pode seguir".
- Seção já preenchida (inclusive seção comum preenchida por outra skill): reaproveite, sem perguntar de novo.
- Nunca use valor que não esteja no arquivo; nunca presuma nem use os valores da 7ª Vara Federal da Paraíba. Se, no meio da execução, faltar um dado, pare e pergunte.
- O arquivo pode ser editado à mão pela unidade; vale sempre o que estiver nele no início da execução.

### Perguntas da configuração

Seção `## jef-controle-prazo` (só esta skill a usa):

| Chave | Pergunta | Exemplo de formato (fictício) |
|---|---|---|
| `tarefa_controle_prazo` | Qual é o nome exato, no PJe, da tarefa em que o processo aguarda o decurso do prazo das intimações (a tarefa cuja lista será analisada)? | `[JEF] Prazo - Aguardando` |
| `tarefa_com_manifestacao` | Para qual tarefa o processo vai quando o prazo decorre e alguma parte se manifestou? Nome exato no PJe. | `[JEF] Expediente - Partes manifestaram` |
| `tarefa_sem_manifestacao` | Para qual tarefa o processo vai quando o prazo decorre sem manifestação das partes? Nome exato no PJe. | `[JEF] Expediente - Prazo decorrido` |
| `etiqueta_indefinido` | Qual etiqueta do PJe a secretaria usa para os casos que a direção deve analisar (vai na aba Indefinidos)? | `Z_ANALISE_DIRECAO` |

Exemplo da seção gravada:

```
## jef-controle-prazo
- tarefa_controle_prazo: [JEF] Prazo - Aguardando
- tarefa_com_manifestacao: [JEF] Expediente - Partes manifestaram
- tarefa_sem_manifestacao: [JEF] Expediente - Prazo decorrido
- etiqueta_indefinido: Z_ANALISE_DIRECAO
```

### Como a configuração chega aos scripts

- **`analise-lote.js`**: depois de injetar o script e antes do `inicia`, chame `window.__CP.config({ destinoCom: '<tarefa_com_manifestacao>', destinoSem: '<tarefa_sem_manifestacao>' })`, com os valores copiados do arquivo, sem alteração. Sem essa chamada, o `inicia` não roda e devolve "configure ... antes de iniciar". Injetado de novo (login, aba recarregada), o script perde a configuração: chame o `config` outra vez.
- **`gera-relatorio.ps1`**: passe `-TarefaComManifestacao '<tarefa_com_manifestacao>' -EtiquetaIndefinido '<etiqueta_indefinido>'` em toda chamada, inclusive com `-SoResumo`.

## Acesso ao PJe — usar o Chrome (extensão)

O acesso ao PJe é sempre pelo **Chrome (extensão)** — o navegador real do usuário, onde ele já está autenticado —, nunca pelo navegador embutido do Claude Code.

**Quantidade da tarefa.** Quando for preciso saber quantos processos a tarefa tem, consulte a coluna **Tarefas** do painel do usuário, nunca **Minhas tarefas** — esta dá um número que não retrata a realidade.

## Entrada — sempre por arquivo CSV, em rodadas de 300 linhas

Por decisão do usuário, esta rotina segue a mesma forma de entrada e execução da `jef-endereco-pericia`.

A lista de processos **sempre** chega por arquivo CSV, fornecido junto com o pedido de execução. Sem CSV, peça o arquivo antes de prosseguir. Leia o CSV com separador `;` e encoding `utf-8-sig`. Use o campo `numeroProcesso` para os números e o campo `dataChegada` para o filtro de data (abaixo).

**Pergunta obrigatória — a partir de que data analisar.** Em toda execução, logo depois de ler a configuração da unidade e antes de qualquer outra coisa, pergunte ao usuário a partir de que data (`dataChegada`) os processos devem ser analisados. Não presuma a data nem reaproveite a de uma execução anterior. Mantenha só as linhas com `dataChegada` igual ou posterior a ela (a data informada entra). Formato ambíguo ou ilegível: pare e pergunte. Linhas sem `dataChegada`: informe quantas são e pergunte se entram.

**Rodadas de 300 linhas.** A análise é feita em rodadas de 300 linhas do CSV filtrado, na ordem do arquivo. Cada rodada tem o seu arquivo de andamento e a sua planilha. Ao fim de cada rodada, gere a planilha, relate o resultado e só comece a rodada seguinte quando o usuário pedir.

## Confirmação antes de iniciar — parada obrigatória

Antes de abrir qualquer processo, confirme com o usuário:
- a data de corte aplicada, quantas linhas o CSV tinha no total e quantas ficaram;
- quais linhas formam a rodada (ex.: linhas 1 a 300) e a lista dos números;
- que a análise é só de leitura e que **não** será clicado MARCAR TODOS COMO LIDOS;
- estimativa de esforço: pelo script de lote, um processo por vez, cerca de 7 segundos por processo com prazo em curso e até 50 segundos nos demais (no teste de 30 processos, 3 minutos e meio no total) — mais as paradas para login, se a sessão do PJe expirar.

Só comece com o "pode seguir" do usuário.

## Progresso durante a execução — informe obrigatório a cada 20 processos

Ao completar o 20º processo analisado, registre uma mensagem de progresso parcial: quantos já foram analisados do total confirmado e quantos, até aquele ponto, caíram em cada resultado (Situação 1 — movimentar; Situação 2 — nova intimação; sem falha; prazo em curso; indefinido; não analisado).

Essa mensagem precisa ficar registrada no histórico da conversa. Se a sessão dispuser de uma ferramenta própria para enviar mensagem ao usuário, use-a; não havendo, poste o informe como texto normal da resposta em andamento.

**Nunca encerre o turno nem espere confirmação do usuário para prosseguir** — poste o informe e continue imediatamente para o próximo processo. Repita a cada novo múltiplo de 20 até terminar.

## Execução em lote — script `analise-lote.js` e arquivo de andamento

A análise roda pelo script `analise-lote.js`, que fica nesta pasta da skill. Ele faz exatamente os passos desta skill e só lê: nunca clica em MARCAR TODOS COMO LIDOS nem em nada que grave. Se uma regra desta skill mudar, ajuste o script junto.

1. No Chrome, abra a página estática `https://pje1g.trf5.jus.br/pje/js/pdfjs/web/locale/locale.json` e injete nela, com o javascript_tool, o conteúdo integral de `analise-lote.js` — leia o arquivo antes; não reescreva de memória. Cada processo abre num iframe oculto (consulta → autos).
2. Passe a configuração com `window.__CP.config({...})` (seção "Configuração da unidade") e inicie com `window.__CP.inicia(lista, {paralelo: 1})`. Um processo por vez: mais que isso faz o PJe bloquear o acesso por 10 minutos (HTTP 429). Se o script parar com `429`, espere os 10 minutos antes de retomar.
3. Acompanhe com `await window.__CP.le(desde)`. Ele espera no máximo 10 segundos — o javascript_tool corta a chamada em 45 segundos.

**Arquivo de andamento — gravar à medida que sai, nunca só no final.** Antes de iniciar, crie `Relatórios/Controle_Prazo_AAAA-MM-DD_lote<última linha da rodada>_andamento.txt` com uma linha `L|<processo>` por processo da rodada. A cada leitura do progresso, grave no arquivo, sem alterar, todas as linhas devolvidas por `le()` (menos a linha `P|`) e use o `ate:` dela como o próximo `desde`.

A planilha sai desse arquivo, pelo `gera-relatorio.ps1` desta pasta: `-Andamento <arquivo> -Saida <xlsx> -TarefaComManifestacao <...> -EtiquetaIndefinido <...>` (valores da configuração). Com `-SoResumo`, só mostra as contagens por resultado e os processos que faltam — use-o para o informe a cada 20 processos e para o relato final.

**Linhas `V` (revisar).** O script marca `V` quando não pode decidir sozinho: certidão de intimação do ato não localizada, só uma parte intimada pelo ato (conferir pelo teor se a outra também deveria ser), intimação aberta com data-limite vencida, petição cujo autor não foi identificado. Abra esses processos e decida pelas regras desta skill; grave a decisão como nova linha no arquivo, com o mesmo processo (vale a última linha). O que ficar sem decisão vai para Indefinidos.

**Interrupção.** Se a sessão do PJe expirar, o script para sozinho (`login` na linha `P|`). Peça ao usuário que se autentique, injete o script de novo, chame o `config` outra vez e reinicie só com os processos da rodada que ainda não têm linha no arquivo (`-SoResumo` lista os que faltam). O mesmo vale se o navegador ou a conversa caírem, ou se a aba travar e o Chrome a recarregar (`window.__CP` some).

## Como abrir cada processo

Use a **consulta processual**, não a fila da tarefa. A consulta não vincula tarefa a ninguém e não altera estado.

1. `https://pje1g.trf5.jus.br/pje/Processo/ConsultaProcesso/listView.seam`
2. O número é preenchido em campos separados. Ids: `fPP:numeroProcesso:numeroSequencial`, `:numeroDigitoVerificador`, `:Ano`, `:NumeroOrgaoJustica` (os 4 últimos dígitos do número do processo). Ramo (4) e tribunal (05) já vêm preenchidos. Botão: `fPP:searchProcessos`. Espere a página carregar antes de preencher.
3. Clique no número no resultado. Os autos abrem em janela nova — redirecione `window.open` para a mesma aba antes de clicar.
4. **Leia primeiro a cronologia** (`#divTimeLine`, decrescente: o que está acima é mais recente) e o teor dos documentos que interessam. O teor de um documento pode ser lido sem clicar, por `fetch('/pje/seam/resource/rest/pje-legacy/documento/download/<id>')`.
5. **Depois abra a aba Expedientes** (link `navbar:linkAbaExpedientes1`). Ao abri-la, a cronologia sai da tela — por isso ela é lida antes.

Analise um processo por vez e leia os documentos em série: muitas requisições simultâneas fazem o PJe bloquear o acesso por 10 minutos (HTTP 429).

## O que a aba Expedientes mostra

A tabela traz uma linha por ato de comunicação, com as colunas **Ato de comunicação**, **Data limite prevista para ciência ou manifestação**, **Documentos** e **Fechado** (SIM/NÃO). Na coluna Ato de comunicação constam: tipo e número da intimação, **ID do documento** (o ato que a gerou), parte intimada, meio e data (Diário Eletrônico, Expedição eletrônica etc.), o registro de ciência ("... registrou ciência em ...") e o prazo.

- **Intimação válida** → tem ciência registrada e data-limite preenchida.
- **Intimação com falha** → `Fechado: NÃO`, **sem ciência e sem data-limite**. É ela que prende o processo na tarefa.

**Sempre deve haver a data-limite para ciência ou manifestação. Intimação sem data-limite é sempre intimação com falha** — nunca presuma outra causa (ex.: que a parte se manifestou).

**Só as intimações do último ato são analisadas.** Intimações de atos anteriores ficam fora da análise, ainda que tenham falha.

## Passo 1 — o último ato e seus destinatários

Localize o **último ato judicial ou intimação** que gerou prazo (o ID do documento das intimações abertas indica qual é). Pelo **teor** do ato, identifique **para quem a intimação era endereçada**. Exemplo: intimação para se manifestar sobre planilha de cálculos deve ser feita às **duas partes**.

Em seguida, leia a **certidão de intimação** que vem logo depois do ato na cronologia e compare as partes nela com os destinatários devidos. Nunca presuma pelo nome do documento: leia o teor.

## Passo 2 — conferir a intimação de cada destinatário na aba Expedientes

Para cada destinatário devido, verifique se há, para o mesmo ato (mesmo ID do documento), **pelo menos uma intimação válida**. Confira também, na cronologia, o registro "DECORRIDO PRAZO DE <PARTE> EM <data>" de cada parte.

## Passo 3 — classificar

**Situação 1 — falha suprida: movimentar o processo.** Há intimação com falha aberta, mas a falha de **cada** destinatário foi suprida — por outra intimação válida do mesmo ato (a intimação com falha é duplicata de outra que funcionou) ou pela **manifestação da própria parte** depois do ato —, e o prazo de todas as intimações válidas já decorreu (data-limite anterior à data da análise). O processo só não foi movimentado por causa da intimação com falha. **Entra no relatório, aba `Movimentar`.**

Exemplo: o ato gerou duas intimações para cada parte. Para a parte autora, uma intimação (Diário Eletrônico) ficou sem ciência, sem data-limite e com `Fechado: NÃO`; outra, do mesmo ato e para a mesma parte, teve ciência e data-limite já vencida. A cronologia registra o decurso do prazo do INSS e da parte autora. A outra intimação supriu a falha: o processo deve ser movimentado.

Tarefa de destino:
- a tarefa configurada em `jef-controle-prazo.tarefa_com_manifestacao` → alguma parte intimada juntou petição depois da intimação válida e até a data-limite. Confira no documento aberto o "Juntado por" — a cronologia não mostra quem juntou.
- a tarefa configurada em `jef-controle-prazo.tarefa_sem_manifestacao` → nenhuma parte intimada se manifestou nesse período.

O registro "DECORRIDO PRAZO" na cronologia **não decide** sozinho entre as duas tarefas: o PJe lança o decurso mesmo quando a parte se manifestou no prazo.

**Situação 2 — falha sem suprimento: nova intimação.** Pelo menos um destinatário devido **não tem nenhuma intimação válida** do ato — só existe a intimação com falha, ou a parte nem consta dos expedientes ou da certidão de intimação — e **não se manifestou** depois do ato. Em regra, a cronologia mostra o decurso do prazo só para as outras partes. Exemplo: intimação sobre planilha de cálculos em que a certidão traz só o INSS — houve falha na intimação da parte autora. É preciso fazer **nova intimação** da parte não intimada. **Entra no relatório, aba `Nova intimação`**, ainda que o prazo das outras partes não tenha terminado.

**Sem falha.** Nenhuma intimação com falha aberta. Não entra no relatório; conte no resumo final.

**Prazo em curso.** Há expediente aberto com a data-limite ainda por vencer — do último ato ou de outro ato (ex.: decisão com prazo de 48 dias para o INSS) — ou a Situação 1 com alguma intimação válida ainda por vencer. O processo está na tarefa por um prazo que ainda corre. Não entra no relatório; conte no resumo final.

**Indefinidos.** Teor ambíguo, destinatários que não dá para identificar, documento ilegível ou que não carregou, intimação aberta com ciência e data-limite vencida, ou qualquer quadro que não se encaixe acima → aba `Indefinidos`, com o motivo e a etiqueta configurada em `jef-controle-prazo.etiqueta_indefinido`. Não decida no escuro.

## Entregável

Um único arquivo .xlsx, fonte Arial, com quatro abas. Identifique processos pelo número, nunca pelo nome da parte. A coluna de providência é prescrição para execução manual da secretaria; nenhuma skill movimenta processo nem expede intimação.

**Aba `Movimentar`** (Situação 1):

| Processo | Ato (ID e data) | Destinatários | Intimação com falha | Intimação válida que supriu | Data-limite | Tarefa de destino | Observação | Sigiloso |
|---|---|---|---|---|---|---|---|---|

**Aba `Nova intimação`** (Situação 2):

| Processo | Ato (ID e data) | Destinatários devidos | Parte(s) sem intimação válida | Intimação com falha | Observação | Sigiloso |
|---|---|---|---|---|---|---|

- **Intimação com falha**: número da intimação e meio (ex.: `<número> — Diário Eletrônico`); "não expedida" quando a parte nem consta dos expedientes.
- **Observação**: dado objetivo que ajude a secretaria a agir (ex.: o que a certidão de intimação traz; os decursos registrados na cronologia; a petição que fez a manifestação).
- **Sigiloso**: "sim" quando o processo tramitar em segredo de justiça, conforme classificação efetivamente registrada nele.

**Aba `Indefinidos`**:

| Processo | Motivo | Etiqueta | Sigiloso |
|---|---|---|---|

Etiqueta sempre a configurada em `jef-controle-prazo.etiqueta_indefinido`.

**Aba `Não analisados`** — processos não encontrados na consulta ou cujos autos não abriram:

| Processo | Motivo |
|---|---|

Nome do arquivo: `Controle_Prazo_AAAA-MM-DD_lote<última linha da rodada>.xlsx`, salvo em `Relatórios/`.

## Ao terminar

Relate primeiro o diagnóstico, depois os dados de apoio: data de corte aplicada e linhas da rodada; quantos processos foram analisados; quantos estão na **Situação 1 — movimentar** (com a divisão entre Com e Sem manifestação) e quantos na **Situação 2 — nova intimação** — estes são o resultado principal da rotina; quantos estavam sem falha; quantos com prazo em curso; quantos ficaram em Indefinidos.

Se algum processo não for encontrado na consulta ou os autos não abrirem, diga quais e por quê. Nunca relate como analisado um processo que você não conseguiu abrir.
