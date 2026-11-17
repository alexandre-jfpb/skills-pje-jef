// analise-lote-jd.js — jef-conferir-rpv, lado do Jurisdição Delegada (desenvolvido na 7ª Vara Federal da Paraíba)
//
// Sem dado da unidade: não recebe configuração. O código do órgão sai do próprio número do processo informado.
//
// Carregado na janela de cima da aba do JD (menu.wsp), com o frame "principal" na tela RPV/PRC Consultar.
// Versão gravada a partir do script que leu os lotes de 02/10/2026 (113 processos) e 04/10/2026 (129 processos).
//
// SÓ LÊ: preenche o Nr. do Processo já FORMATADO (0000000-00.0000.4.05.0000, como o próprio onblur do campo
// faz; só com os dígitos, a consulta devolve um falso "Nenhuma RPV/PRC encontrada"), chama consultar() do frame
// (a mesma função do botão Pesquisar) e lê o espelho de cada requisição por fetch, capturando o endereço que
// imprimir(id) montaria — sem abrir o pop-up e sem tocar em nenhum botão do espelho. Este script não envia
// nada para assinatura: o "Enviar para Assinatura" segue o método da seção própria do SKILL.md.
//
// Uso (cada linha é uma chamada do javascript_tool, na aba do JD):
//   window.__JD.inicia(['0000000-00.2026.4.05.9999', ...])
//   window.__JD.estado()           -> feitos/total, rodando ou parado, motivo, tempo
//   await window.__JD.le(desde)    -> linhas a partir do índice `desde` (até ~900 caracteres) e, no fim, ate:<n>
//   window.__JD.mostra([nums])     -> põe as linhas desses processos (e o dicionário de servidores) num quadro
//                                     da página, para ler com get_page_text
//   window.__JD.para()
// Linhas: S<k>:<nome do servidor> (dicionário, na primeira vez que o servidor aparece)
//         J|<processo>|<k-ésima requisição>|nr <nº> ¦ <situação> ¦ <tipo> ¦ proc ok|DIF ¦ nat ¦ <beneficiários e
//           valores: P principal, J juros, S selic, M multa, E encargos, T total; [ADV] advogados; [CESS]
//           cessionários> ¦ VTR <valor total requisitado> ¦ DB <data-base> ¦ TJs ¦ TJe ¦ obs <observações> ¦ S<k>
//         X|<processo>|<motivo>
(() => {
  const JD = (window.__JD = window.__JD || {});
  JD.versao = 2;

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
  // Número formatado: 20 dígitos -> 0000000-00.0000.0.00.0000.
  const formata = (num) => { const d = num.replace(/\D/g, ''); return d.length === 20 ? d.replace(/^(\d{7})(\d{2})(\d{4})(\d)(\d{2})(\d{4})$/, '$1-$2.$3.$4.$5.$6') : num; };

  async function busca(num) {
    const p = P();
    const d = p.document;
    const fm = d.forms[0];
    if (!fm || !fm['tmp.rpv.nr_processo_judicial']) return { erro: 'tela RPV/PRC Consultar não está aberta no frame principal' };
    fm['tmp.rpv.nr_rpv'].value = '';
    fm['tmp.rpv.nr_processo_judicial'].value = formata(num);
    p.consultar();
    let d2 = null;
    for (let i = 0; i < 100; i++) {
      await sleep(300);
      try { const x = P().document; if (x !== d && x.readyState === 'complete' && x.body) { d2 = x; break; } } catch (e) { /* carregando */ }
    }
    if (!d2) return { erro: 'a consulta do JD não respondeu' };
    if (/login|senha/i.test(d2.body.innerText) && !d2.forms[0]) return { login: true };
    const t = d2.body.innerText;
    const ids = [];
    d2.querySelectorAll('a').forEach((a) => { const m = (a.getAttribute('href') || '').match(/imprimir\((\d+)\)/); if (m && !ids.includes(m[1])) ids.push(m[1]); });
    const procs = [...t.matchAll(/Nr\. Processo:\s*([\d.\-]+)/g)].map((m) => m[1]);
    return { ids, procs, nenhuma: /Nenhuma RPV\/PRC encontrada/i.test(t) };
  }

  // Espelho só por leitura: captura o endereço que imprimir(id) abriria no pop-up e o busca por fetch.
  async function espelho(id) {
    const p = P();
    let cap = null;
    const orig = p.wiOpen;
    p.wiOpen = function (u) { cap = u; return null; };
    try { p.imprimir(id); } finally { p.wiOpen = orig; }
    if (!cap) return null;
    const r = await fetch(cap, { credentials: 'include' });
    const html = new TextDecoder('iso-8859-1').decode(await r.arrayBuffer());
    const dd = new DOMParser().parseFromString(html, 'text/html');
    dd.querySelectorAll('script,style').forEach((e) => e.remove());
    return dd.body ? dd.body.innerText : '';
  }

  function compacta(raw, num, st) {
    const t = raw.split('\n').map((s) => s.trim()).filter(Boolean).join(' | ');
    const g = (re) => { const m = t.match(re); return m ? m[1].trim() : '?'; };
    const sit = g(/Situa[çc][ãa]o Atual: \| ([^|]+)/);
    const nr = g(/REQUISI[ÇC][ÃA]O DE PAGAMENTO\s+([0-9.]+)/);
    const tipo = g(/Tipo de Requisi[çc][ãa]o: ([^|]+)/).replace(/Requisi[çc][ãa]o de Pequeno Valor/i, 'RPV');
    const proc = g(/Processo de Execu[çc][ãa]o: ([^|]+)/);
    const req = g(/Requisit[óo]rio: \| ([^|]+)/);
    const nat = g(/Natureza do Cr[ée]dito: ([^|]+)/);
    // Bloco de beneficiários e advogados: do cabeçalho do quadro até o Valor Total Requisitado.
    const i1 = t.search(/Dados (Dedu[çc][õo]es|NM)/);
    const i2 = t.indexOf('Valor Total Requisitado');
    let bl = i1 >= 0 && i2 > i1 ? t.slice(t.indexOf('|', i1) + 1, t.lastIndexOf('Poder Judici', i2) > i1 ? t.lastIndexOf('Poder Judici', i2) : i2) : '';
    const R = [
      [/\| (Valor Juros|Valor Selic|Valor Multa|Encargos|Valor Principal|Valor Total): - /g, '| '],
      [/Valor Principal: /g, 'P '], [/Valor Juros: /g, 'J '], [/Valor Selic: /g, 'S '], [/Valor Multa: /g, 'M '], [/Encargos: /g, 'E '], [/Valor Total: /g, 'T '],
      [/NM Exerc[íi]cio Anterior: (\d+) \| Valor Exerc[íi]cio Anterior: R\$ ([\d.,]+)/g, 'NMant $1 $2'],
      [/NM Exerc[íi]cio Corrente: (\d+) \| Valor Exerc[íi]cio Corrente: R\$ ([\d.,]+)/g, 'NMcor $1 $2'],
      [/Benefici[áa]rio \| CPF\/CNPJ\/Data Nascimento \| OAB \| Valor Sucumb[êe]ncia \(R\$\) \| Valor Contratual \(R\$\) \| Valor Total \(R\$\)/, '[ADV]'],
      [/Tipo \| Benefici[áa]rio \| CPF\/CNPJ \| Valor da Cess[ãa]o \(R\$\) \| Valor Total \(R\$\)/, '[CESS]'],
      [/Nenhum cession[áa]rio com valor a receber\./, '-'], [/Nenhum advogado com valor a receber\./, '-'],
      [/(\| )+/g, '| '], [/\s+/g, ' ']];
    for (const [a, b] of R) bl = bl.replace(a, b);
    const vtr = g(/Valor Total Requisitado \(R\$\) \| ([\d.,]+)/);
    const db = g(/Data-base: ([\d/]+)/);
    const tjs = g(/Conhecimento: ([\d/]+)/);
    const tje = g(/Oposi[çc][ãa]o de Embargos: ([\d/]+)/);
    const ast = g(/Tem Multa Astreintes: ([^|]+)/);
    const soadv = g(/Cr[ée]dito somente advogado: ([^|]+)/);
    let obs = '';
    const io = t.indexOf('Observações:');
    if (io >= 0) {
      const fim = t.search(/Dado e passado|Esta RPV ainda N[ÃA]O FOI VALIDADA|Este PRECAT/i);
      obs = t.slice(io + 13, fim > io ? fim : io + 600)
        .replace(/Houve renuncia do\(s\) benefici[áa]rio\(s\) ao que exceder o teto limite para o Requisit[óo]rio de Pequeno Valor\./, 'renTeto')
        .replace(/Houve destaque de honor[áa]rios contratuais em outro requisit[óo]rio: (\w+)/, 'destOutro:$1')
        .replace(/Justificativa da n[ãa]o inclus[ãa]o do advogado: /, 'justSemAdv:')
        .replace(/Esta RPV ainda N[ÃA]O FOI VALIDADA pelo juiz\(a\)\./g, '').replace(/(\| )+/g, '| ').replace(/\s+/g, ' ').trim();
    }
    const serv = g(/Eu, ([^,]+), Servidor/);
    let k = st.servs.indexOf(serv);
    const out = [];
    if (k < 0) { k = st.servs.push(serv) - 1; out.push('S' + k + ':' + serv); }
    const procOk = proc.replace(/\D/g, '') === num.replace(/\D/g, '') ? 'ok' : 'DIF ' + proc;
    out.push(['nr ' + nr, sit, tipo, 'proc ' + procOk, req !== 'Originário' && req !== '?' ? 'req ' + req : '', 'nat ' + nat, bl, 'VTR ' + vtr, 'DB ' + db, 'TJs ' + tjs, 'TJe ' + tje,
      ast !== 'Não' ? 'astreintes ' + ast : '', soadv !== 'Não' ? 'soAdv ' + soadv : '', 'obs ' + obs, 'S' + k].filter(Boolean).join(' ¦ '));
    return out;
  }

  JD.inicia = function (lista) {
    if (JD.st && JD.st.rodando) return 'já está rodando';
    const st = (JD.st = { lista: lista.map(formata), idx: 0, res: [], servs: [], rodando: true, parada: '', t0: Date.now() });
    (async () => {
      for (; st.idx < st.lista.length && !st.pedirParada; st.idx++) {
        const num = st.lista[st.idx];
        let b = null;
        for (let t = 0; t < 2; t++) {
          try { b = await busca(num); } catch (e) { b = { erro: 'erro: ' + String(e).slice(0, 60) }; }
          if (!b.erro) break;
          await sleep(3000);
        }
        if (b.login) { st.parada = 'login no JD'; break; }
        if (b.erro) { st.res.push('X|' + num + '|' + b.erro); continue; }
        if (!b.ids.length) { st.res.push('X|' + num + '|' + (b.nenhuma ? 'Nenhuma RPV/PRC encontrada' : 'consulta sem requisições legíveis')); continue; }
        const outros = b.procs.filter((x) => x.replace(/\D/g, '') !== num.replace(/\D/g, ''));
        if (outros.length) st.res.push('X|' + num + '|resultado traz outro(s) processo(s): ' + outros.join(', '));
        let k = 0;
        for (const id of b.ids) {
          k++;
          let raw = null;
          try { raw = await espelho(id); } catch (e) { raw = null; }
          if (!raw) { st.res.push('J|' + num + '|' + k + '|ESPELHO NÃO LIDO (id ' + id + ')'); continue; }
          compacta(raw, num, st).forEach((l) => st.res.push(/^S\d+:/.test(l) ? l : 'J|' + num + '|' + k + '|' + l));
        }
      }
      if (!st.parada && st.pedirParada) st.parada = 'interrompido';
      st.rodando = false;
    })();
    return 'JD v' + JD.versao + ': ' + lista.length + ' processos';
  };

  JD.estado = function () {
    const st = JD.st;
    if (!st) return 'sem lote';
    return st.idx + '/' + st.lista.length + ' ' + (st.rodando ? 'rodando' : 'parado') + (st.parada ? ' (' + st.parada + ')' : '') + ' — '
      + Math.round((Date.now() - st.t0) / 1000) + 's — ' + st.res.length + ' linhas — aba ' + document.visibilityState;
  };

  JD.le = async function (desde, espMax) {
    const st = JD.st;
    if (!st) return 'P|0/0|parado|sem execução|0s|ate:0';
    const t0 = Date.now();
    while (st.rodando && st.res.length - desde < 6 && Date.now() - t0 < Math.min(espMax || 8000, 15000)) await sleep(800);
    const out = [];
    let tam = 0, i = desde;
    for (; i < st.res.length; i++) {
      const l = st.res[i];
      if (tam + l.length > 900 && out.length) break;
      out.push(l.length > 950 ? l.slice(0, 950) + '…[cortado]' : l);
      tam += l.length + 1;
    }
    const seg = Math.round((Date.now() - st.t0) / 1000);
    return ['P|' + st.idx + '/' + st.lista.length + '|' + (st.rodando ? 'rodando' : 'parado') + '|' + st.parada + '|' + seg + 's|ate:' + i, ...out].join('\n').replaceAll('=', ':');
  };

  JD.mostra = function (nums) {
    const st = JD.st;
    if (!st) return 'sem lote';
    const ks = nums.map((n) => formata(n));
    const lines = st.res.filter((l) => ks.some((n) => l.startsWith('J|' + n + '|') || l.startsWith('X|' + n + '|')));
    const dict = st.res.filter((l) => /^S\d+:/.test(l));
    let a = document.getElementById('__jdout');
    if (!a) { a = document.createElement('article'); a.id = '__jdout'; a.style.whiteSpace = 'pre-wrap'; document.body.appendChild(a); }
    a.innerText = [...dict, ...lines].join('\n').replaceAll('=', ':');
    return lines.length + ' linhas no quadro';
  };

  JD.linha = function (i) { return JD.st && JD.st.res[i] ? JD.st.res[i].replaceAll('=', ':') : ''; };
  JD.para = function () { if (JD.st) JD.st.pedirParada = true; return 'vai parar após o processo em curso'; };
  return 'JD v' + JD.versao + ' carregado';
})();
