---
name: "jef-fase-execucao"
description: "Para processos na fase de execução do JEF, a partir de CSV ou de uma lista de processos informada na conversa, localiza informação de cumprimento da obrigação de fazer (juntada pela CEAB ou pelo INSS), classifica o desfecho conforme a sentença ou o acordo homologado, a existência de planilha de cálculo e a manifestação da parte autora sobre ela, e gera relatório em .xlsx com a etiqueta prescrita (conforme a configuração da unidade) e a providência — sem inserir etiqueta no PJe, para a unidade que a instalou (PJe 1º grau do TRF5)."
---

# Fase de Execução — cumprimento da obrigação de fazer no PJe

Desenvolvida na 7ª Vara Federal da Paraíba. Os nomes de etiquetas, fases e assessores são os da unidade, lidos de `docs/configuracao-unidade.md` (ver "Configuração da unidade — antes de tudo").

Use quando o usuário fornecer um CSV, ou informar diretamente na conversa uma lista de números de processo na fase de execução, e pedir a verificação de cumprimento da obrigação de fazer — documento em regra juntado pela CEAB, mas por vezes também pelo INSS.

## Limite de atuação — leia antes de tudo

Esta skill **lê e diagnostica**. A única gravação autorizada no PJe é clicar em **MARCAR TODOS COMO LIDOS** quando houver documento pendente de leitura — mesmo padrão da `jef-expediente-manifestacao`, e obrigatório em todo processo desta lista, entre ou não no relatório final.

Nunca, em hipótese alguma, além dessa gravação:
- inserir ou retirar etiqueta;
- movimentar processo, protocolar, juntar documento, transferir tarefa, cancelar distribuição, ou expedir comunicação, ou remeter ao arquivo;
- preencher minuta, selecionar tipo de documento ou clicar em ASSINAR DOCUMENTO(S);
- digitar senha, certificado, token ou PIN. Aparecendo tela de login, pare e avise.

As colunas de etiqueta do relatório são **prescrição para quem vai executar**, nunca registro de etiqueta já inserida.

Todo o resto desta skill deve ser mantido intacto de uma versão para a outra: nenhuma alteração além da que o usuário pediu expressamente deve ser feita sem consulta prévia.

## Configuração da unidade — antes de tudo

Esta skill usa o arquivo `docs/configuracao-unidade.md`, na pasta do projeto. Leia-o no início de toda execução, antes da confirmação.

- Se o arquivo não existir, crie-o com o título `# Configuração da unidade`.
- O arquivo tem uma seção `##` por bloco. Cada item é uma linha `- <chave>: <valor>` ou uma tabela Markdown. Item sem resposta fica com o valor `PENDENTE`.
- Se faltar alguma das seções da lista abaixo, ou alguma das chaves dela, ou houver item `PENDENTE`, **pare antes de abrir qualquer processo** e faça ao usuário as perguntas que faltam, todas de uma vez, agrupadas por seção, explicando o que é cada item. Grave as respostas no arquivo (acrescentando as seções e chaves que faltam, sem apagar nem alterar as de outras skills), mostre o resumo do que ficou gravado e peça o "pode seguir".
- Seção comum (`## Comum — ...`) já preenchida por outra skill: reaproveite, sem perguntar de novo. Se ela existir mas faltar uma chave desta skill, pergunte só essa chave e acrescente-a à seção.
- Nunca use valor que não esteja no arquivo; nunca presuma nem use valores de outra unidade, nem os exemplos abaixo, que são fictícios. Se, no meio da execução, faltar um dado, pare e pergunte.
- O arquivo pode ser editado à mão pela unidade a qualquer momento; vale o que estiver nele na hora da leitura.

No corpo desta skill, `jef-fase-execucao.<chave>` é o item `<chave>` da seção `## jef-fase-execucao`, e `Comum — Assessores.<chave>` é o item da seção comum `## Comum — Assessores`. Toda etiqueta prescrita no relatório é o valor configurado, escrito exatamente como está no arquivo.

**Script.** O `analise-lote.js` não usa nenhum dado da configuração: ele só lê os autos e sugere um código de situação (`R`, `TUT`, `P`, `AS`, `AV`, `E`, `f`, `ARQ`, `AVISO`, `NC`, `CEAB`). Não há objeto de configuração a passar a ele. As etiquetas são postas por você, a partir da configuração, quando grava a linha do processo no arquivo de andamento.

### Perguntas da configuração

**Seção `## jef-fase-execucao`** (própria desta skill):

| Chave | Pergunta | Exemplo de formato (fictício) |
|---|---|---|
| `fases_da_rotina` | De quais fases (tarefas) do PJe vêm os processos desta rotina? (Só informativo: aparece na confirmação.) | `[JEF] Execução - Aguardar cumprimento; [JEF] Execução - Com manifestação` |
| `dia_da_rotina_semanal` | Em que dia da semana a unidade roda esta rotina? Responda `não se aplica` se não houver dia fixo. (Só informativo.) | `segunda-feira` |
| `etiqueta_obrigacao_fazer_com_multa` | Etiqueta dos processos que aguardam cumprimento de obrigação de fazer com multa (eles seguem esta mesma rotina). Responda `não se aplica` se a unidade não usar. | `EXEC - Obrigação de fazer com multa` |
| `etiqueta_tutela` | Etiqueta única do processo com tutela deferida na sentença, aguardando o cumprimento. | `EXEC_TUTELA` |
| `etiqueta_impugnacao` | Etiqueta única do AVISO de impugnação da parte autora ao cumprimento. | `EXEC_IMPUGNACAO` |
| `etiqueta_calculo` | Primeira etiqueta quando o INSS ainda não apresentou o cálculo dos atrasados (procedência ou acordo). | `EXEC_CALCULAR` |
| `etiqueta_calculo_sentenca` | Segunda etiqueta, junto da anterior, na procedência com atrasados (pedido de planilha de cálculo para a sentença). | `CALC - Planilha da sentença` |
| `etiqueta_calculo_acordo` | Segunda etiqueta, junto da `etiqueta_calculo`, no acordo homologado sem valor dos atrasados. | `CALC - Planilha do acordo` |
| `etiqueta_arquivamento` | Etiqueta única do encaminhamento para arquivamento (só averbação; DIB e DIP na mesma data, sem atrasados). | `EXEC_ARQUIVAR` |
| `etiqueta_movimentar_rpv` | Etiqueta única do encaminhamento para expedição de RPV (acordo com valor, acordo em audiência com planilha, planilha de atrasados com a sentença, concordância com o cálculo do INSS). | `EXEC_RPV` |
| `etiqueta_intimar_calculo` | Primeira etiqueta quando o INSS apresentou o cálculo e a parte autora ainda não se manifestou (intimar a parte). | `EXEC_INTIMAR_CALCULO` |
| `etiqueta_aguardando_manifestacao_calculo` | Segunda etiqueta, obrigatória junto da anterior: aguardando manifestação sobre a planilha de cálculo. | `EXEC - Aguardando manifestação do cálculo` |
| `etiqueta_concluir_decisao` | Primeira etiqueta quando a parte autora discordou do cálculo do INSS (concluir para decisão). | `EXEC_CONCLUIR` |
| `etiqueta_nao_classificados` | Etiqueta dos processos da aba "Não classificados" (análise pela direção). | `EXEC_NAO_CLASSIFICADO` |

**Seção `## Comum — Assessores`** (comum a todas as skills; reaproveite o que já estiver preenchido). Esta skill usa três itens, para a segunda etiqueta da discordância do cálculo (ver "Tabela do assessor — fase de execução"):

| Chave | Pergunta | Exemplo de formato (fictício) |
|---|---|---|
| `assessor_salario_maternidade_pensao_reclusao` | Etiqueta do assessor que recebe os processos de salário-maternidade, pensão por morte e auxílio-reclusão. Responda `não se aplica` se a unidade não separa esses assuntos (eles seguem, então, para os passos seguintes da tabela). Se a seção já tiver as chaves separadas `assessor_salario_maternidade`, `assessor_pensao_morte` e `assessor_auxilio_reclusao` (gravadas por outra skill), não pergunte esta: use a chave de cada assunto (ver "Tabela do assessor — fase de execução"). Se tiver só uma ou duas delas, pergunte só as que faltam, com o mesmo nome. | `ASSESSORIA - Gabinete A` |
| `assessor_agricultor` | Etiqueta do assessor que recebe os processos de parte autora agricultora (ou pescadora artesanal ou catadora de mariscos, equiparadas). Responda `não se aplica` se a unidade não separa esses processos (eles seguem, então, para a distribuição por dígito). | `ASSESSORIA - Gabinete B` |
| `assessor_por_digito` | Tabela: para cada último dígito do número sequencial do processo (o dígito imediatamente antes do dígito verificador, de 0 a 9), a etiqueta do assessor. Os dez dígitos têm de estar na tabela. | ver abaixo |

Formato da tabela `assessor_por_digito` no arquivo (linha `- assessor_por_digito: tabela abaixo`, seguida da tabela; exemplo fictício):

```
- assessor_por_digito: tabela abaixo

| Último dígito | Etiqueta do assessor |
|---|---|
| 0 | ASSESSORIA - Gabinete C |
| 1 | ASSESSORIA - Gabinete C |
| 2 | ASSESSORIA - Gabinete D |
| ... | ... |
| 9 | ASSESSORIA - Gabinete E |
```

## Entrada — arquivo CSV ou lista de processos na conversa

Os processos a analisar — na fase de execução — podem chegar de duas formas, e ambas são igualmente válidas:

**A) Arquivo CSV.** Só é usado o CSV fornecido junto com este pedido de execução da rotina — esta skill **não reaproveita** um CSV fornecido anteriormente na conversa, ainda que já tenha sido usado numa análise anterior. Se o usuário pedir uma nova análise sem anexar um CSV a este pedido, e também não informar uma lista de processos na conversa, peça o arquivo (ou a lista) antes de prosseguir — não presuma nem reutilize um CSV anterior.

Leia o CSV com separador `;` e encoding `utf-8-sig`, usando o campo `numeroProcesso` para compor a lista de processos a analisar.

**B) Lista de processos informada na conversa** — números digitados ou colados diretamente no chat, sem CSV anexado a este pedido.

Em regra, os processos vêm das fases do PJe configuradas em `jef-fase-execucao.fases_da_rotina`. Esta rotina vale também, sem nenhuma alteração nas regras de classificação, para os processos com a etiqueta configurada em `jef-fase-execucao.etiqueta_obrigacao_fazer_com_multa` (se a unidade não a usar, o valor é `não se aplica`).

## Confirmação antes de iniciar — parada obrigatória

Antes de abrir qualquer processo (e depois de conferida a configuração da unidade), confirme com o usuário:
- que a configuração da unidade foi lida (ou acabou de ser preenchida), com as fases de `jef-fase-execucao.fases_da_rotina`;
- quantos processos foram informados, com a lista completa dos números;
- que em cada um deles será localizado o evento mais recente relevante (comprovante de cumprimento da obrigação de fazer, ou documento de rotina) e, havendo documento pendente de leitura, será clicado MARCAR TODOS COMO LIDOS;
- estimativa de esforço: pelo script de lote (abaixo), um processo por vez, a leitura leva cerca de 8 a 10 segundos por processo, mais o tempo de conferir cada resumo e as paradas para login, se a sessão do PJe expirar.

Só comece a análise com o "pode seguir" do usuário.

## Progresso durante a execução — informe obrigatório a cada 20 processos

Ao completar o 20º processo analisado, registre uma mensagem de progresso parcial: quantos já foram analisados do total confirmado, e quantos até aquele ponto caíram em cada situação (rotina/apenas leitura, CEAB a intimar novamente, comprovante classificado, não classificado).

Essa mensagem precisa ficar registrada no histórico da conversa — não pode apenas surgir na tela e desaparecer sozinha, como uma notificação passageira. Se a sessão em execução dispuser de uma ferramenta própria para enviar mensagem ao usuário (distinta do texto informal que aparece entre uma chamada de ferramenta e outra), use-a para postar o informe. Não havendo essa ferramenta, poste o informe como texto normal da resposta em andamento.

Em nenhum dos dois casos interrompa a execução para postar o informe: **nunca encerre o turno nem espere confirmação do usuário para prosseguir** — poste o informe e continue imediatamente, na mesma resposta, para o próximo processo. Isso é apenas um informe, **não uma parada para confirmação**: aqui não se espera resposta do usuário nem "pode seguir" antes de prosseguir. Preferir esse risco (o informe eventualmente não ficar tão visível no histórico quanto postado por uma ferramenta dedicada) a interromper a rotina.

Repita a cada novo múltiplo de 20 (20, 40, 60, 80...) até terminar. Não acumule várias rodadas de 20 sem reportar.

Se, por qualquer motivo, a análise chegar ao fim sem ter passado por esses informes intermediários, isso é um desvio da rotina: sinalize esse desvio explicitamente ao usuário junto do relato final, em vez de simplesmente omiti-lo.

O relato completo de conclusão segue à parte, na seção Ao terminar.

## Como abrir cada processo

Use a **consulta processual**, não a fila. A consulta não vincula tarefa a ninguém e não altera estado.

1. `https://pje1g.trf5.jus.br/pje/Processo/ConsultaProcesso/listView.seam`
2. O número é preenchido em campos separados. Ids: `fPP:numeroProcesso:numeroSequencial`, `:numeroDigitoVerificador`, `:Ano`, `:NumeroOrgaoJustica` (o código do órgão, que são os 4 últimos dígitos do próprio número do processo). Ramo (4) e tribunal (05) já vêm preenchidos. Botão: `fPP:searchProcessos`.
3. Clique no número no resultado. Os autos abrem em janela nova — redirecione `window.open` para a mesma aba antes de clicar, senão a janela fica fora de alcance.
4. A cronologia sai em texto do próprio documento (não está em iframe).

Esse caminho manual serve para conferir um processo na tela. O lote roda pelo script abaixo.

## Execução em lote — script `analise-lote.js` e arquivo de andamento

A leitura dos processos roda pelo script `analise-lote.js`, que fica nesta pasta da skill. Ele faz o mesmo caminho da seção anterior (consulta processual → autos) e lê, em cada processo: a sentença de mérito (e a planilha juntada com ela); no acordo, a ata de audiência, a planilha que a acompanha e a proposta do INSS; o acórdão posterior, se houver; e os documentos juntados depois da sentença, com a origem (INSS ou parte autora) e marcas do que trazem. A leitura não grava nada; a única gravação do script é o MARCAR TODOS COMO LIDOS, chamado à parte, processo a processo (ver a seção própria, abaixo). Quem classifica sou eu, pelas regras desta skill. Se uma regra desta skill mudar, ajuste o script junto.

1. No Chrome, abra a página estática `https://pje1g.trf5.jus.br/pje/js/pdfjs/web/locale/locale.json` e injete nela, com o javascript_tool, o conteúdo integral de `analise-lote.js` — leia o arquivo antes; não reescreva de memória. Cada processo abre num iframe oculto, e a página de cima não muda de endereço.
2. Inicie com `window.__FX.inicia(lista, base)` (`base` = nº do primeiro processo da lista menos 1). Um processo por vez, um documento por vez: mais que isso faz o PJe bloquear o acesso por 10 minutos (HTTP 429). Se o script parar com `429`, espere os 10 minutos antes de retomar.
3. Acompanhe com `window.__FX.estado()`. Para ler os resumos, chame `window.__FX.mostra(a, b)` e leia a página com `get_page_text` — de 6 a 8 processos por leitura. O retorno do javascript_tool é cortado em cerca de 1.200 caracteres; o `get_page_text`, não.

**Como ler o resumo.** O cabeçalho traz `nl` (documentos não lidos), `docs` (documentos na cronologia / no processo) e `PROP`, uma sugestão: `R` (rotina), `TUT`, `P` (procedência com atrasados, com a situação do cálculo do INSS), `AS` (acordo sem valor, idem), `AV` (acordo com valor), `E` (acordo em audiência com planilha), `f` (planilha de atrasados com a sentença), `ARQ` (b, g ou h), `AVISO`, `NC` e `CEAB` (sem comprovante nem documento posterior à sentença: CEAB a intimar novamente, fora do relatório). Em seguida vêm a sentença (`TIPO` e marcas como `TUTELA`, `ATRASADOS`, `AVERBAÇÃO`, `DIB=DIP`), os anexos, o acordo, o acórdão e os documentos posteriores, do mais recente para o mais antigo, cada um com marcas (`COMPROVANTE(autor:confere)`, `CÁLCULO`, `CONCORDA`, `DISCORDA`, `IMPUGNA`, `CIÊNCIA`, `DESTAQUE` etc.) e a origem. A sugestão não decide: confira-a, em todo processo, no dispositivo da sentença e no teor dos documentos antes de gravar a classificação. `PROP:?` e `rever: ...` pedem leitura atenta. Impugnação ao cumprimento, discordância do cálculo (e a tabela do assessor), tutela, comprovante sem conferência de autor e "nos termos da planilha em anexo" sempre se decidem pelo texto, nunca pela sugestão.

**O que o script não lê.** Documento `ILEGÍVEL` (PDF digitalizado ou com fonte sem texto, que sai em símbolos) e sentença fora da cronologia carregada (`sentença não localizada (cronologia carregou N de M documentos)`) são lidos na tela: abra o processo numa aba visível. O laudo médico pericial, usado só na tabela do assessor (discordância do cálculo), também é conferido na tela.

**Arquivo de andamento — gravar à medida que sai, nunca só no final.** Antes de iniciar, crie `Relatórios/Fase_Execucao_AAAA-MM-DD_andamento.txt` com uma linha `L|<nº>|<processo>` por processo do lote. A cada leitura dos resumos, grave uma linha por processo: `<nº>|<processo>|<código>|<situação>|<etiqueta>|<2ª etiqueta>|<providência>|<sigiloso>|nl=<não lidos>` (as etiquetas com o texto configurado em `docs/configuracao-unidade.md`), com o código `R` (rotina, só MARCAR TODOS COMO LIDOS), `CEAB` (CEAB a intimar novamente, fora do relatório), `TUT`, a letra da hipótese (a–h, com a hipótese 1, 2 ou 3 do cálculo, quando houver), `AVISO` ou `NC`; depois do MARCAR TODOS COMO LIDOS, acrescente ao último campo o resultado devolvido (ex.: `nl=2 MTL OK`). Processo que depende de leitura na tela fica numa linha `#PENDENTE <nº>|<processo>|<o que falta>` até ser resolvido; vale a última linha de cada processo. O relatório final (.xlsx) é gerado desse arquivo.

**Interrupção.** Se a sessão do PJe expirar, o script para sozinho (`login em <processo>`). Peça ao usuário que se autentique, injete o script de novo e reinicie só com os processos do lote que ainda não têm linha no arquivo. O mesmo vale se o navegador ou a conversa caírem, ou se a aba recarregar (`window.__FX` some).

## Como classificar

A cronologia é **decrescente**: o que está acima é mais recente. Localize, entre os eventos mais recentes, qual documento efetivamente motiva a análise deste processo: um **comprovante de cumprimento da obrigação de fazer** (juntado pela CEAB, ou, em alguns casos, pelo INSS), ou um dos **documentos de rotina** listados abaixo.

### Tutela deferida na sentença — aguardando cumprimento da obrigação de fazer

Antes de aplicar os documentos de rotina, verifique se o processo está aguardando cumprimento de obrigação de fazer por **deferimento de tutela na sentença** (ainda sem comprovante de cumprimento juntado). Estando, a etiqueta única é a configurada em `jef-fase-execucao.etiqueta_tutela` — **havendo ou não interposição de recurso** (por isso, nesses processos, o recurso da alínea d abaixo não encerra a rotina em mera leitura). Providência: registre que a sentença deferiu tutela e que o processo aguarda o cumprimento da obrigação de fazer, informando se há recurso interposto.

### Sem comprovante e sem documento posterior — CEAB a intimar novamente (fora do relatório)

Não sendo caso de tutela (acima), se o processo aguarda o cumprimento da obrigação de fazer — sentença ou acordo homologado, em regra já transitado em julgado — e **não há, depois da sentença ou da homologação, nenhum comprovante de cumprimento nem nenhum documento de rotina** nos autos, a CEAB deverá ser intimada novamente. Exemplo: acordo homologado e transitado em julgado, com proposta do INSS de atrasados sem valor, e nada juntado depois da homologação.

Esse processo **não entra no relatório** — nem na aba Relatório, nem em "Não classificados". Não classifique e não gere linha no .xlsx: apenas conte o processo no resumo final, em separado (ver "Ao terminar"). Havendo documento pendente de leitura, MARCAR TODOS COMO LIDOS segue a regra própria, abaixo.

### Documentos de rotina — apenas MARCAR TODOS COMO LIDOS

Sendo o evento mais recente relevante um dos tipos abaixo — e não um comprovante de cumprimento de obrigação de fazer — a rotina se encerra em MARCAR TODOS COMO LIDOS (ver seção própria, abaixo): não classifique, não gere linha no relatório, apenas conte o processo no resumo final.

a) Juntada de documentos, procuração, exames médicos, laudos médicos ou documentos comprobatórios pela parte autora.
b) Petição de ciência (qualquer tipo).
c) Processo administrativo/dossiê previdenciário juntado pela parte autora ou pela CEAB.
d) Recurso da parte autora ou do INSS contra sentença de procedência.
e) Petição de apresentação de quesitos para perícia.
f) Pedido de andamento processual/impulso processual.
g) Juntada de contrato de honorários.
h) Pedido de destaque de honorários.
i) Pedido de providências pelo não cumprimento da obrigação de fazer, ou informação da parte autora de descumprimento da obrigação de fazer.

Documento que não se enquadre em nenhum desses nove tipos, e que também não seja um comprovante de cumprimento de obrigação de fazer, vai para "Não classificados", abaixo — não decida no escuro.

### Comprovante de cumprimento de obrigação de fazer

Encontrado o comprovante, **confira se ele diz respeito ao autor da ação** — comparando o nome e o CPF constantes do comprovante com os da parte autora do processo. Se o comprovante se referir a outra pessoa (ex.: outro segurado ou outro processo), ele não vale como cumprimento da obrigação de fazer deste processo: vá para "Não classificados", registrando o motivo (comprovante não corresponde ao autor). A conferência é só para a análise; no relatório, o processo continua identificado apenas pelo número.

Sendo o comprovante do autor, examine o que veio depois dele na cronologia (mais recente, portanto acima).

**Impugnação ao cumprimento.** Havendo, depois da juntada do comprovante, impugnação da parte autora ao cumprimento da obrigação de fazer → classificação **"AVISO - impugnação ao cumprimento"**: primeira etiqueta a configurada em `jef-fase-execucao.etiqueta_impugnacao` (etiqueta única); registre na Providência um resumo da impugnação, para decisão humana sobre o processo.

**Sem impugnação.** Não havendo impugnação, verifique o tipo de sentença ou decisão do processo:

a) **SENTENÇA DE PROCEDÊNCIA, com determinação de pagamento de atrasados**, sem planilha de cálculo de **atrasados** juntada pelo próprio juízo com a sentença → ver "Elaboração ou acompanhamento do cálculo", abaixo (situação "procedência com atrasados"). Havendo planilha de cálculo de atrasados juntada com a sentença, aplique a alínea f.
   **Sentença que cita "nos termos da planilha em anexo":** verifique se a planilha de cálculo dos atrasados realmente está junto com a sentença — às vezes só há a menção na sentença e a planilha não foi feita. Se **não existir** a planilha, aplica-se a regra desta alínea a: primeira etiqueta `jef-fase-execucao.etiqueta_calculo`; segunda etiqueta `jef-fase-execucao.etiqueta_calculo_sentenca`. Existindo, aplique a alínea f.
   **Atenção — não confundir as duas planilhas que o juízo pode juntar com a sentença:** (1) a planilha de **cálculo de tempo para aposentadoria** e (2) a planilha de **cálculo de atrasados**. Sentença de procedência acompanhada apenas da planilha de **tempo para aposentadoria** (planilha 1) **não** é a alínea f: aplica-se a regra desta alínea a — primeira etiqueta `jef-fase-execucao.etiqueta_calculo`; segunda etiqueta `jef-fase-execucao.etiqueta_calculo_sentenca` —, pois os atrasados ainda não foram calculados.
b) **SENTENÇA DE PROCEDÊNCIA, que apenas determinou averbação de período/tempo de contribuição**, sem determinação de pagamento de atrasados → etiqueta única `jef-fase-execucao.etiqueta_arquivamento`. Providência: registre que a sentença determinou apenas averbação de tempo, sem atrasados a apurar; encaminhamento para arquivamento.
c) **SENTENÇA DE HOMOLOGAÇÃO DE ACORDO**, cuja proposta do INSS previu pagamento de atrasados **sem informar o valor** → ver "Elaboração ou acompanhamento do cálculo", abaixo (situação "acordo sem valor").
d) **SENTENÇA DE HOMOLOGAÇÃO DE ACORDO**, cuja proposta do INSS previu pagamento de atrasados **e já informou o valor** → etiqueta única `jef-fase-execucao.etiqueta_movimentar_rpv`. Providência: registre o valor constante da proposta homologada.

e) **ACORDO realizado em audiência, com juntada da planilha de cálculo** → etiqueta única `jef-fase-execucao.etiqueta_movimentar_rpv`. Providência: registre que o acordo foi celebrado em audiência e que a planilha de cálculo foi juntada.
f) **SENTENÇA DE PROCEDÊNCIA com planilha de cálculo de atrasados juntada pelo próprio juízo com a sentença** (não confundir com planilha para cálculo de tempo de aposentadoria, que leva à alínea a: `jef-fase-execucao.etiqueta_calculo` + `jef-fase-execucao.etiqueta_calculo_sentenca`) → etiqueta única `jef-fase-execucao.etiqueta_movimentar_rpv`. Providência: registre que a planilha de atrasados acompanhou a sentença.
g) **SENTENÇA que concede o benefício com DIB e DIP na mesma data (data da prolação), sem parcelas vencidas e sem averbação** — ou seja, "sem parcelas vencidas/sem atrasados a apurar" ou "parcelas apenas por complemento positivo" → etiqueta única `jef-fase-execucao.etiqueta_arquivamento`. Providência: registre que a sentença fixou DIB e DIP na mesma data, sem atrasados a apurar (ou apenas parcelas por complemento positivo) nem averbação; encaminhamento para arquivamento.
h) **SENTENÇA DE HOMOLOGAÇÃO DE ACORDO com DIB e DIP na mesma data, "SEM PAGAMENTO DE ATRASADOS"** → etiqueta única `jef-fase-execucao.etiqueta_arquivamento`. Providência: registre que o acordo homologado fixou DIB e DIP na mesma data, sem pagamento de atrasados; encaminhamento para arquivamento.

Situação diferente das oito acima (ex.: sentença de improcedência, ou outro desfecho não previsto) → vá para "Não classificados", abaixo; não decida no escuro, registre o motivo.

### Elaboração ou acompanhamento do cálculo (situações "procedência com atrasados" e "acordo sem valor")

Verifique se o INSS já apresentou planilha de cálculos no processo.

**Como procurar a planilha do INSS.** Não se limite ao título dos documentos da cronologia. O INSS costuma juntar o cálculo dentro de uma petição ou de anexos com título genérico, como "Petição (outras)", "Petição (outras) (A PARECER TÉCNICO…)", "Petição (outras) (A ANEXO…)", "Outras peças (INSS)" ou "Documentos Diversos". Por isso, procure também pelo texto os documentos juntados pelo INSS/PGF (polo passivo, Equipe de Cálculos, ECALC/CALPREV, CEAB) depois da sentença ou da homologação do acordo. Considere apresentada a planilha quando o texto de qualquer desses documentos trouxer, por exemplo: "cálculo de liquidação", "Parecer Técnico … CALPREV/ECALC5", "planilha de cálculo", "demonstrativo de cálculo", "valor devido" com apuração por competência, ou o anexo de cálculo referido na petição. Basta a existência do cálculo do INSS nos autos, ainda que o título do documento não diga "planilha" ou "cálculo". Encontrado o cálculo, siga as hipóteses 1, 2 e 3 (manifestação da parte autora depois da juntada). Registre na Providência o número do documento em que o cálculo foi encontrado.

**INSS ainda não apresentou planilha de cálculos:**
- Situação "procedência com atrasados" → primeira etiqueta `jef-fase-execucao.etiqueta_calculo`; segunda etiqueta `jef-fase-execucao.etiqueta_calculo_sentenca`.
- Situação "acordo sem valor" → primeira etiqueta `jef-fase-execucao.etiqueta_calculo`; segunda etiqueta `jef-fase-execucao.etiqueta_calculo_acordo`.

**INSS já apresentou planilha de cálculos** — examine a manifestação da parte autora sobre esse cálculo, depois da juntada:

1. **Parte autora ainda não se manifestou sobre o cálculo** → primeira etiqueta `jef-fase-execucao.etiqueta_intimar_calculo`; segunda etiqueta `jef-fase-execucao.etiqueta_aguardando_manifestacao_calculo`. **A etiqueta de `etiqueta_intimar_calculo` nunca vai sozinha:** em todo caso em que a primeira etiqueta for a de `etiqueta_intimar_calculo`, a segunda etiqueta, a de `etiqueta_aguardando_manifestacao_calculo`, é obrigatória — não deixe a coluna Segunda etiqueta em branco nem use outra.
2. **Parte autora manifestou concordância com o cálculo** → etiqueta única `jef-fase-execucao.etiqueta_movimentar_rpv`.
3. **Parte autora manifestou discordância com o cálculo** → primeira etiqueta `jef-fase-execucao.etiqueta_concluir_decisao`; segunda etiqueta conforme a "Tabela do assessor — fase de execução", abaixo.

Registre na Providência qual das três hipóteses se aplicou e, nas hipóteses 1 e 3, o número de identificação da petição relevante.

### Tabela do assessor — fase de execução

Usada só na hipótese 3 acima (discordância da parte autora quanto ao cálculo do INSS), para definir a segunda etiqueta. As etiquetas dos assessores vêm da seção comum `## Comum — Assessores` da configuração da unidade.

1. Confira o **assunto principal do processo**, no cabeçalho dos autos:
   - "salário maternidade", "pensão por morte" ou "auxílio reclusão" → segunda etiqueta `Comum — Assessores.assessor_salario_maternidade_pensao_reclusao`. Se a seção não tiver essa chave, mas tiver as chaves separadas (gravadas por outra skill), a segunda etiqueta é a do assunto: `Comum — Assessores.assessor_salario_maternidade`, `.assessor_pensao_morte` ou `.assessor_auxilio_reclusao`. Se a unidade tiver respondido `não se aplica` (na chave única ou na do assunto), siga para o passo 2.
   - Qualquer outro assunto → siga para o passo 2.
2. Havendo **laudo médico pericial** no processo, confira nele a profissão declarada pela parte autora:
   - **Profissão AGRICULTOR(A)** (ou profissão equiparada a agricultor(a): **pescador(a) artesanal** ou **catador(a) de mariscos**) → segunda etiqueta `Comum — Assessores.assessor_agricultor`. Se a unidade tiver respondido `não se aplica`, siga para a distribuição por dígito, abaixo.
   - Qualquer outra profissão, profissão não declarada, ou processo sem laudo médico → confira o último dígito do número do processo, imediatamente antes do dígito verificador, e aplique a tabela `Comum — Assessores.assessor_por_digito`: a segunda etiqueta é a que a tabela atribui a esse dígito.

Exemplo: no processo `0000005-00.2026.4.05.0000`, o número antes do dígito verificador é `0000005`; o último dígito é `5` → a etiqueta que a tabela `assessor_por_digito` atribui ao dígito 5.

### Não classificados

Não vão para cá os processos sem comprovante e sem nenhum documento posterior à sentença ou à homologação: esses ficam fora do relatório, porque a CEAB deverá ser intimada novamente (ver seção própria, acima).

Vão para cá: documentos de rotina que não se enquadrem nos tipos a-i; comprovante de cumprimento que não diga respeito ao autor da ação; comprovante de cumprimento cuja sentença/decisão não se enquadre em nenhuma das oito hipóteses a-h; documento ilegível ou que não carregou; ou qualquer teor ambíguo. Não decida no escuro; registre o motivo, para decisão humana sobre a hipótese aplicável.

## MARCAR TODOS COMO LIDOS — documentos não lidos

Se a cronologia trouxer o aviso **"Há N documento(s) não lido(s)"**, no topo do painel, clique em **MARCAR TODOS COMO LIDOS** — em todo processo desta lista que tiver documento pendente de leitura, independentemente de o processo entrar ou não no relatório de resultado (rotina, comprovante classificado, AVISO ou não classificado). Confirme que o aviso sumiu antes de passar ao próximo processo.

Esse botão só existe dentro dos autos, um processo por vez — não há equivalente em lote.

Nunca clique em MARCAR TODOS COMO LIDOS num processo cujos autos não abriram.

**No lote**, o resumo de cada processo traz `nl` (o número de não lidos na hora da leitura). Para cada processo com `nl` maior que zero, depois de gravada a classificação dele no arquivo de andamento, chame `await window.__FX.marca('<processo>', <nl>)`. O script abre os autos no quadro oculto, clica em MARCAR TODOS COMO LIDOS e confere que o aviso sumiu. Um processo por vez, nunca antes da classificação gravada.

- `MTL OK`: grave no arquivo de andamento.
- `NÃO MARCADO: eram X não lidos na leitura e agora são Y`: chegou documento depois da leitura. Leia o processo de novo antes de marcar — nada é marcado sem ser lido.
- `MTL FALHOU` ou `botão ... não encontrado`: abra o processo numa aba visível e clique pela tela, conferindo o aviso.

## Entregável

Um único arquivo .xlsx, fonte Arial, com duas abas.

**Aba `Relatório`** — uma linha por processo que passou pela análise do comprovante de cumprimento (situações a-h, tutela e AVISO):

| Processo | Situação | Etiqueta | Segunda etiqueta | Providência | Sigiloso |
|---|---|---|---|---|---|

A coluna **Situação** recebe uma descrição curta (ex.: "procedência com atrasados — INSS não apresentou cálculo", "acordo com valor definido", "AVISO - impugnação ao cumprimento"). As colunas **Etiqueta** e **Segunda etiqueta** recebem as etiquetas prescritas — prescrição para inserção manual, nunca registro de etiqueta já inserida; na classificação AVISO, a Etiqueta recebe a configurada em `jef-fase-execucao.etiqueta_impugnacao` e a Segunda etiqueta fica em branco. A coluna **Sigiloso** recebe "sim" quando o processo tramitar em segredo de justiça, conforme classificação efetivamente registrada nele; nesses casos, mantenha a descrição no mínimo necessário para identificar a situação, sem detalhes de conteúdo além disso.

**Aba `Não classificados`** — uma linha por processo que caiu em "Não classificados":

| Processo | Descrição do documento/situação | Etiqueta | Sigiloso |
|---|---|---|---|

Na coluna **Etiqueta** desta aba, registre sempre a etiqueta configurada em `jef-fase-execucao.etiqueta_nao_classificados` (prescrição para inserção manual). Identifique processos pelo número, nunca pelo nome da parte, em nenhuma das duas abas.

Nome do arquivo: `Fase_Execucao_AAAA-MM-DD.xlsx`. Se o usuário tiver pasta conectada, salve lá além de entregar na conversa.

## Ao terminar

Relate primeiro o diagnóstico, depois os dados de apoio: quantos processos foram analisados no total; quantos continham apenas documento de rotina (apenas MARCAR TODOS COMO LIDOS, sem linha no relatório); quantos estavam sem comprovante e sem nenhum documento posterior à sentença ou à homologação (CEAB a intimar novamente, sem linha no relatório); quantos foram classificados a partir do comprovante de cumprimento, com a divisão por situação e etiqueta; quantos ficaram em AVISO (impugnação, destacando a necessidade de decisão humana sobre cada um); quantos ficaram em "Não classificados" (idem); e quantos tiveram MARCAR TODOS COMO LIDOS confirmado.

Se algum processo não for encontrado na consulta ou os autos não abrirem, diga quais e por quê. Nunca relate como analisado um processo que você não conseguiu abrir.
