---
name: "jef-analise-laudo"
description: "Para processos da tarefa do PJe em que se analisa o laudo pericial (nome configurado pela unidade), com Assunto de benefício por incapacidade (Aposentadoria por Invalidez, Auxílio por Incapacidade Temporária, Auxílio-Acidente, Incapacidade Laborativa Parcial ou Permanente, Pessoa com Deficiência, ou Benefício Assistencial - Deficiente ou Idoso), a partir de CSV ou lista de processos, lê a petição inicial e o laudo pericial (o laudo médico ou, no BPC, o laudo social), classifica o grau de incapacidade/limitação e a duração, e prescreve a etiqueta cabível (LOAS - Designar social, Prioridade, Incapacidade - CEJUSC, Limitação moderada ou grave, Laudo C ou Laudo D; quando as duas partes já se manifestaram sobre o laudo ou tiveram o prazo decorrido e não há MPF, as etiquetas da triagem de expediente), ou, no lugar dela, a providência de complementação de laudo (laudo de outra pessoa, quesitos para menores de 16 anos), de exame complementar ou de perícia in loco, com a fase para onde movimentar, e, quando cabível, a providência de curatela, gerando relatório em .xlsx — sem inserir etiqueta no PJe, para a unidade (JEF do TRF5) que a configurou em docs/configuracao-unidade.md. Desenvolvida na 7ª Vara Federal da Paraíba."
---

# Análise do Laudo Pericial (médico e social) — Benefícios por Incapacidade e BPC no PJe — da unidade

Desenvolvida na 7ª Vara Federal da Paraíba. As regras de classificação refletem as decisões da 7ª Vara e do seu Setor de Perícias (as menções "decisão da 7ª Vara" e "Setor de Perícias", com data, indicam essa origem) e devem ser revistas pela unidade antes do uso com processos reais. Os nomes de etiquetas, fases e modelos de minuta são os da unidade, lidos de `docs/configuracao-unidade.md` (ver "Configuração da unidade — antes de tudo").

Use quando o usuário fornecer um CSV exportado da tarefa configurada em `jef-analise-laudo.tarefa_analisar_laudo` no PJe 1º grau/TRF5, ou informar diretamente na conversa uma lista de processos dessa tarefa, com Assunto principal dentro do escopo desta rotina (ver Entrada, abaixo), e pedir a análise do laudo médico pericial para a etiqueta cabível.

## Limite de atuação — leia antes de tudo

Esta skill **lê e diagnostica**. A única gravação autorizada no PJe é clicar em **MARCAR TODOS COMO LIDOS** quando houver documentos pendentes de leitura.

Nunca, em hipótese alguma:
- inserir ou retirar etiqueta;
- movimentar processo ou encaminhar para outra fase;
- preencher minuta, selecionar tipo de documento ou clicar em ASSINAR DOCUMENTO(S);
- expedir intimação ou qualquer outra comunicação;
- autorizar, registrar ou de qualquer forma tratar pagamento de perícia;
- digitar senha, certificado, token ou PIN. Aparecendo tela de login, pare e avise.

A etiqueta prescrita na planilha é **prescrição para quem vai executar**, nunca registro de etiqueta já inserida. O mesmo vale para a providência de curatela (etiqueta de curador, intimação, prazo e modelo de minuta): são prescrições para execução manual pela secretaria, nunca ações desta skill. O pagamento da perícia mencionado no procedimento de curatela é fluxo administrativo/financeiro à parte, fora do alcance desta skill — a skill apenas sinaliza, no relatório, que ele é necessário.

Todo o resto desta skill deve ser mantido intacto de uma versão para a outra: nenhuma alteração além da que o usuário pediu expressamente deve ser feita sem consulta prévia.

## Configuração da unidade — antes de tudo

Os dados próprios da unidade (nomes de etiquetas, de tarefas e fases do PJe, modelo de minuta, código do órgão) não estão nesta skill: ficam em `docs/configuracao-unidade.md`, na pasta do projeto. No texto abaixo, eles aparecem como referência a uma chave da configuração, na forma `<seção>.<chave>` (ex.: `jef-analise-laudo.etiqueta_laudo_d` é o item `etiqueta_laudo_d` da seção `## jef-analise-laudo`).

1. Leia `docs/configuracao-unidade.md` no início de toda execução, antes da confirmação de quantitativos. Nunca de memória, nunca de cópia antiga anexada à conversa.
2. Se o arquivo não existir, crie-o com o título `# Configuração da unidade` e acrescente as seções desta skill, preenchidas pelas respostas do usuário. O arquivo nunca vem no pacote da skill; se já existir (criado por outra skill), não o sobrescreva: só acrescente as seções e os itens que faltarem.
3. Se faltar alguma das seções listadas em "Perguntas da configuração", ou se algum item delas estiver `PENDENTE` ou vazio, **pare antes de abrir qualquer processo** e faça ao usuário todas as perguntas que faltam, de uma vez, agrupadas por seção, explicando o que é cada item. Grave as respostas no arquivo (uma linha `- <chave>: <valor>` por item; item que o usuário não souber responder fica `PENDENTE`), mostre o resumo do que foi gravado e peça o "pode seguir". Com item ainda `PENDENTE`, não comece a análise.
4. Seção comum (`## Comum — ...`) já preenchida por outra skill: reaproveite, sem perguntar de novo. Se ela já existir com outro nome de chave para o mesmo dado (ex.: `orgao` em vez de `codigo_orgao`), use o item existente e não crie duplicata; acrescente só os itens que faltarem.
5. Nunca use valor que não esteja no arquivo; nunca presuma nem use os valores da 7ª Vara Federal da Paraíba. Se, no meio da execução, faltar um dado, pare e pergunte, e grave a resposta no arquivo.
6. Na seção própria desta skill, a etiqueta e a fase podem ser a mesma para mais de uma classificação (ex.: a mesma etiqueta para o adicional de 25% e para o laudo social com renda até 1/2 SM): o usuário repete o valor.
7. O arquivo pode ser editado à mão pela unidade depois; vale sempre o que estiver nele na hora da execução.
8. **Nome anterior da skill:** até 17/11/2026 ela se chamava `jef-analise-laudo-medico`, e a seção da configuração tinha esse nome. Se o arquivo tiver a seção `## jef-analise-laudo-medico` e não tiver `## jef-analise-laudo`, renomeie o título da seção para `## jef-analise-laudo`, mantendo os itens, e avise o usuário; não pergunte de novo o que já está respondido. Se a pasta `.claude\skills\jef-analise-laudo-medico` ainda existir, diga ao usuário que ela é a versão antiga desta skill e ofereça apagá-la (só com a confirmação dele).
9. **Item novo de 18/11/2026:** `etiqueta_incapacidade_cejusc`. Configuração gravada antes dessa data não o tem: pergunte só ele (regra 3) antes de começar.
10. **Triagem de expediente:** a regra das partes já ouvidas (ver a seção própria) aplica as regras da `jef-expediente-manifestacao`, que tem de estar instalada na mesma pasta, com as etiquetas da configuração dela (a seção `## jef-expediente-manifestacao` e as seções comuns que ela usa: assessores e perícia social). Se a seção dela faltar ou tiver item `PENDENTE`, faça antes as perguntas da configuração daquela skill, como ela manda; sem ela instalada, avise o usuário e trate os processos com as partes já ouvidas pela etiqueta da análise do laudo, dizendo quais são.

### Perguntas da configuração

Os exemplos abaixo são **fictícios**, só para mostrar o formato; nunca os use como resposta.

**Seção `## Comum — Unidade`** (compartilhada com as demais skills)

| Chave | Pergunta | Exemplo (fictício) |
|---|---|---|
| `nome_unidade` | Qual é o nome da unidade? | `9ª Vara Federal de Cidade Exemplo` |
| `secao_subsecao` | De qual seção e subseção judiciária? | `Seção Judiciária de Exemplo — Subseção de Cidade Exemplo` |
| `codigo_orgao` | Quais são os 4 últimos dígitos do número dos processos da unidade (código do órgão, campo "NumeroOrgaoJustica" da consulta processual)? | `9999` (em `0000000-00.2026.4.05.9999`) |
| `tribunal` | Qual é o tribunal? Esta skill só funciona no PJe 1º grau do TRF5. | `TRF5` |
| `cidade_uf` | Cidade e UF da sede da unidade. | `Cidade Exemplo/XX` |

Nesta skill é usado o `codigo_orgao` (consulta processual) e o `tribunal` (que tem de ser `TRF5`); os demais itens servem às outras skills e ao cabeçalho do relato.

**Seção `## jef-analise-laudo`** (própria desta skill)

| Chave | Pergunta | Exemplo (fictício) |
|---|---|---|
| `tarefa_analisar_laudo` | Nome exato, no painel de Tarefas do PJe, da tarefa em que ficam os processos com laudo pericial juntado para análise (é dela que sai o CSV). | `[JEF] Perícia - Laudo juntado` |
| `etiqueta_loas_designar_social` | Etiqueta para laudo de incapacidade (A ou B) em BPC definitiva ou de 2 anos ou mais, ou limitação moderada/acentuada de menor de idade: o processo vai para a perícia social. | `PERÍCIA - Designar perícia social` |
| `etiqueta_prioridade` | Etiqueta para laudo com incapacidade que dá prioridade (BPC com menos de 2 anos; pedido previdenciário de segurado especial ou com alegação do INSS de falta de carência ou de perda da qualidade de segurado; limitação com recomendação de afastamento nesses mesmos casos). | `PERÍCIA - Laudo com incapacidade (prioridade)` |
| `etiqueta_incapacidade_cejusc` | Etiqueta para laudo com incapacidade (A ou B, ou limitação com recomendação de afastamento) em pedido previdenciário, fora as exceções da prioridade: o processo vai para a conciliação. | `CONCILIAÇÃO - Aguardar prazo` |
| `etiqueta_limitacao_moderada_grave` | Etiqueta para laudo com limitação moderada ou acentuada (grave), parte autora maior de idade. | `PERÍCIA - Limitação moderada/grave` |
| `etiqueta_laudo_c` | Etiqueta para laudo com limitação leve ("Laudo C"). | `PERÍCIA - Limitação leve` |
| `etiqueta_laudo_d` | Etiqueta para laudo sem limitação ("Laudo D"). | `PERÍCIA - Laudo negativo` |
| `etiqueta_adicional_25` | Etiqueta para o pedido de adicional de 25% com assistência permanente reconhecida no laudo. | `CONCILIAÇÃO - Aguardar prazo` |
| `etiqueta_social_esclarecer_localizacao` | Etiqueta para laudo social em que a assistente social não achou o endereço, há divergência sobre ele ou a parte se mudou. | `PERÍCIA SOCIAL - Endereço a esclarecer` |
| `etiqueta_social_divergencia` | Etiqueta para laudo social com divergência entre o declarado pela parte e o observado. | `ASSESSORIA - Laudo social` |
| `etiqueta_social_renda_ate_meio_sm` | Etiqueta para laudo social com renda per capita até 1/2 salário mínimo. | `CONCILIAÇÃO - Aguardar prazo` |
| `etiqueta_social_renda_acima_meio_sm` | Etiqueta para laudo social com renda per capita acima de 1/2 salário mínimo. | `ASSESSORIA - Laudo social` |
| `etiqueta_complementacao_laudo` | Etiqueta para pedir ao perito a complementação do laudo (laudo de outra pessoa; quesitos de menor de 16 anos). | `PERÍCIA - Complementar laudo` |
| `etiqueta_exame_complementar` | Etiqueta para o caso em que o perito pede exames complementares para concluir. | `PERÍCIA - Exames pedidos pelo perito` |
| `etiqueta_redesignar_pericia` | Etiqueta para o processo cuja perícia não se realizou (comunicação do perito: ausência da parte, perito impedido, menor sem documento com foto) e precisa de nova designação. | `PERÍCIA - Redesignar` |
| `etiqueta_aviso_indefinido` | Etiqueta para os casos que vão à análise humana da direção (AVISO e INDEFINIDO). | `DIREÇÃO - Analisar` |
| `etiqueta_curador` | Etiqueta para a providência de curatela (regularizar a representação por curador). | `REPRESENTAÇÃO - Curador` |
| `fase_complementacao_laudo` | Tarefa/fase do PJe para onde movimentar o processo que aguarda a complementação do laudo pelo perito. | `[JEF] Perícia - Aguardar perito` |
| `fase_redesignar_pericia` | Tarefa/fase do PJe para onde movimentar o processo cuja perícia precisa ser redesignada (se a unidade usa a própria etiqueta como fase, repita o valor). | `PERÍCIA - Redesignar` |
| `fase_exame_complementar` | Tarefa/fase do PJe para onde movimentar o processo que aguarda a parte autora providenciar os exames. | `[JEF] Prazo - Aguardando` |
| `modelo_minuta_curador` | Nome do modelo de minuta da intimação da parte autora para regularizar a representação (curador). | `Intimação - regularizar curatela` |

### Como a configuração chega ao script

Em lote, o `analise-lote.js` não traz nenhum nome de etiqueta: depois de carregá-lo (ver "Execução em lote"), monte o objeto a partir da seção `## jef-analise-laudo` do arquivo, copiando o valor de cada item `etiqueta_*` tal como gravado (sem reescrever nem abreviar), e passe-o, junto com o salário mínimo conferido, numa chamada do javascript_tool:

```js
LM.config({ sm: <salário mínimo>, etiquetas: {
  etiqueta_loas_designar_social: '<valor do arquivo>', etiqueta_prioridade: '<valor>', etiqueta_limitacao_moderada_grave: '<valor>',
  etiqueta_laudo_c: '<valor>', etiqueta_laudo_d: '<valor>', etiqueta_adicional_25: '<valor>', etiqueta_incapacidade_cejusc: '<valor>',
  etiqueta_social_esclarecer_localizacao: '<valor>', etiqueta_social_divergencia: '<valor>',
  etiqueta_social_renda_ate_meio_sm: '<valor>', etiqueta_social_renda_acima_meio_sm: '<valor>',
  etiqueta_complementacao_laudo: '<valor>', etiqueta_exame_complementar: '<valor>', etiqueta_redesignar_pericia: '<valor>', etiqueta_aviso_indefinido: '<valor>' } })
```

O retorno diz quantas das 14 etiquetas foram configuradas; a configuração fica em `LM.cfg`. Enquanto faltar alguma, `LM.fila` não roda e devolve "configure ... antes de iniciar", com as chaves que faltam. A etiqueta de curador, as fases e o modelo de minuta não passam pelo script: a skill os lê do arquivo ao preencher a planilha. O `gera-relatorio.ps1` não usa dado da unidade (monta o .xlsx só a partir do andamento).

## Entrada — CSV ou lista de processos na conversa

Os processos a analisar podem chegar de duas formas, e ambas são igualmente válidas:

**A) CSV exportado do PJe.** O arquivo é gerado no PJe: Painel do usuário → coluna **TAREFAS** → ícone de seta à esquerda da tarefa configurada em `jef-analise-laudo.tarefa_analisar_laudo` (confirme o nome exato da tarefa no painel; pode variar ligeiramente na grafia).

Se o usuário pedir uma nova análise sem anexar um novo CSV neste pedido, use o **último CSV que ele forneceu nesta conversa** — não peça o arquivo de novo, deixando isso explícito na confirmação de quantitativos (abaixo), com o nome do arquivo e em que ponto da conversa foi fornecido. Se nenhum CSV tiver sido fornecido em nenhum momento da conversa, e o usuário também não informar uma lista de processos, peça o CSV ou a lista antes de prosseguir — não presuma.

Leia com separador `;` e encoding `utf-8-sig`. Campos usados: `numeroProcesso`, `assuntoPrincipal`, `sigiloso`, `nomeTarefa`.

Considere só os processos cujo `assuntoPrincipal` seja um dos abaixo (comparando ignorando caixa e pequenas variações de grafia) — são os benefícios cuja concessão depende de perícia médica para aferir incapacidade ou limitação:
- `Aposentadoria por Invalidez`
- `Auxílio por Incapacidade Temporária`
- `Auxílio-Acidente (Art. 86)`
- `Incapacidade Laborativa Parcial`
- `Incapacidade Laborativa Permanente`
- `Pessoa com Deficiência`
- `Benefício Assistencial (Art. 203, V CF/88) - Deficiente`
- `Incapacidade Laborativa Temporária`, `Auxílio-Doença Acidentário` e `Aposentadoria por Invalidez Acidentária` (incluídos pela 7ª Vara em 23/10/2026)
- `Restabelecimento` e `Concessão` (incluídos pela 7ª Vara em 23/10/2026) — assuntos genéricos: confira na petição inicial que o pedido é de benefício por incapacidade (ou LOAS deficiente); se for outro benefício, registre AVISO (checagem 1, abaixo)
- `Idoso` e `Benefício Assistencial (Art. 203,V CF/88)` (incluídos em 30/10/2026, para a análise do laudo social — ver "Laudo social", abaixo). No assunto genérico, confira na inicial que o pedido é de BPC ao idoso ou ao deficiente.

Processo do CSV com assunto fora dessa lista **não pertence a esta rotina** — informe, na confirmação de quantitativos, quantos foram excluídos por esse motivo e não os inclua na análise.

**B) Lista de processos informada na conversa** — números digitados ou colados diretamente no chat. Não havendo CSV, confirme com o usuário que todos pertencem à tarefa configurada em `jef-analise-laudo.tarefa_analisar_laudo` com um dos assuntos do escopo desta rotina (acima) antes de prosseguir; não presuma isso a partir do número do processo.

## Confirmação antes de analisar — parada obrigatória

Antes de abrir qualquer processo, informe:
- que `docs/configuracao-unidade.md` foi lido e está completo para esta skill (sem item `PENDENTE`), ou as perguntas que faltam (ver "Configuração da unidade — antes de tudo");
- origem da lista: CSV novo, CSV reaproveitado (nome do arquivo e quando foi fornecido) ou lista colada na conversa;
- quantidade de processos a analisar e, vindo de CSV, quantos foram excluídos por assunto divergente do escopo desta rotina;
- estimativa de esforço: a análise abre a petição inicial e o laudo de um processo por vez e leva cerca de um a dois minutos cada;
- o **salário mínimo vigente** e a metade dele, para o critério de renda do laudo social, conferidos pela própria skill em fonte oficial (decreto que fixa o salário mínimo, no Portal da Legislação do Planalto ou no Diário Oficial da União), a cada execução, com a fonte — nunca de memória. Não achando fonte oficial clara, pergunte ao usuário.

Só comece a análise com o "pode seguir" do usuário.

## Progresso durante a execução — informe obrigatório a cada 20 processos

Ao completar o 20º processo analisado, registre uma mensagem de progresso parcial: quantos já foram analisados do total confirmado, e a divisão parcial por classificação até aquele ponto.

Essa mensagem precisa ficar registrada no histórico da conversa — não pode apenas surgir na tela e desaparecer sozinha, como uma notificação passageira. Se a sessão em execução dispuser de uma ferramenta própria para enviar mensagem ao usuário (distinta do texto informal que aparece entre uma chamada de ferramenta e outra), use-a para postar o informe: esse é o caminho que garante o registro permanente. Não havendo essa ferramenta, encerre a resposta corrente com o informe como último conteúdo do turno, e só retome a análise dos próximos processos numa resposta seguinte — nunca poste o informe como comentário de passagem entre duas chamadas de ferramenta dentro da mesma resposta, pois esse texto tende a não ficar registrado no histórico.

Isso é apenas um informe, **não uma parada para confirmação**: diferente da confirmação de quantitativos, acima, aqui não se espera resposta do usuário nem "pode seguir" antes de prosseguir para o próximo processo.

Repita a cada novo múltiplo de 20 (20, 40, 60, 80...) até terminar. Não acumule várias rodadas de 20 sem reportar.

Se, mesmo seguindo essas instruções, o informe continuar aparecendo e sumindo da tela sem deixar registro, isso pode ser uma limitação da interface em manter texto emitido durante a execução — fora do alcance desta skill para corrigir sozinha. Nesse caso, sinalize a suspeita ao usuário no relato final, sem afirmar a causa com certeza.

Se, por qualquer motivo, a análise chegar ao fim sem ter passado por esses informes intermediários, isso é um desvio da rotina: sinalize esse desvio explicitamente ao usuário junto do relato final, em vez de simplesmente omiti-lo.

O relato completo de conclusão segue à parte, na seção Ao terminar.

## Como abrir cada processo

Use a **consulta processual**, não a fila. A consulta não vincula tarefa a ninguém e não altera estado.

1. `https://pje1g.trf5.jus.br/pje/Processo/ConsultaProcesso/listView.seam`
2. O número é preenchido em campos separados. Ids: `fPP:numeroProcesso:numeroSequencial`, `:numeroDigitoVerificador`, `:Ano`, `:NumeroOrgaoJustica` (o código configurado em `Comum — Unidade.codigo_orgao`; na dúvida, os 4 últimos dígitos do próprio número do processo). Ramo (4) e tribunal (05) já vêm preenchidos. Botão: `fPP:searchProcessos`.
3. Clique no número no resultado. Os autos abrem em janela nova — redirecione `window.open` para a mesma aba antes de clicar, senão a janela fica fora de alcance.
4. A cronologia sai em texto do próprio documento (não está em iframe).

## Execução em lote — scripts

Em lote, a leitura roda por dois scripts, carregados tal como estão gravados (nunca reescritos de memória), na página estática `https://pje1g.trf5.jus.br/pje/js/pdfjs/web/locale/locale.json`, pelo método de upload descrito na `jef-conferir-rpv` (seção "Execução em lote": um `<input type="file">` criado pelo javascript_tool, que executa o arquivo recebido pelo file_upload do Chrome):

1. `.claude/skills/jef-conferir-rpv/analise-lote-pje.js` (`window.__CR`), sem cópia: lê os processos num iframe oculto, um processo e um documento por vez. Inicie com `CR.inicia(lista, base)` e acompanhe com `CR.estado()`. Bloqueio do PJe por excesso de acessos (`429`): espere os 10 minutos antes de retomar.
2. `analise-lote.js` desta skill (`window.__LM`), carregado depois do primeiro. Antes, informe o salário mínimo conferido em fonte oficial e as etiquetas da configuração da unidade: `LM.config({ sm: <valor>, etiquetas: { ... } })` (ver "Como a configuração chega ao script"). Sem as 14 etiquetas, o `LM.fila` não roda. Para os processos já lidos pelo CR, `LM.fila(nums)` escolhe o laudo do perito (o "Laudo Pericial", fora os anexos e o "laudo médico" juntado pelas partes) — o médico ou, quando o laudo social for o mais recente, o social —, baixa o texto inteiro e monta o resumo; `LM.st` diz quando terminou. `LM.ver(nums)` põe os resumos no quadro da página, para ler com `get_page_text` (o retorno do javascript_tool é cortado em cerca de 1.200 caracteres).

O resumo traz, por processo: o laudo (ID, data, data da perícia, nascimento, idade, conferência do CPF ou do nome), o pedido da inicial (BPC, previdenciário ou auxílio-acidente), o quadro clínico (grau, subgrau, duração, prazo, DII, fim do prazo e intervalo), os quesitos de menor (5.2), o 7.1, o CID F, a representação, as petições posteriores ao laudo, os alertas (laudo social, pessoa diferente, acidente do trabalho ou de trajeto, exame complementar, perícia in loco) e uma sugestão de classificação, etiqueta e curatela (`SUG: …?`), com os trechos do laudo em que ela se apoia (`T-QUADRO`, `T-DURAÇÃO`, `T-DII`, `T-5.2`).

**A sugestão não é a classificação.** A classificação sai das regras desta skill, conferida nos trechos e, havendo dúvida, no laudo inteiro (`CR.textos([id], 30000)` ou `CR.busca(num, 'regex')`). Laudo digitalizado ou sem texto vai para leitura visual (`CR.img` / `CR.render`, com a aba visível).

**Arquivo de andamento** (`Relatórios/Analise_Laudo_AAAA-MM-DD_andamento.txt`; havendo outro do mesmo dia, sufixo `_2`, `_3`...), criado antes do primeiro processo, com a lista, e gravado a cada processo classificado:
- `L|<n>|<processo>` — a lista do lote, na ordem;
- `P|<processo>|<Grau>|<Subgrau>|<Duração>|<Classificação>|<Etiqueta>|<Ação>|<Etiqueta controle>|<Perícia social>|<Providência>|<Movimentar para>|<Curatela>|<Documento não lido>|<Petições após o laudo>|<Proposta de acordo>|<Intimação do laudo>|<MPF>|<Fundamento>|<Sigiloso>` — as 18 colunas B a S do Entregável (linha antiga, com 15, sai com as três colunas de 18/11/2026 em branco); a última linha P de cada processo vale. Enquanto o MARCAR TODOS COMO LIDOS não for feito, a coluna "Documento não lido" leva `PENDENTE_MTL(N)`, trocado depois pelo resultado;
- `F|<processo>|<motivo>` — processo fora do relatório (desde 30/10/2026, o laudo social não é mais motivo: ele é classificado).

**MARCAR TODOS COMO LIDOS:** depois de gravadas as classificações, `LM.marcaFila(nums)` chama o `CR.marca` um processo por vez, só nos que tinham documento não lido na leitura; o resultado fica em `LM.mk`. O `CR.marca` não marca se o número de não lidos mudou desde a leitura (chegou documento que ninguém leu): releia esse processo.

**Relatório:** `gera-relatorio.ps1` desta skill monta o .xlsx a partir do andamento, nunca da memória da conversa: `& '<pasta da skill>\gera-relatorio.ps1' -Andamento '<andamento>' -Saida '<.xlsx>'`.

Testado em 23/10/2026 nos 30 processos do terceiro teste (CSV da tarefa de análise de laudo, na 7ª Vara): as 30 sugestões bateram com a classificação conferida no texto, já com as regras do questionário de 23/10/2026.

**v2 (30/10/2026):** sugere também pelas respostas do Setor de Perícias (afastamento, faixas intermediárias, adicional de 25%, curatela só para maiores, aviso de outro laudo médico e de incapacidade passada) e analisa o laudo social (endereço, divergência, renda per capita × metade do salário mínimo, com aviso de BPC ou benefício de outro membro do grupo na renda). Ainda não rodada com processos reais: confira cada sugestão no texto com atenção redobrada no primeiro lote.

**v3 (16/11/2026), com o `analise-lote-pje.js` v12:** o resumo ganha as linhas `PROPOSTA` (proposta de acordo depois do laudo, pelo método da `jef-expediente-manifestacao`), `INTIMAÇÃO DO LAUDO` (`ok` ou `FALHA NA INTIMAÇÃO`, pela Certidão de Intimação posterior ao laudo, cujo texto o script baixa, porque o leitor do PJe pula a certidão pelo título) e `MPF` (`INTIMAR MPF`, com o motivo). O MPF cadastrado é lido no polo passivo e em "Outros Interessados" do cabeçalho, que o CR v12 guarda em `CR.mem.partes`; com o CR antigo, a linha avisa que o polo passivo não foi lido. As três são sugestões, conferidas como as demais.

**v4 (17/11/2026):** corrige erros de sugestão achados num lote real de 50 processos. As regras de classificação não mudaram.
- **Adicional de 25%:** só é sugerido quando é o pedido isolado, no título da ação ou numa inicial sem pedido de concessão ou restabelecimento de benefício. O acréscimo pedido "na hipótese de" assistência permanente, junto com o auxílio ou a aposentadoria, é subsidiário e segue a regra comum; o resumo avisa.
- **Quesitos de menor:** o script lê também os modelos que trazem os quesitos de menor no item 4 (4.2, além do 5.2 do modelo da 7ª Vara).
- **Aceite da proposta:** reconhecido também com a palavra partida pelo leitor de PDF ("a ceitar o acordo"). A petição com título "(A PARTE AUTORA ACEITA …)" sem petição "(P …)" no mesmo dia deixou de ser tratada como anexo. Na lista do pós-laudo, a petição que aceita ou recusa a proposta vem marcada.
- **Pós-laudo:** a lista inclui alegações finais, resposta, réplica, emenda à inicial, pedido (de homologação etc.) e "Outros Documentos (MANIFESTAÇÃO …)".
- **Laudo longo:** o texto do laudo é lido até a página 100, com um só download (há laudos com os quesitos depois da página 40).
- **Certidão de endereço não localizado:** a da assistente social, juntada como laudo, sai como `Social - esclarecer localização`. Se a parte autora já detalhou o endereço depois, o resumo avisa.
- **Laudo complementar sem quadro clínico:** os quesitos saem do laudo anterior, e o texto do complementar vem em `T-COMPL`, porque ele prevalece no que responde.
- **Dossiês do INSS:** os juntados como "Laudo Pericial (<CPF> …)" deixam de contar como laudo; havendo "Laudo Pericial", também o "Laudo Médico" das partes.
- **Divergência no laudo social:** a assistente social que diz não ter sido possível confirmar a composição do grupo familiar também é sugerida como `Social - divergência`.
- **Teste:** os 50 processos do lote foram relidos só em leitura; as 50 sugestões bateram com a classificação conferida no texto (na v3, 14 estavam erradas).

**v5 (18/11/2026), com o `analise-lote-pje.js` v13:**
- **Pedido previdenciário com incapacidade** (grau A ou B, ou limitação com afastamento): sugere `Incapacidade - CEJUSC`. Sugere `Prioridade (AD/AI/LOAS)` quando a inicial indica segurado especial (`SEGURADO ESPECIAL?`, com o trecho) ou quando uma petição do INSS afirma, para o caso, que a parte autora não tem a carência ou perdeu a qualidade de segurado (`INSS ALEGA CARÊNCIA/QUALIDADE DE SEGURADO`, com o ID e o trecho). A contestação da AGU que alega traz marcas próprias ("CONTESTAÇÃO - QS/CARÊNCIA", "PERDA DA QUALIDADE DE SEGURADO. DII POSTERIOR AO PERÍODO DE GRAÇA", "NÃO PREENCHIMENTO DA CARÊNCIA", "Impeditivo identificado — Falta de carência / qualidade de segurado"). As cláusulas padrão da proposta de acordo sobre a perda da qualidade de segurado não são alegação. A menção genérica só gera o alerta `INSS cita carência/qualidade de segurado (genérico? conferir)`.
- **Partes ouvidas:** linha `PARTES OUVIDAS`, com, para a parte autora e para o INSS, a primeira petição posterior ao laudo ou o "Decorrido prazo de <parte>" posterior à Certidão de Intimação do laudo. Petição sem origem identificada, sem título do INSS e sem marca do INSS no início conta como da parte autora (`origem presumida`). O decurso do menor, cujo nome o PJe mostra em iniciais, é reconhecido pelas iniciais.
- **CR v13:** guarda em `CR.mem.dec` os eventos "Decorrido prazo de …" da cronologia, sem mudar as linhas de saída das skills de RPV.

**v6 (18/11/2026, regra das partes já ouvidas):** com as duas partes ouvidas, a coluna MPF em branco e uma classificação que tem rotina na triagem de expediente, o resumo traz `EXPEDIENTE: rotina <código>`; com MPF, `EXPEDIENTE: não (INTIMAR MPF)`. `LM.paraExp(nums)` devolve a lista `processo|rotina` desses processos, que vai para o script da triagem de expediente, `.claude/skills/jef-expediente-manifestacao/analise-lote.js` (`window.__EM`), carregado na mesma página pelo mesmo método, com a configuração que aquela skill manda passar: `EM.inicia(lista, 0)`, `EM.estado()` e `EM.mostra(a, b)`. Ele reabre cada um desses processos (mais um acesso ao PJe por processo; atenção ao bloqueio de 10 minutos) e lê o que a rotina pede. A `PROP` do resumo dele é sugestão; a classificação sai das regras da rotina, conferidas no texto, e as fotos se veem na tela. Proposta de acordo: vale a linha `PROPOSTA` desta skill; havendo divergência com a do expediente, confira no texto. O MARCAR TODOS COMO LIDOS continua pelo `LM.marcaFila`, nunca pelo `EM.marca`. Testado só em leitura em 45 processos de um lote real da 7ª Vara: 36 foram para as regras do expediente e 5 ficaram com a etiqueta do laudo por causa do MPF.

**v7 (20/11/2026), respostas do Setor de Perícias:** o `analise-lote.js` sugere `Redesignar perícia?` quando o "Laudo Pericial" sem quadro clínico é comunicação do perito (linha `COMUNICAÇÃO DO PERITO`, etiqueta da chave `etiqueta_redesignar_pericia`); no laudo social sem a renda per capita escrita, compara com metade do salário mínimo a renda achada em R$, "sem renda", 1 salário mínimo ou mais (linha `RENDA DO QUESITO B`, a conferir no laudo); o quesito 4.7 do INSS nunca é indício de acidente do trabalho. Só sintaxe checada; confira cada sugestão no texto no primeiro lote.

**v7.1 (24/11/2026):** a detecção de `Redesignar perícia?` só vale com frases da comunicação do perito (perito impedido, "já foi meu paciente", autor que não compareceu, menor sem documento com foto, pedido de remarcação) e nunca com o quesito 5.2 respondido. A v7 marcava laudos de menores no BPC por causa de "impedimento de longo prazo" e "assistente técnico: não compareceu".

**v8 (25/11/2026):** o aceite da proposta não é mais lido na "concordância com o laudo", na "conclusão pericial" nem em "nos termos que se seguem"; a petição que impugna os termos da oferta ou chama a proposta de injusta ou desproporcional é recusa. Confira sempre o texto da petição que o script marcou como `ACEITA`.

**v8.1 (25/11/2026):** "acidente de trajeto, p. ex." é o texto-padrão dos quesitos (4.7 e 7.7 do INSS e 2.7 do laudo) e deixa de gerar o alerta de acidente do trabalho; sem isso, laudos comuns saíam AVISO.

**v8.2 (25/11/2026):** corrige erros de sugestão achados na conferência de um lote. As regras de classificação não mudaram.
- **Redesignar perícia:** o "Assistente técnico da parte autora: Não compareceu" deixa de contar como ausência do autor; passam a ser reconhecidas a comunicação do perito "não apresentou documento oficial de identificação com fotografia" e "já foi meu paciente".
- **Laudo social, renda:** lê a renda per capita escrita "per capta" e, sem ela, o quesito B com "recebe o valor de R$ …".
- **Laudo social, endereço:** "não localizei vizinhos …" deixa de ser lido como endereço não localizado.

**v8.3 (27/11/2026):** o "assistente técnico ausente" também é ignorado no plural ("ASSISTENTES TÉCNICOS ... Não compareceu"), que antes saía como `Redesignar perícia`. As regras de classificação não mudaram.

**v8.4 (27/11/2026):** a comunicação do perito que se declara impedido por parentesco com o advogado da parte passa a ser sugerida como `Redesignar perícia`; e o quadro clínico e a duração passam a ser lidos também no modelo que numera os quesitos como 7.3 e 7.4 (antes, só 5.3/6.3 e 5.4/6.4). As regras de classificação não mudaram.


## Checagens preliminares — bloqueiam a classificação se divergirem

Antes de classificar o laudo, faça as três checagens abaixo, em todo processo. Encontrando divergência relevante em qualquer uma delas, **não classifique o laudo**.

1. **Pedidos da inicial batem com o cadastro** — abra a petição inicial e confira se o pedido nela formulado corresponde ao Assunto cadastrado no processo, dentro do escopo desta rotina (ver Entrada, acima). Pedido substancialmente diferente (outro tipo de benefício, ou outra hipótese do mesmo benefício) é divergência relevante → classificação **AVISO**, com a etiqueta prescrita configurada em `jef-analise-laudo.etiqueta_aviso_indefinido` e o motivo no Fundamento, para decisão humana. Exceção: o pedido de adicional de 25% sobre aposentadoria já concedida tem regra própria (ver "Pedido de adicional de 25%", abaixo).
2. **O laudo corresponde à parte autora** — confira se o nome da parte periciada no laudo é o mesmo da parte autora do processo, e se o laudo pericial foi efetivamente produzido nestes autos (não pertence a outro processo ou a outra perícia). Laudo de outra pessoa (nome divergente sem explicação nos autos) → classificação **"Complementação de laudo"** (ver "Providências que substituem a classificação", abaixo), com o motivo no Fundamento.

Divergência que os próprios autos expliquem (grafia diferente do mesmo nome, nome social, retificação de registro) **não bloqueia** — registre a explicação no Fundamento e prossiga com a classificação normal. Nome com grafia um pouco diferente e o mesmo CPF no laudo e no PJe é a mesma pessoa (decisão da 7ª Vara, 23/10/2026; ex.: "FULANO DE SOUZA" e "FULANO DE SOUSA").

3. **Acidente do trabalho ou de trajeto** (decisão da 7ª Vara, 23/10/2026) — se o laudo indicar que a incapacidade, a limitação ou a sequela decorre de acidente do trabalho ou de acidente de trajeto (no quesito 6.8, no 9.1, na anamnese ou em outra parte do laudo), ainda que outro quesito diga o contrário → classificação **AVISO**, etiqueta configurada em `jef-analise-laudo.etiqueta_aviso_indefinido`, para decisão sobre a competência. Preencha grau, subgrau e duração do laudo e registre no Fundamento onde está a indicação do acidente.
   - **Quesitos do INSS não contam** (resposta do Setor de Perícias): ignore as respostas aos quesitos do INSS (item 4 do modelo, 4.6 e 4.7). A marca "(x)" no 4.7 ("acidente de trabalho, doença profissional ou equiparados") aparece nos mesmos termos em todos os laudos desse modelo e **não indica acidente do trabalho** quando o quesito do juízo (6.8) responde "Não": nesse caso a checagem não gera AVISO, e o laudo é classificado normalmente. Só valem a resposta SIM do quesito do juízo e a indicação de acidente na anamnese ou no texto do perito.

~~**Processo na fila só por causa do laudo social** (decisão da 7ª Vara, 23/10/2026): o processo não entra no relatório e é listado à parte.~~ Substituído em 30/10/2026: o laudo social passa a ser analisado por esta skill (ver "Laudo social — BPC ao deficiente e ao idoso").

## Laudo social — BPC ao deficiente e ao idoso

Regras do Setor de Perícias (documento "Dúvidas esclarecidas e análise do laudo social", 30/10/2026) e da 7ª Vara (mesma data). Valem quando o laudo **mais recente** do processo é o laudo social da assistente social (em geral juntado como "Laudo Pericial (<nome>)"; o teor diz "Laudo Social", "Assistente Social", "Estudo Social"). No BPC ao idoso, o laudo social costuma ser o único laudo; no BPC ao deficiente, vem depois do laudo médico já tratado. As checagens preliminares 1 e 2 valem também aqui (pedido × assunto; laudo da parte autora).

Classifique nesta ordem; a primeira que se aplicar define a linha:

1. **Endereço** — a assistente social informa que **não encontrou o endereço**, que há **divergência sobre o real endereço** ou que a **parte autora se mudou** → classificação **"Social - esclarecer localização"**:
   - etiqueta configurada em `jef-analise-laudo.etiqueta_social_esclarecer_localizacao`;
   - providência: intimar a parte autora para indicar o endereço, para realizar a diligência.
2. **Divergência** — a assistente social informa **divergências entre o afirmado pela parte autora e as suas observações** (composição do grupo familiar, renda, moradia etc.) → classificação **"Social - divergência"**, etiqueta configurada em `jef-analise-laudo.etiqueta_social_divergencia`, qualquer que seja a renda.
3. **Renda per capita** do grupo familiar, comparada com **metade do salário mínimo vigente** (conferido em fonte oficial, ver "Confirmação"):
   - **até 1/2 salário mínimo** (inclusive) → classificação **"Social - renda até 1/2 SM"**, etiqueta configurada em `jef-analise-laudo.etiqueta_social_renda_ate_meio_sm`;
   - **acima de 1/2 salário mínimo** → classificação **"Social - renda acima de 1/2 SM"**, etiqueta configurada em `jef-analise-laudo.etiqueta_social_renda_acima_meio_sm`.

**De onde sai a renda per capita** (decisão da 7ª Vara, 30/10/2026):
- vale a renda per capita **informada no laudo** pela assistente social;
- se o laudo mostrar que ela incluiu na renda do grupo o **BPC ou outro benefício de até um salário mínimo recebido por outro idoso ou pessoa com deficiência do grupo familiar** (art. 20, § 14, da Lei 8.742/1993), esse valor é **excluído** e a renda per capita é recalculada com os próprios dados do laudo (renda do grupo menos o benefício excluído, dividida pelo número de membros informado no laudo). Registre o cálculo no Fundamento;
- laudo sem a renda per capita escrita (resposta do Setor de Perícias): vale a **renda informada no quesito B** do laudo social (a renda do grupo ou da parte autora que a assistente social registra), **sem dividir pelo grupo**, comparada com metade do salário mínimo. Registre no Fundamento o valor e o trecho:
  - renda igual ou inferior a metade do salário mínimo → "Social - renda até 1/2 SM"; a parte autora que **afirma não ter renda** → também "Social - renda até 1/2 SM";
  - renda de **1 salário mínimo** (ex.: a parte autora já recebe BPC) ou **mais de um salário mínimo** → "Social - renda acima de 1/2 SM";
  - o laudo diz só que a renda per capita é "superior a 1/4 do SM" e menciona benefício de outro integrante a excluir → aplique a exclusão acima e classifique pelo resultado; sem o valor, "Social - renda até 1/2 SM";
  - **INDEFINIDO**, com a etiqueta configurada em `jef-analise-laudo.etiqueta_aviso_indefinido`, só quando o laudo não traz renda alguma (nem a declaração de ausência de renda).
  A skill continua sem calcular a renda a partir de outros documentos do processo.
- **Laudo social em processo de assunto previdenciário, sem laudo médico:** vale a mesma análise da renda; se o INSS, na manifestação, contesta a renda declarada pela parte autora (de modo que não é provável acordo em audiência), a classificação é "Social - renda acima de 1/2 SM", ainda que a renda declarada esteja até metade do salário mínimo.

**Na planilha:** Grau, Subgrau e Duração ficam em branco. O Fundamento traz a data e o ID do laudo social, a renda per capita (e o recálculo, se houver), o salário mínimo e a metade usados, a composição do grupo familiar e o trecho que motivou a classificação de endereço ou divergência. A curatela não se aplica.

## Providências que substituem a classificação

Regras da 7ª Vara de 23/10/2026. Em cada caso abaixo o laudo **não é classificado** (grau, subgrau e duração ficam em branco): a planilha prescreve a providência, a fase para onde movimentar e a etiqueta, para execução manual pela secretaria. A skill não junta termo ordinatório, não intima nem movimenta processo. Verifique nesta ordem; a primeira que se aplicar define a linha.

1. **Laudo de outra pessoa** (checagem 2, acima) → classificação **"Complementação de laudo"**:
   - providência: termo ordinatório determinando que o perito anexe o laudo correto;
   - movimentar para a fase configurada em `jef-analise-laudo.fase_complementacao_laudo`;
   - etiqueta configurada em `jef-analise-laudo.etiqueta_complementacao_laudo`.
2. **Quesitos para menores de 16 anos** — calcule a idade da parte autora **na data da perícia** (data de nascimento nos autos):
   - **até 15 anos** → o perito deve responder os **quesitos para menores de 16 anos**. Se respondeu só os quesitos de adulto → **"Complementação de laudo"**;
   - **16 ou 17 anos** → se o perito respondeu os quesitos para menores de 16 anos → **"Complementação de laudo"**;
   - em ambos os casos: termo ordinatório para o perito complementar o laudo, movimentar para a fase `jef-analise-laudo.fase_complementacao_laudo`, etiqueta `jef-analise-laudo.etiqueta_complementacao_laudo`. Registre a idade e a data da perícia no Fundamento.
3. **Exames complementares** — o perito solicitou exames complementares para concluir o laudo → classificação **"Exame complementar"**:
   - providência: intimar a parte autora para providenciar os exames complementares solicitados (liste-os no Fundamento);
   - movimentar para a fase configurada em `jef-analise-laudo.fase_exame_complementar`, para aguardar o cumprimento;
   - etiqueta configurada em `jef-analise-laudo.etiqueta_exame_complementar`.
4. **Perícia in loco** — o advogado pediu perícia no local em que a parte autora se encontra, por estar doente, presa ou internada em hospital ou clínica de reabilitação, e o pedido está pendente (não há laudo posterior a ele) → classificação **"Perícia in loco"**:
   - providência: termo ordinatório de perícia in loco; a servidora entra em contato com o perito para informá-lo do fato e saber se ele pode comparecer ao local em que a parte autora se encontra;
   - sem fase nem etiqueta próprias (colunas em branco).
5. **Perícia não realizada — comunicação do perito** (resposta do Setor de Perícias) — o documento juntado como "Laudo Pericial" é, na verdade, a **comunicação do perito** de que a perícia não se realizou, e não há laudo posterior: autor que não compareceu e perito impedido (por relação de grau, parentesco etc.), ou menor que compareceu sem documento oficial com foto, com pedido de remarcação → classificação **"Redesignar perícia"** (grau, subgrau e duração em branco):
   - providência: designar nova perícia; se o perito se declarou impedido, com **outro perito**;
   - movimentar para a fase configurada em `jef-analise-laudo.fase_redesignar_pericia`;
   - etiqueta configurada em `jef-analise-laudo.etiqueta_redesignar_pericia`.
   Confira no texto da comunicação o motivo e registre-o no Fundamento. Outro "Laudo Pericial" do mesmo dia, que é só a petição a que a comunicação se refere, não é laudo.

Nenhuma dessas situações → classifique o laudo normalmente (seção seguinte).

## Como classificar o laudo médico

Localize o laudo pericial médico mais recente juntado ao processo (havendo mais de um, use o mais recente) e leia o quesito sobre o quadro clínico (item 6.3 do modelo de laudo da 7ª Vara, ou equivalente), que classifica o caso em uma das quatro hipóteses.

**Numeração dos quesitos.** Os números citados nesta skill (6.3 quadro clínico, 6.4 duração, 5.2 menor de 16 anos, 7.1 ou 6.1 assistência permanente, 6.8 e 9.x acidente) são os do modelo de laudo da 7ª Vara e dos modelos de outros peritos vistos nos testes, e o `analise-lote.js` procura os quesitos por esses números e pelo texto da pergunta. Se o modelo de laudo da unidade tiver outra numeração, o script não acha o quesito (a sugestão sai vazia ou INDEFINIDO) e a classificação é feita pela leitura do texto, no quesito equivalente do modelo da unidade, com as mesmas regras.

Respostas do Setor de Perícias de 30/10/2026:
- **Laudo complementar** que responde só parte dos quesitos (por exemplo, só a DII ou só a duração): combine os dois laudos. O complementar prevalece no que responde; o original vale no restante.
- **Duas perícias de especialidades diferentes** no mesmo processo (ex.: ortopédica e psiquiátrica, cada uma com o seu laudo): classifique cada laudo. Se os dois levarem à mesma classificação, ela vale. Se levarem a classificações diferentes → **INDEFINIDO**, com a etiqueta configurada em `jef-analise-laudo.etiqueta_aviso_indefinido`, para análise humana, com as duas classificações no Fundamento.

As quatro hipóteses do quadro clínico:

- **A — Incapacitação total** (incapaz para toda e qualquer atividade laborativa).
- **B — Incapacitação parcial** (incapaz só para certas atividades, descritas pelo perito).
- **C — Limitação**, com um subgrau informado pelo perito: **leve**, **moderada** ou **acentuada** (grave) — e percentual.
- **D — Não causa qualquer limitação** ao exercício da atividade habitual.

### Grau A ou B — incapacidade

Localize a data de início da incapacidade (DII) informada pelo perito e o prazo de duração que ele estimou.

**Pedido assistencial (BPC/LOAS deficiente):**
- **Definitiva, ou sem possibilidade de estimar prazo**, **ou** intervalo entre a DII e o fim do prazo estimado **igual ou superior a 2 anos** → classificação **"LOAS - Designar social"**.
- Intervalo **inferior a 2 anos** → classificação **"Prioridade (AD/AI/LOAS)"**.

**Pedido previdenciário** (auxílio por incapacidade temporária, aposentadoria por invalidez, auxílio-acidente e demais benefícios do escopo que não sejam o BPC), qualquer que seja a duração (pedido previdenciário não tem perícia social) — decisão da 7ª Vara, 18/11/2026:
- regra → classificação **"Incapacidade - CEJUSC"**, etiqueta configurada em `jef-analise-laudo.etiqueta_incapacidade_cejusc`;
- exceção → classificação **"Prioridade (AD/AI/LOAS)"** só quando:
  - a parte autora é **segurada especial** (trabalhador rural em regime de economia familiar, pescador artesanal etc., conforme a inicial); ou
  - o **INSS alegou**, na contestação ou em outra petição nos autos, **falta de carência** ou **perda da qualidade de segurado** da parte autora. Vale a alegação feita para o caso concreto; a contestação genérica que só enumera os requisitos do benefício, sem afirmar que a parte autora não os cumpre, não conta, e o indeferimento administrativo, sozinho, também não.
- Registre no Fundamento o motivo da exceção (segurado especial, ou o ID e o trecho da alegação do INSS). Registre a duração na coluna própria, como nos demais casos.

O período de 2 anos conta-se sempre a partir da DII informada pelo perito, somada ao prazo de duração por ele estimado — nunca a partir da data do laudo ou da data da perícia. Quando o perito conta o prazo "da data desta perícia", o fim do prazo é a data da perícia mais o prazo, e o intervalo vai da DII até esse fim (confirmado pela 7ª Vara em 23/10/2026; ex.: DII 05/11/2025 e 24 meses contados da perícia de 25/09/2026 → fim em 25/09/2028 → quase 3 anos).

### Grau C — limitação

- **Parte autora menor de idade**, com subgrau **moderada** ou **acentuada (grave)** → classificação **"LOAS - Designar social"** (mesma etiqueta do grau A/B — exceção que se aplica só a menores de idade).
- **Parte autora maior de idade**, com subgrau **moderada** ou **acentuada (grave)** → classificação **"Limitação moderada ou grave"**.
- Subgrau **leve**, de qualquer idade → classificação **"Laudo C"**.

**Limitação COM recomendação de afastamento das atividades laborais** (resposta do Setor de Perícias, 30/10/2026): conta como incapacidade temporária, qualquer que seja o subgrau, e segue a regra do grau A ou B: no BPC, classificação **"Prioridade (AD/AI/LOAS)"**; no pedido previdenciário, **"Incapacidade - CEJUSC"**, salvo as exceções do segurado especial e da alegação do INSS, que levam a "Prioridade (AD/AI/LOAS)" (decisão da 7ª Vara, 18/11/2026). Sem a recomendação, vale o subgrau, como acima.

**Modelos com faixas intermediárias** (ex.: modelo com os quesitos de adulto no item 5, que gradua a limitação em leve de 10% a 30%, leve a moderada de 30% a 50% e moderada a acentuada de 50% a 70%, cada uma sem ou com recomendação de afastamento) — resposta do Setor de Perícias, 30/10/2026:
- "leve a moderada" conta como **leve** → "Laudo C";
- "moderada a acentuada" conta como **moderada** → "Limitação moderada ou grave" (ou "LOAS - Designar social", se o autor for menor de idade);
- com recomendação de afastamento, qualquer faixa conta como incapacidade temporária → "Prioridade (AD/AI/LOAS)" no BPC; "Incapacidade - CEJUSC" no pedido previdenciário, salvo as exceções acima.

**Menor de 16 anos** (quesitos para menores, item 5 do modelo da 7ª Vara): o grau sai do **quesito 5.2** — "SIM, de grau leve" é o subgrau leve; "moderado" e "acentuado", os subgraus moderada e acentuada; "NÃO", o grau D, com classificação "Laudo D" (confirmado pelo Setor de Perícias em 30/10/2026). Vale só o 5.2, ainda que o 5.4 (restrição ao convívio) ou o 5.7 (cuidados) apontem outro nível: a divergência é registrada no Fundamento (decisão da 7ª Vara, 23/10/2026).

**Auxílio-acidente:** o grau sai do quadro clínico (6.3), como nos demais casos. Os quesitos 9.x (sequela consolidada, redução da capacidade, anexo III do Decreto 3.048/1999) vão só para o Fundamento (decisão da 7ª Vara, 23/10/2026; ex.: 6.3 limitação leve e 9.3 redução de 16% a 25% → Laudo C).

### Grau D — sem limitação

→ classificação **"Laudo D"**, qualquer que seja a idade da parte autora.

**Incapacidade só no passado** (resposta do Setor de Perícias, 30/10/2026): o perito reconhece incapacidade num período já encerrado (início e fim anteriores à perícia), sem incapacidade ou limitação atual → **"Laudo D"**, registrando o período no Fundamento.

### Pedido de adicional de 25% sobre aposentadoria já concedida

Resposta do Setor de Perícias, 30/10/2026. Quando a inicial pede só o adicional de 25% (assistência permanente de terceiro) sobre aposentadoria por invalidez já concedida, isso não é mais AVISO por divergência entre pedido e assunto (checagem 1). O quesito decisivo é o da **assistência permanente de outra pessoa para as atividades da vida diária** (7.1 no modelo da 7ª Vara; 6.1 em outros modelos):
- resposta **negativa** → classificação **"Laudo D"**, etiqueta configurada em `jef-analise-laudo.etiqueta_laudo_d`;
- resposta **positiva** → classificação **"Adicional de 25% - assistência permanente"**, etiqueta configurada em `jef-analise-laudo.etiqueta_adicional_25`.

Registre no Fundamento o quesito e a resposta.

### Partes já ouvidas sobre o laudo

Com as duas partes já ouvidas e sem MPF, a etiqueta não é a da classificação do laudo, e sim a da triagem de expediente: ver "Partes já ouvidas sobre o laudo — etiquetas da triagem de expediente", abaixo.

### INDEFINIDO

Laudo ilegível, não carregado, sem resposta ao quesito do quadro clínico, ou teor ambíguo quanto a grau/subgrau/duração. Não decida no escuro; registre o motivo no Fundamento — etiqueta prescrita: a configurada em `jef-analise-laudo.etiqueta_aviso_indefinido`.

## Curatela — providência adicional (não substitui a classificação acima)

Há duas hipóteses, que se somam (decisão da 7ª Vara, 23/10/2026): qualquer uma delas leva à providência de curatela, **além** da classificação normal (acima). A etiqueta de curador é sempre a configurada em `jef-analise-laudo.etiqueta_curador`, copiada com a grafia exata do arquivo.

**Só para autor com 18 anos ou mais** na data da perícia, nas duas hipóteses (resposta do Setor de Perícias, 30/10/2026): o menor já é representado pelos pais.

**O quesito da assistência permanente** ("O(a) periciado(a) necessita de assistência permanente de outra pessoa para as atividades da vida diária?") é o 7.1 no modelo da 7ª Vara e o **6.1** em outros modelos. Nesses modelos, o 7.1 ("Pode o perito afirmar se existe qualquer indício ou sinais de dissimulação ou de exacerbação de sintomas?") só é levado em conta na análise do mérito, nunca para a curatela (resposta do Setor de Perícias, 30/10/2026).

**Hipótese 1** — verifique se **todas** as condições abaixo estão presentes:
- a incapacidade é **definitiva** (ou sem prazo estimável);
- o laudo (ou outro documento médico dos autos) indica **necessidade de assistência permanente de terceira pessoa** — é a resposta ao quesito da assistência permanente (7.1 no modelo da 7ª Vara; 6.1 em outros modelos); sem esse quesito, procure essa necessidade no corpo do laudo ou em outro documento médico (decisão da 7ª Vara, 23/10/2026);
- a doença de base é **transtorno mental (CID F)** ou afim.

Presentes as três, prescreva:
- etiqueta de curador;
- providência: intimar a parte autora para regularizar a representação processual (indicação de curador), prazo de **15 dias**, modelo de minuta configurado em `jef-analise-laudo.modelo_minuta_curador`;
- sinalize também, no relatório, a necessidade do fluxo de pagamento da perícia — fora do alcance desta skill.

**Hipótese 2** (regra da 7ª Vara de 23/10/2026) — verifique se **todas** as condições abaixo estão presentes:
- a parte autora tem **18 anos ou mais** na data da perícia;
- a doença é **psiquiátrica**;
- a incapacidade é **total e definitiva**;
- a resposta ao **quesito da assistência permanente** (7.1 no modelo da 7ª Vara; 6.1 em outros modelos) é **afirmativa**;
- a parte autora **não está representada** nos autos (sem curador cadastrado nem termo de curatela juntado).

Presentes todas, prescreva:
- etiqueta de curador;
- providência: intimar o advogado para comprovar o termo de curatela ou a ação de interdição.

**As duas hipóteses ao mesmo tempo** (decisão da 7ª Vara, 23/10/2026): prescreva as duas intimações, a da parte autora (hipótese 1, com o prazo, o modelo e o fluxo de pagamento) e a do advogado (hipótese 2).

**Parte autora já representada** (curador cadastrado no PJe ou termo de curatela juntado aos autos): não prescreva a providência de curatela, em nenhuma das hipóteses; registre a representação no Fundamento (confirmado pela 7ª Vara em 23/10/2026).

Ausentes as condições das duas hipóteses, não prescreva a providência de curatela.

## Documentos não lidos — a única gravação

Se a cronologia trouxer **"Há N documento(s) não lido(s)"**, clique em **MARCAR TODOS COMO LIDOS**, no topo do painel de cronologia. Confirme que o aviso sumiu antes de seguir.

Esse botão só existe dentro dos autos, um processo por vez. Em lote, ele é clicado pelo mesmo método das outras skills (`LM.marcaFila`, que chama o `CR.marca` da `jef-conferir-rpv`, um processo por vez, depois de gravada a classificação; ver "Execução em lote — scripts").

Registre na coluna própria (ver Entregável): `sim (N) - marcados como lidos em DD/MM/AAAA`, ou `não`.

## Proposta de acordo, intimação do laudo e MPF — colunas informativas

As três verificações valem em todo processo, com laudo médico ou social, e **não mudam a classificação nem a etiqueta**: cada uma tem a sua coluna na planilha. A exceção é a regra das partes já ouvidas (seção seguinte), em que o MPF decide se ela se aplica e a proposta de acordo entra nas regras da triagem de expediente.

1. **Proposta de acordo** — procure, nas petições juntadas depois do laudo classificado, proposta de acordo do INSS, pelo mesmo método da `jef-expediente-manifestacao`:
   - vale o teor, não o título: "PROPOSTA DE ACORDO", "TIPO 1 - ACORDO DIRETO", "PROPOR TRANSAÇÃO", "o INSS se obriga/compromete", com os termos do acordo (DIB, DIP, RMI, percentual, atrasados, implantação);
   - "poderá apresentar proposta de acordo ou defesa de mérito" e frases parecidas são **promessa**, não proposta; "impossibilidade de acordo" é o contrário de proposta;
   - depois da proposta, a manifestação da parte autora diz se ela foi aceita, recusada ou se houve contraproposta.
   - Coluna "Proposta de acordo": `COM PROPOSTA (ID …)`, `COM PROPOSTA - aceita (…)`, `COM PROPOSTA - recusada (…)`, `COM PROPOSTA - contraproposta do autor (…)`, `impossibilidade de acordo (ID …)`, `promessa de proposta (ID …)` ou `não há`.
2. **Intimação das partes sobre o laudo** — depois da juntada do laudo classificado, tem de haver a **Certidão de Intimação** com os expedientes gerados para o **INSS** e para a **parte autora**. No PJe, são dois documentos juntados juntos:
   - "Intimação": as partes intimadas para se manifestarem sobre o(s) laudo(s) pericial(is);
   - "Certidão de Intimação (Outros)": "EXPEDIENTES GERADOS", uma linha por parte, com o documento "(<ID> - Intimação)", o meio (Sistema, Diário Eletrônico) e o prazo.
   - Coluna "Intimação do laudo": `ok` quando há, depois do laudo, a certidão com os expedientes do INSS e da parte autora; **`FALHA NA INTIMAÇÃO`** quando não há certidão de intimação depois do laudo, ou quando a certidão não traz o expediente de uma das partes. O Fundamento diz qual o caso (ex.: "sem certidão de intimação depois do laudo", "certidão <ID> sem o expediente do INSS"). Certidão sem texto legível é lida pela tela antes de concluir.
3. **MPF** — marque **`INTIMAR MPF`** na coluna "MPF" quando houver atuação do Ministério Público Federal no processo, ou quando ele deveria atuar:
   - o MPF está cadastrado no processo (polo passivo ou "Outros Interessados" do cabeçalho dos autos) ou já se manifestou nos autos;
   - a parte autora é **menor de 18 anos** (o PJe costuma mostrar o nome do menor só pelas iniciais);
   - a parte autora é **incapaz**: tem representante, curador ou tutor no polo ativo, há termo de curatela ou ação de interdição nos autos, ou o laudo indica a hipótese de curatela.
   - Nos demais casos, a coluna fica em branco. O motivo vai para o Fundamento; se o MPF já consta da certidão de intimação do laudo, diga também.

## Partes já ouvidas sobre o laudo — etiquetas da triagem de expediente

Decisão da 7ª Vara, 18/11/2026. Com o atraso na análise dos laudos, muitos processos já estão prontos para o passo seguinte. Nesses casos, a etiqueta de espera da análise do laudo não serve mais: valem as regras da `jef-expediente-manifestacao` para a rotina que trataria aquela etiqueta (encaminhar ao assessor, designar perícia social ou audiência, intimar sobre a proposta de acordo etc.).

**1. Partes ouvidas.** Depois de classificado o laudo (médico ou social), verifique, para **cada uma das duas partes** (parte autora e INSS), se:
- **já se manifestou sobre o laudo**: petição da parte juntada depois do laudo — manifestação ou impugnação ao laudo, ciência, contestação, alegações finais, proposta de acordo e a resposta a ela, ou outra petição que trate do laudo ou do mérito. Não contam a petição de outro assunto (substabelecimento, procuração, habilitação, mudança de endereço, simples juntada de documentos administrativos) nem os anexos; ou
- **teve o prazo decorrido**: evento "Decorrido prazo de <parte>" na cronologia, posterior à intimação das partes sobre o laudo (Certidão de Intimação depois do laudo). Decurso de prazo anterior a essa intimação, ou de outra intimação (ex.: citação), não conta.

As duas partes contam em qualquer combinação. Registre no Fundamento, para cada parte, o que foi achado (ex.: "autor: manifestação ID <id>, DD/MM/AAAA; INSS: decorrido prazo em DD/MM/AAAA").

**2. Quando a regra se aplica:**
- **as duas partes ouvidas e a coluna MPF em branco** → etiquetas da triagem de expediente (item 3);
- **coluna MPF com `INTIMAR MPF`** → fica a classificação e a etiqueta da análise do laudo, como se as partes não tivessem sido ouvidas (no Laudo C ou D, as etiquetas `jef-analise-laudo.etiqueta_laudo_c` e `jef-analise-laudo.etiqueta_laudo_d`);
- **só uma parte ouvida, ou nenhuma** → fica a classificação e a etiqueta da análise do laudo.

**3. Rotina da triagem de expediente** que trata a etiqueta da classificação do laudo:

| Classificação do laudo | Rotina da `jef-expediente-manifestacao` (código no script) |
|---|---|
| Laudo C | Rotina C (`C`) |
| Laudo D (inclusive o adicional de 25% sem assistência permanente) | Rotina D (`D`) |
| Prioridade (AD/AI/LOAS) | Rotina Incapacidade (`INC`) |
| Limitação moderada ou grave | Rotina Limitação (`LIM`) |
| LOAS - Designar social | Rotina LOAS Social (`LOAS`) |
| Incapacidade - CEJUSC; Adicional de 25% - assistência permanente; Social - renda até 1/2 SM | Rotina CEJUSC (`CEJ`) |
| Social - renda acima de 1/2 SM; Social - divergência | Rotina Laudo (Assessoria) (`LA`) |

Não se aplica a `Social - esclarecer localização` (falta o endereço da parte autora), às providências que substituem a classificação, ao AVISO e ao INDEFINIDO.

**4. Como classificar na rotina.** Leia, a cada execução (nunca de memória), na SKILL.md da `jef-expediente-manifestacao`, a seção "Como classificar" da rotina e a sua parte nas regras de saída, com as regras gerais de proposta de acordo, a tabela do assessor por dígito do processo e a tabela de zonas, e use as etiquetas da configuração daquela skill. Aplique-as tal como estão: proposta de acordo, profissão no laudo médico, renda per capita do processo administrativo e endereço (Rotina LOAS Social), fotos do laudo social ou do auto de constatação (miserabilidade). Caso que a rotina não prevê vai para INDEFINIDO, como lá.

**5. Na planilha:**
- **Classificação:** `<classificação do laudo> → <classificação da rotina>` (ex.: `Laudo C → SEM PROPOSTA`, `Incapacidade - CEJUSC → SEM PROPOSTA - outra profissão`, `Laudo D → COM PROPOSTA`).
- **Etiqueta prescrita:** a etiqueta secretaria da rotina. **Ação**, **Etiqueta controle** e **Perícia social:** as da rotina.
- **Fundamento:** além do laudo, as partes ouvidas e o que decidiu a rotina (proposta, profissão, renda, endereço ou fotos).
- INDEFINIDO ou AVISO da rotina: `<classificação do laudo> → INDEFINIDO` (ou `→ AVISO`), Etiqueta prescrita, Ação e Perícia social em branco, e a etiqueta controle de análise humana da configuração da triagem de expediente.
- Grau, subgrau, duração, curatela e as demais colunas são preenchidos como sempre.

## Entregável

Um único arquivo .xlsx, fonte Arial, uma aba `Triagem`. Uma linha por processo, nesta ordem exata de colunas:

| A | B | C | D | E | F | G | H | I | J | K | L | M | N | O | P | Q | R | S |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Processo | Grau do laudo | Subgrau (só se C) | Duração ≥ 2 anos ou definitiva | Classificação | Etiqueta prescrita | Ação | Etiqueta controle | Perícia social | Providência | Movimentar para | Curatela | Documento não lido | Petições após o laudo | Proposta de acordo | Intimação do laudo | MPF | Fundamento | Sigiloso |

- **Grau do laudo**: `A`, `B`, `C` ou `D`, conforme o quesito do quadro clínico. Em branco nos casos AVISO/INDEFINIDO em que o laudo não pôde ser lido e nas providências que substituem a classificação.
- **Subgrau**: `leve`, `moderada` ou `acentuada`, preenchido só quando o grau for C; em branco nos demais.
- **Duração ≥ 2 anos ou definitiva**: `sim`/`não`/`(não se aplica)` — só se aplica aos graus A e B.
- **Classificação**: uma de `LOAS - Designar social`, `Prioridade (AD/AI/LOAS)`, `Incapacidade - CEJUSC`, `Limitação moderada ou grave`, `Laudo C`, `Laudo D`, `Adicional de 25% - assistência permanente`, `Social - esclarecer localização`, `Social - divergência`, `Social - renda até 1/2 SM`, `Social - renda acima de 1/2 SM`, `Complementação de laudo`, `Exame complementar`, `Perícia in loco`, `Redesignar perícia`, `AVISO` ou `INDEFINIDO`; com as partes já ouvidas e sem MPF, `<classificação do laudo> → <classificação da rotina da triagem de expediente>` (ver a seção própria).
- **Etiqueta prescrita**: o nome exato da etiqueta correspondente, copiado da seção `## jef-analise-laudo` de `docs/configuracao-unidade.md`:

  | Classificação | Chave da etiqueta |
  |---|---|
  | `LOAS - Designar social` | `etiqueta_loas_designar_social` |
  | `Prioridade (AD/AI/LOAS)` | `etiqueta_prioridade` |
  | `Incapacidade - CEJUSC` | `etiqueta_incapacidade_cejusc` |
  | `Limitação moderada ou grave` | `etiqueta_limitacao_moderada_grave` |
  | `Laudo C` | `etiqueta_laudo_c` |
  | `Laudo D` | `etiqueta_laudo_d` |
  | `Adicional de 25% - assistência permanente` | `etiqueta_adicional_25` |
  | `Social - esclarecer localização` | `etiqueta_social_esclarecer_localizacao` |
  | `Social - divergência` | `etiqueta_social_divergencia` |
  | `Social - renda até 1/2 SM` | `etiqueta_social_renda_ate_meio_sm` |
  | `Social - renda acima de 1/2 SM` | `etiqueta_social_renda_acima_meio_sm` |
  | `Complementação de laudo` | `etiqueta_complementacao_laudo` |
  | `Exame complementar` | `etiqueta_exame_complementar` |
  | `Redesignar perícia` | `etiqueta_redesignar_pericia` |
  | `Perícia in loco` | (em branco) |
  | `AVISO` e `INDEFINIDO` | `etiqueta_aviso_indefinido` |
  | partes já ouvidas, sem MPF (`… → …`) | a etiqueta secretaria da rotina, da configuração da `jef-expediente-manifestacao` |

- **Ação**, **Etiqueta controle** e **Perícia social** (colunas de 18/11/2026): só com as partes já ouvidas e sem MPF — a ação, a etiqueta controle e a etiqueta de área da perícia social da rotina da triagem de expediente, da configuração daquela skill. Nos demais casos, em branco.

- **Providência**: só nas providências que substituem a classificação — `termo ordinatório: perito anexar o laudo correto`; `termo ordinatório: perito complementar o laudo (quesitos para menores de 16 anos)`; `intimar a parte autora para providenciar os exames complementares`; `termo ordinatório de perícia in loco + contato da servidora com o perito`; no laudo social sem endereço, `intimar a parte autora para indicar o endereço para a diligência`. Nos demais casos, em branco.
- **Movimentar para**: a fase configurada em `jef-analise-laudo.fase_complementacao_laudo` (complementação de laudo) ou em `jef-analise-laudo.fase_exame_complementar` (exame complementar), com o nome exato do arquivo; nos demais casos, em branco.
- **Curatela**: `sim (prazo 15 dias, modelo <modelo_minuta_curador>)` na hipótese 1 (com o nome do modelo configurado em `jef-analise-laudo.modelo_minuta_curador`) da seção Curatela; `sim (intimar o advogado para comprovar termo de curatela ou ação de interdição)` na hipótese 2; nas duas ao mesmo tempo, os dois textos, separados por ` + `; caso contrário `não`. Sempre com a etiqueta configurada em `jef-analise-laudo.etiqueta_curador`, citada no Fundamento.
- **Documento não lido**: conforme a seção acima.
- **Petições após o laudo** (coluna pedida pela 7ª Vara em 23/10/2026): as petições e manifestações das partes juntadas depois do laudo classificado, uma por item, com a data, o tipo e o ID (ex.: `DD/MM/AAAA proposta de acordo do INSS (ID <id>); DD/MM/AAAA contestação (ID <id>)`). Entram proposta de acordo, contestação, impugnação ou manifestação sobre o laudo e outras petições; não entram certidões, intimações, ofícios de pagamento do perito nem os anexos que acompanham a petição. Sem nenhuma, `não há`. A coluna só informa: não muda a classificação nem a etiqueta.
- **Proposta de acordo**, **Intimação do laudo** e **MPF**: conforme a seção "Proposta de acordo, intimação do laudo e MPF". Só informam: não mudam a classificação nem a etiqueta.
- **Fundamento**: justificativa em uma ou duas frases, com a data do laudo, o grau/subgrau, a DII e o prazo estimado (quando aplicável), e o motivo de qualquer AVISO/INDEFINIDO, da FALHA NA INTIMAÇÃO e do INTIMAR MPF.
- **Sigiloso**: `sim` quando o processo tramitar em segredo de justiça, conforme classificação efetivamente registrada nele — nesses casos, mantenha o Fundamento no mínimo necessário para identificar o caso, sem detalhes de conteúdo além disso.

Identifique os processos pelo número, nunca pelo nome da parte.

Nome do arquivo: `Analise_Laudo_AAAA-MM-DD.xlsx`. Se o usuário tiver pasta conectada, salve lá além de entregar na conversa.

## Ao terminar

Relate primeiro o diagnóstico, depois os dados de apoio: quantos processos foram analisados no total, a divisão por classificação (`LOAS - Designar social`, `Prioridade`, `Limitação moderada ou grave`, `Incapacidade - CEJUSC`, `Laudo C`, `Laudo D`, `Adicional de 25% - assistência permanente`, os quatro resultados do laudo social, `Complementação de laudo`, `Exame complementar`, `Perícia in loco`, `Redesignar perícia`, `AVISO`), quantos foram para as etiquetas da triagem de expediente por terem as partes já ouvidas (por rotina e resultado) e quantos ficaram com a etiqueta do laudo por causa do MPF, quantos exigiram a providência de curatela (destacando cada um, com a hipótese, o prazo e o modelo de minuta quando houver, e lembrando, na hipótese 1, a necessidade do fluxo de pagamento da perícia), quantos tiveram MARCAR TODOS COMO LIDOS confirmado, e a relação dos AVISOS/INDEFINIDOS com o motivo de cada um. Informe também quantos processos têm proposta de acordo (e quantas aceitas, recusadas ou com contraproposta), quantos têm `FALHA NA INTIMAÇÃO` e quantos têm `INTIMAR MPF`, listando os números. Se algum processo do CSV tiver assunto diferente do escopo desta rotina, informe quantos foram excluídos por esse motivo. Informe o salário mínimo e a fonte usados no critério de renda do laudo social.

Se algum processo não for encontrado na consulta ou os autos não abrirem, diga quais e por quê. Nunca relate como analisado um processo que você não conseguiu abrir.
