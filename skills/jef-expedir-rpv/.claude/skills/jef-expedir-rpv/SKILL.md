---
name: "jef-expedir-rpv"
description: "Para processos na fase de elaboração de requisitório (a fase configurada pela unidade), a partir de CSV ou de uma lista de processos informada na conversa, colhe nos autos do PJe os dados de cada requisição de pequeno valor (parte autora com ou sem destaque percentual de honorários contratuais, honorários sucumbenciais e reembolso de perícia), elabora as RPVs no sistema Jurisdição Delegada (JD/TRF5) — Cadastrar, partes, valores, Gravar, Ofício e Enviar para Conferência —, só nos processos da lista fornecida pelo usuário, e, depois de expedidas todas as RPVs dos processos informados, chama uma única vez a conferência independente (jef-conferir-rpv), com um só relatório, num agente separado, que não vê nada do que a expedição fez; gera relatório em .xlsx com Elaboradas, Não elaboradas e Avisos. Os dados da unidade (fase do PJe, beneficiária do reembolso, honorários periciais, nome dos arquivos) vêm de docs/configuracao-unidade.md. Desenvolvida na 7ª Vara Federal da Paraíba."
---

# Expedição de RPV — PJe → Jurisdição Delegada

Desenvolvida na 7ª Vara Federal da Paraíba. Os dados próprios da unidade vêm de `docs/configuracao-unidade.md` (ver "Configuração da unidade — antes de tudo").

Use quando o usuário fornecer um CSV, ou informar diretamente na conversa uma lista de números de processo, e pedir a elaboração das requisições de pequeno valor (RPV) no sistema **Jurisdição Delegada** (`https://jd.trf5.jus.br/jd/login.wsp`) com os dados dos processos do PJe.

Esta rotina **requisita pagamento de valores**. Cada dado lançado no JD sai do teor de um documento do processo, nunca de presunção, do nome do arquivo ou de memória. Um dado errado aqui vira pagamento errado.

Todo o resto desta skill deve ser mantido intacto de uma versão para a outra: nenhuma alteração além da que o usuário pediu expressamente deve ser feita sem consulta prévia.

## As três regras do usuário — nunca podem ser quebradas

1. **Nunca invente nenhum dado.**
2. **Os dados são colhidos exclusivamente do processo a que a requisição diz respeito.** Nada de outro processo, de outra requisição, de tabela externa ou de memória.
3. **Na dúvida sobre um documento que não pode ser lido, ou sobre datas e valores, pergunte — jamais suponha.**

No lote, a dúvida não para os demais processos: o processo com dúvida não é elaborado, a pergunta vai para o arquivo de andamento (linha `Q`), e as perguntas são feitas juntas ao fim da expedição de todos os processos da lista. Com a resposta do usuário, o processo é elaborado — antes de a conferência começar.

**Execução contínua — sem paradas no meio do lote (regra do usuário, 06/11/2026).** Depois do "pode seguir" da confirmação inicial, a skill elabora, em sequência e sem interromper a execução para consultar o usuário, todas as requisições aptas de todos os processos da lista. Não propõe lote-piloto, não pede validação parcial, não pergunta se continua, não oferece rodar a conferência antes do fim. Toda dúvida, AVISO, requisição criada e não concluída ou problema técnico (ex.: campo do JD que exige dado não previsto) vira linha `Q`, `A`, `I` ou `N` no andamento, e o processo seguinte é aberto. Só ao fim da expedição de todos os processos as dúvidas são apresentadas juntas; com as respostas, elaboram-se os processos liberados; e só então roda a conferência independente, uma única vez, para todas. As únicas paradas admitidas no meio do lote são as que esta skill manda expressamente (tela de login, bloqueio do PJe por excesso de acessos, bloqueio do modo automático, as paradas antes do "Continuar" ou do "Gravar" marcadas como "primeira vez" de fluxo não testado e a parada antes do "Gravar" da requisição devolvida) — e, nelas, só aquela requisição espera; as demais seguem. Os informes de progresso a cada 20 processos não são paradas: são postados e a execução continua.

## Limite de atuação e autorização do usuário — leia antes de tudo

**Autorização consignada pelo usuário (13/10/2026).** O usuário autoriza, para todas as requisições dos processos que ele fornecer:
- clicar em "Continuar" em cada etapa do Cadastrar;
- clicar em **"Gravar"** e dar OK nas confirmações do JD **esperadas** (ver a lista na seção do JD);
- clicar em **"Ofício"** e em **"Enviar para Conferência"** em toda requisição elaborada (regra do usuário para todas as requisições).

**A trava de segurança é a lista de processos fornecida pelo usuário em cada execução.** Nenhuma requisição pode ser expedida senão de processo expressamente fornecido por ele nesta execução. O script recebe essa lista (`EX.autoriza`) e recusa qualquer outro processo.

**No Jurisdição Delegada**, além do que está acima, nunca:
- clicar em "Enviar para Assinatura", "Devolver", "Cancelar", "Enviar para o TRF", "Assinar/Finalizar" ou "Validar";
- usar a tela "Não Concluídas" (clicar numa linha ali abre a conclusão da requisição) ou o "Simulador" — **salvo** para reabrir requisição **devolvida** que o usuário listar pelo número, pelo método da seção "Requisição devolvida — refazer pela tela Não Concluídas" (autorização do usuário, 16/10/2026); ali, nunca o link "excluir" da linha;
- enviar o formulário da lista do Painel (ele tem os botões "Enviar para o TRF" e "Assinar/Finalizar"); a lista é só lida, por consulta;
- cancelar ou excluir requisição, nem mesmo a que ficou incompleta por erro da própria rotina (ela é relatada; o tratamento é humano);
- dar OK em confirmação ou alerta que não seja o esperado naquele passo.

**No PJe, só leitura.** Esta skill não clica em MARCAR TODOS COMO LIDOS: quem marca é a conferência independente (`jef-conferir-rpv`), depois de ler o processo. Nunca, no PJe: inserir ou retirar etiqueta, movimentar, protocolar, juntar documento, transferir tarefa, expedir comunicação, preencher minuta ou assinar.

**Nunca digitar senha, certificado, token ou PIN.** Aparecendo tela de login em qualquer dos dois sistemas, pare e peça ao usuário que se autentique.

**Bloqueio do modo automático.** Se o classificador do modo automático bloquear um "Gravar" ou uma confirmação, não insista nem contorne: pare e peça ao usuário que clique, informando a requisição e o passo.

## Configuração da unidade — antes de tudo

Os dados próprios da unidade — fase do PJe, beneficiária do reembolso de perícias, valores dos honorários periciais e nome dos arquivos — não estão escritos nesta skill: ficam em `docs/configuracao-unidade.md`, na pasta do projeto. As regras de elaboração, os endereços e campos do PJe 1º grau e do Jurisdição Delegada do TRF5, os assuntos fixos do JD, os dados da DPU e o método do "Enviar para Assinatura" são da skill e não vêm da configuração.

1. Leia `docs/configuracao-unidade.md` no início de toda execução, antes da "Confirmação antes de iniciar".
2. Se o arquivo não existir, crie-o com o título `# Configuração da unidade`.
3. Se faltar alguma seção ou item da lista abaixo, ou houver item com o valor `PENDENTE`, **pare antes de abrir qualquer processo** e faça ao usuário as perguntas que faltam, todas de uma vez, agrupadas por seção, explicando o que é cada item. Grave as respostas no arquivo (uma seção `##` por bloco, uma linha `- <chave>: <valor>` por item; item sem resposta fica `PENDENTE`), mostre o resumo e peça o "pode seguir".
4. Seção comum (`## Comum — ...`) já preenchida por outra skill: reaproveite, sem perguntar de novo; pergunte só os itens dela que faltarem.
5. **Seção da conferência.** Como a expedição chama a `jef-conferir-rpv` num agente que não pergunta nada ao usuário, confira também, nesta etapa, a seção `## jef-conferir-rpv` (perguntas na própria `jef-conferir-rpv`, "Configuração da unidade"): faltando item, pergunte junto com os desta skill.
6. Nunca use valor que não esteja no arquivo; nunca presuma nem use os valores da 7ª Vara Federal da Paraíba ou de outra unidade. Se, no meio da execução, faltar um dado, pare e pergunte.

No texto desta skill, `<seção>.<chave>` indica o item da configuração (ex.: `Comum — Honorários periciais.valores_pericia`).

**Configuração do script.** Depois de carregar `expedir-lote-jd.js` e antes de `EX.autoriza`, monte o objeto a partir do arquivo e chame

`EX.config({ reembolso: { cnpj: '<Comum — Unidade.secao_judiciaria_cnpj>', nome: '<Comum — Unidade.secao_judiciaria_razao_social>' } })`

com os valores copiados do arquivo, tal como gravados. Sem essa chamada (ou com CNPJ fora do formato `00.000.000/0000-00`), `EX.autoriza` devolve "PAROU: configure EX.config(...) antes de iniciar" e não autoriza nada. A chamada é refeita sempre que o script for carregado de novo. O script de leitura do PJe (`analise-lote-pje.js`, da `jef-conferir-rpv`) não recebe configuração.

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

**`## jef-expedir-rpv`**

| Chave | Pergunta | Exemplo (fictício) |
|---|---|---|
| `fase_elaborar_rpv` | Qual o nome da fase (tarefa) do PJe em que ficam os processos com requisição a elaborar (a do CSV exportado)? | `[JEF] Requisição - Elaborar` |
| `prefixo_arquivos` | Com que nome começam os arquivos de andamento e de relatório desta skill, na pasta `Relatórios/`? Tem de ser diferente do `jef-conferir-rpv.prefixo_arquivos`. | `Exp_RPV` |

**`## jef-conferir-rpv`** — `fase_elaborar_comunicacao` e `prefixo_arquivos` (perguntas na `jef-conferir-rpv`).

## Acesso — Chrome ou Edge (extensão), PJe e Jurisdição Delegada

Os dois sistemas são acessados sempre pela extensão Claude, no **Chrome ou no Edge** — o navegador real do usuário, um navegador por sessão (ver "Sessões em paralelo") —, nunca pelo navegador embutido do Claude Code. Uma janela, uma aba fixa para cada sistema, no grupo de abas da extensão; nunca navegue a aba do PJe para o JD, nem o contrário.

**Login no JD (testado):** a sessão fica presa à aba em que o login foi feito. O usuário deve fazer o login **dentro do grupo de abas da extensão**. **Nunca digite endereço de página interna do JD na barra de endereço** (o sistema devolve 403): as telas são abertas pelo menu, pelo script (que lê o endereço da própria definição do menu) ou pelos botões do sistema.

## Entrada — CSV ou lista de processos na conversa

As duas formas valem:

**A) CSV da tarefa configurada em `jef-expedir-rpv.fase_elaborar_rpv`.** Só o CSV fornecido junto com este pedido; nunca um CSV anterior da conversa. Separador `;`, encoding `utf-8-sig`, campo `numeroProcesso`.

**B) Lista de processos informada na conversa.**

Sem CSV e sem lista neste pedido, peça antes de começar.

## Confirmação antes de iniciar — parada obrigatória

Antes de abrir qualquer processo, confirme com o usuário:
- quantos processos e a lista completa dos números — **essa é a lista autorizada** para Gravar e Enviar para Conferência nesta execução;
- que o PJe e o JD estão abertos e autenticados, cada um na sua aba do grupo;
- o **valor do salário mínimo vigente**, para o limite de 60 salários mínimos da RPV, **conferido pela própria skill em fonte oficial** (decreto que fixa o salário mínimo, no Portal da Legislação do Planalto ou no Diário Oficial da União; ou página do governo federal em gov.br que o cite), a cada execução, e informado nesta confirmação com a fonte — **não é perguntado ao usuário** (decisão do usuário, 13/10/2026). Nunca de memória. Registre no arquivo de andamento a linha `S|<valor>|<limite de 60 SM>|<ato normativo e endereço consultado>|<data da consulta>`. Não achando fonte oficial clara, ou havendo fontes divergentes, pergunte ao usuário (regra 3);
- que a conferência independente (`jef-conferir-rpv`) só começa depois de expedidas todas as RPVs dos processos informados (e respondidas as dúvidas), uma única vez para a lista inteira, com um único relatório ao final, executada por um agente separado nas requisições elaboradas, com MARCAR TODOS COMO LIDOS no PJe, e que o "Enviar para Assinatura" continua dependendo da confirmação dele para a lista;
- estimativa de esforço: será medida na primeira execução real; conte vários minutos por processo, somando a leitura do PJe, a elaboração no JD e a conferência;
- o **identificador da sessão** e a checagem de listas sobrepostas (ver "Sessões em paralelo", abaixo).

Só comece com o "pode seguir" do usuário.

## Sessões em paralelo — identificador da sessão e listas sem processo em comum

A rotina foi pensada para rodar em duas (ou mais) sessões do Claude Code ao mesmo tempo, cada uma com a sua lista (decisão do usuário, 15/10/2026). **Testado em 15/10/2026: no mesmo navegador, o login do JD numa sessão derruba o da outra; em navegadores diferentes (Chrome e Edge, cada um com a extensão Claude), os dois logins convivem.** Por isso, **cada sessão roda num navegador diferente**; duas sessões no mesmo navegador nunca usam o JD ao mesmo tempo. O identificador da sessão e a trava de listas (itens 1 e 2) continuam valendo.

1. **Identificador da sessão.** Toda execução tem um identificador, uma letra (`A`, `B`, `C`...), que entra no nome de **todos** os seus arquivos: `Relatórios/<EXP>_AAAA-MM-DD_<ID>_andamento.txt`, `Relatórios/<EXP>_AAAA-MM-DD_<ID>.xlsx`, `Relatórios/<CONF>_AAAA-MM-DD_<ID>_andamento.txt` e `Relatórios/<CONF>_AAAA-MM-DD_<ID>.xlsx` (`<EXP>` = `jef-expedir-rpv.prefixo_arquivos`; `<CONF>` = `jef-conferir-rpv.prefixo_arquivos`; nesta skill, sempre com esse sentido). Use a letra que o usuário informar; sem informação, use a primeira letra ainda não usada por nenhum arquivo `<EXP>_AAAA-MM-DD_*` do dia e informe-a na confirmação. Nunca grave em arquivo de outra sessão.
2. **Listas sem processo em comum — trava.** Antes da confirmação, leia as linhas `L` de todos os andamentos `<EXP>_AAAA-MM-DD_*` do dia que não sejam desta sessão. Processo da lista atual que já esteja na lista de outra sessão **não entra nesta execução**: retire-o da lista autorizada e informe ao usuário qual é e em que sessão está. Duas sessões no mesmo processo poderiam criar a mesma requisição em duplicidade, porque a checagem de duplicidade é feita antes de cada criação. A conferência continua proibida de abrir arquivos `<EXP>_*`; a leitura desta trava é só da expedição.
3. **Navegador, abas e login.** Cada sessão usa o seu próprio navegador e, nele, o seu grupo de abas: a aba do PJe e a aba do JD, com o login no PJe e no JD feito pelo usuário **nas abas desta sessão** (os logins de um navegador não valem no outro). Com mais de um navegador conectado, escolha o desta sessão antes de abrir as abas (`list_connected_browsers` e `select_browser`; o Edge se reconhece por `Edg/` no `navigator.userAgent`). Se o login de uma sessão derrubar o da outra (tela de login reaparecendo na outra aba), pare e informe o usuário — as sessões não devem continuar em paralelo.
4. **Limite do PJe.** As sessões usam o mesmo usuário do PJe, e o bloqueio por excesso de acessos (HTTP 429, 10 minutos) vale para todas. Havendo bloqueio, pare, informe e espere os 10 minutos antes de retomar.

## Progresso — informe a cada 20 processos

Ao completar cada múltiplo de 20 processos, poste um informe (quantos processos, quantas requisições elaboradas e enviadas para conferência, quantas não elaboradas, quantos AVISOS e dúvidas) e **continue imediatamente**, sem esperar resposta. Use a ferramenta de mensagem ao usuário, se houver; senão, texto normal da resposta. Se a execução terminar sem esses informes, diga isso no relato final.

## Que requisições cada processo gera

Para cada processo, a partir dos autos, identifique as requisições devidas:

1. **Parte autora** — valor da planilha de cálculo (ou da proposta de acordo), com **destaque de honorários contratuais dentro dela** quando houver contrato e pedido expresso de destaque (ver "Destaque").
2. **Honorários sucumbenciais** — quando o acórdão fixou honorários de sucumbência e a planilha traz o valor.
3. **Reembolso de perícia** — quando houver ofício de pagamento de perito (ou certidão de pagamento pelo AJG) no processo.
4. **Multa** — **não é elaborada por ora** (decisão do usuário). Havendo multa liquidada: AVISO "multa não elaborada", e **nenhuma requisição do processo é elaborada** (regra do processo, abaixo).

### Regra do processo — um problema numa requisição trava as demais do mesmo processo

Regra do usuário (13/10/2026): **se houver problema em uma requisição, gera-se AVISO e as demais requisições do mesmo processo não são elaboradas.** O processo vai inteiro para "Não elaboradas", com o motivo. Os outros processos do lote seguem normalmente.

"Problema" é qualquer AVISO ou dúvida (linha `Q`) que impeça a elaboração de uma das requisições do processo — inclusive representante não cadastrado no PJe, multa liquidada, duplicidade de um só tipo e precatório. Por isso, **todas as requisições do processo são analisadas e decididas antes da Etapa 1 da primeira delas**; só se nenhuma tiver problema, o processo é elaborado.

**Exceção — problema do escritório:** o nome do escritório na base do JD sem relação com o do processo para o mesmo CNPJ (nome que só acrescenta, abrevia ou varia o do processo não é problema — ver "Sociedade de advogados"), ou o escritório fora da base do JD, só aparece durante a elaboração (no "Novo" da Etapa 3, com a requisição já criada). Nesse caso, aquela requisição fica parada, com AVISO (linha `I`), e **as demais requisições do processo podem ser elaboradas**.

Se a elaboração de uma requisição parar por outro motivo (mensagem inesperada do JD, erro do script), as requisições do processo ainda não elaboradas não são feitas; as que já foram enviadas para conferência ficam como estão (nada é desfeito) e são relatadas.

**Não elaborar e AVISAR** (e, pela regra do processo, não elaborar nenhuma requisição do processo):
- **duplicidade:** já existe no JD requisição do mesmo tipo para o processo, em qualquer situação (ver "Duplicidade");
- **requisitório complementar ou suplementar** (pedido de complementação, diferença de requisitório já pago, etc.);
- **precatório:** valor da requisição acima de 60 salários mínimos vigentes — o precatório fica para depois (decisão do usuário); informe e não elabore;
- **destaque em forma que não seja percentual** (valor fixo, honorários por êxito em valor, etc.);
- qualquer situação não prevista nesta skill (habilitação de herdeiros, cessão do crédito da parte autora — que precisa de decisão que a defira —, autor falecido, ordem judicial especial etc.): descreva no AVISO. A cessão dos honorários contratuais não está aqui: ver "Destaque".

O movimento "REQUISIÇÃO DE PAGAMENTO DE PEQUENO [VALOR] PREPARADA PARA ENVIO" no PJe é lançado sempre que o processo entra na fase configurada em `jef-expedir-rpv.fase_elaborar_rpv` (convenção com o sistema Cassandra). **Não indica RPV expedida.**

## Leitura do PJe — script `analise-lote-pje.js` da `jef-conferir-rpv`

A leitura usa o mesmo script da conferência, sem cópia: `.claude/skills/jef-conferir-rpv/analise-lote-pje.js` (`window.__CR`). Carregue-o tal como está gravado, pelo método de upload descrito na `jef-conferir-rpv` (seção "Execução em lote"), na página estática `https://pje1g.trf5.jus.br/pje/js/pdfjs/web/locale/locale.json`, e use `CR.inicia(lista, base)`, `CR.estado()`, `CR.mostra(a, b)` + `get_page_text`, `CR.lista`, `CR.busca`, `CR.textos`, e `CR.img` / `CR.render` para documento digitalizado (em aba visível). **Nunca chame `CR.marca`** nesta skill.

As linhas do script apontam onde está cada dado (`CALC-JEF`, `CALC?`, `ACO`, `EV`, `DST`, `CTR`, `PROC`, `NOM`, `OF`, `AJG`, `MUL`, `REPR?`, `ANALF?`, `SCAN`…). **O valor, o percentual e a data lançados saem sempre do teor do documento**, lido por inteiro na parte que interessa, nunca da linha-resumo. Documento digitalizado é lido visualmente.

## Dados de cada requisição

Registre, para cada dado, o **documento de origem** (ID do PJe). Esse registro vai para o arquivo de andamento (linha `D`).

### Dados comuns

- **Número do processo:** o da lista.
- **Data de ajuizamento:** a que o Cassandra importa. Se vier vazia, pergunte (regra 3).
- **Trânsito em julgado da sentença ou acórdão:** a data da **certidão de trânsito** do processo (no acordo, a certidão de trânsito da homologação). Se o Cassandra trouxer data diferente da certidão, vale a certidão, e a diferença é registrada. Nos processos com recurso, o Cassandra costuma trazer o trânsito vazio.
  - **Sem certidão de trânsito localizada, ou com dúvida sobre o trânsito (usuário, 06/11/2026):** o processo **não é elaborado**, sem perguntar; vai para "Não elaboradas" (linha `N`) com o motivo. Exemplos do lote de 06/11: certidão não localizada na leitura (cronologia irregular, muitos documentos fora dela); decisão que condiciona o pagamento; certidão de trânsito seguida de embargos de declaração ou de documentos da Turma Recursal sem par na cronologia, sem como confirmar se houve acórdão posterior.
- **Trânsito dos embargos / decurso do prazo:** o **dia útil seguinte** ao trânsito, excluídos só sábado e domingo (não considerar feriados).
- **Compensação da mora:** sempre **Selic**.
- **Restrição de pagamento:** Sem Restrição. **Multa astreintes:** Não. **Parcial, complementar e suplementar:** Não.
- **Natureza do crédito:** Alimentar para benefício previdenciário ou assistencial e para honorários de sucumbência; Comum para reembolso (o JD muda sozinho). Outra matéria: pergunte.

### 1. Parte autora

- **Beneficiário:** a parte autora do processo (nome e CPF), como importada pelo Cassandra.
- **Representante:** se o processo indicar representante da parte autora (curador, tutor, genitor de menor), ele deve vir na importação do Cassandra (o JD vincula ao autor e escreve no ofício "é representado(a) por…"). **Representante indicado no processo mas não cadastrado no PJe** (a importação não o traz): AVISO e **nenhuma requisição do processo é elaborada**, nem o reembolso (regra do processo; decisão do usuário de 13/10/2026). Confira o polo ativo no PJe antes da Etapa 1: o Cassandra só importa o representante cadastrado no PJe.
  - **Dúvida sobre a representação ou a curatela (usuário, 06/11/2026):** o processo **não é elaborado**, sem perguntar (linha `N`, com o motivo). Exemplos do lote de 06/11: curador especial no polo, com despachos dizendo não haver interdição nem curador regular; contrato de honorários assinado pelo próprio autor, que tem ação de curatela ou interdição em curso e representante no polo; tutela ou representação de menor a conferir.
- **Valor:** o do cálculo, com **principal e Selic (e juros, se houver) separados, como na tabela**. Mais de um cálculo: siga as regras da `jef-conferir-rpv` (Conferência 2, "Mais de um cálculo"); não sendo possível dizer qual vale, pergunte. **Acordo:** vale o valor da **proposta de acordo** do INSS; se ele diferir do total da tabela que a acompanha, pergunte. **Planilha do setor de cálculo (Contadoria) juntada depois da proposta** (regra do usuário, 06/11/2026): é a atualização do valor da proposta e serve de base para a requisição, no valor e na data-base (a data da planilha), sem perguntar. **Acordo só com a proposta do INSS, sem planilha da Contadoria e sem a composição do valor (principal, Selic e NM por exercício) legível no texto nem na leitura visual da tabela** (usuário, 06/11/2026): o processo **não é elaborado**, sem perguntar (linha `N`, motivo "acordo do INSS sem planilha da Contadoria"). Composição legível pela imagem da tabela ou da ata: elabore normalmente.
- **NM (número de meses e valor por exercício):** o do cálculo (exercícios anteriores e exercício corrente). Cálculo sem NM: pergunte.
  - **Cálculo só com exercício corrente (usuário, 06/11/2026):** o JD não grava sem o NM de exercícios anteriores ou o campo "Motivo do não preenchimento" (`ds_motivo_nao_preenchimento_nr_mes`), e não aceita 0 no NM anterior. Preencha o motivo com `DIB = ano corrente`, e o **NM corrente tem de constar** no ofício. Digitar o motivo apaga o NM já lançado: use `EX.etapa4({..., pausa: true})`, anote o NM corrente da tela, preencha o motivo, lance de novo o NM corrente, confira os três campos e então `EX.grava4(total)`. No ofício, confira "Motivo do não Preenchimento de NM" e "NM Exercício Corrente"; NM corrente em branco é divergência (não envie para conferência).
  - **Salário-maternidade (usuário, 26/10/2026):** NM = **4 meses no exercício corrente** (ano atual), com o valor da parte autora todo no corrente e nada em exercícios anteriores. Fluxo testado em 06/11/2026: os campos de NM foram achados na Etapa 4, e o lançamento segue o item "Cálculo só com exercício corrente" (motivo `DIB = ano corrente` e NM corrente 4 com o valor todo). Não é mais preciso parar antes do "Gravar".
- **Parte autora assistida pela Defensoria Pública da União (usuário, 26/10/2026):** o JD exige advogado na Etapa 3. Quando a parte autora não tiver advogado e for assistida pela DPU, cadastre a DPU como advogado pelo "Novo" → **Escritório Advocatício**, com estes dados:
  - CNPJ **00.375.114/0001-16**;
  - nome **DEFENSORIA PUBLICA DA UNIAO**;
  - endereço **RUA COSTA BARROS**, complemento em branco, bairro **ALDEOTA**;
  - UF **Ceará**, município **Fortaleza**, CEP **60035-000**.

  Sem destaque, a forma do honorário fica "Real". Se a base do JD trouxer, para esse CNPJ, dados diferentes destes, pare e mostre ao usuário. Na primeira requisição com a DPU, pare antes do "Continuar" da Etapa 3 e mostre a tela ao usuário. Sucumbência em favor da DPU continua sendo decisão do usuário a cada lote: pergunte.
- **Parte autora sem advogado cadastrado no PJe e sem indicação de DPU** (usuário, 06/11/2026): o processo **não é elaborado**, sem perguntar (linha `N`, com o motivo), porque o JD exige advogado na Etapa 3.
- **Data-base:**
  - planilha da Contadoria (ou outro cálculo do juízo/da parte) → a **data da planilha** (em que foi datada ou assinada);
  - cálculo apresentado **pelo INSS** (ex.: tabela da proposta de acordo): juntada **no próprio mês de referência** → **data da juntada**; juntada **em mês posterior** → **último dia do mês de referência** (referência 07/2026, juntada 03/08/2026 → 31/07/2026);
  - acordo com planilha da Contadoria juntada depois da proposta → a **data da planilha da Contadoria** (06/11/2026).
- **Assunto:** o importado do PJe ("Utilizar Assuntos Importados = Sim"); sem assunto importado: pergunte.

### 2. Destaque de honorários contratuais (dentro da RPV da parte autora)

- **Só com contrato de honorários no processo e pedido expresso de destaque.** Contrato sem pedido de destaque: a RPV sai **sem** destaque (forma "Real"), e isso está certo. Isso vale também quando há contrato juntado e o pedido não é localizado (decisão do usuário, 06/11/2026): não é dúvida, e o processo é elaborado sem destaque. Antes de concluir que não há pedido, leia a seção dos pedidos da petição inicial e as petições posteriores, porque o pedido feito na inicial é pedido expresso. Pedido de destaque sem contrato: AVISO e nenhuma requisição do processo é elaborada (regra do processo).
- **Limite absoluto — regra que nunca pode ser quebrada (usuário, 16/10/2026):** em nenhuma hipótese o destaque de honorários pode ser superior a **30% do valor a ser recebido pela parte autora**, independentemente do previsto no contrato (parte fixa, honorário mínimo, salários de benefício, parcelas vincendas ou qualquer outra cláusula). O que o contrato prever além disso nunca entra no destaque.
- **Forma: "Percentual"**, com o percentual do contrato. Percentual acima de **30%**, divergência entre o percentual pedido e o do contrato, ou forma não percentual: AVISO e nenhuma requisição do processo é elaborada.
- **Contrato com impressão digital** da parte autora (no contrato ou na procuração): exige assinatura **a rogo** e de **duas testemunhas**; faltando, ou na dúvida, AVISO e nenhuma requisição do processo é elaborada. Se a própria parte autora assinou, ainda que analfabeta, não se exige nada disso. **Procuração pública** (regra do usuário, 06/11/2026): contrato ou cláusula de honorários lavrados em procuração pública (escritura em cartório) suprem a assinatura a rogo e as duas testemunhas, ainda que haja impressão digital — destaque sem perguntar, com as demais regras desta seção.
- **Assinatura da parte autora no contrato digitalizado:** antes de concluir que falta a assinatura da parte autora, veja cada página do contrato inteira, até o fim (`CR.desliza` até a altura informada por `CR.img` ou `CR.render`), e todas as páginas. A assinatura costuma estar na linha "CONTRATANTE", abaixo da do advogado. Nome da parte autora manuscrito na linha do contratante é assinatura, ainda que a letra se pareça com a do preenchimento do cabeçalho (não se faz exame grafotécnico): destaque sem perguntar, com as demais regras desta seção.
- **Decisão sobre o pedido de destaque prevalece**: decisão, despacho ou ato ordinatório (inclusive "de ordem verbal") que decida o pedido de destaque — deferindo, deferindo em parte ou indeferindo — prevalece sobre o pedido: o destaque sai conforme a decisão, sem perguntar. Procure-a também nos documentos juntados com o título "Intimação" (linha `DEC … «ATO NA INTIMAÇÃO»` do leitor v11). Ex.: pedido que divide os 30% entre dois advogados e ato que defere o destaque só ao advogado do contrato: todo o destaque sai para ele.
- **Destaque indeferido por vício do contrato e novo contrato juntado depois** (regra do usuário, 06/11/2026): não é preciso nova decisão. A secretaria faz o destaque de ordem verbal do juiz: novo contrato válido (pelas regras desta seção) → destaque, sem perguntar; novo contrato com vício, ou na dúvida → AVISO e nenhuma requisição do processo é elaborada.
- **Beneficiário do destaque:** o indicado no pedido. **Sem pedido expresso em contrário, a sucumbência (caso existente) e o destaque vão para o mesmo beneficiário** (regra padronizada pelo usuário em 13/10/2026). A sociedade de advogados (CNPJ) é a beneficiária quando consta entre os contratados e o pedido não diz em nome de quem sai. Respostas do usuário no lote de 06/11/2026, que valem para as próximas requisições, sem perguntar:
  - **Advogado pessoa física:** pedido de destaque em favor do advogado pessoa física, com contrato ou cláusula de honorários na procuração em nome dele e sem sociedade contratada → o destaque sai para a **pessoa física**.
  - **Pedido em nome do advogado, contrato com a sociedade:** pedido "em favor da advogada", mas contrato ou procuração outorgados a ela como representante da sua sociedade (ex.: sociedade individual de advocacia, com CNPJ) → o destaque sai para a **sociedade**.
  - **Pedido em favor da sociedade, contrato com advogados pessoas físicas:** a sociedade de advogados não precisa figurar no contrato de honorários nem na procuração. Pedido de destaque feito pelos advogados da parte autora em favor de uma sociedade de advogados → o destaque sai para a **sociedade indicada no pedido**, sem perguntar, com as demais regras desta seção (contrato, percentual, limite de 30%, CNPJ na base do JD). Ex.: contrato com três advogados pessoas físicas e pedido de destaque em favor da sociedade da qual eles fazem parte.
  - **Dois ou mais advogados pessoas físicas, sem sociedade:** o destaque sai para as **pessoas físicas, dividido entre elas** — pela divisão que o pedido fizer (ex.: 15% para cada) ou, sem divisão no pedido (ex.: "pagamento direto aos advogados constituídos"), em partes iguais do percentual. Só entram os advogados contratados. Ver a técnica em "Elaboração no JD".
- **Cessão dos honorários contratuais a terceiro — sem decisão (usuário, 23/10/2026):** quando o advogado ou o escritório titular do destaque cede os honorários contratuais a terceiro (ex.: empresa de antecipação de honorários) e junta o contrato de cessão aos autos, **não é necessária decisão que homologue a cessão**: a própria secretaria faz o destaque de ordem do juiz, em favor da cessionária. Vale quando o contrato de cessão tem como cedente o titular do destaque e inclui os honorários deste processo; a cessionária é a do contrato ou da petição que o junta. As demais regras do destaque (contrato de honorários, pedido, percentual e limite de 30%) continuam valendo. Registre na linha `D` o cedente, a cessionária e os documentos da cessão. **Ressalva:** a dispensa vale só para os honorários contratuais; a cessão do crédito da parte autora precisa de decisão que a defira (ver "Não elaborar e AVISAR"). O cadastro da cessionária no JD (que não é escritório advocatício) é fluxo ainda não testado — na primeira vez, pare antes do "Continuar" da Etapa 3 e mostre ao usuário.
- **Sociedade de advogados:** é cadastrada pelo CNPJ ("Novo" → Escritório Advocatício).
  - CNPJ já na base do JD: **mantenha os dados da base**, ainda que o endereço difira do processo. Nome da base diferente do nome no processo, para o mesmo CNPJ, **não trava** quando os dois designam a mesma sociedade — o nome da base acrescenta, abrevia ou varia o do processo, mantendo os nomes que a identificam (regra geral do usuário, 15/10/2026; ex.: "SOCIEDADE INDIVIDUAL FULANO DE TAL" no contrato e "SOCIEDADE INDIVIDUAL FULANO DE TAL E SICRANO" na base, com o mesmo CNPJ): conclua com os dados da base e registre os dois nomes na linha `D`/`E`. A **única trava** é o nome da base **sem relação** com o do escritório no processo para aquele CNPJ: AVISO e não concluir a requisição; as demais requisições do processo podem ser elaboradas (exceção da regra do processo). A mesma regra vale na conferência (`jef-conferir-rpv`).
  - CNPJ fora da base do JD **e sem endereço no processo**: AVISO e não concluir a requisição; as demais do processo podem ser elaboradas (mesma exceção). Fora da base **com** endereço no processo (cartão CNPJ): fluxo ainda não testado — pare e pergunte ao usuário.
- **NM com destaque:** o JD exige que os valores por exercício somem o valor **líquido** da parte autora. Aplique o percentual líquido (ex.: 70%) ao valor de cada exercício e ajuste os centavos no **exercício corrente**; o número de meses não muda. Com um só exercício, ele recebe todo o líquido. (O script faz essa conta.)
- Destaque para **advogado pessoa física** (em vez de sociedade): fluxo testado no lote de 06/11/2026, com as requisições conferidas sem AVISO. Não é mais preciso parar antes do "Continuar" da Etapa 3.
- **Dúvida sobre o contrato ou o pedido de destaque que as regras desta seção não resolvem** (usuário, 06/11/2026): o processo **não é elaborado**, sem perguntar (linha `N`, com o motivo). Exemplos do lote de 06/11:
  - habilitação de cessionária por cessão de honorários, com contrato de cessão "sem destaque";
  - contrato sem data e com a qualificação do contratante em branco;
  - inicial que menciona percentual e petição posterior que pede a RPV só para a parte autora, sem contrato localizado;
  - contrato de parte autora analfabeta em que não se consegue verificar a assinatura a rogo e as testemunhas;
  - contrato que traz outra pessoa como contratante;
  - contrato de honorários de outra ação (ex.: interdição) com percentual diferente do pedido.

### 3. Honorários sucumbenciais

- **Só se o acórdão fixou honorários de sucumbência.** O pedido do INSS de "não condenação em honorários" (Tema 1190 do STJ), sem decisão, **não impede** a RPV da sucumbência fixada no acórdão transitado.
- **Valor:** o da planilha de cálculo (em regra, 10% do valor devido à parte autora), com principal e Selic separados. Percentual da planilha diferente do fixado no acórdão, ou valor que não conste da planilha: AVISO e nenhuma requisição do processo é elaborada.
- **Beneficiário:** o indicado no pedido; sem indicação, o mesmo do destaque; a sociedade (CNPJ) quando consta entre os contratados. Sem sociedade e sem indicação, com mais de um advogado: pergunte. Sucumbência para advogado pessoa física: fluxo ainda não testado — na primeira vez, pare antes do "Gravar" e mostre ao usuário.
- **Data-base:** a mesma da planilha (como na parte autora).
- No JD: "Crédito somente advogado (Sucumbência) = Sim", "Valor = Valor Sucumbência", natureza alimentar. O assunto vem fixo (08.01.14.01).

### 4. Reembolso de perícia

- **Considere só os ofícios de pagamento** (e a certidão "CERTIFICO que solicitei, através do sistema AJG, o pagamento da perícia realizada…"). Texto de acordo ou de sentença sobre perícia é desconsiderado.
- **Valor:** o "valor requerido" de cada ofício de pagamento; a certidão do AJG vale sempre o de `Comum — Honorários periciais.valor_certidao_ajg`. Mais de uma perícia: some. Valores possíveis: os **valores aceitos no reembolso** da configuração (cada valor de uma perícia e a soma de dois deles); fora disso, pergunte. **Perícia in loco** (regra do usuário, 06/11/2026): ofício de pagamento no valor de `Comum — Honorários periciais.valor_pericia_in_loco` → expeça a RPV desse valor, sem perguntar.
- **Perícias × pagamentos:** compare as certidões de nomeação com os comprovantes de pagamento, pelo teor (perícias distintas, não documentos). **Duas ou mais nomeações do mesmo perito com um só ofício = uma só perícia devida.** Peritos diferentes com pagamento faltando: AVISO e nenhuma requisição do processo é elaborada.
- **Certidão do AJG sem o nome do perito, anterior a ofícios de pagamento de peritos do mesmo processo** (usuário, 06/11/2026): não é perícia a mais. O reembolso conta só os ofícios. Ex.: certidão do AJG e, meses depois, ofícios de dois peritos: duas perícias, com a soma dos dois ofícios e a data-base do último ofício. Se a certidão identificar perito sem ofício próprio, a regra não se aplica: siga as demais regras desta seção.
- **Data-base:** a data em "Nesta data foi solicitado pagamento para o profissional", no ofício (na certidão do AJG, a data da certidão); mais de uma perícia, a **última**.
- No JD: "Reembolso a Seção Judiciária = Sim" (natureza passa a Comum). O JD inclui sozinho a beneficiária — a seção judiciária, com o nome e o CNPJ de `Comum — Unidade.secao_judiciaria_razao_social` e `.secao_judiciaria_cnpj` — e o INSS, fixa o assunto (08.01.05) e preenche a justificativa "RPV de reembolso". Só o valor principal; não há NM.

## Duplicidade — antes de elaborar cada processo

Com `await EX.dup(<processo>)`, liste as requisições do processo no Painel do JD em todas as situações (Em Elaboração, Em Conferência, Aguardando Assinatura, Assinada, Autuada no TRF, Paga, Devolvida, Cancelada, Rejeitada pelo TRF). É só leitura: o script busca a lista por consulta e nunca envia o formulário do Painel.

Existindo requisição do mesmo tipo (pelo assunto e pelo beneficiário), em qualquer situação: **AVISO de duplicidade e nenhuma requisição do processo é elaborada**, ainda que faltem outros tipos (regra do processo).

## Elaboração no JD — script `expedir-lote-jd.js`

O script fica nesta pasta (`window.__EX`, também `EX`). Carregue-o tal como está gravado, nunca reescrito de memória: crie pelo javascript_tool, na **janela de cima** da aba do JD (`menu.wsp`), um `<input type="file">` que, ao receber o arquivo, o execute (`(0, eval)(await input.files[0].text())`), e envie o arquivo com o file_upload do Chrome. Em seguida, `EX.config(...)` com os dados da unidade (ver "Configuração da unidade — antes de tudo") e `EX.autoriza(<lista confirmada>)`.

**Quem decide os dados sou eu, pelas regras desta skill; o script só preenche o que recebe e confere o que o JD devolveu.** Cada função devolve `ok: true` ou `parou: <motivo>`, e para diante de qualquer coisa fora do esperado — inclusive qualquer confirmação ou alerta do JD que não seja o esperado naquele passo (o script responde "não" e registra). Diante de `parou`, não force: leia o motivo, confira a tela e, na dúvida, pergunte.

Confirmações do JD aceitas pelo script (todas as demais recebem "não"):
1. Etapa 1, ao sair do campo do processo: "Foram encontrados dados processuais oriundos do PJe. Deseja importá-los?" — **só a primeira vez** (o campo dispara de novo a cada saída).
2. Etapa 4, no "Gravar": "AVISO * Valor do requisitório (R$) : <total exato decidido> Confirmar Operação?".
3. Etapa 4, no "Gravar": "ATENÇÃO: Ao confirmar a gravação dos valores das partes, as partes que não tiverem valores preenchidos, com exceção dos advogados, serão excluídos da relação desta RPV/PRC. Confirma a gravação?".
4. No ofício: "Confirma o envio para conferência?".

Passos de cada requisição (uma por vez):

1. `await EX.cadastrar()` — abre RPV/PRC → Cadastrar no frame `principal`.
2. `await EX.etapa1({ num, tipo, dataBase, transito, embargos, ajuizamento?, natureza? })` — `tipo` é `autora`, `sucumbencia` ou `reembolso`. Preenche, aceita a importação do Cassandra uma vez, confere todos os campos e clica em "Continuar", que **cria a requisição**. Devolve o nº e o id, e o que o Cassandra trouxe (registre a diferença de trânsito, se houver).
3. `await EX.etapa2(tipo)` — confere o assunto (importado na parte autora; fixo na sucumbência e no reembolso) e clica em "Continuar".
4. `await EX.etapa3({ tipo, autorCpf, representante?, escritorio?: { cnpj, nome }, destaque?: { nome, pct: '30,00' } })` — grava as partes importadas do PJe ("Adicionar Parte"; confere autor, advogado e representante), cadastra a sociedade pelo CNPJ ("Novo" → Escritório Advocatício; confere o nome da base com o do processo), marca a forma do honorário (Real sem destaque; Percentual com o % só para o beneficiário do destaque) e clica em "Continuar". No reembolso, só confere que a beneficiária configurada (pelo CNPJ de `EX.config`) está nas partes e continua.
5. `await EX.etapa4({ tipo, dataBase, total, nomeBenef, principal, juros?, selic?, pctDestaque?, nm?: { ant: { meses, valor }, cor: { meses, valor } } })` — `nomeBenef` é o autor, o beneficiário da sucumbência ou, no reembolso, a razão social configurada em `Comum — Unidade.secao_judiciaria_razao_social`; `total` é o valor total da requisição; `nm` traz os valores **brutos** do cálculo por exercício. Confere a data-base e a mora Selic, lança os valores, confere que a soma na tela é o total, lança o NM (com destaque, o líquido por exercício, centavos no corrente) e clica em "Gravar", aceitando só as duas confirmações esperadas, com o valor exato.
6. `await EX.oficio()` — abre o ofício no próprio frame (nunca no pop-up) e devolve os dados lidos. **Confira o ofício** contra os dados decididos: processo, tipo, natureza, beneficiários e valores (principal, Selic, destaque), total, NM, data-base, ajuizamento, trânsitos, assunto, "Crédito somente advogado" e observações (representante). Divergência: não envie; registre e pergunte.
7. `await EX.conferencia(nr, total)` — confere de novo situação "Em Elaboração", nº e total, clica em "Enviar para Conferência" (botão `#btn_conferir`, `onclick` com o id e o nº da requisição), aceita a confirmação e confere a situação "Em Conferência".
8. Grave no arquivo de andamento a linha `E` antes de passar à requisição seguinte. Ao fim do processo, `await EX.sai()` tira o frame do espelho (que tem "Enviar para Assinatura", "Devolver" e "Cancelar") e abre a tela Consultar.

**Destaque para advogado pessoa física e destaque dividido (técnica usada no lote de 06/11/2026).**
- **Um advogado pessoa física:** `EX.etapa3({ tipo: 'autora', autorCpf, destaque: { nome: <nome do advogado como importado do PJe>, pct: '30,00' } })`, sem `escritorio`, e `EX.etapa4` com `pctDestaque` igual ao percentual.
- **Dois advogados:**
  1. `EX.etapa3` com `destaque: { nome: <1º advogado>, pct: <parte dele, ex. '15,00'> }` e `pausa: true`.
  2. No frame da Etapa 3, lance a parte do 2º advogado no campo `tmp.rpv.percent_adv[...]` da linha dele, achada pelo nome, e dispare `input` e `change`. Confira os percentuais de todas as linhas.
  3. `EX.continua3()`.
  4. `EX.etapa4` com `pctDestaque` igual à soma (ex.: 30).
- **No ofício:** confira o valor contratual de cada advogado.

**Requisição criada e não concluída.** A requisição nasce no "Continuar" da Etapa 1. Se um passo posterior parar (escritório fora da base, nome sem relação com o do processo, representante ausente, mensagem inesperada), a requisição fica "Em Elaboração". **Nunca a cancele nem a exclua**: registre-a na linha `I` (nº, situação, motivo) e no relatório, para tratamento humano. Para reduzir esse risco, todos os dados e travas que dependem só dos autos são decididos **antes** da Etapa 1.

**Numeração.** A numeração do JD é compartilhada com os demais usuários: leia sempre o nº na tela; nunca o preveja.

**Interrupção.** Se a sessão do JD expirar ou a aba recarregar (`window.__EX` some), peça o login se for o caso, carregue o script de novo, chame `EX.config` com os dados da unidade e `EX.autoriza` com a mesma lista e confira no Painel (`EX.dup`) o que já foi criado antes de continuar. Retome só as requisições sem linha `E`, `I` ou `N` no arquivo de andamento.

## Requisição devolvida — refazer pela tela "Não Concluídas"

Autorização do usuário (16/10/2026), depois de teste acompanhado em quatro requisições, uma delas com troca do beneficiário do destaque. Quando o usuário **devolver** uma requisição no JD (situação "Devolvida") e pedir que ela seja refeita — por exemplo, destaque pedido e não feito, ou destaque em nome do beneficiário errado —, a skill pode reabri-la pela tela "Não Concluídas". É a única exceção à proibição dessa tela. Quem devolve é sempre o usuário: a skill continua proibida de clicar em "Devolver".

**Trava.** Só as requisições devolvidas que o usuário listar, **pelo número**, nesta execução (`EX.autorizaDevolvidas([...])`), de processos que ele também tenha fornecido (`EX.autoriza`). Na "Não Concluídas", cada linha tem três links — abrir (tela_1), imprimir e **excluir**: o script só usa o de abrir, e só na linha da requisição autorizada. A tela mostra requisições de outros processos e de outros usuários: nunca mexa nelas. Nunca "Cancelar", nunca excluir.

**Antes de abrir**, confira de novo nos autos os dados da correção (pedido, contrato, percentual, beneficiário, assinatura, digital/rogo), com todas as regras desta skill — inclusive o limite absoluto de 30% e a base do JD para o CNPJ da sociedade —, e grave a linha `D` (com "(Devolvida)" no tipo). O que não muda (valor, NM bruto, data-base, trânsitos) é o da requisição original, conferido com a linha `D` dela e com a Etapa 1 que se abre; divergência: pergunte.

Passos (uma requisição por vez):

1. `await EX.devolvidas()` — abre a "Não Concluídas" pelo menu e lista as linhas (só leitura).
2. `await EX.abreDevolvida(nr)` — abre a requisição pelo link da linha, confere nº e processo e devolve os campos da Etapa 1 já gravados (data-base, trânsito, embargos...).
3. `await EX.continua1(nr)` — "Continuar" da Etapa 1 **sem alterar nenhum campo** (qualquer confirmação recebe "não"). O campo "Houve destaque de honorários contratuais" fica em "Não": ele é para destaque feito em outro requisitório.
4. `await EX.etapa2('autora')`.
5. `await EX.etapa3({ tipo: 'autora', autorCpf, escritorio?, destaque: { nome, pct: '30,00', zeraOutros? }, pausa: true })` — `autorCpf` é o que está na tela, conferido com os autos (as partes já estão lá, e o script só inclui o que faltar: a sociedade pelo CNPJ, no "Novo"). Marca a forma Percentual com 30,00 para o beneficiário. **Na troca do beneficiário do destaque**, `zeraOutros: true` leva a 0,00 o percentual que estava no antigo. Confira o retorno e então `await EX.continua3()`.
6. `await EX.etapa4({ tipo: 'autora', dataBase, total, nomeBenef, principal, selic, pctDestaque: 30, nm: <valores brutos por exercício>, zeraContratual?, pausa: true })` — os valores vêm gravados, mas já repartidos (ou sem o honorário destacado): passe o **principal e a Selic brutos** e o **NM bruto** da requisição original. O script os relança — é isso que faz o JD repartir o destaque —, confere a soma, lança o NM líquido e **para antes do "Gravar"**. **Na troca do beneficiário**, o JD mantém no antigo (agora com 0,00 %) o valor contratual da gravação anterior: passe `zeraContratual: [<nome do antigo beneficiário>]`, para que ele vá a 0,00 — sem isso, o destaque sairia em dobro.
7. **Mostre a tela da Etapa 4 ao usuário e só grave com o OK dele**: `await EX.grava4(total)`, só com as duas confirmações esperadas. Assim foi no teste; a parada só deixa de ser obrigatória se o usuário a dispensar.
8. `await EX.oficio()` e confira o ofício (beneficiários, destaque, NM, total, datas). `await EX.conferencia(nr, total)`: depois do "Gravar", a requisição continua "Devolvida" até o envio, e o script aceita essa situação só para devolvida autorizada.
9. Grave a linha `E` com "(refeita após devolução)" e, ao fim, `await EX.sai()`.

Depois, a conferência independente (agente separado, com a lista de processos, com o isolamento de sempre) e o "Enviar para Assinatura" (só com a confirmação do usuário) seguem as regras desta skill.

## Arquivo de andamento — gravar à medida que sai, nunca só no final

Antes do primeiro processo, crie `Relatórios/<EXP>_AAAA-MM-DD_<ID>_andamento.txt` (`<EXP>` = `jef-expedir-rpv.prefixo_arquivos`; `<ID>` = identificador da sessão) com uma linha `L|<nº>|<processo>` por processo do lote. Grave, à medida que acontece:
- `D|<processo>|<tipo>|<beneficiário>|<valor: principal / juros / Selic / total>|<NM>|<data-base>|<trânsito>|<embargos>|<destaque: % e beneficiário>|<documentos de origem>` — os dados decididos, antes da Etapa 1;
- `E|<processo>|<tipo>|<nº da requisição>|<total>|<beneficiário>|<situação depois do envio>|<data e hora>` — requisição elaborada e enviada para conferência;
- `I|<processo>|<tipo>|<nº da requisição>|<situação>|<motivo>` — criada e não concluída;
- `N|<processo>|<tipo>|<motivo>` — não elaborada;
- `A|<processo>|<tipo>|<aviso>` — AVISO;
- `Q|<processo>|<pergunta>` — dúvida para o usuário (e, depois, `R|<processo>|<resposta do usuário>`);
- `C|<caminho do relatório da conferência>` — conferência independente concluída (uma só por execução);
- `V|<processo>|<nº das requisições, hora e situação depois do envio para assinatura>` — envio para assinatura feito, com a movimentação prescrita.

O relatório final é gerado desse arquivo, nunca da memória da conversa.

## Conferência independente — agente separado, depois de toda a expedição

Para não perder tempo rodando a conferência depois, a `jef-conferir-rpv` é executada **na mesma execução**, **por um agente separado que não vê nada do que a expedição fez** — para que ela não parta do pressuposto de que os dados lançados estão certos.

**Quando (decisão do usuário, 15/10/2026):** só depois de expedidas **todas** as RPVs dos processos informados — inclusive as dos processos liberados pelas respostas às dúvidas —, **uma única vez para a lista inteira**, nunca em rodadas. A lista passada ao agente são os processos com ao menos uma requisição enviada para conferência nesta execução (linhas `E`). A conferência gera **um único relatório ao final** (um .xlsx e um andamento), e o "Enviar para Assinatura" é pedido ao usuário uma única vez, para a lista inteira de aptas.

**Isolamento — obrigatório:**
1. Antes de chamar o agente: na aba do JD, `EX.limpa()` (apaga o script e seus registros) e `EX.sai()` antes disso; na aba do PJe, recarregue a página estática (`location.reload()`), para apagar a memória do script de leitura.
2. Chame o agente com a ferramenta de agentes (`general-purpose`), com **esforço alto** (`effort: "high"`, decisão do usuário de 06/11/2026: a conferência é a última checagem antes do pagamento; vale qualquer que seja o esforço da sessão da expedição), num contexto novo, passando **só** o texto abaixo, com a lista de **números de processo** — nunca números de requisição, valores, datas, beneficiários, decisões, AVISOS da expedição ou trechos desta conversa.
3. A conferência grava os próprios arquivos, com o identificador da sessão (`Relatórios/<CONF>_AAAA-MM-DD_<ID>_andamento.txt` e `Relatórios/<CONF>_AAAA-MM-DD_<ID>.xlsx`, com `<CONF>` = `jef-conferir-rpv.prefixo_arquivos`). Se, ainda assim, já houver arquivos com esse nome de outra execução no mesmo dia, acrescente sufixo (`_2`, `_3`...), para não misturar. Informe esses caminhos ao agente. Ela não pode abrir os arquivos da expedição.
4. O resultado da conferência **não é "corrigido" pela expedição**: AVISO da conferência é relatado ao usuário como está. Nenhuma requisição é alterada depois de enviada para conferência (alterar exigiria "Devolver", que é proibido); só a que o próprio usuário devolver pode ser refeita, pela seção "Requisição devolvida".

**Texto para o agente** (substitua só os campos entre `<>`):

> Execute a skill `jef-conferir-rpv` (leia `.claude/skills/jef-conferir-rpv/SKILL.md` e siga-a integralmente) para esta lista de processos: `<processos, um por linha>`.
> O usuário já confirmou, na conversa principal, o início desta conferência para esta lista — a parada "Confirmação antes de iniciar" está cumprida. Use a extensão Claude no `<Chrome ou Edge>` desta sessão, no grupo de abas já aberto: a aba do PJe é a `<tabId do PJe>` (página estática do PJe, recém-recarregada) e a do JD é a `<tabId do JD>` (já autenticada; a tela Consultar está no frame `principal`). Carregue os scripts da própria skill.
> Isolamento: não abra nenhum arquivo cujo nome comece com `<EXP>_` (o prefixo da expedição, escrito por extenso), não leia arquivos de memória nem transcrições de conversas, e não use a pasta `.claude/skills/jef-expedir-rpv`. Confira cada requisição só com os autos do PJe e o espelho do JD.
> Grave o andamento em `<caminho do andamento>` e o relatório em `<caminho do .xlsx>` — um único relatório para a lista inteira.
> Faça a conferência, o MARCAR TODOS COMO LIDOS e o relatório como a skill manda, mas **não clique em "Enviar para Assinatura"**: pare antes. Se aparecer tela de login ou uma dúvida que exija o usuário, pare e relate.
> Ao terminar, responda com: o caminho do relatório .xlsx e do arquivo de andamento; quantas requisições conferidas e quantas conferem integralmente; os AVISOS um a um; e a lista das requisições aptas a "Enviar para Assinatura" (processo, nº da requisição, tipo e valor), com o id de cada uma no JD (o número que `imprimir(<id>)` usa).

**Depois do agente:**
- Grave a linha `C` no andamento e relate ao usuário o resultado da conferência, com os AVISOS um a um.
- O **"Enviar para Assinatura"** segue a regra da `jef-conferir-rpv`: apresente a lista das aptas e peça a confirmação expressa do usuário para aquela lista. Sem o "sim", nada é enviado.
- Com o "sim", **o envio é feito nesta conversa principal**, que recebeu a confirmação do usuário — nunca pelo agente da conferência (decisão do usuário, 13/10/2026: o agente, com razão, não aceita confirmação repassada por outra sessão). A conferência já terminou; o envio não envolve decisão sobre os dados. Siga o método da seção "Enviar para Assinatura" da `jef-conferir-rpv`, uma requisição por vez: no frame `principal` (tela Consultar), capture o endereço que `imprimir(<id>)` montaria, carregue-o no próprio frame, substitua `alert`/`confirm`, confira situação "Em Conferência", nº da requisição, processo, Valor Total Requisitado e o botão `#btn_validar` ("Enviar para Assinatura", `onclick` `validar(<id>,'<nº>')`), clique uma única vez e confira "Aguardando Assinatura". Ao fim, tire o frame do espelho (tela Consultar).
- **Uma chamada do javascript_tool por requisição** (decisão do usuário, 13/10/2026): a ferramenta corta a execução em 45 segundos, e um envio em lote numa só chamada perde o retorno (horário do envio e mensagens do JD). Cada chamada abre o espelho de uma requisição, confere, clica e devolve a situação, a data e hora e as mensagens; grave a linha `E` antes da chamada seguinte. Se uma chamada perder o retorno, nunca clique de novo: confira a situação só lendo o espelho (por `fetch` do endereço de `imprimir(<id>)`) e registre o que não pôde ser confirmado.
- Se o modo automático bloquear o clique, não insista: confira pela tela que nada mudou e peça ao usuário que clique (ou que libere a ação nas permissões).
- Registre cada envio no **arquivo de andamento da conferência** (linha `E|<processo>|<nº>|<data e hora>|<situação depois do envio>`, como a `jef-conferir-rpv` manda) e acrescente ao relatório da conferência a aba "Enviadas para assinatura", com a coluna "Movimentação do processo" (regra da `jef-conferir-rpv`). Registre também no andamento da expedição (linha `V`). Repasse ao usuário a lista dos processos a movimentar para a fase configurada em `jef-conferir-rpv.fase_elaborar_comunicacao` e dos que não devem ser movimentados, com o motivo.

## Entregável

Um arquivo .xlsx, fonte Arial, `Relatórios/<EXP>_AAAA-MM-DD_<ID>.xlsx`, gerado do arquivo de andamento, com três abas. Processos identificados pelo número, nunca pelo nome da parte (o nome do beneficiário aparece só na coluna de beneficiário, onde é o próprio dado).

**Aba `Elaboradas`** — uma linha por requisição elaborada e enviada para conferência:

| Processo | Nº da requisição | Tipo | Beneficiário | Valor total | Principal | Juros | Selic | Destaque (% e valor) | NM (anterior / corrente) | Data-base | Trânsito | Embargos | Documentos de origem | Situação no JD | Data e hora do envio para conferência |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|

**Aba `Não elaboradas`** — uma linha por requisição devida que não foi elaborada ou ficou incompleta:

| Processo | Tipo | Motivo | Nº da requisição (se criada e não concluída) | Situação no JD |
|---|---|---|---|---|

**Aba `Avisos`** — todos os AVISOS e as dúvidas sem resposta, um por linha:

| Processo | Tipo | Aviso |
|---|---|---|

O relatório da conferência independente é o da `jef-conferir-rpv` (`<CONF>_AAAA-MM-DD_<ID>.xlsx`), em arquivo separado.

## Ao terminar

Relate primeiro o diagnóstico: quantos processos; quantas requisições elaboradas e enviadas para conferência, por tipo; quantas não elaboradas, com o motivo; as requisições criadas e não concluídas (nº e motivo), que precisam de tratamento humano; e os AVISOS um a um. Depois, o resultado da conferência independente (com os AVISOS dela) e a pergunta sobre o "Enviar para Assinatura" das aptas.

Processo não encontrado no PJe, autos que não abriram ou JD inacessível: diga quais e por quê, em separado. Nunca relate como elaborada uma requisição cujo envio para conferência você não viu confirmado na tela.

### Incorporar à skill as respostas às dúvidas — regra obrigatória (usuário, 06/11/2026)

**Ao final de toda sessão, as respostas do usuário às dúvidas (linhas `Q`) devem ser incorporadas a esta skill, no que for aplicável, para as expedições futuras.** A sessão não está encerrada enquanto isso não for feito.

1. **Selecione.** Releia as linhas `Q` do andamento e as respostas do usuário. Separe as que valem como regra geral das que só resolvem aquele processo, por depender de um documento ou fato próprio dele. Estas últimas não entram na skill.
2. **Redija.** Escreva cada resposta aplicável como regra, na seção a que pertence, com a data, "usuário" como fonte e o caso de origem pelo número do processo. Fluxo do JD que ficou testado com a resposta perde a parada de "primeira vez". **Grave a mesma regra também na `jef-conferir-rpv`**, sempre que ela mudar o que confere ou o que é AVISO na conferência. Lá, a regra é escrita do ponto de vista da conferência: o que confere sem AVISO e o que é AVISO. As respostas às dúvidas e aos AVISOS da conferência independente também entram nas duas skills, no que for aplicável.
3. **Confira o conflito.** Se a resposta contrariar uma regra já escrita, ou o alcance da generalização for incerto, pergunte ao usuário antes de gravar.
4. **Não altere o resto.** Nada além do que as respostas autorizam é mudado: o restante da skill continua intacto.
5. **Registre.** Anote a alteração em "Alterações registradas" do `CLAUDE.md` do projeto e informe ao usuário, no relato final, o que foi incorporado e o que ficou de fora por ser próprio do caso.
