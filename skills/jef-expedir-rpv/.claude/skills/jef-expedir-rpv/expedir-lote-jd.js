// expedir-lote-jd.js — jef-expedir-rpv, lado do Jurisdição Delegada (desenvolvido na 7ª Vara Federal da Paraíba)
//
// Carregado na janela de cima da aba do JD (menu.wsp), com o frame "principal" no próprio sistema.
// Escrito a partir do fluxo testado com o usuário em 13/10/2026 (seis requisições de três processos):
// parte autora com e sem destaque percentual, reembolso de perícia e honorários sucumbenciais.
//
// ESTE SCRIPT GRAVA NO JD — só o que a skill autoriza: cria a requisição (Cadastrar → Continuar), grava as
// partes, os valores (Gravar, com as duas confirmações), lê o ofício e clica em "Enviar para Conferência".
// Nunca "Enviar para Assinatura", "Devolver", "Cancelar", "Enviar para o TRF" ou "Assinar/Finalizar".
// QUEM DECIDE OS DADOS É O CLAUDE, pelas regras do SKILL.md, a partir dos autos; o script só preenche o que
// recebe e confere o que o JD devolveu. Cada função para e devolve PAROU:<motivo> diante de qualquer coisa
// diferente do esperado — inclusive qualquer confirmação ou alerta do JD que não esteja na lista abaixo.
//
// Trava: EX.autoriza([processos]) recebe a lista fornecida pelo usuário nesta execução. EX.etapa1 recusa
// processo fora dela.
//
// Configuração da unidade (docs/configuracao-unidade.md, montada pela skill): antes de EX.autoriza, chame
//   EX.config({ reembolso: { cnpj: '<Comum — Unidade.secao_judiciaria_cnpj>', nome: '<Comum — Unidade.secao_judiciaria_razao_social>' } })
// É a beneficiária que o JD inclui sozinho na RPV de reembolso ("Reembolso a Seção Judiciária = Sim"), conferida
// na Etapa 3. Guardada em EX.cfg; sem ela, EX.autoriza não autoriza nada.
//
// Uso (cada linha é uma chamada do javascript_tool, na aba do JD):
//   EX.config({ reembolso: { cnpj, nome } })  -> dados da unidade (antes de tudo)
//   EX.autoriza(['0000000-00.2026.4.05.9999', ...])
//   await EX.dup(num)                 -> requisições do processo no Painel, em todas as situações (só leitura)
//   await EX.cadastrar()              -> abre RPV/PRC → Cadastrar no frame principal (pelo menu)
//   await EX.etapa1(d)                -> preenche, confere e clica "Continuar" (CRIA a requisição); devolve nº e id
//   await EX.etapa2(tipo)             -> confere o assunto e clica "Continuar"
//   await EX.etapa3(d)                -> partes (Cassandra), escritório pelo CNPJ, forma do honorário; "Continuar"
//   await EX.etapa4(d)                -> valores, NM, mora Selic; "Gravar" com as 2 confirmações esperadas
//   await EX.oficio()                 -> abre o ofício no frame principal e devolve os dados lidos
//   await EX.conferencia(nr, total)   -> "Enviar para Conferência" e confere a situação "Em Conferência"
//   await EX.sai()                    -> tira o frame do espelho (menu RPV/PRC → Consultar)
//   EX.dialogos()                     -> todas as confirmações e alertas do JD desde o carregamento
//   EX.limpa()                        -> apaga window.__EX (antes de chamar a conferência independente)
//
// Requisição devolvida, refeita pela tela "Não Concluídas" (autorização do usuário, 16/10/2026; testado em
// 16/10/2026 em requisições devolvidas). Só as devolvidas listadas pelo número nesta execução:
//   EX.autorizaDevolvidas(['AAAA.XX.XXXX.XXX.NNNNNN', ...])
//   await EX.devolvidas()             -> abre a Não Concluídas pelo menu e lista as linhas (só leitura)
//   await EX.abreDevolvida(nr)        -> abre a requisição pelo link da linha (Etapa 1, dados já gravados)
//   await EX.continua1(nr)            -> "Continuar" da Etapa 1 sem alterar nenhum campo
//   (Etapas 2 e 3 como sempre: EX.etapa2, EX.etapa3({..., pausa: true}) e EX.continua3; na troca do
//    beneficiário do destaque, destaque.zeraOutros = true leva a 0,00 o percentual que estava em outro)
//   await EX.etapa4({..., pausa: true}) -> relança os valores, lança o NM e PARA antes do "Gravar"
//    (na troca do beneficiário, zeraContratual: [nome do antigo] leva a 0,00 o valor contratual que ficou nele)
//   await EX.grava4(total)            -> "Gravar" da Etapa 4, só com as 2 confirmações esperadas
//   await EX.conferencia(nr, total)   -> aceita a situação "Devolvida" só para devolvida autorizada
(() => {
  const EX = (window.__EX = window.__EX || {});
  window.EX = EX;
  EX.versao = 2;
  EX.log = EX.log || [];
  EX.cfg = EX.cfg || {};

  // Temporizador em Worker: com a aba em segundo plano o Chrome estrangula o setTimeout da página.
  if (!window.__wt) {
    const src = 'const t={};onmessage=e=>{const[k,id,ms]=e.data;if(k==="s")t[id]=setTimeout(()=>postMessage(id),ms);else clearTimeout(t[id]);};';
    const w = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
    const cb = {};
    let seq = 0;
    w.onmessage = (e) => { const f = cb[e.data]; delete cb[e.data]; if (f) f(); };
    window.setTimeout = (fn, ms, ...a) => { const id = ++seq; cb[id] = () => fn(...a); w.postMessage(['s', id, ms || 0]); return id; };
    window.clearTimeout = (id) => { delete cb[id]; w.postMessage(['c', id]); };
    window.__wt = w;
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const P = () => window.frames['principal'];
  const D = () => P().document;
  const caminho = () => { try { return P().location.pathname; } catch (e) { return '?'; } };
  const so = (s) => String(s || '').replace(/\D/g, '');
  const formata = (num) => { const d = so(num); return d.length === 20 ? d.replace(/^(\d{7})(\d{2})(\d{4})(\d)(\d{2})(\d{4})$/, '$1-$2.$3.$4.$5.$6') : num; };
  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
  // Mesmo escritório com nome que só acrescenta, abrevia ou varia (regra geral do usuário, 15/10/2026): os nomes
  // que identificam a sociedade (sem as palavras genéricas) do nome mais curto estão todos no mais longo.
  const GENERICAS = new Set(['SOCIEDADE', 'INDIVIDUAL', 'DE', 'DA', 'DO', 'DAS', 'DOS', 'E', 'ADVOCACIA', 'ADVOGADOS', 'ADVOGADO', 'ADVOGADA', 'ADVOGADAS', 'ASSOCIADOS', 'ASSOCIADAS', 'ESCRITORIO', 'ME', 'LTDA', 'EIRELI', 'EPP', 'S', 'A', 'SS', 'SC']);
  const nucleo = (s) => norm(s).split(' ').filter((t) => t && !GENERICAS.has(t));
  const mesmaSociedade = (a, b) => {
    const x = nucleo(a), y = nucleo(b);
    if (!x.length || !y.length) return false;
    const [curto, longo] = x.length <= y.length ? [x, new Set(y)] : [y, new Set(x)];
    return curto.every((t) => longo.has(t));
  };
  // Valores: "70.997,56" <-> centavos inteiros.
  const cent = (v) => { if (v === undefined || v === null || v === '') return 0; const s = String(v).replace(/\./g, '').replace(',', '.'); return Math.round(parseFloat(s) * 100); };
  const brl = (c) => { const neg = c < 0; c = Math.abs(c); const r = String(c % 100).padStart(2, '0'); const i = String(Math.floor(c / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); return (neg ? '-' : '') + i + ',' + r; };
  const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parou = (motivo, extra) => Object.assign({ ok: false, parou: motivo }, extra || {});
  const saida = (o) => JSON.parse(JSON.stringify(o).replaceAll('=', ':'));

  // ---------------------------------------------------------------- confirmações e alertas do JD
  // Só devolve true para a confirmação esperada naquele passo; qualquer outra recebe false e fica registrada.
  let regras = [];
  let inesperados = [];
  function escuta(lista) {
    regras = (lista || []).map((r) => ({ re: r.re, max: r.max || 1, n: 0, nome: r.nome, repeteRecusa: !!r.repeteRecusa }));
    inesperados = [];
    const w = P();
    w.confirm = (m) => {
      const r = regras.find((x) => x.re.test(m) && x.n < x.max);
      if (r) r.n++;
      // Repetição esperada de uma confirmação já aceita (ex.: a importação do Cassandra, que o campo do processo
      // dispara a cada saída): recusada, sem contar como mensagem inesperada.
      const repete = !r && regras.some((x) => x.repeteRecusa && x.re.test(m) && x.n >= x.max);
      EX.log.push({ t: new Date().toLocaleTimeString(), tipo: 'confirm', msg: m, ok: !!r, passo: caminho(), repeticao: repete || undefined });
      if (!r && !repete) inesperados.push('confirm: ' + m);
      return !!r;
    };
    w.alert = (m) => { EX.log.push({ t: new Date().toLocaleTimeString(), tipo: 'alert', msg: m, passo: caminho() }); inesperados.push('alert: ' + m); };
  }
  const RE_CASSANDRA = { re: /oriundos do PJe[\s\S]*Deseja import/i, nome: 'importação do Cassandra', max: 1, repeteRecusa: true };
  const RE_EXCLUI = { re: /partes que n[ãa]o tiverem valores preenchidos[\s\S]*Confirma a grava[çc][ãa]o\?/i, nome: 'exclusão de partes sem valor' };
  const RE_ENVIO = { re: /^\s*Confirma o envio para confer[êe]ncia\?\s*$/, nome: 'envio para conferência' };

  async function espera(pred, ms) {
    const t0 = Date.now();
    while (Date.now() - t0 < (ms || 20000)) { try { if (pred()) return true; } catch (e) { /* carregando */ } await sleep(300); }
    return false;
  }
  // Executa a ação e espera o frame carregar um documento novo (no caminho dado, se informado).
  async function navega(acao, alvo, ms) {
    let d0 = null;
    try { d0 = D(); } catch (e) { /* frame em página de erro, de outro domínio */ }
    acao();
    const ok = await espera(() => { const d = D(); return d !== d0 && d.readyState === 'complete' && d.body && (!alvo || caminho() === alvo); }, ms || 25000);
    await sleep(400);
    return ok;
  }
  function login() { try { const t = D().body.innerText; return /login|senha|c[óo]digo de seguran/i.test(t) && !/RPV\/PRC/.test(t); } catch (e) { return false; } }

  // ---------------------------------------------------------------- leitura de campos
  const el = (n) => D().getElementsByName(n)[0];
  function valor(n) {
    const els = D().getElementsByName(n);
    if (!els.length) return null;
    if (els[0].type === 'radio') { const c = [...els].find((e) => e.checked); return c ? c.value : ''; }
    return els[0].value;
  }
  function poe(n, v) {
    const e = el(n);
    if (!e) throw new Error('campo ' + n + ' não encontrado');
    const w = P();
    e.focus();
    e.value = v;
    ['keyup', 'change'].forEach((t) => e.dispatchEvent(new w.Event(t, { bubbles: true })));
    e.blur();
    e.dispatchEvent(new w.Event('blur'));
  }
  function marca(n, v) {
    const r = [...D().getElementsByName(n)].find((e) => e.value === v);
    if (!r) throw new Error('opção ' + v + ' de ' + n + ' não encontrada');
    if (!r.checked) r.click();
  }
  const visivel = (e) => !!(e && e.offsetParent);
  const botao = (rotulo) => [...D().querySelectorAll('input[type=button],input[type=submit],button')].filter((b) => (b.value || b.textContent || '').trim() === rotulo);
  function nrEId() {
    const hs = [...D().querySelectorAll('input[type=hidden]')];
    const nr = (hs.find((h) => /^\d{4}\.\d{2}\.\d{4}\.\d{3}\.\d{6}$/.test(h.value)) || {}).value || '';
    const id = (hs.find((h) => /id_rpv/i.test(h.name) && /^\d+$/.test(h.value)) || {}).value || '';
    return { nr, id };
  }

  // ---------------------------------------------------------------- trava e menu
  // Dados da unidade, lidos pela skill em docs/configuracao-unidade.md. Padrão vazio.
  EX.config = function (c) {
    const r = (c && c.reembolso) || {};
    EX.cfg = { reembolso: { cnpj: String(r.cnpj || '').trim(), nome: String(r.nome || '').trim() } };
    return cfgFalta() || 'configuração recebida: reembolso para ' + EX.cfg.reembolso.nome + ' (CNPJ ' + EX.cfg.reembolso.cnpj + ')';
  };
  function cfgFalta() {
    const r = (EX.cfg && EX.cfg.reembolso) || {};
    if (!/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/.test(r.cnpj || '') || !r.nome) {
      return 'PAROU: configure EX.config({ reembolso: { cnpj: "00.000.000/0000-00", nome: "<razão social>" } }) antes de iniciar — Comum — Unidade.secao_judiciaria_cnpj e .secao_judiciaria_razao_social de docs/configuracao-unidade.md';
    }
    return '';
  }

  EX.autoriza = function (lista) {
    const falta = cfgFalta();
    if (falta) return falta;
    EX.lista = lista.map((x) => so(x)).filter((x) => x.length === 20);
    return EX.lista.length + ' processos autorizados nesta execução';
  };

  // Abre um item do menu RPV/PRC (Cadastrar ou Consultar) como o próprio menu faz: o menu (Milonic) é definido
  // por aI("text=<rótulo>;url=<endereço>;target=principal") no script de menu.wsp, e o item carrega o endereço no
  // frame principal. O .click() no item gerado pelo menu levou a aba INTEIRA para a tela (testado em 13/10/2026),
  // por isso o endereço é lido da própria definição do menu — nunca digitado na barra de endereço.
  EX.menu = async function (rotulo) {
    const defs = [...document.scripts].map((s) => s.textContent).join('\n').match(/aI\("[^"]*"\)/g) || [];
    const def = defs.find((s) => new RegExp('text=\\s*' + esc(rotulo) + '\\s*;').test(s));
    const url = def && (def.match(/url=([^;"]+)/) || [])[1];
    const alvo = def && (def.match(/target=([^;"]+)/) || [])[1];
    if (!url || alvo !== 'principal') return parou('item "' + rotulo + '" não encontrado na definição do menu: passe o mouse em RPV/PRC e clique em ' + rotulo + ' pela tela');
    const ok = await navega(() => { P().location.href = url; }, null, 15000);
    if (!ok) return parou('"' + rotulo + '" não abriu no frame principal: use o menu pela tela');
    return { ok: true, tela: caminho() };
  };
  EX.cadastrar = async function () {
    const r = await EX.menu('Cadastrar');
    if (!r.ok) return r;
    if (caminho() !== '/jd/rpv/cadastro/tela_1.wsp') return parou('Cadastrar abriu ' + caminho());
    return { ok: true, tela: 'Etapa 1' };
  };
  EX.sai = async function () { return EX.menu('Consultar'); };

  // ---------------------------------------------------------------- requisição devolvida (tela "Não Concluídas")
  // Única exceção à proibição da "Não Concluídas": reabrir a requisição DEVOLVIDA que o usuário listar, pelo número,
  // nesta execução. Cada linha da tela tem três links — abrir (tela_1), imprimir e EXCLUIR: só o primeiro é usado.
  EX.autorizaDevolvidas = function (nrs) {
    EX.devAut = new Set((nrs || []).map((x) => String(x).trim()).filter((x) => /^\d{4}\.\d{2}\.\d{4}\.\d{3}\.\d{6}$/.test(x)));
    return EX.devAut.size + ' requisições devolvidas autorizadas nesta execução';
  };
  const devAutorizada = (nr) => !!(EX.devAut && EX.devAut.has(nr));
  const RE_NR = /\d{4}\.\d{2}\.\d{4}\.\d{3}\.\d{6}/;
  const linhasNaoConcluidas = () => [...D().querySelectorAll('tr')]
    .filter((tr) => !tr.querySelector('tr') && /RPV\s*-\s*\d{4}\.\d{2}\.\d{4}\.\d{3}\.\d{6}/.test(tr.innerText) && !/Crit[ée]rios/.test(tr.innerText));
  function lerLinha(tr) {
    const t = tr.innerText.replace(/\s+/g, ' ').trim();
    return {
      nr: (t.match(RE_NR) || [])[0] || '?',
      processo: (t.match(/\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/) || [])[0] || '?',
      valor: (t.match(/R\$\s*([\d.,]+)/) || [])[1] || '?',
      situacao: /Devolvida$/.test(t) ? 'Devolvida' : /Em Elabora[çc][ãa]o$/.test(t) ? 'Em Elaboração' : t.slice(-30),
    };
  }
  EX.devolvidas = async function () {
    if (caminho() !== '/jd/rpv/cadastro/pendente.wsp') { const r = await EX.menu('Não Concluídas'); if (!r.ok) return r; }
    if (caminho() !== '/jd/rpv/cadastro/pendente.wsp') return parou('a Não Concluídas não abriu', { tela: caminho() });
    return saida({ ok: true, linhas: linhasNaoConcluidas().map(lerLinha).map((l) => Object.assign(l, { autorizada: devAutorizada(l.nr) })) });
  };
  EX.abreDevolvida = async function (nr) {
    if (!devAutorizada(nr)) return parou('requisição devolvida fora da lista autorizada nesta execução: ' + nr);
    if (caminho() !== '/jd/rpv/cadastro/pendente.wsp') { const r = await EX.menu('Não Concluídas'); if (!r.ok) return r; }
    const trs = linhasNaoConcluidas().filter((tr) => lerLinha(tr).nr === nr);
    if (trs.length !== 1) return parou('linha da requisição ' + nr + ' não encontrada (ou repetida) na Não Concluídas', { achadas: trs.length });
    const l = lerLinha(trs[0]);
    if (l.situacao !== 'Devolvida') return parou('a requisição não está "Devolvida" na Não Concluídas', l);
    if (!EX.lista || !EX.lista.includes(so(l.processo))) return parou('processo da requisição fora da lista autorizada nesta execução: ' + l.processo);
    // Só o link de abertura (tela_1, sem onclick); nunca o "excluir" (onclick excluir()) nem o "imprimir".
    const links = [...trs[0].querySelectorAll('a')].filter((a) => /tela_1\.wsp/.test(a.getAttribute('href') || '') && !a.getAttribute('onclick'));
    if (links.length !== 1) return parou('link de abertura (tela_1) não encontrado na linha', { links: links.length });
    const alvo = links[0].getAttribute('target');
    if (alvo && alvo !== '_self') return parou('o link de abertura sairia do frame (' + alvo + ')');
    escuta([]);
    const href = links[0].href;
    const ok = await navega(() => { P().location.href = href; }, '/jd/rpv/cadastro/tela_1.wsp');
    if (!ok) return parou('a requisição não abriu na Etapa 1', { tela: caminho(), inesperados });
    const nrTela = (D().body.innerText.match(RE_NR) || [])[0];
    if (nrTela !== nr || so(valor('tmp.rpv.nr_processo_judicial')) !== so(l.processo)) return parou('a Etapa 1 aberta não é a da requisição pedida', { nrTela, processo: valor('tmp.rpv.nr_processo_judicial') });
    const campos = {
      processo: valor('tmp.rpv.nr_processo_judicial'), ajuizamento: valor('tmp.rpv.dt_ajuizamento'), dataBase: valor('tmp.rpv.dt_calculo'),
      transito: valor('tmp.rpv.dt_transito_julgado'), embargos: valor('tmp.rpv.dt_transito_embargos'),
      destaqueOutroRequisitorio: valor('tmp.rpv.in_destaque_honorario_contratual'), reembolso: valor('tmp.rpv.in_reembolso_secao'), somenteAdv: valor('tmp.rpv.in_credito_somente_advogado'),
    };
    return saida({ ok: true, tela: 'Etapa 1', nr, linha: l, campos });
  };
  // "Continuar" da Etapa 1 de uma devolvida, sem alterar nenhum campo (qualquer confirmação recebe "não").
  EX.continua1 = async function (nr) {
    if (caminho() !== '/jd/rpv/cadastro/tela_1.wsp') return parou('a Etapa 1 não está aberta');
    const nrTela = (D().body.innerText.match(RE_NR) || [])[0];
    if (!devAutorizada(nr) || nrTela !== nr) return parou('a Etapa 1 aberta não é a de uma devolvida autorizada', { nrTela });
    escuta([]);
    const b = botao('Continuar');
    if (b.length !== 1) return parou('botão Continuar não encontrado na Etapa 1');
    const ok = await navega(() => b[0].click(), '/jd/rpv/cadastro/tela_2.wsp');
    if (!ok || inesperados.length) return parou('o Continuar não levou à Etapa 2', { tela: caminho(), inesperados });
    return saida({ ok: true, tela: 'Etapa 2', nr });
  };

  // ---------------------------------------------------------------- duplicidade (só leitura)
  const SITUACOES = { EL: 'Em Elaboração', CF: 'Em Conferência', VL: 'Aguardando Assinatura', FN: 'Assinada', AU: 'Autuada no TRF', PG: 'Paga', DV: 'Devolvida', CA: 'Cancelada', RJ: 'Rejeitada pelo TRF' };
  EX.dup = async function (num) {
    const f = formata(num);
    const out = [];
    for (const st of Object.keys(SITUACOES)) {
      const r = await fetch('/jd/painel/rpv.wsp?tmp.rpv.cd_status_rpv=' + st + '&tmp.rpv.nr_processo_judicial=' + encodeURIComponent(f) + '&tmp.rpv.qt_registros=100', { credentials: 'include' });
      const h = new TextDecoder('iso-8859-1').decode(await r.arrayBuffer());
      const doc = new DOMParser().parseFromString(h, 'text/html');
      doc.querySelectorAll('script,style').forEach((e) => e.remove());
      const t = (doc.body ? doc.body.textContent : '').replace(/\s+/g, ' ');
      if (/login\.wsp|C[óo]digo de seguran/i.test(h) && !/Painel/i.test(t)) return parou('login no JD');
      t.split(/Nr\. Processo:/).slice(1).forEach((bloco) => {
        if (so(bloco.slice(0, 40)).slice(0, 20) !== so(f)) return;
        const nr = (bloco.match(/(?:RPV|PRC):\s*([\d.]+)/) || [])[1] || '?';
        const vl = (bloco.match(/Valor Requisitado:\s*R\$\s*([\d.,]+)/) || [])[1] || '?';
        const ass = bloco.replace(/^.*?Detalhe 3/, '').replace(/ATEN[ÇC][ÃA]O.*$/, '').replace(/\s\d+\s*$/, '').trim().slice(0, 160);
        if (!out.some((o) => o.nr === nr)) out.push({ situacao: SITUACOES[st], nr, valor: vl, assunto: ass });
      });
    }
    return saida({ ok: true, processo: f, requisicoes: out });
  };

  // ---------------------------------------------------------------- Etapa 1
  // d = { num, tipo: 'autora'|'sucumbencia'|'reembolso', dataBase, transito, embargos, ajuizamento? }
  //   ajuizamento: só se o Cassandra não trouxer (deve vir decidido dos autos); transito/embargos: sempre os decididos
  //   pela certidão de trânsito — o que o Cassandra trouxe é devolvido em `cassandra` para o registro.
  EX.etapa1 = async function (d) {
    if (!EX.lista || !EX.lista.includes(so(d.num))) return parou('processo fora da lista autorizada nesta execução: ' + d.num);
    if (!['autora', 'sucumbencia', 'reembolso'].includes(d.tipo)) return parou('tipo desconhecido: ' + d.tipo);
    if (caminho() !== '/jd/rpv/cadastro/tela_1.wsp') return parou('a Etapa 1 (Cadastrar) não está aberta no frame principal');
    if (valor('tmp.rpv.nr_processo_judicial')) return parou('a Etapa 1 já tem processo preenchido: abra Cadastrar de novo');
    escuta([RE_CASSANDRA]);
    poe('tmp.rpv.nr_processo_judicial', formata(d.num));
    await espera(() => valor('tmp.rpv.id_processo_api'), 10000);
    const cass = { ajuizamento: valor('tmp.rpv.dt_ajuizamento'), transito: valor('tmp.rpv.dt_transito_julgado'), embargos: valor('tmp.rpv.dt_transito_embargos'), idApi: valor('tmp.rpv.id_processo_api') };
    if (!cass.idApi || !regras[0].n) return parou('o Cassandra não importou os dados do PJe', { cassandra: cass, inesperados });
    if (inesperados.length) return parou('mensagem inesperada do JD', { inesperados });

    // Campos comuns a todos os tipos.
    marca('tmp.rpv.cd_classe', '399'); // RPV
    marca('tmp.rpv.in_reembolso_secao', d.tipo === 'reembolso' ? 'S' : 'N');
    await sleep(500);
    if (d.tipo !== 'reembolso') {
      marca('tmp.rpv.in_credito_somente_advogado', d.tipo === 'sucumbencia' ? 'S' : 'N');
      await sleep(500);
      if (d.tipo === 'sucumbencia') { marca('tmp.rpv.in_rpv_sucumbencia', 'S'); await sleep(300); }
      marca('tmp.rpv.in_natureza_credito', d.natureza || '1'); // 1 = Natureza Alimentar (padrão), 0 = Comum
      if (d.tipo === 'autora') marca('tmp.rpv.in_destaque_honorario_contratual', 'N'); // destaque vai nesta mesma RPV
    }
    ['tmp.rpv.in_parcial', 'tmp.rpv.in_complementar', 'tmp.rpv.in_suplementar', 'tmp.rpv.in_multa_astrientes'].forEach((n) => marca(n, 'N'));
    marca('tmp.rpv.tp_incidente', 'SI'); // Sem Restrição
    if (!cass.ajuizamento) {
      if (!d.ajuizamento) return parou('o Cassandra não trouxe a data de ajuizamento e ela não foi informada', { cassandra: cass });
      poe('tmp.rpv.dt_ajuizamento', d.ajuizamento);
    }
    poe('tmp.rpv.dt_calculo', d.dataBase);
    if (d.tipo !== 'reembolso' || el('tmp.rpv.dt_transito_julgado')) {
      poe('tmp.rpv.dt_transito_julgado', d.transito);
      poe('tmp.rpv.dt_transito_embargos', d.embargos);
    }
    await sleep(600);

    // Conferência de tudo antes do Continuar.
    const esperado = {
      'tmp.rpv.nr_processo_judicial': formata(d.num), 'tmp.rpv.cd_classe': '399',
      'tmp.rpv.in_natureza_credito': d.tipo === 'reembolso' ? '0' : (d.natureza || '1'),
      'tmp.rpv.in_reembolso_secao': d.tipo === 'reembolso' ? 'S' : 'N',
      'tmp.rpv.in_parcial': 'N', 'tmp.rpv.in_complementar': 'N', 'tmp.rpv.in_suplementar': 'N', 'tmp.rpv.in_multa_astrientes': 'N', 'tmp.rpv.tp_incidente': 'SI',
      'tmp.rpv.dt_calculo': d.dataBase, 'tmp.rpv.dt_transito_julgado': d.transito, 'tmp.rpv.dt_transito_embargos': d.embargos,
      'tmp.rpv.dt_ajuizamento': cass.ajuizamento || d.ajuizamento,
    };
    if (d.tipo !== 'reembolso') esperado['tmp.rpv.in_credito_somente_advogado'] = d.tipo === 'sucumbencia' ? 'S' : 'N';
    if (d.tipo === 'sucumbencia') esperado['tmp.rpv.in_rpv_sucumbencia'] = 'S';
    if (d.tipo === 'autora') esperado['tmp.rpv.in_destaque_honorario_contratual'] = 'N';
    const dif = Object.entries(esperado).filter(([n, v]) => valor(n) !== v).map(([n, v]) => n + ': tela "' + valor(n) + '" × esperado "' + v + '"');
    if (dif.length) return parou('campo da Etapa 1 diferente do esperado', { dif, cassandra: cass });
    if (inesperados.length) return parou('mensagem inesperada do JD', { inesperados });

    escuta([]);
    const b = botao('Continuar');
    if (b.length !== 1) return parou('botão Continuar não encontrado na Etapa 1');
    const ok = await navega(() => b[0].click(), '/jd/rpv/cadastro/tela_2.wsp');
    if (!ok) return parou('o Continuar não levou à Etapa 2', { tela: caminho(), inesperados });
    const r = nrEId();
    return saida({ ok: true, tela: 'Etapa 2', nr: r.nr, id: r.id, cassandra: cass });
  };

  // ---------------------------------------------------------------- Etapa 2 (assunto)
  EX.etapa2 = async function (tipo) {
    if (caminho() !== '/jd/rpv/cadastro/tela_2.wsp') return parou('a Etapa 2 não está aberta');
    const t = D().body.innerText;
    const lista = t.slice(t.indexOf('Código')).match(/\b\d{2}\.\d{2}(?:\.\d{2}){0,3}\b/g) || [];
    const importados = [...D().querySelectorAll('input[type=radio]')].slice(0, 2).map((r) => r.value + (r.checked ? '*' : ''));
    const esperado = { reembolso: '08.01.05', sucumbencia: '08.01.14.01' }[tipo];
    if (!lista.length) return parou('nenhum assunto na lista da Etapa 2', { importados });
    if (esperado && !lista.includes(esperado)) return parou('assunto diferente do esperado para ' + tipo + ': ' + lista.join(', '));
    if (!esperado && !importados.includes('S*')) return parou('"Utilizar Assuntos Importados" não está em Sim', { importados, lista });
    escuta([]);
    const b = botao('Continuar');
    if (b.length !== 1) return parou('botão Continuar não encontrado na Etapa 2');
    const ok = await navega(() => b[0].click(), '/jd/rpv/cadastro/tela_3.wsp');
    if (!ok) return parou('o Continuar não levou à Etapa 3', { tela: caminho(), inesperados });
    return saida({ ok: true, tela: 'Etapa 3', assunto: lista, importados });
  };

  // ---------------------------------------------------------------- Etapa 3 (partes)
  function partesNaTela() {
    const t = D().body.innerText;
    const i = t.indexOf('Parte/Beneficiário');
    const f = t.indexOf('Atenção');
    return (i >= 0 ? t.slice(i + 18, f > i ? f : undefined) : '').split('\n').map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean).join(' | ');
  }
  // d = { tipo, autorCpf, representante? (nome), escritorio? {cnpj, nome}, destaque? {nome, pct: '30,00'} }
  EX.etapa3 = async function (d) {
    if (caminho() !== '/jd/rpv/cadastro/tela_3.wsp') return parou('a Etapa 3 não está aberta');
    if (d.tipo === 'reembolso') {
      const t = partesNaTela();
      const falta = cfgFalta();
      if (falta) return parou(falta);
      const rb = EX.cfg.reembolso;
      if (!new RegExp(esc(rb.cnpj)).test(t)) return parou('a beneficiária do reembolso (' + rb.nome + ', CNPJ ' + rb.cnpj + ') não está nas partes', { partes: t });
      const just = [...D().querySelectorAll('textarea')].map((x) => x.value).join(' ');
      return continua3({ partes: t, justificativa: just });
    }
    // 1) Partes importadas pelo Cassandra ("Adicionar Parte").
    if (!/Advogado|Autor/.test(partesNaTela()) || !partesNaTela().includes(so(d.autorCpf).replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4'))) {
      escuta([]);
      const okApi = await navega(() => P().addPartes('api'), '/jd/cadastro/parte/jdapi/cadastro.wsp');
      if (!okApi) return parou('"Adicionar Parte" não abriu a lista do PJe', { inesperados });
      const linhas = [...D().querySelectorAll('tr')].filter((tr) => tr.querySelector('input[type=checkbox]') && tr.querySelectorAll('tr').length === 0 && tr.querySelectorAll('td').length >= 3)
        .map((tr) => ({ marcado: tr.querySelector('input[type=checkbox]').checked, txt: tr.innerText.replace(/\s+/g, ' ').trim() }));
      const lt = linhas.map((l) => (l.marcado ? '[x] ' : '[ ] ') + l.txt);
      if (linhas.some((l) => !l.marcado)) return parou('parte não marcada na lista do PJe', { linhas: lt });
      const cpfF = so(d.autorCpf).replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
      if (!linhas.some((l) => /\bAutor\b/.test(l.txt) && l.txt.includes(cpfF))) return parou('o autor (CPF ' + cpfF + ') não veio na importação do PJe', { linhas: lt });
      if (!linhas.some((l) => /Advogado/.test(l.txt))) return parou('nenhum advogado na importação do PJe (é obrigatório)', { linhas: lt });
      if (d.representante && !linhas.some((l) => norm(l.txt).includes(norm(d.representante)))) return parou('representante não veio na importação do PJe: AVISO', { linhas: lt });
      const g = botao('Gravar');
      if (g.length !== 1) return parou('botão Gravar não encontrado na lista do PJe');
      const okG = await navega(() => g[0].click(), '/jd/rpv/cadastro/tela_3.wsp');
      if (!okG || inesperados.length) return parou('a gravação das partes do PJe não voltou à Etapa 3', { inesperados });
    }
    // 2) Escritório pelo CNPJ ("Novo" → Escritório Advocatício).
    let escr = null;
    if (d.escritorio && !partesNaTela().includes(d.escritorio.cnpj)) {
      escuta([]);
      const okN = await navega(() => P().addPartes('new'), '/jd/cadastro/parte/cadastro.wsp');
      if (!okN) return parou('"Novo" não abriu o cadastro de parte', { inesperados });
      const w = P();
      const sel = el('tmp.parte.cd_rpv_tipo_parte');
      sel.value = '84';
      sel.dispatchEvent(new w.Event('change', { bubbles: true }));
      await sleep(800);
      poe('tmp.parte.nr_cnpj', d.escritorio.cnpj);
      await sleep(4000);
      const vis = [...D().querySelectorAll('input,select')].filter((e) => e.type !== 'hidden' && e.type !== 'button' && visivel(e));
      const iC = vis.indexOf(el('tmp.parte.nr_cnpj'));
      const nomeBase = iC >= 0 && vis[iC + 1] ? vis[iC + 1].value.trim() : '';
      const dados = vis.map((e) => (e.tagName === 'SELECT' ? (e.options[e.selectedIndex] || {}).text : e.value));
      escr = { cnpj: d.escritorio.cnpj, nomeProcesso: d.escritorio.nome, nomeBase, dados };
      if (!nomeBase) return parou('escritório fora da base do JD (o CNPJ não trouxe nome): requisição não concluída', { escritorio: escr });
      if (norm(nomeBase) !== norm(d.escritorio.nome)) {
        if (!mesmaSociedade(nomeBase, d.escritorio.nome)) return parou('nome do escritório na base do JD sem relação com o do processo: AVISO; requisição não concluída', { escritorio: escr });
        // Mesma sociedade com nome variado: segue com o nome da base, que é o que o JD mostra dali em diante.
        escr.nomeVariado = true;
        if (d.destaque && norm(d.destaque.nome) === norm(d.escritorio.nome)) d.destaque.nome = nomeBase;
      }
      if (inesperados.length) return parou('mensagem inesperada do JD', { inesperados, escritorio: escr });
      const g = botao('Gravar');
      if (g.length !== 1) return parou('botão Gravar não encontrado no cadastro do escritório');
      const okG = await navega(() => g[0].click(), '/jd/rpv/cadastro/tela_3.wsp');
      if (!okG || inesperados.length) return parou('a gravação do escritório não voltou à Etapa 3', { inesperados, escritorio: escr });
    }
    // 3) Forma do honorário (só parte autora): Real sem destaque; Percentual com destaque.
    let pct = null;
    if (d.tipo === 'autora') {
      if (d.destaque) {
        marca('tmp.rpv.tp_forma_honorarios_adv', 'P');
        await sleep(600);
        const campos = [...D().querySelectorAll('input[name^="tmp.rpv.percent_adv["]')].filter((e) => /\]$/.test(e.name));
        const rot = (e) => (e.closest('tr') ? e.closest('tr').innerText.replace(/\s+/g, ' ').trim() : '');
        const alvo = campos.filter((e) => norm(rot(e)).includes(norm(d.destaque.nome)));
        if (alvo.length !== 1) return parou('beneficiário do destaque não localizado na forma Percentual', { campos: campos.map(rot) });
        poe(alvo[0].name, d.destaque.pct);
        // Devolvida refeita com troca do beneficiário do destaque: o percentual que estava em outro advogado ou
        // escritório vai a 0,00 (só com destaque.zeraOutros = true).
        if (d.destaque.zeraOutros) for (const e of campos) if (e !== alvo[0] && cent(e.value)) poe(e.name, '0,00');
        await sleep(400);
        pct = campos.map((e) => rot(e) + ' = ' + (e.value || '(vazio)'));
        if (valor('tmp.rpv.tp_forma_honorarios_adv') !== 'P' || alvo[0].value !== d.destaque.pct) return parou('forma Percentual não ficou como esperado', { pct });
        if (d.destaque.zeraOutros && campos.some((e) => e !== alvo[0] && cent(e.value))) return parou('outro beneficiário continua com percentual', { pct });
      } else if (valor('tmp.rpv.tp_forma_honorarios_adv') && valor('tmp.rpv.tp_forma_honorarios_adv') !== 'R') {
        return parou('sem destaque, a forma do honorário deveria estar em Real');
      }
    }
    const info = { partes: partesNaTela(), escritorio: escr, percentual: pct };
    // Execução acompanhada: d.pausa = true para antes do "Continuar"; depois, EX.continua3().
    if (d.pausa) return saida(Object.assign({ ok: true, pausado: 'antes do Continuar da Etapa 3' }, info));
    return continua3(info);
  };
  EX.continua3 = async function () {
    if (caminho() !== '/jd/rpv/cadastro/tela_3.wsp') return parou('a Etapa 3 não está aberta');
    return continua3({ partes: partesNaTela() });
  };
  async function continua3(info) {
    if (inesperados.length) return parou('mensagem inesperada do JD', Object.assign({ inesperados }, info));
    escuta([]);
    const b = botao('Continuar');
    if (b.length !== 1) return parou('botão Continuar não encontrado na Etapa 3', info);
    const ok = await navega(() => b[0].click(), '/jd/rpv/cadastro/tela_4.wsp');
    if (!ok) return parou('o Continuar não levou à Etapa 4', Object.assign({ tela: caminho(), inesperados }, info));
    return saida(Object.assign({ ok: true, tela: 'Etapa 4' }, info));
  }

  // ---------------------------------------------------------------- Etapa 4 (valores)
  // Cabeçalho do bloco a que pertence um campo ("Autor : NOME", "Escritório Advocatício do Autor: NOME" …).
  function cabecalho(campo) {
    const e = el(campo);
    if (!e) return '';
    let p = e.closest('table');
    while (p) {
      p = p.parentElement ? p.parentElement.closest('table') : null;
      if (p) { const m = p.innerText.match(/(Autor|Advogado\/Procurador do Autor|Escrit[óo]rio Advocat[íi]cio[^:]*|R[ée]u)\s*:\s*([^\t\n]+)/); if (m) return m[0].trim(); }
    }
    return '';
  }
  function blocoDe(nome, sufixo) {
    for (let n = 1; n <= 30; n++) {
      const c = 'tmp.rpv[' + n + '].' + sufixo;
      if (!el(c)) continue;
      const cab = cabecalho(c);
      if (norm(cab).includes(norm(nome))) return n;
      if (/Escrit[óo]rio/i.test(cab) && mesmaSociedade(cab.replace(/^[^:]*:\s*/, ''), nome)) return n;
    }
    return 0;
  }
  // d = { tipo, dataBase, total, nomeBenef (autor, escritório/advogado da sucumbência ou JF),
  //       principal, juros?, selic?, pctDestaque? (ex.: 30), nm? { ant: {meses, valor}, cor: {meses, valor} } }
  //   nm: valores por exercício como na planilha (bruto); com destaque, o script aplica o líquido (100 - pct) a cada
  //   exercício e ajusta os centavos no exercício corrente (regra do usuário, 13/10/2026).
  EX.etapa4 = async function (d) {
    if (caminho() !== '/jd/rpv/cadastro/tela_4.wsp') return parou('a Etapa 4 não está aberta');
    escuta([]);
    if (valor('tmp.dt_calculo') !== d.dataBase) return parou('data-base na Etapa 4 (' + valor('tmp.dt_calculo') + ') diferente da decidida (' + d.dataBase + ')');
    if (valor('tmp.rpv.tp_percentual_juros') !== 'L') { marca('tmp.rpv.tp_percentual_juros', 'L'); await sleep(400); }
    if (valor('tmp.rpv.tp_percentual_juros') !== 'L') return parou('compensação da mora não ficou em Selic');
    let pref;
    let n;
    if (d.tipo === 'sucumbencia') {
      n = blocoDe(d.nomeBenef, 'vl_valor_pago_sucumbencia_principal');
      if (!n) return parou('bloco do beneficiário da sucumbência não localizado: ' + d.nomeBenef);
      pref = 'tmp.rpv[' + n + '].vl_valor_pago_sucumbencia_';
    } else {
      n = blocoDe(d.nomeBenef, 'vl_valor_pago_principal');
      if (!n) return parou('bloco do autor não localizado: ' + d.nomeBenef);
      pref = 'tmp.rpv[' + n + '].vl_valor_pago_';
    }
    poe(pref + 'principal', d.principal);
    if (d.juros && cent(d.juros)) poe(pref + 'juros', d.juros);
    if (d.selic && cent(d.selic)) poe(pref + 'selic', d.selic);
    await sleep(900);
    if (inesperados.length) return parou('mensagem inesperada do JD ao lançar os valores', { inesperados });
    // Devolvida refeita com troca do beneficiário do destaque: o JD lança o contratual no novo beneficiário, mas
    // mantém no antigo (agora com 0,00 %) o valor da gravação anterior (testado em 16/10/2026). Com
    // d.zeraContratual = [nomes], o valor contratual desses beneficiários vai a 0,00.
    for (const nome of d.zeraContratual || []) {
      let achou = false;
      for (let k = 1; k <= 30; k++) {
        const c = 'tmp.rpv[' + k + '].vl_valor_pago_contratual_principal';
        if (!el(c) || norm(cabecalho(c).replace(/^[^:]*:\s*/, '')) !== norm(nome)) continue;
        achou = true;
        ['principal', 'juros', 'selic'].forEach((p) => { const n = 'tmp.rpv[' + k + '].vl_valor_pago_contratual_' + p; if (el(n) && cent(valor(n))) poe(n, '0,00'); });
        await sleep(500);
        if (['principal', 'juros', 'selic'].some((p) => cent(valor('tmp.rpv[' + k + '].vl_valor_pago_contratual_' + p)))) return parou('o valor contratual de ' + nome + ' não ficou em 0,00');
      }
      if (!achou) return parou('bloco de ' + nome + ' não localizado para zerar o valor contratual');
    }
    if (inesperados.length) return parou('mensagem inesperada do JD ao zerar o valor contratual', { inesperados });

    // Soma do que ficou preenchido: autor (líquido + honorário destacado) e sucumbência. O valor contratual do
    // advogado/escritório repete o honorário destacado do autor (o JD separa sozinho) e não entra na soma.
    const preenchidos = [...D().querySelectorAll('input[name^="tmp.rpv["]')].filter((e) => e.type !== 'hidden' && /vl_(valor_pago|honorario)_/.test(e.name) && cent(e.value));
    const soma = preenchidos.reduce((s, e) => s + (!/contratual/.test(e.name) && /(principal|juros|selic|multa|encargo)/.test(e.name) ? cent(e.value) : 0), 0);
    const valores = preenchidos.map((e) => e.name.replace('tmp.rpv', '') + ' ' + e.value + ' (' + cabecalho(e.name) + ')');
    if (soma !== cent(d.total)) return parou('a soma dos valores na tela (' + brl(soma) + ') difere do total decidido (' + d.total + ')', { valores });

    // NM (só parte autora).
    let nm = null;
    if (d.tipo === 'autora') {
      if (!d.nm) return parou('NM não informado para a parte autora');
      const liq = ['principal', 'juros', 'selic'].reduce((s, k) => s + cent(valor('tmp.rpv[' + n + '].vl_valor_pago_' + k)), 0);
      const ant = d.nm.ant && d.nm.ant.meses ? d.nm.ant : null;
      const cor = d.nm.cor && d.nm.cor.meses ? d.nm.cor : null;
      if ((ant ? cent(ant.valor) : 0) + (cor ? cent(cor.valor) : 0) !== cent(d.total)) return parou('os valores por exercício do cálculo não somam o total decidido (' + d.total + ')');
      let vAnt = 0, vCor = 0;
      if (ant && cor) {
        vAnt = d.pctDestaque ? Math.round(cent(ant.valor) * (100 - d.pctDestaque) / 100) : cent(ant.valor);
        vCor = liq - vAnt;
      } else if (ant) vAnt = liq;
      else if (cor) vCor = liq;
      else return parou('NM sem meses em nenhum exercício');
      if (!d.pctDestaque && ((ant && vAnt !== cent(ant.valor)) || (cor && vCor !== cent(cor.valor)))) return parou('sem destaque, os valores por exercício do cálculo não somam o valor do autor', { liq: brl(liq) });
      if (ant) { poe('tmp.rpv[' + n + '].nr_mes_exerc_anterior', String(ant.meses)); poe('tmp.rpv[' + n + '].vl_exerc_anterior', brl(vAnt)); }
      if (cor) { poe('tmp.rpv[' + n + '].nr_mes_exerc_corrente', String(cor.meses)); poe('tmp.rpv[' + n + '].vl_exerc_corrente', brl(vCor)); }
      await sleep(500);
      nm = { liquido: brl(liq), anterior: ant ? ant.meses + ' / ' + brl(vAnt) : '-', corrente: cor ? cor.meses + ' / ' + brl(vCor) : '-' };
      if (inesperados.length) return parou('mensagem inesperada do JD ao lançar o NM', { inesperados, nm });
    }

    // Requisição devolvida (ou execução acompanhada): d.pausa = true para antes do "Gravar"; depois, EX.grava4(total).
    if (d.pausa) return saida({ ok: true, pausado: 'antes do Gravar da Etapa 4', valores, nm });

    // Gravar: só as duas confirmações esperadas, a primeira com o valor exato.
    escuta([{ re: new RegExp('Valor do requisit[óo]rio \\(R\\$\\)\\s*:\\s*' + esc(d.total) + '\\s[\\s\\S]*Confirmar Opera', 'i'), nome: 'valor do requisitório' }, RE_EXCLUI]);
    const g = botao('Gravar');
    if (g.length !== 1) return parou('botão Gravar não encontrado na Etapa 4');
    const ok = await navega(() => g[0].click(), '/jd/rpv/cadastro/tela_5.wsp', 30000);
    const dial = EX.log.slice(-3).map((x) => x.tipo + (x.ok ? ' OK' : ' RECUSADO') + ': ' + x.msg.replace(/\s+/g, ' '));
    if (!ok || inesperados.length) return parou('a gravação da Etapa 4 não levou à Etapa 5', { tela: caminho(), inesperados, dial, valores, nm });
    const r = nrEId();
    return saida({ ok: true, tela: 'Etapa 5', nr: r.nr, id: r.id, valores, nm, dial });
  };
  // "Gravar" da Etapa 4 depois de EX.etapa4({..., pausa: true}) e do OK do usuário, com as mesmas 2 confirmações.
  EX.grava4 = async function (total) {
    if (caminho() !== '/jd/rpv/cadastro/tela_4.wsp') return parou('a Etapa 4 não está aberta');
    escuta([{ re: new RegExp('Valor do requisit[óo]rio \\(R\\$\\)\\s*:\\s*' + esc(total) + '\\s[\\s\\S]*Confirmar Opera', 'i'), nome: 'valor do requisitório' }, RE_EXCLUI]);
    const g = botao('Gravar');
    if (g.length !== 1) return parou('botão Gravar não encontrado na Etapa 4');
    const ok = await navega(() => g[0].click(), '/jd/rpv/cadastro/tela_5.wsp', 30000);
    const dial = EX.log.slice(-3).map((x) => x.tipo + (x.ok ? ' OK' : ' RECUSADO') + ': ' + x.msg.replace(/\s+/g, ' '));
    if (!ok || inesperados.length) return parou('a gravação da Etapa 4 não levou à Etapa 5', { tela: caminho(), inesperados, dial });
    const r = nrEId();
    return saida({ ok: true, tela: 'Etapa 5', nr: r.nr, id: r.id, dial });
  };

  // ---------------------------------------------------------------- Ofício e Enviar para Conferência
  EX.oficio = async function (id) {
    const i = id || nrEId().id;
    if (!i) return parou('id da requisição não localizado na tela');
    escuta([]);
    const ok = await navega(() => { P().location.href = '/jd/rpv/cadastro/imprimir.wsp?tmp.rpv.id_rpv=' + i; }, '/jd/rpv/cadastro/imprimir.wsp');
    if (!ok) return parou('o ofício não abriu');
    await espera(() => /REQUISI[ÇC][ÃA]O DE PAGAMENTO\s+\d/.test(D().body.innerText), 8000);
    const t = D().body.innerText.split('\n').map((s) => s.replace(/[ \t ]+/g, ' ').trim()).filter(Boolean).join(' | ');
    const g = (re) => { const m = t.match(re); return m ? m[1].trim() : '?'; };
    const ini = t.search(/Tipo \| Benefici[áa]rio|Tipo Benefici/);
    const fim = t.indexOf('Valor Total Requisitado');
    const benef = (ini >= 0 && fim > ini ? t.slice(ini, fim) : '')
      .replace(/(Valor (Juros|Selic|Multa|Principal|Total)|Encargos): - \| ?/g, '').replace(/Valor Principal: /g, 'P ').replace(/Valor Juros: /g, 'J ')
      .replace(/Valor Selic: /g, 'S ').replace(/Valor Total: /g, 'T ').replace(/(\| )+/g, '| ').slice(0, 1500);
    EX.ultimoOficio = { id: i, texto: t };
    return saida({
      ok: true, id: i,
      situacao: g(/Situa[çc][ãa]o Atual: \|? ?([^|]+?)(?: Data Atual| \|)/), nr: g(/REQUISI[ÇC][ÃA]O DE PAGAMENTO\s+([\d.]+)/),
      tipo: g(/Tipo de Requisi[çc][ãa]o: ([^|]+?)(?: Natureza|\|)/), natureza: g(/Natureza do Cr[ée]dito: ([^|]+)/), processo: g(/Processo de Execu[çc][ãa]o: ([\d.\-]+)/),
      beneficiarios: benef, total: g(/Valor Total Requisitado \(R\$\)\s*\|?\s*([\d.,]+)/), mora: g(/Compensa[çc][ãa]o da Mora: ([^|]+)/),
      dataBase: g(/Data-base: ([\d/]+)/), ajuizamento: g(/Ajuizamento do Processo de Conhecimento: ([\d/]+)/), transito: g(/Processo de Conhecimento: ([\d/]+) \| Natureza/),
      assunto: g(/Natureza da Obriga[çc][ãa]o\/Assunto: ([^|]+)/), embargos: g(/Oposi[çc][ãa]o de Embargos: ([\d/]+)/), somenteAdv: g(/Cr[ée]dito somente advogado: ([^|]+)/),
      observacoes: g(/Observa[çc][õo]es: \|? ?(.*?)\| Esta RPV/),
    });
  };
  EX.conferencia = async function (nr, total) {
    if (caminho() !== '/jd/rpv/cadastro/imprimir.wsp') return parou('o ofício não está aberto no frame principal: chame EX.oficio() antes');
    const t = D().body.innerText;
    const sit = (t.match(/Situa[çc][ãa]o Atual:\s*([^\t\n]+)/) || [])[1] || '?';
    const nrT = (t.match(/REQUISI[ÇC][ÃA]O DE PAGAMENTO\s+([\d.]+)/) || [])[1] || '?';
    const totT = (t.match(/Valor Total Requisitado \(R\$\)\s*([\d.,]+)/) || [])[1] || '?';
    // Devolvida refeita: depois do "Gravar" ela continua "Devolvida" até o envio (testado em 16/10/2026).
    const devolvidaOk = /Devolvida/.test(sit) && devAutorizada(nr);
    if (!(/Em Elabora/.test(sit) || devolvidaOk) || nrT !== nr || totT !== total) return parou('o ofício aberto não é o esperado', { situacao: sit, nr: nrT, total: totT });
    const b = D().getElementById('btn_conferir');
    const oc = b ? b.getAttribute('onclick') || '' : '';
    if (!b || !/Enviar para Confer/.test(b.value) || !new RegExp("conferir\\(\\d+,\\s*'" + esc(nr) + "'\\)").test(oc)) return parou('botão "Enviar para Conferência" não confere com a requisição', { onclick: oc });
    escuta([RE_ENVIO]);
    const ok = await navega(() => b.click(), '/jd/rpv/cadastro/imprimir.wsp', 30000);
    const t2 = D().body.innerText;
    const sit2 = (t2.match(/Situa[çc][ãa]o Atual:\s*([^\t\n]+)/) || [])[1] || '?';
    const nr2 = (t2.match(/REQUISI[ÇC][ÃA]O DE PAGAMENTO\s+([\d.]+)/) || [])[1] || '?';
    if (!ok || inesperados.length || !/Em Confer/.test(sit2) || nr2 !== nr) return parou('o envio para conferência não se confirmou', { situacao: sit2, nr: nr2, inesperados });
    return saida({ ok: true, nr, situacao: sit2.trim(), hora: new Date().toLocaleString('pt-BR') });
  };

  // Nenhuma exceção escapa: vira PAROU com a mensagem, para a análise parar ali.
  ['menu', 'cadastrar', 'sai', 'dup', 'etapa1', 'etapa2', 'etapa3', 'continua3', 'etapa4', 'oficio', 'conferencia', 'devolvidas', 'abreDevolvida', 'continua1', 'grava4'].forEach((k) => {
    const f = EX[k];
    if (f.__seguro) return;
    EX[k] = async (...a) => { try { return await f(...a); } catch (e) { return parou('erro no script: ' + String(e).slice(0, 200), { tela: caminho(), inesperados }); } };
    EX[k].__seguro = true;
  });

  EX.dialogos = () => saida(EX.log);
  EX.limpa = () => { delete window.__EX; delete window.EX; return 'EX apagado'; };
  return 'EX v' + EX.versao + ' carregado';
})();
