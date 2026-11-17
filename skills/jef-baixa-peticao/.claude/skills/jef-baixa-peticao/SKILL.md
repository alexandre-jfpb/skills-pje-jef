---
name: "jef-baixa-peticao"
description: "Para uma lista de números de processo informada na conversa, abre cada processo no PJe 1º grau do TRF5, identifica e classifica o(s) documento(s) não lido(s) segundo os tipos de petição definidos nesta skill, com os dados da unidade lidos de docs/configuracao-unidade.md, gera relatório em .xlsx com os casos relevantes e os indefinidos (para decisão humana), e marca todos os documentos como lidos em cada processo."
---

# Baixa de Petição — classificação de documentos não lidos no PJe

Desenvolvida na 7ª Vara Federal da Paraíba. As regras de classificação refletem as decisões dessa vara e devem ser revistas pela unidade antes do uso com processos reais; os dados próprios da unidade vêm da configuração (seção "Configuração da unidade — antes de tudo").

Use quando o usuário fornecer, diretamente na conversa, uma lista de números de processo e pedir a baixa/triagem dos documentos não lidos desses processos — classificando-os conforme relevância para o relatório e marcando-os como lidos no PJe.

## Limite de atuação — leia antes de tudo

Esta skill **lê, classifica e marca como lido**. A única gravação autorizada no PJe é clicar em **MARCAR TODOS COMO LIDOS**, e ela é obrigatória em todo processo desta lista que tiver documento pendente de leitura — independentemente de o processo entrar ou não no relatório final.

Nunca, em hipótese alguma, além dessa gravação:
- inserir ou retirar etiqueta;
- movimentar processo, protocolar, juntar documento, transferir tarefa, cancelar distribuição, ou expedir comunicação, ou remeter ao arquivo;
- preencher minuta, selecionar tipo de documento ou clicar em ASSINAR DOCUMENTO(S);
- digitar senha, certificado, token ou PIN. Aparecendo tela de login, pare e avise.

O relatório é **registro para gestão**, não um pedido de nova ação além da leitura marcada.

Todo o resto desta skill deve ser mantido intacto de uma versão para a outra: nenhuma alteração além da que o usuário pediu expressamente deve ser feita sem consulta prévia.

## Configuração da unidade — antes de tudo

Esta skill usa o arquivo `docs/configuracao-unidade.md`, na pasta do projeto. Leia-o no início de toda execução, antes da confirmação.

- Se o arquivo não existir, crie-o com o título `# Configuração da unidade`. O arquivo não vem no pacote da skill, para não sobrescrever a configuração de quem já instalou outra skill desta família.
- Formato: uma seção `##` por bloco; cada item é uma linha `- <chave>: <valor>`. Item sem resposta fica com o valor `PENDENTE`.
- Se faltar alguma seção ou item da lista abaixo, ou houver item `PENDENTE`, **pare antes de abrir qualquer processo** e faça ao usuário as perguntas que faltam, todas de uma vez, agrupadas por seção, explicando o que é cada item. Grave as respostas no arquivo (acrescentando as seções e os itens que faltam, sem apagar nem alterar o que já existe), mostre o resumo do que ficou gravado e peça o "pode seguir".
- Seção comum (`## Comum — ...`) já preenchida por outra skill: reaproveite, sem perguntar de novo. Pergunte só o item que faltar nela.
- Nunca use valor que não esteja no arquivo; nunca presuma nem use os valores da unidade em que a skill foi desenvolvida, nem os exemplos abaixo, que são fictícios. Se, no meio da execução, faltar um dado, pare e pergunte.
- O usuário pode editar o arquivo à mão depois; vale sempre o que estiver nele na hora da execução.

### Perguntas da configuração

**Seção `## Comum — Unidade`** (comum a todas as skills da família)

- `nome_unidade` — Qual é o nome da unidade, como deve aparecer nos relatos? Ex.: `Xª Vara Federal de Cidade Exemplo`.
- `codigo_orgao` — Quais são os 4 últimos dígitos do número dos processos da unidade (código do órgão)? Ex.: `9999`, em `0000000-00.2026.4.05.9999`.
- `tribunal` — A que tribunal a unidade pertence? Ex.: `TRF5`. Esta skill foi feita para o PJe 1º grau do TRF5 (endereços e campos de tela); se a resposta for outro tribunal, avise o usuário de que a skill pode não funcionar e só siga com o "pode seguir" dele.

**Seção `## jef-baixa-peticao`** (só desta skill)

- `fases_2i` — Em quais tarefas (fases) do PJe a contestação do INSS, a impugnação à contestação e a réplica não precisam de atenção da secretaria (Caso 2, alínea i)? O nome exato de cada tarefa, como aparece no PJe, separados por `;`. Ex.: `[XYZ] Perícia - Aguardar exemplo; [XYZ] Perícia - Designar exemplo`. Se nenhuma: `nenhuma` (a alínea i deixa de se aplicar).
- `certidao_nomeacao` — Que texto aparece, no título da cronologia, na certidão juntada quando o perito é nomeado (Caso 2, alínea j)? Ex.: `Certidão de designação de perito`. Se a unidade não junta essa certidão: `não se aplica` (a alínea j deixa de se aplicar).
- `certidao_intimacao_pericia` — Qual é o título, no texto da certidão, da certidão que informa às partes o local da perícia (Caso 2, alínea k)? Ex.: `CERTIDÃO DE AGENDAMENTO DE PERÍCIA`. Se a unidade não junta essa certidão: `não se aplica` (a alínea k deixa de se aplicar).
- `pasta_relatorios` — Em que pasta do projeto a skill grava o arquivo de andamento e o relatório? Ex.: `Relatorios`.

### Como a configuração chega ao script

Depois de carregar o `analise-lote.js` (seção "Execução em lote") e antes do `inicia`, monte o objeto a partir da seção `## jef-baixa-peticao` e chame:

`window.__BP.config({ fases2i: [<cada tarefa de fases_2i, como texto>], certidaoNomeacao: '<certidao_nomeacao>', certidaoIntimacaoPericia: '<certidao_intimacao_pericia>' })`

- `nenhuma` em `fases_2i` → `fases2i: []`; `não se aplica` numa certidão → `''`.
- Copie os valores exatamente como estão no arquivo, sem completar nem corrigir. O script compara sem distinguir maiúsculas, acentos e espaços.
- Confira o resumo que a chamada devolve. Sem a configuração, o `inicia` não roda e diz o que falta.

## Entrada — lista de processos informada na conversa

Os processos a analisar chegam como números digitados ou colados diretamente no chat. Não é preciso CSV nem etiqueta: todo processo da lista passa pela mesma rotina, sem distinção por fase ou etiqueta atual.

## Confirmação antes de iniciar — parada obrigatória

Antes de abrir qualquer processo, confirme com o usuário:
- quantos processos foram informados, com a lista completa dos números;
- os dados da configuração da unidade que esta execução usa (tarefas da alínea 2-i e certidões das alíneas 2-j e 2-k, e a pasta de relatórios);
- que, em cada um deles, será verificado se há documento não lido e, havendo, ele será aberto e lido para classificação, e ao final será clicado MARCAR TODOS COMO LIDOS nesse processo — com ou sem entrada no relatório;
- estimativa de esforço: pelo script de lote (abaixo), um processo por vez, a leitura leva cerca de 6 a 10 segundos por processo e o MARCAR TODOS COMO LIDOS, cerca de 5 segundos, mais o tempo de conferir cada resumo e as paradas para login, se a sessão do PJe expirar.

Só comece a análise com o "pode seguir" do usuário.

## Progresso durante a execução — informe obrigatório a cada 20 processos

Ao completar o 20º processo analisado, registre uma mensagem de progresso parcial: quantos já foram analisados do total confirmado, e quantos documentos até aquele ponto caíram em cada caso (1, 2 ou 3).

Essa mensagem precisa ficar registrada no histórico da conversa — não pode apenas surgir na tela e desaparecer sozinha, como uma notificação passageira. Se a sessão em execução dispuser de uma ferramenta própria para enviar mensagem ao usuário (distinta do texto informal que aparece entre uma chamada de ferramenta e outra), use-a para postar o informe: esse é o caminho que garante o registro permanente. Não havendo essa ferramenta, encerre a resposta corrente com o informe como último conteúdo do turno, e só retome a análise dos próximos processos numa resposta seguinte — nunca poste o informe como comentário de passagem entre duas chamadas de ferramenta dentro da mesma resposta, pois esse texto tende a não ficar registrado no histórico.

Isso é apenas um informe, **não uma parada para confirmação**: aqui não se espera resposta do usuário nem "pode seguir" antes de prosseguir para o próximo processo.

Repita a cada novo múltiplo de 20 (20, 40, 60, 80...) até terminar. Não acumule várias rodadas de 20 sem reportar.

Regra geral, valendo desde a primeira execução sem que o usuário precise repeti-la: pode seguir direto, sem ficar parando a cada vinte processos. O informe a cada marco de 20 continua obrigatório, mas só como nota breve e inline — nunca como parada para confirmação. Registre o progresso e continue imediatamente para o próximo processo, sem aguardar resposta do usuário.

Se, mesmo seguindo essas instruções, o informe continuar aparecendo e sumindo da tela sem deixar registro, isso pode ser uma limitação da interface em manter texto emitido durante a execução — fora do alcance desta skill para corrigir sozinha. Nesse caso, sinalize a suspeita ao usuário no relato final, sem afirmar a causa com certeza.

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

A leitura dos processos roda pelo script `analise-lote.js`, que fica nesta pasta da skill. Ele faz o mesmo caminho da seção anterior (consulta processual → autos) e lê, em cada processo, só os documentos não lidos (os itens destacados da cronologia), com a origem (INSS, parte autora ou perito) e uma sugestão de Caso e alínea. Quando a regra pede contexto, lê também: a sentença recorrida, no recurso (1-d ou 2-d); a certidão de nomeação posterior (a configurada em `certidao_nomeacao`), no pedido de nova data de perícia (2-j); a certidão do local da perícia posterior (a configurada em `certidao_intimacao_pericia`), na petição sobre o local da perícia (2-k); e a fase atual, na contestação, réplica ou impugnação à contestação (2-i), pelo menu "Exibir tarefa atual do processo" dos autos, que só exibe a tarefa, comparada com as tarefas configuradas em `fases_2i`. A leitura não grava nada; a única gravação do script é o MARCAR TODOS COMO LIDOS, chamado à parte, processo a processo (ver a seção própria, abaixo). Quem classifica sou eu, pelas regras desta skill. Se uma regra desta skill mudar, ajuste o script junto.

1. No Chrome, abra a página estática `https://pje1g.trf5.jus.br/pje/js/pdfjs/web/locale/locale.json` e carregue nela o arquivo `analise-lote.js` tal como está gravado: crie pelo javascript_tool um `<input type="file">` que, ao receber o arquivo, o execute (`(0, eval)(await input.files[0].text())`), e envie o arquivo a ele com o file_upload do Chrome. Não reescreva o script de memória. Cada processo abre num iframe oculto, e a página de cima não muda de endereço.
2. Passe a configuração da unidade com `window.__BP.config({...})` (ver "Como a configuração chega ao script", acima) e confira o resumo devolvido. Inicie com `window.__BP.inicia(lista, base)` (`base` = nº do primeiro processo da lista menos 1). Um processo por vez, um documento por vez: mais que isso faz o PJe bloquear o acesso por 10 minutos (HTTP 429). Se o script parar com `429`, espere os 10 minutos antes de retomar.
3. Acompanhe com `window.__BP.estado()`. Para ler os resumos, chame `window.__BP.mostra(a, b)` e leia a página com `get_page_text` — de 8 a 12 processos por leitura. O retorno do javascript_tool é cortado em cerca de 1.200 caracteres; o `get_page_text`, não.

**Como ler o resumo.** O cabeçalho traz `nl` (o número do aviso "Há N documento(s) não lido(s)"), `destacados` (os itens não lidos da cronologia) e `docs` (documentos na cronologia / no processo). Em seguida vem uma linha por documento não lido, do mais recente para o mais antigo, com a sugestão `SUG:` (a alínea do Caso 1 ou do Caso 2, ou `3`), marcas como `ACEITE-AUTOR`, `RECUSA-AUTOR`, `MANIFESTAÇÃO-LAUDO`, `LAUDO-PERITO` e `CONTESTAÇÃO/RÉPLICA`, a origem e um trecho. Evento do sistema e ato do juízo (intimação, certidão de intimação, decurso, despacho, decisão, sentença) aparecem como `[evento do sistema ou ato do juízo: ignorar]`. A sugestão não decide: confira-a, em todo documento, no teor antes de gravar a classificação. `SUG:3`, sugestões com `?` e `rever: ...` pedem leitura atenta. Para conferir um documento avulso, `await window.__BP.testa('<id>', '<título>')` devolve a sugestão que o script daria a ele, só com leitura.

**O que o script não lê.** Documento `ILEGÍVEL` (PDF digitalizado ou com fonte sem texto, que sai em símbolos) é lido na tela: abra o processo numa aba visível. Se o aviso e os itens destacados não baterem (`aviso diz N, cronologia destaca M`), confira o processo na tela antes de marcar.

**Arquivo de andamento — gravar à medida que sai, nunca só no final.** Antes de iniciar, crie `<pasta_relatorios>/Baixa_Peticao_AAAA-MM-DD_andamento.txt` (a pasta configurada em `pasta_relatorios`) com uma linha `L|<nº>|<processo>` por processo do lote. A cada leitura dos resumos, grave uma linha por documento não lido classificado no Caso 1 ou no Caso 3: `<nº>|<processo>|<id do documento>|<data>|<caso e alínea>|<tipo de documento ou descrição breve>|<sigiloso>` (documentos do Caso 2 não são gravados). Documento que depende de leitura na tela fica numa linha `#PENDENTE <nº>|<processo>|<o que falta>` até ser resolvido; vale a última linha de cada documento. Depois do MARCAR TODOS COMO LIDOS, grave uma linha por processo: `P|<nº>|<processo>|nl=<não lidos>|<resultado devolvido>`. O relatório final (.xlsx) é gerado desse arquivo.

**Interrupção.** Se a sessão do PJe expirar, o script para sozinho (`login em <processo>`). Peça ao usuário que se autentique, carregue o script de novo, passe a configuração de novo (`window.__BP.config`) e reinicie só com os processos do lote que ainda não têm resultado no arquivo. O mesmo vale se o navegador ou a conversa caírem, ou se a aba recarregar (`window.__BP` some).

## Documento não lido — identificação e classificação

Ao abrir o processo, verifique a cronologia quanto ao aviso **"Há N documento(s) não lido(s)"**, no topo do painel. Havendo esse aviso, **abra e leia cada documento não lido antes de classificar** — o nome do evento na cronologia não decide sozinho; o teor decide. Não presuma o teor a partir do rótulo do evento.

Um mesmo processo pode ter mais de um documento não lido, de tipos diferentes: classifique cada um independentemente, pelas regras abaixo.

**Só os documentos que ainda não foram lidos são analisados e classificados nesta rotina.** Documentos já lidos anteriormente não entram no relatório, na aba Indefinidos nem em nenhuma contagem — podem apenas ser consultados como contexto quando uma regra desta skill exigir (ex.: a sentença recorrida, na alínea d; a certidão de nomeação ou a certidão do local da perícia posterior, configuradas pela unidade, nas alíneas j e k do Caso 2).

**Só petições juntadas pelas partes e por terceiros são analisadas nesta rotina — nunca eventos automáticos do PJe.** Informações lançadas automaticamente pelo sistema, como "certidão de intimação sistêmica" (por exemplo, após a nomeação de perito) e "decurso de prazo" do INSS (evento sistêmico automático), não se enquadram em nenhum dos Casos 1, 2 ou 3: devem ser ignoradas — não entram no relatório, na aba Indefinidos nem em nenhuma contagem. Elas não alteram a obrigação de clicar em MARCAR TODOS COMO LIDOS no processo.

**Caso 1 — documento relevante (entra no relatório):**
a) Pedido de desistência da ação;
b) Dispensa de perícia médica;
c) Embargos de declaração;
d) Recurso da parte autora de sentença de improcedência;
e) Pedido de reconsideração de decisão;
f) Informação da parte autora de descumprimento da obrigação de fazer;
g) Comunicação de ausência à perícia médica;
h) Pedido de adiamento da perícia;
i) Juntada de laudo (por perito médico ou assistente social) solicitando o fornecimento de exames ou informações sobre a localização do imóvel;
j) Pedidos de cancelamento/adiamento de audiência; pedidos para participação remota/on line da audiência;
k) Proposta de acordo;
l) Contrarrazões de recurso e embargos de declaração;
m) Pedido de certidão de atuação — inclusive quando destinado a instruir levantamento de requisitório — e outros pedidos de certidão semelhantes;
n) Juntada de laudo pericial pelo perito judicial (médico ou assistente social), qualquer que seja o teor — conclusivo ou não, com ou sem pedido de exames, com ou sem requerimento de honorários. O laudo é listado no relatório para verificação.

**Caso 2 — documento irrelevante (não entra no relatório, não é mencionado em nenhuma lista):**
a) Juntada de documentos, procuração, exames médicos, laudos médicos, documentos comprobatórios pela parte autora;
b) Petição de ciência (qualquer tipo);
c) Processos administrativos/dossês previdenciários juntados pela parte autora ou CEAB;
d) Recurso da parte autora e do INSS de sentença de procedência;
e) Petição de apresentação de quesitos para perícia;
f) Pedidos de andamento processual/impulso processual;
g) Juntada de contrato de honorários;
h) Pedido de destaque de honorários;
i) Contestação do INSS/AGU, impugnação à contestação pela parte autora ou réplica à contestação pela parte autora — **somente quando o processo estiver numa das fases configuradas em `jef-baixa-peticao` → `fases_2i`**. Confira a fase (tarefa atual) do processo na tela antes de aplicar esta alínea. Em qualquer outra fase, esses documentos seguem as regras gerais desta seção, como antes. Com `fases_2i` = `nenhuma`, esta alínea não se aplica.
j) Manifestação da parte autora pedindo nova data de perícia médica (ex.: "compareceu em 03/06/2026 e o médico não compareceu nem avisou; pede aviso da nova data") — **somente quando houver, na cronologia, certidão de nomeação (a configurada em `jef-baixa-peticao` → `certidao_nomeacao`) posterior a esse pedido**: isso significa que a secretaria já providenciou a designação da nova perícia. Confira o teor da certidão (que é de nomeação de perito para nova perícia) e que a data dela é posterior à do pedido. Sem certidão de nomeação posterior, o pedido segue as regras gerais desta seção, como antes. Com `certidao_nomeacao` = `não se aplica`, esta alínea não se aplica.
k) Petição da parte autora apontando ausência de informação sobre o local da perícia — **somente quando houver, na cronologia, certidão do local da perícia (a configurada em `jef-baixa-peticao` → `certidao_intimacao_pericia`) posterior a essa petição, informando o endereço da perícia**. Confira o teor da certidão (que ela de fato informa o endereço da perícia) e que a data dela é posterior à da petição. Sem essa certidão posterior, a petição segue as regras gerais desta seção, como antes. Com `certidao_intimacao_pericia` = `não se aplica`, esta alínea não se aplica.
l) Pedido de dispensa de perícia social (Tema 187 da TNU);
m) Manifestação da parte autora sobre o laudo pericial;
n) Petição do INSS requerendo a juntada de documentos administrativos em anexo ("O INSS vem requerer a juntada dos documentos administrativos em anexo").

**Caso 3 — indefinido (não se enquadra no Caso 1 nem no Caso 2):** liste à parte, para decisão humana sobre em qual hipótese incluir. Registre uma descrição breve do teor do documento — o suficiente para permitir a decisão, sem reproduzir o documento.

Pontos de atenção na leitura, para não confundir tipos próximos:
- Recurso de sentença de **improcedência** é Caso 1-d; recurso de sentença de **procedência**, de qualquer das partes (autor ou INSS), é Caso 2-d. A diferença está no resultado da sentença recorrida — confira-o na própria sentença ou no recurso, nunca presuma.
- Laudo ou exame **apresentado pela própria parte autora** é Caso 2-a; laudo **do perito médico ou do assistente social** é sempre Caso 1: 1-i quando pede novos exames ou dados de localização do imóvel; 1-n nos demais casos (laudo conclusivo). A diferença está em quem juntou o documento.
- Um processo com mais de um documento não lido do mesmo Caso 1 recebe uma linha no relatório para cada ocorrência, com a data de cada uma.

## MARCAR TODOS COMO LIDOS — obrigatório em todos os processos da lista

Depois de ler e classificar o(s) documento(s) não lido(s) (ou de confirmar que não há nenhum), clique em **MARCAR TODOS COMO LIDOS**, no topo do painel de cronologia, sempre que o aviso estiver presente. Confirme que o aviso sumiu antes de passar ao próximo processo.

Essa gravação é obrigatória em **todo** processo da lista fornecida pelo usuário, com ou sem documento classificado no Caso 1 — o processo entrar ou não no relatório final não altera essa obrigação.

Esse botão só existe dentro dos autos, um processo por vez — não há equivalente em lote.

**No lote**, o resumo de cada processo traz `nl` (o número de não lidos na hora da leitura). Depois de gravada no arquivo de andamento a classificação de todos os documentos não lidos do processo, chame `await window.__BP.marca('<processo>', <nl>)`. O script abre os autos no quadro oculto, clica em MARCAR TODOS COMO LIDOS e confere que o aviso sumiu. Um processo por vez, nunca antes da classificação gravada.

- `MTL OK`: grave no arquivo de andamento.
- `NÃO MARCADO: eram X não lidos na leitura e agora são Y`: chegou documento depois da leitura. Leia o processo de novo antes de marcar — nada é marcado sem ser lido.
- `MTL FALHOU` ou `botão ... não encontrado`: abra o processo numa aba visível e clique pela tela, conferindo o aviso.

Se um processo da lista não apresentar o aviso de documento não lido, não há o que marcar; registre esse caso na apuração final (abaixo) como anomalia a confirmar com o usuário — a expectativa da rotina é que todo processo da lista tenha documento pendente.

## Entregável

Um único arquivo .xlsx, fonte Arial, com duas abas.

**Aba `Relatório`** — uma linha por documento classificado no Caso 1 (um processo com mais de uma ocorrência do Caso 1 gera mais de uma linha):

| Processo | Tipo de documento | Data do documento | Sigiloso |
|---|---|---|---|

A coluna **Tipo de documento** recebe a letra e a descrição do Caso 1 (ex.: "k) Proposta de acordo"). A coluna **Sigiloso** recebe "sim" quando o processo tramitar em segredo de justiça (conforme classificação efetivamente registrada no processo) — nesses casos, mantenha a descrição do documento no mínimo necessário para identificar o tipo, sem detalhes de conteúdo além disso.

**Aba `Indefinidos`** — uma linha por documento classificado no Caso 3:

| Processo | Descrição breve do documento | Data do documento | Sigiloso |
|---|---|---|---|

Identifique processos pelo número, nunca pelo nome da parte, em nenhuma das duas abas.

Documentos classificados no Caso 2 não aparecem em nenhuma aba, em nenhuma coluna, em nenhuma hipótese.

Nome do arquivo: `Baixa_Peticao_AAAA-MM-DD.xlsx`, gravado na pasta configurada em `pasta_relatorios`. Se o usuário tiver pasta conectada, salve lá além de entregar na conversa.

## Ao terminar

Relate primeiro o diagnóstico, depois os dados de apoio: quantos processos foram analisados no total, quantos tinham documento não lido e quantos não tinham (liste os números destes últimos, como possível anomalia), quantos documentos caíram no Caso 1 (com a divisão por letra/tipo) e quantos no Caso 3 (indefinidos, destacando a necessidade de decisão humana sobre cada um), e quantos processos tiveram MARCAR TODOS COMO LIDOS confirmado. Não informe quantos caíram no Caso 2 discriminados por tipo — apenas, se útil ao diagnóstico, o total agregado sem detalhamento.

Se o mesmo tipo de documento indefinido (Caso 3) se repetir com frequência, sinalize ao usuário que pode valer a pena incluí-lo nas listas desta skill.

Se algum processo não for encontrado na consulta ou os autos não abrirem, diga quais e por quê. Nunca relate como analisado um processo que você não conseguiu abrir, e nunca clique em MARCAR TODOS COMO LIDOS num processo cujos autos não abriram.
