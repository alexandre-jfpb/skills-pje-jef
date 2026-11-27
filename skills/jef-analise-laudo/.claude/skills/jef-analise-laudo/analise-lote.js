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
  LM.versao = 7; // v2, 30/10/2026: respostas do Setor de Perícias (afastamento, faixas, adicional de 25%, curatela 18+, outros laudos, incapacidade passada)
  // v3, 16/11/2026: proposta de acordo depois do laudo (só informa, com o método da jef-expediente-manifestacao), intimação das
  // partes sobre o laudo (Intimação + Certidão de Intimação com os expedientes do INSS e da parte autora; sem ela, FALHA NA
  // INTIMAÇÃO) e MPF (cadastrado, manifestação nos autos, ou parte autora menor ou incapaz → INTIMAR MPF). Pede o CR v12.
  // v4, 17/11/2026 (erros achados num lote real de 50 processos): adicional de 25% só quando é o pedido isolado
  // (o acréscimo "na hipótese de" assistência permanente, junto com auxílio ou aposentadoria, é subsidiário); quesitos de
  // menor também no item 4 (modelos com os quesitos de menor nesse item); aceite com a palavra partida ("a ceitar") e
  // petição "(A PARTE AUTORA ACEITA …)" sem "(P …)" no mesmo dia não é anexo; pós-laudo com alegações finais, resposta,
  // réplica, emenda e pedido de homologação; laudo lido até a página 100; certidão da assistente social de endereço não
  // localizado; laudo complementar sem o quadro clínico combinado com o laudo anterior; dossiês do INSS "Laudo Pericial
  // (<CPF> …)" fora dos laudos; laudo social que não confirma a composição do grupo familiar = divergência.
  // v5, 18/11/2026: pedido previdenciário com incapacidade (A/B ou limitação com afastamento) → "Incapacidade - CEJUSC";
  // "Prioridade" só para segurado especial ou quando o INSS alegou falta de carência ou perda da qualidade de segurado.
  // Linha "PARTES OUVIDAS" (manifestação depois do laudo ou "Decorrido prazo" depois da intimação do laudo). Pede o CR v13.
  // v6, 18/11/2026: com as duas partes ouvidas e sem MPF, valem as regras da triagem de expediente para a rotina que
  // trataria a etiqueta do laudo (C, D, INC, LIM, LOAS, CEJ, LA): marca D.exp, e LM.paraExp(nums) devolve a lista
  // "processo|rotina" para o EM.inicia da jef-expediente-manifestacao.

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
    // v4: fora os dossiês do INSS juntados como "Laudo Pericial (<CPF> Dossiê…/Extrato CNIS/…)" e, havendo "Laudo Pericial",
    // os "Laudo Médico" juntados pelas partes.
    let ls = ds.filter((x) => /^Laudo/i.test(x.ti) && !/anexo/i.test(x.ti) && !/^Laudo Pericial\s*\(\s*\d{11}/i.test(x.ti));
    if (ls.some((x) => /^Laudo Pericial/i.test(x.ti))) ls = ls.filter((x) => !/^Laudo M[ée]dico/i.test(x.ti));
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
  // v4: quadro clínico (6.3 ou 5.3) presente no texto; sem ele, o laudo é complementar (ou não carregou).
  const QUADRO_RE = /\b[5-7]\.3\s*\.?\s*O quadro cl[íi]nico/i;
  // O laudo mais recente de uma lista: a data mais recente e, no mesmo dia, o de texto maior.
  function anterior(list) {
    if (!list || !list.length) return null;
    const s = list.slice().sort((a, b) => +b.id - +a.id);
    const d0 = ymd(s[0].data);
    return s.filter((x) => ymd(x.data) === d0).sort((a, b) => (b.len || 0) - (a.len || 0))[0];
  }

  const AD25_RE = /adicional de 25|acr[ée]scimo de 25|25\s*%\s*\(vinte e cinco por cento\)\s*(sobre|ao|no)|grande invalidez/i;
  const OUTRO_PEDIDO = /(concess[ãa]o|conceder|restabelec\w*|prorroga\w*|convers[ãa]o|converter|implanta\w*)\s+(o\s+|a\s+|de\s+|do\s+|da\s+|em\s+)?(benef[íi]cio|aux[íi]lio|aposentadoria|amparo|BPC|LOAS)/i;
  function pedido(t) {
    const s = t.slice(0, 8000);
    // Adicional de 25% sobre aposentadoria já concedida (regra própria, Setor de Perícias, 30/10/2026).
    // v4: só quando é o pedido isolado — no título da ação, ou sem pedido de concessão/restabelecimento de benefício na inicial.
    // O acréscimo pedido "na hipótese de" assistência permanente, junto com auxílio ou aposentadoria, é subsidiário (pedido comum).
    const acao = (s.match(/A[ÇC][ÃA]O\b[^.]{0,220}?(?=\s(?:em face|contra|em desfavor)\b)/i) || [''])[0];
    if (AD25_RE.test(acao) || (AD25_RE.test(s) && !OUTRO_PEDIDO.test(t))) return 'AD25';
    if (/benef[íi]cio assistencial|amparo (social|assistencial)|\bLOAS\b|\bBPC\b|presta[çc][ãa]o continuada|art\.?\s*203/i.test(s)) return 'BPC';
    if (/aux[íi]lio[\s-]*acidente/i.test(s)) return 'AA';
    if (/aux[íi]lio|aposentadoria|incapacidade/i.test(s)) return 'PREV';
    return '?';
  }

  function quadro(t) {
    // Quadro clínico: 6.3 (modelo da 7ª Vara) ou 5.3 (modelos com os quesitos de adulto no item 5).
    // "6.3 . O quadro" (ponto solto) em modelos de outros peritos (inclusive "5.3 . O quadro").
    const ini = t.search(/\b[5-7]\.3\s*\.?\s*O quadro cl[íi]nico/i);
    if (ini < 0) return { grau: '', sub: '', txt: '' };
    const fim = t.slice(ini + 10).search(/\b[5-7]\.4\s*\.?\s/);
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
    const ini = t.search(/\b[5-7]\.4\s*\.?\s*A incapacidade/i);
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
    // Quesito da limitação do menor: 5.2 no modelo da 7ª Vara; v4: 4.2 nos modelos com os quesitos de menor no item 4.
    // O 5.2 de adulto desses modelos ("A doença, trauma ou deficiência se enquadra…") não casa.
    const w = win(t, /\b[45]\.2\s*\.?\s*A doen[çc]a,\s*defici[êe]ncia/i, 0, 420);
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

  // ---- v5: exceções da prioridade (Setor de Perícia, 18/11/2026) ----
  const SEGESP_RE = /segurad[oa]s? especia(l|is)|regime de economia familiar|trabalhador[a]?\s+rural|rur[íi]cola|pescador[a]? artesanal/i;
  // Alegação do INSS para o caso concreto (forte: entra na sugestão) × menção aos requisitos (fraca: só alerta).
  const REQ = '(qualidade de segurad|car[êe]ncia)';
  // Teste de 18/11/2026 (50 processos de 17/11): a proposta de acordo da AGU traz a cláusula padrão "caso ocorra a perda da
  // qualidade de segurado, mesmo que haja posterior reingresso…", que não é alegação. A contestação que alega tem as marcas da
  // AGU: cabeçalho "CONTESTAÇÃO - QS/CARÊNCIA", "CONTESTAÇÃO TIPO3 … PERDA DA QUALIDADE DE SEGURADO" ou "… NÃO PREENCHIMENTO DA
  // CARÊNCIA", "Impeditivo identificado Resultado da análise Falta de carência/qualidade de segurado" e "a parte autora não
  // preenche o requisito da carência/qualidade de segurado". Além delas, só a frase direta sobre a parte autora.
  const ALEGA_FORTE = new RegExp('CONTESTA[ÇC][ÃA]O\\s*-\\s*QS\\s*/\\s*CAR[ÊE]NCIA|PERDA DA QUALIDADE DE SEGURAD[OA]\\s*\\.\\s*DII POSTERIOR|N[ÃA]O PREENCHIMENTO DA CAR[ÊE]NCIA'
    + '|Impeditivo identificado\\s+Resultado da an[áa]lise\\s+Falta de ' + REQ
    + '|(parte autora|\\bo autor|\\ba autora|requerente|demandante)\\s+n[ãa]o\\s+(preenche|preencheu|cumpre|cumpriu|mantinha|mant[ée]m|ostentava|ostenta|possu[íi]a|possui|detinha)\\s+(o requisito d[ae]\\s+|a\\s+)?' + REQ
    + '|(parte autora|\\bo autor|\\ba autora|requerente|demandante)\\s+(j[áa]\\s+)?(havia\\s+)?perd(eu|ido)\\s+a qualidade de segurad', 'i');
  const CONDICIONAL = /caso ocorra|se ocorrer|mesmo que|na hip[óo]tese de|eventual|exige o preenchimento|s[ãa]o requisitos|requisitos gerais|apenas ter[áa] direito|interessado n[ãa]o detinha|data do fato [ée] a [úu]nica/i;
  const ALEGA_FRACA = new RegExp('(perda|perdeu|n[ãa]o\\s+(ostenta|mantinha|possu[íi]a|detinha)|aus[êe]ncia|falta|n[ãa]o\\s+cumpri\\w*|n[ãa]o\\s+preench\\w*)[^.]{0,60}' + REQ, 'i');
  function alegaINSS(ds) {
    const r = { inssReq: '', inssReqFraca: '' };
    for (const x of ds.slice().sort((a, b) => +a.id - +b.id)) {
      if (/^(Laudo|Certid|Intima|Of[íi]cio|Ato|Despacho|Decis|Senten|Expedi|Alvar|Mandado|Documento|Procura)/i.test(x.ti)) continue;
      const t = norm(CR.mem.txt[x.id] || '');
      if (!t || origem(t, x.ti) !== 'INSS') continue;
      const mf = t.match(new RegExp('[^.]{0,20}(?:' + ALEGA_FORTE.source + ')[^.]{0,200}', 'i'));
      if (mf && !r.inssReq) r.inssReq = 'ID ' + x.id + ', ' + (x.data || '').slice(0, 10) + ' «' + x.ti.slice(0, 30) + '»: ' + mf[0].slice(0, 260);
      // Menção fraca: só alerta, e nunca a cláusula condicional nem o texto genérico dos requisitos.
      const mw = !mf && [...t.matchAll(new RegExp('[^.]{0,80}(?:' + ALEGA_FRACA.source + ')[^.]{0,80}', 'gi'))].map((m) => m[0]).find((w) => !CONDICIONAL.test(w) && /parte autora|\bautora?\b|requerente|demandante/i.test(w));
      if (mw && !r.inssReqFraca) r.inssReqFraca = 'ID ' + x.id + ', ' + (x.data || '').slice(0, 10) + ' «' + x.ti.slice(0, 30) + '»: ' + mw.slice(0, 220);
    }
    return r;
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
    D.ad25Subsid = D.pedido !== 'AD25' && AD25_RE.test(ti.slice(0, 8000));
    // v5: exceções da prioridade no pedido previdenciário (Setor de Perícia, 18/11/2026).
    D.segEsp = win(ti, SEGESP_RE, 80, 160);
    Object.assign(D, alegaINSS(ds));
    if (S) return social(D, S, ds);
    if (!L) { D.flags = ['SEM LAUDO MÉDICO NEM SOCIAL NA LISTA']; D.sug = 'ler pela tela?'; return D; }
    const tL = norm(CR.mem.txt[L.id]);
    D.laudo = L;
    if (socDepois.length) D.social = socDepois.map((x) => x.data + ' ' + x.id).join(', ');
    // v4: laudo complementar sem o quadro clínico → os quesitos saem do laudo anterior (o complementar prevalece no que
    // responde: o trecho dele vai em T-COMPL, para a leitura).
    let t = tL, outros = outrosMed;
    if (!QUADRO_RE.test(tL)) {
      const P = anterior(outrosMed);
      if (P && QUADRO_RE.test(norm(CR.mem.txt[P.id] || ''))) {
        t = norm(CR.mem.txt[P.id]);
        D.orig = P;
        D.complTxt = tL.replace(/^PDF \d+p :: /, '').slice(0, 900);
        outros = outrosMed.filter((x) => ymd(x.data) !== ymd(P.data));
      }
    }
    D.outrosMed = outros.map((x) => x.data + ' ' + x.id + ' «' + x.ti.slice(0, 40) + '»');
    const tAll = D.orig ? tL + ' ' + t : t; // exame, incapacidade passada e acidente: os dois laudos
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
    // v7 (20/11/2026, Setor de Perícias; v7.1 em 24/11/2026): "Laudo Pericial" que é comunicação do perito (perito impedido, autor
    // ausente, menor sem documento com foto) e sem quadro clínico nem quesitos de menor → Redesignar perícia. A v7 pegava "impedimento
    // de longo prazo" (BPC) e "assistente técnico não compareceu": agora só as frases da comunicação, e nunca com o 5.2 respondido.
    const COM_RE = /apresento\s+impedimento|declar\w+\s+(-?se\s+)?impedid|impedid[oa]\s+(de|para)\s+(atuar|realizar|periciar)|(autor|autora|parte autora|periciad[oa])[^.]{0,40}n[ãa]o\s+compareceu|sem\s+(documento|identidade)[^.]{0,40}foto|n[ãa]o\s+apresentou\s+documento[^.]{0,80}foto|j[áa]\s+foi\s+meu\s+paciente|impedimento\s+por\s+(rela[çc][ãa]o\s+de\s+)?(grau\s+de\s+)?parentesco|encontro\s*-?\s*me\s+impossibilitad[oa]\s+de\s+(exercer|realizar)|(pede|solicita)\w*\s+(a\s+)?remarca/i;
    const tLc = tL.replace(/assistentes?\s+t[ée]cnic[oa]s?[^.\n]{0,60}n[ãa]o\s+compareceu/ig, ''); // v8.2
    D.redes = !QUADRO_RE.test(t) && !mn.g && COM_RE.test(tLc) ? (tLc.match(new RegExp('[^.]{0,100}(?:' + COM_RE.source + ')[^.]{0,140}', 'i')) || [''])[0].slice(0, 260) : '';
    D.q71 = (() => { const w = win(t, /assist[êe]ncia permanente de outra pessoa para as atividades da vida di[áa]ria/i, 0, 140); return w ? resposta(w.replace(/^[^?]*\?|^.{0,95}di[áa]ria/i, '')) : '—'; })();
    D.cidF = /CID[\s\S]{0,20}?\bF\s?\d{2}|\bF\s?\d{2}\.\d/.test(t);
    // Acidente do trabalho ou de trajeto: resposta ao 6.8 (ou 5.8 do modelo com quesitos de adulto no item 5) ou menção no texto.
    const aW = win(t, /decorre de acidente de trabalho/i, 0, 160).replace(/^.{0,110}?(ocupacional|trabalho)\s*\??/i, '');
    D.acid = [];
    if (aW && resposta(aW) === 'SIM') D.acid.push('quesito de acidente do trabalho = SIM');
    // "(acidente típico, acidente de trajeto, etc)" é texto do quesito, não resposta.
    const tr = tAll.match(/acidente\s+(no|de)\s+traje\s?to(?!,?\s*(?:etc|p\.?\s*ex))[^.;]{0,80}/i);
    if (tr) D.acid.push('"' + tr[0].slice(0, 90) + '"');
    const at = tAll.match(/(sofreu|v[íi]tima de)\s+acidente\s+(t[íi]pico\s+)?d[eo]\s+trabalho[^.;]{0,60}/i);
    if (at) D.acid.push('"' + at[0].slice(0, 90) + '"');
    const ex = tAll.match(/[^.]{0,120}(solicit\S*\s+(a\s+)?(realiza\S*\s+de\s+)?(o\s+|os\s+)?exames?|aguard\S*\s+(o\s+)?(resultado|exame)|n[ãa]o\s+(é|foi)\s+poss[íi]vel\s+concluir|(laudo|per[íi]cia)\s+inconclusiv)[^.]{0,160}/i);
    D.exame = ex ? ex[0].slice(0, 280) : '';
    // Incapacidade só no passado (período encerrado antes da perícia) = Laudo D, com o período no Fundamento.
    const pp = tAll.match(/[^.]{0,80}(incapacidade|incapaz)[^.]{0,80}(pret[ée]rit|no per[íi]odo (de|entre)|entre \d{1,2}\/\d{1,2}\/\d{4} e|at[ée] \d{1,2}\/\d{1,2}\/\d{4}, quando)[^.]{0,120}/i);
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
    D.pos = posLaudo(ds, L.id);
    sugere(D);
    return D;
  }

  // v4: "(A …)" é anexo quando é dossiê, laudo, documento etc., ou quando há a petição principal "(P …)" no mesmo dia;
  // "Petição (outras) (A PARTE AUTORA ACEITA O ACORDO)" sem "(P …)" é a própria petição.
  const ANEXO_TIT = /\(A (DOSSI|LAUDO|ANEXO|PETI[ÇC][ÃA]O \(|DOC|PROCURA|CNIS|EXTRATO|COMPROV|ATESTADO|RECEIT|EXAME|FOTO|CONTRATO|DECLARA|SABI|PLANILHA|C[ÁA]LCULO|HIST[ÓO]RICO|RELAT|QUADRO|CERTID|TELA|PRINT|CAD|RG\b|CPF\b)/i;
  function ehAnexo(x, ds) {
    if (!/\(A /.test(x.ti)) return false;
    if (ANEXO_TIT.test(x.ti)) return true;
    return ds.some((y) => /\(P /.test(y.ti) && ymd(y.data) === ymd(x.data) && +y.id < +x.id && +x.id - +y.id < 300);
  }
  // Petições das partes depois do laudo: petição, contestação, impugnação, manifestação, outras peças, requerimento e, na v4,
  // alegações finais, resposta, réplica, emenda, pedido (de homologação etc.) e "Outros Documentos (MANIFESTAÇÃO …)";
  // sem os anexos (procuração, documentos e dossiês que acompanham a petição não contam).
  const POS_TIT = /^(Peti[çc][ãa]o|Contesta|Impugna|Manifesta|Outras pe[çc]as|Requerimento|Alega[çc][õo]es|Resposta|R[ée]plica|Emenda|Pedido|Recurso|Embargos)|^Outros Documentos \((MANIFESTA|PETI|IMPUGNA|RESPOSTA)/i;
  function rotulo(x) {
    const ti = x.ti;
    return /PROPOSTA DE ACORDO/i.test(ti) ? 'proposta de acordo do INSS' : /^Contesta/i.test(ti) ? 'contestação' : /Impugna/i.test(ti) ? 'impugnação'
      : /^Alega/i.test(ti) ? 'alegações finais' : /Homologa/i.test(ti) ? 'pedido de homologação de acordo' : /^Emenda/i.test(ti) ? 'emenda à inicial'
      : /R[ée]plica/i.test(ti) ? 'réplica' : /Manifesta/i.test(ti) ? 'manifestação' : /^Resposta/i.test(ti) ? 'resposta' : 'petição';
  }
  function posLaudo(ds, lid) {
    return ds.filter((x) => +x.id > +lid && POS_TIT.test(x.ti) && !ehAnexo(x, ds)).sort((a, b) => +a.id - +b.id)
      .map((x) => x.data + ' ' + rotulo(x) + ' (ID ' + x.id + ')');
  }

  // Laudo social (Setor de Perícias e usuário, 30/10/2026). Ordem: endereço > divergência > renda per capita × 1/2 SM.
  // A renda per capita vem só do laudo; BPC ou benefício de até 1 SM de outro idoso/PcD do grupo é excluído (art. 20, § 14, LOAS):
  // o script só aponta a menção, o recálculo é feito na leitura, com os dados do próprio laudo.
  const brl = (s) => +String(s).replace(/\./g, '').replace(',', '.');
  function social(D, S, ds) {
    const t = norm(CR.mem.txt[S.id]);
    D.tipo = 'social'; D.laudo = S;
    const rW = win(t, /renda\s*(mensal\s*)?(familiar\s*)?per\s*cap\w*/i, 0, 260);
    const rv = rW.match(/R\$\s*([\d.]+,\d{2})/);
    D.rpc = rv ? brl(rv[1]) : null;
    D.rpcTxt = rW.slice(0, 260);
    // v7 (20/11/2026, Setor de Perícias): sem a renda per capita escrita, vale a renda informada no quesito B (sem dividir pelo grupo):
    // valor em R$, "sem renda" (0), 1 salário mínimo ou "mais de 1 salário mínimo". Sugestão a conferir no texto.
    D.rendaB = null; D.rendaBTxt = '';
    if (D.rpc == null) {
      const mB = t.match(/[^.]{0,80}\b(?:renda|recebe\s+o\s+valor)\b[^.]{0,120}?R\$\s*([\d.]+,\d{2})[^.]{0,60}/i);
      const mZ = t.match(/[^.]{0,60}(n[ãa]o\s+(possui|tem|declara|auferi\w*|recebe)\s+(nenhuma\s+)?renda|sem\s+renda|nenhuma\s+renda|n[ãa]o\s+h[áa]\s+renda|n[ãa]o\s+afirma\s+ter\s+renda)[^.]{0,60}/i);
      const mM = t.match(/[^.]{0,80}\brenda\b[^.]{0,80}?(mais\s+de\s+)?(um|1)\s+sal[áa]rio[s]?[\s-]*m[íi]nimo[^.]{0,60}/i);
      if (mM && /mais\s+de\s+(um|1)/i.test(mM[0]) && LM.sm) { D.rendaB = LM.sm * 1.01; D.rendaBTxt = mM[0]; }
      else if (mB) { D.rendaB = brl(mB[1]); D.rendaBTxt = mB[0]; }
      else if (mM && LM.sm) { D.rendaB = LM.sm; D.rendaBTxt = mM[0]; }
      else if (mZ) { D.rendaB = 0; D.rendaBTxt = mZ[0]; }
    }
    // v4: também a certidão da assistente social ("não conseguimos localizar o referido endereço", "foi impossível realizar
    // a diligência"), juntada como "Laudo Pericial (… Certidão Perícia Social)".
    const end = t.match(/[^.]{0,100}(n[ãa]o\s+(foi\s+)?(encontrad|localizad)\S*[^.]{0,40}(endere|resid|im[óo]vel|autor|requerente)|n[ãa]o\s+(conseg\w*\s+)?(encontr|localiz)\w*(?!\s+vizinh)[^.]{0,40}(endere|resid|im[óo]vel|autor|requerente)|n[ãa]o\s+(encontrei|localizei|consegui localizar)|imposs[íi]vel\s+(realizar\s+a\s+)?(dilig[êe]ncia|visita|per[íi]cia)|per[íi]cia social negativ|mudou-se|(n[ãa]o\s+)?reside\s+mais|n[ãa]o\s+reside\s+no\s+endere|endere[çc]o\s+(diverg|incorret|inexist|n[ãa]o\s+confere))[^.]{0,120}/i);
    D.endTxt = end ? end[0].slice(0, 260) : '';
    // v4: endereço já detalhado pela parte autora depois do laudo ou da certidão (só informa).
    D.endResp = D.endTxt ? ds.filter((x) => +x.id > +S.id && !/^Laudo/i.test(x.ti) && /ponto[s]?\s+de\s+refer[êe]ncia|endere[çc]o\s+(atualizado|correto|completo)|detalhar\s+(o\s+|seu\s+)?endere|telefone\s+(para\s+)?contato|contato\s*:\s*\(?\d{2}/i.test(CR.mem.txt[x.id] || ''))
      .map((x) => x.data.slice(0, 10) + ' ' + x.id + ' ' + x.ti.slice(0, 40)) : [];
    // v4: também "não tendo sido possível ... confirmar a composição efetiva do núcleo familiar" (17/11/2026).
    const div = t.match(/[^.]{0,100}(diverg[êe]nci\S*|contradi\S*|n[ãa]o\s+condiz\S*|incompat[íi]ve\S*\s+com\s+o\s+(declarad|informad|relatad)\S*|n[ãa]o\s+(foi|sendo|tendo\s+sido)\s+poss[íi]vel[^.]{0,60}confirmar[^.]{0,40}(composi|grupo|n[úu]cleo))(?![^.]{0,40}endere)[^.]{0,140}/i);
    D.divTxt = div ? div[0].slice(0, 280) : '';
    const bf = t.match(/[^.]{0,80}(\bBPC\b|benef[íi]cio\s+(de\s+presta[çc][ãa]o\s+continuada|assistencial)|\bLOAS\b|aposentadoria|pens[ãa]o)[^.]{0,120}/i);
    D.benefTxt = bf ? bf[0].slice(0, 240) : '';
    D.pos = posLaudo(ds, S.id);
    const meio = LM.sm ? LM.sm / 2 : null;
    let c;
    if (D.endTxt) c = 'Social - esclarecer localização';
    else if (D.divTxt) c = 'Social - divergência';
    else if (D.rpc == null && D.rendaB == null) c = 'INDEFINIDO';
    else if (meio == null) c = 'definir o salário mínimo (LM.config)';
    else c = (D.rpc != null ? D.rpc : D.rendaB) <= meio ? 'Social - renda até 1/2 SM' : 'Social - renda acima de 1/2 SM';
    D.sug = c; D.etq = ETQ(c);
    D.flags = [];
    if (D.rpc == null && D.rendaB != null) D.flags.push('RENDA DO QUESITO B (sem renda per capita escrita; não dividir pelo grupo; conferir no laudo e excluir benefício de outro idoso/PcD): R$ ' + D.rendaB.toFixed(2) + ' « ' + D.rendaBTxt.slice(0, 200) + ' »');
    if (D.pedido !== 'BPC' && D.pedTxt !== undefined && D.tipo === 'social') D.flags.push('LAUDO SOCIAL em pedido previdenciário: se o INSS contesta a renda declarada, Social - renda acima de 1/2 SM (assessoria)');
    if (D.endResp && D.endResp.length) D.flags.push('ENDEREÇO JÁ DETALHADO PELA PARTE DEPOIS DO LAUDO: ' + D.endResp.join('; '));
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
      const acTit = /aceit\w* (de |da |a |o )?(proposta|acordo)|aceite/i.test(tit);
      // v4: também com a palavra partida pelo pdf.js ("a ceitar o acordo"): a mesma busca no texto sem espaços.
      const tc = t.replace(/\s+/g, '').toLowerCase().replace(/deacordocom/g, '');
      // v8 (25/11/2026): "concordância com o laudo/a conclusão pericial" e "nos termos que se seguem" NÃO são aceite da proposta; a
      // petição que impugna os termos da oferta é recusa. (0038305-07: "concordância com o laudo ... nos termos que se seguem" saía como
      // aceite; 0030663-80: "concordando com a conclusão ... e impugnando os termos da oferta" também.)
      const sl = t.replace(/(aceit|concord)\w*\s+(integral\w*\s+|total\w*\s+|plena\w*\s+)?(com|d[oa]s?|a[os]?)\s+(o\s+|os\s+|a\s+|as\s+)?(laudo|conclus\w*|per[íi]cia|estudo|parecer)(?:\s+(?!(?:e|aceit\w*|concord\w*)\b)[^\s.;,]+){0,4}/gi, ' ').replace(/nos termos (que se seguem|seguintes|abaixo)/gi, ' ');
      const tcs = sl.replace(/\s+/g, '').toLowerCase().replace(/deacordocom/g, '');
      const aceita = /(aceit|concord|anu[êe])\w*.{0,120}(proposta|acordo|termos (propost|ofert|d[oa] (acordo|proposta)))|(proposta|acordo).{0,150}(aceit|concord|anu[êe]ncia)/i.test(sl) || /(aceit|concord|anu[êe])\w{0,8}.{0,90}(proposta|acordo)/.test(tcs);
      const impugnaOferta = !/n[ãa]o\s+(impugn|contest|questiona)/i.test(t) && (/(impugn|contest|questiona)\w*.{0,60}(termos d[ao]s? (proposta|oferta)|proposta|oferta)|proposta (injusta|desproporcional|insuficiente)|(proposta|oferta).{0,40}(injusta|desproporcional)/i.test(t));
      const naoAceita = /n[ãa]o (aceit|concord)\w*.{0,60}(proposta|acordo)|recus\w*.{0,60}(proposta|acordo)/i.test(t) || /n[ãa]o(aceit|concord)\w{0,8}.{0,50}(proposta|acordo)|recus\w{0,8}.{0,50}(proposta|acordo)/.test(tc) || impugnaOferta;
      if ((acTit || aceita) && !naoAceita) m.push('ACEITA');
      if (/(n[ãa]o (aceit|concord)|recus|discord|rejeit)\w*.{0,80}(proposta|acordo)|(proposta|acordo).{0,60}(recus|rejeit|n[ãa]o (aceit|concord))|contra-?proposta/i.test(t) || naoAceita) m.push('RECUSA');
      if (/contra-?proposta/i.test(t)) m.push('CONTRAPROPOSTA');
    }
    return m;
  }
  // Só informa (decisão do usuário, 16/11/2026): não muda a classificação nem a etiqueta.
  function acordo(ds, lid) {
    const post = ds.filter((x) => +x.id > +lid && !ehAnexo(x, ds) && !/^(Certid|Intima|Laudo|Of[íi]cio|Cita|Ato|Despacho|Decis|Senten|Expedi|Alvar|Mandado)/i.test(x.ti))
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
      if (inss && autor) return { v: 'ok', mot: 'certidão ' + c.id + ' (' + c.data + '): expedientes do INSS e da parte autora' + (refs.length ? ', Intimação ' + refs.join(', ') : '') + (laudo ? ' sobre o laudo' : ' — conferir se a Intimação é sobre o laudo'), mpf, conferir: !laudo, c };
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
  // ---- v5: as duas partes já ouvidas sobre o laudo (Setor de Perícia, 18/11/2026) ----
  // Manifestação: petição da parte depois do laudo (fora a de outro assunto e os anexos). Prazo: "Decorrido prazo de <parte>"
  // posterior à Certidão de Intimação do laudo (CR.mem.dec, do CR v13; sem certidão, posterior ao laudo, com aviso).
  const OUTRO_ASSUNTO = /substabelec|juntada d[ea] (nova )?procura|habilita[çc][ãa]o|mudan[çc]a de endere|altera[çc][ãa]o (de|do) endere|novo endere|atualiza[çc][ãa]o (de|do) endere|juntada d[oe]s? documentos administrativos/i;
  function poloAtivo(p, pa, nomePA) {
    const lp = letras(p);
    if (lp.length >= 6 && letras(pa).includes(lp)) return true;
    if (nomePA && (lp.includes(letras(nomePA)) && letras(nomePA).length >= 6)) return true;
    if (/^([A-ZÀ-Ú]\.\s?){2,}$/.test(nomePA.trim())) {
      const ini = p.trim().split(/\s+/).map((w) => w[0].toUpperCase()).join('');
      return ini === letras(nomePA);
    }
    return false;
  }
  function ouvidas(num, ds, D, it) {
    const lid = D.laudo.id;
    const r = { autor: '', inss: '', obs: [] };
    for (const x of ds.filter((y) => +y.id > +lid && POS_TIT.test(y.ti) && !ehAnexo(y, ds)).sort((a, b) => +a.id - +b.id)) {
      const t = norm(CR.mem.txt[x.id] || '');
      const o = origem(t, x.ti);
      const s = rotulo(x) + ' ID ' + x.id + ', ' + (x.data || '').slice(0, 10);
      const outro = !/^(Contesta|Impugna|Manifesta|Alega)/i.test(x.ti) && OUTRO_ASSUNTO.test(t.slice(0, 1500)) && !/laudo|per[íi]cia/i.test(t.slice(0, 4000));
      if (outro) { r.obs.push('outro assunto? ' + o + ': ' + s); continue; }
      if (o === 'INSS') { if (!r.inss) r.inss = 'manifestou (' + s + ')'; }
      else if (o === 'autor') { if (!r.autor) r.autor = 'manifestou (' + s + ')'; }
      // Teste de 18/11/2026: as petições sem origem identificada eram todas da parte autora (sem texto, "ciente", "ciência ao
      // laudo", manifestação sem "advogado"). Sem título do INSS ("(P …)") e sem marca do INSS no texto, conta como da autora.
      // A petição da parte autora que fala do "laudo pericial" logo no início sai como "perito" no origem(): conta como da
      // autora quando se identifica como a parte ("devidamente qualificado", "por seus advogados", OAB).
      else if ((o === '?' || (o === 'perito' && /devidamente qualificad|por (seus|suas) advogad|OAB\s*[\/:-]|ci[êe]ncia ao laudo/i.test(t))) && !tituloINSS(x.ti) && !INSS_FORTE.test(t.slice(0, 600))) { if (!r.autor) r.autor = 'manifestou (' + s + '; origem presumida)'; }
      else r.obs.push('origem ? ' + s);
    }
    const base = it && it.c ? it.c : D.laudo;
    const b = ymd(base.data);
    const nomePA = ((D.pa || '').match(/^(.+?) CPF /) || [])[1] || '';
    const dec = (CR.mem.dec || {})[num];
    if (dec == null) r.obs.push('decursos de prazo não lidos (carregue o CR v13)');
    for (const e of dec || []) {
      const m = e.match(/Decorrido prazo de (.+?)(?: em (\d{2}\/\d{2}\/\d{4})|\.?$)/i);
      if (!m) continue;
      const quando = m[2] || e.slice(0, 10);
      if (!(ymd(quando) > b)) continue;
      const p = m[1];
      const s = 'prazo decorrido em ' + quando + (it && it.c ? '' : ' (sem certidão de intimação: conferir)');
      if (/INSTITUTO NACIONAL|\bINSS\b/i.test(p)) { if (!r.inss) r.inss = s; }
      // Parte autora: qualquer nome do polo ativo (autor, representante, advogado) ou, no menor com o nome em iniciais no PJe,
      // as iniciais do nome completo do decurso.
      else if (poloAtivo(p, D.pa || '', nomePA)) { if (!r.autor) r.autor = s; }
      else if (!/MINIST[ÉE]RIO|\bMPF\b/i.test(p)) r.obs.push('decurso de ' + p.slice(0, 50) + ' em ' + quando + ' (é a parte autora?)');
    }
    return r;
  }
  function extras(num, D) {
    const ds = CR.mem.docs[num] || [];
    if (D.laudo) {
      D.acordo = acordo(ds, D.laudo.id);
      // v4: a petição que aceita (ou recusa) a proposta aparece assim na lista do pós-laudo.
      const ac = (D.acordo.match(/aceita[çc][ãa]o ID (\d+)/) || [])[1], rc = (D.acordo.match(/(?:recusada|contraproposta do autor) \(proposta ID \d+, [^;]+; ID (\d+)/) || [])[1];
      if (D.pos) D.pos = D.pos.map((s) => (ac && s.includes('(ID ' + ac + ')') ? s.replace(' (ID ', ' com aceitação da proposta (ID ') : rc && s.includes('(ID ' + rc + ')') ? s.replace(' (ID ', ' com recusa da proposta (ID ') : s));
      const it = intimacao(ds, D.laudo.id, D.pa || '');
      D.intim = it.v; D.intimMot = it.mot; D.mpfIntimado = it.mpf;
      D.ouv = ouvidas(num, ds, D, it);
    } else { D.acordo = '?'; D.intim = '?'; D.intimMot = 'sem laudo identificado'; }
    mpf(num, ds, D);
    if (D.mpf && D.mpfIntimado) D.mpfMot += '; o MPF já consta da certidão de intimação do laudo';
    // v6: as duas partes ouvidas e sem MPF → rotina da triagem de expediente que trataria a etiqueta do laudo.
    D.exp = ''; D.expMot = '';
    const rot = EXP[D.sug];
    if (!rot) D.expMot = 'classificação sem rotina no expediente';
    else if (!(D.ouv && D.ouv.autor && D.ouv.inss)) D.expMot = D.ouv ? 'partes não ouvidas (autor ' + (D.ouv.autor ? 'sim' : 'não') + ', INSS ' + (D.ouv.inss ? 'sim' : 'não') + ')' : 'partes ouvidas não verificadas';
    else if (D.mpf) D.expMot = 'INTIMAR MPF: fica a etiqueta do laudo';
    else D.exp = rot;
  }
  // Classificação do laudo → rotina da jef-expediente-manifestacao que trata a etiqueta dela (código do EM.inicia).
  const EXP = {
    'Laudo C': 'C', 'Laudo D': 'D', 'Prioridade (AD/AI/LOAS)': 'INC', 'Limitação moderada ou grave': 'LIM', 'LOAS - Designar social': 'LOAS',
    'Incapacidade - CEJUSC': 'CEJ', 'Adicional de 25% - assistência permanente': 'CEJ', 'Social - renda até 1/2 SM': 'CEJ',
    'Social - renda acima de 1/2 SM': 'LA', 'Social - divergência': 'LA',
  };

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
    'Incapacidade - CEJUSC': 'etiqueta_incapacidade_cejusc',
    'Redesignar perícia': 'etiqueta_redesignar_pericia',
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
    if (D.redes) f.push('COMUNICAÇÃO DO PERITO (perícia não realizada)? ' + D.redes);
    if (D.exame) f.push('EXAME? ' + D.exame);
    if (D.inloco.length) f.push('IN LOCO? ' + D.inloco.join('; '));
    if (D.pedido === '?') f.push('pedido não identificado na inicial');
    if (D.ad25Subsid) f.push('adicional de 25% citado na inicial só como pedido subsidiário ou fundamento (não é pedido isolado): regra comum');
    if (D.orig) f.push('LAUDO COMPLEMENTAR ' + D.laudo.id + ' (' + D.laudo.data.slice(0, 10) + ') sem quadro clínico: quesitos do laudo ' + D.orig.id + ' (' + D.orig.data.slice(0, 10) + '); o complementar prevalece no que responde (T-COMPL)');
    if (D.outrosMed && D.outrosMed.length) f.push('OUTRO LAUDO MÉDICO: ' + D.outrosMed.join('; ') + ' — complementar: combinar (o complementar prevalece no que responde); outra especialidade: classificar os dois e, se divergirem, INDEFINIDO');
    if (D.faixa) f.push('faixa "' + D.faixa + '" lida como ' + D.sub);
    if (D.passada) f.push('INCAPACIDADE PASSADA? ' + D.passada);
    if (D.pedido !== 'BPC') {
      if (D.segEsp) f.push('SEGURADO ESPECIAL? ' + D.segEsp);
      if (D.inssReq) f.push('INSS ALEGA CARÊNCIA/QUALIDADE DE SEGURADO: ' + D.inssReq);
      else if (D.inssReqFraca) f.push('INSS cita carência/qualidade de segurado (genérico? conferir): ' + D.inssReqFraca);
    }
    D.flags = f;
    let c = '';
    const id = D.idade;
    // v5: previdenciário com incapacidade → CEJUSC; prioridade só nas exceções.
    const prev = () => (D.segEsp || D.inssReq ? 'Prioridade (AD/AI/LOAS)' : 'Incapacidade - CEJUSC');
    if (D.social) c = 'FORA (laudo social)';
    else if (D.redes) c = 'Redesignar perícia';
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
        if (D.pedido !== 'BPC') c = prev();
        else if (D.dur === 'DEFINITIVA' || D.dur === 'SEM PRAZO' || (D.intervalo != null && D.intervalo >= 24)) c = 'LOAS - Designar social';
        else if (D.intervalo != null) c = 'Prioridade (AD/AI/LOAS)';
        else c = 'INDEFINIDO';
      } else if (g === 'C') {
        // Limitação COM recomendação de afastamento = incapacidade temporária (Setor de Perícias, 30/10/2026).
        if (D.afast && !(id != null && id <= 15)) c = D.pedido !== 'BPC' ? prev() : 'Prioridade (AD/AI/LOAS)';
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

  // v6: a etiqueta da sugestão (SUG) vale só sem a linha "EXPEDIENTE: rotina"; com ela, decide a rotina da triagem de expediente.
  const expLinha = (D) => 'EXPEDIENTE: ' + (D.exp ? 'rotina ' + D.exp + ' (partes ouvidas, sem MPF) → classificar pelas regras da jef-expediente-manifestacao; LM.paraExp' : 'não (' + (D.expMot || '?') + ')');
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
        D.ouv ? 'PARTES OUVIDAS: autor ' + (D.ouv.autor || 'não') + ' | INSS ' + (D.ouv.inss || 'não') + (D.ouv.obs.length ? ' | obs: ' + D.ouv.obs.join('; ') : '') : '',
        'MPF: ' + (D.mpf || '—') + (D.mpfMot ? ' (' + D.mpfMot + ')' : ''),
        D.flags.length ? 'ATENÇÃO: ' + D.flags.join(' || ') : '',
        'SUG: ' + D.sug + '? | ' + D.etq,
        expLinha(D),
      ].filter(Boolean)).join('\n');
    }
    if (!L) return linhas.concat(['SEM LAUDO MÉDICO NA LISTA', 'PEDIDO: ' + D.pedido + ' — ' + D.pedTxt, 'MPF: ' + (D.mpf || '—') + (D.mpfMot ? ' (' + D.mpfMot + ')' : ''), 'SUG: ' + D.sug]).join('\n');
    linhas.push('LAUDO ' + L.id + ' juntado ' + L.data + ' «' + L.ti.slice(0, 60) + '»' + (D.orig ? ' (complementar) + quesitos do laudo ' + D.orig.id + ' juntado ' + D.orig.data : '') + ' | perícia ' + fmt(D.pericia) + ' | nasc ' + fmt(D.nasc) + ' | idade ' + (D.idade ?? '?') + ' | pessoa ' + D.pessoa);
    linhas.push('PEDIDO: ' + D.pedido + ' — ' + D.pedTxt);
    linhas.push('QUADRO: grau ' + (D.grau || '?') + (D.sub ? ' ' + D.sub : '') + (D.faixa ? ' (faixa ' + D.faixa + ')' : '') + (D.afast ? ' COM AFASTAMENTO' : '') + ' | DUR ' + (D.dur || '?') + (D.prazo ? ' ' + D.prazo + ' (conta da ' + (D.baseFim || '?') + ')' : '') + ' | DII ' + fmt(D.dii) + (D.fim ? ' | fim ' + fmt(D.fim) + ' | intervalo ' + D.intervalo.toFixed(1) + ' meses' : ''));
    if (D.idade != null && D.idade < 18 || D.menorResp) linhas.push('MENOR: 5.2 ' + (D.m52 || '?') + ' | quesitos de menor respondidos: ' + (D.menorResp ? 'sim' : 'não'));
    linhas.push('assistência permanente (7.1 ou 6.1): ' + D.q71 + ' | CID F: ' + (D.cidF ? 'sim' : 'não') + ' | representação: ' + (D.repr || 'nenhuma'));
    linhas.push('PÓS-LAUDO: ' + (D.pos.length ? D.pos.join('; ') : 'não há'));
    linhas.push('PROPOSTA: ' + D.acordo + ' | INTIMAÇÃO DO LAUDO: ' + D.intim + ' — ' + D.intimMot);
    if (D.ouv) linhas.push('PARTES OUVIDAS: autor ' + (D.ouv.autor || 'não') + ' | INSS ' + (D.ouv.inss || 'não') + (D.ouv.obs.length ? ' | obs: ' + D.ouv.obs.join('; ') : ''));
    linhas.push('MPF: ' + (D.mpf || '—') + (D.mpfMot ? ' (' + D.mpfMot + ')' : ''));
    if (D.flags.length) linhas.push('ATENÇÃO: ' + D.flags.join(' || '));
    linhas.push('SUG: ' + D.sug + '? | ' + D.etq + ' | curatela ' + D.cur);
    linhas.push(expLinha(D));
    linhas.push('T-QUADRO: ' + D.qTxt);
    linhas.push('T-DURAÇÃO: ' + D.dTxt);
    linhas.push('T-DII: ' + D.diiTxt);
    if (D.idade != null && D.idade < 18 || D.menorResp) linhas.push('T-5.2: ' + D.mTxt);
    if (D.orig) linhas.push('T-COMPL: ' + D.complTxt);
    return linhas.join('\n');
  }

  LM.prep = async function (nums) {
    const falta = faltaCfg();
    if (falta.length) return 'configure as etiquetas da unidade antes de iniciar: LM.config({ etiquetas: { ... } }) — faltam: ' + falta.join(', ');
    for (const num of nums) {
      try {
        if (!CR.mem.docs[num]) { LM.out[num] = '#' + num + ' AINDA NÃO LIDO PELO CR'; continue; }
        const { L, S, outrosMed } = laudos(num);
        if (S) await CR.txt(S.id, 40);
        else if (L) {
          // v4: até a página 100 (laudo com exames digitalizados no meio tem os quesitos depois da página 40); é um só download.
          await CR.txt(L.id, 100);
          // v4: laudo complementar sem o quadro clínico → baixa também o laudo anterior inteiro, para combinar.
          if (!QUADRO_RE.test(norm(CR.mem.txt[L.id] || ''))) { const P = anterior(outrosMed); if (P) await CR.txt(P.id, 100); }
        }
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
    return nums.map((n) => { const D = LM.dados[n]; return D ? (CR.ord[n] || '?') + ' ' + n.slice(0, 10) + ' ' + D.sug + ' | ' + (D.tipo === 'social' ? 'social, renda ' + (D.rpc ?? '?') : (D.grau || '-') + (D.sub ? ' ' + D.sub : '')) + ' | cur ' + String(D.cur || '-').slice(0, 20) + ' | prop ' + String(D.acordo || '-').slice(0, 30) + ' | intim ' + (D.intim || '-') + ' | ouvidas ' + (D.ouv ? (D.ouv.autor ? 'A' : '-') + (D.ouv.inss ? 'I' : '-') : '?') + ' | ' + (D.mpf || 'sem MPF') + ' | exp ' + (D.exp || '-') : n + ' -'; }).join('\n');
  };
  // v6: lista "processo|rotina" dos processos com as partes ouvidas e sem MPF, para o EM.inicia da jef-expediente-manifestacao.
  LM.paraExp = function (nums) {
    return (nums || Object.keys(LM.dados)).filter((n) => LM.dados[n] && LM.dados[n].exp).map((n) => n + '|' + LM.dados[n].exp);
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
