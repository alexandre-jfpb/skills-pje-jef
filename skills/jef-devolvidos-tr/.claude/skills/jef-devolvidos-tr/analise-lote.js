// analise-lote.js — jef-devolvidos-tr (desenvolvido na 7ª Vara Federal da Paraíba; versão para compartilhamento)
//
// CONFIGURAÇÃO DA UNIDADE (obrigatória, antes do inicia): vem do docs/configuracao-unidade.md
// (seção "## jef-devolvidos-tr") e é passada por
//   window.__DT.config({ prefixoMigrados: '<início do sequencial dos processos migrados>' })  // '' = não sinalizar
// Sem isso, DT.inicia() não roda e devolve o que falta configurar. As etiquetas não ficam no script:
// quem as prescreve é o Claude, pelas regras do SKILL.md e pela configuração.
//
// Injetado pelo javascript_tool do Chrome numa página estática do próprio PJe, que não
// redireciona: https://pje1g.trf5.jus.br/pje/js/pdfjs/web/locale/locale.json
// A consulta e os autos abrem num iframe oculto, no mesmo domínio (modelo: jef-endereco-pericia).
// Primeira versão montada a partir do lote de 08/10/2026 (277 processos, ~22 min, sem 429).
//
// SÓ LÊ, salvo DT.marca(): abre cada processo (consulta -> autos), lê a cronologia e o teor
// das sentenças, dos acórdãos e das decisões posteriores à sentença, e monta um resumo por
// processo para a classificação. Quem classifica é o Claude, pelas regras do SKILL.md; a
// "PROP" do resumo é só uma sugestão, conferida no texto antes de gravar.
// DT.marca(num, nl) é a ÚNICA gravação: clica em MARCAR TODOS COMO LIDOS. Chame-a só para processo
// com nl>0, depois de gravada a classificação dele no arquivo de andamento, um processo por vez.
//
// Uso (cada linha é uma chamada do javascript_tool, sem trocar a página de cima):
//   window.__DT.config({ ... })   -> dados da unidade (acima); devolve o resumo do que ficou configurado
//   window.__DT.inicia(['0000000-00.2026.4.05.0000', ...], base)  -> base = nº do 1º processo - 1
//   window.__DT.estado()          -> feitos/total, rodando ou parado, motivo, tempo
//   window.__DT.mostra(a, b)      -> põe os resumos dos processos nº a..b num <pre id="__out">;
//                                    leia com get_page_text (o javascript_tool corta em ~1.200 caracteres)
//   window.__DT.para()            -> interrompe depois do processo em curso
//   window.__DT.ends([...])       -> procura o endereço da parte autora (situações 6c, 6d e 7) e põe no <pre>
//   await window.__DT.marca(num, nl) -> MARCAR TODOS COMO LIDOS e confere que o aviso sumiu (nl = o do resumo;
//                                    se o número de não lidos mudou desde a leitura, não marca)
//
// Resumo de cada processo (no <pre>):
//   #<nº> === <processo> [SIGILOSO] nl=<não lidos> docs=<na cronologia>/<no processo> creta=<sim|não> PROP:<situação sugerida> [rever: ...] (AC <id do acórdão de mérito>)
//   <data id título> ; ...                          -> documentos-chave da cronologia (mais recente primeiro)
//   [AC <data> <id> [EMBARGOS]] REC=<autor|INSS|ambos> RES=<NEGA|DA|PARCIAL|ANULA|DILIG|?> | EMENTA: ... | FIM: <súmula>
//   [Decisão <data> <id>] ...                       -> decisões posteriores à sentença (TRU, TNU, STJ, STF, embargos)
//   [SENT <data> <id>] TIPO=<I|P|PP|E|EMB|?> INI: ... | DISP: <dispositivo>   (EMB = sentença de embargos de declaração)
//   X|<processo>|<motivo>                            -> não analisado (não encontrado, autos não abriram)
(() => {
  const DT = (window.__DT = window.__DT || {});
  DT.versao = 4; // v4: cópia compartilhada — início do sequencial dos processos migrados por DT.config()

  // Configuração da unidade. Padrão vazio: nada é presumido.
  DT.cfg = DT.cfg || {};
  DT.config = function (o) {
    Object.assign(DT.cfg, o || {});
    const p = DT.cfg.prefixoMigrados;
    return 'config: prefixoMigrados=' + (typeof p !== 'string' ? 'NÃO CONFIGURADO' : p ? '"' + p + '"' : 'não sinalizar');
  };

  // Temporizador em Worker: com a aba em segundo plano o Chrome estrangula o setTimeout da página.
  if (!DT.wt) {
    const src = 'const t={};onmessage=e=>{const[k,id,ms]=e.data;if(k==="s")t[id]=setTimeout(()=>postMessage(id),ms);else clearTimeout(t[id]);};';
    const w = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
    const cb = {};
    let seq = 0;
    w.onmessage = (e) => { const f = cb[e.data]; delete cb[e.data]; if (f) f(); };
    window.setTimeout = (fn, ms, ...a) => { const id = ++seq; cb[id] = () => fn(...a); w.postMessage(['s', id, ms || 0]); return id; };
    window.clearTimeout = (id) => { delete cb[id]; w.postMessage(['c', id]); };
    DT.wt = w;
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const MES = { jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12 };
  const limpa = (s) => s.replace(/https?:\/\/\S+/g, '[URL]').replace(/\S*[?&]\w+=\S*/g, '[Q]').replace(/\b[0-9a-f]{16,}\b/gi, '[H]')
    .replace(/\s+/g, ' ').trim();

  let pdfjs = null;
  const pdf = async () => {
    if (!pdfjs) { pdfjs = await import('/pje/js/pdfjs/build/pdf.mjs'); pdfjs.GlobalWorkerOptions.workerSrc = '/pje/js/pdfjs/build/pdf.worker.mjs'; }
    return pdfjs;
  };

  // Teor do documento pelo mesmo endereço que o PJe usa ao abri-lo. PDF: primeiras 12 páginas e as 3 últimas.
  // Texto vazio em PDF = documento digitalizado: ler pela tela, um a um.
  DT.leDoc = async function (id, maxPag) {
    try {
      const r = await fetch('/pje/seam/resource/rest/pje-legacy/documento/download/' + id, { credentials: 'include' });
      if (r.status === 429) { DT.bloqueio = true; return { ct: 'err', text: 'HTTP 429' }; }
      if (!r.ok) return { ct: 'err', text: 'HTTP ' + r.status };
      const ct = r.headers.get('content-type') || '';
      const buf = await r.arrayBuffer();
      if (/pdf/i.test(ct)) {
        const doc = await (await pdf()).getDocument({ data: new Uint8Array(buf) }).promise;
        const n = doc.numPages, mp = maxPag || 12;
        let out = '';
        for (let i = 1; i <= n; i++) {
          if (i > mp && i <= n - 3) continue;
          const tc = await (await doc.getPage(i)).getTextContent();
          out += tc.items.map((x) => x.str).join(' ') + ' ';
        }
        doc.destroy();
        return { ct: 'pdf', text: limpa(out), pags: n };
      }
      const h = new TextDecoder('utf-8').decode(buf);
      if (/type=["']?password/i.test(h)) return { ct: 'login', text: '' };
      const dd = new DOMParser().parseFromString(h, 'text/html');
      dd.querySelectorAll('style,script').forEach((e) => e.remove());
      return { ct: 'html', text: limpa(dd.body ? dd.body.textContent : h) };
    } catch (e) { return { ct: 'err', text: String(e).slice(0, 80) }; }
  };

  function quadro() {
    let f = document.getElementById('__dtQ');
    if (!f) {
      f = document.createElement('iframe');
      f.id = '__dtQ';
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

  DT.abre = async function (num) {
    const f = quadro();
    const m = num.match(/^(\d{7})-(\d{2})\.(\d{4})\.\d\.\d{2}\.(\d{4})$/);
    if (!m) return { erro: 'número em formato inválido' };
    await carrega(f, '/pje/Processo/ConsultaProcesso/listView.seam');
    const campo = await espera(() => { const d = docQ(f); return d && d.getElementById('fPP:numeroProcesso:numeroSequencial'); }, 20000);
    if (!campo) {
      const d = docQ(f);
      if (d && /429|temporariamente bloqueado/i.test(d.body.innerText)) { DT.bloqueio = true; return { erro: '429' }; }
      return d && !d.querySelector('input[type=password]') ? { erro: 'a consulta processual não carregou' } : { login: true };
    }
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
      return { naoAchou: true, motivo: /nenhum|n[ãa]o (foi )?encontrad|0 resultado/i.test(dd.body.innerText) ? 'não encontrado na consulta processual' : 'a consulta não devolveu resultado' };
    }
    f.contentWindow.open = (u) => { f.contentWindow.location.assign(u); return f.contentWindow; };
    link.click();
    const autos = await espera(() => { const dd = docQ(f); return dd && dd.title.includes(num) && dd.getElementById('divTimeLine') ? dd : null; }, 45000);
    if (!autos) return docQ(f) ? { erro: 'os autos não abriram' } : { login: true };
    await sleep(1200);
    return { d: docQ(f) };
  };

  // Cronologia (decrescente: índice menor = mais recente).
  DT.cron = function (d) {
    const linhas = d.getElementById('divTimeLine').innerText.split('\n').map((s) => s.trim()).filter(Boolean);
    let data = '';
    const docs = [], vistos = new Set();
    for (const l of linhas) {
      const m = l.match(/^(\d{2}) (jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez) (\d{4})$/);
      if (m) { data = m[1] + '/' + String(MES[m[2]]).padStart(2, '0') + '/' + m[3]; continue; }
      const x = l.match(/^(\d{6,10}) - (.+)$/);
      if (x && !vistos.has(x[1])) { vistos.add(x[1]); docs.push({ id: x[1], titulo: x[2].slice(0, 80), data }); }
    }
    return docs;
  };
  // O aviso vem no singular ("Há 1 documento não lido") ou no plural, com ou sem "(s)".
  DT.naoLidos = (d) => { const m = d.body.innerText.match(/H[áa] (\d+) documentos?(\(s\))? n[ãa]o lido/i); return m ? +m[1] : 0; };

  // Último trecho do texto que casa com a expressão, com n caracteres.
  const ultimo = (t, re) => { let k = -1, m; const g = new RegExp(re.source, 'gi'); while ((m = g.exec(t))) k = m.index; return k; };
  const corta = (t, re, n) => { const k = ultimo(t, re); return k < 0 ? null : t.slice(k, k + n); };
  const dispSent = (t) => corta(t, /(ISSO POSTO|ISTO POSTO|ANTE O EXPOSTO|DIANTE D[OE]S?S?[EA]? (EXPOSTO|CEN[ÁA]RIO|DO QUE)|POSTO ISSO|PELO EXPOSTO|EM FACE DO EXPOSTO|DO EXPOSTO|DISPOSITIVO|ANTE O QUANTO|PELO QUE|Em raz[ãa]o do exposto|Por todo o exposto|Isto posto|Diante disso|Ante o acima|Assim, julgo|Pelos fundamentos)/, 1000) || t.slice(-1000);
  // Recorrente: pela súmula do julgamento ("recurso da parte autora", "recurso do INSS"); o cabeçalho
  // (RECORRENTE:) às vezes traz o nome da parte autora mesmo quando o recurso é do INSS.
  const recCab = (t) => { const m = t.match(/RECORRENTE:\s*(.{0,60}?)\s*(ADVOGADO|RECORRIDO|PROCURADOR|REPRESENTANTE|$)/); if (!m) return '?'; return /INSTITUTO NACIONAL|INSS/i.test(m[1]) ? 'INSS' : 'autor'; };
  const recorr = (fim, t) => {
    const a = /recurso (inominado )?(da parte[- ]autora|do autor|da autora)/i.test(fim);
    const i = /recurso (inominado )?(do INSS|do ente p[úu]blico|da parte[- ]r[ée]|do r[ée]u|da autarquia|do Instituto)/i.test(fim);
    return a && i ? 'ambos' : a ? 'autor' : i ? 'INSS' : recCab(t);
  };
  // Tipo de sentença: I improcedência, P procedência, PP procedência parcial, E extinção sem mérito,
  // EMB sentença que julga embargos de declaração (não é a sentença de mérito).
  const tipoSent = (t) => {
    if (/Embargos (Declarat|de Declara)|embargos de declara[çc][ãa]o opost/i.test(t.slice(0, 700))) return 'EMB';
    const j = corta(t, /\bjulg(o|ou|a-se)\b/, 260) || '';
    if (/PARCIALMENTE PROCEDENTE|PROCEDENTES?,? EM PARTE|PARCIAL PROCED/i.test(j)) return 'PP';
    if (/IMPROCEDENTE/i.test(j)) return 'I';
    if (/PROCEDENTE/i.test(j)) return 'P';
    if (/extin\w*.{0,80}sem resolu[çc][ãa]o/i.test(t.slice(-3000))) return 'E';
    if (/condeno o INSS|ESP[ÉE]CIE DE BENEF/i.test(t)) return 'P';
    return '?';
  };
  // Dispositivo para leitura: em volta do último "julgo"; sem ele, depois de "ISSO POSTO" e semelhantes.
  const dispDe = (t) => { const k = ultimo(t, /\bjulg(o|ou|a-se)\b/); return k >= 0 ? t.slice(Math.max(0, k - 120), k + 880) : dispSent(t); };
  // Resultado do acórdão pela súmula/dispositivo. A ordem importa: "não provido" contém "provido".
  const resAc = (t) => /ANUL(AR|A-SE|OU|ADA|AÇÃO)/i.test(t) ? 'ANULA'
    : /CONVERT\w* (O JULGAMENTO )?EM DILIG[ÊE]NCIA|BAIXA EM DILIG[ÊE]NCIA|RETORNO DOS AUTOS .{0,80}DILIG[ÊE]NCIA/i.test(t) ? 'DILIG'
    : /(DAR|DEU|D[ÁA]-SE|DANDO) PARCIAL PROVIMENTO|PROVIMENTO PARCIAL|PARCIALMENTE PROVID/i.test(t) ? 'PARCIAL'
    : /NEGA(R|DO|NDO|-SE)? (A )?PROVIMENTO|NEGOU PROVIMENTO|DESPROVID|N[ÃA]O PROVID|IMPROVID/i.test(t) ? 'NEGA'
    : /(DAR|DEU|D[ÁA]-SE|DANDO) PROVIMENTO|\bPROVID[OA]/i.test(t) ? 'DA' : '?';
  // Acórdão que julga embargos de declaração (não é o acórdão de mérito).
  const ehEmbargos = (a) => /^.{0,60}EMBARGOS (DECLARAT|DE DECLARA)/i.test(a.ementa) || /\bembargos\b/i.test(a.fim);
  // Sugestão de situação. Qualquer coisa fora do padrão simples fica "?" e é lida com atenção.
  function sugere(ts, ac, extra) {
    if (!ac) return '?' + (extra ? ' rever: ' + extra : '');
    let s = '?';
    const proc = ts === 'P' || ts === 'PP';
    if (ac.res === 'ANULA') s = '6';
    else if (ac.res === 'DILIG') s = '7';
    else if (ts === 'I' && ac.rec === 'autor' && ac.res === 'NEGA') s = '1';
    else if (ts === 'I' && ac.rec === 'autor' && ac.res === 'DA') s = '2';
    else if (proc && ac.rec === 'INSS' && ac.res === 'DA' && /improcedente/i.test(ac.fim)) s = '3';
    else if (proc && ac.rec === 'autor' && ac.res === 'NEGA') s = '4';
    else if (proc && ac.rec === 'INSS' && ac.res === 'NEGA') s = '5';
    else if (proc && /autor|ambos/.test(ac.rec) && /Tema 246|prazo m[íi]nimo|30 \(trinta\) dias/i.test(ac.fim + ac.ementa)) s = '4/5 Tema 246?';
    return extra ? s + ' rever: ' + extra : s;
  }

  DT.analisa = async function (num) {
    const ab = await DT.abre(num);
    if (ab.login) return { login: true };
    // "Consulta sem resultado" (diferente de "não encontrado") costuma ser passageiro: tenta de novo.
    if (ab.erro || ab.naoAchou) return { txt: 'X|' + num + '|' + (ab.erro || ab.motivo), erro: !!ab.erro || /não devolveu/.test(ab.motivo || '') };
    const d = ab.d;
    const docs = DT.cron(d);
    // A cronologia carrega só os documentos mais recentes; o total do processo está em listaIdsDocumentos.
    // Os ids NEGATIVOS da lista (v2) são documentos da Turma Recursal que já estão na cronologia com id positivo
    // ("… - ID de origem <id>"): não entram no total, que até a v1 os contava em dobro.
    const sc = [...d.querySelectorAll('script')].map((s) => s.textContent).join('\n').match(/listaIdsDocumentos\s*=\s*\[([^\]]*)\]/);
    const total = sc ? sc[1].split(',').filter((s) => /\d/.test(s) && !/-/.test(s)).length : docs.length;
    // "Segredo de justiça? SIM/NÃO" fica no menu de detalhes do cabeçalho, oculto (innerText vem vazio; usar
    // textContent). O "?" é o ícone de ajuda do rótulo. Pelo texto visível, o sigilo não aparece.
    const sig = /Segredo de justi[çc]a\W*SIM/i.test(((d.getElementById('maisDetalhes') || {}).textContent || '').replace(/\s+/g, ' ')) ? ' SIGILOSO' : '';
    const nl = DT.naoLidos(d);
    // Processo migrado (ex.: do Creta): o sequencial começa pelo prefixo configurado pela unidade; '' = não sinalizar.
    const creta = DT.cfg.prefixoMigrados && num.startsWith(DT.cfg.prefixoMigrados) ? 'sim' : 'não';
    const iSent = docs.findIndex((x) => /^Senten[çc]a/i.test(x.titulo));
    const lim = iSent < 0 ? docs.length : iSent;
    const chave = docs.filter((x, i) => /Senten[çc]a|Ac[óo]rd[ãa]o|Embargos|Decis[ãa]o|Recurso|Incidente|Uniformiza|Agravo|Julgamento|Tr[âa]nsito|Voto|Ementa|Extraordin|Especial/i.test(x.titulo)
      || (i < lim && /ID de origem/.test(x.titulo) && !/Intima|Pauta|Sustenta|Procura|Substabe|Peti[çc][ãa]o/i.test(x.titulo)));
    const sents = docs.filter((x) => /^Senten[çc]a/i.test(x.titulo)).slice(0, 4);
    const acs = docs.filter((x) => /^Ac[óo]rd[ãa]o/i.test(x.titulo));
    const decs = docs.filter((x, i) => i < lim && /^Decis[ãa]o/i.test(x.titulo)).slice(0, 4);
    // Sem documento "Acórdão": a certidão de julgamento, a ementa ou o voto fazem as vezes dele.
    const extras = acs.length ? [] : docs.filter((x, i) => i < lim && /^(Voto|Ementa|Certid[ãa]o de Julgamento|Certid[ãa]o)/i.test(x.titulo) && /ID de origem/.test(x.titulo)).slice(0, 4);
    // Um documento por vez: leitura em paralelo provoca o bloqueio 429 do PJe.
    for (const x of [...acs, ...decs, ...extras, ...sents]) {
      x.r = await DT.leDoc(x.id);
      if (DT.bloqueio) return { bloqueio: true };
      if (x.r.ct === 'login') return { login: true };
    }
    const out = [];
    const acR = acs.map((x) => {
      const t = x.r.text, r0 = Math.max(0, t.search(/RECORRID[OA]:/)), e = t.slice(r0).search(/EMENTA\b/);
      const fim = corta(t, /(S[úu]mula de Julgamento|S[úu]mula do julgamento|ACÓRDÃO\s+(A|Vistos|Decide|ACORDAM)|ACORDAM|DECIDE a|decide a)/, 900) || t.slice(-900);
      const ementa = e >= 0 ? t.slice(r0 + e + 6, r0 + e + 6 + 450).trim() : '-';
      const a = { x, rec: recorr(fim, t), res: resAc(fim), fim, ementa, vazio: x.r.ct === 'pdf' && !t };
      a.emb = ehEmbargos(a);
      out.push('[AC ' + x.data + ' ' + x.id + ' ' + x.r.ct + (a.vazio ? ' DIGITALIZADO' : '') + (a.emb ? ' EMBARGOS' : '') + '] REC=' + a.rec + ' RES=' + a.res + ' | EMENTA: ' + ementa + ' | FIM: ' + fim);
      return a;
    });
    for (const x of [...decs, ...extras]) out.push('[' + x.titulo.slice(0, 12) + ' ' + x.data + ' ' + x.id + '] ' + (x.r.text.length > 1300 ? x.r.text.slice(0, 250) + ' ... ' + x.r.text.slice(-650) : x.r.text));
    // Sentença de mérito: a mais recente que não julga embargos de declaração.
    let sMer = null;
    for (const x of sents) {
      const t = x.r.text, k = t.search(/SENTEN[ÇC]A/), tp = tipoSent(t);
      x.tipo = tp;
      if (!sMer && tp !== 'EMB') sMer = x;
      out.push('[SENT ' + x.data + ' ' + x.id + ' ' + x.r.ct + (x.r.ct === 'pdf' && !t ? ' DIGITALIZADO' : '') + '] TIPO=' + tp + ' INI: ' + t.slice(k < 0 ? 0 : k + 8, (k < 0 ? 0 : k + 8) + 220) + ' | DISP: ' + dispDe(t));
    }
    const ts = sMer ? sMer.tipo : '?';
    // Acórdão de mérito: o mais recente depois da sentença de mérito que não julga embargos. Um acórdão
    // anterior de conversão em diligência fica superado pelo que julgou o recurso depois dela.
    const pS = sMer ? docs.indexOf(sMer) : docs.length;
    const merito = acR.find((a) => !a.emb && docs.indexOf(a.x) < pS) || acR.find((a) => !a.emb) || null;
    const embProv = acR.some((a) => a.emb && /acolh|d(ar|eu|ou) (parcial )?provimento|efeitos (infringentes|modificativos)/i.test(a.fim) && !/negar|negou|rejeit|desprov|n[ãa]o provid/i.test(a.fim));
    const parcial = total > docs.length ? ' (cronologia carregou ' + docs.length + ' de ' + total + ' documentos)' : '';
    const extra = [embProv ? 'embargos providos' : '', decs.length ? decs.length + ' decisões após a sentença' : '', !sMer ? 'sentença não localizada' + parcial : ts === '?' ? 'tipo de sentença não lido' : '',
      acR.some((a) => a.vazio) ? 'acórdão digitalizado' : '', !acR.length ? 'sem acórdão' + parcial : ''].filter(Boolean).join(', ');
    const cab = '=== ' + num + sig + ' nl=' + nl + ' docs=' + docs.length + '/' + total + ' creta=' + creta + ' PROP:' + sugere(ts, merito, extra)
      + (merito ? ' (AC ' + merito.x.id + ' de ' + merito.x.data + ')' : '');
    const lista = chave.slice(0, 30).map((x) => x.data.slice(0, 6) + x.data.slice(8) + ' ' + x.id + ' ' + x.titulo.replace(/ - ID de origem.*$/, '*').slice(0, 40)).join(' ; ');
    return { txt: [cab, lista, ...out].join('\n'), nl };
  };

  DT.inicia = function (lista, base) {
    if (DT.st && DT.st.rodando) return 'já está rodando';
    if (typeof DT.cfg.prefixoMigrados !== 'string') return 'configure prefixoMigrados com window.__DT.config({...}) antes de iniciar (dados de docs/configuracao-unidade.md)';
    DT.bloqueio = false;
    const st = (DT.st = { lista, base: base || 0, idx: 0, res: [], rodando: true, parada: '', t0: Date.now() });
    (async () => {
      while (st.idx < st.lista.length && !st.pedirParada) {
        const num = st.lista[st.idx];
        let r;
        for (let t = 0; t < 2; t++) {
          try { r = await DT.analisa(num); } catch (e) { r = { txt: 'X|' + num + '|erro na leitura: ' + String(e).slice(0, 80), erro: true }; }
          if (!r.erro || r.bloqueio) break;
          await sleep(4000);
        }
        if (r.login) { st.parada = 'login em ' + num; break; }
        if (r.bloqueio) { st.parada = '429 em ' + num + ' (PJe bloqueou por excesso de requisições; esperar 10 min)'; break; }
        st.res.push({ n: st.base + st.idx + 1, num, txt: r.txt, nl: r.nl });
        st.idx++;
      }
      if (!st.parada && st.pedirParada) st.parada = 'interrompido';
      st.rodando = false;
    })();
    return 'iniciado: ' + lista.length + ' processos, um por vez';
  };

  DT.estado = () => {
    const st = DT.st;
    if (!st) return 'sem execução';
    const nl = st.res.filter((r) => r.nl > 0).map((r) => r.n).join(',');
    return (st.base + st.idx) + ' (' + st.idx + '/' + st.lista.length + ') ' + (st.rodando ? 'rodando' : 'parado') + (st.parada ? ' — ' + st.parada : '')
      + ' — ' + Math.round((Date.now() - st.t0) / 1000) + 's' + (nl ? ' — com não lidos: ' + nl : '');
  };

  // Texto grande vai para um <pre> da página e é lido com get_page_text.
  const pre = () => {
    let p = document.getElementById('__out');
    if (!p) { p = document.createElement('pre'); p.id = '__out'; p.style.whiteSpace = 'pre-wrap'; document.body.appendChild(p); }
    // Tira o texto original da página (o JSON do locale), sem apagar o iframe do lote.
    [...document.body.childNodes].forEach((n) => { if (n !== p && n.id !== '__dtQ') n.remove?.(); });
    return p;
  };
  DT.mostra = function (a, b) {
    const rs = (DT.st ? DT.st.res : []).filter((r) => r.n >= a && r.n <= b);
    pre().textContent = rs.map((r) => '#' + r.n + ' ' + r.txt).join('\n\n');
    return rs.length + ' processos no quadro';
  };

  DT.para = function () { if (DT.st) DT.st.pedirParada = true; return 'vai parar após o processo em curso'; };

  // Endereço da parte autora (situações 6c, 6d e 7): documentos mais recentes que não são atos do juízo,
  // e os mais antigos do processo (inicial, procuração, comprovante de residência).
  DT.end = async function (num) {
    const ab = await DT.abre(num);
    if (!ab.d) return '=== ' + num + ' não abriu';
    const d = ab.d, docs = DT.cron(d);
    const scripts = [...d.querySelectorAll('script')].map((s) => s.textContent).join('\n');
    const m = scripts.match(/listaIdsDocumentos\s*=\s*\[([^\]]*)\]/);
    const todos = [];
    // Id NEGATIVO (v2, 15/10/2026) é o que o documento tinha na Turma Recursal, com o sinal trocado; o mesmo documento está
    // na cronologia com id positivo ("… - ID de origem <id>"). Até a v1 o sinal era tirado, e o número, positivo, é OUTRO
    // documento do PJe; por ser menor que os ids locais, caía entre os "antigos" e era lido como se fosse do processo.
    // O negativo é descartado: documento da Turma não traz o endereço da parte. Nunca tirar o sinal para baixar.
    if (m) for (const s of m[1].split(',')) { if (/-/.test(s)) continue; const v = s.replace(/\D/g, ''); if (v) todos.push(v); }
    const recentes = docs.filter((x) => !/ID de origem|Ac[óo]rd[ãa]o|Voto|Ementa|Relat[óo]rio|Certid[ãa]o de Tr[âa]nsito|Senten[çc]a|Intima[çc][ãa]o|Ato Ordinat/i.test(x.titulo)).slice(0, 8).map((x) => x.id);
    const antigos = todos.length ? todos.slice().sort((a, b) => a - b).slice(0, 6) : docs.slice(-6).map((x) => x.id);
    // v3 (26/10/2026): só para o endereço da perícia social, lê também as petições e comprovantes da parte autora na
    // cronologia (a petição de alteração de endereço juntada no meio do processo ficava entre os 8 recentes e os 6 antigos) e os
    // 15 ids mais recentes fora da cronologia carregada.
    const peticoes = docs.filter((x) => /^(Peti[çc][ãa]o|Manifesta|Documento de Comprova|Comprovante|Outros Documentos)/i.test(x.titulo) && !/ID de origem/.test(x.titulo)).slice(0, 40).map((x) => x.id);
    const foraCron = todos.filter((v) => !docs.some((x) => x.id === v)).sort((a, b) => b - a).slice(0, 15);
    const ids = [...new Set([...recentes, ...peticoes, ...foraCron, ...antigos])];
    const out = ['=== ' + num + ' (' + ids.length + ' documentos)'];
    for (const id of ids) {
      const r = await DT.leDoc(id, 4);
      if (DT.bloqueio) { out.push('429: parar e esperar 10 min'); break; }
      const t = r.text || '', tit = (docs.find((x) => x.id === id) || {}).titulo || '?';
      const ach = [], g = /(residente e domiciliad[oa]|domiciliad[oa]|resid[eê]ncia|endere[çc]o|CEP|Rua |R\. |Avenida|Av\. |S[íi]tio|Telefone|Fone|Celular|ponto de refer)/gi;
      let k, ult = -999;
      while ((k = g.exec(t)) && ach.length < 4) { if (k.index - ult < 250) continue; ult = k.index; ach.push(t.slice(Math.max(0, k.index - 40), k.index + 220)); }
      out.push('[' + id + ' ' + tit.slice(0, 40) + ' ' + r.ct + (r.ct === 'pdf' && !t ? ' DIGITALIZADO' : '') + '] ' + (ach.join(' || ') || '-'));
    }
    return out.join('\n');
  };
  DT.ends = function (lista) {
    const p = pre();
    p.textContent = 'procurando endereços...';
    DT.endOk = false;
    (async () => { const res = []; for (const n of lista) res.push(await DT.end(n)); p.textContent = res.join('\n\n'); DT.endOk = true; })();
    return 'iniciado: ' + lista.length + ' processos (DT.endOk fica true ao terminar)';
  };

  // ÚNICA GRAVAÇÃO: MARCAR TODOS COMO LIDOS. Só para processo com nl>0, depois da classificação gravada.
  // nlLido = o nl do resumo: se o número mudou, chegou documento depois da leitura, que ninguém leu — não marca.
  DT.marca = async function (num, nlLido) {
    const ab = await DT.abre(num);
    if (ab.login) return num + ' LOGIN';
    if (!ab.d) return num + ' NÃO ABRIU — não marcado';
    const d = ab.d, antes = DT.naoLidos(d);
    if (!antes) return num + ' sem documento não lido — nada a marcar';
    if (nlLido !== undefined && antes !== nlLido) return num + ' NÃO MARCADO: eram ' + nlLido + ' não lidos na leitura e agora são ' + antes + ' — reanalisar';
    const bt = [...d.querySelectorAll('input,button,a')].find((e) => /marcar todos como lidos/i.test(e.value || e.textContent || ''));
    if (!bt) return num + ' botão MARCAR TODOS COMO LIDOS não encontrado (' + antes + ' não lidos)';
    bt.click();
    const ok = await espera(() => { const dd = docQ(quadro()); return dd && dd.getElementById('divTimeLine') && !DT.naoLidos(dd); }, 20000);
    return num + (ok ? ' MTL OK (' + antes + ' não lidos; aviso sumiu)' : ' MTL FALHOU — o aviso continua');
  };

  return 'DT v' + DT.versao + ' carregado (' + document.visibilityState + ')';
})();
