# Regras gerais da família de skills PJe — Juizados Especiais Federais (TRF5)

Copie este texto para o `CLAUDE.md` do projeto da unidade. Todas as skills da família pressupõem estas regras. Desenvolvidas na 7ª Vara Federal da Paraíba.

**0. Configuração da unidade.** Os dados próprios da unidade (etiquetas, fases do PJe, peritos, assistentes sociais, zonas, assessores, competência, honorários periciais) ficam em `docs/configuracao-unidade.md`, preenchido na primeira execução de cada skill, pelas perguntas que ela faz. Nenhuma skill usa dado que não esteja nesse arquivo.

## Regras que valem para toda a família de skills

Valem para `jef-analise-inicial`, `jef-analise-laudo`, `jef-baixa-peticao`, `jef-devolvidos-tr`, `jef-expediente-manifestacao`, `jef-fase-execucao`, `jef-conferir-rpv`, `jef-endereco-pericia` e `jef-controle-prazo`, e `jef-expedir-rpv`, e para qualquer skill nova deste projeto.

**1. Só leitura. A única gravação autorizada no PJe é MARCAR TODOS COMO LIDOS.**

Havendo o aviso "Há N documento(s) não lido(s)" no topo da cronologia, clique em **MARCAR TODOS COMO LIDOS** e confirme que o aviso sumiu antes de passar ao próximo processo. Em `jef-baixa-peticao` isso é obrigatório em todo processo da lista, entre ou não no relatório final.

Nunca clique em MARCAR TODOS COMO LIDOS num processo cujos autos não abriram. Em `jef-endereco-pericia` e `jef-controle-prazo`, MARCAR TODOS COMO LIDOS não é clicado.

Fora dessa gravação, nunca: inserir ou retirar etiqueta; movimentar processo, transferir tarefa ou cancelar distribuição; protocolar, juntar documento, expedir intimação ou qualquer comunicação; remeter ao arquivo; preencher minuta, selecionar tipo de documento ou clicar em ASSINAR DOCUMENTO(S); autorizar ou registrar pagamento de perícia.

Exceção, em `jef-analise-inicial`: baixar os autos em PDF, mover e salvar os arquivos na subpasta de trabalho e, ao final, apagá-los — cada etapa com autorização expressa do usuário para o lote.

Exceção, em `jef-conferir-rpv`: no Jurisdição Delegada, clicar em "Enviar para Assinatura" só nas requisições "Em Conferência" sem nenhum AVISO, depois da conferência e com confirmação expressa do usuário para a lista, a cada execução. Uma requisição por vez, conferindo no espelho que a situação mudou. Depois do envio, é proibido qualquer ato posterior na requisição; "Devolver" e "Cancelar" continuam proibidos.

Exceção, em `jef-expedir-rpv`: no Jurisdição Delegada, elaborar RPVs (Cadastrar, Continuar, partes, Gravar com as confirmações esperadas, Ofício e "Enviar para Conferência") só nos processos da lista fornecida pelo usuário em cada execução, que é a trava de segurança. O "Enviar para Assinatura" só depois da conferência independente, nas requisições sem AVISO e com a confirmação expressa do usuário para a lista, feito pela conversa principal pelo método da `jef-conferir-rpv`; nunca "Devolver", "Cancelar" ou exclusão de requisição. Também pode refazer, pela tela "Não Concluídas", as requisições **devolvidas pelo usuário** que ele listar pelo número em cada execução (só o link de abertura da linha; nunca "excluir" nem "Cancelar"), parando antes do "Gravar" da Etapa 4 para o OK dele. No PJe, a expedição só lê; o MARCAR TODOS COMO LIDOS é feito pela conferência independente que ela chama.

**2. Etiqueta é sempre prescrição, nunca registro.**

A coluna de etiqueta do relatório (e a providência que a acompanha) diz o que a secretaria deve fazer manualmente. Não é registro de etiqueta já inserida, e nenhuma skill insere ou retira etiqueta no PJe. O mesmo vale para as providências de curatela em `jef-analise-laudo`: etiqueta de curador, intimação, prazo e minuta são prescrições para execução manual.

**3. Nunca digitar senha, certificado, token ou PIN.**

Aparecendo tela de login, pare e peça ao usuário que se autentique.

**4. Processo é identificado pelo número, nunca pelo nome da parte.**

Vale em todos os relatórios e em todas as abas de planilha.

**5. Não relate como analisado o que você não conseguiu abrir.**

Processo não encontrado na consulta, ou cujos autos não abriram: diga quais e por quê, em separado.

**6. Resultados em arquivo de andamento, gravados à medida que saem — nunca só no final.**

Antes de abrir o primeiro processo, crie em `Relatórios/` o arquivo de andamento da execução (`<Rotina>_AAAA-MM-DD_andamento.txt`) com a lista do lote. A cada processo analisado — ou a cada leitura de progresso, quando a rotina roda em lote —, grave o resultado nele: no formato que a skill definir, ou, sem formato definido, uma linha por processo com o número, a classificação e os dados que irão para o relatório.

O relatório final (.xlsx) é gerado a partir desse arquivo, nunca da memória da conversa. Se a execução parar (login, queda do navegador ou da conversa), retome só com os processos do lote que ainda não têm resultado no arquivo.

