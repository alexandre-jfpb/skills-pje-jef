---
name: "jef-expediente-manifestacao"
description: "Triagem de expedientes do PJe (Laudo C/D, Planilha de Cálculo, Diligência, LOAS Social, Incapacidade, Limitação, CEJUSC, Citados, propostas de acordo, controle de prazo de contestação, Laudo (assessoria) e esclarecimento/constatação de endereço) a partir de CSV ou lista de processos, com as etiquetas, ações e áreas de perícia social da configuração da unidade que a instalou (PJe 1º grau do TRF5)."
---

# Triagem de Laudo C, Laudo D, Planilha de Cálculo, Diligência, LOAS Social, Incapacidade, Limitação, CEJUSC, Citados, Conhecimento-Proposta, Perícia-Proposta, Audiência-Proposta, Contestação Automática, Contestação, Laudo (Assessoria), Esclarecer Localização (Perícia Social) e Endereço (Cumprimento) no PJe

Desenvolvida na 7ª Vara Federal da Paraíba. Os nomes das etiquetas, das ações, das tarefas do PJe, das áreas de perícia social e dos assessores são os da unidade, lidos de `docs/configuracao-unidade.md` (ver "Configuração da unidade — antes de tudo").

Use quando o usuário fornecer um CSV exportado de uma fila do PJe 1º grau/TRF5, ou informar diretamente na conversa uma lista de processos, e pedir a análise, a triagem ou a classificação.

## Limite de atuação — leia antes de tudo

Esta skill **lê e diagnostica**. A única gravação autorizada no PJe é clicar em **MARCAR TODOS COMO LIDOS** quando houver documentos pendentes de leitura.

Nunca, em hipótese alguma:
- inserir ou retirar etiqueta;
- movimentar processo ou encaminhar para outra fase;
- preencher minuta, selecionar tipo de documento ou clicar em ASSINAR DOCUMENTO(S);
- digitar senha, certificado, token ou PIN. Aparecendo tela de login, pare e avise.

As colunas de etiqueta da planilha são **prescrição para quem vai executar**, não registro de ação feita.

Todo o resto desta skill deve ser mantido intacto de uma versão para a outra: nenhuma alteração além da que o usuário pediu expressamente deve ser feita sem consulta prévia.

## Configuração da unidade — antes de tudo

Os dados próprios da unidade — o nome das etiquetas analisadas e das etiquetas a prescrever, as ações, as tarefas do PJe de onde vêm os CSVs, as áreas da perícia social e a distribuição da assessoria — não estão nesta skill: ficam em `docs/configuracao-unidade.md`, na pasta do projeto. As regras de classificação ficam aqui; elas refletem as decisões da 7ª Vara Federal da Paraíba, onde a skill foi desenvolvida, e devem ser revistas pela unidade antes do uso com processos reais.

1. Leia `docs/configuracao-unidade.md` no início de toda execução, antes da confirmação de quantitativos — nunca de memória, nunca de cópia antiga anexada à conversa.
2. Se o arquivo não existir, crie-o com o título `# Configuração da unidade`. Ele nunca vem no pacote da skill; se já existir (criado por outra skill), não o sobrescreva: acrescente só as seções e os itens que faltarem, sem apagar nem alterar os de outras skills.
3. Se faltar alguma das seções ou chaves listadas em "Perguntas da configuração", ou se houver item ou célula `PENDENTE` (ou vazia), **pare antes de abrir qualquer processo** e faça ao usuário as perguntas que faltam, todas de uma vez, agrupadas por seção, explicando o que é cada item. Grave as respostas no arquivo, mostre o resumo do que ficou gravado e peça o "pode seguir". Com item ainda `PENDENTE`, não comece a análise.
4. Seção comum (`## Comum — ...`) já preenchida por outra skill: reaproveite, sem perguntar de novo. Se ela já existir com outro nome de chave para o mesmo dado, use o item existente e não crie duplicata; pergunte e acrescente só as chaves que faltarem.
5. Nunca use valor que não esteja no arquivo; nunca presuma nem use os valores da 7ª Vara, nem os exemplos abaixo, que são fictícios. Se, no meio da execução, faltar um dado, pare, pergunte e grave a resposta no arquivo.
6. O arquivo pode ser editado à mão pela unidade a qualquer momento; vale o que estiver nele na hora da leitura.

**Como as referências aparecem no corpo da skill.**
- `Comum — <seção>.<chave>` é o item `<chave>` da seção comum `## Comum — <seção>` (ex.: `Comum — Assessores.assessor_por_digito`).
- `[etiqueta X]` é a etiqueta analisada da rotina de código `X` — a linha `X` da tabela `etiquetas_analisadas` da seção `## jef-expediente-manifestacao`. Os códigos são os do script: `C`, `D`, `PC`, `DIL`, `LOAS`, `INC`, `LIM`, `CEJ`, `CIT`, `CP`, `PP`, `AP`, `CA`, `CT`, `LA`, `EL`, `EC`.
- `[C.sem_proposta]` (e as demais chaves com ponto) é a linha dessa chave nas tabelas de saída da seção `## jef-expediente-manifestacao`. A Ação da linha vai para a coluna E do relatório, a Etiqueta controle para a F e a Etiqueta secretaria para a G, escritas exatamente como estão no arquivo. Célula `—` fica em branco no relatório. Célula que remete a uma seção comum (`Comum — Assessores...`, `Comum — Perícia social...`) recebe o valor que a regra da rotina tira dessa seção.
- A coluna Perícia social (H) recebe sempre uma das etiquetas da tabela `zonas` de `## Comum — Perícia social (zonas, bairros e municípios)`.

### Perguntas da configuração

Os exemplos são **fictícios**, só para mostrar o formato; nunca os use como resposta.

**Seção `## Comum — Unidade`** (compartilhada com as demais skills)

| Chave | Pergunta | Exemplo (fictício) |
|---|---|---|
| `nome_unidade` | Qual é o nome da unidade? | `9ª Vara Federal de Cidade Exemplo` |
| `secao_subsecao` | De qual seção e subseção judiciária? | `Seção Judiciária de Exemplo — Subseção de Cidade Exemplo` |
| `codigo_orgao` | Quais são os 4 últimos dígitos do número dos processos da unidade (código do órgão, campo "NumeroOrgaoJustica" da consulta processual)? | `9999` (em `0000000-00.2026.4.05.9999`) |
| `tribunal` | Qual é o tribunal? Esta skill só funciona no PJe 1º grau do TRF5. | `TRF5` |
| `cidade_uf` | Cidade e UF da sede da unidade. | `Cidade Exemplo/XX` |

Nesta skill são usados o `codigo_orgao` (consulta processual) e o `tribunal` (que tem de ser `TRF5`); os demais servem às outras skills e ao cabeçalho do relato.

**Seção `## Comum — Assessores`** (compartilhada; reaproveite o que já estiver preenchido)

| Chave | Pergunta | Exemplo (fictício) |
|---|---|---|
| `assessor_por_digito` | Tabela: para cada último dígito do número sequencial do processo (o dígito imediatamente antes do dígito verificador, de 0 a 9), a etiqueta do assessor que recebe os processos de benefício por incapacidade. Os dez dígitos têm de estar na tabela. | ver abaixo |
| `assessor_agricultor` | Etiqueta do assessor que recebe os processos de parte autora agricultora (ou pescadora artesanal, pescadora profissional ou catadora de mariscos, equiparadas). Responda `não se aplica` se a unidade não separa esses processos: eles seguem, então, para a distribuição por dígito. | `ASSESSORIA - Gabinete B` |
| `assessor_salario_maternidade` | Etiqueta do assessor que recebe os processos de salário-maternidade. Responda `não se aplica` se a unidade não separa esse assunto (segue, então, para o passo seguinte da ordem de verificação). Se a seção já tiver `assessor_salario_maternidade_pensao_reclusao` (uma só etiqueta para os três assuntos, gravada por outra skill), não pergunte esta chave nem as duas seguintes: use esse valor para os três assuntos (ver a ordem de verificação, na Rotina Diligência). | `ASSESSORIA - Gabinete A` |
| `assessor_pensao_morte` | Idem, para pensão por morte. (Não pergunte se a seção já tiver `assessor_salario_maternidade_pensao_reclusao`.) | `ASSESSORIA - Gabinete A` |
| `assessor_auxilio_reclusao` | Idem, para auxílio-reclusão. (Não pergunte se a seção já tiver `assessor_salario_maternidade_pensao_reclusao`.) | `ASSESSORIA - Gabinete A` |

Formato da tabela `assessor_por_digito` no arquivo (linha `- assessor_por_digito: tabela abaixo`, seguida da tabela; exemplo fictício):

```
- assessor_por_digito: tabela abaixo

| Último dígito | Etiqueta do assessor |
|---|---|
| 0 | ASSESSORIA - Gabinete C |
| 1 | ASSESSORIA - Gabinete C |
| ... | ... |
| 9 | ASSESSORIA - Gabinete E |
```

**Seção `## Comum — Perícia social (zonas, bairros e municípios)`** (compartilhada; reaproveite o que já estiver preenchido)

| Chave | Pergunta | Exemplo (fictício) |
|---|---|---|
| `zonas` | Tabela: cada etiqueta de área da perícia social usada pela unidade (zona da cidade, grupo de bairros ou grupo de municípios atendidos por uma assistente social), com o nome exato da etiqueta no PJe, o tipo (`bairro`, quando a etiqueta é definida pelo bairro do endereço; `município`, quando é definida pelo município) e os bairros ou municípios que ela abrange, separados por `;`. | ver abaixo |
| `etiqueta_fora_das_listas` | Etiqueta de controle para o endereço cujo bairro ou município não está em nenhuma área da tabela (o endereço será constatado antes da perícia). | `SOCIAL_CONSTATAR` |

Formato da tabela `zonas` no arquivo (exemplo fictício):

```
- zonas: tabela abaixo

| Etiqueta | Tipo | Bairros ou municípios |
|---|---|---|
| ZONA EXEMPLO 1 | bairro | Centro; Bairro Exemplo; Vila Exemplo |
| ZONA EXEMPLO 2 | bairro | Bairro Alfa; Bairro Beta; Município Vizinho |
| Município A/Município B - AS Exemplo | município | Município A; Município B |
```

Município inteiro atendido por uma etiqueta de zona (ex.: cidade vizinha incluída numa zona) entra na mesma linha, pelo nome do município. A seção comum tem ainda o item `municipios_por_bairro`, usado por outra skill da família; esta skill não o usa nem pergunta por ele (se já estiver gravado, deixe-o como está).

**Seção `## jef-expediente-manifestacao`** (própria desta skill)

| Chave | Pergunta | Exemplo (fictício) |
|---|---|---|
| `tarefas_de_origem` | De quais tarefas (filas) do PJe a unidade exporta os CSVs desta triagem? Só informativo: aparece na confirmação. | `Prazos - Resposta recebida; Prazos - Prazo vencido` |
| `etiquetas_analisadas` | Tabela: para cada rotina, o nome exato, no cadastro do PJe, da etiqueta que indica que o processo está nessa situação. Rotina que a unidade não usa: responda `não usa` (os processos dela não são separados nem analisados). | ver abaixo |
| tabelas de saída (`saidas_*`) | Para cada linha: a **Ação** (o que a secretaria deve fazer, em poucas palavras), a **Etiqueta controle** e a **Etiqueta secretaria**, com o nome exato do cadastro do PJe. A coluna Situação diz quando a linha se aplica; ela é a regra da skill e não se altera. Onde a unidade não usa etiqueta, responda `—`. Células já preenchidas com `—` ou com referência a uma seção comum são fixas. Várias linhas podem ter o mesmo valor: repita-o. | `remeter à conclusão` / `CTRL_CONCLUIR` / `GAB - Minutar sentença` |

Formato da tabela `etiquetas_analisadas` no arquivo (a coluna Situação explica cada rotina; preencha a última):

```
- etiquetas_analisadas: tabela abaixo

| Código | Rotina | Situação | Etiqueta analisada |
|---|---|---|---|
| C | Laudo C | laudo médico com limitação leve, aguardando manifestação sobre o laudo | PENDENTE |
| D | Laudo D | laudo médico sem limitação, aguardando manifestação sobre o laudo | PENDENTE |
| PC | Planilha de Cálculo | execução: aguardando manifestação sobre a planilha de cálculo | PENDENTE |
| DIL | Diligência | julgamento convertido em diligência | PENDENTE |
| LOAS | LOAS Social | laudo médico favorável em benefício assistencial: designar perícia social | PENDENTE |
| INC | Incapacidade | laudo com incapacidade para auxílio, aposentadoria ou LOAS (prioridade), aguardando manifestação | PENDENTE |
| LIM | Limitação | laudo com limitação moderada ou grave, aguardando manifestação | PENDENTE |
| CEJ | CEJUSC | aguardando decurso do prazo de citação, com encaminhamento ao CEJUSC | PENDENTE |
| CIT | Citados | aguardando prazo depois do auto de constatação (citados) | PENDENTE |
| CP | Conhecimento-Proposta | fase de conhecimento: parte autora intimada sobre proposta de acordo | PENDENTE |
| PP | Perícia-Proposta | fase de perícia: parte autora intimada sobre proposta de acordo | PENDENTE |
| AP | Audiência-Proposta | fase de audiência: aguardando o prazo da proposta de acordo | PENDENTE |
| CA | Contestação Automática | controle de prazo para contestação automática | PENDENTE |
| CT | Contestação | controle de prazo para contestação | PENDENTE |
| LA | Laudo (Assessoria) | laudo encaminhado à assessoria | PENDENTE |
| EL | Esclarecer Localização (Perícia Social) | parte autora intimada a esclarecer a localização do imóvel para a perícia social | PENDENTE |
| EC | Endereço (Cumprimento) | cumprimento: parte autora intimada a informar o endereço | PENDENTE |
```

Formato das tabelas de saída no arquivo — uma por rotina ou grupo de rotinas simétricas, cada uma precedida da linha `- saidas_<grupo>: tabela abaixo`. A skill grava estas tabelas tal como estão aqui e o usuário preenche as células `PENDENTE`:

```
- saidas_gerais: tabela abaixo

| Chave | Situação | Ação | Etiqueta controle | Etiqueta secretaria |
|---|---|---|---|---|
| geral.proposta_intimar | Proposta de acordo do INSS ainda sem manifestação da parte autora: intimar a parte (regra geral de todas as rotinas, salvo LOAS). Vale também para a contraproposta do autor nas rotinas C, D, CEJ e CIT, com intimação do INSS. Na origem, a etiqueta secretaria é a mesma etiqueta analisada da rotina AP. | PENDENTE | PENDENTE | PENDENTE |
| geral.proposta_aceita | Proposta de acordo aceita pela parte autora: concluir para homologação (todas as rotinas, inclusive LOAS). | PENDENTE | PENDENTE | PENDENTE |
| geral.direcao_analisar | INDEFINIDO e AVISO, em qualquer rotina: decisão humana da direção (só etiqueta controle). | — | PENDENTE | — |

- saidas_C_D: tabela abaixo

| Chave | Situação | Ação | Etiqueta controle | Etiqueta secretaria |
|---|---|---|---|---|
| C.sem_proposta | Rotina C sem proposta de acordo (inclui a impossibilidade de acordo e qualquer petição que não seja proposta): concluir para minutar sentença, com a assessoria do laudo C. | PENDENTE | PENDENTE | PENDENTE |
| D.sem_proposta | Rotina D sem proposta de acordo: idem, com a assessoria do laudo D. | PENDENTE | PENDENTE | PENDENTE |
| CD.recusada | Rotinas C e D, proposta recusada pela parte autora: designar audiência de conciliação (CEJUSC). | PENDENTE | PENDENTE | PENDENTE |

- saidas_PC: tabela abaixo

| Chave | Situação | Ação | Etiqueta controle | Etiqueta secretaria |
|---|---|---|---|---|
| PC.impugnacao | Impugnação ou discordância (inclusive parcial) da planilha de cálculo: analisar a impugnação. | PENDENTE | PENDENTE | — |
| PC.outra_peticao | Qualquer outra petição (concordância, decurso, pedido só de destaque de honorários etc.): seguir para a expedição de RPV. | PENDENTE | PENDENTE | — |

- saidas_DIL: tabela abaixo

| Chave | Situação | Ação | Etiqueta controle | Etiqueta secretaria |
|---|---|---|---|---|
| DIL.recusada | Proposta do INSS depois do despacho, recusada pela parte autora: concluir para julgamento. | PENDENTE | PENDENTE | — |
| DIL.1a | Parte autora já se manifestou; aguarda vista ao INSS: intimar o INSS. | PENDENTE | PENDENTE | — |
| DIL.1b | Parte autora omissa: concluir. | PENDENTE | PENDENTE | — |
| DIL.1c | Parte autora pede dilação de prazo: aguardar a dilação (também usada nas rotinas EL e EC). | PENDENTE | PENDENTE | — |
| DIL.1d | INSS manifestou-se ou prazo decorrido: concluir. | PENDENTE | PENDENTE | — |
| DIL.2a | INSS ou CEAB já se manifestou; aguarda vista à parte autora: intimar a parte autora. | PENDENTE | PENDENTE | — |
| DIL.2b | INSS ou CEAB omisso: concluir para decisão. | PENDENTE | PENDENTE | — |
| DIL.2c | Parte autora manifestou-se ou prazo decorrido: concluir; etiqueta secretaria pela ordem de verificação do assessor. | PENDENTE | PENDENTE | Comum — Assessores (ordem de verificação) |
| DIL.3 | Conclusão direta, independente de manifestação: concluir. | PENDENTE | PENDENTE | — |

- saidas_LOAS: tabela abaixo

| Chave | Situação | Ação | Etiqueta controle | Etiqueta secretaria |
|---|---|---|---|---|
| LOAS.com_proposta | Proposta do INSS ainda sem manifestação da parte autora (exceção à regra geral, só nesta rotina): intimar. Na origem, a etiqueta secretaria é a mesma etiqueta analisada da rotina PP. | PENDENTE | PENDENTE | PENDENTE |
| LOAS.renda_atendida | Sem proposta, renda per capita atendida: concluir. | PENDENTE | PENDENTE | Comum — Assessores.assessor_por_digito |
| LOAS.endereco_esclarecer | Sem proposta, endereço não localizável nos autos: esclarecer o endereço. | PENDENTE | PENDENTE | — |
| LOAS.endereco_area | Sem proposta, endereço numa área da perícia social: designar a perícia social (coluna Perícia social: a etiqueta da área). | PENDENTE | PENDENTE | — |
| LOAS.endereco_fora | Sem proposta, endereço fora de todas as áreas: constatar o endereço (etiqueta controle sozinha, nunca com a de LOAS.endereco_area). | PENDENTE | Comum — Perícia social.etiqueta_fora_das_listas | — |

- saidas_INC_LIM: tabela abaixo

| Chave | Situação | Ação | Etiqueta controle | Etiqueta secretaria |
|---|---|---|---|---|
| INC_LIM.agricultor | Rotinas INC e LIM, sem proposta, profissão agricultor(a) ou equiparada: concluir. | PENDENTE | PENDENTE | Comum — Assessores.assessor_agricultor |
| INC_LIM.outra_profissao | Rotinas INC e LIM, sem proposta, outra profissão: concluir. | PENDENTE | PENDENTE | Comum — Assessores.assessor_por_digito |

- saidas_CEJ_CIT: tabela abaixo

| Chave | Situação | Ação | Etiqueta controle | Etiqueta secretaria |
|---|---|---|---|---|
| CEJ_CIT.recusada | Proposta recusada pela parte autora: designar audiência de conciliação (CEJUSC). | PENDENTE | PENDENTE | PENDENTE |
| CEJ_CIT.miserabilidade_elevada | Sem proposta, assunto Pessoa com Deficiência ou Idoso, fotos com miserabilidade elevada: designar audiência de conciliação (CEJUSC). | PENDENTE | PENDENTE | PENDENTE |
| CEJ_CIT.miserabilidade_nao_elevada | Sem proposta, assunto Pessoa com Deficiência ou Idoso, miserabilidade não elevada: concluir. | PENDENTE | PENDENTE | Comum — Assessores.assessor_por_digito |
| CEJ_CIT.agricultor | Sem proposta, outro assunto, profissão agricultor(a) ou equiparada: concluir. | PENDENTE | PENDENTE | Comum — Assessores.assessor_agricultor |
| CEJ_CIT.outra_profissao | Sem proposta, outro assunto, outra profissão: concluir. | PENDENTE | PENDENTE | Comum — Assessores.assessor_por_digito |

- saidas_CP_PP_AP: tabela abaixo

| Chave | Situação | Ação | Etiqueta controle | Etiqueta secretaria |
|---|---|---|---|---|
| CP_PP_AP.nao_aceita | Proposta não aceita (recusa expressa ou prazo sem manifestação): designar audiência de conciliação (CEJUSC). | PENDENTE | PENDENTE | PENDENTE |

- saidas_CA_CT: tabela abaixo

| Chave | Situação | Ação | Etiqueta controle | Etiqueta secretaria |
|---|---|---|---|---|
| CA_CT.sem_proposta | Sem proposta de acordo: concluir (a etiqueta do assessor já está no processo). | PENDENTE | PENDENTE | — |

- saidas_LA: tabela abaixo

| Chave | Situação | Ação | Etiqueta controle | Etiqueta secretaria |
|---|---|---|---|---|
| LA.recusada | Proposta recusada pela parte autora: designar audiência de conciliação (CEJUSC). | PENDENTE | PENDENTE | PENDENTE |
| LA.miserabilidade_elevada | Sem proposta, fotos com miserabilidade elevada: designar audiência de conciliação (CEJUSC). | PENDENTE | PENDENTE | PENDENTE |
| LA.miserabilidade_nao_elevada | Sem proposta, miserabilidade não elevada: concluir. | PENDENTE | PENDENTE | Comum — Assessores.assessor_por_digito |

- saidas_EL_EC: tabela abaixo

| Chave | Situação | Ação | Etiqueta controle | Etiqueta secretaria |
|---|---|---|---|---|
| EL.endereco_area | Rotina EL, endereço informado numa área da perícia social: registrar o esclarecimento de endereço (coluna Perícia social: a etiqueta da área). | PENDENTE | PENDENTE | PENDENTE |
| EL.endereco_fora | Rotina EL, endereço informado fora de todas as áreas: registrar o esclarecimento de endereço (etiqueta controle sozinha, nunca com a de EL.endereco_area). | PENDENTE | Comum — Perícia social.etiqueta_fora_das_listas | — |
| EC.endereco_informado | Rotina EC, endereço informado: expedir mandado de constatação. | PENDENTE | PENDENTE | PENDENTE |
| EL_EC.omissa | Rotinas EL e EC, parte autora omissa: concluir para decisão. | PENDENTE | PENDENTE | — |
```

Nas rotinas EL e EC, o pedido de dilação de prazo usa a linha `[DIL.1c]` (mesmo procedimento da Rotina Diligência); a proposta de acordo usa as linhas `geral.*`, salvo a exceção `[LOAS.com_proposta]`.

### Como a configuração chega ao script

O `analise-lote.js` usa um só dado da unidade: a etiqueta do assessor por dígito, que ele mostra na linha `ASSUNTO` do resumo. Os nomes das etiquetas analisadas não vão ao script: a lista leva o código da rotina (`C`, `D`, `PC`...), que você tira da etiqueta do CSV comparando-a com `etiquetas_analisadas`. Depois de carregar o script (passo 1 de "Execução em lote") e antes do `inicia`, monte o objeto a partir da tabela `assessor_por_digito` da seção `## Comum — Assessores`, copiando cada etiqueta tal como gravada (sem reescrever nem abreviar), e passe-o numa chamada do javascript_tool:

```js
window.__EM.config({ assessorPorDigito: { '0': '<etiqueta do dígito 0>', '1': '<etiqueta do dígito 1>', /* ... */ '9': '<etiqueta do dígito 9>' } })
```

A chamada devolve quantos dígitos ficaram configurados. Sem ela, ou com algum dos dez dígitos faltando, o `inicia` não roda e devolve `configure ... antes de iniciar`. A configuração fica no próprio `window.__EM`; se a aba recarregar e o `window.__EM` sumir, carregue o script e chame o `config` de novo.

## Acesso ao PJe — usar o Chrome (extensão)

O acesso ao PJe nesta skill é sempre pelo **Chrome (extensão)** — o navegador real do usuário, onde ele já está autenticado —, nunca pelo navegador embutido do Claude Code. Não abra o PJe no navegador embutido nem peça autenticação nele.

## Entrada — CSV ou lista de processos na conversa

Os processos a analisar podem chegar de duas formas, e ambas são igualmente válidas:

**A) CSV exportado do PJe.** O arquivo é gerado no PJe: Painel do usuário → coluna **TAREFAS** (não "Minhas tarefas") → ícone de seta à esquerda do nome da fase.

Se o usuário pedir uma nova análise sem anexar um novo CSV neste pedido, use o **último CSV que ele forneceu nesta conversa** — não peça o arquivo de novo. Deixe explícito, na etapa de confirmação dos quantitativos (abaixo), que está reaproveitando o CSV anterior, citando o nome do arquivo e em que ponto da conversa foi fornecido. Se nenhum CSV tiver sido fornecido em nenhum momento da conversa, e o usuário também não informar uma lista de processos, peça o CSV ou a lista antes de prosseguir — não presuma.

Leia com separador `;` e encoding `utf-8-sig`. Campos usados: `numeroProcesso`, `poloAtivo`, `assuntoPrincipal`, `prioridade`, `sigiloso`, `diasChegada`, `descricaoUltimoMovimento`, `nomeTarefa`, `tagsProcessoList`.

As etiquetas vêm todas em `tagsProcessoList`, separadas por vírgula. Um processo pode ter várias, então a soma por etiqueta não fecha com o total de linhas.

**Atenção ao separar:** uma etiqueta configurada pode ter vírgula dentro do próprio nome (ex. fictício: `Perícia - Laudo favorável (AD, AI ou BPC)`). Separar `tagsProcessoList` ingenuamente por vírgula e comparar cada pedaço quebra essa etiqueta ao meio e faz a rotina dela nunca ser reconhecida. Para comparar um processo com qualquer uma das dezessete etiquetas analisadas configuradas, verifique se o texto completo da etiqueta aparece como substring de `tagsProcessoList` (ignorando caixa) — não separe primeiro e compare depois.

O campo `sigiloso` do CSV é a única fonte para marcar um processo como sigiloso nesta skill. Nome abreviado no cabeçalho dos autos no PJe (por exemplo, iniciais da parte) **não é sinal de segredo de justiça** — indica apenas que há menor como parte no processo. Nunca infira sigilo a partir disso; use exclusivamente o valor do campo `sigiloso`.

Aproveite o CSV para preencher as colunas B e K a P — não é preciso reler esses dados no PJe. A coluna B sai de `nomeTarefa`.

**B) Lista de processos informada na conversa** — números digitados ou colados diretamente no chat, sem um CSV novo anexado a este pedido.

**Passo obrigatório e sempre o primeiro, antes de qualquer outra coisa — inclusive antes de abrir uma pergunta ao usuário (por texto ou por múltipla escolha) sobre etiqueta, rotina, ou qualquer outro dado desses processos:** verifique se cada um desses números consta de um CSV já fornecido nesta conversa (o mais recente, pelo campo `numeroProcesso`). Isso vale mesmo que a lista pareça grande, mesmo que a etiqueta pareça óbvia pelo contexto da conversa, e mesmo que já exista uma pergunta "padrão" prevista para este ponto da rotina — a consulta ao CSV sempre vem antes, sem exceção. Só depois de concluída essa consulta — e só para os processos que ela não resolveu — é que uma pergunta ao usuário pode ser aberta.

- Para os processos que constarem desse CSV, use os dados de lá exatamente como no caminho do CSV — etiqueta (`tagsProcessoList`), fase de origem (`nomeTarefa`), e as demais colunas B e K a P. **Não pergunte a etiqueta desses processos ao usuário**: ela já está no arquivo.
- Só para os processos colados que não constarem de nenhum CSV já fornecido — ou se nenhum CSV tiver sido fornecido ainda nesta conversa — pergunte ao usuário qual etiqueta cada um carrega (Laudo C, Laudo D, Planilha de Cálculo, Convertidos em diligência, LOAS Social, Incapacidade, Limitação, CEJUSC, Citados, Conhecimento-Proposta, Perícia-Proposta, Audiência-Proposta, Contestação Automática, Contestação, Laudo (assessoria), Esclarecer localização - perícia social ou Aguardando manifestação - endereço) e qual a fase de origem — não presuma, e não abra o processo no PJe para descobrir: nesta fase, etiqueta e fase de origem vêm só da resposta do usuário. As demais colunas desses processos (K a P: parte autora, assunto, prioridade, sigilo, dias na fase, último movimento) só são coletadas mais adiante, quando o processo for aberto para a classificação (depois da confirmação de quantitativos, abaixo) — nunca antes dela.
- Para o sigilo, em qualquer dos dois casos, considere apenas o campo `sigiloso` do CSV (quando o processo constar dele) ou a classificação de segredo de justiça efetivamente registrada no processo (quando obtida diretamente dos autos) — nome abreviado no cabeçalho não é sigilo, indica só menor como parte.
- Na confirmação de quantitativos (abaixo), informe quantos processos da lista colada foram identificados a partir do CSV (citando o nome do arquivo) e quantos exigiram pergunta ao usuário ou consulta direta aos autos.

Fora essa origem dos dados, o restante da rotina — confirmação prévia, abertura dos autos, classificação, entregável — é idêntico ao caminho do CSV.

Em qualquer uma das duas formas, **separe os processos em dezessete listas**, comparando etiquetas ignorando caixa (a grafia da mesma etiqueta pode variar na caixa, ex.: "Perícia" e "PERÍCIA"). A etiqueta de cada rotina é a configurada na tabela `jef-expediente-manifestacao.etiquetas_analisadas`; rotina marcada `não usa` não tem lista:
- **Rotina C** — `[etiqueta C]`
- **Rotina D** — `[etiqueta D]`
- **Rotina Planilha de Cálculo** — `[etiqueta PC]`
- **Rotina Diligência** — `[etiqueta DIL]`
- **Rotina LOAS Social** — `[etiqueta LOAS]`
- **Rotina Incapacidade** — `[etiqueta INC]`
- **Rotina Limitação** — `[etiqueta LIM]`
- **Rotina CEJUSC** — `[etiqueta CEJ]`
- **Rotina Citados** — `[etiqueta CIT]`
- **Rotina Conhecimento-Proposta** — `[etiqueta CP]`
- **Rotina Perícia-Proposta** — `[etiqueta PP]`
- **Rotina Audiência-Proposta** — `[etiqueta AP]`
- **Rotina Contestação Automática** — `[etiqueta CA]`
- **Rotina Contestação** — `[etiqueta CT]`
- **Rotina Laudo (Assessoria)** — `[etiqueta LA]`
- **Rotina Esclarecer Localização (Perícia Social)** — `[etiqueta EL]`
- **Rotina Endereço (Cumprimento)** — `[etiqueta EC]`

## Confirmação antes de analisar — parada obrigatória

Nesta fase, nenhum processo é aberto no PJe — nem para determinar etiqueta, nem por qualquer outro motivo. Os quantitativos vêm inteiramente do CSV (campo `tagsProcessoList`), inclusive quando o usuário colar apenas uma lista de números referentes a um CSV já fornecido; para os poucos processos colados sem CSV correspondente, vêm da etiqueta que o próprio usuário informou (ver Entrada, acima). Consultar o PJe nesta fase — mesmo que pareça mais rápido, ou que a etiqueta pareça óbvia pelo contexto da conversa — é sempre um desvio da rotina.

Depois de receber a lista de processos — por CSV ou pela conversa — e **antes de abrir qualquer processo**, informe os quantitativos e **espere a confirmação do usuário**. Não siga por conta própria.

Apresente assim:
- origem da lista: CSV novo, CSV reaproveitado (informe o nome do arquivo e quando foi fornecido), ou lista colada na conversa — neste último caso, informe quantos processos foram identificados a partir do CSV mais recente (citando o nome do arquivo) e quantos exigiram pergunta ao usuário ou consulta direta aos autos; quando houver CSV, informe também o total de linhas e a fase de origem identificada (as tarefas de `jef-expediente-manifestacao.tarefas_de_origem` são só referência);
- quantos processos com cada etiqueta analisada configurada — uma linha por rotina usada, na ordem da lista acima, com o nome exato da etiqueta tirado de `jef-expediente-manifestacao.etiquetas_analisadas` (ex. de formato: "quantos processos com `[etiqueta C]`");
- quantos com mais de uma dessas etiquetas ao mesmo tempo, se houver, listados um a um;
- variantes de grafia encontradas, se houver;
- estimativa de esforço: pelo script de lote (abaixo), um processo por vez, a leitura leva cerca de 6 a 10 segundos por processo, mais o tempo de conferir cada resumo, de ler na tela o que o script não lê (fotos do laudo social, documentos ilegíveis) e as paradas para login, se a sessão do PJe expirar.

Só comece a análise com o "pode seguir" do usuário. Se ele pedir para analisar apenas uma das rotinas, ou um subconjunto, respeite.

Processo com mais de uma dessas etiquetas nunca é decidido por você: pergunte por qual rotina deve seguir.

## Progresso durante a execução — informe obrigatório a cada 20 processos

Ao completar o 20º processo analisado (contagem cumulativa de todas as rotinas em execução), registre uma mensagem de progresso parcial: quantos já foram analisados do total confirmado, e a divisão parcial por classificação até aquele ponto (por rotina).

Essa mensagem precisa ficar registrada no histórico da conversa — não pode apenas surgir na tela e desaparecer sozinha, como uma notificação passageira. Se a sessão em execução dispuser de uma ferramenta própria para enviar mensagem ao usuário (distinta do texto informal que aparece entre uma chamada de ferramenta e outra), use-a para postar o informe: esse é o caminho que garante o registro permanente. Não havendo essa ferramenta, encerre a resposta corrente com o informe como último conteúdo do turno, e só retome a análise dos próximos processos numa resposta seguinte — nunca poste o informe como comentário de passagem entre duas chamadas de ferramenta dentro da mesma resposta, pois esse texto tende a não ficar registrado no histórico.

Isso é apenas um informe, **não uma parada para confirmação**: diferente da confirmação de quantitativos, acima, aqui não se espera resposta do usuário nem "pode seguir" antes de prosseguir para o próximo processo.

Repita a cada novo múltiplo de 20 (20, 40, 60, 80...) até terminar. Não acumule várias rodadas de 20 sem reportar.

Se, mesmo seguindo essas instruções, o informe continuar aparecendo e sumindo da tela sem deixar registro, isso pode ser uma limitação da interface em manter texto emitido durante a execução — fora do alcance desta skill para corrigir sozinha. Nesse caso, sinalize a suspeita ao usuário no relato final, sem afirmar a causa com certeza.

Se, por qualquer motivo, a análise chegar ao fim sem ter passado por esses informes intermediários, isso é um desvio da rotina: sinalize esse desvio explicitamente ao usuário junto do relato final, em vez de simplesmente omiti-lo.

O relato completo de conclusão de cada rotina segue à parte, na seção Ao terminar.

## Como abrir cada processo

Use a **consulta processual**, não a fila. A consulta não vincula tarefa a ninguém e não altera estado.

1. `https://pje1g.trf5.jus.br/pje/Processo/ConsultaProcesso/listView.seam`
2. O número é preenchido em campos separados. Ids: `fPP:numeroProcesso:numeroSequencial`, `:numeroDigitoVerificador`, `:Ano`, `:NumeroOrgaoJustica` (os 4 últimos dígitos do número; nos processos da unidade, o `Comum — Unidade.codigo_orgao`). Ramo (4) e tribunal (05) já vêm preenchidos. Botão: `fPP:searchProcessos`.
3. Clique no número no resultado. Os autos abrem em janela nova — redirecione `window.open` para a mesma aba antes de clicar, senão a janela fica fora de alcance.
4. A cronologia sai em texto do próprio documento (não está em iframe).

O campo de filtro do Painel não aceita digitação automatizada; o da consulta e o de dentro da fase aceitam.

Esse caminho manual serve para conferir um processo na tela. O lote roda pelo script abaixo.

## Execução em lote — script `analise-lote.js` e arquivo de andamento

A leitura dos processos roda pelo script `analise-lote.js`, que fica nesta pasta da skill. Ele faz o mesmo caminho da seção anterior (consulta processual → autos), acha o marco de cada rotina — o laudo (C, D, LOAS Social, Incapacidade, Limitação), o cálculo da contadoria ou a petição do INSS com cálculo (Planilha de Cálculo; nunca a planilha que o próprio autor junta com a petição dele nem a "Resposta aos cálculos"), o último despacho (Diligência), a proposta do INSS (Conhecimento-, Perícia- e Audiência-Proposta), a intimação para informar a localização do imóvel (Esclarecer Localização e Endereço) ou, nas demais, o último laudo ou auto de constatação — e lê os documentos juntados depois dele, com a origem (INSS, parte autora ou perito) e marcas do que trazem. Conforme a rotina, lê também a profissão declarada no laudo médico, o quadro "Requisito de Renda Per Capita Atendido" do processo administrativo, o endereço da parte autora (petições dela, inicial e, quando a cronologia não os carrega, os primeiros documentos do processo — inicial, procuração, CadÚnico —, sem o endereço do escritório do advogado), a contestação anterior ao laudo (CEJUSC, Citados e Laudo (Assessoria) sem petição do INSS depois dele) e os documentos irmãos do laudo social ou do auto de constatação, onde costumam estar as fotos. A leitura não grava nada; a única gravação do script é o MARCAR TODOS COMO LIDOS, chamado à parte, processo a processo (ver "Documentos não lidos", abaixo). Quem classifica sou eu, pelas regras desta skill. Se uma regra desta skill mudar, ajuste o script junto.

1. No Chrome, abra a página estática `https://pje1g.trf5.jus.br/pje/js/pdfjs/web/locale/locale.json` e carregue nela o arquivo `analise-lote.js` tal como está gravado: crie pelo javascript_tool um `<input type="file">` que, ao receber o arquivo, o execute (`(0, eval)(await input.files[0].text())`), e envie o arquivo a ele com o file_upload do Chrome. Não reescreva o script de memória. Cada processo abre num iframe oculto, e a página de cima não muda de endereço.
2. Monte a lista com a rotina de cada processo, tirada da etiqueta do CSV (comparada com `jef-expediente-manifestacao.etiquetas_analisadas`): `'<processo>|<rotina>'`, com a rotina `C`, `D`, `PC` (Planilha de Cálculo), `DIL` (Diligência), `LOAS`, `INC` (Incapacidade), `LIM` (Limitação), `CEJ` (CEJUSC), `CIT` (Citados), `CP`, `PP`, `AP` (Conhecimento-, Perícia- e Audiência-Proposta), `CA` (Contestação Automática), `CT` (Contestação), `LA` (Laudo (Assessoria)), `EL` (Esclarecer Localização) ou `EC` (Endereço (Cumprimento)). Processo com mais de uma dessas etiquetas só entra na lista depois que o usuário disser por qual rotina segue.
3. Passe a configuração com `window.__EM.config({...})` (ver "Como a configuração chega ao script", acima) e inicie com `window.__EM.inicia(lista, base)` (`base` = nº do primeiro processo da lista menos 1). Um processo por vez, um documento por vez: mais que isso faz o PJe bloquear o acesso por 10 minutos (HTTP 429). Se o script parar com `429`, espere os 10 minutos antes de retomar.
4. Acompanhe com `window.__EM.estado()`. Para ler os resumos, chame `window.__EM.mostra(a, b)` e leia a página com `get_page_text` — de 6 a 10 processos por leitura. O retorno do javascript_tool é cortado em cerca de 1.200 caracteres; o `get_page_text`, não.

**Como ler o resumo.** O cabeçalho traz a rotina, `nl` (documentos não lidos), `docs` (documentos na cronologia / no processo) e `PROP`, uma sugestão com o nome da classificação da rotina (ex.: `SEM?`, `COM PROPOSTA - aceita?`, `SEM - outra profissão?`, `Pedido de dilação de prazo? (15 dias, id. ...)`). A linha `ASSUNTO` traz também o dígito do processo e a etiqueta configurada para ele em `Comum — Assessores.assessor_por_digito` (ver "Tabela do assessor por dígito do processo"). Em seguida vêm o marco (`[MARCO ...]`, com o texto do despacho na Diligência e o da intimação nas rotinas de endereço), os documentos posteriores, do mais recente para o mais antigo, cada um com marcas — `PROPOSTA`, `IMPOSSIBILIDADE`, `PROMESSA` (o INSS só diz que poderá apresentar proposta depois do laudo), `ACEITA`, `RECUSA`, `DILAÇÃO(n dias)`, `ENDEREÇO`, `IMPUGNA`, `CONCORDA`, `CÁLCULO`, `CONTESTAÇÃO`, `JUNTADA-PA`, `ACORDO?` (petição do INSS que fala em acordo sem proposta clara), `DECURSO` — e a origem, e por fim, conforme a rotina, `[LAUDO MÉDICO] PROFISSÃO`, `[RENDA]`, `[ENDEREÇO <id> <onde>]`, `[ANTES DO LAUDO]` e `[SOCIAL] ...; mesma data: ...`. `PROPOSTA` inclui as fórmulas da AGU "TIPO 1 - ACORDO DIRETO" e "PROPOR TRANSAÇÃO ... o INSS se obriga", ainda que o documento venha como "Outras peças". Na Planilha de Cálculo, `IMPUGNA` também marca a petição do autor que aponta incorreção da RMI, pede os cálculos da multa ou a retificação da conta, ou apresenta cálculos próprios. A sugestão não decide: confira-a, em todo processo, no teor dos documentos antes de gravar a classificação. `PROP:?` e `rever: ...` pedem leitura atenta.

Sempre se decidem pela leitura, nunca pela sugestão:
- **Diligência:** a hipótese (1a a 1d, 2a a 2c, 3 ou AVISO — ou COM PROPOSTA / COM PROPOSTA - aceita / COM PROPOSTA - recusada, quando o INSS propuser acordo depois do despacho) sai do texto do despacho que o resumo traz e de quem se manifestou depois dele; o script não sugere a hipótese do despacho. Quando há documento do INSS com a marca `PROPOSTA` depois do despacho, o script sugere `COM PROPOSTA?`, `COM PROPOSTA - aceita?`, `COM PROPOSTA - recusada?` ou `AVISO? (contraproposta do autor ...)`, com o id da proposta; confira no teor se há termos oferecidos.
- **Miserabilidade** (CEJUSC, Citados e Laudo (Assessoria), assunto Pessoa com Deficiência ou Idoso): as fotos só se veem na tela. O resumo indica o laudo social ou o auto de constatação (`[SOCIAL <id>] — fotos: ver na tela`) e, depois de `mesma data:`, os documentos juntados no mesmo dia (fotos em documento separado: "REG FOT", "ilovepdf merged", "Apto Foto 07").
  - **Como ver as fotos sem abrir o processo na tela** (testado em 26/10/2026, 20 processos): na mesma página do `locale.json` em que o script roda, busque o documento pelo endereço que o PJe usa ao abri-lo, `fetch('/pje/seam/resource/rest/pje-legacy/documento/download/<id>', {credentials: 'include'})`, e desenhe as páginas em `<canvas>` com o pdf.js (`await import('/pje/js/pdfjs/build/pdf.mjs')`, `GlobalWorkerOptions.workerSrc = '/pje/js/pdfjs/build/pdf.worker.mjs'`, `getDocument({data}).promise`, `page.render`), com escala de 0,3 a 0,5 (de 0,85 para ler o texto). Tire um screenshot da aba (`computer`, ação `screenshot`) e avalie as fotos.
  - **Qual id baixar:** o `[SOCIAL <id>]` do laudo social costuma ser um HTML sem fotos (os primeiros bytes são `<html`; um PDF começa por `%PDF`). O PDF com as fotos costuma ser o id seguinte ou um dos ids de `mesma data:`; confira o tipo e o número de páginas antes de desenhar. No auto de constatação (Diligência), o próprio id costuma ser o PDF; quando as fotos vêm soltas ("WhatsApp Image"), são JPEG (bytes `FF D8`) e entram numa `<img>` com `URL.createObjectURL(new Blob([bytes]))`.
  - **Critério usado:** moradia precária ou insalubre (paredes sem reboco, chão de terra ou cimento rachado, mofo, cobertura danificada, mobília mínima) é grau elevado de miserabilidade; casa adequada, mesmo simples, não é. Registre no Fundamento o que as fotos mostram e sinalize os casos limítrofes para o usuário rever.
  - **Cuidado com o retorno do `javascript_tool`:** resposta com texto de documento ou número de processo seguido de "?" pode vir bloqueada ("Cookie/query string data"). Devolva só números e mostre o texto num `<pre>` lido com `get_page_text`.
- **Endereço** (LOAS Social sem renda per capita atendida, Esclarecer Localização): o resumo traz o trecho e de onde saiu (petição do autor, inicial ou `Nº documento do processo`; `campo "endereço"` quando não há "residente e domiciliado"). Com endereço na petição do autor, o da inicial vem numa segunda linha (`mais antigo: comparar`): a petição pode qualificar outra pessoa, como o curador indicado; a etiqueta da área de perícia social, ou a de endereço fora das listas, sai da seção `## Comum — Perícia social (zonas, bairros e municípios)` da configuração, lida a cada execução.
- **CEJUSC e Citados** sem petição do INSS depois do último laudo: o script lê a contestação e as petições do INSS anteriores ao laudo (`[ANTES DO LAUDO]`). Com proposta ali, sugere `COM PROPOSTA?` e pede `conferir se ainda vale`; com `PROMESSA` ou sem proposta, segue a sugestão sem proposta. `nenhuma petição do INSS no escopo: conferir a contestação` só aparece quando nenhuma foi lida.
- Impugnação ou concordância com a planilha, aceitação ou recusa de proposta e pedido de dilação junto com dados de endereço na mesma petição: confira no texto.

**v3 do script (18/11/2026):** o aceite da proposta passa a ser reconhecido também com a palavra partida pelo leitor de PDF ("a ceitar o acordo"), e a petição com título "(A PARTE AUTORA ACEITA …)" sem petição "(P …)" do INSS no mesmo dia passa a ser lida como petição, e não pulada como anexo. As regras de classificação não mudaram. A `jef-analise-laudo` também usa este script e estas regras, nos processos com as partes já ouvidas sobre o laudo.

**O que o script não lê.** Documento `ILEGÍVEL` (PDF digitalizado ou com fonte sem texto, que sai em símbolos), as fotos do laudo social e do auto de constatação, e o documento-chave fora da cronologia carregada (`... não localizado (cronologia carregou N de M documentos)`) são lidos na tela: abra o processo numa aba visível. A exceção é o endereço do LOAS, que o script procura também nos primeiros documentos do processo, ainda que fora da cronologia.

**Arquivo de andamento — gravar à medida que sai, nunca só no final.** Antes de iniciar, crie `Relatórios/Triagem_AAAA-MM-DD_andamento.txt` com uma linha `L|<nº>|<processo>|<rotina>` por processo do lote. A cada leitura dos resumos, grave uma linha por processo: `<nº>|<processo>|<rotina>|<classificação>|<ação>|<etiqueta controle>|<etiqueta secretaria>|<perícia social>|<prazo para intimação>|<endereço localizado>|<fundamento>|nl=<não lidos>`; depois do MARCAR TODOS COMO LIDOS, acrescente ao último campo o resultado devolvido (ex.: `nl=2 MTL OK`). Processo que depende de leitura na tela fica numa linha `#PENDENTE <nº>|<processo>|<o que falta>` até ser resolvido; vale a última linha de cada processo. O relatório final (.xlsx) é gerado desse arquivo, com as colunas B e K a P tiradas do CSV.

**Interrupção.** Se a sessão do PJe expirar, o script para sozinho (`login em <processo>`). Peça ao usuário que se autentique, carregue o script de novo, passe a configuração (`window.__EM.config`) e reinicie só com os processos do lote que ainda não têm linha no arquivo. O mesmo vale se o navegador ou a conversa caírem, ou se a aba recarregar (`window.__EM` some).

## Regra geral — proposta de acordo com necessidade de intimação da parte autora

Esta regra é **transversal**: aplica-se a qualquer rotina desta skill — atual ou futura — cuja hipótese de proposta de acordo (COM PROPOSTA) ainda dependa de intimação da parte autora (ela ainda não se manifestou aceitando os termos oferecidos). Não é preciso repeti-la a cada nova rotina: sempre que uma rotina tiver esse caso, ele já se resolve automaticamente com o mesmo procedimento abaixo, salvo instrução em contrário do usuário.

- Ação, Etiqueta controle e Etiqueta secretaria: as da linha `[geral.proposta_intimar]`

**Exceção expressa — Rotina LOAS Social** (etiqueta analisada `[etiqueta LOAS]`) **não entra nesta regra geral**. Nela, o caso COM PROPOSTA recebe a Ação e as etiquetas da linha `[LOAS.com_proposta]` — ver a seção própria da Rotina LOAS Social, abaixo.

## Regra geral — proposta de acordo já aceita pela parte autora

Esta regra é **transversal**: aplica-se a qualquer rotina desta skill que tenha hipótese de proposta de acordo (COM PROPOSTA) — as atuais (Rotina C, Rotina D, Rotina Diligência, Rotina LOAS Social, Rotina Incapacidade, Rotina Limitação, Rotina CEJUSC, Rotina Citados, Rotina Conhecimento-Proposta, Rotina Perícia-Proposta, Rotina Audiência-Proposta, Rotina Contestação Automática, Rotina Contestação, Rotina Laudo (Assessoria)) e **qualquer rotina que venha a ser adicionada no futuro com o mesmo caso**. Não é preciso repeti-la a cada nova rotina: sempre que uma rotina tiver hipótese de proposta de acordo, esta hipótese de aceitação já se aplica automaticamente, com a mesma linha de saída abaixo, salvo instrução em contrário do usuário.

Havendo, depois da proposta de acordo, manifestação da parte autora aceitando os termos oferecidos — ainda que o processo aguarde apenas homologação do acordo e implantação do benefício — a classificação passa a ser **"<rotina> COM PROPOSTA - aceita"** (nunca a COM PROPOSTA simples, que pressupõe ainda intimar a parte), com:
- Ação, Etiqueta controle e Etiqueta secretaria: as da linha `[geral.proposta_aceita]`

Exemplo: o INSS propôs acordo de auxílio-acidente; a parte autora manifestou aceitação em 14/09; aguarda homologação e implantação do benefício.

Esta regra vale, sem exceção, também para a Rotina LOAS Social — diferente da regra de intimação acima, que a exclui.

## Como classificar — Rotina C e Rotina D

A cronologia é **decrescente**: o que está acima é mais recente.

1. Localize `JUNTADA DE PETIÇÃO DE LAUDO PERICIAL` e anote a data. Havendo mais de um laudo, use o mais recente.
2. Examine tudo **acima** dele.
3. **SEM PROPOSTA** — nenhuma petição do INSS depois do laudo, ou apenas decurso de prazo, ofício de pagamento de honorários, intimação e certidão.
4. **Peça "IMPOSSIBILIDADE DE ACORDO" → SEM PROPOSTA → Minutar sentença.** É a manifestação padronizada da AGU/PGF em que o INSS declara que não há acordo a propor. Costuma vir rotulada como "Petição (outras)" ou "Manifestação", com anexo de nome como `MANISEMCONTET LOASINCAP...`, e o título aparece no corpo do documento. Encontrando-a, a classificação está resolvida: siga o caminho de Minutar sentença.
5. Petição posterior com nome genérico — "Petição (outras)", "Manifestação", "Contestação", "Impugnação", "Réplica" — **abra o documento e leia**. O nome não decide.
   - Só marque **COM PROPOSTA** se o teor for efetivamente proposta de acordo, com termos oferecidos → classificação **"COM PROPOSTA"** (ver "Regra geral — proposta de acordo com necessidade de intimação da parte autora", acima).
6. **Proposta de acordo já aceita pela parte autora** → classificação **"COM PROPOSTA - aceita"** (ver "Regra geral — proposta de acordo já aceita pela parte autora", acima).
7. **INDEFINIDO** — documento ilegível, não carregou, ou teor ambíguo. Não decida no escuro; registre o motivo no Fundamento.
8. **Proposta de acordo recusada pela parte autora** — havendo, depois da proposta do INSS, manifestação da parte autora recusando os termos oferecidos → classificação **"COM PROPOSTA - recusada"** (ver Regras de saída, abaixo). Vale antes do item 7: recusa não é INDEFINIDO.
9. **Contraproposta da parte autora** — havendo, depois da proposta do INSS, contraproposta da parte autora (novos termos, em vez de simples recusa) → classificação **"COM PROPOSTA - contraproposta do autor"**, tratada à parte da recusa, porque o INSS deve ser intimado (ver Regras de saída, abaixo). Também vale antes do item 7.

## Como classificar — Rotina Planilha de Cálculo

Esta rotina usa marco temporal diferente das anteriores: não é o laudo pericial, é a planilha de cálculo — ou a petição do INSS que apresenta cálculos.

A cronologia é **decrescente**: o que está acima é mais recente.

1. Localize `JUNTADA DE PLANILHA DE CÁLCULO` (ou variação de grafia equivalente) ou a petição do INSS que apresenta cálculos, e anote a data. Havendo mais de uma ocorrência de qualquer um desses dois marcos, use a mais recente entre todas.
2. Examine tudo **acima** desse marco: são as petições apresentadas depois dele.
3. **IMPUGNAÇÃO/DISCORDÂNCIA** — a petição encontrada impugna a planilha de cálculo ou manifesta não concordância com o valor apurado (do autor, do INSS, ou de qualquer parte). Registre no Fundamento o número de identificação dessa petição (formato como "123456789") — o relatório final precisa reproduzi-lo no formato "impugnação ao cálculo id. X".
   - **Discordância parcial também é IMPUGNAÇÃO/DISCORDÂNCIA:** a parte que não contesta as parcelas vencidas, mas afirma que a conta deixou de incluir algo (multa diária ou coercitiva já liquidada, competência final do período, descontos indevidos) e pede a retificação ou a complementação da planilha, está discordando do valor apurado. Classifique como IMPUGNAÇÃO/DISCORDÂNCIA e registre no Fundamento que a discordância é parcial e o que a parte aponta como omitido. Pedido apenas de destaque ou retenção de honorários, cessão de crédito ou separação de 30% para a sociedade de advogados não entra aqui (ver o item 4).
4. **QUALQUER OUTRA PETIÇÃO** — qualquer manifestação que não seja de impugnação ou discordância com a planilha (concordância expressa, decurso de prazo, certidão, intimação, ou qualquer outro teor). Não configuram IMPUGNAÇÃO/DISCORDÂNCIA, ainda que mencionem o valor apurado — seguem esta mesma classificação (QUALQUER OUTRA PETIÇÃO), como os casos de concordância ou não impugnação aos cálculos:
   - pedido de retenção de honorários contratuais (30%) para pessoa jurídica do advogado;
   - renúncia ao teto dos juizados especiais, com destaque de honorários em separado.
5. **INDEFINIDO** — nenhuma petição posterior à planilha, documento ilegível, não carregou, ou teor ambíguo. Não decida no escuro; registre o motivo no Fundamento.

## Como classificar — Rotina Diligência (Convertidos em diligência)

Esta rotina não usa um marco de juntada como as anteriores. Localize o **último despacho** proferido no processo (o mais recente que determina a diligência — ignore certidões e intimações que apenas executam o que ele determinou) e leia o que ele determinou.

**Proposta de acordo do INSS — verificação que vem antes de todas as hipóteses abaixo.** Se, depois do último despacho, o INSS apresentar proposta de acordo, com termos oferecidos (o nome da peça não decide; leia o teor), a classificação deixa de seguir a hipótese do despacho:
- a parte autora ainda não se manifestou sobre a proposta → classificação **"COM PROPOSTA"** (ver "Regra geral — proposta de acordo com necessidade de intimação da parte autora", acima);
- a parte autora já aceitou a proposta → classificação **"COM PROPOSTA - aceita"** (ver "Regra geral — proposta de acordo já aceita pela parte autora", acima);
- a parte autora recusou a proposta → classificação **"COM PROPOSTA - recusada"**: concluir para julgamento (ver Regras de saída, abaixo).

Petição do INSS que só declara a impossibilidade de acordo não é proposta: segue a hipótese do despacho. Contraproposta da parte autora (novos termos, em vez de simples recusa) não tem hipótese própria nesta rotina: segue para AVISO.

**Verificação preliminar — despachos que já preveem conclusão direta.** O padrão normal desta rotina é o despacho intimar uma das partes a se manifestar ou juntar documento, com abertura de vista à outra parte em seguida — mas confira antes se o despacho se enquadra em algum dos padrões abaixo, nos quais o próprio despacho já não prevê outro passo além da conclusão, qualquer que seja o teor da manifestação de qualquer parte, ou mesmo se todas ficarem omissas:

- **Intimação única, sem vista subsequente** — intima apenas uma das partes (autor ou INSS), sem prescrever vista subsequente à outra, encerrando diretamente com "voltem os autos conclusos" (ou fórmula equivalente).
- **Ofício a órgão/empresa, com vista conjunta às partes** — o despacho determina que se oficie algum órgão ou empresa solicitando informações; havendo a juntada dessas informações e abertura de vista conjunta às partes (não sequencial, a ambas ao mesmo tempo), decorrido o prazo.
- **"Dê-se vista às partes"** — o despacho abre vista conjunta às partes (não sequencial, a ambas ao mesmo tempo), decorrido o prazo.
- **Intimação de uma só parte para prova documental ou indicação de provas, sem vista à outra e sem fórmula de conclusão** — enquadram-se aqui, mesmo sem "voltem os autos conclusos" no despacho:
  - despacho convertendo o julgamento em diligência e intimando apenas a parte autora a apresentar prova documental da qualidade de segurada especial e indicar provas para audiência, sem prever vista ao INSS nem fórmula de conclusão dos autos;
  - despacho convertendo o julgamento em diligência e intimando apenas a parte autora (15 dias) a apresentar prova documental do período rural e indicar provas para audiência, sem prever vista ao INSS nem fórmula de conclusão dos autos;
  - despacho intimando apenas o INSS, em 15 dias, a indicar as provas que pretende produzir em audiência, sem prever vista à parte autora nem fórmula de conclusão dos autos.

Encontrando qualquer um desses padrões → classificação **"3) Conclusão direta, independente de manifestação"** (ver Regras de saída, abaixo).

Havendo, em vez disso, abertura de vista sequencial às duas partes — o padrão normal —, identifique qual das duas hipóteses abaixo o despacho configura, e examine o que veio **depois** dele (acima, na cronologia decrescente):

**1ª hipótese — a parte autora foi intimada primeiro, depois abre vista ao INSS.**

a) A parte autora já se manifestou ou juntou o documento pedido, e o processo aguarda intimação do INSS para se manifestar → classificação **"1a) Aguarda vista ao INSS"**.
b) A parte autora não se manifestou → classificação **"1b) Parte autora omissa"**.
c) A parte autora pede dilação de prazo → classificação **"1c) Pedido de dilação de prazo (autor)"**. Registre no Fundamento o prazo de dilação pedido e o número de identificação da petição (formato como "123456789"), e preencha a coluna Prazo para intimação da parte com o número de dias pedidos.
d) O INSS se manifesta sobre a petição/documento da parte autora, ou deixa decorrer o prazo sem manifestação → classificação **"1d) INSS manifestou-se ou prazo decorrido"**.

**2ª hipótese — o INSS ou o CEAB foi(ram) intimado(s) primeiro, depois abre vista à parte autora.**

a) O INSS ou o CEAB já se manifestou ou juntou o documento pedido, e o processo aguarda intimação da parte autora para se manifestar → classificação **"2a) Aguarda vista ao autor"**.
b) O INSS ou o CEAB não se manifestou → classificação **"2b) INSS/CEAB omisso"**.
c) A parte autora se manifesta sobre a petição/documento juntado pelo INSS ou CEAB, ou deixa decorrer o prazo sem manifestação → classificação **"2c) Autor manifestou-se ou prazo decorrido"**.

**Casos que não se enquadrem em nenhuma das hipóteses acima** → classificação **"AVISO"**: não prescreva ação e prescreva apenas a etiqueta controle da linha `[geral.direcao_analisar]`; registre no Fundamento um resumo do que o processo pede, para decisão humana — exatamente como já se faz no INDEFINIDO das outras rotinas.

## Como classificar — Rotina LOAS Social (Laudo A/B/C. LOAS - designar social)

A cronologia é **decrescente**: o que está acima é mais recente.

1. Localize `JUNTADA DE PETIÇÃO DE LAUDO PERICIAL` e anote a data. Havendo mais de um laudo, use o mais recente.
2. Examine tudo **acima** dele.
3. **SEM PROPOSTA** — nenhuma petição do INSS depois do laudo, ou apenas decurso de prazo, ofício de pagamento de honorários, intimação e certidão. Segue para a **análise de renda per capita**, abaixo.
4. **Peça "IMPOSSIBILIDADE DE ACORDO" → SEM PROPOSTA →** segue igualmente para a análise de renda per capita. É a manifestação padronizada da AGU/PGF em que o INSS declara que não há acordo a propor; costuma vir rotulada como "Petição (outras)" ou "Manifestação", com anexo de nome como `MANISEMCONTET LOASINCAP...`, e o título aparece no corpo do documento.
5. Petição posterior com nome genérico — "Petição (outras)", "Manifestação", "Contestação", "Impugnação", "Réplica" — **abra o documento e leia**. O nome não decide.
   - Só marque **COM PROPOSTA** se o teor for efetivamente proposta de acordo, com termos oferecidos. Vai direto para intimação, sem passar pela análise de renda — **esta rotina é a exceção expressa** à "Regra geral — proposta de acordo com necessidade de intimação da parte autora": usa a linha `[LOAS.com_proposta]`, não a `[geral.proposta_intimar]` (ver Regras de saída, abaixo).
6. **Proposta de acordo recusada pela parte autora** — a parte autora manifesta discordância/recusa com a proposta oferecida → **segue a mesma rotina adotada quando não há proposta de acordo**: classificação conforme o item 3 (SEM PROPOSTA), acima, com a **análise de renda per capita**, abaixo, determinando a classificação final.
7. **Proposta de acordo já aceita pela parte autora** → classificação **"COM PROPOSTA - aceita"** (ver "Regra geral — proposta de acordo já aceita pela parte autora", acima — esta rotina não é exceção a essa regra).
8. **INDEFINIDO** — documento ilegível, não carregou, ou teor ambíguo. Não decida no escuro; registre o motivo no Fundamento.

### Análise de renda per capita (só nos casos SEM PROPOSTA)

Localize nos autos o documento **"DETALHAMENTO DA ANÁLISE E DECISÃO DE REQUERIMENTO DE BENEFÍCIO"** e, nele, o quadro **"RESUMO DA RENDA DO GRUPO FAMILIAR"**, com o campo **"Requisito de Renda Per Capita Atendido"**:

- **SIM** → classificação **"SEM PROPOSTA - renda per capita atendida"**.
- **NÃO, ou documento/quadro ausente** → classificação correspondente à apuração de endereço, abaixo.

### Apuração de endereço (renda per capita não atendida ou não localizada)

Pesquise o endereço da parte autora nos autos — da informação mais recente para a mais antiga (petição inicial, procuração, comprovante de residência, últimas manifestações):

- **Endereço não localizável nos autos** → classificação **"SEM PROPOSTA - endereço a esclarecer"**.
- **Endereço localizável** → confira o bairro ou município na tabela de zoneamento (ver seção própria abaixo):
  - bairro ou município consta de uma das áreas da tabela `zonas` (`Comum — Perícia social`) → classificação **"SEM PROPOSTA - endereço em área de perícia social"**;
  - bairro ou município não consta em nenhuma das áreas → classificação **"SEM PROPOSTA - endereço fora das listas (constatação)"**.

Registre o endereço encontrado, pontos de referência e telefone (quando houver) na coluna Endereço localizado.

**Casos que não se enquadrem em nenhuma das hipóteses acima** → classificação **"AVISO"**: não prescreva ação e prescreva apenas a etiqueta controle da linha `[geral.direcao_analisar]`; registre no Fundamento um resumo do que o processo pede, para decisão humana.

## Como classificar — Rotina Incapacidade e Rotina Limitação

A cronologia é **decrescente**: o que está acima é mais recente.

1. Localize `JUNTADA DE PETIÇÃO DE LAUDO PERICIAL` e anote a data. Havendo mais de um laudo, use o mais recente.
2. Examine tudo **acima** dele.
3. **SEM PROPOSTA** — nenhuma petição do INSS depois do laudo, ou apenas decurso de prazo, ofício de pagamento de honorários, intimação e certidão. Segue para a **verificação da profissão declarada**, abaixo.
4. **Peça "IMPOSSIBILIDADE DE ACORDO" → SEM PROPOSTA →** segue igualmente para a verificação da profissão declarada. É a manifestação padronizada da AGU/PGF em que o INSS declara que não há acordo a propor; costuma vir rotulada como "Petição (outras)" ou "Manifestação", com anexo de nome como `MANISEMCONTET LOASINCAP...`, e o título aparece no corpo do documento.
5. Petição posterior com nome genérico — "Petição (outras)", "Manifestação", "Contestação", "Impugnação", "Réplica" — **abra o documento e leia**. O nome não decide.
   - Só marque **COM PROPOSTA** se o teor for efetivamente proposta de acordo, com termos oferecidos → classificação **"COM PROPOSTA"** (ver "Regra geral — proposta de acordo com necessidade de intimação da parte autora", acima).
6. **Proposta de acordo já aceita pela parte autora** → classificação **"COM PROPOSTA - aceita"** (ver "Regra geral — proposta de acordo já aceita pela parte autora", acima).
7. **INDEFINIDO** — documento ilegível, não carregou, ou teor ambíguo. Não decida no escuro; registre o motivo no Fundamento.

### Verificação da profissão declarada (só nos casos SEM PROPOSTA)

No laudo médico localizado, verifique a profissão declarada pela parte autora. **Em todas as rotinas desta skill que buscam a profissão no laudo médico, pescador(a) artesanal, pescador(a) profissional (CBO 6312-10, mesmo sem a palavra "artesanal") e catador(a) de mariscos se equiparam a agricultor(a)** e seguem o mesmo caminho dele(a):

- **AGRICULTOR(A)** (ou profissão equiparada a agricultor(a): **pescador(a) artesanal**, **pescador(a) profissional (CBO 6312-10)**, mesmo sem a palavra "artesanal", ou **catador(a) de mariscos**) → classificação **"SEM PROPOSTA - agricultor(a)"**.
- **Qualquer outra profissão** → classificação **"SEM PROPOSTA - outra profissão"**.

## Como classificar — Rotina CEJUSC e Rotina Citados

Etiquetas analisadas: `[etiqueta CEJ]` (Rotina CEJUSC) e `[etiqueta CIT]` (Rotina Citados). São simétricas: mesma classificação, mesmas etiquetas de saída — a única diferença é qual das duas etiquetas aparece na coluna Etiqueta analisada.

A cronologia é **decrescente**: o que está acima é mais recente.

1. **COM PROPOSTA** — havendo proposta de acordo do INSS, com termos oferecidos → classificação **"COM PROPOSTA"** (ver "Regra geral — proposta de acordo com necessidade de intimação da parte autora", acima — esta rotina não é exceção, usa a linha `[geral.proposta_intimar]` como as demais).
2. **COM PROPOSTA - aceita** — havendo, depois da proposta, manifestação da parte autora aceitando os termos oferecidos → classificação **"COM PROPOSTA - aceita"** (ver "Regra geral — proposta de acordo já aceita pela parte autora", acima).
3. **COM PROPOSTA - recusada** — havendo, depois da proposta do INSS, manifestação da parte autora recusando os termos oferecidos → classificação **"COM PROPOSTA - recusada"** (ver Regras de saída, abaixo).
4. **COM PROPOSTA - contraproposta do autor** — havendo, depois da proposta do INSS, contraproposta da parte autora (novos termos, em vez de simples recusa) → classificação **"COM PROPOSTA - contraproposta do autor"**, tratada à parte da recusa, porque o INSS deve ser intimado (ver Regras de saída, abaixo).
5. **SEM PROPOSTA** — nenhuma proposta de acordo do INSS. Segue para a verificação abaixo, conforme o assunto do processo.
6. **INDEFINIDO** — documento ilegível, não carregou, ou teor ambíguo. Não decida no escuro; registre o motivo no Fundamento.

### Verificação para os casos SEM PROPOSTA (Rotina CEJUSC e Rotina Citados)

**1º) Assunto do processo "Pessoa com Deficiência" ou "Idoso"** — localize a perícia social (juntada de petição de laudo pericial / laudo social) ou o auto de constatação (diligência de auto de constatação) e examine as fotos juntadas com o documento:
- Fotos mostram grau elevado de miserabilidade → classificação **"SEM PROPOSTA - CEJUSC (miserabilidade elevada)"**.
- Fotos não mostram grau elevado de miserabilidade, documento sem fotos, ou laudo social/auto de constatação não localizado nos autos → classificação **"SEM PROPOSTA (miserabilidade não elevada)"**.

**2º) Qualquer outro assunto** — verifique no laudo médico a profissão declarada pela parte autora:
- **AGRICULTOR(A)** (ou profissão equiparada a agricultor(a): **pescador(a) artesanal**, **pescador(a) profissional (CBO 6312-10)**, mesmo sem a palavra "artesanal", ou **catador(a) de mariscos**) → classificação **"SEM PROPOSTA - agricultor(a)"**.
- **Qualquer outra profissão** → classificação **"SEM PROPOSTA - outra profissão"**.

## Como classificar — Rotina Conhecimento-Proposta, Rotina Perícia-Proposta e Rotina Audiência-Proposta

Etiquetas analisadas: `[etiqueta CP]` (Rotina Conhecimento-Proposta), `[etiqueta PP]` (Rotina Perícia-Proposta) e `[etiqueta AP]` (Rotina Audiência-Proposta). São simétricas: mesma classificação, mesmas etiquetas de saída — a única diferença é qual das três etiquetas aparece na coluna Etiqueta analisada.

Diferente das demais rotinas desta skill, aqui o processo já chega com proposta de acordo formulada e a parte autora já intimada a respeito — a etiqueta analisada é o próprio indicativo disso. Não se aplica, portanto, a "Regra geral — proposta de acordo com necessidade de intimação da parte autora": não há nova intimação a fazer, só verificar o desfecho da que já ocorreu.

A cronologia é **decrescente**: o que está acima é mais recente.

1. Localize a proposta de acordo do INSS e a intimação da parte autora a respeito, e examine o que veio **depois**, na cronologia.
2. **Parte autora manifesta concordância expressa com os termos oferecidos** → classificação **"COM PROPOSTA - aceita"** (ver "Regra geral — proposta de acordo já aceita pela parte autora", acima).
3. **Parte autora manifesta discordância/recusa com a proposta, ou decorre o prazo sem qualquer manifestação** → classificação **"COM PROPOSTA - não aceita"**.
4. **INDEFINIDO** — documento ilegível, não carregou, ou teor ambíguo. Não decida no escuro; registre o motivo no Fundamento.

## Como classificar — Rotina Contestação Automática e Rotina Contestação

Etiquetas analisadas: `[etiqueta CA]` (Rotina Contestação Automática) e `[etiqueta CT]` (Rotina Contestação). São simétricas: mesma classificação, mesmas etiquetas de saída — a única diferença é qual das duas etiquetas aparece na coluna Etiqueta analisada.

A cronologia é **decrescente**: o que está acima é mais recente.

1. **COM PROPOSTA** — havendo proposta de acordo do INSS, com termos oferecidos → classificação **"COM PROPOSTA"** (ver "Regra geral — proposta de acordo com necessidade de intimação da parte autora", acima).
2. **COM PROPOSTA - aceita** — havendo, depois da proposta, manifestação da parte autora aceitando os termos oferecidos → classificação **"COM PROPOSTA - aceita"** (ver "Regra geral — proposta de acordo já aceita pela parte autora", acima).
3. **SEM PROPOSTA** — nenhuma proposta de acordo do INSS.
4. **INDEFINIDO** — documento ilegível, não carregou, ou teor ambíguo. Não decida no escuro; registre o motivo no Fundamento.

## Como classificar — Rotina Laudo (Assessoria)

Etiqueta analisada: `[etiqueta LA]`.

A cronologia é **decrescente**: o que está acima é mais recente.

1. **COM PROPOSTA** — havendo proposta de acordo do INSS, com termos oferecidos → classificação **"COM PROPOSTA"** (ver "Regra geral — proposta de acordo com necessidade de intimação da parte autora", acima).
2. **COM PROPOSTA - aceita** — havendo, depois da proposta, manifestação da parte autora aceitando os termos oferecidos → classificação **"COM PROPOSTA - aceita"** (ver "Regra geral — proposta de acordo já aceita pela parte autora", acima).
3. **COM PROPOSTA - recusada** — havendo, depois da proposta do INSS, manifestação da parte autora recusando os termos oferecidos → classificação **"COM PROPOSTA - recusada"** (ver Regras de saída, abaixo).
4. **SEM PROPOSTA** — nenhuma proposta de acordo do INSS. Segue para a verificação abaixo.
5. **INDEFINIDO** — documento ilegível, não carregou, ou teor ambíguo. Não decida no escuro; registre o motivo no Fundamento.

### Verificação para os casos SEM PROPOSTA (Rotina Laudo (Assessoria))

Localize a perícia social (juntada de petição de laudo pericial / laudo social) ou o auto de constatação (diligência de auto de constatação) e examine as fotos juntadas com o documento:
- Fotos mostram grau elevado de miserabilidade → classificação **"SEM PROPOSTA - CEJUSC (miserabilidade elevada)"**.
- Fotos não mostram grau elevado de miserabilidade, documento sem fotos, ou laudo social/auto de constatação não localizado nos autos → classificação **"SEM PROPOSTA (miserabilidade não elevada)"**.

## Como classificar — Rotina Esclarecer Localização (Perícia Social) e Rotina Endereço (Cumprimento)

Etiquetas analisadas: `[etiqueta EL]` (Rotina Esclarecer Localização) e `[etiqueta EC]` (Rotina Endereço). Nas duas, o processo aguarda que a parte autora informe dados para localização do imóvel — a etiqueta analisada é o próprio indicativo disso.

A cronologia é **decrescente**: o que está acima é mais recente.

Localize a intimação da parte autora para informar dados de localização do imóvel e examine o que veio **depois**, na cronologia:

1. **Endereço informado** — a parte autora informa dados para localização do imóvel → ver Regras de saída, abaixo (cada rotina tem sua própria etiqueta de saída).
2. **Pedido de dilação de prazo (autor)** — a parte autora pede dilação de prazo → mesmo procedimento já previsto na Rotina Diligência, classificação "1c) Pedido de dilação de prazo (autor)" (ver acima): Ação e Etiqueta controle da linha `[DIL.1c]`, Prazo para intimação da parte = número de dias pedidos, e registre no Fundamento também o número de identificação da petição.
3. **Parte autora omissa** — a parte autora não se manifesta → ver Regras de saída, abaixo.
4. **Casos que não se enquadrem em nenhuma das hipóteses acima** → classificação **"AVISO"**: não prescreva ação e prescreva apenas a etiqueta controle da linha `[geral.direcao_analisar]`; registre no Fundamento um resumo do que o processo pede, para decisão humana.

## Documentos não lidos — a única gravação

Se a cronologia trouxer **"Há N documento(s) não lido(s)"**, clique em **MARCAR TODOS COMO LIDOS**, no topo do painel de cronologia. Confirme que o aviso sumiu antes de seguir.

Esse botão só existe dentro dos autos, um processo por vez — **não há equivalente em lote**. É por isso que ele está nesta skill: é o passo que a operação em lote pula silenciosamente.

Registre na coluna J: `sim (N) - marcados como lidos em DD/MM/AAAA`, ou `não`.

**No lote**, o resumo de cada processo traz `nl` (o número de não lidos na hora da leitura). Para cada processo com `nl` maior que zero, depois de gravada a classificação dele no arquivo de andamento, chame `await window.__EM.marca('<processo>', <nl>)`. O script abre os autos no quadro oculto, clica em MARCAR TODOS COMO LIDOS e confere que o aviso sumiu. Um processo por vez, nunca antes da classificação gravada.

- `MTL OK`: grave no arquivo de andamento.
- `NÃO MARCADO: eram X não lidos na leitura e agora são Y`: chegou documento depois da leitura. Leia o processo de novo antes de marcar — nada é marcado sem ser lido.
- `MTL FALHOU` ou `botão ... não encontrado`: abra o processo numa aba visível e clique pela tela, conferindo o aviso.

## Regras de saída — preenchimento das colunas E a H

Nenhuma etiqueta é retirada em nenhuma rotina desta skill: todas as etiquetas permanecem no processo, inclusive a etiqueta analisada (qualquer das dezessete etiquetas de `jef-expediente-manifestacao.etiquetas_analisadas`). A skill só prescreve etiquetas a inserir, nunca a retirar, e não prescreve transição de fase — a movimentação entre fases não faz mais parte desta skill.

### Como preencher as três colunas de etiqueta

Cada etiqueta sugerida para inserção entra em uma coluna, conforme o lugar em que está na configuração:
- Coluna "Etiqueta controle" da linha de saída (e `Comum — Perícia social.etiqueta_fora_das_listas`) → coluna **Etiqueta controle**.
- Coluna "Etiqueta secretaria" da linha de saída, inclusive as etiquetas de assessor de `Comum — Assessores` → coluna **Etiqueta secretaria**.
- Etiqueta de área da tabela `zonas` de `Comum — Perícia social` → coluna **Perícia social**.

Toda linha tem as três colunas prontas para receber esses valores; a coluna cujo tipo de etiqueta não se aplica àquela classificação (ou cuja célula na configuração é `—`) fica em branco. A coluna Perícia social só é preenchida pela Rotina LOAS Social e pela Rotina Esclarecer Localização (Perícia Social), nos casos em que o endereço corresponde a uma das áreas da tabela `zonas`.

### Rotina C e Rotina D — simétricas, troque apenas a letra do laudo

Vão para **Minutar sentença** todos os casos SEM PROPOSTA, e isso inclui expressamente:
- nenhuma petição do INSS depois do laudo;
- peça **"IMPOSSIBILIDADE DE ACORDO"**;
- contestação, impugnação, réplica ou qualquer outra petição que não seja proposta de acordo.

#### Rotina C — etiqueta analisada `[etiqueta C]`

**SEM PROPOSTA**
- Ação, Etiqueta controle e Etiqueta secretaria: as da linha `[C.sem_proposta]`

**COM PROPOSTA** — ver "Regra geral — proposta de acordo com necessidade de intimação da parte autora".

**COM PROPOSTA - aceita** — ver "Regra geral — proposta de acordo já aceita pela parte autora".

**COM PROPOSTA - recusada**
- Ação, Etiqueta controle e Etiqueta secretaria: as da linha `[CD.recusada]`

**COM PROPOSTA - contraproposta do autor** — o INSS deve ser intimado a se manifestar sobre a contraproposta; mesmas etiquetas de "Regra geral — proposta de acordo com necessidade de intimação da parte autora" (Ação e etiquetas da linha `[geral.proposta_intimar]`). No Fundamento, diga que é contraproposta do autor e que a intimação é do INSS.

#### Rotina D — etiqueta analisada `[etiqueta D]`

**SEM PROPOSTA**
- Ação, Etiqueta controle e Etiqueta secretaria: as da linha `[D.sem_proposta]`

**COM PROPOSTA** — ver "Regra geral — proposta de acordo com necessidade de intimação da parte autora".

**COM PROPOSTA - aceita** — ver "Regra geral — proposta de acordo já aceita pela parte autora".

**COM PROPOSTA - recusada** — mesmas etiquetas da Rotina C (linha `[CD.recusada]`).

**COM PROPOSTA - contraproposta do autor** — mesmas etiquetas da Rotina C (intimar o INSS, linha `[geral.proposta_intimar]`).

**INDEFINIDO** — em qualquer das rotinas, deixe Ação, Etiqueta secretaria e Perícia social em branco, coloque na Etiqueta controle a da linha `[geral.direcao_analisar]` e explique no Fundamento o que impediu a conclusão.

### Rotina Planilha de Cálculo — etiqueta analisada `[etiqueta PC]`

**IMPUGNAÇÃO/DISCORDÂNCIA**
- Ação e Etiqueta controle: as da linha `[PC.impugnacao]`

**QUALQUER OUTRA PETIÇÃO**
- Ação e Etiqueta controle: as da linha `[PC.outra_peticao]`

**INDEFINIDO** — deixe Ação, Etiqueta secretaria e Perícia social em branco, coloque na Etiqueta controle a da linha `[geral.direcao_analisar]` e explique no Fundamento o que impediu a conclusão.

### Rotina Diligência — etiqueta analisada `[etiqueta DIL]`

**COM PROPOSTA** — ver "Regra geral — proposta de acordo com necessidade de intimação da parte autora" (Prazo para intimação da parte em branco).

**COM PROPOSTA - aceita** — ver "Regra geral — proposta de acordo já aceita pela parte autora".

**COM PROPOSTA - recusada** — concluir para julgamento:
- Ação e Etiqueta controle: as da linha `[DIL.recusada]`
- Prazo para intimação da parte: `(não se aplica)`

**1a) Aguarda vista ao INSS**
- Ação e Etiqueta controle: as da linha `[DIL.1a]`
- Prazo para intimação da parte: o prazo determinado no próprio despacho — leia o valor fixado nele, não presuma um número padrão de dias

**1b) Parte autora omissa**
- Ação e Etiqueta controle: as da linha `[DIL.1b]`
- Prazo para intimação da parte: `(não se aplica)`

**1c) Pedido de dilação de prazo (autor)**
- Ação e Etiqueta controle: as da linha `[DIL.1c]`
- Prazo para intimação da parte: o número de dias pedidos na petição de dilação
- Fundamento: registrar também o número de identificação da petição

**1d) INSS manifestou-se ou prazo decorrido**
- Ação e Etiqueta controle: as da linha `[DIL.1d]`
- Prazo para intimação da parte: `(não se aplica)`

**2a) Aguarda vista ao autor**
- Ação e Etiqueta controle: as da linha `[DIL.2a]`
- Prazo para intimação da parte: o prazo determinado no próprio despacho — leia o valor fixado nele, não presuma um número padrão de dias

**2b) INSS/CEAB omisso**
- Ação e Etiqueta controle: as da linha `[DIL.2b]`
- Prazo para intimação da parte: `(não se aplica)`

**2c) Autor manifestou-se ou prazo decorrido**
- Ação e Etiqueta controle: as da linha `[DIL.2c]`
- Etiqueta secretaria: conforme a ordem de verificação abaixo (nova regra)
- Prazo para intimação da parte: `(não se aplica)`

Ordem de verificação da etiqueta secretaria — a primeira condição atendida decide, nesta ordem (item configurado como `não se aplica` em `Comum — Assessores` é pulado, e a verificação segue para o próximo):
1. Laudo médico juntado no processo, com profissão declarada **AGRICULTOR(A)** (ou profissão equiparada a agricultor(a): **pescador(a) artesanal**, **pescador(a) profissional (CBO 6312-10)**, mesmo sem a palavra "artesanal", ou **catador(a) de mariscos**) → `Comum — Assessores.assessor_agricultor`.
2. Assunto do processo **salário maternidade** → `Comum — Assessores.assessor_salario_maternidade`.
3. Assunto do processo **pensão por morte** → `Comum — Assessores.assessor_pensao_morte`.
4. Assunto do processo **auxílio reclusão** → `Comum — Assessores.assessor_auxilio_reclusao`.
   Nos passos 2 a 4, se a seção não tiver a chave separada do assunto, mas tiver `Comum — Assessores.assessor_salario_maternidade_pensao_reclusao` (uma só etiqueta para os três assuntos, gravada por outra skill), use essa etiqueta; `não se aplica` nela pula os três passos.
5. Demais casos em que houve juntada de laudo médico no processo → conforme o último dígito do número do processo, ver "Tabela do assessor por dígito do processo" (Rotina LOAS Social): a etiqueta configurada em `Comum — Assessores.assessor_por_digito`.
6. Nenhuma das hipóteses acima (sem laudo médico juntado no processo e assunto fora dos três listados) — deixe a Etiqueta secretaria em branco e registre no Fundamento que não há regra de assessor aplicável, para atribuição manual.

**3) Conclusão direta, independente de manifestação**
- Ação e Etiqueta controle: as da linha `[DIL.3]`
- Prazo para intimação da parte: `(não se aplica)`

**AVISO** — deixe a Ação em branco e coloque na Etiqueta controle a da linha `[geral.direcao_analisar]`; explique no Fundamento o pedido que exige decisão humana.

### Rotina LOAS Social — etiqueta analisada `[etiqueta LOAS]`

**COM PROPOSTA** — **exceção expressa** à "Regra geral — proposta de acordo com necessidade de intimação da parte autora": esta rotina não usa a linha `[geral.proposta_intimar]`.
- Ação, Etiqueta controle e Etiqueta secretaria: as da linha `[LOAS.com_proposta]`

**COM PROPOSTA - aceita** — ver "Regra geral — proposta de acordo já aceita pela parte autora" (esta rotina NÃO é exceção a essa regra).

**SEM PROPOSTA - renda per capita atendida**
- Ação e Etiqueta controle: as da linha `[LOAS.renda_atendida]`
- Etiqueta secretaria: conforme o último dígito do número do processo — ver "Tabela do assessor por dígito do processo", abaixo

**SEM PROPOSTA - endereço a esclarecer**
- Ação e Etiqueta controle: as da linha `[LOAS.endereco_esclarecer]`

**SEM PROPOSTA - endereço em área de perícia social**
- Ação e Etiqueta controle: as da linha `[LOAS.endereco_area]`
- Perícia social: a etiqueta da área (tabela `zonas` de `Comum — Perícia social`) correspondente ao endereço

**SEM PROPOSTA - endereço fora das listas (constatação)**
- Ação: a da linha `[LOAS.endereco_fora]`
- Etiqueta controle: `Comum — Perícia social.etiqueta_fora_das_listas` (sozinha — nunca acompanhada da etiqueta controle de `[LOAS.endereco_area]`)

**INDEFINIDO** — deixe Ação, Etiqueta secretaria e Perícia social em branco, coloque na Etiqueta controle a da linha `[geral.direcao_analisar]` e explique no Fundamento o que impediu a conclusão.

**AVISO** — deixe a Ação em branco e coloque na Etiqueta controle a da linha `[geral.direcao_analisar]`; explique no Fundamento o pedido que exige decisão humana.

#### Tabela do assessor por dígito do processo — Benefício por incapacidade

Esta tabela é usada por mais de uma rotina desta skill (Rotina LOAS Social, Rotina Incapacidade, Rotina Limitação e a Rotina Diligência, classificação 2c) sempre que a regra da rotina remeter a ela. O último dígito do número do processo, imediatamente antes do dígito verificador, define a etiqueta secretaria: a etiqueta configurada para esse dígito na tabela `Comum — Assessores.assessor_por_digito`.

Exemplo: no processo `0000005-00.2026.4.05.0000`, o número antes do dígito verificador é `0000005`; o último dígito é `5` → a etiqueta configurada para o dígito `5`.

#### Tabela de zoneamento (bairros e municípios)

A lista de áreas da perícia social (etiqueta de cada área e os bairros e municípios que ela abrange) está na tabela `zonas` da seção `## Comum — Perícia social (zonas, bairros e municípios)` de `docs/configuracao-unidade.md` — consulte-a antes de classificar um endereço, em toda execução, porque a lista muda. Bairro ou município que não conste em nenhuma área dessa tabela recebe só `Comum — Perícia social.etiqueta_fora_das_listas`, sem a etiqueta controle de `[LOAS.endereco_area]`.

### Rotina Incapacidade e Rotina Limitação — simétricas, troque apenas a etiqueta analisada

Etiqueta de assessor para agricultor(a), nesta e nas demais rotinas: `Comum — Assessores.assessor_agricultor`. Se a unidade tiver respondido `não se aplica`, a etiqueta secretaria sai da "Tabela do assessor por dígito do processo"; a classificação continua "SEM PROPOSTA - agricultor(a)".

#### Rotina Incapacidade — etiqueta analisada `[etiqueta INC]`

**SEM PROPOSTA - agricultor(a)**
- Ação, Etiqueta controle e Etiqueta secretaria: as da linha `[INC_LIM.agricultor]` (secretaria: `Comum — Assessores.assessor_agricultor`)

**SEM PROPOSTA - outra profissão**
- Ação e Etiqueta controle: as da linha `[INC_LIM.outra_profissao]`
- Etiqueta secretaria: conforme o último dígito do número do processo — ver "Tabela do assessor por dígito do processo", acima

**COM PROPOSTA** — ver "Regra geral — proposta de acordo com necessidade de intimação da parte autora".

**COM PROPOSTA - aceita** — ver "Regra geral — proposta de acordo já aceita pela parte autora".

**INDEFINIDO** — deixe Ação, Etiqueta secretaria e Perícia social em branco, coloque na Etiqueta controle a da linha `[geral.direcao_analisar]` e explique no Fundamento o que impediu a conclusão.

#### Rotina Limitação — etiqueta analisada `[etiqueta LIM]`

**SEM PROPOSTA - agricultor(a)**
- Ação, Etiqueta controle e Etiqueta secretaria: as da linha `[INC_LIM.agricultor]` (secretaria: `Comum — Assessores.assessor_agricultor`)

**SEM PROPOSTA - outra profissão**
- Ação e Etiqueta controle: as da linha `[INC_LIM.outra_profissao]`
- Etiqueta secretaria: conforme o último dígito do número do processo — ver "Tabela do assessor por dígito do processo", acima

**COM PROPOSTA** — ver "Regra geral — proposta de acordo com necessidade de intimação da parte autora".

**COM PROPOSTA - aceita** — ver "Regra geral — proposta de acordo já aceita pela parte autora".

**INDEFINIDO** — deixe Ação, Etiqueta secretaria e Perícia social em branco, coloque na Etiqueta controle a da linha `[geral.direcao_analisar]` e explique no Fundamento o que impediu a conclusão.

### Rotina CEJUSC e Rotina Citados — simétricas, mesma classificação e mesmas etiquetas de saída, diferem apenas na etiqueta analisada (coluna A)

**COM PROPOSTA** — ver "Regra geral — proposta de acordo com necessidade de intimação da parte autora".

**COM PROPOSTA - aceita** — ver "Regra geral — proposta de acordo já aceita pela parte autora".

**COM PROPOSTA - recusada**
- Ação, Etiqueta controle e Etiqueta secretaria: as da linha `[CEJ_CIT.recusada]`

**COM PROPOSTA - contraproposta do autor** — o INSS deve ser intimado a se manifestar sobre a contraproposta; mesmas etiquetas de "Regra geral — proposta de acordo com necessidade de intimação da parte autora" (Ação e etiquetas da linha `[geral.proposta_intimar]`). No Fundamento, diga que é contraproposta do autor e que a intimação é do INSS.

**SEM PROPOSTA - CEJUSC (miserabilidade elevada)**
- Ação, Etiqueta controle e Etiqueta secretaria: as da linha `[CEJ_CIT.miserabilidade_elevada]`

**SEM PROPOSTA (miserabilidade não elevada)**
- Ação e Etiqueta controle: as da linha `[CEJ_CIT.miserabilidade_nao_elevada]`
- Etiqueta secretaria: conforme o último dígito do número do processo — ver "Tabela do assessor por dígito do processo", acima

**SEM PROPOSTA - agricultor(a)**
- Ação, Etiqueta controle e Etiqueta secretaria: as da linha `[CEJ_CIT.agricultor]` (secretaria: `Comum — Assessores.assessor_agricultor`)

**SEM PROPOSTA - outra profissão**
- Ação e Etiqueta controle: as da linha `[CEJ_CIT.outra_profissao]`
- Etiqueta secretaria: conforme o último dígito do número do processo — ver "Tabela do assessor por dígito do processo", acima

**INDEFINIDO** — deixe Ação, Etiqueta secretaria e Perícia social em branco, coloque na Etiqueta controle a da linha `[geral.direcao_analisar]` e explique no Fundamento o que impediu a conclusão.

### Rotina Conhecimento-Proposta, Rotina Perícia-Proposta e Rotina Audiência-Proposta — simétricas, mesma classificação e mesmas etiquetas de saída, diferem apenas na etiqueta analisada (coluna A)

**COM PROPOSTA - aceita** — ver "Regra geral — proposta de acordo já aceita pela parte autora".

**COM PROPOSTA - não aceita**
- Ação, Etiqueta controle e Etiqueta secretaria: as da linha `[CP_PP_AP.nao_aceita]`

**INDEFINIDO** — deixe Ação, Etiqueta secretaria e Perícia social em branco, coloque na Etiqueta controle a da linha `[geral.direcao_analisar]` e explique no Fundamento o que impediu a conclusão.

### Rotina Contestação Automática e Rotina Contestação — simétricas, mesma classificação e mesmas etiquetas de saída, diferem apenas na etiqueta analisada (coluna A)

**COM PROPOSTA** — ver "Regra geral — proposta de acordo com necessidade de intimação da parte autora".

**COM PROPOSTA - aceita** — ver "Regra geral — proposta de acordo já aceita pela parte autora".

**SEM PROPOSTA**
- Ação e Etiqueta controle: as da linha `[CA_CT.sem_proposta]`
- Etiqueta secretaria: (não se aplica — a etiqueta do assessor já consta no processo, não é atribuída por esta rotina)

**INDEFINIDO** — deixe Ação, Etiqueta secretaria e Perícia social em branco, coloque na Etiqueta controle a da linha `[geral.direcao_analisar]` e explique no Fundamento o que impediu a conclusão.

### Rotina Laudo (Assessoria) — etiqueta analisada `[etiqueta LA]`

**COM PROPOSTA** — ver "Regra geral — proposta de acordo com necessidade de intimação da parte autora".

**COM PROPOSTA - aceita** — ver "Regra geral — proposta de acordo já aceita pela parte autora".

**COM PROPOSTA - recusada**
- Ação, Etiqueta controle e Etiqueta secretaria: as da linha `[LA.recusada]`

**SEM PROPOSTA - CEJUSC (miserabilidade elevada)**
- Ação, Etiqueta controle e Etiqueta secretaria: as da linha `[LA.miserabilidade_elevada]`

**SEM PROPOSTA (miserabilidade não elevada)**
- Ação e Etiqueta controle: as da linha `[LA.miserabilidade_nao_elevada]`
- Etiqueta secretaria: conforme o último dígito do número do processo — ver "Tabela do assessor por dígito do processo", acima

**INDEFINIDO** — deixe Ação, Etiqueta secretaria e Perícia social em branco, coloque na Etiqueta controle a da linha `[geral.direcao_analisar]` e explique no Fundamento o que impediu a conclusão.

### Rotina Esclarecer Localização (Perícia Social) e Rotina Endereço (Cumprimento) — mesmo procedimento nas hipóteses de dilação de prazo e de omissão da parte, diferem no endereço informado e na etiqueta analisada (coluna A)

#### Rotina Esclarecer Localização (Perícia Social) — etiqueta analisada `[etiqueta EL]`

**Endereço informado**
- Endereço corresponde a uma das áreas da tabela `zonas` de `Comum — Perícia social` (ver "Tabela de zoneamento", acima):
  - Ação, Etiqueta controle e Etiqueta secretaria: as da linha `[EL.endereco_area]`
  - Perícia social: a etiqueta da área correspondente ao endereço
- Endereço fora de todas as áreas:
  - Ação: a da linha `[EL.endereco_fora]`
  - Etiqueta controle: `Comum — Perícia social.etiqueta_fora_das_listas` (sozinha — nunca acompanhada da etiqueta controle de `[EL.endereco_area]`)

**Pedido de dilação de prazo (autor)**
- Ação e Etiqueta controle: as da linha `[DIL.1c]`
- Prazo para intimação da parte: o número de dias pedidos na petição de dilação
- Fundamento: registrar também o número de identificação da petição

**Parte autora omissa**
- Ação e Etiqueta controle: as da linha `[EL_EC.omissa]`
- Etiqueta secretaria: (não se aplica)

**AVISO** — deixe a Ação em branco e coloque na Etiqueta controle a da linha `[geral.direcao_analisar]`; explique no Fundamento o pedido que exige decisão humana.

#### Rotina Endereço (Cumprimento) — etiqueta analisada `[etiqueta EC]`

**Endereço informado**
- Ação, Etiqueta controle e Etiqueta secretaria: as da linha `[EC.endereco_informado]`

**Pedido de dilação de prazo (autor)**
- Ação e Etiqueta controle: as da linha `[DIL.1c]`
- Prazo para intimação da parte: o número de dias pedidos na petição de dilação
- Fundamento: registrar também o número de identificação da petição

**Parte autora omissa**
- Ação e Etiqueta controle: as da linha `[EL_EC.omissa]`
- Etiqueta secretaria: (não se aplica)

**AVISO** — deixe a Ação em branco e coloque na Etiqueta controle a da linha `[geral.direcao_analisar]`; explique no Fundamento o pedido que exige decisão humana.

A etiqueta de ASSUNTO nunca é tocada, em nenhuma das dezessete rotinas.

Confira a grafia exata no cadastro do PJe antes de prescrever. Nome digitado com diferença cria etiqueta nova em vez de aplicar a existente.

## Entregável

Um único arquivo .xlsx, fonte Arial, duas abas, com as dezessete rotinas juntas. A coluna A separa as linhas de C, de D, de Planilha de Cálculo, de Diligência, de LOAS Social, de Incapacidade, de Limitação, de CEJUSC, de Citados, de Conhecimento-Proposta, de Perícia-Proposta, de Audiência-Proposta, de Contestação Automática, de Contestação, de Laudo (Assessoria), de Esclarecer Localização (Perícia Social) e de Endereço (Cumprimento).

**Aba `Triagem`** — uma linha por processo, nesta ordem exata de colunas:

| A | B | C | D | E | F | G | H |
|---|---|---|---|---|---|---|---|
| Etiqueta analisada | Fase de origem | Processo | Classificação | Ação | Etiqueta controle | Etiqueta secretaria | Perícia social |

| I | J | K | L | M | N | O | P | Q | R |
|---|---|---|---|---|---|---|---|---|---|
| Fundamento | Documento não lido | Parte autora | Assunto | Prioridade | Sigiloso | Dias na fase | Último movimento | Prazo para intimação da parte | Endereço localizado |

Ordene por etiqueta analisada e, dentro de cada uma, por dias na fase, do maior para o menor.

A coluna **Etiqueta controle** recebe as etiquetas configuradas como etiqueta controle, a **Etiqueta secretaria** as configuradas como etiqueta secretaria (inclusive as de assessor), e **Perícia social** as etiquetas de área da tabela `zonas` de `Comum — Perícia social` (ver "Como preencher as três colunas de etiqueta") — cada linha tem as três colunas prontas, preenchendo só as que se aplicam à classificação daquele processo.

A coluna **Prazo para intimação da parte** se aplica à Rotina Diligência, à Rotina Esclarecer Localização (Perícia Social) e à Rotina Endereço (Cumprimento): registra o prazo determinado no próprio despacho quando a classificação abre vista a uma das partes (1a, 2a, na Rotina Diligência), ou o número de dias pedidos, nos casos de pedido de dilação de prazo (1c, na Rotina Diligência; "Pedido de dilação de prazo (autor)", nas outras duas). Fica em branco nas demais rotinas e nos demais casos dessas três rotinas (1b, 1d, 2b, 2c, 3, COM PROPOSTA, COM PROPOSTA - aceita, COM PROPOSTA - recusada, Endereço informado, Parte autora omissa, ou AVISO).

A coluna **Endereço localizado** só se aplica à Rotina LOAS Social, nos casos em que houve apuração de endereço (renda per capita não atendida ou não localizada): registra o endereço encontrado, pontos de referência e telefone, quando houver. Fica em branco nos demais casos e nas demais rotinas.

O **Fundamento** é a justificativa em uma ou duas frases, com datas. Nas rotinas C e D: qual a data do laudo, o que veio depois dele e por que isso leva à classificação — quando a conclusão vier da peça de impossibilidade de acordo, diga isso com todas as letras. Exemplos: "Laudo pericial juntado em 23/08/2026. Posterior: impugnação do autor em 29/08 e decurso de prazo do INSS. Nenhuma proposta de acordo." / "Laudo pericial em 18/08/2026. Petição do INSS em 15/09 com teor de IMPOSSIBILIDADE DE ACORDO." Nos casos de proposta já aceita (em qualquer rotina — ver "Regra geral — proposta de acordo já aceita pela parte autora"), registre a data da aceitação e o estágio em que o processo se encontra. Exemplo: "INSS propôs acordo de auxílio-acidente em 05/09/2026. Parte autora manifestou aceitação em 14/09/2026. Aguarda homologação do acordo e implantação do benefício." Na rotina Planilha de Cálculo: qual a data da juntada da planilha, o que veio depois dela e por que isso leva à classificação; nos casos IMPUGNAÇÃO/DISCORDÂNCIA, inclua também o número de identificação da petição de impugnação. Exemplo: "Planilha de cálculo juntada em 02/09/2026. Posterior: petição do INSS em 10/09 impugnando o valor apurado, petição de id. 123456789." Na rotina Diligência: o que o último despacho determinou, o que veio depois e por que isso leva à classificação; nos casos de proposta do INSS (COM PROPOSTA, COM PROPOSTA - aceita ou COM PROPOSTA - recusada), a data e o id da proposta e, se for o caso, a data da aceitação ou da recusa; nos casos de pedido de dilação de prazo, inclua também o número de identificação da petição; nos casos 2c com etiqueta de assessor atribuída, registre também qual condição da ordem de verificação foi aplicada (profissão agricultor, assunto específico, ou dígito do processo); nos casos 3, registre qual dos padrões de conclusão direta se aplicou — intimação única sem vista subsequente, ofício a órgão/empresa com vista conjunta às partes, ou despacho "dê-se vista às partes" — e o que o despacho determinou; o teor da eventual manifestação das partes não altera a classificação, mas pode ser mencionado brevemente. Exemplos: "Despacho de 01/09/2026 intimou a parte autora a juntar documento, com prazo de 5 dias e vista ao INSS em seguida. Parte autora pediu dilação de 15 dias na petição de id. 123456789." / "Despacho de 20/08/2026 abriu vista ao INSS; INSS se manifestou em 10/09 sem objeção. Assunto do processo: pensão por morte → etiqueta do assessor de pensão por morte." / "Despacho de 05/09/2026 intimou apenas o INSS a se manifestar sobre o laudo, sem prever vista à parte autora, determinando que os autos voltassem conclusos em seguida. INSS se manifestou em 12/09 sem objeção." / "Despacho de 08/09/2026 determinou ofício ao empregador solicitando informações funcionais; juntada da resposta em 15/09 e vista conjunta às partes, decorrido o prazo sem manifestação de nenhuma delas." / "Despacho de 10/09/2026: 'Dê-se vista às partes'. Decorrido o prazo, apenas o INSS se manifestou sem impugnar." Na rotina LOAS Social: a mesma lógica de C/D quanto ao laudo, à proposta e à eventual aceitação; nos casos SEM PROPOSTA, se a renda per capita foi atendida ou não (com base no quadro RESUMO DA RENDA DO GRUPO FAMILIAR) e, quando houve apuração de endereço, o que foi encontrado e a etiqueta de zoneamento aplicável. Exemplo: "Laudo pericial em 10/08/2026. Sem proposta de acordo (petição do INSS de 20/08 sem oferta de termos). Renda per capita não atendida. Endereço localizado no bairro <bairro>, <município>/<UF> — área <etiqueta da área>." Nas rotinas Incapacidade e Limitação: mesma lógica de C/D quanto ao laudo e à proposta; nos casos SEM PROPOSTA, registre a profissão declarada no laudo médico e, quando não for agricultor(a), o dígito do processo usado para o assessor. Exemplo: "Laudo pericial em 12/08/2026. Sem proposta de acordo. Profissão declarada: agricultor. Etiqueta do assessor de agricultor." Nas rotinas CEJUSC e Citados: se há proposta de acordo e a eventual aceitação, mesma lógica das demais; nos casos SEM PROPOSTA com assunto Pessoa com Deficiência ou Idoso, o que a perícia social ou o auto de constatação mostraram quanto à miserabilidade (com data do documento) e, quando não elevada, o dígito do processo usado para o assessor; nos casos SEM PROPOSTA com outro assunto, a profissão declarada no laudo médico e, quando não for agricultor(a), o dígito do processo usado para o assessor. Exemplo: "Auto de constatação de 03/09/2026 mostra grau elevado de miserabilidade. Assunto: Idoso. Designada audiência CEJUSC." / "Laudo social de 05/09/2026 não mostra grau elevado de miserabilidade. Assunto: Pessoa com Deficiência. Etiqueta do assessor do dígito 2 do processo." / "Sem proposta de acordo. Assunto: Pensão por morte (não Deficiência/Idoso). Laudo médico: profissão declarada motorista. Etiqueta do assessor do dígito 4 do processo." Nas rotinas Conhecimento-Proposta, Perícia-Proposta e Audiência-Proposta: registre a data da proposta e da intimação da parte autora e, depois delas, o que ocorreu — aceitação expressa, recusa expressa, ou decurso de prazo sem manifestação. Exemplo: "INSS propôs acordo em 20/08/2026; parte autora intimada. Decorrido o prazo sem manifestação até 15/09/2026. Designada audiência CEJUSC." / "INSS propôs acordo em 22/08/2026; parte autora manifestou recusa expressa em 05/09/2026. Designada audiência CEJUSC." Nas rotinas Contestação Automática e Contestação: registre se há ou não proposta de acordo do INSS; havendo, a data da proposta e, se for o caso, a data da aceitação pela parte autora; não havendo proposta, basta registrar essa ausência — não é preciso apurar profissão, endereço ou dígito do processo, pois a etiqueta do assessor já consta no processo. Exemplo: "Sem proposta de acordo do INSS. Concluído para a fase seguinte." / "INSS propôs acordo em 12/09/2026; parte autora ainda não intimada a respeito." / "INSS propôs acordo em 08/09/2026; parte autora manifestou aceitação em 16/09/2026. Aguarda homologação." Na rotina Laudo (Assessoria): mesma lógica das rotinas com proposta de acordo (COM PROPOSTA/aceita) quando houver; nos casos SEM PROPOSTA, o que a perícia social ou o auto de constatação mostraram quanto à miserabilidade (com data do documento) e, quando não elevada, o dígito do processo usado para o assessor. Exemplo: "Laudo social de 07/09/2026 mostra grau elevado de miserabilidade. Designada audiência CEJUSC." / "Auto de constatação de 09/09/2026 não mostra grau elevado de miserabilidade. Etiqueta do assessor do dígito 8 do processo." Nas rotinas Esclarecer Localização (Perícia Social) e Endereço (Cumprimento): registre a data da intimação da parte autora para informar dados de localização do imóvel e, depois dela, o que ocorreu — dados informados, pedido de dilação (com o número da petição) ou decurso de prazo sem manifestação. Exemplo: "Parte autora intimada em 01/09/2026 a informar dados de localização do imóvel. Informou endereço em petição de 10/09/2026." / "Parte autora intimada em 03/09/2026; pediu dilação de 10 dias na petição de id. 123456789." / "Parte autora intimada em 05/09/2026; decorrido o prazo sem manifestação até 20/09/2026."

**Aba `Resumo`** — colunas: Etiqueta analisada, Classificação, Quantidade. Um bloco de linhas para cada etiqueta (as classificações de C/D: SEM PROPOSTA, COM PROPOSTA, COM PROPOSTA - aceita, COM PROPOSTA - recusada, COM PROPOSTA - contraproposta do autor, INDEFINIDO; as da Planilha de Cálculo: IMPUGNAÇÃO/DISCORDÂNCIA, QUALQUER OUTRA PETIÇÃO, INDEFINIDO; as da Diligência: COM PROPOSTA, COM PROPOSTA - aceita, COM PROPOSTA - recusada, 1a, 1b, 1c, 1d, 2a, 2b, 2c, 3 e AVISO; as da LOAS Social: COM PROPOSTA, COM PROPOSTA - aceita, SEM PROPOSTA - renda per capita atendida, SEM PROPOSTA - endereço em área de perícia social, SEM PROPOSTA - endereço a esclarecer, SEM PROPOSTA - endereço fora das listas (constatação), INDEFINIDO e AVISO; as da Incapacidade e as da Limitação (mesmo conjunto para cada uma): SEM PROPOSTA - agricultor(a), SEM PROPOSTA - outra profissão, COM PROPOSTA, COM PROPOSTA - aceita, INDEFINIDO; as da CEJUSC e as da Citados (mesmo conjunto para cada uma): COM PROPOSTA, COM PROPOSTA - aceita, COM PROPOSTA - recusada, COM PROPOSTA - contraproposta do autor, SEM PROPOSTA - CEJUSC (miserabilidade elevada), SEM PROPOSTA (miserabilidade não elevada), SEM PROPOSTA - agricultor(a), SEM PROPOSTA - outra profissão, INDEFINIDO; as da Conhecimento-Proposta, Perícia-Proposta e Audiência-Proposta (mesmo conjunto para cada uma): COM PROPOSTA - aceita, COM PROPOSTA - não aceita, INDEFINIDO; as da Contestação Automática e as da Contestação (mesmo conjunto para cada uma): COM PROPOSTA, COM PROPOSTA - aceita, SEM PROPOSTA, INDEFINIDO; as da Laudo (Assessoria): COM PROPOSTA, COM PROPOSTA - aceita, COM PROPOSTA - recusada, SEM PROPOSTA - CEJUSC (miserabilidade elevada), SEM PROPOSTA (miserabilidade não elevada), INDEFINIDO; as da Esclarecer Localização (Perícia Social) e as da Endereço (Cumprimento) (mesmo conjunto para cada uma): Endereço informado, Pedido de dilação de prazo (autor), Parte autora omissa, AVISO; uma futura rotina com hipótese de proposta de acordo inclui igualmente suas próprias linhas COM PROPOSTA e COM PROPOSTA - aceita), seguido de Total analisados e Com documento não lido (marcados). Use fórmulas `COUNTIFS`/`COUNTA` sobre a aba Triagem, nunca valores digitados — `COUNTIFS` porque é preciso cruzar etiqueta e classificação.

Nome do arquivo: `Triagem_AAAA-MM-DD.xlsx`. Se o usuário tiver pasta conectada, salve lá além de entregar na conversa.

## Ao terminar

Relate em poucas linhas, separando C, D, Planilha de Cálculo, Diligência, LOAS Social, Incapacidade, Limitação, CEJUSC, Citados, Conhecimento-Proposta, Perícia-Proposta, Audiência-Proposta, Contestação Automática, Contestação, Laudo (Assessoria), Esclarecer Localização (Perícia Social) e Endereço (Cumprimento): quantos analisados, a divisão por classificação, quantos tiveram documento marcado como lido, e a relação dos INDEFINIDOS/AVISOS com o motivo de cada um. Em qualquer rotina com hipótese de proposta de acordo (atual ou futura), destaque também os casos de proposta já aceita (COM PROPOSTA - aceita), com a data da aceitação. Na Rotina Planilha de Cálculo, destaque um a um todos os casos IMPUGNAÇÃO/DISCORDÂNCIA, no formato "impugnação ao cálculo id. X" (X = número de identificação da petição de impugnação). Na Diligência, destaque também os casos de pedido de dilação de prazo, com o prazo pedido e o número da petição de cada um, os casos 2c em que não foi possível atribuir etiqueta de assessor (sem laudo médico juntado e assunto fora da lista), para atribuição manual, e quantos processos foram classificados no caso 3 (conclusão direta, independente de manifestação), com a divisão por padrão (intimação única / ofício a órgão-empresa com vista conjunta / "dê-se vista às partes"). Na LOAS Social, destaque ainda os casos com etiqueta de assessoria atribuída (SIM na renda per capita), os casos com perícia social designada (área de perícia social) e o endereço encontrado, e os casos de endereço a esclarecer. Nas rotinas Incapacidade e Limitação, destaque a divisão entre agricultor(a) e outra profissão, com a etiqueta de assessor atribuída em cada caso. Nas rotinas CEJUSC e Citados, destaque os casos com audiência CEJUSC designada (miserabilidade elevada), os casos de miserabilidade não elevada (assunto Pessoa com Deficiência ou Idoso) concluídos com etiqueta de assessor por dígito do processo, e a divisão entre agricultor(a) e outra profissão nos demais casos, com a etiqueta de assessor atribuída em cada caso. Nas rotinas Conhecimento-Proposta, Perícia-Proposta e Audiência-Proposta, destaque a divisão entre os casos de aceitação da proposta (COM PROPOSTA - aceita, com a data da aceitação) e os casos de recusa ou ausência de manifestação, com audiência CEJUSC designada (COM PROPOSTA - não aceita). Nas rotinas Contestação Automática e Contestação, destaque quantos processos foram concluídos por ausência de proposta de acordo (SEM PROPOSTA) e, entre os que tiveram proposta, quantos já foram aceitos (COM PROPOSTA - aceita, com a data) e quantos ainda aguardam intimação da parte autora (COM PROPOSTA). Na rotina Laudo (Assessoria), destaque a divisão entre proposta de acordo (quando houver, com a eventual aceitação) e os casos SEM PROPOSTA, com audiência CEJUSC designada (miserabilidade elevada) versus concluídos com etiqueta de assessor por dígito do processo (miserabilidade não elevada). Nas rotinas Esclarecer Localização (Perícia Social) e Endereço (Cumprimento), destaque quantos processos tiveram o endereço informado (com a etiqueta de saída própria de cada rotina), quantos tiveram pedido de dilação de prazo (com o prazo pedido e o número da petição de cada um) e quantos ficaram com a parte autora omissa.

Se algum processo não for encontrado na consulta ou os autos não abrirem, diga quais e por quê. Nunca relate como analisado um processo que você não conseguiu abrir.
