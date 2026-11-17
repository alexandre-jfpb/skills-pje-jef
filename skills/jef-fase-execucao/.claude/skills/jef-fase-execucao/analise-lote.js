// analise-lote.js — jef-fase-execucao (desenvolvido na 7ª Vara Federal da Paraíba; PJe 1º grau do TRF5)
//
// Injetado pelo javascript_tool do Chrome numa página estática do próprio PJe, que não
// redireciona: https://pje1g.trf5.jus.br/pje/js/pdfjs/web/locale/locale.json
// A consulta e os autos abrem num iframe oculto, no mesmo domínio (modelo: jef-devolvidos-tr).
//
// SÓ LÊ, salvo FX.marca(): abre cada processo (consulta -> autos), lê a cronologia, a sentença
// (e o que a acompanha: planilha, acordo, proposta do INSS, ata de audiência), o acórdão posterior,
// se houver, e os documentos juntados depois da sentença, e monta um resumo por processo. Quem
// classifica é o Claude, pelas regras do SKILL.md; a "PROP" do resumo é só uma sugestão.
// Não usa dado da unidade: as etiquetas, fases e assessores (docs/configuracao-unidade.md) são aplicados
// pelo Claude ao gravar a classificação; o script só sugere o código da situação. Não há config a passar.
// FX.marca(num, nl) é a ÚNICA gravação: clica em MARCAR TODOS COMO LIDOS. Chame-a só depois de
// gravada a classificação do processo no arquivo de andamento, um processo por vez.
//
// Uso (cada linha é uma chamada do javascript_tool, sem trocar a página de cima):
//   window.__FX.inicia(['0000000-00.2026.4.05.0000', ...], base)  -> base = nº do 1º processo - 1
//   window.__FX.estado()          -> feitos/total, rodando ou parado, motivo, tempo
//   window.__FX.mostra(a, b)      -> põe os resumos dos processos nº a..b num <pre id="__out">;
//                                    leia com get_page_text (o javascript_tool corta em ~1.200 caracteres)
//   window.__FX.para()            -> interrompe depois do processo em curso
//   await window.__FX.marca(num, nl) -> MARCAR TODOS COMO LIDOS e confere que o aviso sumiu (nl = o do resumo;
//                                    se o número de não lidos mudou desde a leitura, não marca)
//
// Resumo de cada processo (no <pre>):
//   #<nº> === <processo> [SIGILOSO] nl=<não lidos> docs=<na cronologia>/<no processo> PROP:<sugestão> [rever: ...]
//        sugestões: R TUT P AS AV E f ARQ(b|g|h) AVISO NC CEAB (sem comprovante nem documento posterior: fora do relatório)
//   ASSUNTO: <assunto principal>
//   [SENT <data> <id>] TIPO=<P|PP|I|HOM|E|EMB|?> <marcas> | DISP: <dispositivo>
//        marcas: TUTELA, ATRASADOS, SEM-ATRASADOS, AVERBAÇÃO, DIB=DIP, PLANILHA-CITADA
//   [ANEXO <id> PLANILHA-ATRASADOS|PLANILHA-TEMPO|?] ...       -> documentos juntados com a sentença
//   [ACORDO <id> <título>] VALOR: R$ ... | SEM-ATRASADOS | ...  -> proposta do INSS / ata de audiência
//   [AC <data> <id>] RES=<NEGA|DA|PARCIAL|ANULA|DILIG|?> | FIM: ...  -> acórdão posterior à sentença
//   <data> <id> <título> [NL] {marcas} (origem) : trecho          -> documentos posteriores à sentença, do mais recente
//        marcas: COMPROVANTE(autor:confere|NÃO CONFERE|?), CÁLCULO, CONCORDA, DISCORDA, IMPUGNA, CIÊNCIA,
//                DESTAQUE, CONTRATO, ANDAMENTO, RECURSO, DESCUMPRIMENTO
//   X|<processo>|<motivo>                                         -> não analisado
(() => {
  const FX = (window.__FX = window.__FX || {});
  FX.versao = 1;

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
  FX.leDoc = async function (id, maxPag) {
    try {
      const r = await fetch('/pje/seam/resource/rest/pje-legacy/documento/download/' + id, { credentials: 'include' });
      if (r.status === 429) { FX.bloqueio = true; return { ct: 'err', text: 'HTTP 429' }; }
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
    let f = document.getElementById('__fxQ');
    if (!f) {
      f = document.createElement('iframe');
      f.id = '__fxQ';
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

  FX.abre = async function (num) {
    const f = quadro();
    const m = num.match(/^(\d{7})-(\d{2})\.(\d{4})\.\d\.\d{2}\.(\d{4})$/);
    if (!m) return { erro: 'número em formato inválido' };
    await carrega(f, '/pje/Processo/ConsultaProcesso/listView.seam');
    const campo = await espera(() => { const d = docQ(f); return d && d.getElementById('fPP:numeroProcesso:numeroSequencial'); }, 20000);
    if (!campo) {
      const d = docQ(f);
      if (d && /429|temporariamente bloqueado/i.test(d.body.innerText)) { FX.bloqueio = true; return { erro: '429' }; }
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
  FX.cron = function (d) {
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
  FX.naoLidos = (d) => { const m = d.body.innerText.match(/H[áa] (\d+) documentos?(\(s\))? n[ãa]o lido/i); return m ? +m[1] : 0; };

  const ultimo = (t, re) => { let k = -1, m; const g = new RegExp(re.source, 'gi'); while ((m = g.exec(t))) k = m.index; return k; };
  const corta = (t, re, n) => { const k = ultimo(t, re); return k < 0 ? null : t.slice(k, k + n); };
  const trecho = (t, re, n) => { const k = t.search(re); return k < 0 ? t.slice(0, n) : t.slice(Math.max(0, k - 40), Math.max(0, k - 40) + n); };
  const so = (s) => (s || '').replace(/\D/g, '');
  const sem = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
  // PDF com fonte sem mapeamento de texto: sai em símbolos ("! " # $ %"). Ler pela tela.
  const ilegivel = (t) => t.length > 40 && (t.match(/[A-Za-zÀ-ú]/g) || []).length / t.length < 0.35;

  // Dispositivo: do primeiro "julgo"/"homologo" do último terço do texto até o fim (ou 2.500 caracteres).
  function dispositivo(t) {
    const base = Math.floor(t.length * 0.4);
    const k = t.slice(base).search(/\bjulg(o|ou|a-se)\b|HOMOLOGO|ISSO POSTO|ISTO POSTO|ANTE O EXPOSTO|Diante desse cen[áa]rio/i);
    return k >= 0 ? t.slice(base + k, base + k + 2500) : t.slice(-2500);
  }
  // Sentença: tipo e marcas (as marcas saem do dispositivo, não da fundamentação).
  function lerSentenca(t) {
    const ini = t.slice(0, 700);
    if (/Embargos (Declarat|de Declara)|embargos de declara[çc][ãa]o opost/i.test(ini)) return { tipo: 'EMB', marcas: [] };
    const marcas = [], disp = dispositivo(t);
    const j = corta(t, /\bjulg(o|ou|a-se)\b/, 260) || '';
    let tipo = '?';
    if (/HOMOLOG/i.test(disp) && /ACORDO/i.test(disp)) tipo = 'HOM';
    else if (/julg\w* (parcialmente procedente|procedentes?,? em parte)/i.test(disp) || /PARCIALMENTE PROCEDENTE|PROCEDENTES?,? EM PARTE|PARCIAL PROCED/i.test(j)) tipo = 'PP';
    else if (/IMPROCEDENTE/i.test(j)) tipo = /condeno o INSS|condenar o INSS|pagamento das parcelas/i.test(disp) ? 'PP' : 'I';
    else if (/PROCEDENTE/i.test(j)) tipo = 'P';
    else if (/extin\w*.{0,80}sem resolu[çc][ãa]o/i.test(t.slice(-3000))) tipo = 'E';
    else if (/condeno o INSS|ESP[ÉE]CIE DE BENEF/i.test(t)) tipo = 'P';
    if (/(antecip|defir|conced)\w*.{0,60}tutela|tutela (de urg[êe]ncia|antecipada|provis[óo]ria).{0,80}(defir|conced|determin)/i.test(t)) marcas.push('TUTELA');
    if (/sem (o )?pagamento de (parcelas )?atrasad|sem (parcelas vencidas|atrasados)|n[ãa]o h[áa] (parcelas vencidas|atrasados)|complemento positivo/i.test(disp)) marcas.push('SEM-ATRASADOS');
    if (/parcelas (vencidas|em atraso|pret[ée]ritas)|atrasad|pagamento das parcelas|diferen[çc]as/i.test(disp.replace(/sem (o )?pagamento de (parcelas )?atrasad\w*|sem (parcelas vencidas|atrasados)/gi, ''))) marcas.push('ATRASADOS');
    if (/averb/i.test(disp)) marcas.push('AVERBAÇÃO');
    const dib = (disp.match(/\bDIB\b[^\d]{0,20}(\d{2}[./]\d{2}[./]\d{4})/) || [])[1], dip = (disp.match(/\bDIP\b\s*:?\s*(\d{2}[./]\d{2}[./]\d{4})/) || [])[1];
    if (dib && dip && so(dib) === so(dip)) marcas.push('DIB=DIP');
    if (/nos termos da planilha|planilha (em )?anexa|planilha anexo|c[áa]lculos? (em )?anexo/i.test(t)) marcas.push('PLANILHA-CITADA');
    return { tipo, marcas };
  }
  const dispDe = (t) => dispositivo(t).slice(0, 800);
  const resAc = (t) => /ANUL(AR|A-SE|OU|ADA|AÇÃO)/i.test(t) ? 'ANULA'
    : /CONVERT\w* (O JULGAMENTO )?EM DILIG[ÊE]NCIA|BAIXA EM DILIG[ÊE]NCIA/i.test(t) ? 'DILIG'
    : /(DAR|DEU|D[ÁA]-SE|DANDO) PARCIAL PROVIMENTO|PROVIMENTO PARCIAL|PARCIALMENTE PROVID/i.test(t) ? 'PARCIAL'
    : /NEGA(R|DO|NDO|-SE)? (A )?PROVIMENTO|NEGOU PROVIMENTO|DESPROVID|N[ÃA]O PROVID|IMPROVID/i.test(t) ? 'NEGA'
    : /(DAR|DEU|D[ÁA]-SE|DANDO) PROVIMENTO|\bPROVID[OA]/i.test(t) ? 'DA' : '?';

  // Origem do documento pelo teor (a cronologia não mostra quem juntou). As petições do autor costumam
  // citar a CEAB e o INSS; por isso as marcas fortes do INSS valem só no início, e as do advogado vêm antes das fracas.
  const INSS_FORTE = /PROCURADORIA[- ]GERAL FEDERAL|ADVOCACIA[- ]GERAL DA UNI|Demandas Judiciais do INSS|CEAB|APSDJ|AADJ|INFBEN|CONBAS|COMUNICADO DE CUMPRIMENTO|DECIS[ÃA]O CUMPRIDA|Apresentamos a comprova|Equipe de C[áa]lculo|ECALC|CALPREV|Instituto Nacional do Seguro Social NB|Ag[êe]ncia do INSS DJ|Comunicamos o deferimento/i;
  const ADVOGADO = /por (seu|sua|interm[ée]dio de) (seus? |suas? )?(advogad|procurador(a)? (que|abaixo|ao final|infra|constitu))|advogad[oa]s? (abaixo|ao final|infra|subscrit)|\bOAB\b|por sua (advogada|procuradora)|procurador(a)? constitu[íi]d|(adiante|ao final|abaixo|in fine) assinad|patrono/i;
  const origem = (t) => INSS_FORTE.test(t.slice(0, 250)) ? 'INSS'
    : ADVOGADO.test(t.slice(0, 3000)) ? 'autor'
    : INSS_FORTE.test(t) || /PROCURADOR(A)? FEDERAL/i.test(t) ? 'INSS'
    : /parte autora|requerente/i.test(t) ? 'autor' : '?';
  // Marcas de um documento posterior à sentença.
  function marcasDoc(t, autor, tit) {
    const m = [], o = origem(t);
    if (/nada a (ser )?cumprir|n[ãa]o h[áa] (o )?que (ser )?cumprid/i.test(t) && o === 'INSS') m.push('CEAB:NADA-A-CUMPRIR');
    const comp = o !== 'autor' && !/^(Embargos|Recurso|Contrarraz)/i.test(tit)
      && (o === 'INSS' || /Comprova|Comprobat|Informa[çc][õo]es Prestadas|Presta[çc][ãa]o de informa/i.test(tit))
      && /implant|cumprimento (da|de) (obriga|decis|condena|ordem)|realizou o cumprimento|obriga[çc][ãa]o de fazer|INFBEN|CONBAS|revis(ão|ad)\w* (do|o) benef|averba|reativ|restabelec|comunicad\w* de decis|DECIS[ÃA]O CUMPRIDA|majora/i.test(t);
    if (comp) {
      const cpfOk = autor.cpf && so(t).includes(autor.cpf);
      const nomeOk = autor.nome && sem(t).includes(autor.nome);
      m.push('COMPROVANTE(autor:' + (cpfOk || nomeOk ? 'confere' : (autor.cpf || autor.nome) && /CPF|NB|Nome|Benefici/i.test(t) ? 'NÃO CONFERE' : '?') + ')');
    }
    if (/c[áa]lculo de liquida|Parecer T[ée]cnico|CALPREV|ECALC|planilha de c[áa]lculo|demonstrativo de c[áa]lculo|valor devido|mem[óo]ria de c[áa]lculo/i.test(t) && o === 'INSS') m.push('CÁLCULO');
    if (o !== 'INSS') {
      if (/concord\w* (com )?(os |o )?(c[áa]lculo|valor|planilha)|de acordo com (os |o )?(c[áa]lculo|valor)|n[ãa]o se op[õo]e|anu[êe]ncia/i.test(t) && !/n[ãa]o concord|discord/i.test(t)) m.push('CONCORDA');
      if (/discord|n[ãa]o concord|impugna\w*.{0,40}(c[áa]lculo|planilha|valor)/i.test(t)) m.push('DISCORDA');
      if (/impugna\w*.{0,60}(cumprimento|implanta)|implanta\w*.{0,60}(equivocad|incorret|errad)|(RMI|DIB|DCB|DIP).{0,60}(equivocad|incorret|errad|divergen)/i.test(t)) m.push('IMPUGNA');
      if (/descumpr|n[ãa]o (foi )?cumprid|n[ãa]o cumpriu|aus[êe]ncia de (implanta|cumprimento)|ainda n[ãa]o (implant|cumpr)/i.test(t)) m.push('DESCUMPRIMENTO');
      if (/destaque de (os )?honor/i.test(t)) m.push('DESTAQUE');
      if (/contrato de (presta[çc][ãa]o de servi[çc]os|honor)/i.test(t)) m.push('CONTRATO');
      if (/andamento|impulso|prosseguimento/i.test(t) && t.length < 3000) m.push('ANDAMENTO');
      if (/recurso inominado/i.test(t.slice(0, 1500))) m.push('RECURSO');
      if (/ci[êe]ncia/i.test(t) && t.length < 2500) m.push('CIÊNCIA');
    }
    return { m, o };
  }
  const ehSistema = (tit) => /^(Intima[çc][ãa]o|Certid[ãa]o de (Tr[âa]nsito|decurso|intima)|Ato Ordinat|Expedi|Pauta|Decurso|Despacho|Decis[ãa]o|Ac[óo]rd[ãa]o|Relat[óo]rio|Voto|Ementa|Certid[ãa]o \(|Certid[ãa]o$|Senten[çc]a)/i.test(tit);

  const ROTINA = ['CIÊNCIA', 'DESTAQUE', 'CONTRATO', 'ANDAMENTO', 'RECURSO', 'DESCUMPRIMENTO'];
  function sugere(s, ac, post, acordo, anexos) {
    if (!s) return '?';
    const comp = post.find((p) => p.m.some((x) => x.startsWith('COMPROVANTE')));
    if (!comp) {
      if (s.marcas.includes('TUTELA')) return 'TUT?';
      if (post.some((p) => p.ileg)) return '? (documento ilegível depois da sentença)';
      const ult = post[0];
      // Nada juntado depois da sentença/homologação: CEAB a intimar novamente, fora do relatório.
      if (!ult) return 'CEAB? (sem comprovante nem documento depois da sentença — fora do relatório)';
      const r = ult.m.filter((x) => ROTINA.includes(x));
      return r.length ? 'R? (' + r.join(' ') + ')' : 'NC? (sem comprovante; último documento fora da rotina)';
    }
    if (/NÃO CONFERE/.test(comp.m.join())) return 'NC? (comprovante não confere)';
    const depois = post.filter((p) => post.indexOf(p) < post.indexOf(comp));
    if (depois.some((p) => p.m.includes('IMPUGNA'))) return 'AVISO?';
    const calc = () => {
      const c = post.find((p) => p.m.includes('CÁLCULO'));
      if (!c) return 'sem cálculo do INSS';
      const dep = post.filter((p) => post.indexOf(p) < post.indexOf(c));
      if (dep.some((p) => p.m.includes('DISCORDA'))) return 'cálculo ' + c.id + ' + DISCORDA';
      if (dep.some((p) => p.m.includes('CONCORDA'))) return 'cálculo ' + c.id + ' + CONCORDA';
      return 'cálculo ' + c.id + ' sem manifestação';
    };
    if (s.tipo === 'HOM') {
      if (acordo.some((a) => a.ata) && anexos.some((a) => /^PLANILHA-(ATRASADOS|ILEGÍVEL)$/.test(a.tipo))) return 'E?';
      if (acordo.some((a) => a.semAtrasados) || s.marcas.includes('SEM-ATRASADOS')) return 'ARQ(h)?';
      if (acordo.some((a) => a.valor)) return 'AV?';
      return 'AS? — ' + calc();
    }
    if (s.tipo === 'P' || s.tipo === 'PP') {
      if (anexos.some((a) => a.tipo === 'PLANILHA-ATRASADOS')) return 'f (RPV)?';
      if (s.marcas.includes('AVERBAÇÃO') && !s.marcas.includes('ATRASADOS')) return 'ARQ(b)?';
      if (s.marcas.includes('DIB=DIP') || s.marcas.includes('SEM-ATRASADOS')) return 'ARQ(g)?';
      if (!s.marcas.includes('ATRASADOS')) return 'ARQ? (dispositivo sem atrasados) — conferir';
      return 'P? — ' + calc();
    }
    return 'NC? (sentença ' + s.tipo + ')';
  }

  FX.analisa = async function (num) {
    const ab = await FX.abre(num);
    if (ab.login) return { login: true };
    // "Consulta sem resultado" (diferente de "não encontrado") costuma ser passageiro: tenta de novo.
    if (ab.erro || ab.naoAchou) return { txt: 'X|' + num + '|' + (ab.erro || ab.motivo), erro: !!ab.erro || /não devolveu/.test(ab.motivo || '') };
    const d = ab.d;
    const docs = FX.cron(d);
    const sc = [...d.querySelectorAll('script')].map((s) => s.textContent).join('\n').match(/listaIdsDocumentos\s*=\s*\[([^\]]*)\]/);
    const total = sc ? sc[1].split(',').filter((s) => /\d/.test(s)).length : docs.length;
    // Cabeçalho dos autos: os detalhes ficam num menu oculto (innerText vem vazio; usar textContent).
    const txt = (id) => ((d.getElementById(id) || {}).textContent || '').replace(/\s+/g, ' ').trim();
    const det = txt('maisDetalhes');
    // "Segredo de justiça? SIM/NÃO": o "?" é o ícone de ajuda do rótulo. Pelo texto visível, o sigilo não aparece.
    const sig = /Segredo de justi[çc]a\W*SIM/i.test(det) ? ' SIGILOSO' : '';
    const nl = FX.naoLidos(d);
    const assunto = ((det.match(/Assunto\s+(.+?)\s*\(\d+\)/) || [])[1] || '?').trim();
    // Parte autora (só para conferir o comprovante; nome e CPF não saem no resumo).
    const pa = txt('poloAtivo').match(/(?:Polo ativo\s+)?(.+?)\s+-\s+CPF:\s*([\d.\-]+)\s*\((AUTOR|REQUERENTE|EXEQUENTE)/i);
    const autor = { cpf: pa ? so(pa[2]) : '', nome: pa ? sem(pa[1].replace(/^Polo ativo\s+/i, '')).trim() : '' };

    // Sentença de mérito: a mais recente que não julga embargos de declaração.
    const out = [];
    let s = null, pS = docs.length;
    for (const x of docs.filter((y) => /^Senten[çc]a/i.test(y.titulo)).slice(0, 3)) {
      const r = await FX.leDoc(x.id, 10);
      if (FX.bloqueio) return { bloqueio: true };
      if (r.ct === 'login') return { login: true };
      const ls = lerSentenca(r.text);
      out.push('[SENT ' + x.data + ' ' + x.id + (r.ct === 'pdf' && !r.text ? ' DIGITALIZADO' : '') + '] TIPO=' + ls.tipo + ' ' + ls.marcas.join(' ') + ' | DISP: ' + dispDe(r.text));
      if (ls.tipo !== 'EMB') { s = ls; pS = docs.indexOf(x); break; }
    }
    // Documentos juntados com a sentença (mesma data, logo junto dela na cronologia).
    const anexos = [];
    if (s) {
      const sd = docs[pS];
      for (const x of docs.filter((y, i) => Math.abs(i - pS) <= 3 && i !== pS && y.data === sd.data && /planilha|c[áa]lculo|anexo|demonstrativo|contagem|tempo/i.test(y.titulo)).slice(0, 2)) {
        const r = await FX.leDoc(x.id, 3);
        if (FX.bloqueio) return { bloqueio: true };
        const tipo = !r.text || ilegivel(r.text) ? 'ILEGÍVEL'
          : /tempo de contribui|contagem de tempo|tempo total|car[êe]ncia|anos,? \d+ meses/i.test(r.text) && !/atrasad|parcelas|valor devido|total devido/i.test(r.text) ? 'PLANILHA-TEMPO'
          : /atrasad|parcelas|compet[êe]ncia|valor devido|total devido|RPV|juros/i.test(r.text) ? 'PLANILHA-ATRASADOS' : '?';
        anexos.push({ id: x.id, tipo });
        out.push('[ANEXO ' + x.id + ' ' + tipo + '] ' + x.titulo.slice(0, 40) + ': ' + (tipo === 'ILEGÍVEL' ? '' : r.text.slice(0, 200)));
      }
    }
    // Acordo: ata de audiência (com a planilha que a acompanha) e proposta do INSS, antes da sentença homologatória.
    const acordo = [];
    if (s && s.tipo === 'HOM') {
      const perto = docs.filter((y, i) => i > pS && i <= pS + 30 && !/dossi[êe]|procura[çc][ãa]o|laudo|comprovante de resid|documento de identifica/i.test(y.titulo));
      const prio = (y) => /ata|termo de audi/i.test(y.titulo) ? 0 : /proposta|acordo/i.test(y.titulo) ? 1 : /peti[çc][ãa]o|manifesta/i.test(y.titulo) ? 2 : 9;
      const cand = perto.filter((y) => prio(y) < 9).sort((a, b) => prio(a) - prio(b) || docs.indexOf(a) - docs.indexOf(b)).slice(0, 4);
      for (const x of cand) {
        const r = await FX.leDoc(x.id, 4);
        if (FX.bloqueio) return { bloqueio: true };
        const t = r.text;
        // A ata vale pelo título (o PDF dela pode não ter texto legível); proposta e petições, pelo teor.
        const ata = /ata de audi|termo de audi|audi[êe]ncia de concilia/i.test(x.titulo + ' ' + t.slice(0, 500));
        if (!ata && !/proposta|acordo|concilia/i.test(t)) continue;
        const v = t.match(/(COMPOSI[ÇC][ÃA]O DOS ATRASADOS|valor (total )?dos atrasados|montante retroativo|atrasados|retroativ\w*).{0,250}?(R\$\s?[\d.]+,\d{2})/i);
        const a = { id: x.id, ata, semAtrasados: /sem (o )?pagamento de (parcelas )?atrasad|sem atrasados|n[ãa]o haver[áa] pagamento de atrasad/i.test(t), valor: v ? v[3] : '' };
        // Planilha junto da ata (resumo para RPV): documento vizinho, da mesma data.
        if (ata) {
          const ia = docs.indexOf(x);
          for (const y of docs.filter((z, i) => Math.abs(i - ia) <= 2 && i !== ia && z.data === x.data && /planilha|c[áa]lculo|resumo|demonstrativo/i.test(z.titulo)).slice(0, 1)) {
            const ry = await FX.leDoc(y.id, 2);
            if (FX.bloqueio) return { bloqueio: true };
            const tp = /atrasad|parcelas|compet[êe]ncia|valor devido|total|RPV/i.test(ry.text) ? 'PLANILHA-ATRASADOS' : ilegivel(ry.text) || !ry.text ? 'PLANILHA-ILEGÍVEL' : '?';
            anexos.push({ id: y.id, tipo: tp });
            out.push('[ANEXO DA ATA ' + y.id + ' ' + tp + '] ' + y.titulo.slice(0, 40));
          }
        }
        acordo.push(a);
        out.push('[ACORDO ' + x.id + ' ' + x.titulo.slice(0, 30) + '] ' + (a.ata ? 'ATA ' : '') + (a.semAtrasados ? 'SEM-ATRASADOS ' : '') + (a.valor ? 'VALOR DOS ATRASADOS: ' + a.valor + ' ' : '') + '| ' + trecho(t, /atrasad|R\$|percentual|%/i, 300));
        if (acordo.length >= 2) break;
      }
    }
    // Acórdão posterior à sentença (pode ter mudado o que a sentença decidiu).
    const ac = docs.find((y, i) => i < pS && /^Ac[óo]rd[ãa]o/i.test(y.titulo));
    if (ac) {
      const r = await FX.leDoc(ac.id, 6);
      if (FX.bloqueio) return { bloqueio: true };
      const fim = corta(r.text, /(S[úu]mula d[eo] [Jj]ulgamento|ACÓRDÃO\s+(A|Vistos|Decide|ACORDAM)|ACORDAM|DECIDE a|decide a)/, 600) || r.text.slice(-600);
      out.push('[AC ' + ac.data + ' ' + ac.id + '] RES=' + resAc(fim) + ' | FIM: ' + fim);
    }
    // Documentos posteriores à sentença, do mais recente para o mais antigo (até 12 lidos).
    const post = [];
    for (const x of docs.filter((y, i) => i < pS && !ehSistema(y.titulo)).slice(0, 12)) {
      const r = await FX.leDoc(x.id, 4);
      if (FX.bloqueio) return { bloqueio: true };
      if (r.ct === 'login') return { login: true };
      const ileg = (r.ct === 'pdf' && !r.text) || ilegivel(r.text);
      const { m, o } = ileg ? { m: [], o: '?' } : marcasDoc(r.text, autor, x.titulo);
      const p = { id: x.id, m, o, ileg };
      post.push(p);
      out.push(x.data + ' ' + x.id + ' ' + x.titulo.slice(0, 45) + (x.nl ? ' [NL]' : '') + (ileg ? ' ILEGÍVEL' : '') + ' {' + m.join(' ') + '} (' + o + '): '
        + (ileg ? '' : trecho(r.text, /requer|vem |informa|comunic|cumprimento|implant|c[áa]lculo|concord|discord|impugn|ci[êe]ncia|destaque/i, 230)));
    }
    // Ordem dos posteriores no array = ordem da cronologia (mais recente primeiro).
    const rever = [!s ? 'sentença não localizada' + (total > docs.length ? ' (cronologia carregou ' + docs.length + ' de ' + total + ' documentos)' : '') : '', ac ? 'acórdão após a sentença' : '',
      post.some((p) => /autor:\?/.test(p.m.join())) ? 'comprovante sem conferência de autor' : '', post.some((p) => p.ileg) || anexos.some((a) => /ILEGÍVEL/.test(a.tipo)) ? 'documento ilegível: ler na tela' : ''].filter(Boolean).join(', ');
    const cab = '=== ' + num + sig + ' nl=' + nl + ' docs=' + docs.length + '/' + total + ' PROP:' + sugere(s, ac, post, acordo, anexos) + (rever ? ' rever: ' + rever : '');
    return { txt: [cab, 'ASSUNTO: ' + assunto.slice(0, 90), ...out].join('\n'), nl };
  };

  FX.inicia = function (lista, base) {
    if (FX.st && FX.st.rodando) return 'já está rodando';
    FX.bloqueio = false;
    const st = (FX.st = { lista, base: base || 0, idx: 0, res: [], rodando: true, parada: '', t0: Date.now() });
    (async () => {
      while (st.idx < st.lista.length && !st.pedirParada) {
        const num = st.lista[st.idx];
        let r;
        for (let t = 0; t < 2; t++) {
          try { r = await FX.analisa(num); } catch (e) { r = { txt: 'X|' + num + '|erro na leitura: ' + String(e).slice(0, 80), erro: true }; }
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

  FX.estado = () => {
    const st = FX.st;
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
  FX.mostra = function (a, b) {
    const rs = (FX.st ? FX.st.res : []).filter((r) => r.n >= a && r.n <= b);
    pre().textContent = rs.map((r) => '#' + r.n + ' ' + r.txt).join('\n\n');
    return rs.length + ' processos no quadro';
  };

  FX.para = function () { if (FX.st) FX.st.pedirParada = true; return 'vai parar após o processo em curso'; };

  // ÚNICA GRAVAÇÃO: MARCAR TODOS COMO LIDOS. Só depois da classificação gravada, um processo por vez.
  // nlLido = o nl do resumo: se o número mudou, chegou documento depois da leitura, que ninguém leu — não marca.
  FX.marca = async function (num, nlLido) {
    const ab = await FX.abre(num);
    if (ab.login) return num + ' LOGIN';
    if (!ab.d) return num + ' NÃO ABRIU — não marcado';
    const d = ab.d, antes = FX.naoLidos(d);
    if (!antes) return num + ' sem documento não lido — nada a marcar';
    if (nlLido !== undefined && antes !== nlLido) return num + ' NÃO MARCADO: eram ' + nlLido + ' não lidos na leitura e agora são ' + antes + ' — reanalisar';
    const bt = [...d.querySelectorAll('input,button,a')].find((e) => /marcar todos como lidos/i.test(e.value || e.textContent || ''));
    if (!bt) return num + ' botão MARCAR TODOS COMO LIDOS não encontrado (' + antes + ' não lidos)';
    bt.click();
    const ok = await espera(() => { const dd = docQ(quadro()); return dd && dd.getElementById('divTimeLine') && !FX.naoLidos(dd); }, 20000);
    return num + (ok ? ' MTL OK (' + antes + ' não lidos; aviso sumiu)' : ' MTL FALHOU — o aviso continua');
  };

  return 'FX v' + FX.versao + ' carregado (' + document.visibilityState + ')';
})();
