// analise-lote.js — jef-endereco-pericia (desenvolvido na 7ª Vara Federal da Paraíba; versão para compartilhamento)
//
// Injetado pelo javascript_tool do Chrome numa página estática do próprio PJe, que não
// redireciona: https://pje1g.trf5.jus.br/pje/js/pdfjs/web/locale/locale.json
// (a tela de consulta, usada como hospedeira, foi mandada para error.seam no meio de um lote
// e o script se perdeu). A consulta e os autos abrem nos iframes, no mesmo domínio.
// SÓ LÊ: abre cada processo num iframe oculto (consulta -> autos), lê o teor dos
// documentos pelo endpoint de download e classifica conforme o SKILL.md.
// Nunca clica em MARCAR TODOS COMO LIDOS nem em nada que grave no PJe; o único
// clique nos autos é no documento que parece laudo, para ler o "Juntado por".
//
// Uso (cada linha é uma chamada do javascript_tool, sem trocar a página de cima):
//   window.__EP.config({peritos:[{nome, cpf}, ...], ignorados:[{nome, cpf}, ...], asGeral:['<texto>', ...], asLote:'<marca>'})
//       -> obrigatório antes do inicia; valores de docs/configuracao-unidade.md (seções "Comum — Peritos médicos"
//          e "jef-endereco-pericia"). Padrão vazio: sem perito configurado, o inicia não roda.
//   window.__EP.inicia(['0000000-00.2026.4.05.0000', ...], {paralelo: 2})
//   await window.__EP.le(desde)   -> progresso + linhas novas a partir do índice `desde`
//                                    (espera no máximo 10 s: o javascript_tool corta em 45 s)
//   window.__EP.para()            -> interrompe depois dos processos em curso
// `paralelo` = quantos processos abrir ao mesmo tempo, cada um no seu iframe (padrão 1).
// `ignorados` = nomeações que a configuração manda ignorar (não são de perito médico, sem linha no relatório).
// `asGeral` = textos que, numa etiqueta, indicam perícia social para qualquer nomeado;
// `asLote` = marca que, numa etiqueta, junto com o primeiro nome do nomeado, indica que ele é assistente social.
//
// Linhas devolvidas por le():
//   P|feitos/total|rodando ou parado|motivo da parada|tempo|ate:<próximo desde>
//   E|<chave>|<endereço>                              (dicionário de endereços)
//   <cód>|<processo>|<id nomeação>|<índice perito>|<data nomeação>|<documentos>|<chave(s) endereço>|<observação>|<sigiloso>
// Códigos: O em ordem · S sem certidão · B endereço em branco · D perito divergente
//          R perícia já realizada · N sem nomeação de perito médico
//          V revisar manualmente · X não analisado
(() => {
  const EP = (window.__EP = window.__EP || {});
  EP.versao = 7;
  // Configuração da unidade (docs/configuracao-unidade.md). Padrão vazio.
  EP.cfg = EP.cfg || { peritos: [], ignorados: [], asGeral: [], asLote: '' };
  // CPF só com dígitos vira o formato da certidão de nomeação (nnn.nnn.nnn-nn), que é o comparado.
  const fmtCpf = (c) => { const d = String(c || '').replace(/\D/g, ''); return d.length === 11 ? d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4') : String(c || '').trim(); };
  const pessoas = (l) => (Array.isArray(l) ? l : []).filter((p) => p && p.nome).map((p) => ({ nome: String(p.nome).trim(), cpf: fmtCpf(p.cpf) }));
  EP.config = function (c) {
    c = c || {};
    if (c.peritos) EP.cfg.peritos = pessoas(c.peritos);
    if (c.ignorados) EP.cfg.ignorados = pessoas(c.ignorados);
    if (c.asGeral) EP.cfg.asGeral = (Array.isArray(c.asGeral) ? c.asGeral : [c.asGeral]).map((t) => String(t).trim()).filter(Boolean);
    if (typeof c.asLote === 'string') EP.cfg.asLote = c.asLote.trim();
    return 'configuração - peritos: ' + EP.cfg.peritos.length + ' / ignorados: ' + EP.cfg.ignorados.length
      + ' / asGeral: ' + (EP.cfg.asGeral.join(' + ') || '(nenhum)') + ' / asLote: ' + (EP.cfg.asLote || '(nenhuma)');
  };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const MES = { jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12 };
  const limpa = (s) => s.replace(/https?:\/\/\S+/g, '[URL]').replace(/\S*[?&]\w+=\S*/g, '[Q]').replace(/\b[0-9a-f]{16,}\b/gi, '[H]')
    .replace(/\s+/g, ' ').replace(/ ([ÁÉÍÓÚÂÊÔÃÕÇ]) /g, '$1').trim();
  // Grafia: sem acento, sem letra dobrada, sem "Dr./Dra." (ISABELLA = ISABELA, CONCEICAO = CONCEIÇÃO).
  const norm = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\bDRA?\b\.?/g, ' ')
    .replace(/[^A-Z ]/g, ' ').replace(/([A-Z])\1+/g, '$1').replace(/\s+/g, ' ').trim();
  const casaNome = (a, b) => {
    const x = norm(a), y = norm(b);
    if (!x || !y) return 'nao';
    if (x === y) return 'sim';
    // Mesmos nomes em outra ordem (FULANO DOS SANTOS SILVA = FULANO SILVA DOS SANTOS): mesmo perito, decisão do usuário.
    if (x.split(' ').sort().join(' ') === y.split(' ').sort().join(' ')) return 'sim';
    const ty = new Set(y.split(' '));
    return x.split(' ').filter((t) => t.length > 2 && ty.has(t)).length >= 2 ? 'parcial' : 'nao';
  };

  let pdfjs = null;
  const pdf = async () => {
    if (!pdfjs) { pdfjs = await import('/pje/js/pdfjs/build/pdf.mjs'); pdfjs.GlobalWorkerOptions.workerSrc = '/pje/js/pdfjs/build/pdf.worker.mjs'; }
    return pdfjs;
  };

  async function leDoc(id) {
    try {
      const r = await fetch('/pje/seam/resource/rest/pje-legacy/documento/download/' + id, { credentials: 'include' });
      if (!r.ok) return { ct: 'err', text: 'HTTP ' + r.status };
      const ct = r.headers.get('content-type') || '';
      const buf = await r.arrayBuffer();
      if (/pdf/i.test(ct)) {
        const doc = await (await pdf()).getDocument({ data: new Uint8Array(buf) }).promise;
        let out = '';
        for (let i = 1; i <= Math.min(doc.numPages, 3); i++) {
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
    let f = document.getElementById('__epQuadro' + k);
    if (!f) {
      f = document.createElement('iframe');
      f.id = '__epQuadro' + k;
      f.style.cssText = 'position:fixed;left:-12000px;top:0;width:1280px;height:900px;border:0';
      document.body.appendChild(f);
    }
    return f;
  }
  // Documento do iframe só se for do próprio PJe; tela de login (SSO) é outro domínio -> null.
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
    // Os autos abrem em janela nova: redireciona para o próprio iframe.
    f.contentWindow.open = (u) => { f.contentWindow.location.assign(u); return f.contentWindow; };
    link.click();
    const autos = await espera(() => { const dd = docQ(f); return dd && dd.title.includes(num) && dd.getElementById('divTimeLine') ? dd : null; }, 45000);
    if (!autos) return docQ(f) ? { erro: 'os autos não abriram' } : { login: true };
    await espera(() => docQ(f).querySelector('[id="navbar:listaTags"] td'), 3000);
    await sleep(800);
    return { d: docQ(f) };
  }

  function cronologia(d) {
    const linhas = d.getElementById('divTimeLine').innerText.split('\n').map((s) => s.trim()).filter(Boolean);
    let data = '';
    const docs = [], vistos = new Set();
    for (const l of linhas) {
      const m = l.match(/^(\d{2}) (jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez) (\d{4})$/);
      if (m) { data = m[1] + '/' + String(MES[m[2]]).padStart(2, '0') + '/' + m[3]; continue; }
      const x = l.match(/^(\d{8,10}) - (.+)$/);
      if (x && !vistos.has(x[1])) { vistos.add(x[1]); docs.push({ id: x[1], titulo: x[2].slice(0, 90), data }); }
    }
    return docs; // decrescente: índice menor = mais recente
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
          if (b.textContent.includes(id)) return n.textContent.trim().replace(/^Juntado por\s*/, '').replace(/ em \d.*$/, '').slice(0, 80);
          b = b.parentElement;
        }
      }
    }
    return '?não carregou';
  }
  const externo = (jp) => /POLO (ATIVO|PASSIVO)|ADVOGAD|PROCURAD|INSS|CEAB|INSTITUTO NACIONAL/i.test(jp || '');

  async function analisa(num, cfg, f) {
    const ab = await abre(num, f);
    if (ab.login) return { login: true };
    if (ab.erro || ab.naoAchou) return { linhas: [['X', num, '-', '', '', '', '', ab.erro || ab.motivo, '']], tentar: !!ab.erro };
    const d = ab.d;
    const docs = cronologia(d);
    for (let i = 0; i < docs.length; i += 6) await Promise.all(docs.slice(i, i + 6).map(async (x) => Object.assign(x, await leDoc(x.id))));
    const falhos = docs.filter((x) => x.ct === 'err' || x.ct === 'login');
    if (docs.length && falhos.length === docs.length) return { login: true }; // nada carregou: sessão provavelmente expirou
    // "Segredo de justiça? SIM/NÃO" fica no menu de detalhes do cabeçalho, oculto (innerText vem vazio; usar
    // textContent). O "?" é o ícone de ajuda do rótulo. Pelo texto visível, o sigilo não aparece.
    const sig = /Segredo de justi[çc]a\W*SIM/i.test(((d.getElementById('maisDetalhes') || {}).textContent || '').replace(/\s+/g, ' ')) ? 'sim' : 'não';
    // Etiquetas do processo: células da lista "navbar:listaTags" (menu de etiquetas do cabeçalho dos autos).
    const etiquetas = [...new Set([...d.querySelectorAll('[id="navbar:listaTags"] td')]
      .map((e) => e.textContent.trim()).filter((t) => t && t.length < 90))];
    // O aviso vem no singular ("Há 1 documento não lido") ou no plural, com ou sem "(s)".
    const naoLidos = () => { const m = d.body.innerText.match(/H[áa] (\d+) documentos?(\(s\))? n[ãa]o lido/i); return m ? +m[1] : 0; };
    const nl0 = naoLidos();

    const noms = [];
    docs.forEach((x, i) => {
      const t = x.text || '';
      if (!/NOMEA[ÇC][ÃA]O DE PROFISSIONAL/i.test(t)) return;
      const m = t.match(/Nome: (.+?) N\. CPF: ([\d.\-]+)/) || [];
      const nome = (m[1] || '').trim(), cpf = m[2] || '';
      const pi = cfg.peritos.findIndex((p) => (cpf && p.cpf === cpf) || casaNome(p.nome, nome) === 'sim');
      noms.push({ i, id: x.id, data: x.data, nome, cpf, pi });
    });

    const ips = [];
    docs.forEach((x, i) => {
      const t = x.text || '';
      let k = t.search(/INTIMA[ÇC][ÃA]O D[AE] PER[ÍI]CIA/i);
      if (k < 0 && /submeter [àa] per[íi]cia/i.test(t)) k = t.search(/seguinte endere[çc]o/i);
      if (k < 0) return;
      const s = t.slice(k);
      const per = ((s.match(/Dr\(?a?\)?\.?\s*(.+?),?\s*no seguinte endere[çc]o/i) || [])[1] || '').trim();
      const em = s.match(/no seguinte endere[çc]o:?\s*(.*?)\s*O\(a\) autor/i);
      ips.push({ i, id: x.id, data: x.data, per, end: em ? em[1].trim() : null });
    });

    // Nomeação ignorada pela configuração da unidade (SKILL.md, Passo 1): fica fora, como a de assistente social.
    const ignorado = (n) => (cfg.ignorados || []).some((p) => (n.cpf && p.cpf === n.cpf) || casaNome(p.nome, n.nome) === 'sim');
    // Etiqueta de assistente social: texto geral (asGeral) ou marca de lote (asLote) com o primeiro nome do nomeado.
    const eAS = (n) => { const prim = norm(n.nome).split(' ')[0]; return etiquetas.some((t) => (cfg.asGeral || []).some((g) => t.toUpperCase().includes(g.toUpperCase())) || (cfg.asLote && t.includes(cfg.asLote) && norm(t).includes(prim))); };
    // Só a ÚLTIMA certidão de nomeação interessa: é para ela que se precisa do endereço (decisão do usuário, 29/10/2026).
    // A cronologia é decrescente: o menor índice é o mais recente. As nomeações anteriores não são conferidas.
    const ult = noms.length ? noms.reduce((a, b) => (b.i < a.i ? b : a)) : null;
    const anteriores = ult ? noms.length - 1 : 0;
    // Última nomeação de perito médico: ela e a repetida no mesmo dia, do mesmo perito (nomeação em dobro).
    const med = ult && ult.pi >= 0 ? noms.filter((n) => n.pi === ult.pi && n.data === ult.data) : [];
    const antigaMed = med.length ? Math.max(...med.map((n) => n.i)) : -1;
    const laus = [];
    docs.forEach((x, i) => {
      if (i >= antigaMed || ips.some((p) => p.i === i)) return;
      const t = x.text || '';
      if (!/LAUDO (DE EXAME )?M[ÉE]DICO.{0,3}PERICIAL|M[ÉE]DICO\(?A?\)? PERIT[OA]|LAUDO PERICIAL/i.test(t) || /DOSSI[ÊE] M[ÉE]DICO/i.test(t)) return;
      const pm = ((t.match(/M[ÉE]DICO\(?A?\)? PERIT[OA]\(?A?\)?:?\s*(?:DRA?\.?\s*)?([A-Za-zÀ-ÿ ]{5,45})/i) || [])[1] || '').trim();
      laus.push({ i, id: x.id, data: x.data, pm });
    });
    for (const l of laus.slice(0, 8)) l.jp = await juntadoPor(d, l.id);
    const nl1 = naoLidos();

    const linhas = [];
    const cron = med.slice().sort((a, b) => b.i - a.i); // da mais antiga para a mais recente
    cron.forEach((n, k) => {
      // Nomeação em dobro (mesmo perito, mesmo dia): a janela vai até a próxima nomeação que não seja a repetida,
      // para valer a certidão juntada depois da segunda (decisão do usuário, SKILL.md).
      let j = k + 1;
      while (cron[j] && cron[j].pi === n.pi && cron[j].data === n.data) j++;
      const dobro = j > k + 1;
      const lim = cron[j] ? cron[j].i : -1;
      const nomeP = cfg.peritos[n.pi].nome;
      const laudo = laus.find((l) => l.i < n.i && (
        (l.jp && !l.jp.startsWith('?') && (casaNome(l.jp.split(' - ')[0], nomeP) !== 'nao' || /PERIT/i.test(l.jp))) ||
        (!externo(l.jp) && casaNome(l.pm, nomeP) !== 'nao')));
      if (laudo) { linhas.push(['R', num, n.id, n.pi, n.data, laudo.id, '', 'laudo de ' + laudo.data, sig]); return; }
      const janela = ips.filter((p) => p.i < n.i && p.i > lim);
      const casam = janela.filter((p) => casaNome(p.per, nomeP) === 'sim');
      const parciais = janela.filter((p) => casaNome(p.per, nomeP) === 'parcial');
      if (casam.length) {
        const ok = casam.filter((p) => p.end && p.end.replace(/[^A-Za-z0-9]/g, '').length >= 10);
        if (ok.length) linhas.push(['O', num, n.id, n.pi, n.data, ok.map((p) => p.id).sort().join(', '), [...new Set(ok.map((p) => p.end))], '', sig]);
        else if (casam.some((p) => p.end === null)) linhas.push(['V', num, n.id, n.pi, n.data, casam.map((p) => p.id).join(', '), '', 'certidão de intimação de perícia fora do padrão; conferir o endereço', sig]);
        else linhas.push(['B', num, n.id, n.pi, n.data, casam.map((p) => p.id).join(', '), '', 'certidão ' + casam.map((p) => p.id).join(', ') + ' sem endereço', sig]);
      } else if (parciais.length) {
        linhas.push(['V', num, n.id, n.pi, n.data, parciais.map((p) => p.id).join(', '), '', 'nome do perito na certidão só em parte igual ao nomeado: ' + parciais.map((p) => p.per).join(' / '), sig]);
      } else if (janela.length) {
        linhas.push(['D', num, n.id, n.pi, n.data, janela.map((p) => p.id).join(', '), '', 'certidão ' + janela.map((p) => p.id).join(', ') + ' cita ' + [...new Set(janela.map((p) => p.per || '(sem nome)'))].join(' / '), sig]);
      } else {
        linhas.push(['S', num, n.id, n.pi, n.data, '', '', '', sig]);
      }
      if (dobro) { const l = linhas[linhas.length - 1]; l[7] = (l[7] ? l[7] + '; ' : '') + 'nomeação em dobro do mesmo perito no mesmo dia'; }
    });
    if (ult && ult.pi < 0 && !ignorado(ult) && !eAS(ult)) {
      linhas.push(['V', num, ult.id, '', ult.data, '', '', 'última nomeação fora da lista de peritos médicos (' + ult.nome + ', CPF ' + ult.cpf + ') sem etiqueta de assistente social', sig]);
    }
    // Nomeação substituída: sem certidão ou com perito divergente, mas com nomeação posterior com certidão em ordem
    // (perícia cancelada, parte ausente, perito impedido) = em ordem, com a certidão da nova nomeação (decisão do usuário, SKILL.md).
    const posNom = {};
    cron.forEach((n) => { posNom[n.id] = n.i; });
    linhas.forEach((l) => {
      if (l[0] !== 'S' && l[0] !== 'D') return;
      const nova = linhas.filter((o) => o[0] === 'O' && posNom[o[2]] < posNom[l[2]]).sort((a, b) => posNom[b[2]] - posNom[a[2]])[0];
      if (!nova) return;
      const antes = (l[0] === 'S' ? 'sem certidão de endereço' : 'certidão com perito divergente') + (l[7] ? ' (' + l[7] + ')' : '');
      l[0] = 'O'; l[5] = nova[5]; l[6] = nova[6].slice();
      l[7] = 'nomeação substituída pela de ' + nova[4] + ' (' + nova[2] + '), com certidão em ordem; antes: ' + antes;
    });
    if (!med.length && !linhas.length) {
      linhas.push(['N', num, '-', '', '', '', '', !ult ? 'nenhuma nomeação'
        : 'última nomeação (' + ult.data + ', ' + ult.id + ') ' + (ignorado(ult) ? 'ignorada pela skill' : 'de assistente social') + ' (' + ult.nome + '): endereço de perícia médica não é necessário'
          + (anteriores ? '; ' + anteriores + ' nomeação(ões) anterior(es) não conferida(s)' : ''), sig]);
    }
    // Documento que não carregou pode ser justamente a certidão: não afirma falta de certidão no escuro.
    if (falhos.length) linhas.forEach((l) => { if ('SBD'.includes(l[0])) { l[0] = 'V'; l[7] = 'documentos que não carregaram: ' + falhos.map((x) => x.id).join(', '); } });
    const antMed = anteriores - (med.length > 1 ? med.length - 1 : 0);
    if (med.length && antMed > 0) linhas.forEach((l) => { l[7] = (l[7] ? l[7] + '; ' : '') + 'só a última nomeação conferida (' + antMed + ' anterior(es) fora)'; });
    if (nl1 !== nl0) linhas.forEach((l) => { l[7] = (l[7] ? l[7] + '; ' : '') + 'ATENÇÃO: contagem de não lidos mudou ' + nl0 + '→' + nl1; });
    return { linhas };
  }

  // Endereços viram chaves curtas para a saída caber no retorno do javascript_tool.
  function codifica(st, l) {
    const out = [];
    if (l[0] === 'O') {
      l[6] = l[6].map((e) => {
        let k = st.ends.indexOf(e);
        if (k < 0) { k = st.ends.push(e) - 1; out.push('E|' + k + '|' + e); }
        return k;
      }).join(',');
    }
    out.push(l.map((v) => String(v).replace(/[|\n\r]/g, ' ')).join('|'));
    return out;
  }

  EP.inicia = function (lista, cfg) {
    if (EP.st && EP.st.rodando) return 'já está rodando';
    if (!EP.cfg.peritos.length) return 'configure os peritos médicos antes de iniciar: window.__EP.config({ peritos: [...], ignorados: [...], asGeral: [...], asLote: ... }), com os valores de docs/configuracao-unidade.md (seções Comum — Peritos médicos e jef-endereco-pericia)';
    cfg = Object.assign({}, cfg || {}, { peritos: EP.cfg.peritos, ignorados: EP.cfg.ignorados, asGeral: EP.cfg.asGeral, asLote: EP.cfg.asLote });
    const st = (EP.st = { lista, cfg, prox: 0, idx: 0, res: [], ends: [], semLogin: [], rodando: true, parada: '', t0: Date.now() });
    const trabalhador = async (k) => {
      const f = quadro(k);
      while (!st.parada && !st.pedirParada && st.prox < st.lista.length) {
        const num = st.lista[st.prox++];
        let r;
        // Falha passageira do PJe (tela de erro, autos que não abriram): tenta mais uma vez.
        for (let t = 0; t < 2; t++) {
          try { r = await analisa(num, st.cfg, f); } catch (e) { r = { linhas: [['X', num, '-', '', '', '', '', 'erro na leitura: ' + String(e).slice(0, 60), '']], tentar: true }; }
          if (!r.tentar) break;
          await sleep(3000);
        }
        if (r.login) { st.parada = 'login'; st.semLogin.push(num); break; }
        r.linhas.forEach((l) => st.res.push(...codifica(st, l)));
        st.idx++;
      }
    };
    const n = Math.max(1, Math.min(cfg.paralelo || 1, 4));
    // Sem Array.from(..., fn): o PJe carrega Prototype.js, que troca Array.from por uma versão sem função de mapeamento.
    const trabalhos = [];
    for (let k = 0; k < n; k++) trabalhos.push(trabalhador(k));
    Promise.all(trabalhos).then(() => {
      if (!st.parada && st.pedirParada) st.parada = 'interrompido';
      st.rodando = false;
    });
    return 'iniciado: ' + lista.length + ' processos, ' + n + ' por vez';
  };

  EP.le = async function (desde, espMax) {
    const st = EP.st;
    if (!st) return 'P|0/0|parado|sem execução||0s|ate:0';
    const t0 = Date.now();
    while (st.rodando && st.res.length - desde < 8 && Date.now() - t0 < Math.min(espMax || 10000, 15000)) await sleep(1000);
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
    // "ate:" e não "ate=": com "=" e uma observação com ";" na mesma saída, o javascript_tool bloqueia o retorno (parece cookie).
    return ['P|' + st.idx + '/' + st.lista.length + '|' + (st.rodando ? 'rodando' : 'parado') + '|' + parada + '|' + seg + 's|ate:' + i, ...out].join('\n');
  };

  EP.para = function () { if (EP.st) EP.st.pedirParada = true; return 'vai parar após o processo em curso'; };
  return 'EP v' + EP.versao + ' carregado';
})();
