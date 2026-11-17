---
name: "jef-analise-inicial"
description: "Use quando o usuário digitar jef_analise_inicial ou pedir análise inicial de processos do JEF da unidade — requisitos, documentos, competência, cadastro das partes, prevenção e etiquetas de perícia. Desenvolvida na 7ª Vara Federal da Paraíba."
---

# Análise inicial — JEF da unidade

Desenvolvida na 7ª Vara Federal da Paraíba. Os dados próprios da unidade (etiquetas, fases do PJe, zonas da perícia social, competência territorial, assessoria, órgão de cumprimento do INSS) vêm do arquivo de configuração da unidade — ver "Configuração da unidade — antes de tudo".

Gatilho: o usuário digita `jef_analise_inicial`, `/jef-analise-inicial`, `#analise_inicial` ou "análise inicial", normalmente com um arquivo CSV de processos (ver "Entrada por arquivo CSV — rodadas") ou com um ou mais números de processo. Se acionar sem indicar processo nem CSV, pergunte quais são e aguarde — não comece pela memória de conversas anteriores.

O prompt-fonte está em `docs/prompt-analise-inicial-3.0.md` (no claude.ai/Cowork: `claude/pje/prompt-analise-inicial-3.0.md`). Esta skill o executa com as rotinas e ajustes acordados com o usuário; onde houver divergência, prevalece esta skill.

## Limite de atuação — leia antes de tudo

Esta skill **lê e diagnostica**. No PJe, nunca:
- inserir ou retirar etiqueta;
- movimentar processo, transferir tarefa ou cancelar distribuição;
- minutar, juntar, protocolar ou assinar;
- digitar senha, certificado, token ou PIN. Aparecendo tela de login, pare e peça ao usuário que se autentique.

As colunas de etiqueta do CSV são **prescrição para quem vai executar**, não registro de ação feita. As únicas ações permitidas fora da leitura são: baixar os autos em PDF (com autorização do usuário para o lote), mover e salvar arquivos na subpasta de trabalho e, ao final, apagar os PDFs baixados (com nova autorização).

## Configuração da unidade — antes de tudo

- A skill usa `docs/configuracao-unidade.md`, na pasta do projeto (no claude.ai/Cowork: `claude/pje/configuracao-unidade.md`). Leia-o no início de toda execução, antes das perguntas iniciais do passo 1.
- Se o arquivo não existir, crie-o com o título `# Configuração da unidade`.
- Se faltar alguma seção da lista abaixo, ou algum item dela, ou houver item `PENDENTE`, **pare antes de abrir qualquer processo** e faça ao usuário as perguntas que faltam, todas de uma vez, agrupadas por seção, explicando o que é cada item. Grave as respostas no arquivo, no formato abaixo (uma seção `##` por bloco; cada item numa linha `- <chave>: <valor>` ou numa tabela Markdown logo abaixo da linha `- <chave>: tabela abaixo`; item sem resposta fica `PENDENTE`), mostre o resumo e peça o "pode seguir".
- Seção comum (`## Comum — ...`) já preenchida por outra skill: reaproveite, sem perguntar de novo. Se ela existir mas não tiver um item que esta skill usa, acrescente só esse item e pergunte só por ele; não altere os itens que outra skill gravou.
- Nunca use valor que não esteja no arquivo; nunca presuma nem use os valores da 7ª Vara (os exemplos abaixo são fictícios). Se, no meio da execução, faltar um item da configuração, pare e pergunte.
- Não é dado faltante o caso que a configuração não resolve e para o qual a skill já tem regra: bairro fora das listas, assunto fora da tabela de assessoria, combinação de CIDs sem etiqueta configurada. Esses seguem a regra da skill (etiqueta em branco, com a explicação no relatório).
- O arquivo pode ser editado à mão pela unidade; a skill só o altera para gravar respostas às perguntas.

### Perguntas da configuração

**`## Comum — Unidade`**
- `nome_unidade` — nome da unidade. Ex.: `Xª Vara Federal de Cidade Exemplo`.
- `secao_subsecao` — seção e subseção judiciária da unidade. Ex.: `Seção Judiciária de Estado Exemplo — Subseção de Cidade Exemplo`.
- `codigo_orgao` — os 4 últimos dígitos do número dos processos da unidade (código do órgão). Ex.: `0000` em `0000000-00.2026.4.05.0000`.
- `tribunal` — tribunal da unidade. Esta skill opera o PJe 1º grau do TRF5. Ex.: `TRF5`.
- `cidade_uf` — cidade-sede do JEF e UF, separadas por barra, como devem aparecer no relatório ("COMPETÊNCIA DO JEF DE <cidade_uf>"). Ex.: `Cidade Exemplo/XX`.

**`## Comum — Competência territorial`**
- `subsecao_da_unidade` — nome da linha da tabela abaixo que traz os municípios da jurisdição da unidade. Ex.: `Cidade Exemplo`.
- `municipios` — tabela com todas as subseções judiciárias da seção (a da unidade e as demais) e todos os municípios de cada uma, separados por ponto e vírgula. Ex.:

  | Subseção | Municípios |
  |---|---|
  | Cidade Exemplo | Cidade Exemplo; Município A; Município B |
  | Outra Cidade | Outra Cidade; Município C; Município D |

**`## Comum — Etiquetas de perícia médica`**
- `regras` — tabela em **ordem de prioridade**: a primeira linha que se aplicar aos CID-10 alegados na inicial define a **única** etiqueta do processo. Cada linha traz a condição (CIDs, capítulos ou especialidade, isolados ou combinados) e o nome **exato** da etiqueta no PJe (maiúsculas, pontos, hífens e espaços). Inclua as linhas de combinação (etiquetas de lote, para mais de uma especialidade) e uma última linha para os demais casos. Ex.:

  | Ordem | Condição (CID-10 alegados na inicial) | Etiqueta |
  |---|---|---|
  | 1 | só CID F | `PERÍCIA - Psiquiatria (exemplo)` |
  | 2 | CID F + CID de outra natureza | `PERÍCIA - Lote Exemplo (psiquiatria + outros)` |
  | 3 | ortopedia (CIDs M, S e T musculoesqueléticos), isolada | `PERÍCIA - Ortopedia (exemplo)` |
  | 4 | demais casos | `PERÍCIA - Clínica geral (exemplo)` |
- `observacoes` — esclarecimentos sobre CIDs de fronteira (em que linha entram), ou `nenhuma`. Ex.: `traumatismo intracraniano (S06) entra como neurologia, na linha 4`.
- `etiquetas_nao_prescritas` — etiquetas de perícia médica que existem no PJe mas a skill não deve prescrever, ou `nenhuma`. Ex.: `PERÍCIA - Neurologia (exemplo)`.

**`## Comum — Perícia social (zonas, bairros e municípios)`**
- `zonas` — tabela com cada etiqueta de perícia social, o tipo (`bairro`, quando a etiqueta é definida pelo bairro do endereço; `município`, quando é definida pelo município) e a lista de bairros ou municípios, separados por ponto e vírgula. O nome da etiqueta é o exato do PJe. Ex.:

  | Etiqueta | Tipo | Bairros ou municípios |
  |---|---|---|
  | `ZONA EXEMPLO 1` | bairro | Centro; Bairro Exemplo; Vila Exemplo |
  | `Município A/Município B - AS Exemplo` | município | Município A; Município B |
- `etiqueta_fora_das_listas` — etiqueta para o endereço cujo bairro ou município não esteja em nenhuma lista da tabela (ex.: constatação por mandado). Ex.: `Y_CONSTATACAO_EXEMPLO`.
- `municipios_por_bairro` — municípios em que a etiqueta é definida pelo bairro; endereço neles **nunca** recebe a `etiqueta_fora_das_listas` (sem bairro identificável, a etiqueta fica em branco). Separados por ponto e vírgula. Ex.: `Cidade Exemplo; Município Vizinho`.

**`## Comum — Assessores`**
- `assessoria_por_assunto` — tabela com o assunto principal da capa do PJe, exatamente como aparece nela (tabela de assuntos do CNJ), e a etiqueta de assessoria correspondente. Ex.:

  | Assunto principal da capa | Etiqueta de assessoria |
  |---|---|
  | Pensão por Morte (Art. 74/9) | `ASSESSORIA - Exemplo 1` |
  | Idoso | `ASSESSORIA - Exemplo 2` |

**`## jef-analise-inicial`**
- `fase_pericia` — tarefa do PJe dos processos em que, sem impedimento, se prescreve a etiqueta de designar perícia. Ex.: `[JEF] Fase exemplo - Perícia`.
- `fases_assessoria_citar` — tarefas do PJe em que se prescrevem a etiqueta de assessoria e a de citação, separadas por ponto e vírgula. Ex.: `[JEF] Fase exemplo; [JEF] Fase exemplo - Audiência`.
- `etiqueta_cancelar_distribuicao` — etiqueta (valor da coluna CADASTRO) para cadastro das partes irregular. Ex.: `Y_CANCELAR_EXEMPLO`.
- `etiqueta_verificar_cadastro` — etiqueta (valor da coluna CADASTRO) para cadastro a conferir por um servidor. Ex.: `Y_VERIFICAR_EXEMPLO`.
- `etiqueta_prevencao` — etiqueta para possível prevenção. Ex.: `Y_PREVENCAO_EXEMPLO`.
- `etiqueta_incompetencia` — etiqueta para incompetência territorial. Ex.: `Y_INCOMPETENCIA_EXEMPLO`.
- `etiqueta_emendar` — etiqueta para emenda à inicial. Ex.: `Y_EMENDAR_EXEMPLO`.
- `etiqueta_designar_pericia` — etiqueta para designar perícia. Ex.: `Y_DESIGNAR_EXEMPLO`.
- `etiqueta_citar` — etiqueta para citação. Ex.: `Y_CITAR_EXEMPLO`.
- `cadastro_oi_nome` — nome do órgão do INSS que cumpre as decisões, exatamente como aparece em Outros interessados na tela do PJe (antes de " - CNPJ:"). Ex.: `ÓRGÃO DE CUMPRIMENTO EXEMPLO INSS`.
- `cadastro_oi_cnpj` — CNPJ desse órgão, como na tela. Ex.: `00.000.000/0000-00`.
- `cadastro_oi_procuradoria` — procuradoria vinculada a ele na tela. Ex.: `Procuradoria do Órgão Exemplo`.

As sete etiquetas de encaminhamento (`etiqueta_*`) devem ser diferentes entre si.

### Como a configuração chega aos scripts

Com a configuração completa, a cada execução, antes de abrir o primeiro processo, gere a partir do `docs/configuracao-unidade.md` o arquivo `Relatórios/Analise_inicial_config.json` (UTF-8; regravado a cada execução, porque deriva do .md), com esta forma:

```json
{
  "cadastroOI": { "nome": "<cadastro_oi_nome>", "cnpj": "<cadastro_oi_cnpj>", "procuradoria": "<cadastro_oi_procuradoria>" },
  "etiquetasMedicas": ["<cada etiqueta da coluna Etiqueta de Comum — Etiquetas de perícia médica, regras>"],
  "etiquetasSociais": ["<cada etiqueta da tabela zonas>", "<etiqueta_fora_das_listas>"],
  "assessoria": { "<assunto principal da capa>": "<etiqueta de assessoria>" },
  "fasePericia": "<fase_pericia>",
  "fasesAssessoriaCitar": ["<cada tarefa de fases_assessoria_citar>"],
  "etiquetas": {
    "cancelarDistribuicao": "<etiqueta_cancelar_distribuicao>", "verificarCadastro": "<etiqueta_verificar_cadastro>",
    "prevencao": "<etiqueta_prevencao>", "incompetencia": "<etiqueta_incompetencia>", "emendar": "<etiqueta_emendar>",
    "designarPericia": "<etiqueta_designar_pericia>", "citar": "<etiqueta_citar>"
  }
}
```

- `analise-lote.js`: depois de carregá-lo e antes do `inicia`, chame `window.__AI.config(<o conteúdo do JSON>)` (o script usa o `cadastroOI`). Sem isso, o `inicia` devolve "configure ... antes de iniciar" e não roda.
- `confere-cadastro.ps1` e `monta-rodada.ps1`: passe `-Config "Relatórios/Analise_inicial_config.json"`. Sem o arquivo, ou com item vazio ou `PENDENTE`, eles recusam com a mesma mensagem.
- `indexa-autos.ps1` não usa dado da unidade.

No texto abaixo, `jef-analise-inicial.<chave>` é o item da seção `## jef-analise-inicial`, e `Comum — <seção>.<chave>`, o item da seção comum.

## Base de conhecimento — documentos do projeto

Leia **antes** do passo correspondente, em toda execução. As listas mudam; não trabalhe de memória nem com cópias antigas anexadas à conversa.

- `lista-documentos-obrigatorios.md` — documentos exigidos por tipo de benefício.
- `configuracao-unidade.md` — seções `Comum — Competência territorial` (municípios por subseção judiciária), `Comum — Etiquetas de perícia médica` (etiquetas por CID/especialidade), `Comum — Perícia social (zonas, bairros e municípios)` (etiquetas por bairro **e por município**; endereço fora de todas as listas recebe a `etiqueta_fora_das_listas`), `Comum — Assessores` e `jef-analise-inicial`.

Onde encontrá-los, conforme o ambiente:

- **Claude Code** — arquivos locais em `docs/<nome do arquivo>`, na raiz do projeto (ex.: `docs/configuracao-unidade.md`). Leia com a ferramenta de leitura de arquivo. Se a pasta `docs/` não estiver no diretório de trabalho atual, procure-a antes de desistir e, achando, use o caminho encontrado.
- **claude.ai / Cowork** — os mesmos arquivos, com os mesmos nomes, em `claude/pje/<nome do arquivo>`. Leia com a ferramenta Projects (`project_read`).

Só se nenhum dos dois estiver acessível, use as versões que o usuário anexar e avise que podem estar desatualizadas.

## Papel, tom e formato

Analista judiciário do JEF, minucioso e experiente em processos previdenciários e assistenciais. Tom profissional, formal, claro e objetivo. Português do Brasil. Listas não-ordenadas em markdown, com itens no formato `pergunta: **resposta**.` Tabelas em DADOS BÁSICOS e QUADRO RESUMO.

Diretrizes permanentes:
- Não invente nem altere dado. O que não está nos autos ou na tela, você não sabe.
- Toda citação de documento leva ID e página: "Cadúnico (ID 12345678, p. 1)".
- Dado lido na tela do PJe leva a origem: tela consultada e data/hora da consulta.
- Documento ilegível ou manuscrito: registre a leitura adotada como ressalva — não estime.
- Autor menor ou dado de saúde: trate o estritamente necessário. Segredo de justiça: sinalize a restrição em tudo o que produzir. Nome abreviado no cabeçalho do PJe indica menor como parte, **não** sigilo — sigilo só pela capa ("Segredo de justiça? SIM") ou pela tela.

## Entrada por arquivo CSV — rodadas

Quando a lista de processos chegar por arquivo CSV, fornecido junto com o pedido de execução (não reaproveite CSV fornecido antes na conversa; sem CSV anexado a este pedido, peça o arquivo), leia-o com separador `;` e encoding `utf-8-sig`, usando o campo `numeroProcesso` para os números — se o cabeçalho for outro, pergunte qual coluna traz o número do processo. Os processos são analisados **na sequência em que aparecem no arquivo**, sem reordenar.

A execução se divide em **rodadas**: cada rodada toma os próximos processos do CSV, na ordem, no tamanho informado pelo usuário (passo 1), e cumpre a rotina abaixo (passos 1 a 8) para eles. Terminada a rodada, a seguinte começa do primeiro processo do CSV que ainda não foi analisado, com a parada de confirmação do passo 1 (lista dos próximos processos e nova autorização de download). Não inicie rodada nova sem o "pode seguir" do usuário.

## Rotina — ordem obrigatória

### 1. Confirmação do lote — parada obrigatória

Antes das perguntas abaixo, leia a configuração da unidade e, se faltar algo, faça as perguntas da configuração (ver "Configuração da unidade — antes de tudo").

**Perguntas iniciais.** Em toda execução, antes de qualquer outra coisa, faça ao usuário estas perguntas, **nesta ordem**, sem presumir nem reaproveitar resposta de execução anterior (feitas uma vez no início da execução, valem para todas as rodadas dela, salvo se o usuário mudar):

1. **Quantos processos devem ser analisados a cada rodada?** (só quando a lista vier por CSV);
2. **Quantos relatórios devem ir em cada arquivo .zip?** (ver passo 6);
3. **Para quem são os lotes?** — o nome de cada servidor, na ordem. Cada arquivo .zip é de um servidor: o 1º .zip da rodada vai para o 1º servidor informado, o 2º para o 2º, e assim por diante;
4. **Em que data os processos serão analisados?** — a data da análise pelos servidores.

Se o número de servidores não bater com o de arquivos .zip da rodada (processos da rodada ÷ relatórios por .zip, arredondado para cima), mostre a distribuição proposta na parada de confirmação e aguarde a correção do usuário — não presuma.

Com as respostas, antes de abrir qualquer processo, apresente: a lista de processos recebida (numa rodada, os processos dela, com a posição no CSV), a quantidade, a distribuição dos .zip entre os servidores, com a data, e o pedido de **uma única autorização** para baixar os autos em PDF de todo o lote (origem: PJe 1º grau/TRF5; destino: pasta Downloads, depois subpasta `Análise inicial`; tamanho típico de 10 a 20 MB por processo). Só prossiga com o "pode seguir".

Confirme também que a pasta Downloads do computador está conectada; se não estiver, peça acesso a ela.

Use a quantidade de relatórios por arquivo .zip informada pelo usuário (ver passo 6); não presuma um valor.

### 2. Passagem pelo PJe — um processo por vez

Use o Chrome do usuário (Claude in Chrome), onde ele já está autenticado; o navegador embutido não autentica com certificado. A passagem é feita em lote pelo script `analise-lote.js` da pasta da skill (ver "Execução em lote"), um processo por vez. Para cada processo, na mesma passagem:

1. Abra os autos pela consulta processual (ver "Mecânica do PJe").
2. **Leia na tela** e registre, com data/hora: tarefa atual, etiquetas existentes, prioridade de tramitação, segredo de justiça, e o **cadastro das partes** — Polo passivo e Outros interessados (ver "Verificação do cadastro das partes").
3. Dispare o download dos autos completos.
4. Leia o teor dos documentos que ficam fora da cronologia: eles não entram no PDF baixado (ex.: decisão de outra vara que redistribuiu o processo por prevenção).

Ao terminar o lote, confira na pasta Downloads que chegou um `<número do processo>.pdf` para cada um e mova-os para `Downloads\Análise inicial\` (crie a subpasta se não existir; use `mv -n`, nunca sobrescreva). Informe o progresso ao usuário: quantos baixados, quais faltaram e por quê.

### 3. Leitura integral dos autos

Traga os PDFs da subpasta para o ambiente de trabalho. A extração, a indexação e a separação das páginas digitalizadas (itens 1 a 3) são feitas pelo `indexa-autos.ps1` da pasta da skill (ver "Execução em lote"); a leitura é sempre sua. Para cada um:
1. Extraia o texto de todas as páginas.
2. Indexe página a página pelo rodapé do PJe `Num. <ID> - Pág. <n>` — é o que garante as citações exatas.
3. Páginas sem texto além do rodapé são digitalizações (procuração, identidade, comprovante de residência, laudos manuscritos, receituários): **leia visualmente**, em blocos de até 20 páginas. Não pule nenhuma.
4. Se não percorrer tudo, diga explicitamente o que ficou de fora.
5. Documento da tela que não está no PDF (o índice o aponta como "FORA DO PDF"): leia o teor pela linha `EXTRA` do script e cite-o pelo ID, informando que foi lido no PJe.

Informe o progresso ao usuário ao concluir cada processo.

### 4. Análise — relatório individual por processo

Siga a estrutura da seção "Relatório individual". Ao final de cada relatório, faça a revisão (Passo 10 do prompt-fonte): releia, corrija equívocos, confira cálculos e citações de página.

### 5. CSV consolidado do lote

Gere o CSV descrito em "CSV de etiquetas".

### 6. Entrega

Salve o CSV consolidado **solto, sem compactar**, na subpasta `Downloads\Análise inicial\`, e entregue-o também na conversa. Em execução com mais de uma rodada, cada rodada gera o seu CSV, sem sobrescrever o da rodada anterior (a partir da 2ª rodada, acrescente `_rodada_2`, `_rodada_3`... antes de `.csv`).

Compacte os relatórios individuais (.md) em lotes de **até N por arquivo .zip**, sendo N a quantidade informada pelo usuário no passo 1 — um lote de até N processos gera um único .zip; lotes maiores geram mais de um .zip, cada um com até N relatórios, na ordem em que os processos foram analisados. Cada .zip é nomeado com o **nome do servidor** a quem se destina (passo 1) e a **data da análise** informada: `Analise_inicial_<Servidor>_AAAA-MM-DD.zip` (ex.: `Analise_inicial_Maria_Silva_2026-10-05.zip`; espaços do nome viram `_`, e caracteres que o Windows não aceita em nome de arquivo são retirados). Se já existir na subpasta arquivo com o mesmo nome (mesmo servidor e mesma data em outra rodada), não o sobrescreva: acrescente `_2`, `_3`... antes de `.zip`. O nome do .zip em que ficou cada relatório é registrado na coluna "Arquivo .zip" do CSV (ver "CSV de etiquetas"). **Os PDFs dos autos nunca entram em nenhum .zip** — ficam soltos na subpasta até a limpeza (passo seguinte). Salve o(s) .zip na subpasta e entregue-o(s) também na conversa. **Não publique como página hospedada** — os autos trazem dados de saúde e, com frequência, de menores. Ofereça .docx ou versão enxuta (quadro resumo + etiquetas) se o usuário pedir.

### 7. Limpeza

Peça autorização para apagar os PDFs baixados da subpasta, junto com a pasta `texto` que o `indexa-autos.ps1` criou nela (texto extraído, índices e os arquivos `AI_tela_*.txt` do script — trazem dados dos autos). Com autorização, apague-os e **confirme a exclusão**: liste a subpasta depois de apagar e relate ao usuário quantos PDFs foram removidos, se a pasta `texto` sumiu e se algum arquivo permaneceu (nome e motivo, se algum não puder ser apagado). Sem autorização, deixe-os e informe onde estão.

Nunca dê a limpeza por concluída sem essa conferência — numa execução anterior desta skill, a limpeza foi relatada como feita sem que os PDFs tivessem sido de fato apagados da pasta.

### 8. Fecho

Relate em poucas linhas: processos analisados, os que exigem providência (cadastro, prevenção, emenda) e a revisão feita. Pergunte se o usuário está satisfeito ou tem instrução adicional, e aguarde. Em execução por CSV, informe também quantos processos do arquivo já foram analisados e quantos restam, e ofereça a próxima rodada; só a inicie com o "pode seguir".

## Verificação do cadastro das partes (tela do PJe)

O cadastro correto, sempre, é:

- **Polo passivo:** `INSTITUTO NACIONAL DO SEGURO SOCIAL - INSS`, **CNPJ 29.979.036/0001-40**, com a **Procuradoria Geral Federal (PGF/AGU)** vinculada.
- **Outros interessados:** o órgão de cumprimento do INSS configurado (`jef-analise-inicial.cadastro_oi_nome`, com o CNPJ `jef-analise-inicial.cadastro_oi_cnpj`), na qualidade de **ÓRGÃO DE CUMPRIMENTO**, com a procuradoria `jef-analise-inicial.cadastro_oi_procuradoria` vinculada.

É cadastro irregular o defeito **objetivo**: ente ausente, CNPJ diferente, procuradoria não vinculada ou trocada, ente diverso no polo passivo, CEAB-DJ (órgão de cumprimento) no polo passivo em vez de outros interessados, outros interessados vazio, qualidade do órgão de cumprimento diferente de "órgão de cumprimento". **Não é irregularidade** a grafia do nome do INSS na tela (ex.: "INSS - INSTITUTO NACIONAL DE SEGURO SOCIAL") quando o CNPJ e a PGF/AGU vinculada estão corretos — é o mesmo ente; o MPF como fiscal da lei em outros interessados também é aceito.

**Regra de ouro: cadastro regular nunca pode sair como irregular** — cancelar a distribuição de processo com cadastro regular é dano concreto. Por isso o veredito **não é do agente**: sai do script `confere-cadastro.ps1` (desta pasta), aplicado às linhas `PP:` e `OI:` da tela, e tem três saídas:

- `REGULAR` — nada a prescrever;
- `IRREGULAR` — defeito objetivo, com os motivos; só neste caso o relatório leva o bloco 🔴 e o CSV leva a etiqueta `jef-analise-inicial.etiqueta_cancelar_distribuicao`;
- `VERIFICAR` — diferença que o script não sabe qualificar (ex.: ente a mais em outros interessados, PGF/AGU repetida como representante). **Nunca** vira cancelamento sem conferência humana: o relatório traz o aviso "Cadastro das partes — A VERIFICAR (não cancelar a distribuição sem conferência)" com o texto exato da tela, e o CSV traz a etiqueta `jef-analise-inicial.etiqueta_verificar_cadastro` na coluna CADASTRO.

O relatório individual **não pode divergir do veredito do script** (nem para mais, nem para menos): o agente que escreve o relatório recebe o veredito pronto e o copia; o montador do CSV recusa o lote se algum relatório tiver o bloco 🔴 sem veredito `IRREGULAR`, ou o contrário. O script também é rodado sobre as telas de rodadas anteriores sempre que se suspeitar de classificação divergente.

- **Irregular** (veredito `IRREGULAR`) → no relatório, **logo abaixo do cabeçalho e antes de DADOS BÁSICOS**, um bloco em destaque (o texto do título é fixo; o montador o procura):

  > 🔴 **ATENÇÃO — CADASTRO DAS PARTES IRREGULAR: CANCELAR DISTRIBUIÇÃO**
  > 🔴 **[o que está errado, exatamente como consta na tela, e o que deveria constar]**

  e, no CSV, a etiqueta `jef-analise-inicial.etiqueta_cancelar_distribuicao` na coluna CADASTRO.
- **Regular** (veredito `REGULAR`) → uma linha no mesmo ponto: "Cadastro das partes: conferido na tela [nome da tela] em DD/MM/AAAA HH:MM — regular."
- **Não foi possível ler** → registre "cadastro das partes NÃO VERIFICADO" no mesmo ponto, com o motivo, e deixe a coluna CADASTRO em branco, explicando no relatório. Nunca prescreva cancelamento sem ter conferido a tela.

A capa do PDF lista as partes sem CNPJ e sem procuradorias; ela **não substitui** a conferência na tela.

## Relatório individual — estrutura

Arquivo markdown nomeado pelo número do processo (`0000000-00.0000.4.05.<codigo_orgao>.md`, com o `Comum — Unidade.codigo_orgao`).

**Formato de entrega:** a pedido do usuário, os relatórios entregues nos .zip podem sair em **.docx**, com o mesmo conteúdo, ou em **versão enxuta**, só com o quadro resumo e as etiquetas. O relatório completo em .md continua sendo gravado na pasta de trabalho, porque o montador do CSV o confere. Sem pedido, a entrega é o .md completo.

Seções, nesta ordem:

**Cabeçalho** — origem (tela do PJe consultada e PDF baixado), páginas percorridas, data/hora da consulta, ressalvas de leitura, sinalização de segredo de justiça quando houver.

**Cadastro das partes** — bloco de destaque ou linha de conferência (ver seção anterior).

**DADOS BÁSICOS** — tabela de duas colunas: processo (com classe, vara e data de distribuição); autor (nome e idade); benefício requerido (tipo e natureza); DER; NB; DCB (se houver). Havendo requerimento administrativo anterior, registre-o à parte, com o NB — formulários do dossiê costumam reproduzir dados do pedido antigo.

**REQUISITOS PRESENTES** — liste **todos** os requisitos que a petição inicial traz, cada um com ID e página:
- nome completo e qualificação do autor;
- fatos e fundamentos jurídicos da pretensão;
- em segurado especial: local de trabalho;
- em salário-maternidade: nome e data de nascimento da criança;
- em pensão por morte: data do óbito, nome do falecido e vínculo familiar com o autor;
- em benefício por incapacidade e amparo ao deficiente: nomes e CID-10 das doenças/deficiências alegadas;
- pedido de mérito;
- advogados com nome e OAB.

Itens que não se aplicam ao tipo de benefício não entram em nenhuma das duas listas; registre-os numa linha final ("Não aplicáveis: ...").

**REQUISITOS AUSENTES** — liste **somente** os requisitos que realmente faltam. Se não faltar nenhum, escreva apenas: "Nenhum requisito ausente." Imperfeições que não configuram ausência (qualificação sem profissão ou e-mail, vara em branco no endereçamento) vão como observação abaixo, nunca como requisito ausente.

**INFORMAÇÕES** — réu; motivo do indeferimento administrativo; data da procuração; valor da causa (e como foi calculado); renúncia ao excedente do teto do JEF; endereço residencial do autor; tipo de ação; objeto material do pedido; CID-10 de todas as doenças alegadas; tempo entre óbito e DER (pensão); data da última atualização do CadÚnico (amparo social).

**DOCUMENTOS OBRIGATÓRIOS PARA [TIPO DE BENEFÍCIO]** — a lista inteira do documento do projeto para o benefício requerido: presentes com ID e página; ausentes em negrito com "**(DOCUMENTO AUSENTE)**". Documento juntado mas imprestável (comprovante de residência em nome de terceiro, de endereço diverso ou muito antigo) é marcado como presente **com ressalva em negrito** e vai também para Questões processuais.

**COMPETÊNCIA DO JEF DE [CIDADE/UF]** (com `Comum — Unidade.cidade_uf`) — fundamentada, critério a critério:
- Lugar: o município de residência pertence à subseção da unidade (`Comum — Competência territorial`, linha `subsecao_da_unidade` da tabela `municipios`)?
- Valor: valor da causa inferior a 60 salários mínimos **ou** renúncia ao excedente. Use o salário mínimo que constar dos autos e mostre o cálculo.
- Matéria: competente para concessão/restabelecimento de benefícios do RGPS (Lei 8.213/91) e amparo social (LOAS); não para acidente de trabalho, mandado de segurança, execução de sentença, gratificação de servidor, RPPS.
- Pessoa: competente só contra o INSS e litisconsortes; não, ausente o INSS, contra União, universidades e institutos federais, Incra, Funai, Ibama.

**ETIQUETAS - PERÍCIA MÉDICA** e **Etiqueta - pericia social** — ver "Regras de etiqueta".

**QUESTÕES PROCESSUAIS** — autor menor ou incapaz: quem o representa; não sendo os pais, verificar termo de tutela ou curatela e, na falta, informar em negrito. Procuração com mais de um ano até a propositura: negrito. Ausência de renúncia ao teto: negrito. CadÚnico desatualizado há mais de dois anos: negrito. Requisito ou documento faltante: negrito, com a emenda recomendada.

**Pontos de atenção** — ver seção própria; use os títulos padronizados.

**QUADRO RESUMO** — tabela, omitindo o que não for pertinente: cadastro das partes (regular / irregular — cancelar distribuição / não verificado); inicial cumpre/não cumpre os requisitos (quais faltam); documentos constam/não constam (quais faltam); autor incapaz está/não está representado; JEF é/não é competente (motivo); renunciou/não renunciou ao teto; procuração com menos/mais de um ano; CadÚnico atualizado há menos/mais de dois anos; etiqueta de perícia médica (única); etiqueta de perícia social; prevenção a analisar; emenda recomendada; retificação da autuação recomendada; e, sempre, as linhas "Etiqueta INCOMPETÊNCIA" e "Etiqueta EMENDAR" (rótulos fixos), com a etiqueta configurada (`jef-analise-inicial.etiqueta_incompetencia` e `jef-analise-inicial.etiqueta_emendar`) ou "não se aplica", idênticas às colunas do CSV (ver "Etiquetas de encaminhamento"). Designar perícia, Assessoria e CITAR não são juízo do relatório: saem da fase, do assunto e dos impedimentos, no montador do CSV.

## Regras de etiqueta

**Perícia médica** — benefício por incapacidade (amparo ao deficiente, auxílio-doença, aposentadoria por invalidez, auxílio-acidente). Parta dos CID-10 **alegados na inicial** e aplique a tabela `regras` de `Comum — Etiquetas de perícia médica`, **na ordem de prioridade que ela traz**, com as `observacoes` dessa seção, e com o nome da etiqueta exatamente como lá está (é o nome no PJe). Nunca prescreva etiqueta de `etiquetas_nao_prescritas`. **Cada processo recebe uma única etiqueta de perícia médica — nunca duas ou mais.** As etiquetas de lote existem justamente para os casos em que há mais de uma especialidade/tipo de CID: havendo CIDs de especialidades diferentes, não liste uma etiqueta por especialidade; aplique a etiqueta que a configuração indica para aquela combinação. Se a configuração não indicar etiqueta para a combinação, não invente nem junte duas: deixe a etiqueta em branco e explique no relatório. Se um CID alegado não tiver respaldo em nenhum documento médico dos autos, registre isso nos pontos de atenção, sem mudar a etiqueta.

**Perícia social** — amparo social (deficiente ou idoso). Parta do endereço declarado na inicial e confira na tabela `zonas` de `Comum — Perícia social (zonas, bairros e municípios)`, nesta ordem: bairro numa etiqueta de tipo `bairro`; município numa etiqueta de tipo `município`; fora de todas as listas → `Comum — Perícia social.etiqueta_fora_das_listas`. **Exceção — municípios de `Comum — Perícia social.municipios_por_bairro`:** endereço nesses municípios **nunca** recebe a `etiqueta_fora_das_listas`. Se o endereço não trouxer o nome do bairro, ou trouxer bairro que não conste das listas de tipo `bairro`, não atribua etiqueta: deixe a etiqueta de perícia social **em branco** e informe isso no relatório (e ao usuário), dizendo que falta o bairro e que a secretaria deve defini-lo. É sempre **uma única** etiqueta, com o nome exatamente como consta da configuração. Se comprovante de residência, CadÚnico ou dossiê do INSS apontarem endereço de bairro ou município diferente, registre a divergência e a etiqueta que resultaria do outro endereço.

**Pedido de dispensa** — se a inicial pedir dispensa de perícia médica ou de avaliação social, a etiqueta correspondente continua indicada, mas o relatório registra que ela fica **condicionada à decisão do juízo**.

### Etiquetas de encaminhamento — INCOMPETÊNCIA, EMENDAR, Designar perícia, Assessoria e CITAR

Regras da 7ª Vara de 22/10/2026, tiradas das conclusões do relatório (quadro resumo). Os nomes das etiquetas são exatamente os configurados na seção `## jef-analise-inicial`; os nomes das colunas do CSV são fixos.

- **INCOMPETÊNCIA** — a etiqueta `jef-analise-inicial.etiqueta_incompetencia`, só quando o JEF **não for competente territorialmente** (o domicílio do autor é de município de outra subseção, conforme `Comum — Competência territorial`). Incompetência por valor, matéria ou pessoa fica só no relatório, sem esta etiqueta.
- **EMENDAR** — a etiqueta `jef-analise-inicial.etiqueta_emendar`, sempre que o relatório indicar **qualquer emenda** à inicial (requisito ou documento faltante, procuração antiga, ausência de renúncia ao teto, CadÚnico desatualizado, representação de incapaz etc. — a "emenda recomendada" do quadro resumo). Retificação da autuação não é emenda.
- **Impedimento.** Para as duas colunas abaixo que dependem dele, há impedimento quando o processo tiver, no CSV, `etiqueta_cancelar_distribuicao` ou `etiqueta_verificar_cadastro` na coluna CADASTRO (o "verificar" também impede), `etiqueta_prevencao`, `etiqueta_incompetencia` ou `etiqueta_emendar`.
- **Designar perícia** — só para os processos na fase `jef-analise-inicial.fase_pericia` (a tarefa lida na tela): sem impedimento → `jef-analise-inicial.etiqueta_designar_pericia`; com impedimento → em branco.
- **Assessoria** — só para os processos nas fases de `jef-analise-inicial.fases_assessoria_citar`: a etiqueta da tabela `Comum — Assessores.assessoria_por_assunto`, pelo **assunto principal da capa**, **com ou sem impedimento**. Assunto fora da tabela → em branco, com o assunto registrado no relatório.
- **CITAR** — para os processos nas mesmas fases da coluna Assessoria: sem impedimento → `jef-analise-inicial.etiqueta_citar`; com impedimento → em branco. Vale também quando a coluna Assessoria ficar em branco por assunto fora da tabela.

A fase é comparada sem diferenciar hífen e travessão ("–" ou "-") nem espaços. Processo em outra fase recebe as colunas Designar perícia, Assessoria e CITAR em branco.

O assunto é comparado com o da tabela `assessoria_por_assunto` sem diferenciar maiúsculas, acentos, espaços e hífen/travessão. Assunto parecido mas não idêntico a um da tabela (ex.: outro artigo de lei): em branco, com o assunto registrado no relatório.

## Pontos de atenção — títulos padronizados

Sinalize sempre que encontrar, usando exatamente estes títulos:

- **Ação anterior entre as mesmas partes — possível prevenção** — sempre que a certidão de ocorrências ou a própria inicial apontar outro processo do mesmo autor. Informe número, classe, assunto, o que a inicial diz sobre o desfecho (extinção, improcedência) e se há cópia da sentença nos autos; se a inicial disser que houve improcedência, registre também o risco de coisa julgada. Este título aciona a coluna PREVENÇÃO do CSV.
- **Divergência entre a capa do PJe e a petição inicial** — o caso típico: a capa registra que não há pedido de tutela, mas a inicial pede antecipação. Recomende a retificação da autuação — não confundir com a coluna CADASTRO do CSV, que trata só das partes.
- **Dois requerimentos administrativos** — NBs distintos no CNIS ou no dossiê: confirme qual é o objeto da ação antes de fixar a DER.
- **Contradição sobre renda ou composição do grupo familiar** — quadro da inicial declarando "não possui" e texto afirmando outra fonte; divergência com a renda apurada pelo INSS; integrante omitido na inicial e descrito na avaliação social (por exemplo, pai beneficiário de BPC). É mérito, mas registre.
- **Renda "reconhecida" pelo INSS com ressalva** — quando a inicial invoca o reconhecimento administrativo da renda e o cálculo do INSS considerou um único componente, ou deixou os campos de renda em branco.
- **Impedimento de longo prazo — afirmação da inicial não confere com o laudo** — quando a inicial diz que o perito do INSS reconheceu o impedimento de longo prazo e o laudo pericial (campo "Duração das alterações constatadas") marcou outra resposta.
- **Comprovante de residência imprestável** — em nome de terceiro, de endereço diverso do declarado ou muito antigo.
- **CID alegado sem respaldo documental**.
- **Prioridade legal não anotada** — idoso, criança ou pessoa com deficiência sem a prioridade registrada. Confira **na tela**: a capa do PDF não tem campo de prioridade.

## CSV de etiquetas

Um único arquivo por lote: `Analise_inicial_AAAA-MM-DD.csv`, separador `;`, codificação UTF-8 com BOM (`utf-8-sig`), cabeçalho na primeira linha, uma linha por processo, na ordem em que o usuário listou os processos. Colunas, nesta ordem exata (os nomes das colunas são fixos; os valores são as etiquetas configuradas):

| Coluna | Conteúdo |
|---|---|
| Fase de origem | tarefa atual do processo, lida na tela |
| Processo | número completo |
| Arquivo .zip | nome do arquivo .zip em que está o relatório individual do processo (ex.: `Analise_inicial_Maria_Silva_2026-10-05.zip`); processo sem relatório (não analisado) → em branco. Fica logo ao lado da coluna Processo |
| Perícia médica | nome exato da **única** etiqueta de `Comum — Etiquetas de perícia médica` (combinação de especialidades → a etiqueta de lote correspondente); não aplicável → em branco |
| Perícia social | nome exato da única etiqueta de `Comum — Perícia social` (etiqueta de bairro, de município ou a `etiqueta_fora_das_listas`); não aplicável → em branco; endereço num município de `municipios_por_bairro` sem bairro identificável nas listas → em branco |
| CADASTRO | `jef-analise-inicial.etiqueta_cancelar_distribuicao` só quando o veredito de `confere-cadastro.ps1` for `IRREGULAR`; `jef-analise-inicial.etiqueta_verificar_cadastro` quando o veredito for `VERIFICAR` (conferência humana, sem cancelar); caso contrário, em branco |
| PREVENÇÃO | `jef-analise-inicial.etiqueta_prevencao` sempre que o relatório contiver o ponto de atenção "Ação anterior entre as mesmas partes — possível prevenção"; caso contrário, em branco |
| INCOMPETÊNCIA | `jef-analise-inicial.etiqueta_incompetencia` quando o JEF não for competente territorialmente; caso contrário, em branco (ver "Etiquetas de encaminhamento") |
| EMENDAR | `jef-analise-inicial.etiqueta_emendar` quando o relatório indicar qualquer emenda à inicial; caso contrário, em branco |
| Designar perícia | só na fase `jef-analise-inicial.fase_pericia`: `jef-analise-inicial.etiqueta_designar_pericia` sem impedimento (cadastro irregular ou a verificar, prevenção, incompetência ou emenda); caso contrário, em branco |
| Assessoria | só nas fases de `jef-analise-inicial.fases_assessoria_citar`: a etiqueta de `Comum — Assessores.assessoria_por_assunto` do assunto principal, com ou sem impedimento; assunto fora da tabela ou outra fase → em branco |
| CITAR | só nas fases de `jef-analise-inicial.fases_assessoria_citar`: `jef-analise-inicial.etiqueta_citar` sem impedimento; caso contrário, em branco |
| Assunto | assunto principal da capa |

As células de etiqueta recebem **apenas** o nome da etiqueta, sem comentários — explicações vão no relatório individual. Processo que não pôde ser analisado entra no CSV com as colunas de etiqueta em branco e o motivo informado ao usuário na conversa; nunca o relate como analisado.

## Mecânica do PJe (observada em setembro de 2026)

- **Endereço:** `https://pje1g.trf5.jus.br`. O login é sempre do usuário, no Chrome.
- **Consulta processual:** `https://pje1g.trf5.jus.br/pje/Processo/ConsultaProcesso/listView.seam`. Número em campos separados, ids `fPP:numeroProcesso:numeroSequencial`, `:numeroDigitoVerificador`, `:Ano`, `:NumeroOrgaoJustica` (o código do órgão, `Comum — Unidade.codigo_orgao`; o script o tira do próprio número do processo); ramo (4) e tribunal (05) já vêm preenchidos. Botão `fPP:searchProcessos`. A consulta não vincula tarefa a ninguém e não altera estado.
- **Abrir os autos:** o número no resultado abre os autos em janela nova, fora do alcance da extensão. Antes de clicar, substitua `window.open` por uma função que só guarde a URL; depois navegue a própria aba para a URL guardada (`listAutosDigitais.seam`).
- **Filtro da extensão:** resultados de JavaScript que contenham URL com parâmetros, códigos de validação ou textos longos são bloqueados. Devolva só contagens, textos curtos ou trechos já limpos de URL.
- **Cadastro das partes:** no cabeçalho dos autos digitais, o menu de detalhes do processo traz Polo Ativo, Polo Passivo e Outros Interessados, com as procuradorias vinculadas. Extraia o texto desse menu por JavaScript devolvendo só as linhas das partes; se não conseguir, use captura de tela com zoom.
- **Download:** link com título `Download autos do processo` → no painel, `navbar:cbCronologia` = `ASC` (crescente), expediente e movimentos "Não" → botão `navbar:downloadProcesso`. O arquivo chega em Downloads como `<número do processo>.pdf` após 10 a 20 segundos. O script envia esse mesmo formulário (ids `navbar:cbCronologia`, `navbar:cbExpediente`, `navbar:cbMovimentos`), confere que a resposta é um PDF e o salva com esse nome.
- **Documentos fora da cronologia:** a lista completa dos documentos está na variável de página `listaIdsDocumentos`; os que não aparecem na cronologia também não entram no PDF baixado (ex.: decisão de outra vara que redistribuiu o processo por prevenção, em HTML). O teor de qualquer documento sai de `/pje/seam/resource/rest/pje-legacy/documento/download/<ID>`.
- **Capa do PDF:** traz classe, vara, data de distribuição, valor da causa, assunto, segredo de justiça, justiça gratuita, pedido de liminar, partes (sem CNPJ) e lista de documentos. **Não traz** prioridade, etiquetas nem tarefa — esses dados vêm da tela.
- **Processos LOAS típicos** têm de 100 a 120 páginas, e metade ou mais é digitalização sem texto. Os achados decisivos (data da procuração, titular do comprovante de residência, CIDs de laudos manuscritos) costumam estar justamente nessas páginas.

## Execução em lote — `analise-lote.js`, `indexa-autos.ps1`, `monta-rodada.ps1` e arquivo de andamento

Os arquivos ficam na pasta da skill, com o `confere-cadastro.ps1`. O script lê a tela e baixa os autos; o indexador extrai o texto do PDF no computador; o montador confere os relatórios e gera as linhas `R`, o CSV e os .zip (passo 6). Nenhum deles analisa: a análise, o relatório e as etiquetas seguem as seções acima, pela leitura do texto e das páginas digitalizadas. Antes do primeiro deles, gere `Relatórios/Analise_inicial_config.json` (ver "Como a configuração chega aos scripts").

**Arquivo de andamento.** Antes de abrir o primeiro processo, crie `Relatórios/Analise_inicial_AAAA-MM-DD_andamento.txt` (data da execução) com a lista da rodada; em execução com mais de uma rodada, as rodadas seguintes são acrescentadas ao mesmo arquivo. Uma linha por registro:

- `L|<posição no CSV ou na lista>|<processo>` — lista da rodada, gravada antes de começar;
- `T|<processo>|<linha do script>` — dados de tela, como o script os devolve (ver abaixo);
- `I|<processo>|<linha do indexador>` — páginas, digitalizadas, documentos e o que ficou fora do PDF;
- `R|<Fase de origem>|<Processo>|<Arquivo .zip>|<Perícia médica>|<Perícia social>|<CADASTRO>|<PREVENÇÃO>|<INCOMPETÊNCIA>|<EMENDAR>|<Designar perícia>|<Assessoria>|<CITAR>|<Assunto>` — gravada assim que o relatório individual do processo fica pronto, nas colunas do CSV de etiquetas;
- `N|<processo>|<motivo>` — processo que não pôde ser analisado.

O CSV da rodada é gerado das linhas `R` (e `N`, com as colunas de etiqueta em branco), nunca da memória da conversa. Se a execução parar, retome só com os processos da rodada sem linha `R` ou `N`.

**1. Carregar o script.** Na aba do PJe do grupo do Claude, abra `https://pje1g.trf5.jus.br/pje/js/pdfjs/web/locale/locale.json` (página estática do próprio PJe, que não redireciona). Pelo `javascript_tool`, crie um `<input type=file>` cujo `change` execute `(0, eval)(await i.files[0].text())`, localize-o com `find` e envie o `analise-lote.js` com `file_upload` — o script é carregado sem redigitação. Ele roda num iframe oculto, um processo por vez, com temporizador próprio (a aba pode ficar em segundo plano). Em seguida, passe a configuração: `window.__AI.config(<conteúdo de Relatórios/Analise_inicial_config.json>)`; a resposta confirma o órgão de cumprimento configurado.

**2. Passagem pelo PJe.** Só depois do "pode seguir" com a autorização de download do passo 1: `window.__AI.inicia([processos da rodada], base, true)` (`base` = posição do 1º processo − 1; `false` no último argumento lê a tela sem baixar). Sem o `config`, ele devolve "configure ... antes de iniciar" e não roda. Acompanhe com `__AI.estado()`; leia o resultado com `__AI.mostra(a, b)` e `get_page_text`. Grave no andamento com `__AI.salva(a, b)`: o script salva as linhas já no formato `T|...` em `Downloads\AI_tela_<hora>.txt`; acrescente o conteúdo ao andamento e mova o arquivo para `Downloads\Análise inicial\texto\` (é apagado na limpeza). Leva cerca de 15 segundos por processo, com o download.

Linhas de cada processo:
- cabeçalho: data e hora da leitura, tarefa atual, etiquetas, número de documentos não lidos e de documentos;
- `DET:` classe, assunto, autuação, valor da causa, segredo de justiça, justiça gratuita, tutela/liminar e prioridade, do menu de detalhes do cabeçalho;
- `PA:`, `PP:`, `OI:` — polo ativo, polo passivo e outros interessados, como estão na tela (`#poloAtivo`, `#poloPassivo`, `#outrosInteressados`), com CNPJ, qualidade e procuradorias;
- `CAD:` — `regular` ou `VERIFICAR — <o que difere do cadastro correto>`. É só um apontamento: o veredito oficial (REGULAR, IRREGULAR com a etiqueta de cancelar a distribuição, ou VERIFICAR) sai de `confere-cadastro.ps1` sobre as linhas `PP` e `OI`, como em "Verificação do cadastro das partes" — o agente não decide por conta própria. O script anota a presença do MPF como fiscal da lei em outros interessados (parte menor ou incapaz) sem acusá-la como desvio;
- `PDF:` — `<número>.pdf <MB> MB baixado`, ou `não baixado (motivo)`; chamar `inicia` de novo refaz só os processos sem download ou com erro;
- `IDS:` — todos os documentos do processo, para o indexador conferir com o PDF;
- `EXTRA <ID>` — teor dos documentos fora da cronologia (até 700 caracteres; o teor inteiro sai de `await __AI.texto(ID)`);
- `X|<processo>|<motivo>` — processo não encontrado ou autos que não abriram: vai para `N` no andamento.

Parada por login: peça ao usuário que se autentique e chame `inicia` de novo. Parada por 429 ("Acesso temporariamente bloqueado"): espere 10 minutos antes de retomar.

**3. Conferir e mover os PDFs** como no passo 2 da rotina (um `<número>.pdf` por processo; mover para `Downloads\Análise inicial\` sem sobrescrever).

**3-A. Veredito do cadastro.** Para cada processo, rode `pwsh -File .claude/skills/jef-analise-inicial/confere-cadastro.ps1 -Config "Relatórios/Analise_inicial_config.json" -Tela <arquivo de tela do processo>` (ou `-Andamento <arquivo>` para o lote) e grave o veredito (`REGULAR`, `IRREGULAR` ou `VERIFICAR`, com motivos) na linha `CADV|<processo>|...` do andamento. O agente que redige o relatório **recebe esse veredito pronto** e o reproduz; não classifica o cadastro por conta própria. O montador do CSV usa as linhas `CADV` e recusa o lote se algum relatório divergir do veredito. Ver "Verificação do cadastro das partes".

**4. Indexar.** `pwsh -File .claude/skills/jef-analise-inicial/indexa-autos.ps1 -Andamento "Relatórios/Analise_inicial_AAAA-MM-DD_andamento.txt"` (usa o `pdftotext` do Poppler instalado no computador; menos de 1 segundo por processo). Grave a linha que ele devolve para cada processo como `I|...` no andamento. Em `Downloads\Análise inicial\texto\` ficam, por processo:
- `<processo>.txt` — o texto integral, página a página, cada uma com o cabeçalho `=== p<página do PDF> | ID <ID> p.<n>` e a marca `[DIGITALIZADA]` nas páginas sem texto além do rodapé. É a fonte das citações "ID e página";
- `<processo>_indice.txt` — a capa (com a lista de documentos e seus tipos), as páginas de cada documento no PDF, os documentos da tela que ficaram **fora do PDF**, as **faixas de páginas digitalizadas** (até 20 páginas cada) e pistas de CID, de outros processos citados, de renúncia e de CEP, com ID e página. As pistas só apontam onde ler — não substituem a leitura.

**5. Ler.** Leia o `<processo>.txt` inteiro e leia visualmente, no PDF dos autos (`Downloads\Análise inicial\<processo>.pdf`), cada faixa de páginas digitalizadas do índice, com a ferramenta de leitura de arquivo (parâmetro de páginas). Documento fora do PDF: pela linha `EXTRA`. Daí em diante, relatório individual, CSV, entrega e limpeza, como na rotina.

**6. Montar as linhas R, o CSV e os .zip — `monta-rodada.ps1`** (pasta da skill). O montador lê a configuração (`-Config`), o andamento (linhas `L`, `T`, `CADV`, `R` e `N`), os relatórios e as linhas de etiquetas de cada processo, e:
- confere o relatório com o veredito do cadastro (`CADV`), a prevenção, as linhas "Etiqueta INCOMPETÊNCIA" e "Etiqueta EMENDAR" do quadro resumo e as etiquetas de perícia (só os nomes configurados em `Comum — Etiquetas de perícia médica` e `Comum — Perícia social`);
- calcula as colunas Designar perícia, Assessoria e CITAR pela fase lida na tela, pelo assunto (do CSV do PJe, quando informado, ou da tela) e pelos impedimentos, conforme "Etiquetas de encaminhamento";
- grava a linha `R` de cada processo que passou na conferência e lista as falhas, que não são gravadas, e os avisos, que são gravados mas devem ser conferidos.

Entradas, uma por processo:
- relatório `<pasta dos relatórios>\<processo>.md`, que começa com a linha `# Análise inicial — <processo>`;
- linha de etiquetas `<pasta das etiquetas>\<processo>.txt`, em UTF-8, com exatamente estas cinco linhas (valor vazio quando não houver etiqueta; a etiqueta tem de ser idêntica à do quadro resumo):
  ```
  MEDICA=<etiqueta de perícia médica ou vazio>
  SOCIAL=<etiqueta de perícia social ou vazio>
  PREVENCAO=<etiqueta_prevencao configurada, ou vazio>
  INCOMPETENCIA=<etiqueta_incompetencia configurada, ou vazio>
  EMENDAR=<etiqueta_emendar configurada, ou vazio>
  ```

Uso (PowerShell 7):
- conferir e gravar as linhas `R`: `pwsh -File .claude/skills/jef-analise-inicial/monta-rodada.ps1 -Config "Relatórios/Analise_inicial_config.json" -Andamento "<andamento>" -Mdr "<pasta dos relatórios>" -Rows "<pasta das etiquetas>" -DataAnalise AAAA-MM-DD -Servidores "Nome1:1-60;Nome2:61-120" -CsvOrigem "<CSV do PJe>"` (`-Refaz` regrava a `R` de relatório alterado);
- gerar o CSV e os .zip por servidor: o mesmo comando com `-Build`. Ele recusa o lote se faltar `R` ou `N` para algum processo da lista, ou se algum relatório divergir. Os arquivos vão para `Downloads\Análise inicial\` (ou para a pasta de `-Saida`), sem sobrescrever: havendo arquivo do mesmo nome, ganham sufixo `_2`, `_3`...

`-Servidores` diz, pela posição na lista (linhas `L`), em que .zip vai cada relatório.

Teste na 7ª Vara, em 09/10/2026, com 10 processos já analisados (cadastro regular e irregular, prevenção, etiquetas sociais por bairro, por município e fora das listas, etiquetas médicas de lote e sem etiqueta médica): leitura de tela e download dos 10 em cerca de 2 minutos e meio; o apontamento do cadastro bateu nos 10 (3 irregulares), as pistas de CID levaram às mesmas etiquetas médicas e as de outros processos cobriram os 5 com prevenção; em 2 processos, a decisão de redistribuição por prevenção só foi encontrada fora do PDF.
