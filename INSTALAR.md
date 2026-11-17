# Instalação de uma skill — instruções para o Claude Code

Estas instruções são para o **Claude Code** (a aba Code do aplicativo Claude para computador, no Windows), quando a pessoa pede para instalar uma skill deste repositório. Quem pede a instalação, em geral, **não entende de informática**: faça tudo por ela, explique cada passo em linguagem simples, sem termos técnicos, e diga claramente o que ela precisa fazer quando o aplicativo pedir permissão ("clique em Permitir").

## Skills disponíveis

| Skill | Para que serve |
|---|---|
| `jef-analise-inicial` | Análise inicial dos processos do JEF |
| `jef-analise-laudo-medico` | Análise do laudo médico e do laudo social |
| `jef-baixa-peticao` | Baixa de petições (documentos não lidos) |
| `jef-conferir-rpv` | Conferência das RPVs no Jurisdição Delegada |
| `jef-controle-prazo` | Controle de prazo (intimações que falharam) |
| `jef-devolvidos-tr` | Processos devolvidos pela Turma Recursal |
| `jef-endereco-pericia` | Endereço da perícia médica |
| `jef-expediente-manifestacao` | Triagem de expedientes com manifestação |
| `jef-expedir-rpv` | Expedição das RPVs no Jurisdição Delegada (instala também a `jef-conferir-rpv`) |
| `jef-fase-execucao` | Processos na fase de execução |

Se a pessoa pediu uma skill que não está na tabela, diga quais existem e pergunte qual ela quer. Se pediu mais de uma, instale uma de cada vez, repetindo os passos 3 a 6.

## Passo a passo

Use o PowerShell. A pessoa pode ter aberto a conversa em qualquer pasta: a instalação vai sempre para a pasta **Skills PJe**, dentro da pasta **Documentos** dela.

1. **Explique** em uma ou duas frases o que vai fazer: baixar a skill deste endereço público, instalar na pasta Documentos › Skills PJe e conferir. Diga que o aplicativo pode pedir permissão algumas vezes e que ela deve clicar em **Permitir**.

2. **Baixe e descompacte o repositório** numa pasta temporária:

   ```powershell
   $zip = Join-Path $env:TEMP 'skills-pje-jef.zip'
   $tmp = Join-Path $env:TEMP 'skills-pje-jef'
   if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
   Invoke-WebRequest -UseBasicParsing 'https://github.com/amcinvestiment/skills-pje-jef/archive/refs/heads/main.zip' -OutFile $zip
   Expand-Archive -LiteralPath $zip -DestinationPath $tmp -Force
   ```

3. **Defina a origem e o destino** (troque `<skill>` pelo nome da skill pedida, ex.: `jef-analise-inicial`):

   ```powershell
   $orig = Join-Path $tmp 'skills-pje-jef-main\skills\<skill>'
   $dest = Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'Skills PJe'
   New-Item -ItemType Directory -Force -Path $dest | Out-Null
   ```

   Confira que `$orig` existe. Se não existir, o nome da skill está errado: volte à tabela.

4. **Copie os arquivos**, substituindo os da mesma skill, sem apagar nada que já esteja na pasta:

   ```powershell
   robocopy $orig $dest /E /XF CLAUDE.md /NFL /NDL /NJH /NJS /NP
   if ($LASTEXITCODE -ge 8) { throw "robocopy falhou ($LASTEXITCODE)" }
   ```

   O `robocopy` devolve 0 a 7 quando dá certo; não trate isso como erro.

5. **Regras gerais (CLAUDE.md):**
   - se `$dest\CLAUDE.md` **não existe**, copie `$orig\CLAUDE.md` para lá;
   - se existe e é **igual** ao do pacote (outra skill deste repositório já foi instalada), substitua;
   - se existe e é **diferente**, não mexa nele: salve o do pacote como `$dest\CLAUDE-regras-gerais.md` e explique à pessoa que as regras gerais das skills estão nesse arquivo e que o conteúdo dele deve ser acrescentado ao CLAUDE.md (ofereça-se para fazer isso, se ela quiser).

   Nunca apague nem substitua `docs\configuracao-unidade.md` (as respostas da unidade) nem a pasta `Relatórios`.

6. **Confira** que existem, dentro de `$dest`:
   - `.claude\skills\<skill>\SKILL.md`;
   - `Tutorial <skill>.pdf`;
   - `CLAUDE.md` (ou `CLAUDE-regras-gerais.md`, no caso do passo 5).

   Mostre à pessoa, em linguagem simples, o que foi instalado (sem listar código).

7. **Apague os temporários:** `Remove-Item $zip, $tmp -Recurse -Force`.

8. **Explique como usar**, em poucas linhas:
   - abrir uma **conversa nova** na aba **Code**, escolhendo a pasta **Documentos › Skills PJe** (é nessa pasta que o Claude encontra a skill);
   - deixar o Chrome aberto, com o login feito no PJe (e no Jurisdição Delegada, nas skills de RPV), e com a extensão Claude ligada;
   - digitar `/<skill>` e seguir as perguntas; na primeira vez, a skill pergunta os dados da unidade (nomes das etiquetas, fases etc.) e guarda as respostas;
   - o tutorial em PDF (`Tutorial <skill>.pdf`) está na pasta Skills PJe.

   Para atualizar a skill no futuro, basta pedir de novo a instalação: os arquivos da skill são substituídos e as respostas da unidade continuam guardadas.

## O que não fazer

- Não instale em outra pasta, nem dentro da pasta em que a conversa foi aberta, se ela não for Documentos › Skills PJe.
- Não altere o conteúdo dos arquivos da skill.
- Não peça senha, certificado, token ou PIN à pessoa.
