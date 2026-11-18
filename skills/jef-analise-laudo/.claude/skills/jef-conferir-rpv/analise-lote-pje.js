// analise-lote-pje.js — jef-conferir-rpv, lado do PJe (desenvolvido na 7ª Vara Federal da Paraíba)
//
// Sem dado da unidade: não recebe configuração. O código do órgão sai do próprio número do processo informado.
//
// Carregado na página estática do próprio PJe, que não redireciona:
// https://pje1g.trf5.jus.br/pje/js/pdfjs/web/locale/locale.json
// A consulta e os autos abrem num iframe oculto, no mesmo domínio. Versão gravada a partir do script que leu
// os lotes de 02/10/2026 (113 processos) e 04/10/2026 (129 processos).
//
// SÓ LÊ, salvo CR.marca(): abre cada processo (consulta -> autos), lê a cronologia inteira e os documentos
// fora dela (listaIdsDocumentos), baixa o teor de cada documento (pulando exames, dossiês e documentos
// pessoais pelo título) e devolve, por processo, as linhas que a conferência usa. Quem confere é o Claude,
// pelas regras do SKILL.md, lado a lado com o espelho do JD.
// CR.marca(num, nl) é a ÚNICA gravação: clica em MARCAR TODOS COMO LIDOS. Chame-a só depois de concluída a
// conferência do processo e gravada no arquivo de andamento, um processo por vez.
//
// Uso (cada linha é uma chamada do javascript_tool, sem trocar a página de cima):
//   window.__CR.inicia(['0000000-00.2026.4.05.9999', ...], base) -> base = nº do 1º processo - 1
//   window.__CR.estado()            -> feitos/total, rodando ou parado, motivo, tempo, processos com não lidos
//   window.__CR.mostra(a, b)        -> põe as linhas dos processos nº a..b num <pre id="__out">;
//                                      leia com get_page_text (o javascript_tool corta em ~1.200 caracteres)
//   window.__CR.lista(num)          -> todos os documentos do processo (data, id, título, tipo e tamanho do texto)
//   window.__CR.textos([ids], n)    -> teor guardado dos documentos (até n caracteres cada)
//   window.__CR.busca(num, 're', w) -> trechos dos documentos do processo que casam com a expressão
//   await window.__CR.txt(id, pag)  -> baixa de novo e mostra o teor de um documento (até pag páginas)
//   await window.__CR.img(id, k)    -> desenha na tela a k-ésima imagem de um PDF digitalizado (para screenshot);
//   await window.__CR.render(id, p) -> ou a página p; CR.desliza(top) rola, CR.fecha() fecha
//   window.__CR.para()              -> interrompe depois do processo em curso
//   await window.__CR.marca(num, nl) -> MARCAR TODOS COMO LIDOS e confere que o aviso sumiu (nl = o do cabeçalho;
//                                      se o número de não lidos mudou desde a leitura, não marca)
//
// Linhas de cada processo (no <pre>):
//   #<nº> <processo>|sig SIM/NÃO|naoLidos <n>|TL <ok | SEM-INICIAL>|<docs> docs + <n> fora da cronologia [+ <n> de id negativo] | <n> pulados
//            (sem listaIdsDocumentos legível na página, sai "LISTA DE IDS NÃO LIDA" no lugar do "fora da cronologia")
//   PA:       polo ativo (partes, CPF, advogados e OAB)
//   EV:       eventos da cronologia (trânsito, homologação, recurso, requisição etc.)
//   NEG:      ids negativos da listaIdsDocumentos (documentos vindos da Turma Recursal), cada um com o id da cronologia
//             que tem o mesmo documento (-<id na Turma>→<id na cronologia>); SEM PAR = ler pela tela
//   SEN/ACO:  sentença (dispositivo) e acórdão
//   CALC-JEF: planilha de cálculo do JEF (total devido, destaque, líquido, %, data, quem fez; «CÁLCULO CERTO»)
//   CALC?:    outro documento com cálculo ou proposta de acordo (palavra-chave e totais achados)
//   CONC / IMPUG / DEC: concordância com cálculos, impugnação, decisão ou despacho sobre cálculo, destaque, multa, RPV
//   NOM / OF / AJG: certidão de nomeação de perito, ofício de pagamento (valor, data, nomeação, perito),
//                   certidão "CERTIFICO que solicitei, através do sistema AJG…"
//   DST / CTR / PROC: pedido de destaque (%, CNPJ, beneficiário e o trecho do pedido), contrato de honorários (%; «ROGO/ANALF»),
//                     procuração com honorários. A petição inicial é lida até a página 60 e as demais petições até a 15 (v10);
//                     os outros PDFs, até a 5
//   MUL:      decisão com multa e valor
//   ANALF? / REPR?: indício de parte analfabeta; de representante (curador, tutor, genitor)
//   POS-RPV:  documento juntado depois da preparação da requisição
//   SCAN:     documento relevante sem texto (digitalizado): ler pela tela com CR.img / CR.render
//   EXTRA:    documento fora da cronologia
//   FALHOU:   documentos que não baixaram
//   X|<processo>|<motivo>  -> não analisado
(() => {
  const CR = (window.__CR = window.__CR || {});
  CR.versao = 13; // v12 (16/11/2026): CR.mem.partes = polo passivo e "Outros Interessados" da tela (MPF), sem mudar as linhas de saída
  // v13 (18/11/2026): CR.mem.dec = eventos "Decorrido prazo de <parte>" da cronologia (jef-analise-laudo), sem mudar as linhas de saída

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

  CR.mem = CR.mem || { docs: {}, txt: {}, evs: {} };
  CR.mem.partes = CR.mem.partes || {};
  CR.mem.dec = CR.mem.dec || {};
  CR.res = CR.res || {};
  CR.nl = CR.nl || {};
  CR.ord = CR.ord || {};
  CR.cache = CR.cache || {};
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const MES = { jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12 };
  const limpa = (s) => s.replace(/https?:\/\/\S+/g, '[URL]').replace(/\S*[?&]\w+=\S*/g, '[Q]').replace(/\b[0-9a-f]{20,}\b/gi, '[H]')
    .replace(/\s+/g, ' ').trim();
  const R$ = '([\\d.]+,\\d{2}|-)';

  let pdfjs = null;
  const pdf = async () => {
    if (!pdfjs) { pdfjs = await import('/pje/js/pdfjs/build/pdf.mjs'); pdfjs.GlobalWorkerOptions.workerSrc = '/pje/js/pdfjs/build/pdf.worker.mjs'; }
    return pdfjs;
  };

  // Um documento por vez, com meio segundo entre um e outro: mais que isso faz o PJe bloquear por 10 minutos (429).
  let ultimo = 0;
  async function pausa() { const e = 500 - (Date.now() - ultimo); if (e > 0) await sleep(e); ultimo = Date.now(); }
  // Páginas lidas de cada PDF: 5, salvo a petição inicial (até 60) e as demais petições (até 15). Até a v9 eram 5 em todos,
  // e o pedido de destaque, que fica na seção dos pedidos, no fim da inicial, não era lido: no lote de 05/11/2026 a conferência
  // deu AVISO de "destaque sem pedido expresso" em dois processos que tinham o pedido na inicial (v10, 06/11/2026).
  const maxPags = (ti) => (/Peti[çc][ãa]o inicial/i.test(ti || '') ? 60 : /^Peti/i.test(ti || '') ? 15 : 5);
  async function leDoc0(id, mp) {
    await pausa();
    const ctl = new AbortController();
    const tm = setTimeout(() => ctl.abort(), 45000);
    try {
      const r = await fetch('/pje/seam/resource/rest/pje-legacy/documento/download/' + id, { credentials: 'include', signal: ctl.signal });
      if (r.status === 429) { CR.bloqueado = true; return { ct: 'err', text: 'HTTP 429' }; }
      if (!r.ok) return { ct: 'err', text: 'HTTP ' + r.status };
      const ct = r.headers.get('content-type') || '';
      const buf = await r.arrayBuffer();
      if (!buf.byteLength) return { ct: 'vazio', text: '' };
      if (/pdf/i.test(ct) || new TextDecoder('latin1').decode(buf.slice(0, 5)) === '%PDF-') {
        if (buf.byteLength > 25e6) return { ct: 'pdf', text: '', np: 0 };
        const doc = await (await pdf()).getDocument({ data: new Uint8Array(buf) }).promise;
        let out = '';
        for (let i = 1; i <= Math.min(doc.numPages, mp || 5); i++) { const tc = await (await doc.getPage(i)).getTextContent(); out += '[p' + i + '] ' + tc.items.map((x) => x.str).join(' ') + ' '; }
        const np = doc.numPages;
        doc.destroy();
        out = limpa(out);
        if (/^(\[p\d+\]\s*)+$/.test(out)) out = '';
        return { ct: 'pdf', text: out, np };
      }
      const h = new TextDecoder('utf-8').decode(buf);
      if (/type=["']?password|Bem vindo ao PJe/i.test(h)) return { ct: 'login', text: '' };
      if (/Acesso temporariamente bloqueado/i.test(h)) { CR.bloqueado = true; return { ct: 'err', text: 'HTTP 429' }; }
      const dd = new DOMParser().parseFromString(h, 'text/html');
      dd.querySelectorAll('style,script').forEach((e) => e.remove());
      return { ct: 'html', text: limpa(dd.body ? dd.body.textContent : h) };
    } catch (e) { return { ct: 'err', text: String(e).slice(0, 80) }; } finally { clearTimeout(tm); }
  }
  const leDoc = (id, mp) => Promise.race([leDoc0(id, mp), sleep(70000).then(() => ({ ct: 'err', text: 'tempo esgotado' }))]);
  CR.leDoc = leDoc;

  // Documentos que nunca trazem cálculo, contrato, destaque, perícia ou multa: não são baixados (só pelo título).
  const pula = /DOSSI[ÊE]|Extrato CNIS|^Documento de Identifica|COMPROVANTE DE RESID|Comprovante de Resid|\bCTPS\b|\bCNIS\b|Carta de Concess|DOCUMENTOS? M[ÉE]DIC|EXAME|ATESTADO|LAUDO M[ÉE]DICO|Certid[ãa]o de Ocorr|Fotos|Cadastro [ÚU]nico|CAD ?[ÚU]NICO|PROCESSO ADM|Processo Administrativo|^Intima[çc][ãa]o$|^Cita[çc][ãa]o$|^Certid[ãa]o de Intima|Avalia[çc][ãa]o|PER[ÍI]CIA M[ÉE]D|INDEFERIMENTO|Comunica[çc][ãa]o de decis|Certid[ãa]o de (Casamento|Nascimento|[ÓO]bito)|^Laudo Pericial \(\d{11}|RECEITU|TOMOGRAFIA|RESSON|ULTRASSON|RAIO|PRONTU/i;

  function quadro() {
    let f = document.getElementById('__crQ');
    if (!f) { f = document.createElement('iframe'); f.id = '__crQ'; f.style.cssText = 'position:fixed;left:-12000px;top:0;width:1280px;height:900px;border:0'; document.body.appendChild(f); }
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
  CR.naoLidos = (d) => { const m = d.body.innerText.match(/H[áa] (\d+) documentos?(\(s\))? n[ãa]o lido/i); return m ? +m[1] : 0; };

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
    return { d: docQ(f) };
  }
  CR.abre = abre;

  // A cronologia carrega aos poucos: rola até o fim (até a petição inicial ou a distribuição).
  async function carregaTL(d) {
    const tl = d.getElementById('divTimeLine');
    const sc = d.getElementById('divTimeLine:divEventosTimeLine') || [...tl.querySelectorAll('*')].find((e) => /scroll-y/.test(e.className));
    if (!sc) return 'sem-rolagem';
    let last = -1, same = 0;
    for (let i = 0; i < 45 && same < 4; i++) {
      sc.scrollTop = sc.scrollHeight;
      sc.dispatchEvent(new Event('scroll'));
      await sleep(900);
      const n = tl.innerText.length;
      if (n === last) same++; else { same = 0; last = n; }
    }
    return /Peti[çc][ãa]o inicial|DISTRIBU[ÍI]D/i.test(tl.innerText) ? 'ok' : 'SEM-INICIAL';
  }
  function cronologia(d) {
    const linhas = d.getElementById('divTimeLine').innerText.split('\n').map((s) => s.trim()).filter(Boolean);
    let data = '';
    const itens = [], vistos = new Set();
    for (const l of linhas) {
      const m = l.match(/^(\d{2}) (jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez) (\d{4})$/);
      if (m) { data = m[1] + '/' + String(MES[m[2]]).padStart(2, '0') + '/' + m[3]; continue; }
      if (/^\d{2}:\d{2}$/.test(l) || /^\d{1,2} de \S+ de \d{4} - \d{2}h\d{2}$/.test(l) || /^[ÍI]CONE/i.test(l)) continue;
      const x = l.match(/^(\d{8,10}) - (.+)$/);
      if (x) {
        // Documento vindo da Turma Recursal: o título traz o id que ele tinha lá ("… - ID de origem <id>").
        // Lido antes do corte do título em 90 caracteres, que às vezes o tira.
        const origem = (x[2].match(/ID de origem:? ?(\d+)/i) || [])[1];
        if (!vistos.has(x[1])) { vistos.add(x[1]); itens.push({ t: 'd', id: x[1], titulo: x[2].replace(/\s+/g, ' ').replace(/ \d{10} EM \d{2}\/\d{2}\/\d{4} [\d:]+\)/, ')').slice(0, 90), data, origem }); }
        continue;
      }
      // v13: o decurso de prazo fica fora dos eventos (EV) e vai só para CR.mem.dec.
      if (/^DECORRIDO PRAZO/i.test(l)) { itens.push({ t: 'dp', txt: l.slice(0, 160), data }); continue; }
      if (!/^DECORRIDO PRAZO|^EXPEDIDA\/CERTIFICADA|^DISPONIBILIZADO NO DJ|^PUBLICADO|^EXPEDI[ÇC][ÃA]O DE|^CONCLUSOS/i.test(l)) itens.push({ t: 'e', txt: l.slice(0, 110), data });
    }
    return itens;
  }
  const dd = (s) => (s || '').replace(/^(\d{2})\/(\d{2})\/\d{2}(\d{2})$/, '$1/$2/$3');
  const ach = (t, re, w) => { const m = t.match(re); if (!m) return ''; const i = m.index; return t.slice(Math.max(0, i - (w[0] || 0)), i + (w[1] || 150)); };

  // Planilha de cálculo padrão do JEF ("Total Geral Devido ao Autor").
  function planJEF(t) {
    const g = (re) => { const m = t.match(re); return m ? m.slice(1) : null; };
    const ate = (t.match(/Atualizados At[ée] (\d{2}\/\d{4})/i) || [])[1];
    const tot = g(new RegExp('Totais ' + R$ + ' ' + R$ + ' ' + R$ + ' ' + R$ + ' ' + R$ + ' ' + R$));
    const tg = (t.match(/Total Geral Devido ao Autor ([\d.]+,\d{2})/) || [])[1];
    const dh = (t.match(/Destaque de Honor\S+ ([\d.]+,\d{2}|-) L[íi]quido/) || [])[1];
    const liq = (t.match(/Ap[óo]s Destaque ([\d.]+,\d{2})/) || [])[1];
    const suc = (t.match(/Sucumbenciais ([\d.,]+) ?%/) || [])[1];
    const con = (t.match(/Contratuais ([\d.,]+) ?%/) || [])[1];
    const B = g(new RegExp('Principal Juros Total Principal Juros Total ' + R$ + ' ' + R$ + ' ' + R$ + ' ' + R$ + ' ' + R$ + ' ' + R$));
    const P = g(new RegExp('Principal Atualizado ' + R$ + ' ' + R$ + ' ' + R$ + ' ' + R$ + ' ' + R$ + ' ' + R$));
    const Mo = g(new RegExp('Mora \\(Juros/SELIC\\) ' + R$ + ' ' + R$ + ' ' + R$ + ' ' + R$ + ' ' + R$ + ' ' + R$));
    const data = (t.match(/(\d{1,2} de [a-zç]+ de \d{4})\./i) || [])[1];
    const dig = (t.match(/Cargo\/Fun\S+ (.+?) (Analista|T[ée]cnic|Servidor|Diretor|Contador|Estagi|Supervisor|Concilia)/i) || [])[1];
    const certo = /c[áa]lculo certo/i.test(t) ? ' «CÁLCULO CERTO»' : '';
    return 'TG ' + tg + ' Dest ' + dh + ' Liq ' + liq + ' C%' + con + ' S%' + suc
      + (B ? ' Bsuc ' + B[0] + '/' + B[1] + '/' + B[2] + ' Bcon ' + B[3] + '/' + B[4] + '/' + B[5] : '')
      + (tot ? ' T[' + tot.join(' ') + ']' : '') + (P ? ' P[' + P.join(' ') + ']' : '') + (Mo ? ' M[' + Mo.join(' ') + ']' : '')
      + ' até ' + ate + ' em ' + data + ' por ' + dig + certo;
  }

  async function analisa(num) {
    const ab = await abre(num);
    if (ab.login) return { login: true };
    if (ab.bloqueio) return { bloqueio: true };
    if (ab.erro || ab.naoAchou) return { txt: 'X|' + num + '|' + (ab.erro || ab.motivo) };
    const d = ab.d;
    const tls = await carregaTL(d);
    const itens = cronologia(d);
    const docs = itens.filter((x) => x.t === 'd');
    // A cronologia omite documentos (ex.: contrato anexado à inicial): a lista completa está em listaIdsDocumentos.
    // Processo que voltou da Turma Recursal traz na lista também ids NEGATIVOS (v9, 15/10/2026). Até a v8 a expressão não
    // aceitava o sinal e não casava: num processo o script deu 0 fora da cronologia, quando eram 118 (108 positivos
    // e 10 negativos). O id negativo é o que o documento tinha na Turma, com o sinal trocado: o mesmo documento está na cronologia
    // com id próprio, positivo, e o título "… - ID de origem <id>" (-<id> → <id na cronologia> Acórdão - ID de origem <id>).
    // Por isso o id negativo não é baixado: o teor sai do id positivo. Nunca tirar o sinal para baixar: o mesmo número,
    // positivo, é outro documento do PJe. Id negativo sem par na cronologia sai na linha NEG como SEM PAR (ler pela tela).
    const scr = [...d.querySelectorAll('script')].map((s) => s.textContent).join('\n');
    const lm = scr.match(/listaIdsDocumentos\s*=\s*\[([-\d,\s]*)\]/);
    const todos = lm ? lm[1].split(',').map((s) => s.trim()).filter(Boolean) : [];
    const neg = todos.filter((id) => id[0] === '-');
    const par = {};
    docs.forEach((x) => { if (x.origem) par['-' + x.origem] = x.id; });
    const vistos = new Set(docs.map((x) => x.id));
    const extras = todos.filter((id) => id[0] !== '-' && !vistos.has(id)).map((id) => ({ t: 'd', id, titulo: '(fora da cronologia)', data: '??/??/????', extra: true }));
    const all = docs.concat(extras);
    const body = d.body.textContent.replace(/\s+/g, ' ');
    const nl = CR.naoLidos(d);
    // v11: atos da fase de RPV juntados com o título "Intimação" (ex.: ato ordinatório de ordem verbal que defere em parte o
    // destaque) eram pulados pelo título. Agora as intimações posteriores à sentença mais recente (ou à homologação do acordo,
    // que também é "Sentença") são lidas; sem sentença na cronologia, as 15 mais recentes.
    const iSent = itens.findIndex((x) => x.t === 'd' && /^Senten/i.test(x.titulo));
    const recentes = new Set(docs.slice(0, 15).map((x) => x.id));
    const lerIntim = (x) => /^Intima[çc][ãa]o$/i.test(x.titulo) && (iSent >= 0 ? itens.indexOf(x) < iSent : recentes.has(x.id));
    for (const x of all) {
      if (CR.bloqueado) return { bloqueio: true };
      if (!x.extra && pula.test(x.titulo) && !lerIntim(x)) { x.ct = 'pulado'; x.text = ''; continue; }
      Object.assign(x, await leDoc(x.id, maxPags(x.titulo)));
      if (x.ct === 'login') return { login: true };
    }
    const falhos = all.filter((x) => x.ct === 'err' || x.ct === 'login' || x.ct === 'vazio');
    const pulados = all.filter((x) => x.ct === 'pulado').length;
    CR.mem.docs[num] = all.map((x) => ({ id: x.id, ti: x.titulo, data: x.data, len: (x.text || '').length, np: x.np || 0, ct: x.ct }));
    all.forEach((x) => { CR.mem.txt[x.id] = x.text || ''; });
    CR.mem.evs[num] = itens.filter((x) => x.t === 'e').map((x) => x.data + ' ' + x.txt);
    CR.mem.dec[num] = itens.filter((x) => x.t === 'dp').map((x) => x.data + ' ' + x.txt);
    // "Segredo de justiça? SIM/NÃO" fica no menu oculto de detalhes do cabeçalho (#maisDetalhes).
    const md = d.getElementById('maisDetalhes');
    const sig = md ? (/Segredo de justi[çc]a\W*SIM/i.test(md.textContent) ? 'SIM' : 'NÃO') : '?';
    let polo = '';
    const s0 = body.indexOf('Segredo de justiça?');
    const pa = body.indexOf('Polo ativo', s0 >= 0 ? s0 : 0), pp = body.indexOf('Polo passivo', pa);
    if (pa >= 0 && pp > pa) {
      polo = body.slice(pa + 10, pp).replace(/Icone de lembr\S*/gi, '').replace(/ registrado\(a\) civilmente como [^-(]+/g, ' ').replace(/ - CPF: /g, ' CPF ')
        .replace(/ - OAB /g, ' OAB ').replace(/\(ADVOGADO\)/g, '(ADV)').replace(/\s+/g, ' ').trim();
    }
    const L = [];
    L.push(num + '|sig ' + sig + '|naoLidos ' + nl + '|TL ' + tls + '|' + docs.length + ' docs + '
      + (lm ? extras.length + ' fora da cronologia' + (neg.length ? ' + ' + neg.length + ' de id negativo' : '') : 'LISTA DE IDS NÃO LIDA (conferir na tela se há documento fora da cronologia)')
      + ' | ' + pulados + ' pulados');
    L.push('PA: ' + polo);
    // v12: polo passivo e "Outros Interessados" (onde fica o MPF, quando cadastrado), até o bloco de lembretes. Só em memória.
    if (pp > pa) { const fimP = body.slice(pp).search(/Icone de lembr|Novo Lembrete|Lembrete\(s\)/i); CR.mem.partes[num] = body.slice(pp, pp + (fimP > 0 ? Math.min(fimP, 3000) : 1500)).replace(/\s+/g, ' ').trim(); }
    const evs = itens.filter((x) => x.t === 'e' && /TRANSITAD|JULGAD|HOMOLOG|EXTIN|RECURSO|AC[ÓO]RD|TURMA|REMETID|RECEBID|EMBARGOS|REQUISI[ÇC][ÃA]O|PRECAT|MULTA|CANCELAD|REDISTRIBU/i.test(x.txt));
    L.push('EV: ' + evs.map((x) => dd(x.data) + ' ' + x.txt.replace(/REQUISI[ÇC][ÃA]O DE PAGAMENTO DE PEQUENO PREPARADA PARA ENVIO/i, 'RPV PREPARADA')).join(' ; '));
    if (neg.length) L.push('NEG: ' + neg.map((id) => id + (par[id] ? '→' + par[id] : ' SEM PAR (ler pela tela)')).join(', '));
    const reqIdx = itens.map((x, i) => (x.t === 'e' && /REQUISI[ÇC][ÃA]O DE PAGAMENTO|PRECAT[ÓO]RIO.*PREPARAD/i.test(x.txt) ? i : -1)).filter((i) => i >= 0);
    const oldestReq = reqIdx.length ? Math.max(...reqIdx) : -1;
    const sentIdx = itens.findIndex((x) => x.t === 'd' && /^Senten/i.test(x.titulo));
    for (const x of all) {
      const t = x.text || '';
      const ti = x.titulo;
      const tag = x.id + ' ' + dd(x.data) + ' «' + ti.slice(0, 45) + '»';
      if (x.extra && t.length > 0) L.push('EXTRA ' + x.id + ' txt ' + t.length + ' np ' + (x.np || '-') + ' | ' + t.slice(0, 200));
      else if (x.extra) L.push('EXTRA ' + x.id + ' (sem texto, ' + (x.np || '?') + ' pág.)');
      if (/^Senten/i.test(ti)) { const disp = (t.match(/(JULGO (PARCIALMENTE )?(IM)?PROCEDENTE|HOMOLOGO|EXTINGO|EXTINTO)/i) || [])[1] || '?'; L.push('SEN ' + tag + ' ' + disp); }
      if (/Ac[óo]rd[ãa]o/i.test(ti) || /^(\S+ ){0,30}AC[ÓO]RD[ÃA]O/.test(t.slice(0, 400))) L.push('ACO ' + tag + ' ' + ach(t, /(NEGO|DOU|D[ÁA]-SE|NEGA-SE|PROVIMENTO|honor[áa]rios)/i, [60, 200]));
      if (/Total Geral Devido ao Autor/i.test(t)) L.push('CALC-JEF ' + tag + ' ' + planJEF(t));
      else if (/C[ÁA]LCULO DE LIQUIDA[ÇC]|PARECER T[ÉE]CNICO|CALPREV|\bECALC|DEMONSTRATIVO DE C[ÁA]LCULO|PLANILHA DE C[ÁA]LCULO|MEM[ÓO]RIA DE C[ÁA]LCULO|RESUMO DO C[ÁA]LCULO|VALOR DEVIDO|PROPOSTA DE ACORDO/i.test(t)
        && !/^(Senten|Intima|Certid|Ato ord|Cita|Contesta)/i.test(ti) && !/concord\S* com (os )?c[áa]lculos/i.test(t)) {
        const tots = [...t.matchAll(/(TOTAL[^\d]{0,40}|Total[^\d]{0,40}|VALOR DEVIDO[^\d]{0,30}|R\$ ?)([\d.]+,\d{2})/g)].slice(0, 5).map((m) => m[1].trim().slice(-25) + ' ' + m[2]).join('; ');
        const kw = (t.match(/C[ÁA]LCULO DE LIQUIDA[ÇC]\S*|PARECER T[ÉE]CNICO|CALPREV|\bECALC\S*|DEMONSTRATIVO DE C[ÁA]LCULO|PLANILHA DE C[ÁA]LCULO|MEM[ÓO]RIA DE C[ÁA]LCULO|RESUMO DO C[ÁA]LCULO|VALOR DEVIDO|PROPOSTA DE ACORDO/i) || [])[0];
        L.push('CALC? ' + tag + ' kw:' + kw + ' np:' + (x.np || '-') + ' | ' + (tots || ach(t, /c[áa]lculo/i, [40, 160])));
      }
      if (/concord\S* com (os )?c[áa]lculos/i.test(t)) L.push('CONC ' + tag + (/ADVOCACIA-GERAL|PROCURADORIA-GERAL FEDERAL/i.test(t) ? ' (INSS)' : ' (outro)'));
      if (/impugna/i.test(t) && /c[áa]lculo/i.test(t) && !/Total Geral Devido|Tema 1190/i.test(t) && !/^(Contesta|Senten|Intima)/i.test(ti)) L.push('IMPUG ' + tag + ' ' + ach(t, /impugna/i, [60, 120]));
      const atoIntim = /^Intima/i.test(ti) && /ATO ORDINAT[ÓO]RIO|\bDECIS[ÃA]O\b|\bDESPACHO\b/i.test(t.slice(0, 1500));
      if ((/^(Decis|Despacho|Ato)/i.test(ti) || atoIntim) && /c[áa]lculo|destaque|honor|multa|RPV|requisi|habilit/i.test(t)) L.push('DEC ' + tag + (atoIntim ? ' «ATO NA INTIMAÇÃO»' : '') + ' ' + ach(t, /c[áa]lculo|destaque|honor|multa|RPV|requisi|habilit/i, [80, 200]));
      if (/NOMEA[ÇC][ÃA]O DE PROFISSIONAL/i.test(t) || /Certid[ãa]o de nomea/i.test(ti)) {
        const nm = t.match(/Nome: (.+?) N\. CPF: ([\d.\-]+)/) || [];
        const dn = (t.match(/Data da nomea[çc][ãa]o: (\d{2}\/\d{2}\/\d{4})/) || [])[1];
        const vn = (t.match(/Valor requisitado: ([\d.,]+)/) || [])[1];
        L.push('NOM ' + tag + ' ' + (nm[1] || '?') + ' ' + (nm[2] || '') + ' em ' + dn + ' valor ' + vn);
      }
      if (/OF[ÍI]CIO REQUISIT[ÓO]RIO DE PAGAMENTO DE HONOR|Solicita[çc][ãa]o de Pagamento/i.test(t)) {
        const v = (t.match(/Valor requisitado:? ([\d.]+,\d{2})/i) || [])[1];
        const ds = (t.match(/solicitado pagamento para o profissional\.?:? (\d{2}\/\d{2}\/\d{4})/i) || [])[1];
        const nn = (t.match(/N\. da nomea[çc][ãa]o:? (\d+)/i) || [])[1];
        const pe = (t.match(/BENEFICI[ÁA]RIO DOS HONOR[ÁA]RIOS:? Nome:? (.+?) N\. CPF/i) || [])[1];
        L.push('OF ' + tag + ' valor ' + v + ' solic ' + ds + ' nom ' + nn + ' perito ' + pe);
      }
      if (/CERTIFICO que solicitei,? atrav[ée]s do sistema AJG/i.test(t)) L.push('AJG ' + tag + ' ' + ach(t, /CERTIFICO que solicitei/i, [0, 200]));
      if (/destaq|reten[çc][ãa]o dos honor/i.test(t) && /honor/i.test(t) && !/Total Geral Devido/i.test(t) && !/mera juntada do contrato|apresenta[çc][ãa]o do contrato ap[óo]s/i.test(t)) {
        const pcts = [...new Set((t.match(/\d{1,2}(?:[.,]\d+)? ?%|\(\s*\w+ por cento\s*\)/gi) || []))].slice(0, 5).join(',');
        const cnpj = [...new Set(t.match(/\d{2}\.\d{3}\.\d{3}\/\d{4} ?- ?\d{2}/g) || [])].join(',');
        const nome = ach(t, /em nome d[aeo]|em favor d[aeo]|SOCIEDADE (INDIVIDUAL )?DE ADVOGAD|ADVOCACIA|ADVOGADOS ASSOCIADOS/i, [30, 110]);
        L.push('DST ' + tag + ' pct ' + pcts + ' cnpj ' + cnpj + ' | ' + nome + ' | «' + ach(t, /destaq|reten[çc][ãa]o dos honor/i, [100, 160]) + '»');
      }
      if (/contrat/i.test(ti) || /CONTRATO DE (PRESTA|HONOR)/i.test(t.slice(0, 600))) {
        const pcts = [...new Set((t.match(/\d{1,2}(?:[.,]\d+)? ?%|\(\s*\w+ por cento\s*\)/gi) || []))].slice(0, 5).join(',');
        L.push('CTR ' + tag + ' txt ' + t.length + ' np ' + (x.np || '-') + ' pct ' + pcts + (/a rogo|impress[ãa]o digital|n[ãa]o alfabetizad|analfabet/i.test(t) ? ' «ROGO/ANALF»' : ''));
      }
      if (/procura/i.test(ti) && (/honor/i.test(t) || t.length < 40)) L.push('PROC ' + tag + ' txt ' + t.length + (/honor/i.test(t) ? ' honor: ' + ach(t, /honor/i, [40, 120]) : ''));
      if (/multa/i.test(t) && /R\$ ?[\d.]+,\d{2}/.test(t) && /^(Decis|Despacho|Senten|Ato|Certid)/i.test(ti)) L.push('MUL ' + tag + ' ' + ach(t, /multa/i, [40, 220]));
      if (/a rogo|n[ãa]o alfabetizad|analfabet/i.test(t) && !/CTPS|Ass\. do empregador|representante for analfabeto/i.test(t)) L.push('ANALF? ' + tag + ' ' + ach(t, /a rogo|n[ãa]o alfabetizad|analfabet/i, [40, 80]));
      if (/\bcurador|curatela|interdi[çc]|tutor[ a]|genitor/i.test(t) && !/^(Senten|Intima)/i.test(ti) && !/ADVOCACIA-GERAL/.test(t.slice(0, 200))) L.push('REPR? ' + tag + ' ' + ach(t, /\bcurador|curatela|interdi[çc]|tutor[ a]|genitor/i, [40, 100]));
      const pos = itens.indexOf(x);
      if (!x.extra && oldestReq >= 0 && pos < oldestReq && !/^(Intima|Certid[ãa]o de Intima|Expedi)/i.test(ti)) L.push('POS-RPV ' + tag + ' txt ' + t.length + ' | ' + t.slice(0, 160));
      if (!x.extra && x.ct !== 'pulado' && t.length < 40 && x.ct !== 'err'
        && (/contrat|procura|peti|honor|destaq|c[áa]lculo|planilha|acordo|decis|senten|certid|anexo|outras|execu/i.test(ti) || (sentIdx >= 0 && pos < sentIdx))) L.push('SCAN ' + tag + ' (sem texto, ' + (x.np || '?') + ' pág.)');
    }
    if (falhos.length) L.push('FALHOU: ' + falhos.map((x) => x.id + '(' + (x.text || x.ct).slice(0, 20) + ')').join(', '));
    return { txt: L.join('\n'), nl };
  }
  CR.analisa = analisa;

  // Um processo por vez. Processo já lido (sem erro) é pulado: para retomar, basta chamar inicia de novo.
  CR.inicia = function (lista, base) {
    if (CR.st && CR.st.rodando) return 'já está rodando';
    CR.bloqueado = false;
    const st = (CR.st = { lista, base: base || 0, i: 0, rodando: true, parada: '', t0: Date.now(), atual: '' });
    lista.forEach((num, k) => { CR.ord[num] = st.base + k + 1; });
    (async () => {
      for (; st.i < st.lista.length && !st.pedirParada; st.i++) {
        const num = st.lista[st.i];
        st.atual = num;
        if (CR.res[num] && !/^X\||ERRO/.test(CR.res[num])) continue;
        let r;
        try { r = await analisa(num); } catch (e) { r = { txt: 'X|' + num + '|ERRO ' + String(e).slice(0, 80) }; }
        if (r.bloqueio || CR.bloqueado) { st.parada = '429 em ' + num + ': esperar 10 minutos'; break; }
        if (r.login) { st.parada = 'login em ' + num; break; }
        CR.res[num] = r.txt;
        CR.nl[num] = r.nl || 0;
        await sleep(4000);
      }
      if (!st.parada && st.pedirParada) st.parada = 'interrompido';
      st.rodando = false;
      st.atual = '';
    })();
    return 'CR v' + CR.versao + ': ' + lista.length + ' processos';
  };

  CR.estado = function () {
    const s = CR.st;
    const comNL = Object.keys(CR.nl).filter((k) => CR.nl[k] > 0);
    return (s ? s.i + '/' + s.lista.length + ' ' + (s.rodando ? 'rodando' : 'parado') + (s.parada ? ' (' + s.parada + ')' : '') + ' — '
      + Math.round((Date.now() - s.t0) / 1000) + 's' + (s.atual ? ' — em ' + s.atual : '') : 'sem lote')
      + ' — aba ' + document.visibilityState + ' — com não lidos: ' + (comNL.map((k) => k + '(' + CR.nl[k] + ')').join(', ') || 'nenhum');
  };

  // Texto grande vai para um <pre> da página e é lido com get_page_text.
  const pre = () => {
    let p = document.getElementById('__out');
    if (!p) { p = document.createElement('pre'); p.id = '__out'; p.style.whiteSpace = 'pre-wrap'; document.body.appendChild(p); }
    // Tira o texto original da página (o JSON do locale), sem apagar o iframe do lote, o campo de carga nem a tela de imagem.
    [...document.body.childNodes].forEach((n) => { if (n !== p && !/^__(\w+Q|carga|ov)$/.test(n.id || '')) n.remove?.(); });
    return p;
  };
  const mostra = (txt) => { pre().textContent = txt.replaceAll('=', ':'); return txt.length + ' caracteres no quadro'; };
  CR.mostra = function (a, b) {
    const nums = Array.isArray(a) ? a : Object.keys(CR.ord).filter((n) => CR.ord[n] >= a && CR.ord[n] <= b).sort((x, y) => CR.ord[x] - CR.ord[y]);
    return mostra(nums.map((n) => '#' + (CR.ord[n] || '?') + ' ' + (CR.res[n] || n + '|ainda não analisado')).join('\n\n'));
  };
  CR.lista = function (num) {
    const ds = CR.mem.docs[num];
    if (!ds) return 'sem lista';
    return mostra('#' + num + ' DOCS\n' + ds.map((x) => x.data + ' ' + x.id + ' ' + x.ti + ' [' + x.ct + ' ' + x.len + (x.np ? '/' + x.np + 'p' : '') + ']').join('\n')
      + '\nEVENTOS\n' + (CR.mem.evs[num] || []).join('\n'));
  };
  CR.textos = (ids, n) => mostra(ids.map((id) => 'DOC ' + id + ' :: ' + (CR.mem.txt[id] || '(sem texto guardado)').slice(0, n || 3000)).join('\n\n'));
  CR.busca = function (num, re, w) {
    const ds = CR.mem.docs[num];
    if (!ds) return 'sem lista';
    const r = new RegExp(re, 'i'), out = [];
    for (const x of ds) {
      const t = CR.mem.txt[x.id] || '';
      const m = t.match(r);
      if (m) out.push(x.data + ' ' + x.id + ' «' + x.ti.slice(0, 40) + '»: …' + t.slice(Math.max(0, m.index - (w || 150)), m.index + (w || 150) * 2) + '…');
    }
    mostra(out.join('\n\n'));
    return 'achados: ' + out.length;
  };

  // Leitura visual de documento digitalizado: desenha a imagem ou a página na tela, para screenshot.
  CR.baixa = async function (id) {
    if (CR.cache[id]) return CR.cache[id];
    await pausa();
    const r = await fetch('/pje/seam/resource/rest/pje-legacy/documento/download/' + id, { credentials: 'include' });
    const ct = r.headers.get('content-type') || '';
    const buf = new Uint8Array(await r.arrayBuffer());
    if (r.status === 429) CR.bloqueado = true;
    if (buf.length) CR.cache[id] = { ct, buf };
    return { ct, buf, st: r.status };
  };
  const ov = () => {
    let o = document.getElementById('__ov');
    if (!o) { o = document.createElement('div'); o.id = '__ov'; o.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100vh;overflow:hidden;background:#fff;z-index:2147483647'; document.body.appendChild(o); }
    o.style.display = 'block';
    o.innerHTML = '';
    return o;
  };
  CR.img = async function (id, k, top, width) {
    const { buf, st } = await CR.baixa(id);
    if (!buf.length) return 'vazio (status ' + st + ')';
    const s = new TextDecoder('latin1').decode(buf);
    const imgs = [];
    let p = 0;
    while ((p = s.indexOf('stream', p)) >= 0) {
      let a = p + 6;
      if (s[a] === '\r') a++;
      if (s[a] === '\n') a++;
      if (buf[a] === 0xFF && buf[a + 1] === 0xD8) { const e = s.indexOf('endstream', a); let b = e; while (b > a && !(buf[b - 2] === 0xFF && buf[b - 1] === 0xD9)) b--; imgs.push([a, b]); p = e + 9; } else p = a;
    }
    const big = imgs.filter(([a, b]) => b - a > 30000);
    if (!big.length) return CR.render(id, (k || 0) + 1, top, width);
    const o = ov();
    const [a, b] = big[Math.min(k || 0, big.length - 1)];
    const im = document.createElement('img');
    im.src = URL.createObjectURL(new Blob([buf.slice(a, b)], { type: 'image/jpeg' }));
    im.style.cssText = 'position:absolute;left:0;top:' + (-(top || 0)) + 'px;width:' + (width || 1300) + 'px';
    o.appendChild(im);
    await new Promise((r) => { im.onload = r; im.onerror = r; setTimeout(r, 8000); });
    return 'imagem ' + (k || 0) + ' de ' + big.length + ' | altura ' + Math.round(im.naturalHeight * (width || 1300) / (im.naturalWidth || 1));
  };
  CR.render = async function (id, pg, top, width) {
    const { buf } = await CR.baixa(id);
    const lib = await pdf();
    const doc = await lib.getDocument({ data: buf.slice() }).promise;
    const p = await doc.getPage(pg || 1);
    const v0 = p.getViewport({ scale: 1 });
    const vp = p.getViewport({ scale: (width || 1300) / v0.width });
    const o = ov();
    const c = document.createElement('canvas');
    c.width = vp.width; c.height = vp.height;
    c.style.cssText = 'position:absolute;left:0;top:' + (-(top || 0)) + 'px';
    o.appendChild(c);
    await Promise.race([p.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise, sleep(25000)]);
    return 'render pág ' + (pg || 1) + '/' + doc.numPages + ' altura ' + Math.round(vp.height);
  };
  CR.txt = async function (id, maxPag) {
    const { ct, buf } = await CR.baixa(id);
    let t = '';
    if (/pdf/i.test(ct) || new TextDecoder('latin1').decode(buf.slice(0, 5)) === '%PDF-') {
      const doc = await (await pdf()).getDocument({ data: buf.slice() }).promise;
      for (let i = 1; i <= Math.min(doc.numPages, maxPag || 8); i++) { const tc = await (await doc.getPage(i)).getTextContent(); t += '[p' + i + '] ' + tc.items.map((x) => x.str).join(' ') + ' '; }
      t = 'PDF ' + doc.numPages + 'p :: ' + t;
    } else {
      const d2 = new DOMParser().parseFromString(new TextDecoder('utf-8').decode(buf), 'text/html');
      d2.querySelectorAll('style,script').forEach((e) => e.remove());
      t = 'HTML :: ' + d2.body.textContent;
    }
    CR.mem.txt[id] = limpa(t);
    mostra('DOC ' + id + ' :: ' + CR.mem.txt[id]);
    return 'doc ' + id + ': ' + t.length;
  };
  CR.desliza = (top) => { const im = document.querySelector('#__ov img, #__ov canvas'); if (im) im.style.top = (-top) + 'px'; return 'ok'; };
  CR.fecha = () => { const o = document.getElementById('__ov'); if (o) o.style.display = 'none'; return 'fechado'; };

  CR.para = function () { if (CR.st) CR.st.pedirParada = true; return 'vai parar após o processo em curso'; };

  // ÚNICA GRAVAÇÃO: MARCAR TODOS COMO LIDOS. Só depois da conferência gravada, um processo por vez.
  // nlLido = o naoLidos do cabeçalho: se o número mudou, chegou documento depois da leitura, que ninguém leu — não marca.
  CR.marca = async function (num, nlLido) {
    const ab = await abre(num);
    if (ab.login) return num + ' LOGIN';
    if (!ab.d) return num + ' NÃO ABRIU — não marcado';
    const d = ab.d, antes = CR.naoLidos(d);
    if (!antes) return num + ' sem documento não lido — nada a marcar';
    if (nlLido !== undefined && antes !== nlLido) return num + ' NÃO MARCADO: eram ' + nlLido + ' não lidos na leitura e agora são ' + antes + ' — reler';
    const bt = [...d.querySelectorAll('input,button,a')].find((e) => /marcar todos como lidos/i.test(e.value || e.textContent || ''));
    if (!bt) return num + ' botão MARCAR TODOS COMO LIDOS não encontrado (' + antes + ' não lidos)';
    bt.click();
    const ok = await espera(() => { const d2 = docQ(quadro()); return d2 && d2.getElementById('divTimeLine') && !CR.naoLidos(d2); }, 20000);
    return num + (ok ? ' MTL OK (' + antes + ' não lidos; aviso sumiu)' : ' MTL FALHOU — o aviso continua');
  };

  return 'CR v' + CR.versao + ' carregado (' + document.visibilityState + ')';
})();
