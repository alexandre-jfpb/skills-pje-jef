---
name: "jef-devolvidos-tr"
description: "Para processos devolvidos pela Turma Recursal, abre cada um, identifica o acórdão de mérito (considerando embargos de declaração e decisões de TRU, TNU, STJ ou STF que tenham modificado o julgamento) e classifica o resultado em uma das situações definidas nesta skill, gerando relatório em .xlsx com o tipo de sentença, o resultado do acórdão, a etiqueta prescrita (conforme a configuração da unidade em docs/configuracao-unidade.md) e a providência — sem inserir etiqueta no PJe 1º grau do TRF5."
---

# Devolvidos da Turma Recursal — classificação do acórdão e providência

Desenvolvida na 7ª Vara Federal da Paraíba. As regras de classificação refletem as decisões dessa vara e devem ser revistas pela unidade antes do uso com processos reais; as etiquetas, a tabela de zonas da perícia social e os demais dados próprios da unidade vêm da configuração (seção "Configuração da unidade — antes de tudo").

Use quando o usuário fornecer um arquivo CSV, ou informar diretamente na conversa uma lista de números de processo, devolvidos pela Turma Recursal, e pedir a análise do resultado do julgamento, a etiqueta cabível e a providência decorrente.

## Limite de atuação — leia antes de tudo

Esta skill **lê e diagnostica**. Ela não insere, retira nem altera etiqueta no PJe, não movimenta processo, não protocola, não junta documento, não preenche minuta nem assina documento algum. A coluna Etiqueta do relatório é **prescrição para execução manual** pela secretaria — nunca um registro de etiqueta já inserida.

A única gravação autorizada no PJe é clicar em **MARCAR TODOS COMO LIDOS**, quando houver documento pendente de leitura no processo — mesmo padrão das demais skills desta família.

Nunca, em hipótese alguma, além dessa gravação:
- inserir ou retirar etiqueta;
- movimentar processo, protocolar, juntar documento, transferir tarefa, cancelar distribuição, ou expedir comunicação, ou remeter ao arquivo;
- preencher minuta, selecionar tipo de documento ou clicar em ASSINAR DOCUMENTO(S);
- digitar senha, certificado, token ou PIN. Aparecendo tela de login, pare e avise.

Todo o resto desta skill deve ser mantido intacto de uma versão para a outra: nenhuma alteração além da que o usuário pediu expressamente deve ser feita sem consulta prévia.

## Configuração da unidade — antes de tudo

Esta skill usa o arquivo `docs/configuracao-unidade.md`, na pasta do projeto. Leia-o no início de toda execução, antes da confirmação.

- Se o arquivo não existir, crie-o com o título `# Configuração da unidade`. O arquivo não vem no pacote da skill, para não sobrescrever a configuração de quem já instalou outra skill desta família.
- Formato: uma seção `##` por bloco; cada item é uma linha `- <chave>: <valor>` ou uma tabela Markdown. Item sem resposta fica com o valor `PENDENTE`.
- Se faltar alguma seção ou item da lista abaixo, ou houver item `PENDENTE`, **pare antes de abrir qualquer processo** e faça ao usuário as perguntas que faltam, todas de uma vez, agrupadas por seção, explicando o que é cada item. Grave as respostas no arquivo (acrescentando as seções e os itens que faltam, sem apagar nem alterar o que já existe), mostre o resumo do que ficou gravado e peça o "pode seguir".
- Seção comum (`## Comum — ...`) já preenchida por outra skill: reaproveite, sem perguntar de novo, no formato em que estiver. Pergunte só o item que faltar nela.
- Nunca use valor que não esteja no arquivo; nunca presuma nem use os valores da unidade em que a skill foi desenvolvida, nem os exemplos abaixo, que são fictícios. Se, no meio da execução, faltar um dado (ex.: um bairro que não está na tabela e que o usuário acha que deveria estar), pare e pergunte.
- O usuário pode editar o arquivo à mão depois; vale sempre o que estiver nele na hora da execução. As listas mudam: leia a tabela da perícia social a cada execução, no passo em que ela é usada, nunca de memória.

### Perguntas da configuração

**Seção `## Comum — Unidade`** (comum a todas as skills da família)

- `nome_unidade` — Qual é o nome da unidade, como deve aparecer nos relatos? Ex.: `Xª Vara Federal de Cidade Exemplo`.
- `codigo_orgao` — Quais são os 4 últimos dígitos do número dos processos da unidade (código do órgão)? Ex.: `9999`, em `0000000-00.2026.4.05.9999`.
- `tribunal` — A que tribunal a unidade pertence? Ex.: `TRF5`. Esta skill foi feita para o PJe 1º grau do TRF5 (endereços e campos de tela); se a resposta for outro tribunal, avise o usuário de que a skill pode não funcionar e só siga com o "pode seguir" dele.

**Seção `## Comum — Perícia social (zonas, bairros e municípios)`** (comum a todas as skills da família)

- `zonas` — Quais etiquetas de perícia social a unidade usa para distribuir os endereços (por zona da cidade, por assistente social, por grupo de municípios), e quais bairros ou municípios cada uma atende? Grave numa tabela logo abaixo da linha `- zonas: tabela abaixo`, uma linha por etiqueta, com o nome exato da etiqueta no PJe, o tipo (`bairro`, quando a etiqueta é definida pelo bairro do endereço; `município`, quando é definida pelo município) e a lista de bairros ou municípios, separados por ponto e vírgula. Ex. (fictício):

  | Etiqueta | Tipo | Bairros ou municípios |
  |---|---|---|
  | `ZONA EXEMPLO 1` | bairro | Centro; Bairro Exemplo; Vila Exemplo |
  | `Município A/Município B - AS Exemplo` | município | Município A; Município B |

Município inteiro atendido por uma etiqueta de zona (ex.: cidade vizinha incluída numa zona) entra na mesma linha, pelo nome do município. A seção comum tem ainda os itens `etiqueta_fora_das_listas` e `municipios_por_bairro`, usados por outras skills da família; esta skill não os usa nem pergunta por eles (se já estiverem gravados, deixe-os como estão). O que fazer com o endereço fora de todas as linhas da tabela `zonas` é, nesta skill, o item próprio `etiqueta_fora_zoneamento`, abaixo: aqui a etiqueta prescrita é a de expedição do mandado de constatação, que pode ser diferente da `etiqueta_fora_das_listas` das outras skills.

**Seção `## jef-devolvidos-tr`** (só desta skill) — as etiquetas que a skill prescreve, com o nome exato que têm no PJe:

- `etiqueta_arquivamento` — Etiqueta para o processo que vai ao arquivo (improcedência mantida, sentença reformada para improcedência, extinção sem resolução do mérito)? Ex.: `Y_ARQUIVAR`.
- `etiqueta_execucao` — Etiqueta para o processo que vai à execução (procedência mantida ou concedida pelo acórdão)? Ex.: `Y_EXECUTAR`.
- `etiqueta_sentenca_anulada` — Etiqueta para a sentença anulada pela Turma Recursal, com retorno dos autos? Ex.: `Y_SENTENCA_ANULADA`.
- `etiqueta_audiencia_instrucao` — Etiqueta para designar audiência de instrução? Ex.: `AUDIÊNCIA - Marcar instrução`.
- `etiqueta_pericia_psiquiatra` — Etiqueta para perícia médica com psiquiatra? Ex.: `PERÍCIA - Psiquiatria`. Se a seção `Comum — Etiquetas de perícia médica` já trouxer a etiqueta de psiquiatria, proponha-a ao perguntar.
- `etiqueta_diligencia_tr` — Etiqueta para o processo devolvido para diligência determinada pela Turma Recursal? Ex.: `Y_DILIGENCIA_TURMA`.
- `etiqueta_complementacao_laudo` — Etiqueta para pedir ao perito a complementação do laudo? Ex.: `PERÍCIA - Pedir complementação`.
- `etiqueta_indefinido` — Etiqueta para o processo que vai à decisão humana (indefinido)? Ex.: `Y_DIRETOR_ANALISAR`.
- `etiqueta_esclarecer_endereco` — Etiqueta para intimar a parte a esclarecer o endereço, quando ele não permite localizar o imóvel? Ex.: `Y_ENDERECO_ESCLARECER`.
- `etiqueta_fora_zoneamento` — Etiqueta para o endereço da perícia social que não está em nenhuma linha da tabela `zonas` de `Comum — Perícia social` (em geral, a expedição de mandado de constatação)? Não é a `Comum — Perícia social.etiqueta_fora_das_listas`, que outras skills usam como etiqueta de controle; se a unidade usar a mesma etiqueta nos dois casos, repita-a aqui. Ex.: `CUMPRIMENTO - Mandado de constatação`.
- `migrados_prefixo_sequencial` — A unidade tem processos migrados de outro sistema (no TRF5, o Creta) que precisam de correção do cadastro? Se sim, por quais dígitos começa o sequencial (os 7 primeiros dígitos do número) desses processos? Ex.: `09`. Se não: `não se aplica`.
- `pasta_relatorios` — Em que pasta do projeto a skill grava o arquivo de andamento e o relatório? Ex.: `Relatorios`.

### Como a configuração chega ao script

As etiquetas e a tabela de zonas não vão ao script: quem as prescreve sou eu, pelas regras desta skill. O script só precisa do prefixo dos processos migrados. Depois de injetar o `analise-lote.js` (seção "Execução em lote") e antes do `inicia`, chame:

`window.__DT.config({ prefixoMigrados: '<migrados_prefixo_sequencial>' })`

- `não se aplica` → `prefixoMigrados: ''` (nenhum processo é sinalizado; a coluna Cadastro Creta fica em branco).
- Copie o valor exatamente como está no arquivo. Confira o resumo que a chamada devolve. Sem a configuração, o `inicia` não roda e diz o que falta.

## Entrada — arquivo CSV ou lista de processos na conversa

Os processos a analisar — devolvidos pela Turma Recursal após julgamento de recurso — podem chegar de duas formas, e ambas são igualmente válidas:

**A) Arquivo CSV.** Só é usado o CSV fornecido junto com este pedido de execução da rotina — esta skill **não reaproveita** um CSV fornecido anteriormente na conversa, ainda que já tenha sido usado numa análise anterior. Se o usuário pedir uma nova análise sem anexar um CSV a este pedido, e também não informar uma lista de processos na conversa, peça o arquivo (ou a lista) antes de prosseguir — não presuma nem reutilize um CSV anterior.

Leia o CSV com separador `;` e encoding `utf-8-sig`, usando o campo `numeroProcesso` para compor a lista de processos a analisar.

**B) Lista de processos informada na conversa** — números digitados ou colados diretamente no chat, sem CSV anexado a este pedido.

## Confirmação antes de iniciar — parada obrigatória

Antes de abrir qualquer processo, confirme com o usuário:
- quantos processos foram informados, com a lista completa dos números;
- que as etiquetas prescritas e a tabela de zonas da perícia social são as da configuração da unidade (mostre o resumo das etiquetas e o prefixo dos processos migrados);
- que cada um será aberto, o acórdão de mérito será lido e classificado numa das situações previstas (abaixo), e o relatório final trará a etiqueta prescrita — sem inserção da etiqueta no PJe;
- estimativa de esforço: pelo script de lote (abaixo), um processo por vez, a leitura leva cerca de 6 a 10 segundos por processo (277 processos em cerca de 22 minutos, em 08/10/2026), mais o tempo de conferir cada resumo e as paradas para login, se a sessão do PJe expirar.

Só comece a análise com o "pode seguir" do usuário.

## Progresso durante a execução — informe obrigatório a cada 20 processos

Ao completar o 20º processo analisado, registre uma mensagem de progresso parcial: quantos já foram analisados do total confirmado, e quantos processos até aquele ponto caíram em cada situação (1 a 7, ou indefinido).

Essa mensagem precisa ficar registrada no histórico da conversa — não pode apenas surgir na tela e desaparecer sozinha, como uma notificação passageira. Se a sessão em execução dispuser de uma ferramenta própria para enviar mensagem ao usuário (distinta do texto informal que aparece entre uma chamada de ferramenta e outra), use-a para postar o informe. Não havendo essa ferramenta, poste o informe como texto normal da resposta em andamento.

Em nenhum dos dois casos interrompa a execução para postar o informe: **nunca encerre o turno nem espere confirmação do usuário para prosseguir** — poste o informe e continue imediatamente, na mesma resposta, para o próximo processo. Isso é apenas um informe, **não uma parada para confirmação**: aqui não se espera resposta do usuário nem "pode seguir" antes de prosseguir. Preferir esse risco (o informe eventualmente não ficar tão visível no histórico quanto postado por uma ferramenta dedicada) a interromper a rotina.

Repita a cada novo múltiplo de 20 (20, 40, 60, 80...) até terminar. Não acumule várias rodadas de 20 sem reportar.

Se, por qualquer motivo, a análise chegar ao fim sem ter passado por esses informes intermediários, isso é um desvio da rotina: sinalize esse desvio explicitamente ao usuário junto do relato final, em vez de simplesmente omiti-lo.

O relato completo de conclusão segue à parte, na seção Ao terminar.

## Como abrir cada processo

Use a **consulta processual**, não a fila. A consulta não vincula tarefa a ninguém e não altera estado.

1. `https://pje1g.trf5.jus.br/pje/Processo/ConsultaProcesso/listView.seam`
2. O número é preenchido em campos separados. Ids: `fPP:numeroProcesso:numeroSequencial`, `:numeroDigitoVerificador`, `:Ano`, `:NumeroOrgaoJustica` (o código do órgão: os 4 últimos dígitos do número, configurados em `Comum — Unidade` → `codigo_orgao`). Ramo (4) e tribunal (05) já vêm preenchidos. Botão: `fPP:searchProcessos`.
3. Clique no número no resultado. Os autos abrem em janela nova — redirecione `window.open` para a mesma aba antes de clicar, senão a janela fica fora de alcance.
4. A cronologia sai em texto do próprio documento (não está em iframe).

Esse caminho manual serve para conferir um processo na tela. O lote roda pelo script abaixo.

## Execução em lote — script `analise-lote.js` e arquivo de andamento

A leitura dos processos roda pelo script `analise-lote.js`, que fica nesta pasta da skill. Ele faz o mesmo caminho da seção anterior (consulta processual → autos), lê a cronologia e o teor das sentenças, dos acórdãos e das decisões posteriores à sentença, e monta um resumo por processo. A leitura não grava nada; a única gravação do script é o MARCAR TODOS COMO LIDOS, chamado à parte, processo a processo (ver a seção própria, abaixo). Quem classifica sou eu, pelas regras desta skill. Se uma regra desta skill mudar, ajuste o script junto.

1. No Chrome, abra a página estática `https://pje1g.trf5.jus.br/pje/js/pdfjs/web/locale/locale.json` e injete nela, com o javascript_tool, o conteúdo integral de `analise-lote.js` — leia o arquivo antes; não reescreva de memória. Cada processo abre num iframe oculto, e a página de cima não muda de endereço.
2. Passe a configuração da unidade com `window.__DT.config({...})` (ver "Como a configuração chega ao script", acima) e confira o resumo devolvido. Inicie com `window.__DT.inicia(lista, base)` (`base` = nº do primeiro processo da lista menos 1). Um processo por vez, um documento por vez: mais que isso faz o PJe bloquear o acesso por 10 minutos (HTTP 429). Se o script parar com `429`, espere os 10 minutos antes de retomar.
3. Acompanhe com `window.__DT.estado()`. Para ler os resumos, chame `window.__DT.mostra(a, b)` e leia a página com `get_page_text` — de 10 a 15 processos por leitura. O retorno do javascript_tool é cortado em cerca de 1.200 caracteres; o `get_page_text`, não.

**Como ler o resumo.** O cabeçalho traz `nl` (documentos não lidos), `docs` (documentos na cronologia / no processo), `creta` e `PROP`, uma sugestão de situação montada pelo tipo de sentença (`TIPO`), pelo recorrente (`REC`) e pelo resultado (`RES`) do acórdão de mérito. A sugestão não decide: confira-a, em todo processo, na súmula do acórdão (`FIM`) e no dispositivo da sentença (`DISP`) antes de gravar a classificação. `PROP:?` e `rever: ...` pedem leitura atenta. Embargos providos, decisões posteriores à sentença, provimento parcial, recurso das duas partes e anulação ou diligência (para a medida e a segunda etiqueta) sempre se decidem pelo texto, nunca pela sugestão.

**Cronologia parcial.** A cronologia dos autos carrega só os documentos mais recentes. Quando a sentença ficar de fora (`sentença não localizada (cronologia carregou N de M documentos)`), abra o processo numa aba visível, role a cronologia até a sentença e leia o teor. Documento digitalizado (`DIGITALIZADO`, sem texto) também é lido pela tela.

**Endereço da parte autora** (situações 6c, 6d e 7): `window.__DT.ends([processos])` procura o endereço nos documentos do processo e põe o resultado na página, para leitura com `get_page_text` quando `window.__DT.endOk` for `true`. Aplique ao que encontrar o "Procedimento de localização de endereço", abaixo.

**Arquivo de andamento — gravar à medida que sai, nunca só no final.** Antes de iniciar, crie `<pasta_relatorios>/Devolvidos_TR_AAAA-MM-DD_andamento.txt` (a pasta configurada em `jef-devolvidos-tr.pasta_relatorios`) com uma linha `L|<nº>|<processo>|<creta: sim ou não>` por processo do lote. A cada leitura dos resumos, grave uma linha por processo classificado: `<nº>|<processo>|<situação>|<tipo de sentença>|<resultado do acórdão>|<etiqueta>|<2ª etiqueta>|<3ª etiqueta>|<Creta>|<providência>|<sigiloso>|nl=<não lidos>`; depois do MARCAR TODOS COMO LIDOS, acrescente ao último campo o resultado devolvido (ex.: `nl=2 MTL OK`). Processo que depende de leitura na tela ou de endereço fica numa linha `#PENDENTE <nº>|<processo>|<o que falta>` até ser resolvido; vale a última linha de cada processo. O relatório final (.xlsx) é gerado desse arquivo.

**Interrupção.** Se a sessão do PJe expirar, o script para sozinho (`login em <processo>`). Peça ao usuário que se autentique, injete o script de novo, passe a configuração de novo (`window.__DT.config`) e reinicie só com os processos do lote que ainda não têm linha no arquivo. O mesmo vale se o navegador ou a conversa caírem, ou se a aba recarregar (`window.__DT` some).

## Como classificar o acórdão

A cronologia é **decrescente**: o que está acima é mais recente. Localize a **sentença** proferida no processo e o **acórdão de mérito** — o julgamento do recurso interposto contra essa sentença — e leia o teor de ambos. Não presuma o tipo de sentença (improcedência, procedência, ou procedência parcial) a partir do que o acórdão relata sobre ela: abra o próprio documento da sentença para confirmá-lo. Da mesma forma, não presuma o resultado do acórdão pelo nome do evento; abra e leia o próprio acórdão (ou, na falta dele no processo, a certidão de julgamento/ementa).

**Embargos de declaração, incidentes de uniformização e recursos posteriores ao acórdão de mérito.** Depois do acórdão, é comum haver eventos adicionais no processo — na própria Turma Recursal ou em instância superior (Turma Regional de Uniformização - TRU, Turma Nacional de Uniformização - TNU, STJ ou STF). Trate-os assim:
- Agravo ou pedido que teve seguimento negado (ex.: negativa de seguimento a incidente de uniformização), embargos de declaração **rejeitados/não providos**, e decisão da TRU, TNU, STJ ou STF que **não conheceu** do incidente/recurso ou **negou provimento**: não alteram o mérito já fixado. Não precisam ser mencionados no relatório — classifique pelo acórdão de mérito, ignorando-os.
- Embargos de declaração **providos com efeitos infringentes/modificativos**, ou decisão da TRU, TNU, STJ ou STF que **deu provimento** ao incidente de uniformização, recurso especial ou recurso extraordinário — isto é, que alteraram o resultado do julgamento: classifique pelo resultado **final**, já incorporando a modificação, e mencione no relatório (na Providência) qual instância decidiu, que houve provimento, com a data e o que mudou.
- Outras petições/decisões interlocutórias semelhantes que não alterem o mérito do julgamento seguem a mesma regra: não decidem a classificação, não precisam ser mencionadas.

Encontrado o acórdão de mérito (ou seu resultado final, após eventual modificação por embargos ou por decisão de TRU, TNU, STJ ou STF), classifique conforme as situações abaixo.

**1) Sentença de IMPROCEDÊNCIA + acórdão NEGA PROVIMENTO ao recurso da parte autora**, mantendo a sentença por seus próprios fundamentos.
- Etiqueta prescrita: a configurada em `jef-devolvidos-tr.etiqueta_arquivamento`
- Providência: registre que a sentença de improcedência foi mantida por seus próprios fundamentos; encaminhamento para arquivamento.

**2) Sentença de IMPROCEDÊNCIA + acórdão DÁ PROVIMENTO ao recurso da parte autora.**
- Etiqueta prescrita: a configurada em `jef-devolvidos-tr.etiqueta_execucao`
- Providência: especifique qual foi a determinação do acórdão — o que passou a ser reconhecido/concedido e em que termos (benefício, DIB, RMI, ou o que mais o acórdão tiver fixado).

**3) Sentença de PROCEDÊNCIA (total ou parcial) + acórdão DÁ PROVIMENTO ao recurso do INSS**, para julgar improcedente o pedido autoral.
- Etiqueta prescrita: a configurada em `jef-devolvidos-tr.etiqueta_arquivamento`
- Providência: registre que a sentença foi reformada para julgar improcedente o pedido; encaminhamento para arquivamento.

**4) Sentença de PROCEDÊNCIA (total ou parcial) + acórdão NEGA PROVIMENTO ao recurso da parte autora**, mantendo a sentença por seus próprios fundamentos.
- Etiqueta prescrita: a configurada em `jef-devolvidos-tr.etiqueta_execucao`
- Providência: registre que a sentença de procedência foi mantida por seus próprios fundamentos; execução nos termos da sentença original.

**5) Sentença de PROCEDÊNCIA (total ou parcial) + acórdão NEGA PROVIMENTO ao recurso do INSS**, mantendo a sentença por seus próprios fundamentos.
- Etiqueta prescrita: a configurada em `jef-devolvidos-tr.etiqueta_execucao`
- Providência: registre que a sentença de procedência foi mantida por seus próprios fundamentos; execução nos termos da sentença original.

**6) ANULAÇÃO DE SENTENÇA**, com retorno dos autos à vara federal para continuidade do processamento.
- Etiqueta prescrita (primeira): a configurada em `jef-devolvidos-tr.etiqueta_sentenca_anulada` — sempre, em toda anulação de sentença, mesmo quando nenhuma das três medidas abaixo se aplicar.
- Providência: descreva o que o acórdão determinou que deve ser feito na origem.
- Segunda etiqueta, conforme a medida determinada pelo acórdão para a continuidade do processamento. O acórdão pode determinar mais de uma medida cumulativamente (ex.: psiquiatra e perícia social) — nesse caso, aplique a hipótese d, com as duas etiquetas adicionais:
  - **a) Realização de audiência de instrução** → segunda etiqueta configurada em `jef-devolvidos-tr.etiqueta_audiencia_instrucao`.
  - **b) Realização de perícia médica com psiquiatra** (isoladamente, sem perícia social cumulativa) → segunda etiqueta configurada em `jef-devolvidos-tr.etiqueta_pericia_psiquiatra`.
  - **c) Realização de perícia social** (isoladamente, sem perícia médica com psiquiatra cumulativa) → segunda etiqueta conforme o "Procedimento de localização de endereço (perícia social/mandado de constatação)", logo abaixo da lista de situações.
  - **d) Realização de perícia médica com psiquiatra E perícia social, cumulativamente** → segunda etiqueta configurada em `jef-devolvidos-tr.etiqueta_pericia_psiquiatra`; **terceira etiqueta** conforme o "Procedimento de localização de endereço (perícia social/mandado de constatação)", logo abaixo da lista de situações.
  - Medida determinada diferente das quatro acima (ex.: produzir prova de outra natureza, proferir nova sentença sobre ponto específico sem nova instrução): sem segunda etiqueta — descreva a medida na Providência, normalmente.

**7) Devolução para REALIZAÇÃO DE DILIGÊNCIA** determinada pela Turma Recursal.
- Etiqueta prescrita (primeira): a configurada em `jef-devolvidos-tr.etiqueta_diligencia_tr`
- Providência: descreva qual foi a diligência determinada pelo acórdão.
- Segunda etiqueta, conforme a diligência determinada:
  - **Complementação de laudo pericial** pela perita judicial → segunda etiqueta configurada em `jef-devolvidos-tr.etiqueta_complementacao_laudo`.
  - **Perícia social ou mandado de constatação** → segunda etiqueta conforme o "Procedimento de localização de endereço (perícia social/mandado de constatação)", logo abaixo da lista de situações.
  - Diligência de outra natureza: sem segunda etiqueta — descreva a diligência na Providência, normalmente.

**8) INDEFINIDO/AVISO** — o resultado não se enquadra com clareza em nenhuma das sete situações acima (ex.: provimento parcial que não caiba integralmente em nenhuma hipótese, resultado misto entre as partes, acórdão ilegível ou que não carregou). Etiqueta prescrita: a configurada em `jef-devolvidos-tr.etiqueta_indefinido`; registre a descrição do teor do acórdão, para decisão humana sobre a hipótese aplicável.

### Procedimento de localização de endereço (perícia social/mandado de constatação)

Usado nas situações 6c, 6d e 7 quando a medida determinada pelo acórdão for perícia social ou mandado de constatação. Pesquise o endereço da parte autora nos autos — dos documentos mais recentes para os mais antigos —, procurando o endereço, pontos de referência ou telefone para contato. O `DT.ends` só lê texto: documento marcado `DIGITALIZADO` (foto ou digitalização, como comprovante de residência, fatura de energia ou de água, procuração) tem de ser aberto e visto pela imagem — renderize a página do PDF num canvas e olhe a captura de tela. Antes de prescrever a etiqueta configurada em `jef-devolvidos-tr.etiqueta_esclarecer_endereco`, confira os digitalizados, sobretudo os comprovantes de residência e as faturas. Dado de localização em qualquer documento do processo (ex.: fatura com rua, número e bairro), ainda que em nome de terceiro, dispensa o esclarecimento: prescreva a etiqueta de zoneamento. Até a v2, o `DT.ends` lia só os 8 documentos mais recentes que não são atos do juízo e os 6 mais antigos, e a petição da parte autora no meio do processo informando alteração ou detalhamento do endereço ficava de fora. Por decisão do usuário (26/10/2026), a pesquisa foi ampliada só para a busca de endereço da perícia social (situações 6c, 6d e 7 com perícia social ou mandado de constatação), e somente nelas: a v3 lê também as petições, manifestações e comprovantes da parte autora na cronologia (até 40) e os 15 ids mais recentes fora da cronologia carregada. Nenhuma outra leitura da rotina é ampliada. Mesmo assim, antes de prescrever a etiqueta configurada em `jef-devolvidos-tr.etiqueta_esclarecer_endereco`, confira o resultado e os documentos `DIGITALIZADO`. Correção do usuário em 26/10/2026, a partir de um processo em que a petição de alteração de endereço (com rua, número, ponto de referência e telefone) ficou de fora da leitura.

- **Endereço que não permite localizar exatamente o imóvel** (ex.: rua projetada, nome de rua sem número) ou sem ponto de referência nem telefone que permitam a localização → segunda etiqueta configurada em `jef-devolvidos-tr.etiqueta_esclarecer_endereco`.
- **Endereço completo, ou com ponto de referência/telefone suficientes para localizar o imóvel** → confira o bairro ou município na tabela de zoneamento (tabela `zonas` da seção `## Comum — Perícia social (zonas, bairros e municípios)` do `docs/configuracao-unidade.md` — no Claude Code, na pasta `docs/` da raiz do projeto; se ela não estiver no diretório de trabalho atual, procure-a antes de desistir; no claude.ai/Cowork, `claude/pje/configuracao-unidade.md`, lido com `project_read`; consulte-a em toda execução, porque a lista muda):
  - bairro ou município corresponde a uma linha da tabela `zonas` (bairro listado numa linha de tipo `bairro`, ou município listado numa linha de qualquer tipo) → segunda etiqueta: a etiqueta dessa linha, com o nome exato que está na tabela;
  - bairro ou município fora de todas as linhas da tabela `zonas` → segunda etiqueta configurada em `jef-devolvidos-tr.etiqueta_fora_zoneamento`.

Registre o endereço encontrado (e a referência ou telefone, quando houver) na Providência.

Pontos de atenção, para não confundir tipos próximos:
- As situações 4 e 5 têm a mesma etiqueta (a configurada em `jef-devolvidos-tr.etiqueta_execucao`), mas resultam de recursos de partes diferentes (parte autora, na 4; INSS, na 5) — registre com precisão, na coluna Resultado do acórdão, de qual parte era o recurso negado, ainda que a etiqueta prescrita coincida.
- "Tipo de sentença" registra o que a sentença de origem efetivamente decidiu (improcedência, procedência, ou procedência parcial, conforme constar dela) — não presuma a partir do resultado do acórdão.
- O agravo indeferido, o incidente de uniformização não conhecido pela TRU/TNU, o recurso especial/extraordinário não conhecido pelo STJ/STF e os embargos de declaração rejeitados não são, por si sós, o "acórdão de mérito" desta classificação — continue procurando o acórdão que efetivamente julgou o recurso contra a sentença.
- Casos de "revisão da vida toda" (recálculo de RMI) em que o acórdão deu provimento ao recurso do INSS para julgar improcedente o pedido autoral, com base no Tema 1102 do STF (já superado/decidido), sem que recurso posterior tenha alterado esse resultado: aplica-se normalmente a situação 3 (a etiqueta configurada em `jef-devolvidos-tr.etiqueta_arquivamento`) — não é caso à parte, apesar da complexidade da matéria de fundo.
- Benefício por incapacidade temporária (auxílio-doença) em que a sentença é de procedência (total ou parcial) e o acórdão dá provimento, total ou parcial, ao recurso da parte autora apenas para ampliar o período a pagar ou para garantir o prazo mínimo de 30 dias contados da implantação, a fim de viabilizar o pedido de prorrogação (Tema 246 da TNU, item I), mantidos os demais termos da sentença: não é situação 8 (indefinido). Prescreva a etiqueta configurada em `jef-devolvidos-tr.etiqueta_execucao`, com execução nos termos da sentença e da garantia fixada pelo acórdão; registre na coluna Resultado do acórdão o que o acórdão acrescentou. Esse critério vale só para esse caso (e para o dos itens seguintes): os demais provimentos parciais que não caibam nas situações 1 a 7 continuam na situação 8.
- Sentença de **extinção sem resolução do mérito** (art. 485 do CPC — coisa julgada, inadequação do pedido, falta de interesse de agir etc.) que o acórdão **mantém** (nega provimento ao recurso da parte autora), ou sentença de procedência (total ou parcial) que o acórdão **reforma para extinguir o processo sem resolução do mérito** (dá provimento ao recurso do INSS): não é situação 8 (indefinido). Prescreva a etiqueta configurada em `jef-devolvidos-tr.etiqueta_arquivamento`, com encaminhamento para arquivamento; registre em "Tipo de sentença" que a extinção foi sem resolução do mérito e o fundamento (ex.: coisa julgada, art. 485, V). Decisão do usuário em 26/10/2026.
- Sentença de procedência (total ou parcial), ou de improcedência, em que o acórdão **dá provimento, total ou parcial, a recurso da parte autora ou do INSS apenas para alterar a DIB ou a DCB** (retroagir a DIB à DER ou a outra data, deslocar a DIB para a citação, suprimir a DCB do BPC etc.), mantidos os demais termos da sentença: não é situação 8 (indefinido). Prescreva a etiqueta configurada em `jef-devolvidos-tr.etiqueta_execucao`, com execução nos termos da sentença e da alteração fixada pelo acórdão; registre na coluna Resultado do acórdão a nova DIB ou DCB. Vale para qualquer benefício, não só para auxílio por incapacidade temporária. Decisão do usuário em 26/10/2026. Provimento parcial com outro alcance continua na situação 8.

## Sinalização de cadastro migrado do sistema Creta

Processos migrados do sistema Creta têm o sequencial do número do processo (os 7 dígitos antes do dígito verificador) começando pelos dígitos configurados em `jef-devolvidos-tr.migrados_prefixo_sequencial` — por exemplo, com o prefixo fictício `09`, `0900000-00.2022.4.05.0000` (sequencial `0900000`). Para todo processo analisado nessa condição, sinalize a necessidade de correção do cadastro, na coluna própria do relatório (ver Entregável, abaixo). Com `migrados_prefixo_sequencial` = `não se aplica`, nenhum processo é sinalizado.

Não aplique essa sinalização aos processos classificados com a etiqueta configurada em `jef-devolvidos-tr.etiqueta_arquivamento` (situações 1 e 3), mesmo que o sequencial comece pelo prefixo configurado.

## MARCAR TODOS COMO LIDOS — documentos não lidos

Se a cronologia trouxer o aviso **"Há N documento(s) não lido(s)"**, no topo do painel, clique em **MARCAR TODOS COMO LIDOS** depois de concluir a leitura e a classificação do processo. Confirme que o aviso sumiu antes de passar ao próximo processo.

Esse botão só existe dentro dos autos, um processo por vez — não há equivalente em lote.

**No lote**, o resumo de cada processo traz `nl` (o número de não lidos na hora da leitura). Para cada processo com `nl` maior que zero, depois de gravada a classificação dele no arquivo de andamento, chame `await window.__DT.marca('<processo>', <nl>)`. O script abre os autos no quadro oculto, clica em MARCAR TODOS COMO LIDOS e confere que o aviso sumiu. Um processo por vez, nunca antes da classificação gravada, nunca em processo cujos autos não abriram.

- `MTL OK`: grave no arquivo de andamento.
- `NÃO MARCADO: eram X não lidos na leitura e agora são Y`: chegou documento depois da leitura. Leia o processo de novo antes de marcar — nada é marcado sem ser lido.
- `MTL FALHOU` ou `botão ... não encontrado`: abra o processo numa aba visível e clique pela tela, conferindo o aviso.

## Entregável

Um único arquivo .xlsx, fonte Arial, com duas abas.

**Aba `Relatório`** — uma linha por processo, para as situações 1 a 7:

| Processo | Tipo de sentença | Resultado do acórdão | Etiqueta | Segunda etiqueta | Terceira etiqueta | Cadastro Creta | Providência | Sigiloso |
|---|---|---|---|---|---|---|---|---|

A coluna **Etiqueta** recebe a etiqueta prescrita pela situação (ex.: a configurada em `jef-devolvidos-tr.etiqueta_execucao`) — é prescrição para inserção manual, não registro de etiqueta já inserida. A coluna **Segunda etiqueta** só é preenchida nas situações 6 e 7, e só quando a medida ou diligência determinada se enquadrar num dos casos com segunda etiqueta prevista (ver as situações 6 e 7, e o "Procedimento de localização de endereço", acima); nos demais casos e situações, fica em branco. A coluna **Terceira etiqueta** só é preenchida na situação 6d (psiquiatra e perícia social cumulativamente); em todos os demais casos, fica em branco. A coluna **Cadastro Creta** recebe "sim" quando o sequencial do processo começar pelo prefixo configurado em `jef-devolvidos-tr.migrados_prefixo_sequencial` e a etiqueta não for a configurada em `jef-devolvidos-tr.etiqueta_arquivamento` (ver "Sinalização de cadastro migrado do sistema Creta", acima); nos demais casos, fica em branco. A coluna **Sigiloso** recebe "sim" quando o processo tramitar em segredo de justiça, conforme classificação efetivamente registrada nele; nesses casos, mantenha a descrição no mínimo necessário para identificar a situação, sem detalhes de conteúdo além disso.

**Aba `Indefinidos`** — uma linha por processo classificado na situação 8:

| Processo | Tipo de sentença | Descrição do acórdão | Etiqueta | Sigiloso |
|---|---|---|---|---|

Identifique processos pelo número, nunca pelo nome da parte, em nenhuma das duas abas.

Nome do arquivo: `Devolvidos_TR_AAAA-MM-DD.xlsx`, gravado na pasta configurada em `jef-devolvidos-tr.pasta_relatorios`. Se o usuário tiver pasta conectada, salve lá além de entregar na conversa.

## Ao terminar

Relate primeiro o diagnóstico, depois os dados de apoio: quantos processos foram analisados no total, a divisão por situação (1 a 7, com quantidades), quantos ficaram indefinidos (situação 8, destacando a necessidade de decisão humana sobre cada um) e quantos tiveram MARCAR TODOS COMO LIDOS confirmado. Destaque também, um a um, os processos em que embargos de declaração ou decisão de TRU, TNU, STJ ou STF modificaram o resultado do acórdão de mérito, com a instância, a data e o que mudou, e quantos processos foram sinalizados para correção de cadastro (migrados do Creta).

Se algum processo não for encontrado na consulta ou os autos não abrirem, diga quais e por quê. Nunca relate como analisado um processo que você não conseguiu abrir.
