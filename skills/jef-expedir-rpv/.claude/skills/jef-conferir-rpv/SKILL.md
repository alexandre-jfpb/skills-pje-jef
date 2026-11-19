---
name: "jef-conferir-rpv"
description: "Para processos com RPV ou precatório confeccionado no sistema Jurisdição Delegada (JD/TRF5) e na situação \"Em Conferência\", a partir de CSV ou de uma lista de processos informada na conversa, confere, lado a lado com os autos do PJe, o número do processo, o beneficiário, o valor (parte autora, destaque de honorários contratuais, reembolso de perícias, multa e honorários sucumbenciais), a data-base, o representante e o servidor responsável, e gera relatório em .xlsx separado entre Requisição de Pequeno Valor e Precatório, com AVISO em toda divergência ou dúvida — sem alterar nada no PJe; no JD, só clica em \"Enviar para Assinatura\" nas requisições sem AVISO, após confirmação expressa do usuário para a lista. Os dados da unidade (código do órgão, beneficiária do reembolso, honorários periciais, fase do PJe, nome dos arquivos) vêm de docs/configuracao-unidade.md. Desenvolvida na 7ª Vara Federal da Paraíba."
---

# Conferência de RPV e Precatório — Jurisdição Delegada × PJe

Desenvolvida na 7ª Vara Federal da Paraíba. Os dados próprios da unidade vêm de `docs/configuracao-unidade.md` (ver "Configuração da unidade — antes de tudo").

Use quando o usuário fornecer um CSV, ou informar diretamente na conversa uma lista de números de processo, e pedir a conferência das RPVs e precatórios confeccionados no sistema **Jurisdição Delegada** (`https://jd.trf5.jus.br/jd/login.wsp`) com os dados dos processos em tramitação no PJe.

Esta rotina envolve **pagamento de valores**. A conferência deve ser a mais criteriosa possível: cada dado é comparado com o que consta nos autos, nunca presumido. Nunca presuma nada pelo nome do arquivo juntado ao processo — sempre analise o teor do documento. **Na dúvida, AVISE** — um AVISO desnecessário custa uma verificação humana; uma divergência não apontada pode custar um pagamento errado.

## Limite de atuação — leia antes de tudo

Esta skill **só confere**. Nada é executado em nenhum dos dois sistemas, com uma única exceção: o clique em **"Enviar para Assinatura"** no JD, nas condições da seção "Enviar para Assinatura", abaixo. Fora dela, essa regra não pode ser quebrada.

**No PJe**, a única gravação autorizada é clicar em **MARCAR TODOS COMO LIDOS** quando houver documento pendente de leitura — mesmo padrão da `jef-expediente-manifestacao`, obrigatório em todo processo desta lista (ver seção própria, abaixo).

**No Jurisdição Delegada**, nenhuma gravação, de nenhum tipo: só consulta e leitura. A única exceção é o botão **"Enviar para Assinatura"**, nas condições da seção própria (abaixo). Fora dela, nunca clique em botão ou link que salve, inclua, altere, exclua, cancele, valide, confira, homologue, assine, transmita, envie ao tribunal ou mude a situação de uma requisição. Se a única forma de ver um dado for um botão cujo efeito não esteja claro, **pare e pergunte** ao usuário antes de clicar.

Nunca, em hipótese alguma, em nenhum dos dois sistemas:
- inserir ou retirar etiqueta; movimentar processo, protocolar, juntar documento, transferir tarefa, cancelar distribuição, expedir comunicação ou remeter ao arquivo;
- preencher minuta ou formulário, selecionar tipo de documento ou clicar em ASSINAR DOCUMENTO(S);
- digitar senha, certificado, token ou PIN. Aparecendo tela de login em qualquer dos dois sistemas, pare e peça ao usuário que se autentique.

O relatório é **conferência**: aponta o que confere e o que diverge, para decisão humana. Não autoriza, não corrige e não assina nada.

Todo o resto desta skill deve ser mantido intacto de uma versão para a outra: nenhuma alteração além da que o usuário pediu expressamente deve ser feita sem consulta prévia.

## Configuração da unidade — antes de tudo

Os dados próprios da unidade — código do órgão, beneficiária do reembolso de perícias, valores dos honorários periciais, fase do PJe prescrita no relatório e nome dos arquivos — não estão escritos nesta skill: ficam em `docs/configuracao-unidade.md`, na pasta do projeto. As regras de conferência, os endereços e campos do PJe 1º grau e do Jurisdição Delegada do TRF5, os dados da DPU e o método do "Enviar para Assinatura" são da skill e não vêm da configuração.

1. Leia `docs/configuracao-unidade.md` no início de toda execução, antes da "Confirmação antes de iniciar".
2. Se o arquivo não existir, crie-o com o título `# Configuração da unidade`.
3. Se faltar alguma seção ou item da lista abaixo, ou houver item com o valor `PENDENTE`, **pare antes de abrir qualquer processo** e faça ao usuário as perguntas que faltam, todas de uma vez, agrupadas por seção, explicando o que é cada item. Grave as respostas no arquivo (uma seção `##` por bloco, uma linha `- <chave>: <valor>` por item; item sem resposta fica `PENDENTE`), mostre o resumo e peça o "pode seguir".
4. Seção comum (`## Comum — ...`) já preenchida por outra skill: reaproveite, sem perguntar de novo; pergunte só os itens dela que faltarem.
5. Nunca use valor que não esteja no arquivo; nunca presuma nem use os valores da 7ª Vara Federal da Paraíba ou de outra unidade. Se, no meio da execução, faltar um dado, pare e pergunte.
6. **Chamada pela `jef-expedir-rpv`** (agente independente): a expedição confere, antes do lote, que as seções abaixo estão completas. O agente só lê o arquivo; se ainda assim faltar item, para e relata, sem perguntar nem gravar.

No texto desta skill, `<seção>.<chave>` indica o item da configuração (ex.: `Comum — Honorários periciais.valores_pericia`).

**Scripts.** `analise-lote-pje.js` e `analise-lote-jd.js` não têm dado da unidade e não recebem configuração: o código do órgão sai do próprio número do processo informado, e os demais dados da unidade são usados só na conferência, pelas regras abaixo.

### Perguntas da configuração

Os exemplos são fictícios: mostram só o formato.

**`## Comum — Unidade`**

| Chave | Pergunta | Exemplo (fictício) |
|---|---|---|
| `codigo_orgao` | Qual o código do órgão no número do processo (os 4 últimos dígitos)? | `9999` em `0000000-00.2026.4.05.9999` |
| `tribunal` | De qual tribunal é a unidade? A skill só funciona com o PJe 1º grau e o Jurisdição Delegada do TRF5; outro tribunal: informe que a skill não serve e não comece. | `TRF5` |
| `secao_judiciaria_razao_social` | Qual o nome da seção judiciária como beneficiária do reembolso de perícias no JD (a razão social do CNPJ, que o JD inclui sozinho na RPV de reembolso)? | `JUSTIÇA FEDERAL DE PRIMEIRO GRAU EM ESTADO EXEMPLO` |
| `secao_judiciaria_cnpj` | Qual o CNPJ dessa beneficiária? | `00.000.000/0001-00` |

**`## Comum — Honorários periciais`**

| Chave | Pergunta | Exemplo (fictício) |
|---|---|---|
| `valores_pericia` | Quais os valores de uma perícia (médica ou social) que aparecem nos ofícios de pagamento da unidade? Separe por `;`. | `R$ 150,00; R$ 220,00` |
| `valor_certidao_ajg` | Qual o valor de uma perícia quando o único comprovante é a certidão "CERTIFICO que solicitei, através do sistema AJG, o pagamento da perícia realizada, no valor e para o perito constante nos autos" (que não traz o valor)? | `R$ 150,00` |
| `valor_pericia_in_loco` | Qual o valor do ofício de pagamento que corresponde a uma perícia in loco (ou `não se aplica`)? | `R$ 600,00` |

Os **valores aceitos no reembolso** são: cada valor de uma perícia (`valores_pericia` e `valor_certidao_ajg`), a soma de dois deles (duas perícias) e o `valor_pericia_in_loco`. Mostre essa lista, calculada, no resumo da configuração.

**`## jef-conferir-rpv`**

| Chave | Pergunta | Exemplo (fictício) |
|---|---|---|
| `fase_elaborar_comunicacao` | Para qual fase (tarefa) do PJe a secretaria movimenta o processo quando todas as requisições dele foram enviadas para assinatura? (É só prescrição no relatório; a skill não movimenta processo.) | `[JEF] Requisição - Comunicar` |
| `prefixo_arquivos` | Com que nome começam os arquivos de andamento e de relatório desta skill, na pasta `Relatórios/`? Tem de ser diferente do `jef-expedir-rpv.prefixo_arquivos`. | `Conf_RPV` |

## Acesso — Chrome (extensão), PJe e Jurisdição Delegada

Os dois sistemas são acessados sempre pelo **Chrome (extensão)** — o navegador real do usuário, onde ele já está autenticado em ambos —, nunca pelo navegador embutido do Claude Code.

Use **uma única janela, com uma aba fixa para cada sistema**: uma aba para o PJe e outra para o Jurisdição Delegada. Identifique as duas abas no início da execução e mantenha cada sistema na sua aba — nunca navegue a aba do PJe para o JD, nem o contrário. Se o usuário ainda não tiver aberto e autenticado algum dos dois sistemas, peça que o faça antes de começar.

**Particularidades do login no JD (testadas):**
- A sessão do JD fica presa à **aba em que o login foi feito** (o endereço carrega um código `wi.redirect` próprio da sessão). Uma aba nova, mesmo no mesmo Chrome, chega sem sessão e recebe **"HTTP Status 403"**. Por isso, o usuário deve fazer o login no JD **dentro do grupo de abas usado pela extensão ("Claude")**: abra a aba em `https://jd.trf5.jus.br/jd/login.wsp` nesse grupo e peça ao usuário que se autentique nela (a tela pede usuário, senha e código de segurança — nunca preencha).
- **Nunca digite endereço de página interna do JD na barra de endereço** (ex.: `consultar.wsp`): o sistema devolve 403. A navegação é sempre pelos menus e links do próprio sistema.

## Entrada — arquivo CSV ou lista de processos na conversa

Os processos a conferir podem chegar de duas formas, e ambas são igualmente válidas:

**A) Arquivo CSV.** Só é usado o CSV fornecido junto com este pedido de execução da rotina — esta skill **não reaproveita** um CSV fornecido anteriormente na conversa. Se o usuário pedir uma nova conferência sem anexar um CSV a este pedido, e também não informar uma lista de processos na conversa, peça o arquivo (ou a lista) antes de prosseguir.

Leia o CSV com separador `;` e encoding `utf-8-sig`, usando o campo `numeroProcesso` para compor a lista de processos a conferir.

**B) Lista de processos informada na conversa** — números digitados ou colados diretamente no chat, sem CSV anexado a este pedido.

## Confirmação antes de iniciar — parada obrigatória

Antes de abrir qualquer processo, confirme com o usuário:
- quantos processos foram informados, com a lista completa dos números;
- que o PJe e o Jurisdição Delegada estão abertos e autenticados, cada um na sua aba;
- que, em cada processo, todas as requisições (RPV e precatório) encontradas no JD na situação "Em Conferência" serão conferidas com os autos do PJe, e que, havendo documento pendente de leitura no PJe, será clicado MARCAR TODOS COMO LIDOS;
- estimativa de esforço: pelos scripts de lote (abaixo), a leitura do PJe leva de 15 a 40 segundos por processo, um por vez, e a do JD (cerca de 12 segundos por processo) corre ao mesmo tempo; com a conferência de cada requisição, conte cerca de 45 segundos a 1 minuto por processo (na unidade em que a skill foi desenvolvida, 129 processos levaram cerca de 1h35), mais as leituras na tela de documentos digitalizados e as paradas para login.
- **esforço alto** (decisão do usuário, 06/11/2026): a conferência roda com esforço alto, por ser a última checagem antes do pagamento. Chamada pela `jef-expedir-rpv`, o agente já é aberto com esforço alto. Acionada diretamente, lembre o usuário de que a sessão deve estar com esforço alto, e só comece depois do "pode seguir".

Só comece com o "pode seguir" do usuário.

## Progresso durante a execução — informe obrigatório a cada 20 processos

Ao completar o 20º processo conferido, registre uma mensagem de progresso parcial: quantos já foram conferidos do total confirmado, quantas requisições (RPV e precatório) foram conferidas até ali, quantas conferem integralmente e quantos AVISOS foram gerados.

Essa mensagem precisa ficar registrada no histórico da conversa — não pode apenas surgir na tela e desaparecer sozinha, como uma notificação passageira. Se a sessão em execução dispuser de uma ferramenta própria para enviar mensagem ao usuário (distinta do texto informal que aparece entre uma chamada de ferramenta e outra), use-a para postar o informe. Não havendo essa ferramenta, poste o informe como texto normal da resposta em andamento.

Em nenhum dos dois casos interrompa a execução para postar o informe: **nunca encerre o turno nem espere confirmação do usuário para prosseguir** — poste o informe e continue imediatamente, na mesma resposta, para o próximo processo. Isso é apenas um informe, **não uma parada para confirmação**. Preferir esse risco (o informe eventualmente não ficar tão visível no histórico quanto postado por uma ferramenta dedicada) a interromper a rotina.

Repita a cada novo múltiplo de 20 (20, 40, 60, 80...) até terminar. Se, por qualquer motivo, a conferência chegar ao fim sem ter passado por esses informes intermediários, sinalize esse desvio explicitamente ao usuário junto do relato final.

## Como abrir cada processo no PJe

Use a **consulta processual**, não a fila. A consulta não vincula tarefa a ninguém e não altera estado.

1. `https://pje1g.trf5.jus.br/pje/Processo/ConsultaProcesso/listView.seam`
2. O número é preenchido em campos separados. Ids: `fPP:numeroProcesso:numeroSequencial`, `:numeroDigitoVerificador`, `:Ano`, `:NumeroOrgaoJustica` (o código do órgão, os 4 últimos dígitos do número: `Comum — Unidade.codigo_orgao`). Ramo (4) e tribunal (05) já vêm preenchidos. Botão: `fPP:searchProcessos`.
3. Clique no número no resultado. Os autos abrem em janela nova — redirecione `window.open` para a mesma aba antes de clicar, senão a janela fica fora de alcance.
4. A cronologia sai em texto do próprio documento (não está em iframe). É **decrescente**: o que está acima é mais recente.

## Como localizar as requisições no Jurisdição Delegada

Caminho testado (Jurisdição Delegada v1.9.0):

1. **Menu RPV/PRC → Consultar.** O menu lateral "RPV/PRC" abre um submenu ao passar o mouse (Cadastrar, Consultar, Não Concluídas, Simulador de Cálculo Valor a Compensar). Use **somente "Consultar"** (tela "RPV/PRC Consultar"). O conteúdo abre num quadro (frame) interno chamado `principal`.
2. **Pesquisa.** Preencha o campo **Nr. do Processo** (`tmp.rpv.nr_processo_judicial`) com os 20 dígitos do número, só números (ex., fictício: `00012345620264059999`), e clique em **Pesquisar**. A pesquisa não grava nada. Por script, o número vai **formatado** (`0000000-00.0000.4.05.0000`), como o próprio campo faz ao perder o foco: preenchido só com os dígitos, a consulta devolveu um falso "Nenhuma RPV/PRC encontrada". Formatado, funcionou nos lotes de 02/10/2026 e 04/10/2026 (ver "Execução em lote", abaixo).
3. **Resultado.** Cada requisição do processo aparece num bloco com: Nr. Processo, **Nr. PRC** (número da requisição, no formato `AAAA.XX.XXXX.XXX.NNNNNN`), Valor Requisitado, Assunto/Complemento/Detalhe, Autor (o beneficiário) e Réu. Um mesmo processo pode ter **várias requisições** (parte autora, honorários sucumbenciais, reembolso de perícia, multa) — confira **todas** as que estiverem "Em Conferência" (ver "Situação Atual", abaixo). Atenção: a lista rotula todas como "Nr. PRC", **inclusive as RPVs** — o tipo (RPV ou Precatório) só se sabe pelo espelho (passo 4).
4. **Espelho da requisição (dados completos).** Ao lado de cada Nr. PRC há um ícone de impressora ("imprimir"), que abre o espelho da requisição (`/jd/rpv/cadastro/imprimir.wsp`) numa janela pop-up. **Não abra o pop-up**: ele abre numa janela fora do grupo de abas da extensão (não legível) e traz, no topo, os botões **"Enviar para Assinatura", "Devolver" e "Cancelar"**. Em vez disso, leia o espelho por dentro da própria aba, só por leitura: no frame `principal`, obtenha o endereço que a função `imprimir(id)` montaria (substitua temporariamente a função `wiOpen` do frame por uma que apenas capture o endereço, chame `imprimir(id)` com o id do link e restaure `wiOpen` em seguida), busque esse endereço com `fetch` (mesma sessão, `credentials: 'include'`), decodifique como **ISO-8859-1** e leia o texto. Essa leitura não aciona nenhum botão. Ao devolver o texto lido, troque o caractere `=` por `:` — trechos com `=` podem ser bloqueados pela extensão.

**Proibições específicas do JD (não podem ser quebradas):**
- **Nunca** clique em **"Devolver"** ou **"Cancelar"**, nem em qualquer outro botão do espelho. **"Enviar para Assinatura"** só nas condições da seção "Enviar para Assinatura", abaixo.
- **Nunca** use a tela **"Não Concluídas"**: ela avisa "Clique em uma das RPV/PRC para concluí-la" — clicar numa linha ali abre a conclusão da requisição. Nunca use "Cadastrar" nem o "Simulador".

**Onde fica cada dado no espelho:**
- **Situação Atual** (ex.: "Em Conferência") — no topo, em "DADOS ADICIONAIS DA RPV". Registre no relatório. **Só as requisições "Em Conferência" são conferidas.** As demais — por exemplo, já enviadas ao tribunal e pagas, ou cuja situação não aparece no espelho — não são analisadas e não constam do relatório, em nenhuma aba.
- **Tipo de Requisição**: "Requisição de Pequeno Valor" ou "Precatório" → define a aba do relatório.
- **Processo de Execução**: número do processo.
- **Exequente** e **Adv(s)**.
- Quadro **Tipo / Beneficiário / CPF/CNPJ / Data Nascimento**: beneficiário principal (ex.: Tipo "Autor"), com **Valor sem Honorários / Cessão (R$)** e **Honorários Contratuais (R$)**, cada um com Valor Principal, Valor Juros, Valor Selic, Valor Multa, Encargos e **Valor Total**. O destaque de honorários contratuais aparece na coluna "Honorários Contratuais" da própria linha da parte autora; o valor devido à parte autora é a soma das duas colunas. Quadro seguinte (Dados NM): número de meses e valores de exercício anterior e corrente.
- Quadro dos **advogados**: Beneficiário, CPF, OAB, **Valor Sucumbência (R$)**, **Valor Contratual (R$)**, Valor Total (R$).
- Quadro de **cessionários** ("Nenhum cessionário com valor a receber", quando não houver).
- **Valor Total Requisitado (R$)**.
- **Data-base**.
- **Data de Trânsito em Julgado da Sentença ou Acórdão no Processo de Conhecimento**.
- **Trânsito em Julgado dos Embargos/Decurso de Prazo para Oposição de Embargos**.
- **Tem Multa Astreintes**; **Crédito somente advogado**.
- **Observações** — inclui "Houve destaque de honorários contratuais em outro requisitório: Sim/Não" e, quando houver, a menção ao representante da parte autora.
- **Servidor responsável pela digitação** — na frase final: "Eu, [NOME], Servidor, digitei o presente."

Dado que não aparecer no espelho: registre "não localizado no JD" — nunca presuma. Processo sem nenhuma requisição localizada no JD ("Nenhuma RPV/PRC encontrada") vai para "Não conferidos", com o motivo.

## Execução em lote — scripts `analise-lote-pje.js` e `analise-lote-jd.js` e arquivo de andamento

A leitura dos dois sistemas roda por dois scripts, que ficam nesta pasta da skill e fazem os mesmos caminhos das duas seções anteriores. Os dois só leem. A única gravação do script do PJe é o MARCAR TODOS COMO LIDOS, chamado à parte, processo a processo (ver a seção própria, abaixo). O script do JD não grava nada: o "Enviar para Assinatura" segue o método da seção própria, fora do script. Quem confere sou eu, pelas regras desta skill, lado a lado. Se uma regra desta skill mudar, ajuste os scripts junto.

Carregue cada script tal como está gravado, nunca reescrito de memória. Crie pelo javascript_tool um `<input type="file">` que, ao receber o arquivo, o execute (`(0, eval)(await input.files[0].text())`), e envie o arquivo a ele com o file_upload do Chrome.

**PJe — `analise-lote-pje.js` (`window.__CR`).**
1. Na aba do PJe, abra a página estática `https://pje1g.trf5.jus.br/pje/js/pdfjs/web/locale/locale.json` e carregue nela o script. Cada processo abre num iframe oculto, e a página de cima não muda de endereço.
2. Inicie com `window.__CR.inicia(lista, base)` (`base` = nº do primeiro processo da lista menos 1). Um processo por vez, um documento por vez: mais que isso faz o PJe bloquear o acesso por 10 minutos (HTTP 429). Se o script parar com `429`, espere os 10 minutos antes de retomar. Processo já lido é pulado: para retomar, basta chamar `inicia` de novo.
3. Acompanhe com `window.__CR.estado()`. Para ler, chame `window.__CR.mostra(a, b)` e leia a página com `get_page_text`. O retorno do javascript_tool é cortado em cerca de 1.200 caracteres; o `get_page_text`, não.

O script lê a cronologia inteira e os documentos que ela omite (`listaIdsDocumentos`). Pelo título, deixa de baixar exames, dossiês e documentos pessoais. Cada processo sai com um cabeçalho (sigilo, `naoLidos`, cronologia completa ou não) e linhas marcadas, descritas no início do script: `PA` (polo ativo), `EV` (eventos), `SEN`, `ACO`, `CALC-JEF` (planilha do JEF, com «CÁLCULO CERTO» quando houver), `CALC?`, `CONC`, `IMPUG`, `DEC`, `NOM`, `OF`, `AJG`, `DST`, `CTR` («ROGO/ANALF»), `PROC`, `MUL`, `ANALF?`, `REPR?`, `POS-RPV`, `SCAN`, `EXTRA` e `FALHOU`. As linhas apontam onde está cada dado; o valor, o percentual e a data conferidos saem sempre do teor do documento. Para ver mais, use:
- `window.__CR.lista(num)`: todos os documentos;
- `window.__CR.busca(num, 'expressão')`: trechos;
- `window.__CR.textos([ids])`: teor guardado.

Documento `SCAN` (digitalizado, sem texto) — contrato, procuração ou cálculo — é lido visualmente: `await window.__CR.img(id, k)` ou `await window.__CR.render(id, página)` desenham a imagem na tela para o screenshot, `CR.desliza(px)` rola a imagem e `CR.fecha()` fecha. O screenshot só funciona em aba que não esteja em segundo plano, e a aba do lote fica atrás da do JD: para a leitura visual, abra uma terceira aba no grupo, na mesma página estática do PJe, carregue nela o mesmo script e desenhe ali. Planilha juntada com a ata de acordo em audiência costuma ser digitalizada, e a cláusula de honorários às vezes está na própria procuração (`window.__CR.busca(num, 'honor')` acha a que tem texto). Se a cronologia não chegar à petição inicial (`TL SEM-INICIAL`), confira na tela se falta algum documento.

**JD — `analise-lote-jd.js` (`window.__JD`).**
1. Na aba do JD, com a tela RPV/PRC Consultar aberta no frame `principal` (pelos menus, ver acima), carregue o script na janela de cima.
2. Inicie com `window.__JD.inicia(lista)`. A lista pode correr ao mesmo tempo que a do PJe, cada uma na sua aba.
3. Leia com `await window.__JD.le(desde)` (`desde` = o `ate:` da leitura anterior) ou com `window.__JD.mostra([processos])` e `get_page_text`.

Cada requisição sai numa linha `J|<processo>|<k>|...` com: nº, Situação Atual, tipo, conferência do nº do processo (`proc ok` ou `DIF`), beneficiários e valores (P principal, J juros, S Selic, M multa, E encargos, T total; `[ADV]` advogados; `[CESS]` cessionários), `VTR` (Valor Total Requisitado), `DB` (data-base), observações e o servidor (`S<k>`, com o nome na linha `S<k>:` do dicionário).

`X|<processo>|Nenhuma RPV/PRC encontrada` é conferido por uma busca digitada na tela antes de ir para "Não conferidos". Se a aba do JD recarregar sozinha (`window.__JD` some), a sessão continua: carregue o script de novo e reinicie só com os processos ainda sem espelho gravado.

**Arquivo de andamento — gravar à medida que sai, nunca só no final.** Antes de iniciar, crie `Relatórios/<prefixo>_AAAA-MM-DD_andamento.txt` (`<prefixo>` = `jef-conferir-rpv.prefixo_arquivos`) com uma linha `L|<nº>|<processo>` por processo do lote. Grave, à medida que cada processo é conferido:
- uma linha `R|<RPV ou Precatório>|<colunas dessa aba, na ordem do Entregável>` por requisição "Em Conferência";
- `N|<processo>|<motivo>` para processo não conferido;
- `M|<processo>|<resultado do MARCAR TODOS COMO LIDOS>`;
- `E|<processo>|<nº da requisição>|<data e hora>|<Situação Atual depois do envio>` para cada envio para assinatura.

O relatório final (.xlsx) é gerado desse arquivo.

**Interrupção.** Se a sessão do PJe ou do JD expirar, o script para sozinho (`login em <processo>` ou `login no JD`). Peça ao usuário que se autentique, carregue o script de novo e reinicie só com os processos do lote que ainda não têm resultado no arquivo. O mesmo vale se o navegador ou a conversa caírem.

## Tipos de requisição

Antes de conferir, identifique a qual destes tipos cada requisição corresponde — as regras de beneficiário, valor e data-base dependem dele:

1. **Parte autora** — valor devido à parte autora (com ou sem destaque de honorários contratuais dentro dela).
2. **Destaque de honorários contratuais** — feito **dentro** da requisição expedida para pagamento da parte autora (não é requisição à parte).
3. **Reembolso de perícias** — RPV para reembolso dos desembolsos feitos pela Justiça Federal com o pagamento de perícias médicas e sociais.
4. **Multa** — RPV com o valor de multa aplicada pela demora em cumprir a obrigação de fazer.
5. **Honorários sucumbenciais** — RPV dos honorários sucumbenciais fixados no acórdão.

Requisição que não se enquadre com clareza em nenhum desses tipos: AVISE, descrevendo o que consta nela.

## Conferência 1 — número do processo e beneficiário (primeira providência)

A primeira providência, em cada requisição, é conferir se o **número do processo** e o **beneficiário** constantes do JD conferem com o processo do PJe. Divergindo, **AVISE**.

- **Número do processo divergente** → AVISO. Não prossiga com a conferência de valor dessa requisição (não há como saber a que processo ela pertence); registre o que consta no JD.
- **Beneficiário divergente** → AVISO, e prossiga com as demais conferências da requisição.

Beneficiário esperado, conforme o tipo:

1. **Parte autora** → a parte autora que consta no processo (nome e CPF).
2. **Destaque de honorários contratuais** → o advogado que consta no processo **ou** o escritório, conforme a solicitação feita no processo. Na dúvida, AVISE.
3. **Reembolso de perícias** → a seção judiciária da unidade, com o nome e o CNPJ configurados em `Comum — Unidade.secao_judiciaria_razao_social` e `Comum — Unidade.secao_judiciaria_cnpj`.
4. **Multa** → a parte autora que consta no processo.
5. **Honorários sucumbenciais** → o advogado que consta no processo **ou** o escritório, conforme a solicitação feita no processo. Na dúvida, AVISE.

**Escritório com o mesmo CNPJ e nome diferente na base do JD — regra geral (usuário, 15/10/2026).** Nos itens 2 e 5, o JD traz o nome do escritório da sua própria base, que pode diferir do nome no contrato ou no pedido. **Confere, sem AVISO**, quando o CNPJ do JD é o mesmo do processo e os dois nomes designam a mesma sociedade: o nome da base acrescenta, abrevia ou varia o do processo, mantendo os nomes que a identificam (ex.: "SOCIEDADE INDIVIDUAL FULANO DE TAL" no contrato e "SOCIEDADE INDIVIDUAL FULANO DE TAL E SICRANO" no JD, com o mesmo CNPJ). Registre os dois nomes na coluna do beneficiário do destaque. Continua sendo AVISO: CNPJ diferente, ou o mesmo CNPJ com nome sem relação com o do processo.

**Parte autora assistida pela Defensoria Pública da União (usuário, 26/10/2026).** O JD exige advogado. Quando a parte autora é assistida pela DPU, sem advogado, a DPU é cadastrada como advogado (Escritório Advocatício). No quadro dos advogados, **confere, sem AVISO**, a DPU com estes dados: CNPJ **00.375.114/0001-16**, nome **DEFENSORIA PUBLICA DA UNIAO**, endereço RUA COSTA BARROS, bairro ALDEOTA, Fortaleza/CE, CEP 60035-000 (os dados de endereço só são conferidos onde o espelho os mostrar). CNPJ ou nome diferentes → AVISO.

**Destaque para advogado pessoa física e destaque dividido (usuário, 06/11/2026; respostas às dúvidas da expedição de 06/11, que valem também aqui).** No item 2, confere, sem AVISO, nestes casos:
- **Advogado pessoa física:** pedido de destaque em favor do advogado pessoa física, com contrato ou cláusula de honorários na procuração em nome dele e sem sociedade contratada → o beneficiário é a pessoa física.
- **Pedido em nome do advogado, contrato com a sociedade:** pedido "em favor da advogada", mas contrato ou procuração outorgados a ela como representante da sua sociedade (ex.: sociedade individual de advocacia, com CNPJ) → o beneficiário é a sociedade.
- **Pedido em favor da sociedade, contrato com advogados pessoas físicas:** a sociedade de advogados não precisa figurar no contrato de honorários nem na procuração. Pedido de destaque feito pelos advogados da parte autora em favor de uma sociedade de advogados → o beneficiário é a sociedade indicada no pedido, e o destaque em favor dela confere, sem AVISO. As demais conferências (contrato, percentual, limite de 30%, CNPJ e nome da base do JD) continuam valendo. Ex.: contrato com três advogados pessoas físicas e pedido de destaque em favor da sociedade da qual eles fazem parte.
- **Dois ou mais advogados pessoas físicas, sem sociedade:** o destaque é dividido entre os advogados contratados. Vale a divisão do pedido (ex.: 15% para cada) ou, sem divisão no pedido, partes iguais. A soma dos percentuais tem de ser a do contrato.

Beneficiário diferente desses → AVISO, como nos demais casos.

**Cessão dos honorários contratuais a terceiro — sem decisão (usuário, 23/10/2026).** Quando o advogado ou o escritório titular do destaque cede os honorários contratuais a terceiro (ex.: empresa de antecipação de honorários) e junta o contrato de cessão aos autos, **não é necessária decisão que homologue a cessão**: a própria secretaria faz o destaque de ordem do juiz. O destaque em favor da cessionária **confere, sem AVISO**, quando o contrato de cessão tem como cedente o titular do destaque e inclui os honorários deste processo, e a cessionária do JD é a do contrato ou da petição que o junta. As demais conferências do destaque (contrato de honorários, pedido, percentual e limite de 30%) continuam valendo. Registre na coluna do beneficiário do destaque o cedente, a cessionária e os documentos da cessão. **Ressalva (usuário, 23/10/2026):** a dispensa de decisão vale só para a cessão dos honorários contratuais. A cessão do crédito da parte autora precisa de decisão que a defira: requisição com cessionário do crédito da parte autora sem essa decisão nos autos → AVISO.

## Conferência 2 — valor (o dado mais importante da rotina)

O valor é o dado mais importante da conferência e deve ser tratado com o máximo de critério. Compare **até o centavo**. Diferenças de **até R$ 0,02 (dois centavos)**, para mais ou para menos, são arredondamento de conta: desconsidere-as — a coluna "Confere" recebe `sim` e não se gera AVISO. Diferença acima de R$ 0,02 é AVISO. Na dúvida sobre qual valor é o correto, **não escolha: relate e AVISE**.

### Como localizar o cálculo no PJe (regras da `jef-fase-execucao`)

Não se limite ao título dos documentos da cronologia. O INSS costuma juntar o cálculo dentro de uma petição ou de anexos com título genérico, como "Petição (outras)", "Petição (outras) (A PARECER TÉCNICO…)", "Petição (outras) (A ANEXO…)", "Outras peças (INSS)" ou "Documentos Diversos". Por isso, procure também pelo texto os documentos juntados pelo INSS/PGF (polo passivo, Equipe de Cálculos, ECALC/CALPREV, CEAB) depois da sentença ou da homologação do acordo. Considere apresentada a planilha quando o texto de qualquer desses documentos trouxer, por exemplo: "cálculo de liquidação", "Parecer Técnico … CALPREV/ECALC5", "planilha de cálculo", "demonstrativo de cálculo", "valor devido" com apuração por competência, ou o anexo de cálculo referido na petição. Basta a existência do cálculo nos autos, ainda que o título do documento não diga "planilha" ou "cálculo".

Não confundir as duas planilhas que o juízo pode juntar com a sentença: a de **cálculo de tempo para aposentadoria** não é cálculo de valor devido; só a de **cálculo de atrasados** serve para a conferência de valor. Considere também os cálculos juntados pelo Setor de Contadoria, pela parte autora ou pelo próprio juízo.

Registre sempre o **número do documento** em que o cálculo usado foi encontrado.

### Mais de um cálculo no processo

- **Regra geral: priorize o último cálculo juntado** e registre no relatório **por que o último é o certo** (ex.: refez o cálculo após impugnação, foi elaborado pela Contadoria por determinação judicial, retificou erro do anterior, foi o homologado por decisão).
- **Contadoria com dois cálculos no mesmo ato:** o Setor de Contadoria às vezes anexa dois cálculos; em um deles consta "cálculo certo" ou expressão equivalente. Considere esse e registre o trecho que o identifica.
- Se algum elemento dos autos indicar que o último cálculo **não** é o que prevaleceu (ex.: decisão posterior que homologou um cálculo anterior, ou impugnação ainda pendente de decisão), ou se não for possível dizer com segurança qual cálculo vale: **não escolha — AVISE**, listando os cálculos encontrados (documento, data e valor de cada um).

### Valor esperado, conforme o tipo

**1. Parte autora** → o valor da requisição deve ser **o mesmo do cálculo** apresentado no processo do PJe (ver acima). Em acordo, vale o **valor que consta na proposta de acordo** do INSS, e não o da tabela que a acompanha: requisição com o valor da proposta confere, ainda que a tabela traga valor diferente — isso não é AVISO.
- **Planilha do setor de cálculo (Contadoria) juntada depois da proposta de acordo** (regra do usuário, 06/11/2026): é a atualização do valor da proposta e passa a ser a base da requisição, **no valor e na data-base** (a data-base é a da planilha, ver Conferência 3). Requisição com o valor e a data-base dessa planilha confere — não é AVISO. Requisição com o valor da proposta, havendo essa planilha posterior → AVISO.

**2. Destaque de honorários contratuais** → o valor corresponde ao **percentual fixado no contrato de honorários**, aplicado sobre o valor a ser recebido pela parte autora.
- O destaque está **condicionado à existência de contrato de honorários no processo e de pedido expresso de destaque**. Faltando qualquer dos dois, não cabe destaque: requisição com destaque nessas condições → AVISO. **Havendo contrato de honorários, mas sem pedido expresso de destaque, a requisição está correta ao não destacar os honorários contratuais** — isso confere, não é AVISO. Isso vale também para o contrato juntado cujo pedido de destaque não é localizado (decisão do usuário, 06/11/2026), depois de lidos os pedidos da inicial e as petições posteriores (item seguinte).
- **Dúvida sobre o contrato ou o pedido de destaque** (usuário, 06/11/2026; casos que a expedição não elabora): requisição com destaque nessas condições → AVISO. Exemplos:
  - habilitação de cessionária com contrato de cessão "sem destaque";
  - contrato sem data e com a qualificação do contratante em branco;
  - inicial que menciona percentual e petição posterior que pede a RPV só para a parte autora, sem contrato localizado;
  - contrato que traz outra pessoa como contratante;
  - contrato de honorários de outra ação (ex.: interdição) com percentual diferente do pedido.
- **O pedido de destaque feito na petição inicial é pedido expresso** (informação do usuário, 06/11/2026). Ele costuma estar na seção dos pedidos, no fim da inicial. Antes de concluir que não há pedido, leia os pedidos da inicial no texto integral (`CR.busca(num, 'destaq|reten')` ou `CR.txt(id, 60)`), e não só as primeiras páginas; inicial digitalizada é lida pela imagem. Não havendo pedido na inicial, procure-o nas petições posteriores.
- Não são aceitos destaques **superiores a 30% (trinta por cento)** → AVISO.
- **Limite absoluto — regra que nunca pode ser quebrada (usuário, 16/10/2026):** em nenhuma hipótese o destaque de honorários pode ser superior a **30% do valor a ser recebido pela parte autora**, independentemente do previsto no contrato (parte fixa, honorário mínimo, salários de benefício, parcelas vincendas ou qualquer outra cláusula). Destaque acima desse limite, em percentual ou em valor → AVISO, ainda que o contrato o autorize.
- Localize o contrato de honorários no processo, se houver, e confira se o **percentual do destaque feito na requisição confere com o percentual previsto no contrato**. Divergindo → AVISO.
- Informe no relatório **qual o valor que corresponde ao destaque** (percentual × valor da parte autora), ao lado do que consta no JD.
- **Pedido de destaque juntado depois da elaboração da requisição:** é comum que, entre a elaboração da RPV e sua assinatura, o advogado junte pedido de destaque de honorários. Havendo pedido de destaque no processo e a requisição **não** tendo destacado os honorários contratuais do valor a ser pago à parte autora → AVISO.
- **Contrato com pessoa analfabeta:** a assinatura **A ROGO** e de **mais duas testemunhas** só é exigida quando consta a **impressão digital** da parte autora no contrato de honorários ou na procuração. Se a própria parte autora, ainda que analfabeta, assinou, não se exige assinatura a rogo nem testemunhas — isso confere, não é AVISO. Havendo impressão digital no contrato ou na procuração, confira o contrato: na falta da assinatura a rogo ou de qualquer das duas testemunhas, ou na dúvida → AVISO.
- **Procuração pública** (regra do usuário, 06/11/2026): o contrato de honorários ou a cláusula de honorários lavrados em procuração pública (escritura em cartório) **suprem** a assinatura a rogo e as duas testemunhas, ainda que a parte autora não seja alfabetizada e haja impressão digital. Destaque apoiado em procuração pública confere, nesse ponto, sem AVISO; as demais conferências do destaque (pedido, percentual, beneficiário, limite de 30%) continuam valendo.
- **Assinatura da parte autora no contrato digitalizado:** antes de concluir que falta a assinatura da parte autora, veja cada página do contrato inteira, até o fim — `CR.desliza` até a altura informada por `CR.img` ou `CR.render`, que costuma passar de uma tela —, e todas as páginas. A assinatura costuma estar na linha "CONTRATANTE", abaixo da do advogado. Nome da parte autora manuscrito na linha do contratante é assinatura, ainda que a letra se pareça com a do preenchimento do cabeçalho: a conferência não faz exame grafotécnico. Contrato assinado pela parte confere nesse ponto, sem AVISO.
- **Decisão sobre o pedido de destaque prevalece**: decisão, despacho ou ato ordinatório (inclusive "de ordem verbal") que decida o pedido de destaque — deferindo, deferindo em parte (ex.: só para o advogado que consta do contrato) ou indeferindo — prevalece sobre o pedido. Requisição feita conforme essa decisão confere, sem AVISO; feita contra ela, é AVISO. Procure a decisão também nos documentos juntados com o título "Intimação" (linha `DEC … «ATO NA INTIMAÇÃO»` do leitor v11). Ex.: pedido que divide os 30% entre dois advogados e ato que defere o destaque só ao advogado do contrato: a requisição com todo o destaque para ele confere.
- **Destaque indeferido por vício do contrato e novo contrato juntado depois** (regra do usuário, 06/11/2026): não é preciso nova decisão. A secretaria faz o destaque de ordem verbal do juiz, se o novo contrato for válido (assinatura a rogo e duas testemunhas, quando houver impressão digital; percentual; contratado). Requisição com o destaque conforme o novo contrato válido confere — não é AVISO. Novo contrato com vício, ou na dúvida → AVISO.

**3. Reembolso de perícias** → os valores possíveis são os **valores aceitos no reembolso** da configuração: cada valor de uma perícia (`Comum — Honorários periciais.valores_pericia` e `.valor_certidao_ajg`) e a soma de dois deles (ver "Configuração da unidade"). Valor fora dessa lista → AVISO. Como obter o valor nos autos:
- **Perícia in loco** (regra do usuário, 06/11/2026): havendo ofício de pagamento no valor de `Comum — Honorários periciais.valor_pericia_in_loco`, a perícia foi realizada in loco, e a RPV de reembolso desse valor confere — não é AVISO. Nomeação anterior do mesmo perito sem pagamento próprio segue a regra das nomeações repetidas (abaixo).
- a) **Ofício de pagamento:** o valor é o "valor requerido" que consta no ofício.
- b) **Documento comprobatório** com o texto "CERTIFICO que solicitei, através do sistema AJG, o pagamento da perícia realizada, no valor e para o perito constante nos autos": nesses casos, o valor é sempre o de `Comum — Honorários periciais.valor_certidao_ajg`.
- Nas RPVs cujo valor é a **soma de dois valores de perícia** da configuração, o valor corresponde à **soma de duas perícias**: localize ambas e some os valores. Não localizando as duas → AVISO.
- **Quantidade de perícias × quantidade de comprovantes de pagamento.** Às vezes há mais de uma perícia realizada no processo, mas só foi juntado um comprovante de pagamento (Ofício de pagamento ou Documento Comprobatório) — o que levaria, erradamente, a concluir que a RPV de reembolso se refere a uma só perícia. Para evitar esse erro, compare sempre a **quantidade de comprovantes de pagamento** (Ofício de pagamento ou Documento Comprobatório) com a **quantidade de certidões de nomeação dos peritos** (documentos identificáveis no processo com o nome "Certidão de nomeação"). Confira o **teor** de cada documento: já houve casos de o ofício de pagamento ter sido juntado duas vezes referindo-se à mesma perícia — conte perícias distintas, não documentos. Encontrando discordância entre as perícias nomeadas e os pagamentos comprovados → AVISO. **Exceção:** mais de uma certidão de nomeação do **mesmo perito** com um só comprovante de pagamento conta como **uma só perícia devida** (a nomeação foi repetida, não houve segunda perícia) — confere, não é AVISO.
- **Certidão do AJG sem o nome do perito, anterior a ofícios de pagamento de peritos do mesmo processo** (usuário, 06/11/2026): não é perícia a mais. O reembolso conta só os ofícios, e a RPV com a soma deles confere, sem AVISO. Ex.: certidão do AJG e, meses depois, ofícios de dois peritos → duas perícias, com a soma dos dois ofícios e a data-base do último ofício. Se a certidão identificar perito sem ofício próprio, a regra não se aplica e vale a comparação acima.
- Nunca presuma nada pelo nome do arquivo juntado ao processo: sempre analise o teor do documento.

**4. Multa** → o valor é o **liquidado na decisão**. Pode haver mais de uma decisão liquidando a multa: nesse caso, **some todas** para apurar o valor da RPV e **AVISE sempre**, listando cada decisão (documento, data e valor).
- **Como a RPV de multa sai no JD** (usuário, 19/11/2026; fluxo testado na expedição). Confere, sem AVISO, a requisição com:
  - assunto **08.05.15 – Multa Cominatória/Astreintes**, o único que o JD aceita com Multa Astreintes = Sim;
  - **natureza Comum** e requisitório originário;
  - valor no **Valor Principal**, sem juros e sem Selic, porque o JD não abre o "Valor Multa";
  - sem NM;
  - o "Motivo do novo Requisitório" preenchido.
- **Decisão que só mantém a multa:** a decisão posterior que rejeita a impugnação e mantém a multa, sem nova liquidação, não é outra liquidação. Não se soma, e o valor é o da decisão que liquidou.
- **Agravo pendente:** agravo de instrumento do INSS pendente, sem efeito suspensivo, não é AVISO (decisão do usuário).

**5. Honorários sucumbenciais** → em regra, **10% do valor devido à parte autora**, e o valor consta na planilha de cálculo que apurou o valor devido à parte autora. Percentual diferente de 10%, ou valor que não conste na planilha de cálculo → AVISO.

**6. RPV suplementar** (usuário, 19/11/2026; fluxo testado na expedição). É a diferença apurada por planilha da Contadoria posterior ao pagamento da RPV originária, que recalcula o devido e desconta o valor requisitado e atualizado (Res. CJF 983/2026, art. 41). Confere, sem AVISO, a requisição com:
- **Requisitório:** Suplementar.
- **Data da Execução:** a data do ofício da RPV originária.
- **Valor, principal, Selic e data-base:** os do **líquido devido** da planilha da suplementar, com a data-base na data da planilha.
- **Valor Total da Execução:** o total realizado e atualizado da planilha (art. 8º, XVIII).

Divergência em qualquer desses dados → AVISO.

**Qual planilha vale** (decisão do usuário em 19/11/2026): na suplementar, vale a **planilha mais recente da Contadoria** que recalcula todo o período e desconta o valor requisitado e atualizado. Não é AVISO, e essa planilha prevalece, ainda que:
- haja planilha anterior só das parcelas novas, com a concordância do INSS;
- e a planilha mais recente aplique Selic ou omita meses em relação a ela.

Continua AVISO a decisão posterior que homologue a planilha anterior ou mande refazer a mais recente.

## Conferência 3 — data-base

1. **Parte autora e honorários sucumbenciais** → a data que consta na planilha de cálculo. Tendo sido a planilha apresentada **pelo INSS**:
   - juntada **no próprio mês de referência** do cálculo → a data-base é a **data da juntada** do documento no processo;
   - juntada **em mês posterior** ao de referência → a data-base é o **último dia do mês de referência** (ex.: tabela da proposta de acordo com referência 07/2026, juntada em 03/08/2026 → 31/07/2026).

   Em acordo com planilha do setor de cálculo (Contadoria) juntada depois da proposta, a data-base é a da planilha da Contadoria, e não a da proposta (regra do usuário, 06/11/2026; ver Conferência 2, parte autora).
2. **Reembolso de perícias:**
   - a) Ofício de pagamento → a data que consta em "Nesta data foi solicitado pagamento para o profissional", no ofício.
   - b) Documento comprobatório ("CERTIFICO que solicitei, através do sistema AJG, o pagamento da perícia realizada…") → a data que consta na certidão.
   - c) Havendo mais de uma perícia → a data da **última** informação sobre a solicitação de pagamento.
3. **Multa** → a data da decisão que liquidou a multa. Havendo mais de uma decisão, a data da **última**. A decisão que só rejeita a impugnação e mantém a multa não muda a data-base (usuário, 19/11/2026).

Data divergente → AVISO.

## Conferência 4 — data do trânsito em julgado: não é conferida

**Não confira** a data do trânsito em julgado, nem nos processos que tiveram recurso: ela não interfere na correção do valor. O relatório não traz colunas nem AVISOS sobre o trânsito em julgado.

## Conferência 5 — representante da parte autora

Tendo a parte autora **representante** no processo (ex.: curador, tutor, genitor de menor), isso deve constar das **observações** da requisição. Não constando → AVISO.

**Dúvida sobre a representação ou a curatela** (usuário, 06/11/2026; casos que a expedição não elabora) → AVISO. Exemplos: curador especial no polo, com despachos dizendo não haver interdição nem curador regular; contrato de honorários assinado pelo próprio autor, que tem ação de curatela ou interdição em curso e representante no polo.

## Servidor responsável pela digitação

Registre, em toda requisição, o servidor responsável pela digitação da RPV/precatório, conforme consta no JD — sempre na **última coluna** do relatório.

## MARCAR TODOS COMO LIDOS — documentos não lidos (só no PJe)

Se a cronologia do PJe trouxer o aviso **"Há N documento(s) não lido(s)"**, no topo do painel, clique em **MARCAR TODOS COMO LIDOS** depois de concluir a conferência do processo — em todo processo desta lista que tiver documento pendente de leitura, com ou sem AVISO. Confirme que o aviso sumiu antes de passar ao próximo processo.

Esse botão só existe dentro dos autos, um processo por vez — não há equivalente em lote. Nunca clique em MARCAR TODOS COMO LIDOS num processo cujos autos não abriram. No Jurisdição Delegada, nada é marcado nem gravado, salvo o "Enviar para Assinatura" da seção seguinte.

**No lote**, o cabeçalho de cada processo traz `naoLidos` (o número de não lidos na hora da leitura). Depois de gravada no arquivo de andamento a conferência do processo, chame `await window.__CR.marca('<processo>', <naoLidos>)` nos processos com `naoLidos` maior que zero. O script abre os autos no quadro oculto, clica em MARCAR TODOS COMO LIDOS e confere que o aviso sumiu. Um processo por vez, nunca antes da conferência gravada.
- `MTL OK`: grave no arquivo de andamento.
- `NÃO MARCADO: eram X não lidos na leitura e agora são Y`: chegou documento depois da leitura. Leia o processo de novo antes de marcar — nada é marcado sem ser lido.
- `MTL FALHOU` ou `botão ... não encontrado`: abra o processo numa aba visível e clique pela tela, conferindo o aviso.

## Enviar para Assinatura (JD) — só requisições sem AVISO, com confirmação do usuário

Depois do "Enviar para Assinatura" ainda há uma etapa humana antes do pagamento. Mesmo assim, este é o único ato de gravação permitido no JD, e só nestas condições:

1. **Quando.** Só depois de concluída a conferência do lote e gerado o relatório.
2. **Quais.** Só requisições "Em Conferência" sem nenhum AVISO. Diferenças de até R$ 0,02, desconsideradas na Conferência 2, não impedem o envio. Requisição com qualquer AVISO, ou com qualquer dúvida, fica de fora.
3. **Confirmação a cada execução.** Apresente na conversa a lista das requisições aptas (processo, nº da requisição, tipo e valor) e peça a confirmação expressa do usuário para aquela lista. Sem o "sim" do usuário, nada é enviado. A confirmação vale só para a lista apresentada, naquela execução — nunca há autorização prévia.
4. **Uma por vez.** Antes de clicar, confira no espelho que a requisição é a da lista (número da requisição, processo e valor) e que a Situação Atual ainda é "Em Conferência". Clique em "Enviar para Assinatura" uma única vez. Depois, releia o espelho e confirme que a Situação Atual saiu de "Em Conferência". Se não saiu, ou se aparecer mensagem de erro, janela de confirmação ou qualquer coisa inesperada, pare e informe o usuário — nunca clique de novo por conta própria.
5. **Depois do envio, nenhum ato posterior.** Na requisição enviada para assinatura é proibido qualquer outro ato, de qualquer tipo. "Devolver" e "Cancelar" continuam proibidos em qualquer requisição.
6. **Registro.** Grave cada envio no arquivo de andamento assim que acontecer (requisição, data e hora, e Situação Atual depois do clique) e gere de novo o relatório, a partir do andamento, com a aba `Enviadas para assinatura` (ver Entregável).

**Como clicar (método testado com o usuário em 04/10/2026, em 6 requisições).** Use a própria aba do JD, no grupo da extensão — nunca o pop-up, que abre fora do grupo de abas:

1. Na tela RPV/PRC Consultar (frame `principal`), obtenha o endereço do espelho da requisição como na leitura: substitua temporariamente a função `wiOpen` do frame por uma que só capture o endereço, chame `imprimir(id)` e restaure `wiOpen`.
2. Carregue esse endereço no próprio frame `principal`, e não em janela nova. A página exibida é o espelho, com os botões.
3. Antes de clicar, substitua `alert` e `confirm` do frame por funções que só registrem a mensagem (`confirm` devolvendo `false`), para que um alerta do sistema não trave a aba.
4. Confira na página carregada que a Situação Atual é "Em Conferência" e que o número da requisição, o número do processo e o Valor Total Requisitado são os da lista confirmada pelo usuário. Confira também que o botão `#btn_validar` tem o texto "Enviar para Assinatura" e o `onclick` `validar(<id>,'<nº da requisição>')`. Qualquer divergência: não clique e informe o usuário.
5. Clique uma única vez em `#btn_validar`, por `.click()` no elemento — nunca por coordenada da tela. O botão não pede confirmação: o clique já envia. O sistema só barra o envio, com alerta, em precatório com mais de um beneficiário ou com autor incapaz ou menor sem representante; havendo alerta, pare e informe.
6. Aguarde a página recarregar e confira que a Situação Atual passou a "Aguardando Assinatura" e que o número da requisição é o mesmo. Depois do envio, a página mostra só o botão "Imprimir"; não toque em nada.
7. Para a requisição seguinte, volte ao passo 1.

"Devolver" (`#btn_devolver`) e "Cancelar" (`#btn_cancelar`) ficam na mesma página do espelho: nunca os acione.

## Entregável

Um único arquivo .xlsx, fonte Arial, com quatro abas (cinco, quando houver envio para assinatura). Identifique processos pelo número, nunca pelo nome da parte, em todas as abas (o nome do beneficiário aparece só nas colunas de conferência de beneficiário, onde é o próprio dado conferido).

**Abas `RPV` e `Precatório`** — o relatório separa **Requisição de Pequeno Valor** e **Precatório**, cada um na sua aba, com as mesmas colunas. Uma linha por requisição. Os dados do PJe e do JD ficam **lado a lado**, seguidos da coluna "Confere", para permitir a conferência visual:

| Processo | Nº da requisição | Tipo de requisição | Situação no JD | Processo — JD | Confere | Beneficiário — PJe | Beneficiário — JD | Confere | Valor — PJe | Valor — JD | Confere | Cálculo usado (documento e por quê) | % destaque — contrato | % destaque — JD | Valor do destaque — PJe | Valor do destaque — JD | Beneficiário do destaque — PJe | Beneficiário do destaque — JD | Confere | Data-base — PJe | Data-base — JD | Confere | Representante — PJe | Consta nas observações do JD | AVISOS | Sigiloso | Servidor responsável pela digitação |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|

- A coluna **Situação no JD** recebe a "Situação Atual" do espelho (ex.: "Em Conferência").
- As colunas **Confere** recebem `sim`, `NÃO` ou `não se aplica`. Todo `NÃO` gera texto na coluna **AVISOS**.
- As colunas de destaque só são preenchidas na requisição da parte autora que tiver (ou devesse ter) destaque de honorários contratuais; nas demais, `não se aplica`.
- A coluna **Cálculo usado** registra o número do documento do cálculo no PJe e, havendo mais de um cálculo, por que o escolhido é o certo (ou o trecho "cálculo certo" da Contadoria).
- A coluna **AVISOS** descreve cada divergência ou dúvida de forma objetiva: o que diverge, o valor/dado do PJe e o do JD, e o documento de referência.
- A coluna **Sigiloso** recebe "sim" quando o processo tramitar em segredo de justiça, conforme classificação efetivamente registrada nele; nesses casos, mantenha as descrições no mínimo necessário.
- A última coluna é sempre **Servidor responsável pela digitação**.

**Aba `Avisos`** — consolida todos os AVISOS das abas RPV e Precatório, um por linha, para facilitar o tratamento:

| Processo | Nº da requisição | RPV ou Precatório | Tipo de requisição | Aviso | Servidor responsável pela digitação |
|---|---|---|---|---|---|

**Aba `Não conferidos`** — processos que não puderam ser conferidos (não encontrado no PJe, autos que não abriram, nenhuma requisição localizada no JD), com o motivo:

| Processo | Motivo |
|---|---|

**Aba `Enviadas para assinatura`** — só quando houver envio (ver seção "Enviar para Assinatura"), uma linha por requisição enviada:

| Processo | Nº da requisição | Tipo de requisição | Valor | Data e hora do envio | Situação Atual depois do envio | Movimentação do processo |
|---|---|---|---|---|---|---|

A coluna **Movimentação do processo** (regra do usuário, 13/10/2026) é prescrição para a secretaria, nunca ato da skill — nenhuma skill movimenta processo no PJe:
- `MOVIMENTAR para a fase "<jef-conferir-rpv.fase_elaborar_comunicacao>"` (o nome da fase configurada) — quando **todas** as requisições "Em Conferência" do processo foram enviadas para assinatura nesta execução e nenhuma outra requisição do processo ficou pendente no JD (ex.: "Em Elaboração" ou "Devolvida", conforme a consulta do processo);
- `NÃO movimentar: <motivo>` — quando alguma requisição do processo não foi enviada (com AVISO, fora da lista confirmada pelo usuário ou pendente no JD); o motivo indica o nº da requisição e por quê.

O texto se repete em todas as linhas do mesmo processo.

Nome do arquivo: `<prefixo>_AAAA-MM-DD.xlsx` (`<prefixo>` = `jef-conferir-rpv.prefixo_arquivos`), na pasta `Relatórios/`. Se o usuário tiver pasta conectada, salve lá além de entregar na conversa.

## Ao terminar

Relate primeiro o diagnóstico, depois os dados de apoio: quantos processos foram conferidos no total; quantas requisições foram conferidas, separadas entre RPV e Precatório; quantas conferem integralmente; e a relação **um a um** dos AVISOS, começando pelos de **valor** (o dado mais importante), depois beneficiário e número do processo, depois datas, destaque, representante e demais. Informe também quantos processos tiveram MARCAR TODOS COMO LIDOS confirmado. Havendo envio para assinatura, informe quais requisições foram enviadas e a Situação Atual de cada uma depois do clique, e liste os processos que devem ser movimentados para a fase configurada em `jef-conferir-rpv.fase_elaborar_comunicacao` (e os que não devem, com o motivo).

Se algum processo não for encontrado na consulta, os autos não abrirem ou nenhuma requisição for localizada no JD, diga quais e por quê. Nunca relate como conferido um processo ou uma requisição que você não conseguiu abrir e ler por inteiro.

### Incorporar à skill as respostas às dúvidas — regra obrigatória (usuário, 06/11/2026)

**Ao final de toda sessão, as respostas do usuário às dúvidas e aos AVISOS que ele resolver devem ser incorporadas a esta skill, no que for aplicável, para as conferências futuras.** As respostas dadas na expedição (`jef-expedir-rpv`) entram aqui também, sempre que mudarem o que confere ou o que é AVISO. A sessão não está encerrada enquanto isso não for feito.

1. **Selecione.** Separe as respostas que valem como regra geral das que só resolvem aquele processo. Estas não entram na skill.
2. **Redija.** Escreva cada resposta aplicável como regra, na conferência a que pertence, com a data, "usuário" como fonte e o caso de origem (nº da requisição e processo). Quando a resposta também afetar a elaboração, grave-a igualmente na `jef-expedir-rpv`.
3. **Confira o conflito.** Se a resposta contrariar uma regra já escrita, ou o alcance da generalização for incerto, pergunte ao usuário antes de gravar.
4. **Não altere o resto.** Nada além do que as respostas autorizam é mudado.
5. **Registre.** Anote a alteração em "Alterações registradas" do `CLAUDE.md` do projeto e informe ao usuário o que foi incorporado e o que ficou de fora.

Quando a conferência roda como agente independente, chamado pela expedição, o agente não altera a skill. A incorporação é feita pela conversa principal, ao fim da sessão.
