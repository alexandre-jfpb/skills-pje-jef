# Skills PJe — Juizados Especiais Federais (TRF5)

Skills para o **Claude Code** (a aba **Code** do aplicativo Claude para computador, no Windows) que fazem a triagem e a análise de processos no PJe 1º grau e no Jurisdição Delegada do TRF5. Foram desenvolvidas na 7ª Vara Federal da Paraíba e adaptadas para outras unidades: tudo o que é próprio da unidade (etiquetas, fases, peritos, zonas da perícia social etc.) é perguntado na primeira execução.

As skills **só leem e sugerem**: nenhuma etiqueta é inserida e nenhum processo é movimentado por elas. Antes de usar com processos reais, a direção da unidade deve revisar as regras.

## Como instalar (não precisa entender de informática)

1. Abra o aplicativo **Claude** no computador e clique na aba **Code**. Comece uma conversa nova, em qualquer pasta (por exemplo, **Documentos**).
2. Copie a frase abaixo, trocando o nome da skill pela que você quer, cole na caixa de mensagem e aperte **Enter**:

   > Instale a skill jef-analise-inicial seguindo as instruções de https://raw.githubusercontent.com/alexandre-jfpb/skills-pje-jef/main/INSTALAR.md

3. Quando o Claude pedir permissão para acessar a internet, executar um comando ou criar arquivos, clique em **Permitir**.

O Claude baixa a skill, instala na pasta **Documentos › Skills PJe**, confere tudo e explica como começar a usar. O tutorial em PDF da skill fica na mesma pasta.

## Skills

| Skill | Para que serve |
|---|---|
| `jef-analise-inicial` | Análise inicial dos processos do JEF |
| `jef-analise-laudo` | Análise do laudo médico e do laudo social |
| `jef-baixa-peticao` | Baixa de petições (documentos não lidos) |
| `jef-conferir-rpv` | Conferência das RPVs no Jurisdição Delegada |
| `jef-controle-prazo` | Controle de prazo (intimações que falharam) |
| `jef-devolvidos-tr` | Processos devolvidos pela Turma Recursal |
| `jef-endereco-pericia` | Endereço da perícia médica |
| `jef-expediente-manifestacao` | Triagem de expedientes com manifestação |
| `jef-expedir-rpv` | Expedição das RPVs no Jurisdição Delegada |
| `jef-fase-execucao` | Processos na fase de execução |

Cada pasta em `skills/` traz os arquivos da skill exatamente como ficam instalados, com o tutorial em PDF.
