// analise-lote.js — jef-controle-prazo (desenvolvido na 7ª Vara Federal da Paraíba; versão para compartilhamento)
//
// Injetado pelo javascript_tool do Chrome numa página estática do próprio PJe, que não
// redireciona: https://pje1g.trf5.jus.br/pje/js/pdfjs/web/locale/locale.json
// A consulta e os autos abrem num iframe oculto, no mesmo domínio (modelo: jef-endereco-pericia).
// SÓ LÊ: abre cada processo (consulta -> autos), lê a cronologia, o teor do ato, da certidão
// de intimação e das petições posteriores, e a aba Expedientes. Nunca clica em MARCAR TODOS
// COMO LIDOS nem em nada que grave no PJe; os únicos cliques nos autos são nas petições
// posteriores ao ato (para ler o "Juntado por") e na aba Expedientes.
//
// Uso (cada linha é uma chamada do javascript_tool, sem trocar a página de cima):
//   window.__CP.config({ destinoCom: '<tarefa com manifestação>', destinoSem: '<tarefa sem manifestação>' })
//       -> obrigatório antes do inicia; valores de docs/configuracao-unidade.md, seção jef-controle-prazo
//   window.__CP.inicia(['0000000-00.2026.4.05.0000', ...], {paralelo: 1})
//   await window.__CP.le(desde)   -> progresso + linhas novas a partir do índice `desde`
//   window.__CP.para()            -> interrompe depois do processo em curso
//
// Linhas devolvidas por le():
//   P|feitos/total|rodando ou parado|motivo da parada|tempo|ate:<próximo desde>
//   <cód>|<processo>|<ato>|<data do ato>|<destinatários>|<intimações com falha>|<suprimento>|<sem intimação válida>|<data-limite>|<destino>|<observação>|<sigiloso>
// Códigos: M movimentar (Situação 1) · N nova intimação (Situação 2) · F sem falha · C prazo em curso
//          V revisar manualmente · X não analisado
(() => {
  const CP = (window.__CP = window.__CP || {});
  CP.versao = 1;
  // Configuração da unidade (docs/configuracao-unidade.md): nomes das tarefas de destino. Padrão vazio.
  CP.cfg = CP.cfg || { destinoCom: '', destinoSem: '' };
  CP.config = function (c) {
    c = c || {};
    if (typeof c.destinoCom === 'string') CP.cfg.destinoCom = c.destinoCom.trim();
    if (typeof c.destinoSem === 'string') CP.cfg.destinoSem = c.destinoSem.trim();
    return 'configuração - destinoCom: ' + (CP.cfg.destinoCom || '(vazio)') + ' / destinoSem: ' + (CP.cfg.destinoSem || '(vazio)');
  };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const MES = { jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12 };
  const limpa = (s) => s.replace(/https?:\/\/\S+/g, '[URL]').replace(/\S*[?&]\w+=\S*/g, '[Q]').replace(/\b[0-9a-f]{16,}\b/gi, '[H]')
    .replace(/\s+/g, ' ').trim();
  const dnum = (s) => { const m = (s || '').match(/(\d{2})\/(\d{2})\/(\d{4})/); return m ? +(m[3] + m[2] + m[1]) : 0; };
  const hoje = (() => { const d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); })();
  const poloDe = (s) => /INSTITUTO NACIONAL DO SEGURO SOCIAL|\bINSS\b|CEAB/i.test(s || '') ? 'INSS' : 'Autor';

  let pdfjs = null;
  const pdf = async () => {
    if (!pdfjs) { pdfjs = await import('/pje/js/pdfjs/build/pdf.mjs'); pdfjs.GlobalWorkerOptions.workerSrc = '/pje/js/pdfjs/build/pdf.worker.mjs'; }
    return pdfjs;
  };

  async function leDoc(id) {
    try {
      const r = await fetch('/pje/seam/resource/rest/pje-legacy/documento/download/' + id, { credentials: 'include' });
      if (r.status === 429) return { ct: '429', text: '' };
      if (!r.ok) return { ct: 'err', text: 'HTTP ' + r.status };
      const ct = r.headers.get('content-type') || '';
      const buf = await r.arrayBuffer();
      if (/pdf/i.test(ct)) {
        const doc = await (await pdf()).getDocument({ data: new Uint8Array(buf) }).promise;
        let out = '';
        for (let i = 1; i <= Math.min(doc.numPages, 2); i++) {
          const tc = await (await doc.getPage(i)).getTextContent();
          out += tc.items.map((x) => x.str).join(' ') + ' ';
        }
        doc.destroy();
        return { ct: 'pdf', text: limpa(out) };
      }
      const h = new TextDecoder('utf-8').decode(buf);
      if (/type=["']?password/i.test(h)) return { ct: 'login', text: '' };
      const dd = new DOMParser().parseFromString(h, 'text/html');
      dd.querySelectorAll('style,script').forEach((e) => e.remove());
      return { ct: 'html', text: limpa(dd.body ? dd.body.textContent : h) };
    } catch (e) { return { ct: 'err', text: String(e).slice(0, 80) }; }
  }

  function quadro(k) {
    let f = document.getElementById('__cpQuadro' + k);
    if (!f) {
      f = document.createElement('iframe');
      f.id = '__cpQuadro' + k;
      f.style.cssText = 'position:fixed;left:-12000px;top:0;width:1280px;height:900px;border:0';
      document.body.appendChild(f);
    }
    return f;
  }
  const docQ = (f) => { try { const d = f.contentDocument; return d && d.location && d.location.host === location.host ? d : null; } catch (e) { return null; } };
  async function espera(fn, ms) {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { try { const v = fn(); if (v) return v; } catch (e) { /* ainda carregando */ } await sleep(300); }
    return null;
  }
  function carrega(f, url) {
    return new Promise((res) => {
      let ok = false;
      const fim = (v) => { if (!ok) { ok = true; f.removeEventListener('load', fim); res(v !== false); } };
      f.addEventListener('load', fim);
      f.src = url;
      setTimeout(() => fim(false), 60000);
    });
  }

  async function abre(num, f) {
    const m = num.match(/^(\d{7})-(\d{2})\.(\d{4})\.\d\.\d{2}\.(\d{4})$/);
    if (!m) return { erro: 'número em formato inválido' };
    await carrega(f, '/pje/Processo/ConsultaProcesso/listView.seam');
    const campo = await espera(() => { const d = docQ(f); return d && d.getElementById('fPP:numeroProcesso:numeroSequencial'); }, 20000);
    if (!campo) return docQ(f) && !docQ(f).querySelector('input[type=password]') ? { erro: 'a consulta processual não carregou' } : { login: true };
    const d = docQ(f);
    const poe = (id, v) => { const e = d.getElementById(id); e.value = v; e.dispatchEvent(new Event('change', { bubbles: true })); };
    poe('fPP:numeroProcesso:numeroSequencial', m[1]);
    poe('fPP:numeroProcesso:numeroDigitoVerificador', m[2]);
    poe('fPP:numeroProcesso:Ano', m[3]);
    poe('fPP:numeroProcesso:NumeroOrgaoJustica', m[4]);
    d.getElementById('fPP:searchProcessos').click();
    const link = await espera(() => { const dd = docQ(f); return dd && [...dd.querySelectorAll('a')].find((x) => x.textContent.includes(num)); }, 25000);
    if (!link) {
      const dd = docQ(f);
      if (!dd) return { login: true };
      return { naoAchou: true, motivo: /nenhum|n[ãa]o (foi )?encontrad/i.test(dd.body.innerText) ? 'não encontrado na consulta processual' : 'a consulta não devolveu resultado' };
    }
    f.contentWindow.open = (u) => { f.contentWindow.location.assign(u); return f.contentWindow; };
    link.click();
    const autos = await espera(() => { const dd = docQ(f); return dd && dd.title.includes(num) && dd.getElementById('divTimeLine') ? dd : null; }, 45000);
    if (!autos) return docQ(f) ? { erro: 'os autos não abriram' } : { login: true };
    await sleep(800);
    return { d: docQ(f) };
  }

  // Cronologia (decrescente: índice menor = mais recente). Cada documento leva os eventos logo acima dele.
  function cronologia(d) {
    const linhas = d.getElementById('divTimeLine').innerText.split('\n').map((s) => s.trim()).filter(Boolean);
    let data = '', ev = [];
    const docs = [], decursos = [], vistos = new Set();
    for (const l of linhas) {
      const m = l.match(/^(\d{2}) (jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez) (\d{4})$/);
      if (m) { data = m[1] + '/' + String(MES[m[2]]).padStart(2, '0') + '/' + m[3]; ev = []; continue; }
      if (/^\d{2}:\d{2}$/.test(l)) { ev = []; continue; }
      const dp = l.match(/^DECORRIDO PRAZO DE (.+?) EM (\d{2}\/\d{2}\/\d{4})/i);
      if (dp) decursos.push({ pos: docs.length, polo: poloDe(dp[1]), em: dp[2] });
      const x = l.match(/^(\d{8,10}) - (.+)$/);
      if (x) {
        if (!vistos.has(x[1])) { vistos.add(x[1]); docs.push({ id: x[1], titulo: x[2].slice(0, 90), data, ev: ev.join(' / ') }); }
        ev = [];
        continue;
      }
      ev.push(l);
    }
    return { docs, decursos };
  }

  // Abre o documento na cronologia (só exibe) e lê o "Juntado por".
  async function juntadoPor(d, id) {
    const a = [...d.querySelectorAll('#divTimeLine a')].find((x) => x.textContent.trim().startsWith(id + ' - '));
    if (!a) return '?sem link';
    a.click();
    for (let k = 0; k < 24; k++) {
      await sleep(500);
      const w = d.createTreeWalker(d.body, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = w.nextNode())) {
        if (!/Juntado por/.test(n.textContent)) continue;
        let b = n.parentElement;
        for (let j = 0; j < 3 && b; j++) {
          if (b.textContent.includes(id)) return n.textContent.trim().replace(/^Juntado por\s*/, '').replace(/ em \d.*$/, '');
          b = b.parentElement;
        }
      }
    }
    return '?não carregou';
  }

  async function expedientes(d) {
    const link = d.getElementById('navbar:linkAbaExpedientes1');
    if (!link) return null;
    link.click();
    const tb = await espera(() => [...d.querySelectorAll('table')].find((t) => /Data limite prevista/i.test(t.innerText) && /Fechado/.test(t.innerText) && !t.querySelector('table table')), 25000);
    if (!tb) return null;
    await sleep(500);
    return [...tb.querySelectorAll(':scope > tbody > tr')].map((r) => {
      const c = [...r.children].map((td) => td.innerText.replace(/\s+/g, ' ').trim());
      const a = c[0] || '';
      const parte = (a.split(/ID do documento \(\d+\)/)[1] || '').split(/Representante:|Diário Eletrônico|Expedição eletrônica|Sistema|Correios|Central de Mandados|Telefone|Pessoalmente/)[0];
      return {
        n: (a.match(/\((\d+)\)/) || [])[1] || '?',
        ato: (a.match(/ID do documento \((\d+)\)/) || [])[1] || '',
        polo: poloDe(parte + ' ' + (/Representante: Procuradoria/.test(a) ? 'INSS' : '')),
        meio: (a.match(/Diário Eletrônico|Expedição eletrônica|Sistema|Correios|Central de Mandados/) || ['?'])[0],
        data: (a.match(/\((\d{2}\/\d{2}\/\d{4}) \d{2}:\d{2}(?::\d{2})?\)/) || [])[1] || '',
        ciencia: /ciência em/i.test(a),
        semPrazo: /sem prazo/i.test(a),
        lim: (String(c[1] || '').match(/\d{2}\/\d{2}\/\d{4}/) || [])[0] || '',
        fechado: /SIM/i.test(c[c.length - 1] || ''),
      };
    });
  }

  async function analisa(num, cfg, f) {
    const ab = await abre(num, f);
    if (ab.login) return { login: true };
    if (ab.erro || ab.naoAchou) return { linhas: [['X', num, '', '', '', '', '', '', '', '', ab.erro || ab.motivo, '']], tentar: !!ab.erro };
    const d = ab.d;
    // "Segredo de justiça? SIM/NÃO" fica no menu de detalhes do cabeçalho, oculto (innerText vem vazio; usar
    // textContent). O "?" é o ícone de ajuda do rótulo. Pelo texto visível, o sigilo não aparece.
    const sig = /Segredo de justi[çc]a\W*SIM/i.test(((d.getElementById('maisDetalhes') || {}).textContent || '').replace(/\s+/g, ' ')) ? 'sim' : 'não';
    const { docs, decursos } = cronologia(d);

    // Aba Expedientes: o ato mais recente é o da primeira linha (lista decrescente).
    const exps = await expedientes(d);
    if (!exps) return { linhas: [['X', num, '', '', '', '', '', '', '', '', 'a aba Expedientes não carregou', sig]], tentar: true };
    if (!exps.length) return { linhas: [['V', num, '', '', '', '', '', '', '', '', 'aba Expedientes vazia', sig]] };
    const ato = exps[0].ato;
    const doAto = exps.filter((e) => e.ato === ato);
    const dataAto = doAto.map((e) => e.data).sort((a, b) => dnum(a) - dnum(b))[0] || '';
    const abertosAnt = exps.filter((e) => e.ato !== ato && !e.fechado).map((e) => e.n);
    // Expediente aberto com data-limite ainda por vencer (deste ou de outro ato): o processo está
    // na tarefa por um prazo que ainda corre — prazo em curso, sem falha a apontar agora.
    const emCurso = exps.filter((e) => !e.fechado && e.lim && dnum(e.lim) >= hoje);
    if (emCurso.length) {
      return { linhas: [['C', num, ato, dataAto, '', '', '', '', '', '', 'prazo em curso: ' + emCurso.map((e) => e.n + ' ' + e.polo + ' até ' + e.lim).join(', '), sig]] };
    }

    // Posição do ato na cronologia; documentos acima dele são posteriores.
    let pAto = docs.findIndex((x) => x.id === ato);
    if (pAto < 0) pAto = docs.findIndex((x) => dnum(x.data) < dnum(dataAto)); // primeiro documento anterior ao ato
    if (pAto < 0) pAto = docs.length;

    // Teor do ato e da certidão de intimação que o acompanha (lidos em série: limite 429 do PJe).
    const obs = [];
    const tAto = docs.some((x) => x.id === ato) ? await leDoc(ato) : { ct: 'err', text: '' };
    if (tAto.ct === '429') return { pare429: true };
    if (tAto.ct === 'login') return { login: true };
    let certPolos = null, certId = '';
    const candCert = docs.map((x, i) => ({ x, i })).filter(({ x, i }) => Math.abs(i - pAto) <= 6 && /Certid[ãa]o de Intima[çc][ãa]o/i.test(x.titulo));
    for (const { x } of candCert) {
      const t = await leDoc(x.id);
      if (t.ct === '429') return { pare429: true };
      if (!t.text.includes(ato + ' - ')) continue;
      const pedacos = t.text.split(new RegExp('\\(' + ato + ' - '));
      // Cada parte vem logo antes de "(<ato> - Intimação)", depois do cabeçalho ("...Pessoal") ou do "Não"/"Sim" da parte anterior.
      certPolos = [...new Set(pedacos.slice(0, -1).map((p) => poloDe(p.split(/Pessoal|Não|Sim/).pop())))];
      certId = x.id;
      break;
    }

    // Petições juntadas depois do ato: quem juntou (Juntado por).
    const pets = docs.slice(0, pAto).filter((x) => /JUNTADA DE PETI[ÇC][ÃA]O/i.test(x.ev));
    // A aba Expedientes tira a cronologia da tela: volta para os autos antes de ler o "Juntado por".
    if (pets.length) {
      const aut = d.getElementById('navbar:linkAbaAutosHome');
      if (aut) { aut.click(); await espera(() => d.querySelector('#divTimeLine a'), 20000); await sleep(800); }
    }
    for (const p of pets.slice(0, 6)) {
      const jp = await juntadoPor(d, p.id);
      p.polo = /POLO ATIVO/i.test(jp) ? 'Autor' : /POLO PASSIVO|PROCURAD/i.test(jp) ? 'INSS' : '';
      // O procurador do INSS aparece no "Juntado por" sem o polo: decide pelo teor da petição.
      if (!p.polo) {
        const t = await leDoc(p.id);
        if (t.ct === '429') return { pare429: true };
        p.polo = /ADVOCACIA-GERAL DA UNI|PROCURADORIA-GERAL FEDERAL|PROCURADOR(A)? FEDERAL/i.test(t.text.slice(0, 600)) ? 'INSS' : '?';
      }
    }
    const decAto = decursos.filter((x) => x.pos <= pAto);

    // Destinatários: partes nas intimações do ato e na certidão.
    const polos = [...new Set([...doAto.map((e) => e.polo), ...(certPolos || [])])].sort();
    const falhas = doAto.filter((e) => !e.lim && !e.semPrazo && !e.fechado);
    const falhasFechadas = doAto.filter((e) => !e.lim && !e.semPrazo && e.fechado);
    const validas = doAto.filter((e) => e.lim);
    const limMax = validas.map((e) => e.lim).sort((a, b) => dnum(b) - dnum(a))[0] || '';
    const manif = (polo) => pets.filter((p) => p.polo === polo && (!limMax || dnum(p.data) <= dnum(limMax)));

    if (certId) obs.push('certidão ' + certId + ': ' + certPolos.join(' e '));
    else obs.push('certidão de intimação do ato não localizada');
    if (decAto.length) obs.push('decurso: ' + [...new Set(decAto.map((x) => x.polo + ' ' + x.em))].join(', '));
    if (pets.length) obs.push('petições após o ato: ' + pets.slice(0, 6).map((p) => p.id + ' ' + (p.polo || '?') + ' ' + p.data).join(', '));
    if (abertosAnt.length) obs.push('expediente aberto de ato anterior: ' + abertosAnt.join(', '));
    if (falhasFechadas.length) obs.push('intimação sem data-limite já fechada: ' + falhasFechadas.map((e) => e.n).join(', '));
    const L = (cod, extra) => {
      const supr = [], semVal = [];
      for (const polo of [...new Set(falhas.map((e) => e.polo))]) {
        const v = validas.filter((e) => e.polo === polo).map((e) => e.n);
        const mf = manif(polo).map((p) => p.id);
        if (v.length) supr.push(polo + ': intimação ' + v.join(', '));
        else if (mf.length) supr.push(polo + ': manifestação ' + mf.join(', '));
        else semVal.push(polo);
      }
      return [cod, num, ato, dataAto, polos.join(' e '), falhas.map((e) => e.n + ' ' + e.polo + ' (' + e.meio + ')').join(', '),
        supr.join('; '), semVal.join(', '), limMax, extra || '', obs.join('; '), sig];
    };

    if (!certId || tAto.ct === 'err') return { linhas: [L('V', '')] };
    // Só uma parte intimada pelo ato: conferir pelo teor se a outra também deveria ser.
    if (polos.length === 1) {
      const k = tAto.text.search(/intim|fica|vista|manifest|prazo/i);
      obs.unshift('só ' + polos[0] + ' intimado pelo ato; teor: ' + tAto.text.slice(Math.max(0, k), Math.max(0, k) + 200));
      return { linhas: [L('V', '')] };
    }
    if (!falhas.length) {
      const abertas = doAto.filter((e) => !e.fechado);
      if (abertas.some((e) => e.lim && dnum(e.lim) < hoje)) { obs.unshift('intimação aberta com data-limite vencida'); return { linhas: [L('V', '')] }; }
      return { linhas: [L(abertas.length ? 'C' : 'F', '')] };
    }
    const l = L('?', '');
    if (l[7]) { l[0] = 'N'; return { linhas: [l] }; }
    if (limMax && dnum(limMax) >= hoje) { l[0] = 'C'; return { linhas: [l] }; }
    const houve = polos.some((p) => manif(p).length);
    l[0] = 'M';
    l[9] = houve ? CP.cfg.destinoCom : CP.cfg.destinoSem;
    if (pets.some((p) => p.polo === '?')) { l[0] = 'V'; l[10] = 'petição sem "Juntado por" identificado; ' + l[10]; }
    return { linhas: [l] };
  }

  CP.inicia = function (lista, cfg) {
    if (CP.st && CP.st.rodando) return 'já está rodando';
    if (!CP.cfg.destinoCom || !CP.cfg.destinoSem) return 'configure as tarefas de destino antes de iniciar: window.__CP.config({ destinoCom: ..., destinoSem: ... }), com os valores de docs/configuracao-unidade.md (seção jef-controle-prazo)';
    cfg = cfg || {};
    const st = (CP.st = { lista, cfg, prox: 0, idx: 0, res: [], semLogin: [], rodando: true, parada: '', t0: Date.now() });
    const trabalhador = async (k) => {
      const f = quadro(k);
      while (!st.parada && !st.pedirParada && st.prox < st.lista.length) {
        const num = st.lista[st.prox++];
        let r;
        for (let t = 0; t < 2; t++) {
          try { r = await analisa(num, st.cfg, f); } catch (e) { r = { linhas: [['X', num, '', '', '', '', '', '', '', '', 'erro na leitura: ' + String(e).slice(0, 60), '']], tentar: true }; }
          if (!r.tentar) break;
          await sleep(3000);
        }
        if (r.login) { st.parada = 'login'; st.semLogin.push(num); break; }
        if (r.pare429) { st.parada = '429 (PJe bloqueou por excesso de requisições; esperar 10 min)'; st.semLogin.push(num); break; }
        r.linhas.forEach((l) => st.res.push(l.map((v) => String(v).replace(/[|\n\r]/g, ' ')).join('|')));
        st.idx++;
      }
    };
    const n = Math.max(1, Math.min(cfg.paralelo || 1, 2));
    const trabalhos = [];
    for (let k = 0; k < n; k++) trabalhos.push(trabalhador(k));
    Promise.all(trabalhos).then(() => {
      if (!st.parada && st.pedirParada) st.parada = 'interrompido';
      st.rodando = false;
    });
    return 'iniciado: ' + lista.length + ' processos, ' + n + ' por vez';
  };

  CP.le = async function (desde, espMax) {
    const st = CP.st;
    if (!st) return 'P|0/0|parado|sem execução||0s|ate:0';
    const t0 = Date.now();
    while (st.rodando && st.res.length - desde < 3 && Date.now() - t0 < Math.min(espMax || 10000, 15000)) await sleep(1000);
    const out = [];
    let tam = 0, i = desde;
    for (; i < st.res.length; i++) {
      const l = st.res[i];
      if (tam + l.length > 850 && out.length) break;
      out.push(l);
      tam += l.length + 1;
    }
    const seg = Math.round((Date.now() - st.t0) / 1000);
    const parada = st.parada + (st.semLogin.length ? ' (refazer: ' + st.semLogin.join(', ') + ')' : '');
    // "ate:" e não "ate=": com "=" e ";" na mesma saída, o javascript_tool bloqueia o retorno.
    return ['P|' + st.idx + '/' + st.lista.length + '|' + (st.rodando ? 'rodando' : 'parado') + '|' + parada + '|' + seg + 's|ate:' + i, ...out].join('\n');
  };

  CP.para = function () { if (CP.st) CP.st.pedirParada = true; return 'vai parar após o processo em curso'; };
  return 'CP v' + CP.versao + ' carregado';
})();
