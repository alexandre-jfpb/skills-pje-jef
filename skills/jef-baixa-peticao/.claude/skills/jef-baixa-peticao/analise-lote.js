// analise-lote.js — jef-baixa-peticao (desenvolvido na 7ª Vara Federal da Paraíba; versão para compartilhamento)
//
// CONFIGURAÇÃO DA UNIDADE (obrigatória, antes do inicia): os dados próprios da unidade vêm do
// docs/configuracao-unidade.md (seção "## jef-baixa-peticao") e são passados por
//   window.__BP.config({ fases2i: ['<tarefa 1>', '<tarefa 2>', ...],  // alínea 2-i; [] = nenhuma
//                        certidaoNomeacao: '<título>',               // alínea 2-j; '' = não se aplica
//                        certidaoIntimacaoPericia: '<título>' })     // alínea 2-k; '' = não se aplica
// Sem isso, BP.inicia() não roda e devolve o que falta configurar.
//
// Carregado na página estática do próprio PJe, que não redireciona:
// https://pje1g.trf5.jus.br/pje/js/pdfjs/web/locale/locale.json
// A consulta e os autos abrem num iframe oculto, no mesmo domínio (modelo: jef-expediente-manifestacao).
//
// SÓ LÊ, salvo BP.marca(): abre cada processo (consulta -> autos), lê cada documento NÃO LIDO da cronologia
// e, quando a regra pede, o contexto (a sentença recorrida; a certidão de nomeação ou a certidão do local da perícia,
// posterior). Quem classifica é o Claude, pelas regras do SKILL.md; a "SUG" de cada documento é só uma sugestão.
// BP.marca(num, nl) é a ÚNICA gravação: clica em MARCAR TODOS COMO LIDOS. Chame-a só depois de gravada a
// classificação do processo no arquivo de andamento, um processo por vez.
//
// Uso (cada linha é uma chamada do javascript_tool, sem trocar a página de cima):
//   window.__BP.config({ ... })   -> dados da unidade (acima); devolve o resumo do que ficou configurado
//   window.__BP.inicia(['0000000-00.2026.4.05.0000', ...], base)  -> base = nº do 1º processo - 1
//   window.__BP.estado()          -> feitos/total, rodando ou parado, motivo, tempo
//   window.__BP.mostra(a, b)      -> põe os resumos dos processos nº a..b num <pre id="__out">;
//                                    leia com get_page_text (o javascript_tool corta em ~1.200 caracteres)
//   window.__BP.para()            -> interrompe depois do processo em curso
//   await window.__BP.marca(num, nl) -> MARCAR TODOS COMO LIDOS e confere que o aviso sumiu (nl = o do resumo;
//                                    se o número de não lidos mudou desde a leitura, não marca)
//
// Resumo de cada processo (no <pre>):
//   #<nº> === <processo> [SIGILOSO] nl=<aviso> destacados=<itens não lidos na cronologia> docs=<na cronologia>/<no processo> [rever: ...]
//   TAREFA: <fase atual, quando o cabeçalho dos autos a mostra>
//   <data> <id> <título> SUG:<1a..1n | 2a..2n | 3> {marcas} (origem) : trecho   -> cada documento não lido, do mais recente
//   <data> <id> <título> [evento do sistema: ignorar]                          -> intimação, certidão, decurso etc.
//   X|<processo>|<motivo>                                                      -> não analisado
(() => {
  const BP = (window.__BP = window.__BP || {});
  BP.versao = 2; // v2: cópia compartilhada — fases e certidões da unidade por BP.config()

  // Configuração da unidade. Padrão vazio: nada é presumido.
  BP.cfg = BP.cfg || {};
  BP.config = function (o) {
    Object.assign(BP.cfg, o || {});
    const c = BP.cfg;
    return 'config: fases2i=' + (Array.isArray(c.fases2i) ? c.fases2i.length + ' (' + c.fases2i.join(' | ') + ')' : 'NÃO CONFIGURADO')
      + ' ; certidaoNomeacao=' + (typeof c.certidaoNomeacao === 'string' ? (c.certidaoNomeacao || 'não se aplica') : 'NÃO CONFIGURADO')
      + ' ; certidaoIntimacaoPericia=' + (typeof c.certidaoIntimacaoPericia === 'string' ? (c.certidaoIntimacaoPericia || 'não se aplica') : 'NÃO CONFIGURADO');
  };
  const faltaConfig = () => {
    const c = BP.cfg, f = [];
    if (!Array.isArray(c.fases2i)) f.push('fases2i');
    if (typeof c.certidaoNomeacao !== 'string') f.push('certidaoNomeacao');
    if (typeof c.certidaoIntimacaoPericia !== 'string') f.push('certidaoIntimacaoPericia');
    return f;
  };
  // Texto configurado -> expressão sem distinção de maiúsculas, acentos e espaços (ex.: "Certidão" casa "Certidao").
  const rxTexto = (s) => String(s).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')
    .replace(/[aáàâã]/gi, '[aáàâã]').replace(/[eéê]/gi, '[eéê]').replace(/[ií]/gi, '[ií]').replace(/[oóôõ]/gi, '[oóôõ]')
    .replace(/[uúü]/gi, '[uúü]').replace(/[cç]/gi, '[cç]');
  const reCfg = (s, pre) => (s ? new RegExp((pre || '') + rxTexto(s), 'i') : null);
  const normTxt = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

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
  BP.leDoc = async function (id, maxPag) {
    try {
      const r = await fetch('/pje/seam/resource/rest/pje-legacy/documento/download/' + id, { credentials: 'include' });
      if (r.status === 429) { BP.bloqueio = true; return { ct: 'err', text: 'HTTP 429' }; }
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
    let f = document.getElementById('__bpQ');
    if (!f) {
      f = document.createElement('iframe');
      f.id = '__bpQ';
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

  BP.abre = async function (num) {
    const f = quadro();
    const m = num.match(/^(\d{7})-(\d{2})\.(\d{4})\.\d\.\d{2}\.(\d{4})$/);
    if (!m) return { erro: 'número em formato inválido' };
    await carrega(f, '/pje/Processo/ConsultaProcesso/listView.seam');
    const campo = await espera(() => { const d = docQ(f); return d && d.getElementById('fPP:numeroProcesso:numeroSequencial'); }, 20000);
    if (!campo) {
      const d = docQ(f);
      if (d && /429|temporariamente bloqueado/i.test(d.body.innerText)) { BP.bloqueio = true; return { erro: '429' }; }
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
    // A linha do resultado da consulta pode trazer a tarefa atual (fase) do processo.
    const linha = (link.closest('tr') || {}).textContent || '';
    f.contentWindow.open = (u) => { f.contentWindow.location.assign(u); return f.contentWindow; };
    link.click();
    const autos = await espera(() => { const dd = docQ(f); return dd && dd.title.includes(num) && dd.getElementById('divTimeLine') ? dd : null; }, 45000);
    if (!autos) return docQ(f) ? { erro: 'os autos não abriram' } : { login: true };
    await sleep(1200);
    return { d: docQ(f), linha: linha.replace(/\s+/g, ' ').trim() };
  };

  // Cronologia (decrescente: índice menor = mais recente). nl = item destacado como não lido.
  BP.cron = function (d) {
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
  BP.naoLidos = (d) => { const m = d.body.innerText.match(/H[áa] (\d+) documentos?(\(s\))? n[ãa]o lido/i); return m ? +m[1] : 0; };

  const trecho = (t, re, n) => { const k = t.search(re); return k < 0 ? t.slice(0, n) : t.slice(Math.max(0, k - 40), Math.max(0, k - 40) + n); };
  // PDF com fonte sem mapeamento de texto: sai em símbolos ("! " # $ %"). Ler pela tela.
  const ilegivel = (t) => t.length > 40 && (t.match(/[A-Za-zÀ-ú]/g) || []).length / t.length < 0.35;

  // Origem do documento pelo teor (a cronologia não mostra quem juntou).
  const INSS_FORTE = /PROCURADORIA[- ]GERAL FEDERAL|ADVOCACIA[- ]GERAL DA UNI|Demandas Judiciais do INSS|CEAB|APSDJ|AADJ|Equipe de C[áa]lculo|ECALC|CALPREV|PROCURADORIA FEDERAL|Procurador(a)? Federal/i;
  const ADVOGADO = /por (seu|sua|interm[ée]dio de) (seus? |suas? )?(advogad|procurador(a)? (que|abaixo|ao final|infra|constitu))|advogad[oa]s? (abaixo|ao final|infra|subscrit)|\bOAB\b|por sua (advogada|procuradora)|procurador(a)? constitu[íi]d|(adiante|ao final|abaixo|in fine) assinad|patrono/i;
  const PERITO = /perit[oa] (m[ée]dic|judicial|do ju[íi]zo|nomead)|assistente social|laudo (m[ée]dico )?pericial|estudo social|auto de constata|CRM\/|CRESS/i;
  // Petição do INSS pela integração da AGU: título "Contestação (P CONTESTAÇÃO 0000000000 EM ...)", anexos "(A ...)".
  const tituloINSS = (tit) => /\((P|A) [A-ZÀ-Ú]/.test(tit) || /^Contesta/i.test(tit);
  const origem = (t, tit) => tituloINSS(tit) || INSS_FORTE.test(t.slice(0, 300)) ? 'INSS'
    : /^Laudo/i.test(tit) && !/\(\d{11}/.test(tit) ? 'perito'
    : ADVOGADO.test(t.slice(0, 3000)) ? 'autor'
    : PERITO.test(t.slice(0, 600)) ? 'perito'
    : INSS_FORTE.test(t) ? 'INSS'
    : /parte autora|requerente/i.test(t) ? 'autor' : '?';

  // Eventos do sistema e atos do juízo: não são petição de parte nem de terceiro (ignorar, só marcar como lido).
  // A certidão de nomeação de perito é a configurada pela unidade (BP.cfg.certidaoNomeacao).
  const ehSistema = (tit) => /^(Intima[çc][ãa]o|Certid[ãa]o de Intima|Decurso|Expedi|Ato Ordinat|Of[íi]cio \(Outros\) \(Of[íi]cio de pagamento|Cita[çc][ãa]o|Notifica|Despacho|Decis[ãa]o|Senten[çc]a|Ac[óo]rd[ãa]o|Pauta|Aviso)/i.test(tit)
    || (!!BP.cfg.certidaoNomeacao && /^Certid[ãa]o/i.test(tit) && reCfg(BP.cfg.certidaoNomeacao).test(tit));

  const PROPOSTA = /PROPOSTA DE ACORDO|prop[õo]e(-se)?,? (o |a celebra[çc][ãa]o de )?acordo|termos do acordo|TERMOS DA PROPOSTA|proposta conciliat/i;
  // Sugestão de Caso e alínea pelo título e pelo teor. A ordem importa: o mais específico primeiro.
  function sugere(t, tit, o) {
    const T = tit + ' ' + t.slice(0, 2500);
    const m = [];
    if (/\(A [A-ZÀ-Ú]/.test(tit) && /DOSSI|PROCESSO ADMINISTRATIVO|LAUDO M[ÉE]DICO|ANEXO/i.test(tit)) return { s: '2c', m: ['ANEXO-INSS'] };
    if (o === 'perito' || /^Laudo/i.test(tit) && !/\(\d{11}/.test(tit)) {
      const pede = /(solicit|requer|necessit|aguard|pend[êe]ncia|apresent)\w*.{0,80}(exames?|documentos? m[ée]dic|resson[âa]ncia|tomografia|radiografia|raio|ultrass|eletro)|localiza[çc][ãa]o (do|da) (im[óo]vel|resid)|ponto de refer[êe]ncia|endere[çc]o (n[ãa]o|insuficiente|incompleto)|n[ãa]o (foi )?(localizad|encontrad)/i.test(t);
      return { s: pede ? '1i' : '1n', m: ['LAUDO-PERITO'] };
    }
    if (/^Embargos de Declara|EMBARGOS DE DECLARA[ÇC][ÃA]O/i.test(tit) || /opor,? EMBARGOS DE DECLARA|op[õo]e EMBARGOS DE DECLARA|EMBARGOS DE DECLARA[ÇC][ÃA]O/.test(t.slice(0, 1500))) return { s: '1c', m };
    if (/^Contrarraz|CONTRARRAZ[ÕO]ES|CONTRARRAZOAR/i.test(T)) return { s: '1l', m };
    if (/^Recurso|RECURSO INOMINADO|interpor,? RECURSO/i.test(T)) return { s: 'RECURSO', m: ['RECURSO-' + o.toUpperCase()] };
    // A frase "poderá ... apresentar proposta de acordo ou defesa de mérito" é promessa da contestação, não proposta.
    if (o === 'INSS' && (PROPOSTA.test(t.replace(/(poder[áa]|poderia|dever[áa]|pode)[^.]{0,160}apresentar,? (a )?proposta de acordo[^.]{0,80}\./gi, '')) || /proposta|acordo/i.test(tit))) return { s: '1k', m };
    // Manifestação da parte autora sobre a proposta (aceite ou recusa): também 1-k, com a resposta no tipo.
    // Só a resposta a uma proposta já feita; pedir que o INSS faça proposta não é isso.
    if (o !== 'INSS' && /(proposta de acordo|proposta|acordo) (apresentad|formulad|ofertad|lan[çc]ad|feit)\w* pel[oa]|proposta de acordo.{0,30}\bID\b|aceit\w*.{0,60}proposta|proposta.{0,60}\baceit|contraproposta|concord\w*.{0,30}proposta/i.test(T)) {
      const rec = /n[ãa]o aceit|recus|discord|rejeit|contraproposta/i.test(T);
      return { s: '1k', m: [rec ? 'RECUSA-AUTOR' : /aceit|concord|anu[êe]ncia|de acordo com a proposta/i.test(T) ? 'ACEITE-AUTOR' : 'RESPOSTA-AUTOR?'] };
    }
    // Manifestação da parte autora sobre o laudo pericial: Caso 2-m.
    if (o !== 'INSS' && /manifesta\w*.{0,40}(sobre|acerca|ao|quanto ao) (o )?laudo|impugna\w*.{0,20}(ao )?laudo|laudo pericial (de )?ID/i.test(T)) return { s: '2m', m: ['MANIFESTAÇÃO-LAUDO'] };
    if (/desist[êe]ncia (da|de|desta) a[çc][ãa]o|requer\w* a desist[êe]ncia|homologa[çc][ãa]o d[ao] desist/i.test(T)) return { s: '1a', m };
    if (/Tema 187|dispensa\w* (da |de )?per[íi]cia social/i.test(T)) return { s: '2l', m };
    if (/dispensa\w* (da |de )?(realiza[çc][ãa]o (da |de )?)?per[íi]cia(?! social)|desnecessidade (da |de )?per[íi]cia/i.test(T)) return { s: '1b', m };
    if (/reconsidera[çc][ãa]o/i.test(T)) return { s: '1e', m };
    if (/certid[ãa]o de atua[çc][ãa]o|expedi[çc][ãa]o de certid[ãa]o|emiss[ãa]o de certid[ãa]o|requer\w* certid[ãa]o/i.test(T)) return { s: '1m', m };
    if (/(cancelamento|adiamento|redesigna[çc][ãa]o|remarca[çc][ãa]o|retirada de pauta)\w*.{0,60}audi[êe]ncia|audi[êe]ncia.{0,80}(remot|on-?line|virtual|videoconfer[êe]ncia|telepresencial)|participa[çc][ãa]o (remota|virtual|on-?line)/i.test(T)) return { s: '1j', m };
    if (/descumpri|n[ãa]o (foi )?(implantad|cumprid)|ainda n[ãa]o (implant|cumpr)|aus[êe]ncia de (implanta|cumprimento)|n[ãa]o cumpriu/i.test(T) && o !== 'INSS') return { s: '1f', m };
    if (/n[ãa]o (compareceu|compareceram|p[ôo]de comparecer|conseguiu comparecer)|aus[êe]ncia (à|a|na) per[íi]cia|justific\w* (a )?aus[êe]ncia/i.test(T)) return { s: '1g', m: ['NOVA-DATA?'] };
    if (/(adiamento|redesigna[çc][ãa]o|remarca[çc][ãa]o|nova data)\w*.{0,60}per[íi]cia|per[íi]cia.{0,60}(adiamento|redesigna|remarca|nova data)/i.test(T)) return { s: '1h', m: ['NOVA-DATA?'] };
    if (/local (da|de) (realiza[çc][ãa]o (da|de) )?per[íi]cia|endere[çc]o (da|de) (realiza[çc][ãa]o (da|de) )?per[íi]cia/i.test(T)) return { s: '3', m: ['LOCAL-PERÍCIA'] };
    if (/^Contesta|^R[ée]plica|^Impugna[çc][ãa]o (à|a) contesta|MANIFESTA[ÇC][ÃA]O [ÀA] CONTESTA|apresentar,? CONTESTA|IMPUGNA[ÇC][ÃA]O [ÀA] CONTESTA|R[ÉE]PLICA/i.test(T)) return { s: '2i?', m: ['CONTESTAÇÃO/RÉPLICA'] };
    if (/quesitos/i.test(T) && t.length < 8000) return { s: '2e', m };
    if (/destaque (dos |de )?honor/i.test(T)) return { s: '2h', m };
    if (/contrato de (presta[çc][ãa]o de servi[çc]os|honor)/i.test(T)) return { s: '2g', m };
    if (/^Ci[êe]ncia|\bciente\b|tomar ci[êe]ncia|manifestar ci[êe]ncia/i.test(T) && t.length < 3000) return { s: '2b', m };
    if (/andamento|impulso|celeridade|prosseguimento do feito|pronto julgamento/i.test(T) && t.length < 4000) return { s: '2f', m };
    if (/processo administrativo|dossi[êe]/i.test(tit)) return { s: '2c', m };
    if (o === 'INSS' && /requer\w* a juntada dos documentos administrativos em anexo/i.test(T) && t.length < 1500) return { s: '2n', m };
    if (/^(Documento|Outros Documentos|Procura|Documento de Identifica|Documento de Comprova)/i.test(tit) || /requer\w* a juntada|juntar aos autos|junta(r)?,? (os |o )?(documento|exame|laudo|procura)/i.test(T)) return { s: o === 'INSS' ? '3' : '2a', m };
    return { s: '3', m };
  }

  // Dispositivo da sentença: procedente (total ou em parte) ou improcedente. Para o Caso 1-d x 2-d.
  function resultadoSentenca(t) {
    const base = Math.floor(t.length * 0.4);
    const k = t.slice(base).search(/\bjulg(o|ou|a-se)\b|HOMOLOGO|ISSO POSTO|ISTO POSTO|ANTE O EXPOSTO|DISPOSITIVO/i);
    const disp = k >= 0 ? t.slice(base + k, base + k + 1500) : t.slice(-1500);
    if (/HOMOLOG/i.test(disp) && /ACORDO|DESIST/i.test(disp)) return 'HOMOLOGATÓRIA';
    if (/parcialmente procedente|procedentes?,? em parte|PARCIALMENTE PROCEDENTE/i.test(disp)) return 'PARCIALMENTE PROCEDENTE';
    if (/IMPROCEDENTE/i.test(disp)) return 'IMPROCEDENTE';
    if (/PROCEDENTE/i.test(disp)) return 'PROCEDENTE';
    if (/extin\w*.{0,80}sem resolu[çc][ãa]o/i.test(disp)) return 'EXTINÇÃO SEM MÉRITO';
    return '?';
  }

  BP.analisa = async function (num) {
    const ab = await BP.abre(num);
    if (ab.login) return { login: true };
    // "Consulta sem resultado" (diferente de "não encontrado") costuma ser passageiro: tenta de novo.
    if (ab.erro || ab.naoAchou) return { txt: 'X|' + num + '|' + (ab.erro || ab.motivo), erro: !!ab.erro || /não devolveu/.test(ab.motivo || '') };
    const d = ab.d;
    const docs = BP.cron(d);
    const sc = [...d.querySelectorAll('script')].map((s) => s.textContent).join('\n').match(/listaIdsDocumentos\s*=\s*\[([^\]]*)\]/);
    const total = sc ? sc[1].split(',').filter((s) => /\d/.test(s)).length : docs.length;
    // Cabeçalho dos autos: os detalhes ficam num menu oculto (innerText vem vazio; usar textContent).
    const det = ((d.getElementById('maisDetalhes') || {}).textContent || '').replace(/\s+/g, ' ').trim();
    // "Segredo de justiça? SIM/NÃO": o "?" é o ícone de ajuda do rótulo. Pelo texto visível, o sigilo não aparece.
    const sig = /Segredo de justi[çc]a\W*SIM/i.test(det) ? ' SIGILOSO' : '';
    const nl = BP.naoLidos(d);
    // Fase atual (tarefa): só aparece pelo menu "Exibir tarefa atual do processo" (janela que só exibe, não grava).
    // Lida só quando a alínea 2-i depende dela (contestação, réplica ou impugnação à contestação não lida).
    let tarefa = '?';
    // O nome da tarefa é achado pelo prefixo das tarefas configuradas no 2-i: o "[XXX]" do início ou,
    // sem colchetes, o texto antes do primeiro " - ".
    const prefixo = () => {
      const f0 = String((BP.cfg.fases2i || [])[0] || '').trim();
      const b = f0.match(/^\[[^\]]+\]/);
      return b ? b[0] : f0.split(' - ')[0];
    };
    const lerTarefa = async () => {
      const lk = d.getElementById('navbar:linkExibirTarefaAtualProcesso');
      if (!lk) return '?';
      const pf = prefixo();
      if (!pf) return '?';
      const re = new RegExp(pf.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[^\\[\\]{}<>;=?&/]{3,60}');
      lk.click();
      const v = await espera(() => { const m = d.body.textContent.replace(/\s+/g, ' ').match(re); return m ? m[0].trim() : null; }, 10000);
      return v || '?';
    };

    const out = [], rever = [];
    const nls = docs.filter((x) => x.nl);
    if (!nl && !nls.length) rever.push('sem documento não lido (anomalia a confirmar)');
    if (nl && nl !== nls.length) rever.push('aviso diz ' + nl + ', cronologia destaca ' + nls.length + (total > docs.length ? ' (cronologia carregou ' + docs.length + ' de ' + total + ' documentos)' : ''));
    for (const x of nls) {
      const i = docs.indexOf(x);
      if (ehSistema(x.titulo)) { out.push(x.data + ' ' + x.id + ' ' + x.titulo.slice(0, 55) + ' [evento do sistema ou ato do juízo: ignorar]'); continue; }
      const r = await BP.leDoc(x.id, 5);
      if (BP.bloqueio) return { bloqueio: true };
      if (r.ct === 'login') return { login: true };
      if ((r.ct === 'pdf' && !r.text) || ilegivel(r.text) || r.ct === 'err') {
        out.push(x.data + ' ' + x.id + ' ' + x.titulo.slice(0, 55) + ' SUG:? ILEGÍVEL' + (r.ct === 'err' ? ' (' + r.text + ')' : '') + ' — ler na tela');
        rever.push('documento ilegível: ' + x.id);
        continue;
      }
      const o = origem(r.text, x.titulo);
      let { s, m } = sugere(r.text, x.titulo, o);
      const extra = [];
      // Recurso: 1-d só se for da parte autora contra sentença de improcedência; o resto é 2-d.
      if (s === 'RECURSO') {
        const sent = docs.slice(i + 1).find((y) => /^Senten[çc]a/i.test(y.titulo));
        let res = '?';
        if (sent) {
          const rs = await BP.leDoc(sent.id, 12);
          if (BP.bloqueio) return { bloqueio: true };
          res = resultadoSentenca(rs.text || '');
          extra.push('sentença ' + sent.id + ' de ' + sent.data + ': ' + res);
        } else extra.push('sentença não localizada na cronologia carregada');
        s = res === 'IMPROCEDENTE' && o !== 'INSS' ? '1d' : /PROCEDENTE/.test(res) && res !== 'IMPROCEDENTE' ? '2d' : '1d?';
      }
      // Pedido de nova data de perícia (2-j) ou de local da perícia (2-k): certidão posterior já resolveu?
      // Certidões configuradas pela unidade (BP.cfg): '' = a alínea não se aplica na unidade.
      if (m.includes('NOVA-DATA?') && o === 'autor') {
        const reNom = reCfg(BP.cfg.certidaoNomeacao);
        const cert = reNom ? docs.slice(0, i).find((y) => reNom.test(y.titulo)) : null;
        extra.push(!reNom ? 'certidão de nomeação não configurada (2-j não se aplica na unidade)'
          : cert ? 'certidão de nomeação posterior: ' + cert.id + ' de ' + cert.data + ' -> 2j?' : 'sem certidão de nomeação posterior');
        if (cert && /m[ée]dic\w* (n[ãa]o|faltou)|perit\w* (n[ãa]o|faltou)|n[ãa]o (houve|realizou|foi realizada) (a )?per[íi]cia|nova data/i.test(r.text)) s = '2j?';
      }
      if (m.includes('LOCAL-PERÍCIA') && o === 'autor') {
        const reInt = reCfg(BP.cfg.certidaoIntimacaoPericia);
        const nomeInt = '"' + (BP.cfg.certidaoIntimacaoPericia || '') + '"';
        let achou = null;
        if (reInt) {
          for (const y of docs.slice(0, i).filter((z) => /^(Certid|Intima)/i.test(z.titulo)).slice(0, 4)) {
            const ry = await BP.leDoc(y.id, 2);
            if (BP.bloqueio) return { bloqueio: true };
            if (reInt.test(ry.text) && /endere[çc]o|local|rua|avenida/i.test(ry.text)) { achou = y; break; }
          }
        }
        extra.push(!reInt ? 'certidão do local da perícia não configurada (2-k não se aplica na unidade)'
          : achou ? 'certidão ' + nomeInt + ' posterior com endereço: ' + achou.id + ' de ' + achou.data + ' -> 2k?' : 'sem certidão ' + nomeInt + ' posterior');
        if (achou) s = '2k?';
      }
      // 2-i só nas fases configuradas pela unidade (BP.cfg.fases2i); fora delas, a contestação/réplica segue as regras gerais.
      if (s === '2i?') {
        if (!BP.cfg.fases2i.length) extra.push('nenhuma fase do 2-i configurada: regras gerais');
        else {
          if (tarefa === '?') tarefa = await lerTarefa();
          if (tarefa !== '?' && BP.cfg.fases2i.some((f) => normTxt(f) === normTxt(tarefa))) s = '2i';
          else extra.push(tarefa === '?' ? 'fase não lida: conferir na tela (2-i só nas fases configuradas)' : 'fase ' + tarefa + ': fora das fases do 2-i, regras gerais');
        }
      }
      out.push(x.data + ' ' + x.id + ' ' + x.titulo.slice(0, 55) + ' SUG:' + s + (m.length ? ' {' + m.join(' ') + '}' : '') + ' (' + o + ')'
        + (extra.length ? ' [' + extra.join('; ') + ']' : '') + ': ' + trecho(r.text, /requer|vem |informa|desist|dispensa|embargos|recurso|reconsidera|descumpr|compar|adiamento|redesigna|exame|localiza|audi[êe]ncia|acordo|contrarraz|certid|ci[êe]ncia|andamento|quesito|destaque|honor|juntada/i, 280));
    }
    const cab = '=== ' + num + sig + ' nl=' + nl + ' destacados=' + nls.length + ' docs=' + docs.length + '/' + total + (rever.length ? ' rever: ' + rever.join(', ') : '');
    return { txt: [cab, 'TAREFA: ' + tarefa, ...out].join('\n'), nl };
  };

  // Conferência de um documento avulso (só leitura): a sugestão que o script daria a ele.
  BP.testa = async function (id, titulo) {
    const r = await BP.leDoc(id, 5);
    if (!r.text || ilegivel(r.text)) return id + ' ilegível';
    const o = origem(r.text, titulo);
    const { s, m } = sugere(r.text, titulo, o);
    return id + ' SUG:' + s + (m.length ? ' {' + m.join(' ') + '}' : '') + ' (' + o + ')';
  };

  BP.inicia = function (lista, base) {
    if (BP.st && BP.st.rodando) return 'já está rodando';
    const falta = faltaConfig();
    if (falta.length) return 'configure ' + falta.join(', ') + ' com window.__BP.config({...}) antes de iniciar (dados de docs/configuracao-unidade.md)';
    BP.bloqueio = false;
    const st = (BP.st = { lista, base: base || 0, idx: 0, res: [], rodando: true, parada: '', t0: Date.now() });
    (async () => {
      while (st.idx < st.lista.length && !st.pedirParada) {
        const num = st.lista[st.idx].trim();
        let r;
        for (let t = 0; t < 2; t++) {
          try { r = await BP.analisa(num); } catch (e) { r = { txt: 'X|' + num + '|erro na leitura: ' + String(e).slice(0, 80), erro: true }; }
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

  BP.estado = () => {
    const st = BP.st;
    if (!st) return 'sem execução';
    const sem = st.res.filter((r) => !r.nl && !/^X\|/.test(r.txt)).map((r) => r.n).join(',');
    return (st.base + st.idx) + ' (' + st.idx + '/' + st.lista.length + ') ' + (st.rodando ? 'rodando' : 'parado') + (st.parada ? ' — ' + st.parada : '')
      + ' — ' + Math.round((Date.now() - st.t0) / 1000) + 's' + (sem ? ' — sem aviso de não lido: ' + sem : '');
  };

  // Texto grande vai para um <pre> da página e é lido com get_page_text.
  const pre = () => {
    let p = document.getElementById('__out');
    if (!p) { p = document.createElement('pre'); p.id = '__out'; p.style.whiteSpace = 'pre-wrap'; document.body.appendChild(p); }
    // Tira o texto original da página (o JSON do locale), sem apagar o iframe do lote nem o campo de carga.
    [...document.body.childNodes].forEach((n) => { if (n !== p && !/^__(\w+Q|carga)$/.test(n.id || '')) n.remove?.(); });
    return p;
  };
  BP.mostra = function (a, b) {
    const rs = (BP.st ? BP.st.res : []).filter((r) => r.n >= a && r.n <= b);
    pre().textContent = rs.map((r) => '#' + r.n + ' ' + r.txt).join('\n\n');
    return rs.length + ' processos no quadro';
  };

  BP.para = function () { if (BP.st) BP.st.pedirParada = true; return 'vai parar após o processo em curso'; };

  // ÚNICA GRAVAÇÃO: MARCAR TODOS COMO LIDOS. Só depois da classificação gravada, um processo por vez.
  // nlLido = o nl do resumo: se o número mudou, chegou documento depois da leitura, que ninguém leu — não marca.
  BP.marca = async function (num, nlLido) {
    const ab = await BP.abre(num);
    if (ab.login) return num + ' LOGIN';
    if (!ab.d) return num + ' NÃO ABRIU — não marcado';
    const d = ab.d, antes = BP.naoLidos(d);
    if (!antes) return num + ' sem documento não lido — nada a marcar';
    if (nlLido !== undefined && antes !== nlLido) return num + ' NÃO MARCADO: eram ' + nlLido + ' não lidos na leitura e agora são ' + antes + ' — reanalisar';
    const bt = [...d.querySelectorAll('input,button,a')].find((e) => /marcar todos como lidos/i.test(e.value || e.textContent || ''));
    if (!bt) return num + ' botão MARCAR TODOS COMO LIDOS não encontrado (' + antes + ' não lidos)';
    bt.click();
    const ok = await espera(() => { const dd = docQ(quadro()); return dd && dd.getElementById('divTimeLine') && !BP.naoLidos(dd); }, 20000);
    return num + (ok ? ' MTL OK (' + antes + ' não lidos; aviso sumiu)' : ' MTL FALHOU — o aviso continua');
  };

  return 'BP v' + BP.versao + ' carregado (' + document.visibilityState + ')';
})();
