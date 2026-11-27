// analise-lote.js — jef-expediente-manifestacao (desenvolvido na 7ª Vara Federal da Paraíba; versão para compartilhamento:
// o dado da unidade — a etiqueta do assessor por dígito — vem de EM.config, montado a partir de docs/configuracao-unidade.md)
//
// Injetado pelo javascript_tool do Chrome numa página estática do próprio PJe, que não
// redireciona: https://pje1g.trf5.jus.br/pje/js/pdfjs/web/locale/locale.json
// A consulta e os autos abrem num iframe oculto, no mesmo domínio (modelo: jef-fase-execucao).
//
// SÓ LÊ, salvo EM.marca(): abre cada processo (consulta -> autos), acha o marco da rotina (laudo,
// planilha, despacho, proposta ou intimação), lê os documentos juntados depois dele e, conforme a
// rotina, a profissão no laudo médico, a renda per capita do processo administrativo e o endereço.
// Quem classifica é o Claude, pelas regras do SKILL.md; a "PROP" do resumo é só uma sugestão.
// EM.marca(num, nl) é a ÚNICA gravação: clica em MARCAR TODOS COMO LIDOS. Chame-a só depois de
// gravada a classificação do processo no arquivo de andamento, um processo por vez.
//
// Uso (cada linha é uma chamada do javascript_tool, sem trocar a página de cima):
//   window.__EM.config({ assessorPorDigito: { '0': '<etiqueta>', ..., '9': '<etiqueta>' } })
//                                 -> obrigatório antes do inicia: a etiqueta do assessor para cada último dígito do
//                                    número sequencial (Comum — Assessores.assessor_por_digito da configuração da unidade)
//   window.__EM.inicia(['0000000-00.2026.4.05.0000|C', ...], base)  -> base = nº do 1º processo - 1
//        rotinas: C D PC DIL LOAS INC LIM CEJ CIT CP PP AP CA CT LA EL EC (ver o SKILL.md)
//   window.__EM.estado()          -> feitos/total, rodando ou parado, motivo, tempo
//   window.__EM.mostra(a, b)      -> põe os resumos dos processos nº a..b num <pre id="__out">;
//                                    leia com get_page_text (o javascript_tool corta em ~1.200 caracteres)
//   window.__EM.para()            -> interrompe depois do processo em curso
//   await window.__EM.marca(num, nl) -> MARCAR TODOS COMO LIDOS e confere que o aviso sumiu (nl = o do resumo;
//                                    se o número de não lidos mudou desde a leitura, não marca)
//
// Resumo de cada processo (no <pre>):
//   #<nº> === <processo> <rotina> [SIGILOSO] nl=<não lidos> docs=<na cronologia>/<no processo> PROP:<sugestão> [rever: ...]
//   ASSUNTO: <assunto principal> | DÍGITO <d> -> <etiqueta do assessor configurada para o dígito>
//   [MARCO <tipo> <data> <id> <título>] <trecho>     -> laudo, planilha, despacho, proposta ou intimação
//   [LAUDO MÉDICO <id>] PROFISSÃO: <trecho> [AGRICULTOR]
//   [RENDA <id>] Requisito de Renda Per Capita Atendido: SIM|NÃO   /  [RENDA] não localizado
//   [ENDEREÇO <id> <onde>] <trecho>                                -> LOAS sem renda atendida (petição do autor, inicial
//                                                                     ou um dos primeiros documentos do processo)
//   [SOCIAL <id> <data> <título>] págs=<n> — fotos: ver na tela; mesma data: <id> <título> | ...
//                                                                  -> miserabilidade (CEJ, CIT, LA), com os documentos
//                                                                     irmãos do auto (fotos em documento separado)
//   [ANTES DO LAUDO] <data> <id> <título> {marcas} (origem): trecho -> CEJ, CIT, CA, CT, LA sem petição do INSS depois do
//                                                                     laudo: contestação/petição do INSS anterior a ele
//   <data> <id> <título> [NL] {marcas} (origem) : trecho          -> documentos depois do marco, do mais recente
//        marcas: PROPOSTA, IMPOSSIBILIDADE, PROMESSA (o INSS só diz que poderá propor acordo depois do laudo),
//                ACEITA, RECUSA, CONTRAPROPOSTA, DILAÇÃO(<n> dias), ENDEREÇO, IMPUGNA, CONCORDA, CÁLCULO, DECURSO
//   <data> <id> <título> [sistema]                                 -> intimação, certidão, ato ordinatório (não lidos)
//   X|<processo>|<motivo>                                         -> não analisado
//
// v2 (19/10/2026): marco da Planilha de Cálculo só no cálculo da contadoria ou na petição do INSS com cálculo; IMPUGNA
// para o autor que aponta incorreção da RMI, pede os cálculos da multa ou apresenta cálculos próprios; endereço do LOAS
// também nos primeiros documentos do processo (listaIdsDocumentos), sem o do escritório; contestação anterior ao laudo
// lida em CEJ/CIT sem petição do INSS depois dele; "TIPO 1 - ACORDO DIRETO" e "PROPOR TRANSAÇÃO" valem como proposta;
// documentos irmãos do auto de constatação (fotos); profissão com espaço solto dentro da palavra ("p rofissão");
// Diligência com proposta do INSS depois do despacho sugere COM PROPOSTA / aceita / recusada (regra de 19/10/2026).
// v3 (18/11/2026): aceite da proposta com a palavra partida pelo pdf.js ("a ceitar o acordo") e petição "(A PARTE AUTORA
// ACEITA …)" sem "(P …)" no mesmo dia lida como petição, não anexo (mesmo critério da jef-analise-laudo v4).
(() => {
  const EM = (window.__EM = window.__EM || {});
  EM.versao = 3;

  // Configuração da unidade (padrão vazio). assessorPorDigito: { '0': '<etiqueta>', ..., '9': '<etiqueta>' }.
  EM.cfg = EM.cfg || { assessorPorDigito: null };
  const DIGITOS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
  const faltaCfg = () => {
    const a = EM.cfg.assessorPorDigito;
    if (!a || typeof a !== 'object') return 'configure a etiqueta do assessor por dígito (window.__EM.config({ assessorPorDigito: {...} })) antes de iniciar';
    const f = DIGITOS.filter((k) => !String(a[k] == null ? '' : a[k]).trim());
    return f.length ? 'configure a etiqueta do assessor para o(s) dígito(s) ' + f.join(', ') + ' (window.__EM.config) antes de iniciar' : '';
  };
  EM.config = function (c) {
    c = c || {};
    if (c.assessorPorDigito !== undefined) {
      const a = {};
      for (const k of DIGITOS) { const v = c.assessorPorDigito && c.assessorPorDigito[k]; if (v != null && String(v).trim()) a[k] = String(v).trim(); }
      EM.cfg.assessorPorDigito = a;
    }
    const f = faltaCfg();
    return f || 'configuração ok: assessor por dígito para ' + DIGITOS.length + ' dígitos';
  };

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
  const MES = { jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12 };
  const limpa = (s) => s.replace(/https?:\/\/\S+/g, '[URL]').replace(/\S*[?&]\w+=\S*/g, '[Q]').replace(/\b[0-9a-f]{16,}\b/gi, '[H]')
    .replace(/\s+/g, ' ').trim();

  let pdfjs = null;
  const pdf = async () => {
    if (!pdfjs) { pdfjs = await import('/pje/js/pdfjs/build/pdf.mjs'); pdfjs.GlobalWorkerOptions.workerSrc = '/pje/js/pdfjs/build/pdf.worker.mjs'; }
    return pdfjs;
  };

  // Teor do documento pelo mesmo endereço que o PJe usa ao abri-lo. PDF: primeiras maxPag páginas e as 2 últimas.
  // Texto vazio em PDF = documento digitalizado: ler pela tela.
  EM.leDoc = async function (id, maxPag) {
    try {
      const r = await fetch('/pje/seam/resource/rest/pje-legacy/documento/download/' + id, { credentials: 'include' });
      if (r.status === 429) { EM.bloqueio = true; return { ct: 'err', text: 'HTTP 429' }; }
      if (!r.ok) return { ct: 'err', text: 'HTTP ' + r.status };
      const ct = r.headers.get('content-type') || '';
      const buf = await r.arrayBuffer();
      if (/pdf/i.test(ct)) {
        const doc = await (await pdf()).getDocument({ data: new Uint8Array(buf) }).promise;
        const n = doc.numPages, mp = maxPag || 8;
        let out = '';
        for (let i = 1; i <= n; i++) {
          if (i > mp && i <= n - 2) continue;
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
    let f = document.getElementById('__emQ');
    if (!f) {
      f = document.createElement('iframe');
      f.id = '__emQ';
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

  EM.abre = async function (num) {
    const f = quadro();
    const m = num.match(/^(\d{7})-(\d{2})\.(\d{4})\.\d\.\d{2}\.(\d{4})$/);
    if (!m) return { erro: 'número em formato inválido' };
    await carrega(f, '/pje/Processo/ConsultaProcesso/listView.seam');
    const campo = await espera(() => { const d = docQ(f); return d && d.getElementById('fPP:numeroProcesso:numeroSequencial'); }, 20000);
    if (!campo) {
      const d = docQ(f);
      if (d && /429|temporariamente bloqueado/i.test(d.body.innerText)) { EM.bloqueio = true; return { erro: '429' }; }
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

  // Cronologia (decrescente: índice menor = mais recente). nl = item destacado como não lido.
  EM.cron = function (d) {
    const naoLidos = new Set();
    d.querySelectorAll('#divTimeLine .media-body.highlight').forEach((e) => { const m = e.textContent.match(/(\d{6,10}) - /); if (m) naoLidos.add(m[1]); });
    const linhas = d.getElementById('divTimeLine').innerText.split('\n').map((s) => s.trim()).filter(Boolean);
    let data = '';
    const docs = [], vistos = new Set();
    for (const l of linhas) {
      const m = l.match(/^(\d{2}) (jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez) (\d{4})$/);
      if (m) { data = m[1] + '/' + String(MES[m[2]]).padStart(2, '0') + '/' + m[3]; continue; }
      const x = l.match(/^(\d{6,10}) - (.+)$/);
      if (x && !vistos.has(x[1])) { vistos.add(x[1]); docs.push({ id: x[1], titulo: x[2].slice(0, 80), data, nl: naoLidos.has(x[1]) }); }
    }
    return docs;
  };
  // O aviso vem no singular ("Há 1 documento não lido") ou no plural, com ou sem "(s)".
  EM.naoLidos = (d) => { const m = d.body.innerText.match(/H[áa] (\d+) documentos?(\(s\))? n[ãa]o lido/i); return m ? +m[1] : 0; };

  const trecho = (t, re, n) => { const k = t.search(re); return k < 0 ? t.slice(0, n) : t.slice(Math.max(0, k - 40), Math.max(0, k - 40) + n); };
  // PDF com fonte sem mapeamento de texto: sai em símbolos ("! " # $ %"). Ler pela tela.
  const ilegivel = (t) => t.length > 40 && (t.match(/[A-Za-zÀ-ú]/g) || []).length / t.length < 0.35;
  const NUM = { cinco: 5, dez: 10, quinze: 15, vinte: 20, trinta: 30, quarenta: 40, quarenta_e_cinco: 45, sessenta: 60, noventa: 90 };

  // Origem do documento pelo teor (a cronologia não mostra quem juntou). As petições do autor costumam
  // citar o INSS; por isso as marcas fortes do INSS valem só no início, e as do advogado vêm antes das fracas.
  const INSS_FORTE = /PROCURADORIA[- ]GERAL FEDERAL|ADVOCACIA[- ]GERAL DA UNI|Demandas Judiciais do INSS|CEAB|APSDJ|AADJ|Equipe de C[áa]lculo|ECALC|CALPREV|Ag[êe]ncia do INSS DJ|PROCURADORIA FEDERAL|Procurador(a)? Federal/i;
  const ADVOGADO = /por (seu|sua|interm[ée]dio de) (seus? |suas? )?(advogad|procurador(a)? (que|abaixo|ao final|infra|constitu))|advogad[oa]s? (abaixo|ao final|infra|subscrit)|\bOAB\b|por sua (advogada|procuradora)|procurador(a)? constitu[íi]d|(adiante|ao final|abaixo|in fine) assinad|patrono/i;
  const PERITO = /perit[oa] (m[ée]dic|judicial|do ju[íi]zo|nomead)|assistente social|laudo (m[ée]dico )?pericial|estudo social|auto de constata/i;
  // Petição do INSS pela integração da AGU: título "Contestação (P CONTESTAÇÃO <nº> EM ...)".
  const tituloINSS = (tit) => /\(P [A-ZÀ-Ú]/.test(tit) || /^Contesta/i.test(tit);
  const origem = (t, tit) => tituloINSS(tit || '') || INSS_FORTE.test(t.slice(0, 300)) ? 'INSS'
    : PERITO.test(t.slice(0, 300)) && /^Laudo/i.test(tit || '') ? 'perito'
    : ADVOGADO.test(t.slice(0, 3000)) ? 'autor'
    : PERITO.test(t.slice(0, 600)) ? 'perito'
    : INSS_FORTE.test(t) ? 'INSS'
    : /parte autora|requerente/i.test(t) ? 'autor' : '?';

  // Proposta de acordo: o teor decide, não o nome. "Impossibilidade de acordo" é o contrário de proposta.
  const IMPOSS = /IMPOSSIBILIDADE DE (ACORDO|PROPOSTA|CONCILIA)|n[ãa]o (h[áa]|vislumbra|apresenta|existe|ser[áa] apresentad)\w*.{0,60}(proposta|acordo|concilia)|sem proposta de acordo|deixa de (apresentar|ofertar|oferecer) proposta|invi[áa]vel.{0,40}(proposta|acordo)/i;
  const PROPOSTA = /PROPOSTA DE ACORDO|prop[õo]e(-se)?,? (o |a celebra[çc][ãa]o de )?acordo|oferece.{0,60}(acordo|proposta)|apresenta(r)?,? .{0,40}proposta|termos do acordo|TERMOS DA PROPOSTA|proposta conciliat/i;
  const TERMOS = /\bDIB\b|\bDIP\b|\bRMI\b|percentual|\d{2,3} ?%|atrasados|implanta[çc][ãa]o|restabelec|concess[ãa]o do benef|valores? (atrasad|retroativ)/i;
  // Documento juntado como prova (inclusive sentença ou acordo de outro processo): nunca é proposta.
  const ehProva = (tit) => /^(Documento|Outros Documentos|Outras pe[çc]as)/i.test(tit);
  // Contestação anterior ao laudo: "o INSS poderá, na primeira manifestação, apresentar proposta de acordo ou defesa de
  // mérito individualizada" e "a ausência do laudo médico judicial no momento da citação impossibilita a celebração de
  // acordo" são promessa de analisar acordo depois do laudo, não proposta. A frase sai do teste da proposta.
  const PROMESSA = /poder[áa],?[^.]{0,60}apresentar,? proposta|proposta de acordo ou defesa de m[ée]rito|ap[óo]s (?:a (?:realiza[çc][ãa]o|juntada) d)?o laudo[^.]{0,80}(?:proposta|acordo)|aus[êe]ncia do laudo[^.]{0,120}(?:acordo|proposta)|otimizar a concilia/i;
  const PROMESSA_FRASE = new RegExp('[^.]{0,250}(?:' + PROMESSA.source + ')[^.]{0,250}', 'gi');
  // Fórmulas da AGU que são proposta mesmo com o título "Outras peças": "TIPO 1 - ACORDO DIRETO", "TIPO 1 - CONTESTAÇÃO
  // COM PROPOSTA DE ACORDO", "PROPOR TRANSAÇÃO ... a) o INSS se obriga a...", "O INSS se compromete a...".
  const PROPOSTA_FORTE = /TIPO 1 ?[-–] ?(ACORDO DIRETO|CONTESTA[ÇC][ÃA]O COM PROPOSTA)|PROPOR TRANSA[ÇC][ÃA]O|o INSS se (obriga|compromete)/i;
  // Planilha de Cálculo: o autor que aponta incorreção da RMI, pede os cálculos da multa ou a retificação/complementação
  // da conta, ou apresenta cálculos próprios, discorda (ainda que em parte) da planilha.
  const IMPUGNA_AUTOR = /incorre[çc][ãa]o.{0,80}(\bRMI\b|renda mensal|c[áa]lculo|planilha|conta\b|apura)|\bRMI\b.{0,60}(incorret|equivocad|errad|divergen)|(c[áa]lculos?|apura[çc][ãa]o|inclus[ãa]o|valor(es)?) (d[ao]s? )?multa|multa.{0,60}(n[ãa]o (foi |foram )?(inclu|computad|considerad)|fora d[ao] (c[áa]lculo|conta))|(retifica[çc][ãa]o|complementa[çc][ãa]o|refazimento) d[ao]s? (c[áa]lculo|planilha|conta)|apresenta\w*,? (os |seus |novos )?c[áa]lculos (de liquida|pr[óo]prios)|reiter\w*.{0,30}impug/i;
  function marcasDoc(t, tit, rot) {
    const m = [], o = origem(t, tit);
    if (/decurso|decorrid/i.test(tit)) m.push('DECURSO');
    if (o === 'INSS') {
      const tp = t.replace(PROMESSA_FRASE, ' ');
      if (PROPOSTA_FORTE.test(t.slice(0, 2500))) m.push('PROPOSTA');
      else if (IMPOSS.test(tp)) m.push('IMPOSSIBILIDADE');
      else if (!ehProva(tit) && (PROPOSTA.test(tp) || /proposta|acordo/i.test(tit)) && TERMOS.test(tp)) m.push('PROPOSTA');
      if (tp.length < t.length && !m.some((x) => x === 'PROPOSTA' || x === 'IMPOSSIBILIDADE')) m.push('PROMESSA');
      if (/c[áa]lculo de liquida|Parecer T[ée]cnico|CALPREV|ECALC|planilha de c[áa]lculo|demonstrativo de c[áa]lculo|mem[óo]ria de c[áa]lculo/i.test(t)) m.push('CÁLCULO');
      if (/^Contesta/i.test(tit) || /apresentar,? CONTESTA/i.test(t.slice(0, 1500))) m.push('CONTESTAÇÃO');
      if (/juntada dos documentos administrativos/i.test(t.slice(0, 1500))) m.push('JUNTADA-PA');
      // Petição do INSS que fala em acordo sem cair em PROPOSTA nem em IMPOSSIBILIDADE: ler o teor.
      // Fora a fórmula padrão das contestações ("não tem interesse na audiência de conciliação prevista no art. 334",
      // "AUSÊNCIA DE INTERESSE NA REALIZAÇÃO DE AUDIÊNCIA DE CONCILIAÇÃO") e o nome da equipe da AGU no cabeçalho
      // ("EBI5-GEAC-ANÁLISE ESTRATÉGICA-CONCILIAÇÃO").
      const semFormula = tp.replace(/(?:n[ãa]o (?:tem|possui|possuir)|aus[êe]ncia de) interesse (?:na|em) (?:realiza[çc][ãa]o de |designa[çc][ãa]o de )?audi[êe]ncia de concilia[çc][ãa]o/gi, '')
        .replace(/AN[ÁA]LISE ESTRAT[ÉE]GICA ?- ?CONCILIA[ÇC][ÃA]O/gi, '');
      if (!m.some((x) => x === 'PROPOSTA' || x === 'IMPOSSIBILIDADE' || x === 'PROMESSA') && /(?<!de )acordo(?! com)|concilia[çc]/i.test(semFormula)) m.push('ACORDO?');
    }
    if (o !== 'INSS') {
      const acTit = /aceit\w* (de |da |a |o )?(proposta|acordo)|aceite/i.test(tit);
      // v3: também com a palavra partida pelo pdf.js ("a ceitar o acordo"): a mesma busca no texto sem espaços
      // (correção da jef-analise-laudo v4, 17/11/2026).
      const tc = t.replace(/\s+/g, '').toLowerCase().replace(/deacordocom/g, '');
      // v8 (25/11/2026): "concordância com o laudo/a conclusão pericial" e "nos termos que se seguem" NÃO são aceite da proposta; a
      // petição que impugna os termos da oferta é recusa. (Ex.: "concordância com o laudo ... nos termos que se seguem" saía como
      // aceite; "concordando com a conclusão ... e impugnando os termos da oferta" também.)
      const sl = t.replace(/(aceit|concord)\w*\s+(integral\w*\s+|total\w*\s+|plena\w*\s+)?(com|d[oa]s?|a[os]?)\s+(o\s+|os\s+|a\s+|as\s+)?(laudo|conclus\w*|per[íi]cia|estudo|parecer)(?:\s+(?!(?:e|aceit\w*|concord\w*)\b)[^\s.;,]+){0,4}/gi, ' ').replace(/nos termos (que se seguem|seguintes|abaixo)/gi, ' ');
      const tcs = sl.replace(/\s+/g, '').toLowerCase().replace(/deacordocom/g, '');
      const aceita = /(aceit|concord|anu[êe])\w*.{0,120}(proposta|acordo|termos (propost|ofert|d[oa] (acordo|proposta)))|(proposta|acordo).{0,150}(aceit|concord|anu[êe]ncia)/i.test(sl) || /(aceit|concord|anu[êe])\w{0,8}.{0,90}(proposta|acordo)/.test(tcs);
      const impugnaOferta = !/n[ãa]o\s+(impugn|contest|questiona)/i.test(t) && (/(impugn|contest|questiona)\w*.{0,60}(termos d[ao]s? (proposta|oferta)|proposta|oferta)|proposta (injusta|desproporcional|insuficiente)|(proposta|oferta).{0,40}(injusta|desproporcional)/i.test(t));
      const naoAceita = /n[ãa]o (aceit|concord)\w*.{0,60}(proposta|acordo)|recus\w*.{0,60}(proposta|acordo)/i.test(t) || /n[ãa]o(aceit|concord)\w{0,8}.{0,50}(proposta|acordo)|recus\w{0,8}.{0,50}(proposta|acordo)/.test(tc) || impugnaOferta;
      if ((acTit || aceita) && !naoAceita) m.push('ACEITA');
      if (/(n[ãa]o (aceit|concord)|recus|discord|rejeit)\w*.{0,80}(proposta|acordo)|(proposta|acordo).{0,60}(recus|rejeit|n[ãa]o (aceit|concord))|contra-?proposta/i.test(t) || naoAceita) m.push('RECUSA');
      if (/contra-?proposta/i.test(t)) m.push('CONTRAPROPOSTA');
      const dl = t.match(/(?:dila[çc][ãa]o|prorroga[çc][ãa]o|dilat[oó]ri|prazo suplementar|novo prazo|concess[ãa]o de prazo)[^.]{0,160}?(\d{1,3}|cinco|dez|quinze|vinte|trinta|quarenta|sessenta|noventa)\s*(?:\([^)]{0,25}\)\s*)?dias/i);
      if (dl || /dila[çc][ãa]o (de|do) prazo|prorroga[çc][ãa]o (de|do) prazo/i.test(t)) m.push('DILAÇÃO(' + (dl ? (NUM[dl[1].toLowerCase()] || dl[1]) : '?') + ' dias)');
      if ((o === 'autor' || /^(Peti|Manifesta|Informa)/i.test(tit)) && (/localiza|endere[çc]o|ponto de refer[êe]ncia/i.test(tit) || /endere[çc]o|localiza[çc][ãa]o (do|da) (im[óo]vel|resid)|ponto de refer[êe]ncia|\b(rua|avenida|s[íi]tio|travessa|loteamento|conjunto)\b.{0,60}\d/i.test(t) && t.length < 6000)) m.push('ENDEREÇO');
    }
    if (/impugna\w*.{0,60}(c[áa]lculo|planilha|valor|conta)|(discord|n[ãa]o concord)\w*.{0,60}(c[áa]lculo|planilha|valor|conta)|(c[áa]lculo|planilha|conta).{0,80}(equivocad|incorret|errad|excesso)/i.test(t)
      || (rot === 'PC' && o !== 'INSS' && IMPUGNA_AUTOR.test(t))) m.push('IMPUGNA');
    else if (/concord\w*.{0,40}(c[áa]lculo|valor|planilha|conta)|n[ãa]o se op[õo]e|anu[êe]ncia.{0,40}(c[áa]lculo|valor)/i.test(t)) m.push('CONCORDA');
    return { m, o };
  }
  const ehSistema = (tit) => /^(Intima[çc][ãa]o|Certid[ãa]o|Ato Ordinat|Expedi|Pauta|Decurso|Despacho|Decis[ãa]o|Senten[çc]a|Ac[óo]rd[ãa]o|Of[íi]cio|Mandado|Aviso|Notifica|Cita[çc][ãa]o|Termo)/i.test(tit);
  // Documentos da inicial que não decidem nada nesta skill (identidade, procuração etc.).
  const ehAnexoInicial = (tit) => /^(Documento de Identifica|Documento de Comprova|Procura)/i.test(tit)
    || /\((\d+\.? ?)?(PROCURA|RG\b|CPF\b|COMPROVANTE DE RESID|DOCUMENTOS? PESSOA|DOCUMENTO DE IDENTIFICA|CNIS|CTPS)/i.test(tit);
  // Laudo pericial juntado pelo perito. Os documentos do dossiê do INSS também vêm como "Laudo Pericial (<CPF> Extrato CNIS...)".
  const ehLaudo = (tit) => /^Laudo/i.test(tit) && !/\(\d{11}|dossi|CNIS|Declara|Relat[óo]rio Dados|Hist[óo]rico de Cr|Extrato|\(ANEXO|CREDENCIA/i.test(tit);

  // "Ocupação habitual: merendeira - Equiparado a ..." / "a) Última profissão exercida: EMPREGADA DOMÉSTICA b) Descrição..."
  // O pdf.js às vezes parte a palavra: "Última p rofissão exercida : merendeira;" e "Hist ó rico ocupacional informada:
  // a) Ú ltima profiss ã o exercida: Empregada dom é stica." O rótulo aceita espaço solto entre as letras.
  const solto = (s) => s.split(' ').map((w) => (w.match(/\[[^\]]+\]|\\.|./g) || []).join('\\s?')).join('\\s+');
  // Junta a letra acentuada que ficou solta no meio da palavra ("dom é stica" -> "doméstica", "servi ç os" -> "serviços").
  const junta = (s) => s.replace(/(\p{L}) ([À-ÖØ-öø-ÿ]+) (?=\p{L})/gu, '$1$2');
  const PROF1 = new RegExp('(?:' + ['[úu]ltima profiss[ãa]o exercida', 'ocupa[çc][ãa]o habitual'].map(solto).join('|') + ')\\s*:\\s*([^;:]{2,70})', 'i');
  const PROF2 = new RegExp('(?:' + ['profiss[ãa]o declarada', 'profiss[ãa]o habitual', 'profiss[ãa]o atual', 'profiss[ãa]o exercida', 'profiss[ãa]o',
    'ocupa[çc][ãa]o atual', 'ocupa[çc][ãa]o declarada', 'ocupa[çc][ãa]o'].map(solto).join('|') + ')\\s*:\\s*([^;:]{3,70})', 'i');
  const HIST = new RegExp(['hist[óo]rico ocupacional', 'hist[óo]rico laboral', 'hist[óo]rico profissional'].map(solto).join('|'), 'i');
  const corteProf = (p) => junta(p.split(/\s+[a-h] ?\)|\s+–|\.\s/)[0].trim());
  // "trabalhador(a) rural" vem com os parênteses no laudo.
  const AGR = /agricult|lavrador|rur[íi]col|trabalhador(?:a|\s?\(a\))?\s+rural|pescador|marisqu|catador(a)? de marisco|6312-10|segurad[oa] especial/i;
  const ehSocial = (t, tit) => /social|constata|socioecon/i.test(tit) || /assistente social|estudo social|socioecon[ôo]mic|auto de constata|composi[çc][ãa]o (do grupo )?familiar|mesmo teto/i.test(t.slice(0, 4000));
  const digito = (num) => { const d = +num.slice(6, 7); return d + ' -> ' + ((EM.cfg.assessorPorDigito || {})[String(d)] || '? (assessor não configurado)'); };

  const ROT = {
    C: 'laudo', D: 'laudo', LOAS: 'laudo', INC: 'laudo', LIM: 'laudo', PC: 'planilha', DIL: 'despacho',
    CEJ: 'tudo', CIT: 'tudo', CA: 'tudo', CT: 'tudo', LA: 'tudo', CP: 'proposta', PP: 'proposta', AP: 'proposta', EL: 'intimacao', EC: 'intimacao',
  };

  // v3 (mesmo critério da jef-analise-laudo v4): "(A …)" é anexo quando é dossiê, laudo, documento etc., ou quando há a
  // petição principal "(P …)" no mesmo dia, com id menor e próximo.
  const ANEXO_TIT = /\(A (DOSSI|LAUDO|ANEXO|PETI[ÇC][ÃA]O \(|DOC|PROCURA|CNIS|EXTRATO|COMPROV|ATESTADO|RECEIT|EXAME|FOTO|CONTRATO|DECLARA|SABI|PLANILHA|C[ÁA]LCULO|HIST[ÓO]RICO|RELAT|QUADRO|CERTID|TELA|PRINT|CAD|RG\b|CPF\b)/i;
  function ehAnexoA(x, docs) {
    if (!/\(A [A-ZÀ-Ú]/.test(x.titulo)) return false;
    if (ANEXO_TIT.test(x.titulo)) return true;
    return docs.some((y) => /\(P /.test(y.titulo) && y.data === x.data && +y.id < +x.id && +x.id - +y.id < 300);
  }

  // Lê os documentos de docs[0..ate-1] que não são do sistema nem anexos da inicial (até lim), do mais recente.
  async function lePosteriores(docs, ate, lim, out, post, rot) {
    const lista = docs.slice(0, ate);
    let lidos = 0;
    for (const x of lista) {
      if (lidos >= lim) { out.push('... ' + (lista.length - lista.indexOf(x)) + ' documento(s) mais antigo(s) não lido(s) pelo script'); break; }
      // "(A DOSSIÊ ...)", "(A DOCUMENTO ...)": anexo de petição do INSS — o teor está na principal "(P ...)".
      // v3: "Petição (outras) (A PARTE AUTORA ACEITA O ACORDO ...)" sem "(P ...)" no mesmo dia é a própria petição.
      const anexo = ehAnexoA(x, docs) || /^Laudo Pericial \((ANEXO|\d{11})/i.test(x.titulo);
      if (ehSistema(x.titulo) || ehAnexoInicial(x.titulo) || anexo) {
        out.push(x.data + ' ' + x.id + ' ' + x.titulo.slice(0, 50) + (x.nl ? ' [NL]' : '') + (anexo ? ' [anexo]' : ' [sistema]'));
        if (/decurso|decorrid/i.test(x.titulo)) post.push({ id: x.id, m: ['DECURSO'], o: 'sistema', i: docs.indexOf(x) });
        continue;
      }
      const r = await EM.leDoc(x.id, 4);
      if (EM.bloqueio) return 'bloqueio';
      if (r.ct === 'login') return 'login';
      lidos++;
      const ileg = (r.ct === 'pdf' && !r.text) || ilegivel(r.text);
      const { m, o } = ileg ? { m: [], o: '?' } : marcasDoc(r.text, x.titulo, rot);
      post.push({ id: x.id, m, o, ileg, i: docs.indexOf(x), t: ileg ? '' : r.text });
      out.push(x.data + ' ' + x.id + ' ' + x.titulo.slice(0, 50) + (x.nl ? ' [NL]' : '') + (ileg ? ' ILEGÍVEL' : '') + ' {' + m.join(' ') + '} (' + o + '): '
        + (ileg ? '' : trecho(r.text, /acordo|proposta|requer|vem |informa|dila|prorrog|endere|localiza|c[áa]lculo|concord|discord|impugn|ci[êe]ncia/i, 260)));
    }
    return '';
  }

  // Profissão declarada no laudo médico mais recente. O laudo costuma vir em dois documentos do mesmo dia:
  // "Laudo Pericial" (só "laudo em anexo") e "Laudo Pericial (LP <nome>)" ou "(<nome>)", com o texto.
  async function profissao(docs, out) {
    let ileg = '';
    for (const x of docs.filter((y) => ehLaudo(y.titulo)).slice(0, 5)) {
      const r = await EM.leDoc(x.id, 4);
      if (EM.bloqueio) return { bloqueio: true };
      if (!r.text || ilegivel(r.text)) { ileg = ileg || x.id; continue; }
      if (ehSocial(r.text, x.titulo) || r.text.length < 400) continue;
      const pm = r.text.match(PROF1) || r.text.match(PROF2);
      if (!pm && !HIST.test(r.text) && !/CID/i.test(r.text)) continue;
      const p = pm ? corteProf(pm[1]) : '';
      const agr = AGR.test(p) || (!p && AGR.test(r.text.slice(0, 4000)));
      out.push('[LAUDO MÉDICO ' + x.id + ' ' + x.data + '] PROFISSÃO: ' + (p || 'não localizada no texto: ler o laudo') + (agr ? ' [AGRICULTOR]' : ''));
      return { p: p || '?', agr };
    }
    out.push('[LAUDO MÉDICO] ' + (ileg ? 'ilegível ou digitalizado (id. ' + ileg + '): profissão na tela' : 'não localizado na cronologia'));
    return { p: ileg ? '?' : '' };
  }

  // Laudo social ou auto de constatação mais recente (miserabilidade: as fotos só se veem na tela). As fotos às vezes
  // vêm em documentos irmãos, da mesma data ("REG FOT", "ilovepdf merged", "Apto Foto 07"): o resumo lista todos.
  const FOTO = /fot|ilovepdf|merged|imagem|registro fotogr/i;
  async function social(docs, out) {
    const dil = docs.filter((y) => /^Dilig[êe]ncia/i.test(y.titulo) && !/mandado|certid/i.test(y.titulo));
    const cand = docs.filter((y) => /auto de constata|laudo social|socioecon|estudo social/i.test(y.titulo))
      .concat(dil.filter((y) => !FOTO.test(y.titulo)), dil.filter((y) => FOTO.test(y.titulo)))
      .concat(docs.filter((y) => ehLaudo(y.titulo))).filter((y, i, a) => a.indexOf(y) === i).slice(0, 6);
    for (let x of cand) {
      let r = await EM.leDoc(x.id, 2);
      if (EM.bloqueio) return { bloqueio: true };
      if (/auto de constata|laudo social|socioecon|estudo social/i.test(x.titulo) || (r.text && (ehSocial(r.text, x.titulo) || (/^Dilig/i.test(x.titulo) && /constata[çc][ãa]o/i.test(r.text.slice(0, 4000)))) && r.text.length > 400) || (/^Dilig/i.test(x.titulo) && (!r.text || ilegivel(r.text)))) {
        const irmaos = (z) => docs.filter((y) => y !== z && y.data === z.data && !ehSistema(y.titulo) && !/mandado|certid/i.test(y.titulo)
          && (FOTO.test(y.titulo) || /^(Dilig[êe]ncia|Laudo|Outros Documentos|Documento|Auto)/i.test(y.titulo)));
        // Escolhido um documento só de fotos: o principal é o irmão da mesma data que não é foto (o auto).
        const princ = FOTO.test(x.titulo) && irmaos(x).find((y) => /^Dilig[êe]ncia/i.test(y.titulo) && !FOTO.test(y.titulo));
        if (princ) {
          x = princ;
          r = await EM.leDoc(x.id, 2);
          if (EM.bloqueio) return { bloqueio: true };
        }
        const ir = irmaos(x).slice(0, 8);
        out.push('[SOCIAL ' + x.id + ' ' + x.data + ' ' + x.titulo.slice(0, 45) + '] págs=' + (r.pags || '?') + ' — fotos: ver na tela'
          + (ir.length ? '; mesma data: ' + ir.map((y) => y.id + ' ' + y.titulo.slice(0, 35)).join(' | ') : ''));
        return { ok: true };
      }
    }
    return { ok: false };
  }

  // CEJUSC, Citados etc. sem petição do INSS depois do laudo: lê a contestação e as petições do INSS anteriores a ele
  // (até 3, da mais recente). Contestação que só diz que o INSS "poderá apresentar proposta de acordo" depois do laudo
  // sai com a marca PROMESSA, não PROPOSTA.
  async function anteriorAoLaudo(docs, ul, out) {
    const cand = docs.slice(ul + 1).filter((y) => (tituloINSS(y.titulo) || /PROPOSTA DE ACORDO|\(INSS\)/i.test(y.titulo)) && !/\(A [A-ZÀ-Ú]/.test(y.titulo)).slice(0, 3);
    const res = { lidos: 0 };
    for (const x of cand) {
      const r = await EM.leDoc(x.id, 6);
      if (EM.bloqueio) return { bloqueio: true };
      if (r.ct === 'login') return { login: true };
      const cab = '[ANTES DO LAUDO] ' + x.data + ' ' + x.id + ' ' + x.titulo.slice(0, 50);
      if (r.ct === 'err' || (r.ct === 'pdf' && !r.text) || ilegivel(r.text)) { res.ileg = x.id; out.push(cab + ' ILEGÍVEL'); continue; }
      res.lidos++;
      const { m, o } = marcasDoc(r.text, x.titulo);
      out.push(cab + ' {' + m.join(' ') + '} (' + o + '): ' + trecho(r.text, m.includes('PROMESSA') && !m.includes('PROPOSTA') ? PROMESSA : PROPOSTA_FORTE.test(r.text) ? PROPOSTA_FORTE : /proposta|acordo|concilia/i, 240));
      if (m.includes('PROPOSTA') && !res.pr) res.pr = x;
      if (m.includes('ACORDO?')) res.acordo = true;
    }
    return res;
  }

  // Requisito de renda per capita no processo administrativo (DETALHAMENTO DA ANÁLISE E DECISÃO...).
  async function renda(docs, out) {
    const cand = docs.filter((y) => /processo administrativo|\bP\.?A\.?\b|dossi|requerimento|indeferi|detalhamento|administrativ|INSS|contesta/i.test(y.titulo)).slice(-6).reverse();
    for (const x of cand) {
      const r = await EM.leDoc(x.id, 400);
      if (EM.bloqueio) return { bloqueio: true };
      const m = r.text.match(/Renda Per Capita Atendido\s*:?\s*(Sim|N[ãa]o)/i);
      if (m) { out.push('[RENDA ' + x.id + ' ' + x.titulo.slice(0, 40) + '] Requisito de Renda Per Capita Atendido: ' + m[1].toUpperCase()); return { r: /sim/i.test(m[1]) ? 'SIM' : 'NÃO' }; }
    }
    out.push('[RENDA] quadro "Requisito de Renda Per Capita Atendido" não localizado (' + cand.length + ' documento(s) lido(s))');
    return { r: '' };
  }

  // Endereço da parte autora, da informação mais recente para a mais antiga: as petições do autor; depois a inicial e
  // os primeiros documentos do processo (os menores ids da listaIdsDocumentos: inicial, procuração, CadÚnico), que a
  // cronologia nem sempre carrega. "Residente e domiciliada na..." vale mais que um campo "Endereço:". O endereço do
  // escritório do advogado (cabeçalho da petição, "com escritório na...") não conta. O pdf.js parte as palavras:
  // "domiciliad a na", "residente s e domiciliado s (a s ) na"; o CadÚnico traz "ENDEREÇO DA FAMÍLIA" sem dois-pontos.
  const END_FORTE = new RegExp([
    solto('residente') + '\\s?s?\\s+e\\s+' + solto('domicil'),
    solto('domiciliad') + '\\s?[oa]\\s?s?\\s*(?:\\(\\s?[ao]\\s?s?\\s?\\)\\s*)?(?:na|no|em|à|a)\\b',
    solto('resid') + '(?:e|ente)\\s?s?\\s+(?:e\\s+)?(?:na|no|em|à|a)\\b'].join('|'), 'gi');
  const END_FRACO = /endere[çc]o(?: residencial)?\s*:|endere[çc]o da fam\S{1,4}lia|logradouro\s*:/gi;
  const ESCRIT = /escrit[óo]rio|advogad|advocacia|\bOAB\b|www\.|@/i;
  function achaEnd(t) {
    for (const [re, forte] of [[END_FORTE, true], [END_FRACO, false]]) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(t))) {
        const antes = t.slice(Math.max(0, m.index - 80), m.index), depois = t.slice(m.index, m.index + 200);
        if (ESCRIT.test(antes) || (!forte && ESCRIT.test(depois))) continue;
        return { forte, tr: t.slice(Math.max(0, m.index - 40), m.index + 260) };
      }
    }
    return null;
  }
  async function endereco(docs, post, out, ids) {
    let pet = null, fracoPet = null, fraco = null;
    for (const p of post) {
      const a = p.o === 'autor' && p.t ? achaEnd(p.t) : null;
      if (a && a.forte && !pet) pet = { c: { id: p.id, onde: 'petição do autor' }, a };
      if (a && !a.forte && !fracoPet) fracoPet = { c: { id: p.id, onde: 'petição do autor' }, a };
    }
    if (pet) out.push('[ENDEREÇO ' + pet.c.id + ' ' + pet.c.onde + '] ' + pet.a.tr);
    const ini = docs.filter((y) => /peti[çc][ãa]o inicial|inicial/i.test(y.titulo)).slice(-1)[0];
    const cand = (ini ? [{ id: ini.id, onde: 'inicial' }] : [])
      .concat(ids.slice(0, 6).filter((id) => !ini || String(id) !== ini.id).map((id) => ({ id: String(id), onde: (ids.indexOf(id) + 1) + 'º documento do processo' })));
    for (const c of cand) {
      const r = await EM.leDoc(c.id, 2);
      if (EM.bloqueio) return { bloqueio: true };
      const a = r.text && !ilegivel(r.text) ? achaEnd(r.text) : null;
      if (a && a.forte) {
        // Com endereço na petição do autor, o da inicial vem para comparar (a petição pode qualificar outra pessoa,
        // como o curador indicado).
        out.push('[ENDEREÇO ' + c.id + ' ' + c.onde + (pet ? ', mais antigo: comparar' : '') + '] ' + a.tr);
        return {};
      }
      if (a && !fraco) fraco = { c, a };
    }
    if (pet) return {};
    fraco = fracoPet || fraco;
    if (fraco) { out.push('[ENDEREÇO ' + fraco.c.id + ' ' + fraco.c.onde + ', campo "endereço"] ' + fraco.a.tr); return {}; }
    out.push('[ENDEREÇO] não localizado pelo script' + (ini ? '' : ' (inicial fora da cronologia carregada)') + ' nos ' + cand.length + ' primeiros documentos: procurar na tela');
    return {};
  }

  // Sugestão para as rotinas com hipótese de proposta de acordo.
  function proposta(post) {
    const pr = post.find((p) => p.m.includes('PROPOSTA'));
    if (!pr) return { s: 'SEM' };
    const dep = post.filter((p) => p.i < pr.i);
    if (dep.some((p) => p.m.includes('ACEITA'))) return { s: 'ACEITA', pr };
    if (dep.some((p) => p.m.includes('RECUSA'))) return { s: 'RECUSA', pr, contra: dep.some((p) => p.m.includes('CONTRAPROPOSTA')) };
    return { s: 'COM', pr, dep };
  }

  EM.analisa = async function (item) {
    const [num, rot] = item.split('|').map((s) => (s || '').trim());
    if (!ROT[rot]) return { txt: 'X|' + num + '|rotina "' + rot + '" desconhecida' };
    const ab = await EM.abre(num);
    if (ab.login) return { login: true };
    // "Consulta sem resultado" (diferente de "não encontrado") costuma ser passageiro: tenta de novo.
    if (ab.erro || ab.naoAchou) return { txt: 'X|' + num + '|' + (ab.erro || ab.motivo), erro: !!ab.erro || /não devolveu/.test(ab.motivo || '') };
    const d = ab.d;
    const docs = EM.cron(d);
    const sc = [...d.querySelectorAll('script')].map((s) => s.textContent).join('\n').match(/listaIdsDocumentos\s*=\s*\[([^\]]*)\]/);
    const total = sc ? sc[1].split(',').filter((s) => /\d/.test(s)).length : docs.length;
    // Ids do processo em ordem crescente (os primeiros são a inicial e seus anexos). Id negativo é documento da Turma
    // Recursal, já na cronologia com id positivo: fica de fora.
    const ids = sc ? sc[1].split(',').map((s) => s.replace(/['"\s]/g, '')).filter((s) => /^\d+$/.test(s)).map(Number).sort((a, b) => a - b) : [];
    const parcial = total > docs.length ? ' (cronologia carregou ' + docs.length + ' de ' + total + ' documentos)' : '';
    // Cabeçalho dos autos: os detalhes ficam num menu oculto (innerText vem vazio; usar textContent).
    const det = ((d.getElementById('maisDetalhes') || {}).textContent || '').replace(/\s+/g, ' ').trim();
    // "Segredo de justiça? SIM/NÃO": o "?" é o ícone de ajuda do rótulo. Pelo texto visível, o sigilo não aparece.
    const sig = /Segredo de justi[çc]a\W*SIM/i.test(det) ? ' SIGILOSO' : '';
    const nl = EM.naoLidos(d);
    const assunto = ((det.match(/Assunto\s+(.+?)\s*\(\d+\)/) || [])[1] || '?').trim();

    const out = [], post = [], rever = [];
    let marco = -1, prop = '?';
    const tipo = ROT[rot];
    // 1) Marco da rotina.
    if (tipo === 'laudo') {
      marco = docs.findIndex((y) => ehLaudo(y.titulo));
      if (marco < 0) rever.push('laudo não localizado' + parcial);
    } else if (tipo === 'planilha') {
      // O cálculo da contadoria ("Cálculo Judicial", "Planilha de Cálculo") ou a petição do INSS com o cálculo ("(P PLANILHA",
      // "(P CÁLCULO", "(P PARECER"). Não é marco a manifestação de parte ("Resposta aos cálculos"), nem a planilha do próprio
      // autor juntada com a petição dele ("Outros Documentos (CÁLCULO RMI CORRIGIDA)", "Documento Comprobatório (CÁLCULO
      // ...)" ou "Planilha de Cálculo (planilha de calculo)" na mesma data, com id logo depois do da petição).
      const petParte = (y) => /^(Peti|Manifesta|Impugna|Resposta|Requerimento|Concord|Informa)/i.test(y.titulo) && !tituloINSS(y.titulo);
      const anexoDaParte = (y) => docs.some((z) => z.data === y.data && petParte(z) && +y.id - +z.id > 0 && +y.id - +z.id <= 30);
      marco = docs.findIndex((y) => (/^(C[áa]lculo Judicial|Planilha de C[áa]lculo)/i.test(y.titulo) || /\(P (PLANILHA|C[ÁA]LCULO|PARECER)/i.test(y.titulo)) && !anexoDaParte(y));
      if (marco < 0) rever.push('planilha de cálculo (contadoria ou INSS) não localizada pelo título' + parcial);
    } else if (tipo === 'despacho') {
      marco = docs.findIndex((y) => /^(Despacho|Decis[ãa]o)/i.test(y.titulo));
      if (marco < 0) rever.push('despacho não localizado' + parcial);
    } else if (tipo === 'intimacao') {
      // A intimação (ou o despacho/ato) que pede os dados de localização do imóvel: lê até 4 dos mais recentes.
      for (const x of docs.filter((y) => /^(Intima[çc][ãa]o|Despacho|Decis|Ato Ordinat)/i.test(y.titulo)).slice(0, 8)) {
        const r = await EM.leDoc(x.id, 3);
        if (EM.bloqueio) return { bloqueio: true };
        // Inclui a intimação "da informação prestada pela assistente social" (certidão de endereço não localizado).
        if (/localiza|endere[çc]o|ponto de refer|croqui|im[óo]vel|assistente social|informa[çc][ãa]o prestada pel[oa] perit/i.test(r.text)) { marco = docs.indexOf(x); break; }
      }
      if (marco < 0) rever.push('intimação para informar a localização não localizada' + parcial);
    }
    if (marco >= 0) {
      const x = docs[marco];
      let tr = '';
      if (tipo === 'despacho' || tipo === 'intimacao') {
        const r = await EM.leDoc(x.id, 4);
        if (EM.bloqueio) return { bloqueio: true };
        tr = tipo === 'despacho' ? r.text.slice(-1500) : trecho(r.text, /localiza|endere[çc]o|ponto de refer/i, 500);
      }
      out.push('[MARCO ' + tipo.toUpperCase() + ' ' + x.data + ' ' + x.id + ' ' + x.titulo.slice(0, 50) + ']' + (tr ? ' ' + tr : ''));
    }

    // 2) Documentos depois do marco (ou, sem marco próprio, os mais recentes do processo).
    let ate = marco >= 0 ? marco : (tipo === 'tudo' || tipo === 'proposta' ? docs.length : 0);
    const lim = tipo === 'tudo' || tipo === 'proposta' ? 10 : 12;
    let ul = -1;
    if (tipo === 'tudo') {
      // CEJUSC, Citados, Contestação, Laudo (assessoria): vale o que o INSS disse depois do último laudo
      // (a proposta da contestação anterior ao laudo costuma depender dele); sem laudo, até a petição inicial.
      ul = docs.findIndex((y) => ehLaudo(y.titulo) || /auto de constata/i.test(y.titulo) || (/^Dilig[êe]ncia/i.test(y.titulo) && !/mandado/i.test(y.titulo)));
      const ini = docs.findIndex((y) => /^Peti[çc][ãa]o inicial/i.test(y.titulo));
      ate = ul >= 0 ? ul : ini >= 0 ? ini : docs.length;
      if (ul >= 0) {
        const antes = docs.slice(ul).find((y) => /PROPOSTA DE ACORDO/i.test(y.titulo));
        out.push('[ESCOPO] documentos depois do laudo de ' + docs[ul].data + ' (id. ' + docs[ul].id + ')' + (antes ? ' — proposta anterior ao laudo: id. ' + antes.id + ' (' + antes.data + ')' : ''));
      }
    }
    if (tipo === 'proposta') {
      // Proposta já feita: o marco é a petição do INSS com a proposta; o que vem depois decide.
      const tmp = [];
      const r1 = await lePosteriores(docs, docs.length, 15, [], tmp, rot);
      if (r1) return r1 === 'login' ? { login: true } : { bloqueio: true };
      const pr = tmp.find((p) => p.m.includes('PROPOSTA'));
      if (pr) {
        marco = pr.i;
        out.push('[MARCO PROPOSTA ' + docs[marco].data + ' ' + docs[marco].id + ' ' + docs[marco].titulo.slice(0, 50) + '] ' + trecho(pr.t, PROPOSTA_FORTE.test(pr.t.slice(0, 2500)) ? PROPOSTA_FORTE : PROPOSTA, 300));
        ate = marco;
        tmp.filter((p) => p.i < marco).forEach((p) => post.push(p));
        for (const x of docs.slice(0, marco)) {
          const p = tmp.find((q) => q.id === x.id);
          out.push(x.data + ' ' + x.id + ' ' + x.titulo.slice(0, 50) + (x.nl ? ' [NL]' : '') + (p && p.o !== 'sistema' ? ' {' + p.m.join(' ') + '} (' + p.o + '): ' + trecho(p.t || '', /aceit|concord|recus|discord|acordo|proposta|requer/i, 260) : ' [sistema]'));
        }
      } else rever.push('proposta de acordo do INSS não localizada' + parcial);
      ate = -1;
    }
    if (ate > 0) {
      const r = await lePosteriores(docs, ate, lim, out, post, rot);
      if (r) return r === 'login' ? { login: true } : { bloqueio: true };
    }
    if (post.some((p) => p.ileg)) rever.push('documento ilegível: ler na tela');

    // 3) Sugestão, por rotina.
    const pp = proposta(post);
    const inssPet = post.filter((p) => p.o === 'INSS');
    if (['C', 'D', 'LOAS', 'INC', 'LIM'].includes(rot)) {
      if (marco < 0) prop = '?';
      else if (pp.s === 'ACEITA') prop = 'COM PROPOSTA - aceita?';
      else if (pp.s === 'COM' && rot === 'LOAS') prop = 'COM PROPOSTA (LOAS)?';
      else if (pp.s === 'COM') prop = 'COM PROPOSTA?';
      else if (pp.s === 'RECUSA' && (rot === 'C' || rot === 'D')) prop = pp.contra ? 'COM PROPOSTA - contraproposta do autor?' : 'COM PROPOSTA - recusada?';
      else {
        const base = post.some((p) => p.m.includes('IMPOSSIBILIDADE')) ? 'SEM (impossibilidade de acordo)' : pp.s === 'RECUSA' ? 'SEM (proposta recusada)' : 'SEM';
        if (inssPet.some((p) => p.m.includes('ACORDO?'))) rever.push('petição do INSS fala em acordo sem proposta clara: conferir o teor');
        if (rot === 'C' || rot === 'D') prop = base + '?';
        else if (rot === 'INC' || rot === 'LIM') {
          const pf = await profissao(docs, out);
          if (pf.bloqueio) return { bloqueio: true };
          prop = base + ' - ' + (pf.agr ? 'agricultor(a)' : pf.p ? 'outra profissão' : 'profissão?') + '?';
        } else {
          const rd = await renda(docs, out);
          if (rd.bloqueio) return { bloqueio: true };
          if (rd.r === 'SIM') prop = base + ' - renda per capita atendida?';
          else {
            const en = await endereco(docs, post, out, ids);
            if (en.bloqueio) return { bloqueio: true };
            prop = base + ' - endereço (área de perícia social, fora das listas ou a esclarecer)?';
          }
        }
      }
    } else if (rot === 'PC') {
      const imp = post.find((p) => p.m.includes('IMPUGNA'));
      const pets = post.filter((p) => p.o !== 'sistema');
      prop = marco < 0 ? '?' : imp ? 'IMPUGNAÇÃO/DISCORDÂNCIA? (id. ' + imp.id + ')' : pets.length ? 'QUALQUER OUTRA PETIÇÃO?' : 'INDEFINIDO? (nenhuma petição depois da planilha)';
    } else if (rot === 'DIL') {
      // Proposta do INSS depois do último despacho vem antes das hipóteses do despacho (regra de 19/10/2026): sem
      // manifestação da parte autora, COM PROPOSTA; aceita ou recusada; contraproposta não tem hipótese própria (AVISO).
      // Impossibilidade de acordo não é proposta: segue a hipótese do despacho.
      prop = marco < 0 ? '?' : pp.s === 'COM' ? 'COM PROPOSTA? (id. ' + pp.pr.id + ')' : pp.s === 'ACEITA' ? 'COM PROPOSTA - aceita? (id. ' + pp.pr.id + ')'
        : pp.s === 'RECUSA' ? (pp.contra ? 'AVISO? (contraproposta do autor à proposta id. ' + pp.pr.id + ')' : 'COM PROPOSTA - recusada? (id. ' + pp.pr.id + ')')
        : 'ler o despacho (1a-1d, 2a-2c, 3 ou AVISO)';
      const autorDepois = post.filter((p) => p.o === 'autor'), inssDepois = post.filter((p) => p.o === 'INSS');
      out.push('[DEPOIS DO DESPACHO] autor: ' + autorDepois.map((p) => p.id + (p.m.length ? '{' + p.m.join(' ') + '}' : '')).join(', ') + ' | INSS/CEAB: ' + inssDepois.map((p) => p.id).join(', ')
        + ' | decurso: ' + post.filter((p) => p.m.includes('DECURSO')).map((p) => p.id).join(', '));
    } else if (['CEJ', 'CIT', 'CA', 'CT', 'LA'].includes(rot)) {
      // Sem petição do INSS depois do laudo: a contestação anterior a ele decide se havia proposta.
      let ant = null;
      if (pp.s === 'SEM' && !inssPet.length && ul >= 0) {
        ant = await anteriorAoLaudo(docs, ul, out);
        if (ant.bloqueio) return { bloqueio: true };
        if (ant.login) return { login: true };
      }
      if (ant && ant.pr) prop = 'COM PROPOSTA? (proposta anterior ao laudo, id. ' + ant.pr.id + ' de ' + ant.pr.data + ')';
      else if (pp.s === 'ACEITA') prop = 'COM PROPOSTA - aceita?';
      else if (pp.s === 'RECUSA' && pp.contra && ['CEJ', 'CIT'].includes(rot)) prop = 'COM PROPOSTA - contraproposta do autor?';
      else if (pp.s === 'RECUSA' && ['LA', 'CEJ', 'CIT'].includes(rot)) prop = 'COM PROPOSTA - recusada?';
      else if (pp.s === 'COM' || pp.s === 'RECUSA') prop = 'COM PROPOSTA?' + (pp.s === 'RECUSA' ? ' (recusa da parte autora: conferir)' : '');
      else if (rot === 'CA' || rot === 'CT') prop = 'SEM PROPOSTA?';
      else {
        const pcd = /defici|idos/i.test(assunto);
        if (rot === 'LA' || pcd) {
          const so = await social(docs, out);
          if (so.bloqueio) return { bloqueio: true };
          if (!so.ok) out.push('[SOCIAL] laudo social / auto de constatação não localizado' + parcial);
          prop = so.ok ? 'SEM PROPOSTA - miserabilidade: ver as fotos?' : 'SEM PROPOSTA (miserabilidade não elevada)? (sem laudo social)';
        } else {
          const pf = await profissao(docs, out);
          if (pf.bloqueio) return { bloqueio: true };
          prop = 'SEM PROPOSTA - ' + (pf.agr ? 'agricultor(a)' : pf.p ? 'outra profissão' : 'profissão?') + '?';
        }
      }
      if (inssPet.some((p) => p.m.includes('ACORDO?'))) rever.push('petição do INSS fala em acordo sem proposta clara: conferir o teor');
      if (ant && ant.pr) rever.push('proposta anterior ao laudo: conferir se ainda vale');
      else if (ant && ant.acordo) rever.push('petição do INSS anterior ao laudo fala em acordo sem proposta clara: conferir o teor');
      else if (ant && ant.ileg) rever.push('petição do INSS anterior ao laudo ilegível: ler na tela');
      else if (pp.s === 'SEM' && !inssPet.length && !(ant && ant.lidos)) rever.push('nenhuma petição do INSS no escopo: conferir a contestação');
    } else if (['CP', 'PP', 'AP'].includes(rot)) {
      if (marco < 0) prop = '?';
      else if (pp.s === 'ACEITA' || post.some((p) => p.m.includes('ACEITA'))) prop = 'COM PROPOSTA - aceita?';
      else if (post.some((p) => p.m.includes('RECUSA'))) prop = 'COM PROPOSTA - não aceita? (recusa)';
      else if (post.some((p) => p.o === 'autor')) prop = 'conferir a petição do autor (aceita ou não aceita)';
      else prop = 'COM PROPOSTA - não aceita? (sem manifestação' + (post.some((p) => p.m.includes('DECURSO')) ? ', com decurso' : '') + ')';
    } else if (['EL', 'EC'].includes(rot)) {
      const au = post.filter((p) => p.o === 'autor' || (p.o === '?' && !p.ileg));
      const dl = au.find((p) => p.m.some((x) => x.startsWith('DILAÇÃO')));
      const en = au.find((p) => p.m.includes('ENDEREÇO'));
      // Dilação e endereço na mesma petição: vale a dilação (o pedido costuma citar a busca do endereço).
      prop = marco < 0 ? '?' : dl && (!en || dl.i <= en.i) ? 'Pedido de dilação de prazo? (' + dl.m.find((x) => x.startsWith('DILAÇÃO')) + ', id. ' + dl.id + ')'
        : en ? 'Endereço informado? (id. ' + en.id + ')' : au.length ? 'AVISO? (petição do autor sem endereço nem dilação)' : 'Parte autora omissa?';
    }
    const cab = '=== ' + num + ' ' + rot + sig + ' nl=' + nl + ' docs=' + docs.length + '/' + total + ' PROP:' + prop + (rever.length ? ' rever: ' + rever.join(', ') : '');
    return { txt: [cab, 'ASSUNTO: ' + assunto.slice(0, 90) + ' | DÍGITO ' + digito(num), ...out].join('\n'), nl };
  };

  EM.inicia = function (lista, base) {
    if (EM.st && EM.st.rodando) return 'já está rodando';
    const semCfg = faltaCfg();
    if (semCfg) return semCfg;
    EM.bloqueio = false;
    const st = (EM.st = { lista, base: base || 0, idx: 0, res: [], rodando: true, parada: '', t0: Date.now() });
    (async () => {
      while (st.idx < st.lista.length && !st.pedirParada) {
        const item = st.lista[st.idx], num = item.split('|')[0].trim();
        let r;
        for (let t = 0; t < 2; t++) {
          try { r = await EM.analisa(item); } catch (e) { r = { txt: 'X|' + num + '|erro na leitura: ' + String(e).slice(0, 80), erro: true }; }
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

  EM.estado = () => {
    const st = EM.st;
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
    [...document.body.childNodes].forEach((n) => { if (n !== p && !/^__\w+Q$/.test(n.id || '')) n.remove?.(); });
    return p;
  };
  EM.mostra = function (a, b) {
    const rs = (EM.st ? EM.st.res : []).filter((r) => r.n >= a && r.n <= b);
    pre().textContent = rs.map((r) => '#' + r.n + ' ' + r.txt).join('\n\n');
    return rs.length + ' processos no quadro';
  };

  EM.para = function () { if (EM.st) EM.st.pedirParada = true; return 'vai parar após o processo em curso'; };

  // ÚNICA GRAVAÇÃO: MARCAR TODOS COMO LIDOS. Só depois da classificação gravada, um processo por vez.
  // nlLido = o nl do resumo: se o número mudou, chegou documento depois da leitura, que ninguém leu — não marca.
  EM.marca = async function (num, nlLido) {
    const ab = await EM.abre(num);
    if (ab.login) return num + ' LOGIN';
    if (!ab.d) return num + ' NÃO ABRIU — não marcado';
    const d = ab.d, antes = EM.naoLidos(d);
    if (!antes) return num + ' sem documento não lido — nada a marcar';
    if (nlLido !== undefined && antes !== nlLido) return num + ' NÃO MARCADO: eram ' + nlLido + ' não lidos na leitura e agora são ' + antes + ' — reanalisar';
    const bt = [...d.querySelectorAll('input,button,a')].find((e) => /marcar todos como lidos/i.test(e.value || e.textContent || ''));
    if (!bt) return num + ' botão MARCAR TODOS COMO LIDOS não encontrado (' + antes + ' não lidos)';
    bt.click();
    const ok = await espera(() => { const dd = docQ(quadro()); return dd && dd.getElementById('divTimeLine') && !EM.naoLidos(dd); }, 20000);
    return num + (ok ? ' MTL OK (' + antes + ' não lidos; aviso sumiu)' : ' MTL FALHOU — o aviso continua');
  };

  // Para conferir as expressões sem abrir processo (teste offline com texto colado).
  EM.teste = { marcasDoc, achaEnd, corteProf, PROF1, PROF2, HIST, PROMESSA_FRASE, PROPOSTA_FORTE, IMPUGNA_AUTOR };

  return 'EM v' + EM.versao + ' carregado (' + document.visibilityState + ')';
})();
