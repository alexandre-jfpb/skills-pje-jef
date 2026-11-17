// analise-lote.js — jef-analise-inicial, passagem pelo PJe (desenvolvido na 7ª Vara Federal da Paraíba)
//
// Carregado na página estática do próprio PJe, que não redireciona:
// https://pje1g.trf5.jus.br/pje/js/pdfjs/web/locale/locale.json
// A consulta e os autos abrem num iframe oculto, no mesmo domínio, um processo por vez.
//
// SÓ LÊ, e baixa os autos em PDF quando autorizado: para cada processo, lê na tela (com data e hora da leitura)
// a tarefa atual, as etiquetas, os detalhes do cabeçalho (classe, assunto, autuação, valor da causa, segredo de
// justiça, justiça gratuita, tutela/liminar, prioridade), o polo ativo e o cadastro das partes (polo passivo e
// outros interessados, com CNPJ, qualidade e procuradorias). Com baixar = true (só depois da autorização do
// usuário para o lote), baixa os autos completos em ordem crescente, sem expedientes e sem movimentos (o mesmo
// formulário do botão "Download" do painel "Download autos do processo") e salva como <número do processo>.pdf
// na pasta Downloads. Lê também o teor dos documentos que ficam fora da cronologia, que o PDF não traz.
// Nunca clica em MARCAR TODOS COMO LIDOS nem em nada além da consulta e do download.
// O texto dos autos é extraído do PDF no computador (indexa-autos.ps1), não documento a documento no PJe.
//
// Uso (cada linha é uma chamada do javascript_tool, sem trocar a página de cima):
//   window.__AI.config({ cadastroOI: { nome, cnpj, procuradoria } })
//                              -> configuração da unidade (o JSON gerado de docs/configuracao-unidade.md; ver SKILL.md,
//                                 "Como a configuração chega aos scripts"); obrigatória antes do inicia
//   window.__AI.inicia(['0000000-00.2026.4.05.0000', ...], base, baixar) -> base = posição do 1º processo - 1
//   window.__AI.estado()       -> feitos/total, rodando ou parado, motivo, tempo
//   window.__AI.mostra(a, b)   -> põe as linhas dos processos nº a..b num <pre id="__out">;
//                                 leia com get_page_text (o javascript_tool corta em ~1.200 caracteres)
//   window.__AI.salva(a, b)    -> salva as linhas dos processos nº a..b, já no formato do arquivo de andamento
//                                 ("T|<processo>|..."), em Downloads\AI_tela_<hora>.txt
//   window.__AI.para()         -> interrompe depois do processo em curso
//   await window.__AI.texto(id) -> teor de um documento (o guardado, ou baixado agora) no <pre>
//
// Linhas de cada processo (no <pre>):
//   #<nº> <processo>|lido DD/MM/AAAA HH:MM|tarefa <tarefa atual>|etiquetas <...>|naoLidos <n>|docs <n> [+ <n> de id negativo]
//   DET: classe, assunto, autuação, valor da causa, segredo de justiça, justiça gratuita, tutela/liminar, prioridade
//   PA:  polo ativo, como na tela
//   PP:  polo passivo, como na tela
//   OI:  outros interessados, como na tela
//   CAD: regular | IRREGULAR — <defeitos> | VERIFICAR — <o que conferir> (apontamento; o veredito oficial é o de confere-cadastro.ps1)
//   PDF: <número>.pdf <MB> MB baixado | não baixado (motivo) | não pedido
//   IDS: todos os documentos do processo (listaIdsDocumentos, sem os ids negativos), para conferir com o índice do PDF
//   NEG: ids negativos da listaIdsDocumentos (documentos vindos da Turma Recursal), cada um com o id da cronologia
//        que tem o mesmo documento (-<id na Turma>→<id na cronologia>); SEM PAR = ler pela tela. Não são baixados.
//   EXTRA <id> [tipo, tamanho]: teor de documento fora da cronologia, que não entra no PDF baixado
//                               (ex.: decisão de redistribuição por prevenção de outra vara)
//   X|<processo>|<motivo>  -> não lido
(() => {
  const AI = (window.__AI = window.__AI || {});
  AI.versao = 2;

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

  // Configuração da unidade (padrão vazio): o órgão de cumprimento do INSS esperado em Outros interessados.
  AI.cfg = AI.cfg || {};
  const vazio = (v) => !v || !String(v).trim() || /^PENDENTE$/i.test(String(v).trim());
  const faltaCfg = () => { const c = AI.cfg.cadastroOI || {}; return ['nome', 'cnpj', 'procuradoria'].filter((k) => vazio(c[k])).map((k) => 'cadastroOI.' + k); };
  AI.config = function (c) {
    AI.cfg = Object.assign({}, AI.cfg, c || {});
    const f = faltaCfg();
    return f.length ? 'configuração incompleta: falta ' + f.join(', ') : 'configuração recebida: ' + AI.cfg.cadastroOI.nome + ' - CNPJ: ' + AI.cfg.cadastroOI.cnpj;
  };

  AI.res = AI.res || {};
  AI.ord = AI.ord || {};
  AI.txt = AI.txt || {};
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const limpa = (s) => s.replace(/https?:\/\/\S+/g, '[URL]').replace(/\S*[?&]\w+=\S*/g, '[Q]').replace(/\b[0-9a-f]{20,}\b/gi, '[H]').replace(/\s+/g, ' ').trim();

  let pdfjs = null;
  const pdf = async () => {
    if (!pdfjs) { pdfjs = await import('/pje/js/pdfjs/build/pdf.mjs'); pdfjs.GlobalWorkerOptions.workerSrc = '/pje/js/pdfjs/build/pdf.worker.mjs'; }
    return pdfjs;
  };
  // Teor de um documento avulso (os que ficam fora da cronologia não entram no PDF baixado). Um por vez, com
  // meio segundo entre um e outro: mais que isso faz o PJe bloquear por 10 minutos (429).
  let ultimo = 0;
  async function leDoc(id) {
    const e = 500 - (Date.now() - ultimo);
    if (e > 0) await sleep(e);
    ultimo = Date.now();
    try {
      const r = await fetch('/pje/seam/resource/rest/pje-legacy/documento/download/' + id, { credentials: 'include' });
      if (r.status === 429) { AI.bloqueado = true; return { ct: 'erro', text: 'HTTP 429' }; }
      if (!r.ok) return { ct: 'erro', text: 'HTTP ' + r.status };
      const buf = await r.arrayBuffer();
      if (new TextDecoder('latin1').decode(buf.slice(0, 5)) === '%PDF-') {
        const doc = await (await pdf()).getDocument({ data: new Uint8Array(buf) }).promise;
        let out = '';
        for (let i = 1; i <= Math.min(doc.numPages, 30); i++) { const tc = await (await doc.getPage(i)).getTextContent(); out += '[p' + i + '] ' + tc.items.map((x) => x.str).join(' ') + ' '; }
        const np = doc.numPages;
        doc.destroy();
        out = limpa(out);
        return { ct: 'PDF ' + np + 'p', text: /^(\[p\d+\]\s*)+$/.test(out) ? '' : out };
      }
      const h = new TextDecoder('utf-8').decode(buf);
      if (/Acesso temporariamente bloqueado/i.test(h)) { AI.bloqueado = true; return { ct: 'erro', text: 'HTTP 429' }; }
      const dd = new DOMParser().parseFromString(h, 'text/html');
      dd.querySelectorAll('style,script').forEach((x) => x.remove());
      return { ct: 'HTML', text: limpa(dd.body ? dd.body.textContent : h) };
    } catch (err) { return { ct: 'erro', text: String(err).slice(0, 60) }; }
  }
  const sp = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const agora = () => { const n = new Date(), z = (v) => String(v).padStart(2, '0'); return z(n.getDate()) + '/' + z(n.getMonth() + 1) + '/' + n.getFullYear() + ' ' + z(n.getHours()) + ':' + z(n.getMinutes()); };

  function quadro() {
    let f = document.getElementById('__aiQ');
    if (!f) { f = document.createElement('iframe'); f.id = '__aiQ'; f.style.cssText = 'position:fixed;left:-12000px;top:0;width:1280px;height:900px;border:0'; document.body.appendChild(f); }
    return f;
  }
  const docQ = (f) => { try { const d = f.contentDocument; return d && d.location && d.location.host === location.host ? d : null; } catch (e) { return null; } };
  async function espera(fn, ms) { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { const v = fn(); if (v) return v; } catch (e) { } await sleep(400); } return null; }
  function carrega(f, url) {
    return new Promise((res) => {
      let ok = false;
      const fim = (v) => { if (!ok) { ok = true; f.removeEventListener('load', fim); res(v !== false); } };
      f.addEventListener('load', fim);
      f.src = url;
      setTimeout(() => fim(false), 60000);
    });
  }

  // O aviso vem no singular quando há um só documento ("Há 1 documento não lido") e no plural ("documento(s)").
  AI.naoLidos = (d) => { const m = d.body.innerText.match(/H[áa] (\d+) documentos?(\(s\))? n[ãa]o lido/i); return m ? +m[1] : 0; };

  async function abre(num) {
    const f = quadro();
    const m = num.match(/^(\d{7})-(\d{2})\.(\d{4})\.\d\.\d{2}\.(\d{4})$/);
    if (!m) return { erro: 'número em formato inválido' };
    await carrega(f, '/pje/Processo/ConsultaProcesso/listView.seam');
    const campo = await espera(() => { const d = docQ(f); return d && d.getElementById('fPP:numeroProcesso:numeroSequencial'); }, 25000);
    if (!campo) {
      const d0 = docQ(f);
      if (d0 && /bloquead/i.test(d0.body.innerText)) return { bloqueio: true };
      return d0 && !d0.querySelector('input[type=password]') ? { erro: 'a consulta processual não carregou' } : { login: true };
    }
    const d = docQ(f);
    const poe = (id, v) => { const e = d.getElementById(id); e.value = v; e.dispatchEvent(new Event('change', { bubbles: true })); };
    poe('fPP:numeroProcesso:numeroSequencial', m[1]);
    poe('fPP:numeroProcesso:numeroDigitoVerificador', m[2]);
    poe('fPP:numeroProcesso:Ano', m[3]);
    poe('fPP:numeroProcesso:NumeroOrgaoJustica', m[4]);
    d.getElementById('fPP:searchProcessos').click();
    const link = await espera(() => { const dd = docQ(f); return dd && [...dd.querySelectorAll('a')].find((x) => x.textContent.includes(num)); }, 30000);
    if (!link) {
      const dd = docQ(f);
      if (!dd) return { login: true };
      return { naoAchou: true, motivo: /nenhum|n[ãa]o (foi )?encontrad/i.test(dd.body.innerText) ? 'não encontrado na consulta processual' : 'a consulta não devolveu resultado' };
    }
    // Os autos abririam em janela nova: redireciona para o próprio iframe.
    f.contentWindow.open = (u) => { f.contentWindow.location.assign(u); return f.contentWindow; };
    link.click();
    const autos = await espera(() => { const dd = docQ(f); return dd && dd.title.includes(num) && dd.getElementById('divTimeLine') ? dd : null; }, 50000);
    if (!autos) return docQ(f) ? { erro: 'os autos não abriram' } : { login: true };
    await sleep(1200);
    return { d: docQ(f), w: f.contentWindow };
  }
  AI.abre = abre;

  // Cadastro correto: INSS (CNPJ 29.979.036/0001-40) no polo passivo, com a PGF/AGU; o órgão de cumprimento configurado
  // (AI.cfg.cadastroOI: nome e CNPJ como na tela) em outros interessados, como órgão de cumprimento, com a procuradoria
  // configurada (AI.cfg.cadastroOI.procuradoria).
  // ATENÇÃO: o veredito OFICIAL é o de confere-cadastro.ps1 (mesmas regras, em PowerShell). Esta função só dá o
  // apontamento na tela e DEVE ficar idêntica a ele. A grafia do NOME do INSS não é irregularidade (vale o CNPJ + a PGF).
  // Saídas: 'regular' | 'IRREGULAR — <defeitos objetivos>' | 'VERIFICAR — <o que um humano deve conferir>'.
  function cadastro(pp, oi) {
    if (faltaCfg().length) return 'NÃO VERIFICADO — configure a unidade antes (window.__AI.config)';
    const irreg = [], verif = [];
    const p = pp.replace(/^Polo passivo\s*/i, '').trim();
    let o = (oi || '').replace(/^Outros Interessados\s*/i, '').trim();
    const reInss = /CNPJ:\s*29\.979\.036\/0001-40/;
    if (!reInss.test(p)) irreg.push('polo passivo sem o INSS com CNPJ 29.979.036/0001-40');
    else {
      const depois = p.split(reInss)[1] || '';
      const prox = depois.indexOf('CNPJ:');
      const seg = prox >= 0 ? depois.slice(0, prox) : depois;
      if (!/Procuradoria Geral Federal \(PGF\/AGU\)/.test(seg)) irreg.push('polo passivo: INSS sem a PGF/AGU vinculada');
    }
    if (/CNPJ:\s*(?!29\.979\.036\/0001-40)[\d./-]+/.test(p)) irreg.push('polo passivo com outro ente além do INSS (CNPJ diferente)');
    if (/CEAB/i.test(p)) irreg.push('CEAB-DJ no polo passivo');
    const m = p.match(/^(.*?)CNPJ:\s*29\.979\.036\/0001-40\s*\(REU\)(\s*Procuradoria Geral Federal \(PGF\/AGU\))?(\s*\(REPRESENTANTE\))?(.*)$/);
    if (m) {
      let sobra = m[4].trim();
      const u = m[1].lastIndexOf(')');
      if (u >= 0) sobra = (m[1].slice(0, u + 1).trim() + ' ' + sobra).trim();
      if (sobra && !irreg.some(x => /outro ente|CEAB/.test(x))) {
        const resto = sobra.replace(/Procuradoria Geral Federal \(PGF\/AGU\)/g, '').replace(/\(REPRESENTANTE\)/g, '').trim();
        if (resto) irreg.push('polo passivo com ente a mais além do INSS: "' + sobra + '"');
        else verif.push('polo passivo: a PGF/AGU aparece repetida também como representante ("' + sobra + '")');
      }
    }
    let comMPF = false;
    const C = AI.cfg.cadastroOI;
    const idOI = C.nome + ' - CNPJ: ' + C.cnpj;
    if (!o || /^\(?nenhum\)?$/i.test(o) || /^\[?ausente\]?$/i.test(o)) irreg.push('outros interessados vazio: faltam a ' + C.nome + ' e a ' + C.procuradoria);
    else {
      // O MPF como fiscal da lei (ex.: parte menor ou incapaz) não é desvio do cadastro: só é anotado.
      const mpf = /MINIST[ÉE]RIO P[ÚU]BLICO FEDERAL - MPF - CNPJ: [\d./-]+ \(FISCAL DA LEI\)( Procuradoria da Rep[úu]blica \(MPF\))?/i;
      if (mpf.test(o)) { comMPF = true; o = o.replace(mpf, '').trim(); }
      const ceab = idOI + ' (ÓRGÃO DE CUMPRIMENTO) ' + C.procuradoria;
      if (o.includes(ceab)) {
        const resto = o.replace(ceab, '').trim();
        if (resto) verif.push('outros interessados com ente a mais além da ' + C.nome + ': "' + resto + '"');
      } else if (!o.includes(idOI)) irreg.push('outros interessados sem a ' + C.nome + ' com CNPJ ' + C.cnpj);
      else {
        if (!/\(ÓRGÃO DE CUMPRIMENTO\)/.test(o)) irreg.push(C.nome + ' sem a qualidade de órgão de cumprimento');
        if (!o.includes(C.procuradoria)) irreg.push(C.nome + ' sem a ' + C.procuradoria + ' vinculada');
        if (!irreg.length && !verif.length) verif.push('outros interessados com texto diferente do padrão: "' + o + '"');
      }
    }
    const nota = comMPF ? ' (com o MPF, fiscal da lei, em outros interessados)' : '';
    if (irreg.length) return 'IRREGULAR — ' + irreg.concat(verif).join('; ') + nota;
    if (verif.length) return 'VERIFICAR — ' + verif.join('; ') + nota;
    return 'regular' + nota;
  }
  // Autos completos em PDF: o mesmo formulário do botão "Download", em ordem crescente, sem expedientes e
  // sem movimentos. Confere que veio um PDF antes de salvar como <número>.pdf.
  async function baixaPDF(num, d, w) {
    const sel = d.getElementById('navbar:cbCronologia'), ex = d.getElementById('navbar:cbExpediente'), mv = d.getElementById('navbar:cbMovimentos');
    const bt = d.getElementById('navbar:downloadProcesso');
    if (!sel || !bt || !bt.form) return 'não baixado (painel de download não encontrado)';
    sel.value = 'ASC';
    if (ex) ex.value = 'false';
    if (mv) mv.value = 'false';
    const fd = new w.FormData(bt.form, bt);
    const ctl = new AbortController();
    const tm = setTimeout(() => ctl.abort(), 240000);
    try {
      const r = await fetch(bt.form.action, { method: 'POST', body: new URLSearchParams(fd), credentials: 'include', signal: ctl.signal });
      if (r.status === 429) { AI.bloqueado = true; return 'não baixado (HTTP 429)'; }
      if (!r.ok) return 'não baixado (HTTP ' + r.status + ')';
      const buf = await r.arrayBuffer();
      if (new TextDecoder('latin1').decode(buf.slice(0, 5)) !== '%PDF-') {
        const h = new TextDecoder('utf-8').decode(buf.slice(0, 20000));
        if (/Acesso temporariamente bloqueado/i.test(h)) { AI.bloqueado = true; return 'não baixado (HTTP 429)'; }
        return 'não baixado (a resposta não é PDF' + (/type=["']?password|Bem vindo ao PJe/i.test(h) ? ': login' : '') + ')';
      }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([buf], { type: 'application/pdf' }));
      a.download = num + '.pdf';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 60000);
      return num + '.pdf ' + (buf.byteLength / 1048576).toFixed(1) + ' MB baixado';
    } catch (e) { return 'não baixado (' + String(e).slice(0, 60) + ')'; } finally { clearTimeout(tm); }
  }

  async function analisa(num, baixar) {
    const ab = await abre(num);
    if (ab.login) return { login: true };
    if (ab.bloqueio) return { bloqueio: true };
    if (ab.erro || ab.naoAchou) return { txt: 'X|' + num + '|' + (ab.erro || ab.motivo) };
    const d = ab.d;
    const lido = agora();
    const txt = (id) => sp((d.getElementById(id) || {}).textContent);
    // "Segredo de justiça? SIM/NÃO", prioridade etc. ficam no menu oculto de detalhes do cabeçalho (#maisDetalhes).
    const det = txt('maisDetalhes').replace(/ Órgão julgador .*$/, '');
    const pa = txt('poloAtivo'), pp = txt('poloPassivo'), oi = txt('outrosInteressados');
    const etq = [...d.querySelectorAll('[id="navbar:listaTags"] td')].map((e) => sp(e.textContent)).filter(Boolean);
    const nl = AI.naoLidos(d);
    const scr = [...d.querySelectorAll('script')].map((s) => s.textContent).join('\n');
    // Processo que voltou da Turma Recursal traz na lista também ids NEGATIVOS (v2, 15/10/2026). Até a v1 a expressão não
    // aceitava o sinal e não casava: saíam "docs ?", IDS vazio e nenhum EXTRA, sem aviso. O id negativo é o que o documento
    // tinha na Turma, com o sinal trocado: o mesmo documento está na cronologia com id próprio, positivo, e o título
    // "… - ID de origem <id>". Por isso o negativo não é baixado nem vai para a linha IDS (o indexador só lê dígitos):
    // sai na linha NEG, com o id da cronologia que tem o mesmo documento, ou SEM PAR (ler pela tela). Nunca tirar o
    // sinal para baixar: o mesmo número, positivo, é outro documento do PJe.
    const lm = scr.match(/listaIdsDocumentos\s*=\s*\[([-\d,\s]*)\]/);
    const todos = lm ? lm[1].split(',').map((s) => s.trim()).filter(Boolean) : [];
    const ids = todos.filter((id) => id[0] !== '-'), neg = todos.filter((id) => id[0] === '-');
    const nd = lm ? ids.length + (neg.length ? ' + ' + neg.length + ' de id negativo' : '') : '?';
    // Documentos fora da cronologia (ex.: decisão de redistribuição por prevenção de outra vara) não entram no
    // PDF baixado: o teor é lido aqui. Se faltarem muitos, a cronologia veio parcial — compare com o índice.
    const tl = d.getElementById('divTimeLine').innerText;
    const naTL = new Set((tl.match(/^\s*\d{8,10}(?= - )/gm) || []).map((s) => s.trim()));
    const par = {};
    for (const x of tl.matchAll(/^\s*(\d{8,10}) - .*?ID de origem:? ?(\d+)/gim)) par['-' + x[2]] = x[1];
    const fora = ids.filter((id) => !naTL.has(id));
    const extras = [];
    for (const id of fora.slice(0, 6)) {
      const x = await leDoc(id);
      if (AI.bloqueado) return { bloqueio: true };
      AI.txt[id] = x.text;
      extras.push('EXTRA ' + id + ' [' + x.ct + ', ' + x.text.length + ' caracteres]: ' + x.text.slice(0, 700));
    }
    if (fora.length > 6) extras.push('EXTRA: mais ' + (fora.length - 6) + ' documentos fora da cronologia (' + fora.slice(6).join(',') + ') — a cronologia pode ter vindo parcial: comparar com o índice');
    // Tarefa atual: só aparece pelo menu "Exibir tarefa atual do processo" (janela que só exibe, não grava).
    let tarefa = '?';
    const lk = d.getElementById('navbar:linkExibirTarefaAtualProcesso');
    if (lk) {
      lk.click();
      tarefa = (await espera(() => { const m = d.body.textContent.replace(/\s+/g, ' ').match(/\[JEF\][^\[\]{}<>;=?&/]{3,60}/); return m ? m[0].trim() : null; }, 10000)) || '?';
    }
    const pdf = baixar ? await baixaPDF(num, d, ab.w) : 'não pedido';
    if (AI.bloqueado) return { bloqueio: true };
    const L = [];
    L.push(num + '|lido ' + lido + '|tarefa ' + tarefa + '|etiquetas ' + (etq.join(', ') || 'nenhuma') + '|naoLidos ' + nl + '|docs ' + nd);
    L.push('DET: ' + det);
    L.push('PA: ' + pa.replace(/^Polo ativo\s*/i, ''));
    L.push('PP: ' + pp.replace(/^Polo passivo\s*/i, ''));
    L.push('OI: ' + (oi.replace(/^Outros Interessados\s*/i, '') || '(nenhum)'));
    L.push('CAD: ' + (pp ? cadastro(pp, oi) : 'NÃO VERIFICADO — polo passivo não lido na tela'));
    L.push('PDF: ' + pdf);
    L.push('IDS: ' + ids.join(','));
    if (neg.length) L.push('NEG: ' + neg.map((id) => id + (par[id] ? '→' + par[id] : ' SEM PAR (ler pela tela)')).join(', '));
    extras.forEach((s) => L.push(s));
    return { txt: L.join('\n') };
  }
  AI.analisa = analisa;

  // Um processo por vez. Processo já lido (sem erro) é pulado: para retomar, basta chamar inicia de novo.
  AI.inicia = function (lista, base, baixar) {
    if (AI.st && AI.st.rodando) return 'já está rodando';
    const falta = faltaCfg();
    if (falta.length) return 'configure a unidade antes de iniciar: chame window.__AI.config({ cadastroOI: { nome, cnpj, procuradoria } }) com os dados de docs/configuracao-unidade.md (falta ' + falta.join(', ') + ')';
    AI.bloqueado = false;
    const st = (AI.st = { lista, base: base || 0, i: 0, rodando: true, parada: '', t0: Date.now(), atual: '' });
    lista.forEach((num, k) => { AI.ord[num] = st.base + k + 1; });
    (async () => {
      for (; st.i < st.lista.length && !st.pedirParada; st.i++) {
        const num = st.lista[st.i];
        st.atual = num;
        if (AI.res[num] && !/^X\||não baixado/.test(AI.res[num])) continue;
        let r;
        try { r = await analisa(num, !!baixar); } catch (e) { r = { txt: 'X|' + num + '|ERRO ' + String(e).slice(0, 80) }; }
        if (r.bloqueio || AI.bloqueado) { st.parada = '429 em ' + num + ': esperar 10 minutos'; break; }
        if (r.login) { st.parada = 'login em ' + num; break; }
        AI.res[num] = r.txt;
        await sleep(4000);
      }
      if (!st.parada && st.pedirParada) st.parada = 'interrompido';
      st.rodando = false;
      st.atual = '';
    })();
    return 'AI v' + AI.versao + ': ' + lista.length + ' processos' + (baixar ? ', com download dos autos' : ', sem download');
  };

  AI.estado = function () {
    const s = AI.st;
    return (s ? s.i + '/' + s.lista.length + ' ' + (s.rodando ? 'rodando' : 'parado') + (s.parada ? ' (' + s.parada + ')' : '') + ' — '
      + Math.round((Date.now() - s.t0) / 1000) + 's' + (s.atual ? ' — em ' + s.atual : '') : 'sem lote') + ' — aba ' + document.visibilityState;
  };

  // Texto grande vai para um <pre> da página e é lido com get_page_text.
  const pre = () => {
    let p = document.getElementById('__out');
    if (!p) { p = document.createElement('pre'); p.id = '__out'; p.style.whiteSpace = 'pre-wrap'; document.body.appendChild(p); }
    // Tira o texto original da página (o JSON do locale), sem apagar o iframe do lote nem o campo de carga.
    [...document.body.childNodes].forEach((n) => { if (n !== p && !/^__(\w+Q|carga|ov)$/.test(n.id || '')) n.remove?.(); });
    return p;
  };
  const mostra = (txt) => { pre().textContent = txt.replaceAll('=', ':'); return txt.length + ' caracteres no quadro'; };
  AI.mostra = function (a, b) {
    const nums = Array.isArray(a) ? a : Object.keys(AI.ord).filter((n) => AI.ord[n] >= a && AI.ord[n] <= b).sort((x, y) => AI.ord[x] - AI.ord[y]);
    return mostra(nums.map((n) => '#' + (AI.ord[n] || '?') + ' ' + (AI.res[n] || n + '|ainda não lido')).join('\n\n'));
  };

  // Linhas dos processos nº a..b no formato do arquivo de andamento ("T|<processo>|<linha>"), salvas num .txt
  // na pasta Downloads (AI_tela_<hora>.txt), para acrescentar ao andamento sem redigitar.
  AI.salva = function (a, b) {
    const nums = Object.keys(AI.ord).filter((n) => AI.ord[n] >= a && AI.ord[n] <= b && AI.res[n]).sort((x, y) => AI.ord[x] - AI.ord[y]);
    const out = [];
    for (const n of nums) {
      if (/^X\|/.test(AI.res[n])) { out.push(AI.res[n]); continue; }
      AI.res[n].split('\n').forEach((l, k) => out.push('T|' + n + '|' + (k ? l : l.replace(n + '|', ''))));
    }
    const nome = 'AI_tela_' + new Date().toTimeString().slice(0, 8).replace(/:/g, '') + '.txt';
    const el = document.createElement('a');
    el.href = URL.createObjectURL(new Blob(['﻿' + out.join('\r\n') + '\r\n'], { type: 'text/plain;charset=utf-8' }));
    el.download = nome;
    document.body.appendChild(el);
    el.click();
    setTimeout(() => { URL.revokeObjectURL(el.href); el.remove(); }, 30000);
    return nome + ': ' + nums.length + ' processos, ' + out.length + ' linhas';
  };

  // Teor guardado de um documento lido pelo script (EXTRA) ou, se não houver, baixado agora.
  AI.texto = async function (id) {
    if (AI.txt[id] === undefined) { const x = await leDoc(id); AI.txt[id] = x.text; }
    return mostra('DOC ' + id + ' :: ' + AI.txt[id]);
  };

  AI.para = function () { if (AI.st) AI.st.pedirParada = true; return 'vai parar após o processo em curso'; };

  return 'AI v' + AI.versao + ' carregado (' + document.visibilityState + ')';
})();
