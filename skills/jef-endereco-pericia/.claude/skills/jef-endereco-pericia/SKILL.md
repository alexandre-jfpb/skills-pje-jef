---
name: "jef-endereco-pericia"
description: "Para processos com perito médico nomeado, a partir de CSV filtrado pela dataChegada informada pelo usuário, verifica se foi juntada, depois da certidão de nomeação, a certidão \"INTIMAÇÃO DE PERÍCIA\" com o endereço onde a perícia médica será realizada, e gera relatório em .xlsx com os processos em que essa certidão falta ou tem falha (e, em aba própria, o endereço da perícia nas certidões em ordem) — só perícia médica, nunca assistente social; sem gravar nada no PJe. Para o PJe 1º grau do TRF5; peritos, etiquetas e exceções vêm da configuração da unidade. Desenvolvida na 7ª Vara Federal da Paraíba."
---

# Endereço da perícia médica — conferência da certidão "INTIMAÇÃO DE PERÍCIA"

Desenvolvida na 7ª Vara Federal da Paraíba. As regras de classificação refletem as decisões dessa Vara e devem ser revistas pela unidade antes do uso com processos reais.

Use quando o usuário fornecer um CSV de processos e pedir a verificação de que a certidão com o endereço da perícia médica foi juntada depois da nomeação do perito.

**Contexto.** Sempre que um perito médico é nomeado, é juntada uma **certidão de nomeação** (a mesma analisada na `jef-conferir-rpv`). Em seguida, as partes são intimadas da designação e é juntada uma certidão **"INTIMAÇÃO DE PERÍCIA"** com o endereço onde a perícia será realizada. Em alguns processos houve falha na inserção dessa certidão, e não consta o endereço. Esta skill localiza esses processos, para que a secretaria insira a certidão.

## Limite de atuação — leia antes de tudo

Esta skill **só lê**. Nesta rotina **não se clica em MARCAR TODOS COMO LIDOS** — por decisão do usuário, os documentos não lidos permanecem como estão, para não esconder da secretaria documentos que ela ainda não viu.

Nunca, em hipótese alguma:
- inserir ou retirar etiqueta; juntar ou inserir a certidão de endereço (isso é providência manual da secretaria, a partir do relatório);
- movimentar processo, protocolar, juntar documento, transferir tarefa, cancelar distribuição, expedir intimação ou qualquer comunicação;
- preencher minuta, selecionar tipo de documento ou clicar em ASSINAR DOCUMENTO(S);
- digitar senha, certificado, token ou PIN. Aparecendo tela de login, pare e peça ao usuário que se autentique.

Todo o resto desta skill deve ser mantido intacto de uma versão para a outra: nenhuma alteração além da que o usuário pediu expressamente deve ser feita sem consulta prévia.

## Configuração da unidade — antes de tudo

Os dados próprios da unidade (peritos médicos, etiquetas de perícia, nomeações a ignorar) não estão nesta skill: ficam em `docs/configuracao-unidade.md`, na pasta do projeto.

- Leia `docs/configuracao-unidade.md` no início de toda execução, antes da pergunta da data de corte.
- Se o arquivo não existir, crie-o com o título `# Configuração da unidade`.
- Se faltar alguma seção da lista abaixo, ou houver item `PENDENTE` que esta skill usa, **pare antes de abrir qualquer processo** e faça ao usuário as perguntas que faltam, todas de uma vez, agrupadas por seção, explicando o que é cada item. Grave as respostas no arquivo (item sem resposta fica `PENDENTE`), mostre o resumo e peça o "pode seguir".
- Seção comum já preenchida por outra skill: reaproveite, sem perguntar de novo. Só pergunte o que esta skill usa e ainda falta.
- Nunca use valor que não esteja no arquivo; nunca presuma nem use os valores da 7ª Vara Federal da Paraíba. Se, no meio da execução, faltar um dado (ex.: nomeado que parece perito médico e não está na tabela), não acrescente nada por conta própria: trate pelo que a skill manda (Indefinidos) e, ao final, pergunte ao usuário se quer incluí-lo na configuração.
- O arquivo pode ser editado à mão pela unidade (ex.: perito novo, perito que deixou de atuar); vale sempre o que estiver nele no início da execução.

### Perguntas da configuração

**Seção `## Comum — Peritos médicos`** (comum a várias skills) — tabela com uma linha por perito médico que atua na unidade:

| Nome completo | CPF | Especialidade | Etiqueta ou lote do PJe |
|---|---|---|---|
| FULANA DE TAL EXEMPLO | nnn.nnn.nnn-nn | Psiquiatria | `3. Perícia - Lote Exemplo` |

- **Nome completo**: como sai na certidão de nomeação do PJe. Pergunta: "Quais são os peritos médicos da unidade? Informe, para cada um, o nome completo como aparece na certidão de nomeação."
- **CPF**: com pontos e hífen (formato `nnn.nnn.nnn-nn`), como sai na certidão de nomeação. É o que a skill confere primeiro.
- **Especialidade** e **Etiqueta ou lote do PJe**: esta skill não usa as duas colunas, mas a seção é comum; ao criá-la, pergunte também por elas, e o que ficar sem resposta fica `PENDENTE` (não impede esta skill de rodar).
- Esta skill precisa de pelo menos um perito com nome e CPF; sem isso, não roda.

**Seção `## Comum — Etiquetas de perícia médica`** (comum a várias skills) — as regras da unidade que ligam CID ou especialidade à etiqueta de perícia médica do PJe, na ordem de prioridade, e as etiquetas de perícia médica que existem no PJe mas não são prescritas. Três itens:

- `regras` — tabela em ordem de prioridade: a primeira linha que se aplicar aos CID-10 alegados define a única etiqueta do processo. Cada linha traz a condição (CIDs, capítulos ou especialidade, isolados ou combinados) e o nome exato da etiqueta no PJe, inclusive as etiquetas de lote (mais de uma especialidade) e uma última linha para os demais casos.
- `observacoes` — esclarecimentos sobre CIDs de fronteira (em que linha entram), ou `nenhuma`.
- `etiquetas_nao_prescritas` — etiquetas de perícia médica que existem no PJe mas não devem mais ser prescritas, separadas por ponto e vírgula, ou `nenhuma`.

```
## Comum — Etiquetas de perícia médica
- regras: tabela abaixo

| Ordem | Condição (CID-10 alegados na inicial) | Etiqueta |
|---|---|---|
| 1 | só CID F | 3. Perícia - Psiquiatria Exemplo |
| 2 | ortopedia (CIDs M, S e T musculoesqueléticos), isolada | 3. Perícia - Ortopedia Exemplo |
| 3 | demais casos | 3. Perícia - Clínica Geral Exemplo |

- observacoes: nenhuma
- etiquetas_nao_prescritas: 3. Perícia - Etiqueta Antiga Exemplo
```

Pergunta: "Quais etiquetas do PJe a unidade usa para a perícia médica, e qual a regra (CID ou especialidade) de cada uma, em ordem de prioridade? Há CIDs de fronteira que precisem de esclarecimento? Há etiquetas de perícia médica que existem no PJe mas não devem mais ser usadas?" Nesta skill, a seção serve só de critério auxiliar (Passo 1): é etiqueta de perícia médica toda etiqueta que conste dela, na coluna Etiqueta da tabela `regras` ou na lista `etiquetas_nao_prescritas`; o item `observacoes` não é usado aqui, mas, ao criar a seção, pergunte também por ele (sem resposta, fica `PENDENTE`, o que não impede esta skill de rodar).

**Seção `## jef-endereco-pericia`** (só desta skill):

| Chave | Pergunta | Exemplo de formato (fictício) |
|---|---|---|
| `nomeacoes_ignoradas` | Há alguma pessoa cuja nomeação deve ser ignorada nesta rotina, como se fosse de assistente social (não é tratada como perito médico e não gera linha no relatório)? Informe nome completo e CPF de cada uma, ou `nenhuma`. | tabela `\| Nome completo \| CPF \| Motivo \|`, ex.: `\| BELTRANA EXEMPLO \| nnn.nnn.nnn-nn \| atua só em perícia social \|`; ou `nenhuma` |
| `etiqueta_as_geral` | Que texto, numa etiqueta do PJe, indica que a perícia do processo é social (assistente social), qualquer que seja a nomeada? Se houver mais de um, separe por `;`. Responda `nenhum` se a unidade não tiver. | `PERÍCIA SOCIAL; ESTUDO SOCIAL` |
| `etiqueta_as_lote` | As etiquetas de lote de assistente social trazem o primeiro nome dela junto com alguma marca fixa? Qual é a marca? Responda `nenhuma` se não houver. | `[SOCIAL]` (ex.: etiqueta `Lote Maria [SOCIAL]`) |
| `certidao_segue_modelo` | A certidão com o endereço da perícia médica juntada na unidade segue o modelo do Passo 3 (título "INTIMAÇÃO DE PERÍCIA" e o trecho "a(o) Dr. <nome do perito>, no seguinte endereço: <endereço>. O(a) autor(a) ...")? `sim` ou `não`. | `sim` |

Exemplo da seção gravada:

```
## jef-endereco-pericia
- nomeacoes_ignoradas: nenhuma
- etiqueta_as_geral: PERÍCIA SOCIAL
- etiqueta_as_lote: [SOCIAL]
- certidao_segue_modelo: sim
```

Se `certidao_segue_modelo` for `não`, pare: o script reconhece a certidão por esse modelo e daria falsos "Sem certidão de endereço". Diga ao usuário que a skill precisa ser adaptada ao modelo da unidade antes do uso.

### Como a configuração chega ao script

Depois de injetar `analise-lote.js` e antes do `inicia`, monte e passe o objeto de configuração a partir do arquivo, copiando os valores sem alteração:

```
window.__EP.config({
  peritos:   [{ nome: '<Nome completo>', cpf: '<CPF>' }, ...],   // todas as linhas de "Comum — Peritos médicos", na ordem da tabela
  ignorados: [{ nome: '<Nome completo>', cpf: '<CPF>' }, ...],   // linhas de nomeacoes_ignoradas; [] se "nenhuma"
  asGeral:   ['<texto>', ...],                                     // etiqueta_as_geral, separada no ";"; [] se "nenhum"
  asLote:    '<marca>'                                             // etiqueta_as_lote; '' se "nenhuma"
})
```

Sem perito configurado, o `inicia` não roda e devolve "configure ... antes de iniciar". Injetado de novo (login, aba recarregada), o script perde a configuração: chame o `config` outra vez, com a mesma lista e na mesma ordem (os índices das linhas `M|` do andamento dependem dela).

## Acesso ao PJe — usar o Chrome (extensão)

O acesso ao PJe é sempre pelo **Chrome (extensão)** — o navegador real do usuário, onde ele já está autenticado —, nunca pelo navegador embutido do Claude Code.

## Entrada — sempre por arquivo CSV

A lista de processos **sempre** chega por arquivo CSV, fornecido junto com este pedido de execução. Esta skill **não reaproveita** um CSV fornecido anteriormente na conversa; sem CSV anexado a este pedido, peça o arquivo antes de prosseguir.

Leia o CSV com separador `;` e encoding `utf-8-sig`. Use o campo `numeroProcesso` para os números e o campo `dataChegada` para o filtro de data (abaixo).

### Pergunta obrigatória — a partir de que data analisar

Em **toda** execução, logo depois de ler a configuração da unidade e antes de qualquer outra coisa, pergunte ao usuário **a partir de que data (`dataChegada`)** os processos devem ser analisados — isso evita conferir de novo processos já analisados em execuções anteriores. Não presuma a data nem reaproveite a de uma execução anterior.

Com a data informada, mantenha só as linhas com `dataChegada` **igual ou posterior** a ela (a data informada entra). Leia a data do CSV no formato em que vier (ex.: `DD/MM/AAAA`, com ou sem hora, ou `AAAA-MM-DD`); se o formato for ambíguo ou não puder ser lido, pare e pergunte — não adivinhe. Linhas sem `dataChegada` preenchida: não descarte em silêncio — informe ao usuário quantas são e pergunte se entram.

## Confirmação antes de iniciar — parada obrigatória

Depois do filtro de data, e antes de abrir qualquer processo, confirme com o usuário:
- a data de corte aplicada e quantas linhas o CSV tinha no total;
- quantos processos ficaram para análise, com a lista completa dos números;
- que a análise é só de leitura e que **não** será clicado MARCAR TODOS COMO LIDOS;
- estimativa de esforço: pelo script de lote (abaixo), com dois processos por vez, cerca de 10 segundos por processo — mais as paradas para login, se a sessão do PJe expirar.

Só comece com o "pode seguir" do usuário.

## Progresso durante a execução — informe obrigatório a cada 20 processos

Ao completar o 20º processo analisado, registre uma mensagem de progresso parcial: quantos já foram analisados do total confirmado e quantos, até aquele ponto, caíram em cada resultado (certidão com endereço em ordem, certidão faltando ou com falha, perícia já realizada, sem nomeação de perito médico, indefinido).

Essa mensagem precisa ficar registrada no histórico da conversa — não pode apenas surgir na tela e desaparecer sozinha. Se a sessão dispuser de uma ferramenta própria para enviar mensagem ao usuário, use-a; não havendo, poste o informe como texto normal da resposta em andamento.

Em nenhum dos dois casos interrompa a execução: **nunca encerre o turno nem espere confirmação do usuário para prosseguir** — poste o informe e continue imediatamente, na mesma resposta, para o próximo processo. Isso é apenas um informe, **não uma parada para confirmação**.

Repita a cada novo múltiplo de 20 (20, 40, 60...) até terminar. Se a análise chegar ao fim sem esses informes, sinalize o desvio ao usuário junto do relato final.

## Como abrir cada processo

Use a **consulta processual**, não a fila. A consulta não vincula tarefa a ninguém e não altera estado.

1. `https://pje1g.trf5.jus.br/pje/Processo/ConsultaProcesso/listView.seam`
2. O número é preenchido em campos separados. Ids: `fPP:numeroProcesso:numeroSequencial`, `:numeroDigitoVerificador`, `:Ano`, `:NumeroOrgaoJustica` (os 4 últimos dígitos do número do processo). Ramo (4) e tribunal (05) já vêm preenchidos. Botão: `fPP:searchProcessos`.
3. Clique no número no resultado. Os autos abrem em janela nova — redirecione `window.open` para a mesma aba antes de clicar, senão a janela fica fora de alcance.
4. A cronologia sai em texto do próprio documento (não está em iframe). É **decrescente**: o que está acima é mais recente.

## Execução em lote — script `analise-lote.js` e arquivo de andamento

Por decisão do usuário, a análise roda pelo script `analise-lote.js`, que fica nesta pasta da skill. Ele faz exatamente os passos desta skill (consulta processual, leitura do teor, Passos 1 a 3, "Juntado por" do documento que parece laudo, regra de grafia) e só lê: nunca clica em MARCAR TODOS COMO LIDOS nem em nada que grave. Se uma regra desta skill mudar, ajuste o script junto.

1. No Chrome, abra a página estática `https://pje1g.trf5.jus.br/pje/js/pdfjs/web/locale/locale.json` e injete nela, com o javascript_tool, o conteúdo integral de `analise-lote.js` — leia o arquivo antes; não reescreva de memória. Não use a tela de consulta como hospedeira: o PJe pode mandá-la para `error.seam` no meio do lote, e o script se perde. A página de cima não muda de endereço durante o lote: cada processo abre num iframe oculto (consulta → autos).
2. Passe a configuração com `window.__EP.config({peritos, ignorados, asGeral, asLote})` (seção "Configuração da unidade"): `peritos` é a tabela da seção `Comum — Peritos médicos` (nome e CPF), montada do arquivo a cada execução; `ignorados`, as nomeações de `jef-endereco-pericia.nomeacoes_ignoradas` (nome e CPF). Depois inicie com `window.__EP.inicia(lista, {paralelo: 2})`. `paralelo: 2` abre dois processos por vez; não passe de 3, para não sobrecarregar o PJe.
3. Acompanhe com `await window.__EP.le(desde)`. Ele espera no máximo 10 segundos — o javascript_tool corta a chamada em 45 segundos.

**Arquivo de andamento — gravar à medida que sai, nunca só no final.** Antes de iniciar, crie `Relatórios/Endereco_Pericia_AAAA-MM-DD_andamento.txt` com uma linha `M|<índice>|<nome>` por perito (na mesma ordem passada ao script no `config`, a partir de 0) e uma linha `L|<processo>` por processo do lote. A cada leitura do progresso, grave no arquivo, sem alterar, todas as linhas devolvidas por `le()` (menos a linha `P|`) e use o `ate:` dela como o próximo `desde`. O resultado nunca fica guardado só na conversa.

A planilha sai desse arquivo, pelo `gera-relatorio.ps1` desta pasta: `-Andamento <arquivo> -Saida <xlsx>`. Com `-SoResumo`, só mostra as contagens por resultado e os processos que faltam — use-o para o informe a cada 20 processos e para o relato final.

**Só a última nomeação (v7, 29/10/2026).** O script confere só a última certidão de nomeação do processo (com a repetida no mesmo dia, do mesmo perito). Se ela for de assistente social ou de nomeação ignorada, devolve `N` com a observação "endereço de perícia médica não é necessário" e o número de nomeações anteriores não conferidas.

**Linhas `V` (revisar).** O script marca `V` quando não pode decidir sozinho: última nomeação fora da lista sem etiqueta de assistente social, certidão fora do padrão, nome do perito só em parte igual ao nomeado, documento que não carregou. Abra esses processos e decida pelas regras desta skill; grave a decisão como nova linha no arquivo, com o mesmo processo e o mesmo id de nomeação (vale a última linha). O que ficar sem decisão vai para Indefinidos.

**Interrupção.** Se a sessão do PJe expirar, o script para sozinho (`login` na linha `P|`, com os processos a refazer). Peça ao usuário que se autentique, recarregue a consulta, injete o script de novo, chame o `config` outra vez e reinicie só com os processos do lote que ainda não têm linha no arquivo (`-SoResumo` lista os que faltam). O mesmo vale se o navegador ou a conversa caírem, ou se a aba travar e o Chrome a recarregar (o id da aba muda e `window.__EP` some).

Ao reiniciar, logo depois de `inicia`, carregue no script os endereços que o arquivo já tem nas linhas `E|`, na ordem das chaves: `window.__EP.st.ends.push(<endereço da chave 0>, <endereço da chave 1>, ...)`, com o texto exato de cada linha. Sem isso, o script recomeça a numeração dos endereços do 0 e as mesmas chaves passam a apontar para endereços diferentes no arquivo.

## Regra de leitura — o teor decide, nunca o nome do documento

Há muitas certidões de intimação depois da nomeação do perito. **Nunca presuma nada pelo nome dado ao documento na cronologia**: abra e leia o teor de cada certidão relevante.

**Documentos do INSS, da CEAB e do advogado da parte autora não contam.** A certidão de nomeação e a certidão "INTIMAÇÃO DE PERÍCIA" são juntadas pela Vara, e o laudo médico pericial, pelo perito. Documento juntado pelo INSS, pela CEAB ou pelo advogado da parte autora (petições, dossiês, laudos particulares ou administrativos, quesitos etc.) nunca vale como laudo do perito. Por decisão do usuário, isso evita falsos alarmes — por exemplo, o dossiê médico do INSS intitulado "LAUDO MÉDICO" ou a petição da parte autora pedindo dispensa da perícia social.

A cronologia do PJe não mostra quem juntou cada documento: o "Juntado por ... – POLO ATIVO/PASSIVO – ..." só aparece no documento aberto. Por isso, leia o teor dos documentos normalmente e, **quando um documento parecer ser o laudo do perito, abra-o na cronologia e confira o "Juntado por"** antes de tratá-lo como laudo. Se tiver sido juntado pelo INSS, pela CEAB ou pelo advogado da parte autora, desconsidere-o. Nunca decida quem juntou pelo título do documento na cronologia.

## Passo 1 — localizar a nomeação de perito MÉDICO

Localize, pelo teor, a(s) **certidão(ões) de nomeação** de perito no processo.

**Só a ÚLTIMA certidão de nomeação é verificada** (decisão do usuário, 29/10/2026): é para ela que há necessidade de endereço, nos casos de perícia médica. As nomeações anteriores não são conferidas e não geram linha no relatório.
- Última nomeação de **perito médico** → Passos 2 e 3 só para ela. Se o mesmo perito tiver sido nomeado duas vezes no mesmo dia, as duas formam a última nomeação (ver "Nomeação em dobro").
- Última nomeação de **assistente social** (perícia social), ou ignorada pela skill (abaixo) → o endereço da perícia médica **não é necessário**: o processo não entra no relatório e é contado no resumo final com os que não têm nomeação de perito médico, ainda que haja nomeação anterior de perito médico sem certidão ou com dúvida. Exemplos do usuário, de 29/10/2026: nomeado fora da lista com etiqueta de lote de assistente social, e certidão com o nome incompleto da perita, ambos com nomeação posterior para perícia social → nenhum dos dois precisa de endereço.

**Só interessa a nomeação de perito médico — JAMAIS a de assistente social.** Nomeação de assistente social (perícia social) é ignorada por completo nesta rotina, com ou sem certidão de endereço.

Para saber se o nomeado é perito médico:

1. **Critério principal — lista de peritos médicos.** O nomeado deve constar da tabela da seção `Comum — Peritos médicos` de `docs/configuracao-unidade.md` (confira o nome e, quando a certidão trouxer, o CPF). Leia a tabela a cada execução — nunca de memória.

2. **Critério auxiliar — etiqueta do processo.** Confira também a etiqueta de perícia anexada ao processo e compare-a com as etiquetas de perícia médica da seção `Comum — Etiquetas de perícia médica` de `docs/configuracao-unidade.md`. Leia essa seção a cada execução — nunca de memória. Etiqueta de assistente social é reconhecida pelas marcas configuradas em `jef-endereco-pericia.etiqueta_as_geral` (qualquer nomeada) e `jef-endereco-pericia.etiqueta_as_lote` (junto com o primeiro nome da nomeada).

**Nomeação ignorada.** A nomeação das pessoas listadas em `jef-endereco-pericia.nomeacoes_ignoradas` (nome e CPF) é ignorada nesta rotina, como a de assistente social: não é tratada como nomeação de perito médico e não gera linha no relatório.

Nomeado que não conste da lista de peritos médicos, mas que a certidão ou a etiqueta indiquem ser perito médico (ou o contrário): não decida no escuro — vá para **Indefinidos**, com o motivo. Processo sem nenhuma nomeação de perito médico (só assistente social, ou nenhuma nomeação): conte no resumo final como "sem nomeação de perito médico", sem linha no relatório.

## Passo 2 — perícia já realizada? (fica de fora)

Para cada nomeação de perito médico encontrada, verifique se, **depois dela**, já foi juntado o **laudo médico pericial** desse perito. Havendo laudo, a perícia já aconteceu e a certidão de endereço não é mais necessária: **não entra no relatório** — conte no resumo final como "perícia já realizada".

## Passo 3 — procurar a certidão "INTIMAÇÃO DE PERÍCIA" depois da nomeação

Para cada nomeação de perito médico **sem laudo juntado depois dela**, procure, **na cronologia posterior à certidão de nomeação**, a certidão com o endereço da perícia. Ela segue sempre este padrão (o endereço varia conforme o perito):

> INTIMAÇÃO DE PERÍCIA
> Intimar as partes da designação da perícia, ciente o advogado(a) de que o(a) autor(a) DEVE se apresentar, para se submeter à perícia médica, a(o) Dr. **[NOME DO PERITO]**, no seguinte endereço: **[ENDEREÇO]**. O(a) autor(a) deverá apresentar documento de identificação oficial com foto e todos os exames de que dispõe acerca da enfermidade alegada. [...] (Verificar data e hora da perícia no campo "perícias", no respectivo processo virtual)

Classifique cada nomeação:

- **Certidão em ordem** → existe, depois da nomeação, certidão "INTIMAÇÃO DE PERÍCIA" que **nomeia o mesmo perito nomeado** e traz o **endereço preenchido** depois de "no seguinte endereço:". Entra na aba `Certidão em ordem`, com o endereço da perícia; conte também no resumo final.
- **Sem certidão de endereço** → não existe, depois da nomeação, nenhuma certidão com esse teor. **Entra no relatório.**
- **Certidão com endereço em branco** → a certidão existe, mas não traz o endereço (campo vazio ou incompleto depois de "no seguinte endereço:"). **Entra no relatório**, com a falha descrita.
- **Certidão com perito divergente** → a certidão existe, mas cita outro perito, diferente do nomeado. **Entra no relatório**, com os dois nomes.

Diferença só de grafia no nome do perito — letra dobrada ou simples (ex.: ISABELLA/ISABELA), acento ou cedilha (ex.: CONCEICAO/CONCEIÇÃO) —, com o mesmo nome completo, é o mesmo perito: por decisão do usuário, a certidão está em ordem, e não com perito divergente. O mesmo vale, também por decisão do usuário, para os mesmos nomes em outra ordem (ex.: FULANO DOS SANTOS SILVA na nomeação e FULANO SILVA DOS SANTOS na certidão).

~~Se o processo tiver **mais de uma nomeação de perito médico** pendente (sem laudo), cada nomeação precisa da sua própria certidão de endereço: confira uma a uma, e cada falha gera uma linha no relatório.~~ Substituído em 29/10/2026: só a última nomeação é conferida (Passo 1).

**Nomeação em dobro.** Quando o mesmo perito médico é nomeado duas vezes no mesmo dia e a certidão "INTIMAÇÃO DE PERÍCIA" com o endereço desse perito é juntada depois da segunda nomeação, as duas nomeações estão com a **certidão em ordem**, por decisão do usuário, mesmo que haja uma só certidão para as duas. Cada nomeação entra com a sua linha na aba `Certidão em ordem`.

**Nomeação substituída** (sem efeito desde 29/10/2026, porque a nomeação antiga deixou de ser conferida; mantida como histórico). Quando uma nomeação de perito médico fica sem certidão de endereço, ou com certidão de perito divergente, e depois há no processo nova nomeação de perito médico — do mesmo perito ou de outro — com a certidão em ordem, a nomeação antiga também está com a **certidão em ordem**, por decisão do usuário (ex.: perícia cancelada, parte que não compareceu, perito impedido, remarcação). Ela entra na aba `Certidão em ordem` com o endereço e o número da certidão da nova nomeação.

Teor ambíguo, documento ilegível ou que não carregou → **Indefinidos**, com o motivo. Não decida no escuro.

## Entregável

Um único arquivo .xlsx, fonte Arial, com quatro abas. Identifique processos pelo número, nunca pelo nome da parte.

**Aba `Sem endereço de perícia`** — uma linha por nomeação de perito médico com certidão faltando ou com falha:

| Processo | Perito nomeado | Data da certidão de nomeação | Situação | Observação | Sigiloso |
|---|---|---|---|---|---|

- **Situação**: `Sem certidão de endereço`, `Certidão com endereço em branco` ou `Certidão com perito divergente`.
- **Observação**: dado objetivo que ajude a secretaria a agir (ex.: o nome do perito citado na certidão divergente; o número de identificação do documento).
- **Sigiloso**: "sim" quando o processo tramitar em segredo de justiça, conforme classificação efetivamente registrada nele.

**Aba `Certidão em ordem`** — uma linha por nomeação de perito médico com a certidão "INTIMAÇÃO DE PERÍCIA" em ordem:

| Processo | Perito nomeado | Data da certidão de nomeação | Endereço da perícia | Documento |
|---|---|---|---|---|

- **Endereço da perícia**: o texto que vem depois de "no seguinte endereço:" na certidão, tal como consta nela.
- **Documento**: o número de identificação da certidão. Havendo mais de uma certidão em ordem para a mesma nomeação, informe todos os números; se os endereços forem diferentes entre elas, informe todos os endereços.

**Aba `Indefinidos`** — processos em que não foi possível decidir:

| Processo | Motivo | Sigiloso |
|---|---|---|

**Aba `Não analisados`** — processos não encontrados na consulta ou cujos autos não abriram:

| Processo | Motivo |
|---|---|

Nome do arquivo: `Endereco_Pericia_AAAA-MM-DD.xlsx`. Se o usuário tiver pasta conectada, salve lá além de entregar na conversa.

## Ao terminar

Relate primeiro o diagnóstico, depois os dados de apoio: data de corte aplicada; quantas linhas o CSV tinha e quantas ficaram após o filtro; quantos processos foram analisados; quantos estão **sem a certidão de endereço ou com falha** (com a divisão por situação) — este é o resultado principal da rotina; quantos tinham a certidão em ordem; quantos ficaram de fora por perícia já realizada; quantos não tinham nomeação de perito médico; quantos ficaram em Indefinidos.

Se algum processo não for encontrado na consulta ou os autos não abrirem, diga quais e por quê. Nunca relate como analisado um processo que você não conseguiu abrir.
