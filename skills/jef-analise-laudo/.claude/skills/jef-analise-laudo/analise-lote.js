// jef-analise-laudo — script de lote (window.__LM), v1, 23/10/2026. SÓ LEITURA.
// Roda sobre o window.__CR do analise-lote-pje.js da jef-conferir-rpv (carregue aquele antes deste), na página estática
// https://pje1g.trf5.jus.br/pje/js/pdfjs/web/locale/locale.json. O CR lê os processos (CR.inicia); este script, para cada
// processo já lido, escolhe o laudo médico, baixa o texto inteiro (CR.txt), separa os quesitos e SUGERE a classificação.
// A sugestão termina sempre em "?": a classificação é da skill, conferida nos trechos que o resumo traz.
//   LM.fila(nums)  — prepara em segundo plano; LM.st diz "rodando" ou "pronto".
//   LM.ver(nums)   — põe os resumos no quadro da página, para ler com get_page_text.
//   LM.marcaFila() — MARCAR TODOS COMO LIDOS (CR.marca) nos processos com não lidos, um por vez, depois de gravada a
//                    classificação no andamento; resultado em LM.mk.
// Montado a partir do auxiliar usado nos testes de 23/10/2026 na 7ª Vara Federal da Paraíba (60 processos).
// Versão para compartilhamento (11/11/2026): os nomes das etiquetas não estão no script; vêm da configuração da unidade
// (docs/configuracao-unidade.md, seção "## jef-analise-laudo"), passada antes do início:
//   LM.config({ sm: <salário mínimo>, etiquetas: { etiqueta_laudo_c: '...', ... } })  — guardada em LM.cfg.
// Sem as 13 etiquetas configuradas, LM.fila não roda e diz quais faltam.
(function () {
  const CR = window.__CR;
  if (!CR) return 'carregue antes o analise-lote-pje.js (window.__CR)';
  const LM = (window.__LM = window.__LM || { out: {}, dados: {}, mk: {} });
  LM.cfg = LM.cfg || { sm: null, etiquetas: {} };
  LM.versao = 3; // v2, 30/10/2026: respostas do Setor de Perícias (afastamento, faixas, adicional de 25%, curatela 18+, outros laudos, incapacidade passada)
  // v3, 16/11/2026: proposta de acordo depois do laudo (só informa, com o método da jef-expediente-manifestacao), intimação das
  // partes sobre o laudo (Intimação + Certidão de Intimação com os expedientes do INSS e da parte autora; sem ela, FALHA NA
  // INTIMAÇÃO) e MPF (cadastrado, manifestação nos autos, ou parte autora menor ou incapaz → INTIMAR MPF). Pede o CR v12.

  const norm = (t) => (t || '').replace(/\s+/g, ' ').replace(/(\d)\s*\.\s*(?=\d)/g, '$1.')
    .replace(/☒|\(\s*[xX]\s*\)|\[\s*[xX]\s*\]/g, '[X]').replace(/☐|\(\s*\)|\[\s*\]/g, '[ ]');
  // Versão sem espaços e minúscula, para achar as marcas mesmo com as palavras partidas pelo pdf.js ("l eve", "Incapacitação t otal").
  const compacta = (s) => (s || '').replace(/\s+/g, '').toLowerCase();
  const ymd = (s) => { const m = (s || '').match(/(\d{2})\/(\d{2})\/(\d{4})/); return m ? m[3] + m[2] + m[1] : ''; };
  const win = (t, re, a, b) => { const m = t.match(re); return m ? t.slice(Math.max(0, m.index - a), m.index + b) : ''; };
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  // Data no trecho: dd/mm/aaaa (com espaços partidos: "0 7 / 10 /2026"), "d de mês de aaaa" ou "mês de aaaa" (dia 1).
  function data(s) {
    if (!s) return null;
    const j = s.replace(/(\d)\s+(?=\d)/g, '$1').replace(/\s*\/\s*/g, '/');
    let m = j.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
    m = j.match(/(\d{1,2})\s*(?:º)?\s+de\s+([a-zçã]+)\s+de\s+(\d{4})/i);
    if (m && MESES.indexOf(m[2].toLowerCase()) >= 0) return new Date(+m[3], MESES.indexOf(m[2].toLowerCase()), +m[1]);
    m = j.match(/\b([a-zçã]+)\s+de\s+(\d{4})/i);
    if (m && MESES.indexOf(m[1].toLowerCase()) >= 0) return new Date(+m[2], MESES.indexOf(m[1].toLowerCase()), 1);
    return null;
  }
  const fmt = (d) => (d ? String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear() : '?');
  const idade = (nasc, em) => { if (!nasc || !em) return null; let a = em.getFullYear() - nasc.getFullYear(); if (em.getMonth() < nasc.getMonth() || (em.getMonth() === nasc.getMonth() && em.getDate() < nasc.getDate())) a--; return a; };
  const meses = (a, b) => (a && b ? (b - a) / (1000 * 60 * 60 * 24 * 30.4375) : null);

  // Laudo médico = documento do perito com título "Laudo…"; fora os anexos, o laudo social e o "Petição (A LAUDO MÉDICO)" das partes.
  const SOCIAL = /laudo social|assistente social|estudo social|per[íi]cia social|socioecon/i;
  function laudos(num) {
    const ds = CR.mem.docs[num] || [];
    const ls = ds.filter((x) => /^Laudo/i.test(x.ti) && !/anexo/i.test(x.ti));
    const med = ls.filter((x) => !/social|socioecon/i.test(x.ti) && !SOCIAL.test((CR.mem.txt[x.id] || '').slice(0, 1500)));
    const soc = ls.filter((x) => !med.includes(x));
    let L = null;
    if (med.length) {
      const d0 = ymd(med[0].data);
      L = med.filter((x) => ymd(x.data) === d0).sort((a, b) => (b.len || 0) - (a.len || 0))[0];
    }
    const socDepois = L ? soc.filter((x) => +x.id > +L.id) : soc;
    // Outros laudos médicos de outra data: laudo complementar (combinar) ou de outra especialidade (classificar os dois).
    const outrosMed = L ? med.filter((x) => ymd(x.data) !== ymd(L.data)) : [];
    // Laudo social mais recente que o médico (ou único laudo, no BPC ao idoso): é ele que se classifica (30/10/2026).
    // Entre os do mesmo dia, o de texto maior (o laudo, não a petição que o encaminha).
    let S = null;
    if (socDepois.length) {
      const d1 = ymd(socDepois.slice().sort((a, b) => +b.id - +a.id)[0].data);
      S = socDepois.filter((x) => ymd(x.data) === d1).sort((a, b) => (b.len || 0) - (a.len || 0))[0];
    }
    return { L, socDepois, outrosMed, S };
  }

  function pedido(t) {
    const s = t.slice(0, 8000);
    // Adicional de 25% sobre aposentadoria já concedida (regra própria, Setor de Perícias, 30/10/2026).
    if (/adicional de 25|acr[ée]scimo de 25|25\s*%\s*\(vinte e cinco por cento\)\s*(sobre|ao|no)/i.test(s)) return 'AD25';
    if (/benef[íi]cio assistencial|amparo (social|assistencial)|\bLOAS\b|\bBPC\b|presta[çc][ãa]o continuada|art\.?\s*203/i.test(s)) return 'BPC';
    if (/aux[íi]lio[\s-]*acidente/i.test(s)) return 'AA';
    if (/aux[íi]lio|aposentadoria|incapacidade/i.test(s)) return 'PREV';
    return '?';
  }

  function quadro(t) {
    // Quadro clínico: 6.3 (modelo da 7ª Vara) ou 5.3 (modelos com os quesitos de adulto no item 5).
    // "6.3 . O quadro" (ponto solto) em modelos de outros peritos (inclusive "5.3 . O quadro").
    const ini = t.search(/\b[56]\.3\s*\.?\s*O quadro cl[íi]nico/i);
    if (ini < 0) return { grau: '', sub: '', txt: '' };
    const fim = t.slice(ini + 10).search(/\b[56]\.4\s*\.?\s/);
    const w = t.slice(ini, fim > 0 ? ini + 10 + fim : ini + 1200);
    const c = compacta(w);
    const pos = [['A', c.search(/\[x\]\.?incapacita\S{0,4}total/)], ['B', c.search(/\[x\]\.?incapacita\S{0,4}parcial/)],
      ['C', c.search(/\[x\]\.?limita[çc][ãa]o/)], ['D', c.search(/\[x\]\.?n[ãa]ocausa/)]].filter((p) => p[1] >= 0).sort((a, b) => a[1] - b[1]);
    const grau = pos.length ? pos[0][0] : '';
    let sub = '', faixa = '', afast = false;
    if (grau === 'C') {
      const m = c.match(/\[x\](?:c\.\d)?limita[çc][ãa]o(a?moderadaaacentuada|leveamoderada|leve|moderada|acentuada|grave)/);
      // Faixas intermediárias (Setor de Perícias, 30/10/2026): leve a moderada = leve; moderada a acentuada = moderada.
      faixa = m ? { leveamoderada: 'leve a moderada', amoderadaaacentuada: 'moderada a acentuada', moderadaaacentuada: 'moderada a acentuada' }[m[1]] || '' : '';
      sub = m ? { leve: 'leve', moderada: 'moderada', acentuada: 'acentuada', grave: 'acentuada', leveamoderada: 'leve', amoderadaaacentuada: 'moderada', moderadaaacentuada: 'moderada' }[m[1]] : '';
      // Limitação COM recomendação de afastamento = incapacidade temporária (Setor de Perícias, 30/10/2026).
      afast = /\[x\]\.?comrecomenda|\[x\](?:c\.\d)?limita[çc][ãa]o[^\[]{0,140}comrecomenda/.test(c);
    }
    return { grau, sub, faixa, afast, txt: w.slice(0, 700) };
  }

  function duracao(t) {
    const ini = t.search(/\b[56]\.4\s*\.?\s*A incapacidade/i);
    if (ini < 0) return { dur: '', prazo: '', txt: '' };
    const w = t.slice(ini, ini + 520);
    const c = compacta(w);
    let dur = '', prazo = '';
    if (/\[x\]\.?definitiva/.test(c)) dur = 'DEFINITIVA';
    else if (/b\.2\[x\]|\[x\]sem(possibilidade|seestimar)/.test(c)) dur = 'SEM PRAZO';
    else if (/\[x\]\.?n[ãa]oh[áa]incapacidade/.test(c)) dur = 'NÃO HÁ';
    else if (/\[x\]\.?tempor[áa]ria/.test(c)) {
      dur = 'TEMPORÁRIA';
      const m = w.match(/(\d+)\s*(?:\([^)]*\))?\s*(dias?|m[eê]s(?:es)?|anos?)/i);
      if (m) prazo = m[1] + ' ' + m[2].toLowerCase();
    }
    return { dur, prazo, txt: w.slice(0, 380) };
  }
  const prazoMeses = (p) => { const m = (p || '').match(/(\d+) (\S+)/); if (!m) return null; return /^dia/.test(m[2]) ? +m[1] / 30.4375 : /^m/.test(m[2]) ? +m[1] : +m[1] * 12; };

  function menor(t) {
    const w = win(t, /\b5\.2\s*\.?\s*A doen[çc]a, defici[êe]ncia/i, 0, 420);
    const c = compacta(w);
    let g = '';
    if (/\[x\]sim,?degrauleve/.test(c)) g = 'leve';
    else if (/\[x\]sim,?degraumoderado/.test(c)) g = 'moderada';
    else if (/\[x\]sim,?degrauacentuado/.test(c)) g = 'acentuada';
    else if (/\[x\]n[ãa]o/.test(c)) g = 'NÃO';
    return { g, respondeu: /\[x\]/.test(c), txt: w.slice(0, 380) };
  }

  function resposta(w) {
    const c = compacta(w).slice(0, 60);
    if (/^(\??)(resposta:)?(\[x\])?\.?sim|^\??\[ \]n[ãa]o\.?\[x\]sim/.test(c)) return 'SIM';
    if (/^(\??)(resposta:)?(\[x\])?\.?n[ãa]o/.test(c)) return 'NÃO';
    if (/\[x\]sim/.test(c)) return 'SIM';
    if (/\[x\]n[ãa]o/.test(c)) return 'NÃO';
    return '?';
  }

  function analisa(num) {
    const ds = CR.mem.docs[num] || [];
    const res = (CR.res[num] || '').split('\n');
    const pa = (res[1] || '').replace(/^PA: /, '');
    const { L, socDepois, outrosMed, S } = laudos(num);
    const D = { num, nl: CR.nl[num] || 0, sig: /sig SIM/.test(res[0] || '') ? 'sim' : 'não', pa };
    const ini = ds.filter((x) => /inicial/i.test(x.ti)).pop() || ds[ds.length - 1];
    const ti = norm(ini ? CR.mem.txt[ini.id] : '');
    D.pedido = pedido(ti);
    D.pedTxt = win(ti, /(benef[íi]cio assistencial|amparo|LOAS|BPC|aux[íi]lio[- ]acidente|aux[íi]lio[- ]doen[çc]a|aux[íi]lio por incapacidade|aposentadoria por (invalidez|incapacidade)|benef[íi]cio por incapacidade|benef[íi]cio previdenci|restabelec|adicional de 25)/i, 60, 200);
    if (S) return social(D, S, ds);
    if (!L) { D.flags = ['SEM LAUDO MÉDICO NEM SOCIAL NA LISTA']; D.sug = 'ler pela tela?'; return D; }
    const t = norm(CR.mem.txt[L.id]);
    D.laudo = L;
    if (socDepois.length) D.social = socDepois.map((x) => x.data + ' ' + x.id).join(', ');
    D.outrosMed = outrosMed.map((x) => x.data + ' ' + x.id + ' «' + x.ti.slice(0, 40) + '»');
    D.pericia = data(win(t, /data da per[íi]cia|realiza[çc][ãa]o da per[íi]cia|data da realiza[çc][ãa]o/i, 0, 60).replace(/^[^:]*:/, ''));
    D.nasc = data(win(t, /data d[eo] nascimento|nascid[oa] em|nascimento\s*(-\s*idade\s*)?:/i, 0, 60).replace(/^[^\d]*/, ''));
    D.idade = idade(D.nasc, D.pericia);
    const q = quadro(t), du = duracao(t), mn = menor(t);
    Object.assign(D, { grau: q.grau, sub: q.sub, faixa: q.faixa, afast: q.afast, qTxt: q.txt, dur: du.dur, prazo: du.prazo, dTxt: du.txt, m52: mn.g, menorResp: mn.respondeu, mTxt: mn.txt });
    const diiW = win(t, /data prov[áa]vel de in[íi]cio da incapacidade/i, 0, 260).replace(/^.{0,90}?(Justifique\.?|\?)/i, '');
    D.diiTxt = diiW.slice(0, 200);
    D.dii = /desde o nascimento|in[íi]cio desde o nascimento/i.test(diiW) ? D.nasc : data(diiW);
    if (D.dur === 'TEMPORÁRIA' && D.prazo && D.dii) {
      const base = /contad\S* (a partir )?da (data de )?realiza|a partir da (data )?(desta )?per[íi]cia|da data desta per[íi]cia/i.test(du.txt) ? D.pericia : D.dii;
      const pm = prazoMeses(D.prazo);
      if (base && pm != null) { D.fim = new Date(base.getTime() + pm * 30.4375 * 864e5); D.intervalo = meses(D.dii, D.fim); D.baseFim = base === D.pericia ? 'perícia' : 'DII'; }
    }
    D.q71 = (() => { const w = win(t, /assist[êe]ncia permanente de outra pessoa para as atividades da vida di[áa]ria/i, 0, 140); return w ? resposta(w.replace(/^[^?]*\?|^.{0,95}di[áa]ria/i, '')) : '—'; })();
    D.cidF = /CID[\s\S]{0,20}?\bF\s?\d{2}|\bF\s?\d{2}\.\d/.test(t);
    // Acidente do trabalho ou de trajeto: resposta ao 6.8 (ou 5.8 do modelo com quesitos de adulto no item 5) ou menção no texto.
    const aW = win(t, /decorre de acidente de trabalho/i, 0, 160).replace(/^.{0,110}?(ocupacional|trabalho)\s*\??/i, '');
    D.acid = [];
    if (aW && resposta(aW) === 'SIM') D.acid.push('quesito de acidente do trabalho = SIM');
    // "(acidente típico, acidente de trajeto, etc)" é texto do quesito, não resposta.
    const tr = t.match(/acidente\s+(no|de)\s+traje\s?to(?!,?\s*etc)[^.;]{0,80}/i);
    if (tr) D.acid.push('"' + tr[0].slice(0, 90) + '"');
    const at = t.match(/(sofreu|v[íi]tima de)\s+acidente\s+(t[íi]pico\s+)?d[eo]\s+trabalho[^.;]{0,60}/i);
    if (at) D.acid.push('"' + at[0].slice(0, 90) + '"');
    const ex = t.match(/[^.]{0,120}(solicit\S*\s+(a\s+)?(realiza\S*\s+de\s+)?(o\s+|os\s+)?exames?|aguard\S*\s+(o\s+)?(resultado|exame)|n[ãa]o\s+(é|foi)\s+poss[íi]vel\s+concluir|(laudo|per[íi]cia)\s+inconclusiv)[^.]{0,160}/i);
    D.exame = ex ? ex[0].slice(0, 280) : '';
    // Incapacidade só no passado (período encerrado antes da perícia) = Laudo D, com o período no Fundamento.
    const pp = t.match(/[^.]{0,80}(incapacidade|incapaz)[^.]{0,80}(pret[ée]rit|no per[íi]odo (de|entre)|entre \d{1,2}\/\d{1,2}\/\d{4} e|at[ée] \d{1,2}\/\d{1,2}\/\d{4}, quando)[^.]{0,120}/i);
    D.passada = pp ? pp[0].slice(0, 260) : '';
    // Perícia in loco: pedido da parte em documento posterior ao último laudo.
    D.inloco = ds.filter((x) => +x.id > +L.id && !/^Laudo/i.test(x.ti) && /per[íi]cia\s+(in\s+loco|domiciliar|hospitalar)|realiza\S*\s+(d[ao]\s+)?per[íi]cia\s+(no|na)\s+(hospital|resid|domic|pres[íi]dio|unidade|cl[íi]nica)/i.test(CR.mem.txt[x.id] || '')).map((x) => x.data + ' ' + x.id + ' ' + x.ti.slice(0, 40));
    // Mesma pessoa: CPF do laudo × CPF do autor no PJe; sem CPF no laudo, o nome (ou as iniciais, no processo de menor).
    const cpfPA = ((pa.match(/CPF ([\d.\-]+) \(AUTOR\)/) || [])[1] || '').replace(/\D/g, '');
    const cpfL = ((t.match(/CPF\s*:?\s*([\d.\s-]{13,22})/) || [])[1] || '').replace(/\D/g, '').slice(0, 11);
    const nomePA = (pa.match(/^(.+?) CPF /) || [])[1] || '';
    const nomeL = (t.match(/(?:PERICIAD[OA]\s*(?:\(A\))?\s*:\s*(?:[–-]\s*Nome\s*:)?|AUTOR\s*\(A\)\s*:|AUTOR \(A\) :|Nome\s*:)\s*([A-ZÀ-Úa-zà-ú\s]{6,70}?)(?=\s+(RG|R[ÉE]U|CPF|identidade|Data|[–;-]|ESPECIALIDADE))/) || [])[1] || '';
    const so = (s) => s.normalize('NFD').replace(/[^A-Za-z]/g, '').toUpperCase();
    let pessoa = '?';
    if (cpfPA && cpfL.length === 11) pessoa = cpfPA === cpfL ? 'ok (CPF)' : 'CPF DIFERENTE: laudo ' + cpfL;
    else if (nomePA && nomeL) {
      if (/^([A-Z]\. )+[A-Z]\.?$/.test(nomePA.trim())) {
        const ini = nomeL.trim().split(/\s+/).filter((w) => w.length > 1 || /^[A-Z]$/.test(w)).map((w) => w[0].toUpperCase()).join('');
        pessoa = so(nomePA) === ini ? 'ok (iniciais)' : 'conferir iniciais: PJe ' + nomePA + ' × laudo ' + nomeL.trim();
      } else pessoa = so(nomePA) === so(nomeL) ? 'ok (nome)' : 'conferir nome: PJe ' + nomePA + ' × laudo ' + nomeL.trim();
    }
    D.pessoa = pessoa;
    // Representação: curador ou representante de autor adulto no polo ativo, ou termo de curatela nos documentos.
    const reprPA = /\((CURADOR|CURADORA)\)/.test(pa) || (D.idade != null && D.idade >= 18 && /\(REPRESENTANTE\)/.test(pa));
    const reprDoc = ds.filter((x) => /termo de curatela|curatela (provis|definitiv)|(?<![a-zà-ú])curador[a]? (provis|definitiv|nomead)/i.test(CR.mem.txt[x.id] || '') || /curatela|curador/i.test(x.ti)).map((x) => x.data + ' ' + x.id);
    D.repr = reprPA ? 'curador/representante no polo ativo' : reprDoc.length ? 'documento: ' + reprDoc.slice(0, 3).join(', ') : '';
    // Petições das partes depois do laudo: só petição, contestação, impugnação, manifestação, outras peças e requerimento,
    // sem os anexos "(A …)" (procuração, documentos e dossiês que acompanham a petição não contam).
    D.pos = ds.filter((x) => +x.id > +L.id && /^(Peti[çc][ãa]o|Contesta|Impugna|Manifesta|Outras pe[çc]as|Requerimento)/i.test(x.ti) && !/\(A /.test(x.ti))
      .sort((a, b) => +a.id - +b.id)
      .map((x) => x.data + ' ' + (/PROPOSTA DE ACORDO/i.test(x.ti) ? 'proposta de acordo do INSS' : /^Contesta/i.test(x.ti) ? 'contestação' : /Impugna/i.test(x.ti) ? 'impugnação' : /Manifesta/i.test(x.ti) ? 'manifestação' : 'petição') + ' (ID ' + x.id + ')');
    sugere(D);
    return D;
  }

  // Laudo social (Setor de Perícias e usuário, 30/10/2026). Ordem: endereço > divergência > renda per capita × 1/2 SM.
  // A renda per capita vem só do laudo; BPC ou benefício de até 1 SM de outro idoso/PcD do grupo é excluído (art. 20, § 14, LOAS):
  // o script só aponta a menção, o recálculo é feito na leitura, com os dados do próprio laudo.
  const brl = (s) => +String(s).replace(/\./g, '').replace(',', '.');
  function social(D, S, ds) {
    const t = norm(CR.mem.txt[S.id]);
    D.tipo = 'social'; D.laudo = S;
    const rW = win(t, /renda\s*(mensal\s*)?(familiar\s*)?per\s*capita/i, 0, 260);
    const rv = rW.match(/R\$\s*([\d.]+,\d{2})/);
    D.rpc = rv ? brl(rv[1]) : null;
    D.rpcTxt = rW.slice(0, 260);
    const end = t.match(/[^.]{0,100}(n[ãa]o\s+(foi\s+)?(encontrad|localizad)\S*[^.]{0,40}(endere|resid|im[óo]vel|autor|requerente)|n[ãa]o\s+(encontrei|localizei|consegui localizar)|mudou-se|(n[ãa]o\s+)?reside\s+mais|n[ãa]o\s+reside\s+no\s+endere|endere[çc]o\s+(diverg|incorret|inexist|n[ãa]o\s+confere))[^.]{0,120}/i);
    D.endTxt = end ? end[0].slice(0, 260) : '';
    const div = t.match(/[^.]{0,100}(diverg[êe]nci\S*|contradi\S*|n[ãa]o\s+condiz\S*|incompat[íi]ve\S*\s+com\s+o\s+(declarad|informad|relatad)\S*)(?![^.]{0,40}endere)[^.]{0,140}/i);
    D.divTxt = div ? div[0].slice(0, 280) : '';
    const bf = t.match(/[^.]{0,80}(\bBPC\b|benef[íi]cio\s+(de\s+presta[çc][ãa]o\s+continuada|assistencial)|\bLOAS\b|aposentadoria|pens[ãa]o)[^.]{0,120}/i);
    D.benefTxt = bf ? bf[0].slice(0, 240) : '';
    D.pos = ds.filter((x) => +x.id > +S.id && /^(Peti[çc][ãa]o|Contesta|Impugna|Manifesta|Outras pe[çc]as|Requerimento)/i.test(x.ti) && !/\(A /.test(x.ti))
      .sort((a, b) => +a.id - +b.id).map((x) => x.data + ' ' + (/PROPOSTA DE ACORDO/i.test(x.ti) ? 'proposta de acordo do INSS' : /^Contesta/i.test(x.ti) ? 'contestação' : /Manifesta/i.test(x.ti) ? 'manifestação' : 'petição') + ' (ID ' + x.id + ')');
    const meio = LM.sm ? LM.sm / 2 : null;
    let c;
    if (D.endTxt) c = 'Social - esclarecer localização';
    else if (D.divTxt) c = 'Social - divergência';
    else if (D.rpc == null) c = 'INDEFINIDO';
    else if (meio == null) c = 'definir o salário mínimo (LM.config)';
    else c = D.rpc <= meio ? 'Social - renda até 1/2 SM' : 'Social - renda acima de 1/2 SM';
    D.sug = c; D.etq = ETQ(c);
    D.flags = [];
    if (D.benefTxt) D.flags.push('BENEFÍCIO NO GRUPO? conferir se entrou na renda e excluir BPC/benefício de até 1 SM de outro idoso ou PcD: ' + D.benefTxt);
    if (D.pedido !== 'BPC') D.flags.push('pedido da inicial não identificado como BPC: conferir');
    return D;
  }

  // ---- v3: proposta de acordo (mesmo método da jef-expediente-manifestacao, analise-lote.js v2) ----
  const INSS_FORTE = /PROCURADORIA[- ]GERAL FEDERAL|ADVOCACIA[- ]GERAL DA UNI|Demandas Judiciais do INSS|CEAB|APSDJ|AADJ|Equipe de C[áa]lculo|ECALC|CALPREV|Ag[êe]ncia do INSS DJ|PROCURADORIA FEDERAL|Procurador(a)? Federal/i;
  const ADVOGADO = /por (seu|sua|interm[ée]dio de) (seus? |suas? )?(advogad|procurador(a)? (que|abaixo|ao final|infra|constitu))|advogad[oa]s? (abaixo|ao final|infra|subscrit)|\bOAB\b|por sua (advogada|procuradora)|procurador(a)? constitu[íi]d|(adiante|ao final|abaixo|in fine) assinad|patrono/i;
  const PERITO = /perit[oa] (m[ée]dic|judicial|do ju[íi]zo|nomead)|assistente social|laudo (m[ée]dico )?pericial|estudo social|auto de constata/i;
  const tituloINSS = (tit) => /\(P [A-ZÀ-Ú]/.test(tit) || /^Contesta/i.test(tit);
  const origem = (t, tit) => tituloINSS(tit || '') || INSS_FORTE.test(t.slice(0, 300)) ? 'INSS'
    : PERITO.test(t.slice(0, 300)) && /^Laudo/i.test(tit || '') ? 'perito'
    : ADVOGADO.test(t.slice(0, 3000)) ? 'autor'
    : PERITO.test(t.slice(0, 600)) ? 'perito'
    : INSS_FORTE.test(t) ? 'INSS'
    : /parte autora|requerente/i.test(t) ? 'autor' : '?';
  const IMPOSS = /IMPOSSIBILIDADE DE (ACORDO|PROPOSTA|CONCILIA)|n[ãa]o (h[áa]|vislumbra|apresenta|existe|ser[áa] apresentad)\w*.{0,60}(proposta|acordo|concilia)|sem proposta de acordo|deixa de (apresentar|ofertar|oferecer) proposta|invi[áa]vel.{0,40}(proposta|acordo)/i;
  const PROPOSTA = /PROPOSTA DE ACORDO|prop[õo]e(-se)?,? (o |a celebra[çc][ãa]o de )?acordo|oferece.{0,60}(acordo|proposta)|apresenta(r)?,? .{0,40}proposta|termos do acordo|TERMOS DA PROPOSTA|proposta conciliat/i;
  const TERMOS = /\bDIB\b|\bDIP\b|\bRMI\b|percentual|\d{2,3} ?%|atrasados|implanta[çc][ãa]o|restabelec|concess[ãa]o do benef|valores? (atrasad|retroativ)/i;
  const ehProva = (tit) => /^(Documento|Outros Documentos|Outras pe[çc]as)/i.test(tit);
  const PROMESSA = /poder[áa],?[^.]{0,60}apresentar,? proposta|proposta de acordo ou defesa de m[ée]rito|ap[óo]s (?:a (?:realiza[çc][ãa]o|juntada) d)?o laudo[^.]{0,80}(?:proposta|acordo)|aus[êe]ncia do laudo[^.]{0,120}(?:acordo|proposta)|otimizar a concilia/i;
  const PROMESSA_FRASE = new RegExp('[^.]{0,250}(?:' + PROMESSA.source + ')[^.]{0,250}', 'gi');
  const PROPOSTA_FORTE = /TIPO 1 ?[-–] ?(ACORDO DIRETO|CONTESTA[ÇC][ÃA]O COM PROPOSTA)|PROPOR TRANSA[ÇC][ÃA]O|o INSS se (obriga|compromete)/i;
  function marcasAcordo(t, tit) {
    const m = [], o = origem(t, tit);
    if (o === 'INSS') {
      const tp = t.replace(PROMESSA_FRASE, ' ');
      if (!t.trim() && /PROPOSTA DE ACORDO/i.test(tit)) m.push('PROPOSTA');
      else if (PROPOSTA_FORTE.test(t.slice(0, 2500))) m.push('PROPOSTA');
      else if (IMPOSS.test(tp)) m.push('IMPOSSIBILIDADE');
      else if (!ehProva(tit) && (PROPOSTA.test(tp) || /proposta|acordo/i.test(tit)) && TERMOS.test(tp)) m.push('PROPOSTA');
      if (tp.length < t.length && !m.some((x) => x === 'PROPOSTA' || x === 'IMPOSSIBILIDADE')) m.push('PROMESSA');
      const semFormula = tp.replace(/(?:n[ãa]o (?:tem|possui|possuir)|aus[êe]ncia de) interesse (?:na|em) (?:realiza[çc][ãa]o de |designa[çc][ãa]o de )?audi[êe]ncia de concilia[çc][ãa]o/gi, '').replace(/AN[ÁA]LISE ESTRAT[ÉE]GICA ?- ?CONCILIA[ÇC][ÃA]O/gi, '');
      if (!m.length && /(?<!de )acordo(?! com)|concilia[çc]/i.test(semFormula)) m.push('ACORDO?');
    } else {
      const acTit = /aceit\w* (de |da |a )?proposta|aceite/i.test(tit);
      if ((acTit || /(aceit|concord|anu[êe])\w*.{0,120}(proposta|acordo|termos)|(proposta|acordo).{0,150}(aceit|concord|anu[êe]ncia)/i.test(t)) && !/n[ãa]o (aceit|concord)\w*.{0,60}(proposta|acordo)|recus\w*.{0,60}(proposta|acordo)/i.test(t)) m.push('ACEITA');
      if (/(n[ãa]o (aceit|concord)|recus|discord|rejeit)\w*.{0,80}(proposta|acordo)|(proposta|acordo).{0,60}(recus|rejeit|n[ãa]o (aceit|concord))|contra-?proposta/i.test(t)) m.push('RECUSA');
      if (/contra-?proposta/i.test(t)) m.push('CONTRAPROPOSTA');
    }
    return m;
  }
  // Só informa (decisão do usuário, 16/11/2026): não muda a classificação nem a etiqueta.
  function acordo(ds, lid) {
    const post = ds.filter((x) => +x.id > +lid && !/\(A /.test(x.ti) && !/^(Certid|Intima|Laudo|Of[íi]cio|Cita|Ato|Despacho|Decis|Senten|Expedi|Alvar|Mandado)/i.test(x.ti))
      .sort((a, b) => +a.id - +b.id).map((x) => ({ x, m: marcasAcordo(norm(CR.mem.txt[x.id] || ''), x.ti) }));
    const id = (p) => 'ID ' + p.x.id + ', ' + p.x.data;
    const pr = post.find((p) => p.m.includes('PROPOSTA'));
    if (pr) {
      const dep = post.filter((p) => +p.x.id > +pr.x.id);
      const ac = dep.find((p) => p.m.includes('ACEITA')), rc = dep.find((p) => p.m.includes('RECUSA'));
      if (ac) return 'COM PROPOSTA - aceita (proposta ' + id(pr) + '; aceitação ' + id(ac) + ')';
      if (rc) return (rc.m.includes('CONTRAPROPOSTA') ? 'COM PROPOSTA - contraproposta do autor' : 'COM PROPOSTA - recusada') + ' (proposta ' + id(pr) + '; ' + id(rc) + ')';
      return 'COM PROPOSTA (' + id(pr) + ')';
    }
    const im = post.find((p) => p.m.includes('IMPOSSIBILIDADE'));
    if (im) return 'impossibilidade de acordo (' + id(im) + ')';
    const pm = post.find((p) => p.m.includes('PROMESSA'));
    if (pm) return 'promessa de proposta (' + id(pm) + ')';
    const aq = post.find((p) => p.m.includes('ACORDO?'));
    if (aq) return 'ACORDO? ler o teor (' + id(aq) + ')';
    return 'não há';
  }

  // ---- v3: intimação das partes sobre o laudo (modelos do usuário, 16/11/2026) ----
  // "Intimação": "ficam as partes intimadas para se manifestarem sobre o(s) laudo(s) pericial(is)".
  // "Certidão de Intimação (Outros)": "EXPEDIENTES GERADOS", com a parte, o documento "(<id> - Intimação)", o meio e o prazo.
  // Em ordem: certidão depois do laudo com o expediente do INSS e o da parte autora. Sem ela: FALHA NA INTIMAÇÃO.
  const ehIntim = (x) => /^Intima[çc][ãa]o$/i.test(x.ti);
  const ehCertInt = (x) => /^Certid[ãa]o de Intima/i.test(x.ti);
  const letras = (s) => (s || '').normalize('NFD').replace(/[^A-Za-z]/g, '').toUpperCase();
  function intimacao(ds, lid, pa) {
    const post = ds.filter((x) => +x.id > +lid);
    const certs = post.filter(ehCertInt).sort((a, b) => +b.id - +a.id);
    const intims = post.filter(ehIntim);
    const sobreLaudo = (id) => /intimad\S*[^.]{0,200}laudo|laudo\S*[^.]{0,80}(manifest|ci[êe]ncia)/i.test(norm(CR.mem.txt[id] || ''));
    if (!certs.length) return { v: 'FALHA NA INTIMAÇÃO', mot: 'sem certidão de intimação depois do laudo' + (intims.length ? ' (há Intimação ' + intims.map((x) => x.id).join(', ') + ' sem certidão)' : ''), mpf: false };
    const nomePA = (pa.match(/^(.+?) CPF /) || [])[1] || '';
    let melhor = null;
    for (const c of certs) {
      const t = norm(CR.mem.txt[c.id] || '');
      if (!t.trim()) { melhor = melhor || { v: 'conferir', mot: 'certidão ' + c.id + ' sem texto: ler pela tela' }; continue; }
      const k = t.search(/EXPEDIENTES GERADOS/i);
      const exp = k >= 0 ? t.slice(k) : t;
      const autorCert = (t.match(/POLO ATIVO\s*:\s*(.+?)\s+(REPRESENTANTES POLO ATIVO|POLO PASSIVO)/i) || [])[1] || nomePA;
      const inss = /INSTITUTO NACIONAL DO SEGURO|\bINSS\b/i.test(exp);
      const autor = !!autorCert && letras(exp).includes(letras(autorCert));
      const refs = [...new Set([...exp.matchAll(/\(\s*(\d{6,})\s*-\s*Intima/gi)].map((m) => m[1]))];
      const laudo = refs.length ? refs.some((id) => sobreLaudo(id)) : intims.some((x) => sobreLaudo(x.id));
      const mpf = /MINIST[ÉE]RIO P[ÚU]BLICO|\bMPF\b/i.test(exp);
      const r = { inss, autor, laudo, mpf, c, refs };
      if (inss && autor) return { v: 'ok', mot: 'certidão ' + c.id + ' (' + c.data + '): expedientes do INSS e da parte autora' + (refs.length ? ', Intimação ' + refs.join(', ') : '') + (laudo ? ' sobre o laudo' : ' — conferir se a Intimação é sobre o laudo'), mpf, conferir: !laudo };
      if (!melhor || melhor.v === 'conferir') melhor = { v: 'FALHA NA INTIMAÇÃO', mot: 'certidão ' + c.id + ' (' + c.data + ') sem o expediente ' + (!inss && !autor ? 'do INSS e da parte autora' : !inss ? 'do INSS' : 'da parte autora'), mpf, r };
    }
    return melhor;
  }

  // ---- v3: MPF (decisão do usuário, 16/11/2026): MPF cadastrado ou que já se manifestou nos autos, e também os casos em que
  // ele deveria atuar (parte autora menor ou incapaz) → "INTIMAR MPF".
  const MPF_RE = /MINIST[ÉE]RIO P[ÚU]BLICO( FEDERAL)?|\bMPF\b|PROCURADORIA DA REP[ÚU]BLICA/i;
  function mpf(num, ds, D) {
    const mot = [];
    const partes = (CR.mem.partes || {})[num];
    if (partes && MPF_RE.test(partes)) mot.push('MPF cadastrado no processo');
    const man = ds.filter((x) => /^(Parecer|Manifesta|Peti|Cota|Outras)/i.test(x.ti) && /MINIST[ÉE]RIO P[ÚU]BLICO FEDERAL|PROCURADORIA DA REP[ÚU]BLICA|Procurador(a)? da Rep[úu]blica/i.test((CR.mem.txt[x.id] || '').slice(0, 1500)));
    if (man.length) mot.push('manifestação do MPF nos autos (ID ' + man.map((x) => x.id).slice(0, 3).join(', ') + ')');
    const ih = idade(D.nasc, new Date());
    if (ih != null && ih < 18) mot.push('parte autora menor (' + ih + ' anos hoje)');
    else if (/^([A-ZÀ-Ú]\.\s?){2,}/.test(D.pa || '')) mot.push('parte autora com o nome em iniciais (menor?)');
    if (/\((REPRESENTANTE|CURADOR|CURADORA|TUTOR|TUTORA)\)/.test(D.pa || '')) mot.push('representante ou curador no polo ativo');
    if (D.repr && /^documento/.test(D.repr)) mot.push('curatela nos autos (' + D.repr + ')');
    if (/^SIM/.test(D.cur || '')) mot.push('hipótese de curatela pelo laudo');
    D.mpf = mot.length ? 'INTIMAR MPF' : '';
    D.mpfMot = mot.join('; ') + (partes == null ? (mot.length ? '; ' : '') + 'polo passivo não lido (carregue o CR v12)' : '');
  }
  function extras(num, D) {
    const ds = CR.mem.docs[num] || [];
    if (D.laudo) {
      D.acordo = acordo(ds, D.laudo.id);
      const it = intimacao(ds, D.laudo.id, D.pa || '');
      D.intim = it.v; D.intimMot = it.mot; D.mpfIntimado = it.mpf;
    } else { D.acordo = '?'; D.intim = '?'; D.intimMot = 'sem laudo identificado'; }
    mpf(num, ds, D);
    if (D.mpf && D.mpfIntimado) D.mpfMot += '; o MPF já consta da certidão de intimação do laudo';
  }

  // Classificação -> chave da etiqueta na configuração da unidade (seção "## jef-analise-laudo").
  // O nome da etiqueta vem de LM.cfg.etiquetas (LM.config); o script não traz nome de etiqueta de nenhuma unidade.
  const CHAVE_ETQ = {
    'Social - esclarecer localização': 'etiqueta_social_esclarecer_localizacao',
    'Social - divergência': 'etiqueta_social_divergencia',
    'Social - renda até 1/2 SM': 'etiqueta_social_renda_ate_meio_sm',
    'Social - renda acima de 1/2 SM': 'etiqueta_social_renda_acima_meio_sm',
    'LOAS - Designar social': 'etiqueta_loas_designar_social',
    'Prioridade (AD/AI/LOAS)': 'etiqueta_prioridade',
    'Limitação moderada ou grave': 'etiqueta_limitacao_moderada_grave',
    'Laudo C': 'etiqueta_laudo_c', 'Laudo D': 'etiqueta_laudo_d',
    'Complementação de laudo': 'etiqueta_complementacao_laudo', 'Exame complementar': 'etiqueta_exame_complementar',
    'Adicional de 25% - assistência permanente': 'etiqueta_adicional_25',
    AVISO: 'etiqueta_aviso_indefinido', INDEFINIDO: 'etiqueta_aviso_indefinido',
  };
  const ETQ = (c) => (CHAVE_ETQ[c] ? LM.cfg.etiquetas[CHAVE_ETQ[c]] || '' : '');
  const CHAVES = [...new Set(Object.values(CHAVE_ETQ))];
  const faltaCfg = () => CHAVES.filter((k) => { const v = String(LM.cfg.etiquetas[k] || '').trim(); return !v || /^PENDENTE$/i.test(v); });
  // Sugestão pelas regras da skill, na ordem dela. Tudo com "?": a skill confere no texto.
  function sugere(D) {
    const f = [];
    if (D.social) f.push('LAUDO SOCIAL depois do laudo médico (' + D.social + '): fora do escopo se o laudo médico já foi tratado');
    if (/DIFERENTE|conferir/.test(D.pessoa)) f.push('PESSOA: ' + D.pessoa);
    if (D.acid.length) f.push('ACIDENTE DO TRABALHO/TRAJETO: ' + D.acid.join(' | '));
    if (D.exame) f.push('EXAME? ' + D.exame);
    if (D.inloco.length) f.push('IN LOCO? ' + D.inloco.join('; '));
    if (D.pedido === '?') f.push('pedido não identificado na inicial');
    if (D.outrosMed && D.outrosMed.length) f.push('OUTRO LAUDO MÉDICO: ' + D.outrosMed.join('; ') + ' — complementar: combinar (o complementar prevalece no que responde); outra especialidade: classificar os dois e, se divergirem, INDEFINIDO');
    if (D.faixa) f.push('faixa "' + D.faixa + '" lida como ' + D.sub);
    if (D.passada) f.push('INCAPACIDADE PASSADA? ' + D.passada);
    D.flags = f;
    let c = '';
    const id = D.idade;
    if (D.social) c = 'FORA (laudo social)';
    else if (/DIFERENTE/.test(D.pessoa)) c = 'Complementação de laudo';
    else if (id != null && id <= 15 && !D.menorResp) c = 'Complementação de laudo';
    else if (id != null && (id === 16 || id === 17) && D.menorResp) c = 'Complementação de laudo';
    else if (D.exame) c = 'Exame complementar';
    else if (D.inloco.length) c = 'Perícia in loco';
    else if (D.acid.length) c = 'AVISO';
    // Adicional de 25%: decide o quesito da assistência permanente (7.1 no modelo da 7ª Vara; 6.1 em outros).
    else if (D.pedido === 'AD25') c = D.q71 === 'SIM' ? 'Adicional de 25% - assistência permanente' : D.q71 === 'NÃO' ? 'Laudo D' : 'INDEFINIDO';
    else {
      let g = D.grau, s = D.sub;
      if (id != null && id <= 15) { g = D.m52 === 'NÃO' ? 'D' : D.m52 ? 'C' : ''; s = D.m52 === 'NÃO' ? '' : D.m52; }
      if (g === 'A' || g === 'B') {
        if (D.pedido !== 'BPC') c = 'Prioridade (AD/AI/LOAS)';
        else if (D.dur === 'DEFINITIVA' || D.dur === 'SEM PRAZO' || (D.intervalo != null && D.intervalo >= 24)) c = 'LOAS - Designar social';
        else if (D.intervalo != null) c = 'Prioridade (AD/AI/LOAS)';
        else c = 'INDEFINIDO';
      } else if (g === 'C') {
        // Limitação COM recomendação de afastamento = incapacidade temporária (Setor de Perícias, 30/10/2026).
        if (D.afast && !(id != null && id <= 15)) c = 'Prioridade (AD/AI/LOAS)';
        else if (s === 'leve') c = 'Laudo C';
        else if (s === 'moderada' || s === 'acentuada') c = id != null && id < 18 ? 'LOAS - Designar social' : 'Limitação moderada ou grave';
        else c = 'INDEFINIDO';
      } else if (g === 'D') c = 'Laudo D';
      else c = 'INDEFINIDO';
      D.gSug = g; D.sSug = s;
    }
    D.sug = c;
    D.etq = ETQ(c);
    // Curatela (só sugestão): hipótese 1 = definitiva/sem prazo + assistência permanente + CID F; hipótese 2 = 18+, CID F, A definitiva, 7.1 SIM.
    const def = D.dur === 'DEFINITIVA' || D.dur === 'SEM PRAZO';
    // As duas hipóteses só para autor com 18 anos ou mais (Setor de Perícias, 30/10/2026).
    const h1 = D.idade != null && D.idade >= 18 && def && D.q71 === 'SIM' && D.cidF;
    const h2 = D.idade != null && D.idade >= 18 && D.cidF && D.grau === 'A' && D.dur === 'DEFINITIVA' && D.q71 === 'SIM';
    D.cur = (h1 || h2) ? (D.repr ? 'NÃO (já representado: ' + D.repr + ')' : 'SIM? hipótese ' + [h1 && '1', h2 && '2'].filter(Boolean).join(' e ')) : 'não';
    if (!h1 && def && D.cidF && D.q71 === '—' && !(D.idade != null && D.idade < 18)) D.cur = 'conferir: laudo sem quesito de assistência permanente — procurar no texto';
  }

  function resumo(D) {
    const L = D.laudo;
    const linhas = ['#' + (CR.ord[D.num] || '?') + ' ' + D.num + ' | sig ' + D.sig + ' | naoLidos ' + D.nl, 'PA: ' + D.pa];
    if (D.tipo === 'social') {
      return linhas.concat([
        'LAUDO SOCIAL ' + L.id + ' juntado ' + L.data + ' «' + L.ti.slice(0, 60) + '»',
        'PEDIDO: ' + D.pedido + ' — ' + D.pedTxt,
        'RENDA PER CAPITA: ' + (D.rpc != null ? 'R$ ' + D.rpc.toFixed(2) : '?') + ' | 1/2 SM: ' + (LM.sm ? 'R$ ' + (LM.sm / 2).toFixed(2) : '? (LM.config)'),
        'T-RENDA: ' + D.rpcTxt,
        'T-ENDEREÇO: ' + (D.endTxt || '—'),
        'T-DIVERGÊNCIA: ' + (D.divTxt || '—'),
        'PÓS-LAUDO: ' + (D.pos.length ? D.pos.join('; ') : 'não há'),
        'PROPOSTA: ' + D.acordo + ' | INTIMAÇÃO DO LAUDO: ' + D.intim + ' — ' + D.intimMot,
        'MPF: ' + (D.mpf || '—') + (D.mpfMot ? ' (' + D.mpfMot + ')' : ''),
        D.flags.length ? 'ATENÇÃO: ' + D.flags.join(' || ') : '',
        'SUG: ' + D.sug + '? | ' + D.etq,
      ].filter(Boolean)).join('\n');
    }
    if (!L) return linhas.concat(['SEM LAUDO MÉDICO NA LISTA', 'PEDIDO: ' + D.pedido + ' — ' + D.pedTxt, 'MPF: ' + (D.mpf || '—') + (D.mpfMot ? ' (' + D.mpfMot + ')' : ''), 'SUG: ' + D.sug]).join('\n');
    linhas.push('LAUDO ' + L.id + ' juntado ' + L.data + ' «' + L.ti.slice(0, 60) + '» | perícia ' + fmt(D.pericia) + ' | nasc ' + fmt(D.nasc) + ' | idade ' + (D.idade ?? '?') + ' | pessoa ' + D.pessoa);
    linhas.push('PEDIDO: ' + D.pedido + ' — ' + D.pedTxt);
    linhas.push('QUADRO: grau ' + (D.grau || '?') + (D.sub ? ' ' + D.sub : '') + (D.faixa ? ' (faixa ' + D.faixa + ')' : '') + (D.afast ? ' COM AFASTAMENTO' : '') + ' | DUR ' + (D.dur || '?') + (D.prazo ? ' ' + D.prazo + ' (conta da ' + (D.baseFim || '?') + ')' : '') + ' | DII ' + fmt(D.dii) + (D.fim ? ' | fim ' + fmt(D.fim) + ' | intervalo ' + D.intervalo.toFixed(1) + ' meses' : ''));
    if (D.idade != null && D.idade < 18 || D.menorResp) linhas.push('MENOR: 5.2 ' + (D.m52 || '?') + ' | quesitos de menor respondidos: ' + (D.menorResp ? 'sim' : 'não'));
    linhas.push('assistência permanente (7.1 ou 6.1): ' + D.q71 + ' | CID F: ' + (D.cidF ? 'sim' : 'não') + ' | representação: ' + (D.repr || 'nenhuma'));
    linhas.push('PÓS-LAUDO: ' + (D.pos.length ? D.pos.join('; ') : 'não há'));
    linhas.push('PROPOSTA: ' + D.acordo + ' | INTIMAÇÃO DO LAUDO: ' + D.intim + ' — ' + D.intimMot);
    linhas.push('MPF: ' + (D.mpf || '—') + (D.mpfMot ? ' (' + D.mpfMot + ')' : ''));
    if (D.flags.length) linhas.push('ATENÇÃO: ' + D.flags.join(' || '));
    linhas.push('SUG: ' + D.sug + '? | ' + D.etq + ' | curatela ' + D.cur);
    linhas.push('T-QUADRO: ' + D.qTxt);
    linhas.push('T-DURAÇÃO: ' + D.dTxt);
    linhas.push('T-DII: ' + D.diiTxt);
    if (D.idade != null && D.idade < 18 || D.menorResp) linhas.push('T-5.2: ' + D.mTxt);
    return linhas.join('\n');
  }

  LM.prep = async function (nums) {
    const falta = faltaCfg();
    if (falta.length) return 'configure as etiquetas da unidade antes de iniciar: LM.config({ etiquetas: { ... } }) — faltam: ' + falta.join(', ');
    for (const num of nums) {
      try {
        if (!CR.mem.docs[num]) { LM.out[num] = '#' + num + ' AINDA NÃO LIDO PELO CR'; continue; }
        const { L, S } = laudos(num);
        if (S) await CR.txt(S.id, 40);
        else if (L) await CR.txt(L.id, 40);
        // v3: Intimação e Certidão de Intimação depois do laudo (o CR pula a certidão pelo título): baixa o texto aqui.
        const lid = (S || L || {}).id;
        if (lid) {
          const alvo = (CR.mem.docs[num] || []).filter((x) => +x.id > +lid && (ehIntim(x) || ehCertInt(x)) && !(CR.mem.txt[x.id] || '').trim()).slice(0, 8);
          for (const x of alvo) { try { await CR.txt(x.id, 3); } catch (e) { } }
        }
        const D = analisa(num);
        extras(num, D);
        LM.dados[num] = D;
        LM.out[num] = resumo(D);
      } catch (e) { LM.out[num] = '#' + num + ' ERRO ' + String(e).slice(0, 160); }
    }
    return 'prep ' + nums.length;
  };
  LM.fila = function (nums) {
    const falta = faltaCfg();
    if (falta.length) { LM.st = 'sem configuração'; return 'configure as etiquetas da unidade antes de iniciar: LM.config({ etiquetas: { ... } }) — faltam: ' + falta.join(', '); }
    LM.st = 'rodando'; LM.prep(nums).then(() => { LM.st = 'pronto'; }, (e) => { LM.st = 'erro ' + e; }); return 'fila ' + nums.length; };
  LM.ver = function (nums) {
    let p = document.getElementById('__out');
    if (!p) { p = document.createElement('pre'); p.id = '__out'; p.style.whiteSpace = 'pre-wrap'; document.body.appendChild(p); }
    p.textContent = nums.map((n) => LM.out[n] || ('#' + n + ' sem resumo')).join('\n\n----------\n\n').replaceAll('=', ':');
    return p.textContent.length + ' caracteres no quadro';
  };
  // Sugestões em uma linha por processo, para comparar com o andamento.
  LM.tabela = function (nums) {
    return nums.map((n) => { const D = LM.dados[n]; return D ? (CR.ord[n] || '?') + ' ' + n.slice(0, 10) + ' ' + D.sug + ' | ' + (D.tipo === 'social' ? 'social, renda ' + (D.rpc ?? '?') : (D.grau || '-') + (D.sub ? ' ' + D.sub : '')) + ' | cur ' + String(D.cur || '-').slice(0, 20) + ' | prop ' + String(D.acordo || '-').slice(0, 30) + ' | intim ' + (D.intim || '-') + ' | ' + (D.mpf || 'sem MPF') : n + ' -'; }).join('\n');
  };
  // Salário mínimo vigente, conferido pela skill em fonte oficial a cada execução (critério de renda do laudo social),
  // e etiquetas da unidade (docs/configuracao-unidade.md, seção "## jef-analise-laudo"), com as chaves de CHAVES.
  LM.config = function (o) {
    if (o && o.sm) { LM.sm = +o.sm; LM.cfg.sm = LM.sm; }
    if (o && o.etiquetas) {
      const erradas = Object.keys(o.etiquetas).filter((k) => !CHAVES.includes(k));
      if (erradas.length) return 'chave de etiqueta desconhecida: ' + erradas.join(', ') + ' (válidas: ' + CHAVES.join(', ') + '); nada foi gravado';
      for (const k of Object.keys(o.etiquetas)) LM.cfg.etiquetas[k] = String(o.etiquetas[k] == null ? '' : o.etiquetas[k]).trim();
    }
    const falta = faltaCfg();
    return 'salário mínimo ' + (LM.sm ? LM.sm + ' | 1/2 = ' + (LM.sm / 2).toFixed(2) : 'não informado') +
      ' | etiquetas: ' + (CHAVES.length - falta.length) + ' de ' + CHAVES.length + ' configuradas' + (falta.length ? ' — faltam: ' + falta.join(', ') : '');
  };
  // ÚNICA GRAVAÇÃO: MARCAR TODOS COMO LIDOS, um processo por vez, só nos que tinham não lidos na leitura (CR.nl), depois de gravada
  // a classificação no andamento. O CR.marca não marca se o número de não lidos mudou desde a leitura.
  LM.marcaFila = function (nums) {
    const L = (nums || Object.keys(CR.nl)).filter((n) => CR.nl[n] > 0);
    LM.mk = { __total: L.length };
    (async () => {
      for (const n of L) {
        try { LM.mk[n] = await CR.marca(n, CR.nl[n]); } catch (e) { LM.mk[n] = n + ' ERRO ' + e; }
        await new Promise((r) => setTimeout(r, 2500));
      }
      LM.mk.__fim = true;
    })();
    return 'marcando ' + L.length;
  };
  return 'LM v' + LM.versao + ' carregado';
})();
