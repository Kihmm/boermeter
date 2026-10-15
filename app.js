/* Boermeter: naam kiezen, boer of scheet kiezen, live meten, proficiat, dagscore, scorebord. */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const body = document.body;
  const CFG = window.BOERMETER_DEMO || {
    demo: false,
    spelers: JSON.parse(body.dataset.spelers || '[]'),
    offset: parseFloat(body.dataset.offset || '100'),
    drempel: parseFloat(body.dataset.drempel || '0.2'),
    luid: parseFloat(body.dataset.luid || '85'),
  };
  const MIN = 40, MAX = 120, BOOG = 603.2, R = 128;
  const KLASSE = { boer: 53, scheet: 55 }, STILTE = 494;
  const LABELS = {
    0: 'praten', 5: 'praten', 6: 'roepen', 9: 'roepen', 11: 'gillen', 13: 'lachen', 24: 'zingen', 33: 'kreunen',
    34: 'grommen', 35: 'fluiten', 36: 'ademen', 38: 'snurken', 42: 'hoesten', 43: 'keelschrapen', 44: 'niezen',
    51: 'gorgelen', 52: 'buikgerommel', 54: 'de hik', 56: 'klappen', 57: 'vingerknippen', 58: 'klappen', 69: 'een hond',
    132: 'muziek', 133: 'muziek', 294: 'verkeer', 348: 'een deur', 352: 'een deur', 353: 'kloppen', 354: 'tikken',
  };
  const WOORD = { boer: { een: 'boer', proficiat: 'Proficiat, stevig boerke' }, scheet: { een: 'scheet', proficiat: 'Proficiat, stevig scheetje' } };
  const fmt = (v) => v.toFixed(1).replace('.', ',');
  const opslag = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* geen opslag */ } },
  };

  let speler = null, soort = 'boer', stand = null, vorigScherm = 'naam', huidig = 'naam', bordTab = 'vandaag', meesteSub = 'totaal';

  /* ---------------- schermen ---------------- */
  function toon(naam) {
    if (naam === 'terug') naam = (vorigScherm === 'naam' || vorigScherm === 'soort') ? vorigScherm : (speler ? 'soort' : 'naam');
    if (naam !== huidig) vorigScherm = huidig;
    if (huidig === 'meter' && naam !== 'meter') oor.stop();
    document.querySelectorAll('.scherm').forEach((s) => s.classList.toggle('actief', s.id === 's-' + naam));
    huidig = naam;
    if (naam === 'bord') { tekenBord(); laadStand().then(tekenBord); }
  }
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-naar]');
    if (t) toon(t.dataset.naar);
  });

  /* ---------------- namen ---------------- */
  function tekenNamen() {
    const vorige = opslag.get('boermeter-naam');
    const box = $('namen'); box.innerHTML = '';
    CFG.spelers.forEach((n) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'naam' + (n === vorige ? ' vorige' : '');
      const ini = document.createElement('span'); ini.className = 'ini'; ini.textContent = n.charAt(0);
      const nm = document.createElement('span'); nm.textContent = n;
      b.append(ini, nm);
      if (n === vorige) { const v = document.createElement('span'); v.className = 'vorige-tekst'; v.textContent = 'vorige keer'; b.append(v); }
      b.addEventListener('click', () => { speler = n; opslag.set('boermeter-naam', n); $('soort-naam').textContent = n; toon('soort'); });
      box.appendChild(b);
    });
  }

  document.querySelectorAll('[data-soort]').forEach((b) => b.addEventListener('click', () => {
    soort = b.dataset.soort; startMeter();
  }));

  /* ---------------- meter ---------------- */
  const ring = $('ring-waarde'), piekDot = $('ring-piek'), meterDb = $('meter-db'), meterTekst = $('meter-tekst');
  let piekSessie = 0, tekstTimer = null;
  function zetMeter(v) {
    const f = Math.max(0, Math.min(1, (v - MIN) / (MAX - MIN)));
    ring.style.strokeDashoffset = String(BOOG * (1 - f));
    meterDb.textContent = v <= 0 ? '--' : Math.round(v);
    if (v > piekSessie && v >= MIN) {
      piekSessie = v;
      const a = (135 + f * 270) * Math.PI / 180;
      piekDot.setAttribute('cx', String(150 + R * Math.cos(a)));
      piekDot.setAttribute('cy', String(150 + R * Math.sin(a)));
      piekDot.setAttribute('opacity', '1');
    }
  }
  function zegt(tekst, nee, ms) {
    clearTimeout(tekstTimer);
    meterTekst.textContent = tekst; meterTekst.classList.toggle('nee', !!nee);
    if (ms) tekstTimer = setTimeout(() => zegt(luisterTekst()), ms);
  }
  const luisterTekst = () => `Ik luister. Laat maar een ${WOORD[soort].een}.`;

  function startMeter() {
    body.classList.toggle('scheet', soort === 'scheet');
    $('meter-tag').textContent = `${speler}: ${WOORD[soort].een}`;
    piekSessie = 0; piekDot.setAttribute('opacity', '0'); zetMeter(0);
    if (CFG.demo) $('demo-ja').textContent = `Test: echte ${WOORD[soort].een}`;
    toon('meter');
    oor.start();
  }
  $('meter-stop').addEventListener('click', () => toon('soort'));

  /* Beoordeling van wat het model hoorde */
  function beoordeel(scores) {
    const doel = KLASSE[soort], ander = soort === 'boer' ? KLASSE.scheet : KLASSE.boer;
    let top = -1, topV = -1;
    for (let i = 0; i < scores.length; i++) if (i !== STILTE && scores[i] > topV) { topV = scores[i]; top = i; }
    const d = CFG.drempel;
    if (scores[doel] >= d || (top === doel && scores[doel] >= d * 0.4)) return { ok: true, zekerheid: scores[doel] };
    if (scores[ander] >= d || top === ander) {
      return { ok: false, tekst: soort === 'boer' ? 'Dat was een scheet, geen boer. Kies Scheet om die te meten.' : 'Dat was een boer, geen scheet. Kies Boer om die te meten.' };
    }
    const l = LABELS[top];
    return { ok: false, tekst: l ? `Dat klonk als ${l}. Telt niet.` : `Dat was geen ${WOORD[soort].een}. Telt niet.` };
  }

  /* ---------------- oor: microfoon + herkenning ---------------- */
  const oor = CFG.demo ? maakDemoOor() : maakEchtOor();

  function maakEchtOor() {
    let ctx = null, stream = null, proc = null, model = null, modelBelofte = null, actief = false, bezig = false;
    let ring48 = null, schrijf = 0, rate = 48000, omgeving = 45, gebeurtenis = null, stilSinds = 0, wake = null, klaar = false;

    function laadModel() {
      if (!modelBelofte) {
        modelBelofte = (async () => {
          let ok = false; try { ok = await tf.setBackend('webgl'); } catch (e) { ok = false; } if (!ok) await tf.setBackend('cpu');
          await tf.ready();
          const m = await tf.loadGraphModel('model/model.json');
          tf.tidy(() => m.execute(tf.zeros([16000]), 'Identity:0'));
          return m;
        })();
      }
      return modelBelofte;
    }

    function knip(van, tot) {
      const n = ring48.length, len = Math.min(n, Math.max(0, tot - van)), out = new Float32Array(len);
      for (let i = 0; i < len; i++) out[i] = ring48[(van + i) % n];
      return out;
    }
    function naar16k(x) {
      const r = rate / 16000, n = Math.floor(x.length / r);
      const min = 15600, len = Math.max(n, min), out = new Float32Array(len), pad = Math.floor((len - n) / 2);
      for (let i = 0; i < n; i++) {
        const a = Math.floor(i * r), b = Math.min(x.length, Math.floor((i + 1) * r));
        let s = 0; for (let j = a; j < b; j++) s += x[j]; out[pad + i] = s / Math.max(1, b - a);
      }
      return out;
    }

    async function klassificeer(geluid, piek) {
      bezig = true;
      zegt('Even luisteren wat dat was.');
      try {
        const m = await laadModel();
        const x = naar16k(geluid);
        const scores = tf.tidy(() => m.execute(tf.tensor1d(x), 'Identity:0').max(0).arraySync());
        const oordeel = beoordeel(scores);
        if (oordeel.ok && actief) { stop(); toonProficiat(piek, oordeel.zekerheid); }
        else if (actief) zegt(oordeel.tekst, true, 3200);
      } catch (e) {
        zegt('De herkenning lukte niet. Probeer opnieuw.', true, 3000);
      }
      bezig = false;
    }

    function verwerk(input) {
      let s = 0; for (let i = 0; i < input.length; i++) { const v = input[i]; s += v * v; ring48[schrijf % ring48.length] = v; schrijf++; }
      const db = Math.max(20, 20 * Math.log10(Math.max(Math.sqrt(s / input.length), 1e-6)) + CFG.offset);
      zetMeter(db);
      if (bezig || !klaar) return;
      const nu = schrijf, start = Math.max(55, omgeving + 12), einde = Math.max(48, omgeving + 6);
      if (!gebeurtenis) {
        omgeving = omgeving * 0.97 + Math.min(db, 70) * 0.03;
        if (db >= start) { gebeurtenis = { van: Math.max(0, nu - input.length - Math.round(rate * 0.25)), piek: db }; stilSinds = 0; }
      } else {
        if (db > gebeurtenis.piek) gebeurtenis.piek = db;
        if (db < einde) { if (!stilSinds) stilSinds = nu; } else stilSinds = 0;
        const lang = nu - gebeurtenis.van > rate * 4;
        if ((stilSinds && nu - stilSinds > rate * 0.35) || lang) {
          const g = gebeurtenis; gebeurtenis = null; stilSinds = 0;
          klassificeer(knip(g.van, nu), g.piek);
        }
      }
    }

    async function start() {
      actief = true; bezig = false; gebeurtenis = null; klaar = false; omgeving = 45;
      document.getElementById('meter-wrap').classList.add('ring-laden');
      zegt('Oren worden opgewarmd.');
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      } catch (e) {
        zegt('Geen toegang tot de microfoon. Geef de app toegang in de instellingen van je gsm en probeer opnieuw.', true);
        return;
      }
      if (!actief) { stream.getTracks().forEach((t) => t.stop()); return; }
      const C = window.AudioContext || window.webkitAudioContext;
      ctx = new C(); if (ctx.state === 'suspended') await ctx.resume();
      rate = ctx.sampleRate; ring48 = new Float32Array(Math.round(rate * 6)); schrijf = 0;
      const bron = ctx.createMediaStreamSource(stream);
      proc = ctx.createScriptProcessor(2048, 1, 1);
      const stil = ctx.createGain(); stil.gain.value = 0;
      proc.onaudioprocess = (ev) => { if (actief) verwerk(ev.inputBuffer.getChannelData(0)); };
      bron.connect(proc); proc.connect(stil); stil.connect(ctx.destination);
      try { if (navigator.wakeLock) wake = await navigator.wakeLock.request('screen'); } catch (e) { /* geen wake lock */ }
      try { await laadModel(); } catch (e) { zegt('De herkenning kon niet laden. Controleer je internet en probeer opnieuw.', true); return; }
      document.getElementById('meter-wrap').classList.remove('ring-laden');
      klaar = true;
      if (actief && !bezig) zegt(luisterTekst());
    }
    function stop() {
      actief = false;
      if (proc) { proc.onaudioprocess = null; try { proc.disconnect(); } catch (e) { /* al los */ } proc = null; }
      if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
      if (ctx) { ctx.close().catch(() => {}); ctx = null; }
      if (wake) { wake.release().catch(() => {}); wake = null; }
    }
    return { start, stop };
  }

  function maakDemoOor() {
    let actief = false, t = null, niveau = 44, doel = 44, bezig = false;
    function lus() {
      niveau += (doel - niveau) * 0.25 + (Math.random() - 0.5) * 1.6;
      zetMeter(niveau);
      if (actief) t = setTimeout(lus, 60);
    }
    function piek(hoog, daarna) {
      if (bezig || !actief) return; bezig = true;
      doel = hoog; setTimeout(() => { doel = 44; zegt('Even luisteren wat dat was.'); setTimeout(() => { bezig = false; daarna(); }, 700); }, 650);
    }
    $('demo-ja').addEventListener('click', () => { const v = 74 + Math.random() * 24; piek(v, () => { stop(); toonProficiat(v, 0.8); }); });
    $('demo-nee').addEventListener('click', () => piek(68, () => zegt('Dat klonk als praten. Telt niet.', true, 3200)));
    function start() {
      actief = true; niveau = 30; doel = 44; bezig = false;
      const w = document.getElementById('meter-wrap'); w.classList.add('ring-laden'); zegt('Oren worden opgewarmd.');
      setTimeout(() => { w.classList.remove('ring-laden'); if (actief) zegt(luisterTekst()); }, 900);
      lus();
    }
    function stop() { actief = false; clearTimeout(t); }
    return { start, stop };
  }

  /* ---------------- data ---------------- */
  const api = CFG.demo ? maakDemoApi() : {
    async stand() { const r = await fetch('api.php?a=stand', { credentials: 'same-origin', cache: 'no-store' }); if (!r.ok) throw new Error(r.status); return r.json(); },
    async bewaar(d) {
      const r = await fetch('api.php?a=bewaar', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) });
      const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.fout || 'Bewaren lukte niet.'); return j;
    },
  };
  async function laadStand() { try { stand = await api.stand(); } catch (e) { /* toon oude stand */ } return stand; }

  function maakDemoApi() {
    const nu = new Date(), id = { n: 100 };
    const t = (h, m) => { const d = new Date(nu); d.setHours(h, m, 0, 0); return d.toISOString(); };
    const S = (i) => CFG.spelers[i % CFG.spelers.length];
    const rijen = [[2, 'boer', 91.4, 9, 12], [1, 'scheet', 78.2, 10, 3], [3, 'boer', 84.9, 11, 40], [0, 'boer', 72.5, 12, 55], [4, 'scheet', 69.8, 13, 20]]
      .map(([p, so, db, h, m], i) => ({ id: i + 1, speler: S(p), soort: so, db, tijd: t(h, m) }));
    const oud = [[0, 'boer', 96.1], [2, 'scheet', 88.3], [3, 'scheet', 81.0], [4, 'boer', 89.7], [1, 'boer', 86.2]]
      .map(([p, so, db], i) => ({ id: 50 + i, speler: S(p), soort: so, db, tijd: '2026-10-01T12:00:00' }));
    const extraLijst = [[9, 3], [5, 7], [12, 4], [6, 6], [8, 2]];
    const extra = {}; CFG.spelers.forEach((p, i) => { extra[p] = extraLijst[i % extraLijst.length]; });
    function bereken() {
      const alle = rijen.concat(oud);
      const top = (s) => alle.filter((r) => r.soort === s).sort((a, b) => b.db - a.db).slice(0, 10);
      const aantallen = CFG.spelers.map((p) => ({ speler: p, boer: extra[p][0] + alle.filter((r) => r.speler === p && r.soort === 'boer').length, scheet: extra[p][1] + alle.filter((r) => r.speler === p && r.soort === 'scheet').length }))
        .sort((a, b) => (b.boer + b.scheet) - (a.boer + a.scheet));
      const eerste = {};
      ['boer', 'scheet'].forEach((so) => { const r = rijen.filter((x) => x.soort === so).sort((a, b) => new Date(a.tijd) - new Date(b.tijd) || a.id - b.id)[0]; eerste[so] = r ? r.id : null; });
      return { vandaag: rijen.slice().sort((a, b) => b.db - a.db || a.id - b.id), top: { boer: top('boer'), scheet: top('scheet') }, aantallen, eerste };
    }
    return {
      async stand() { return bereken(); },
      async bewaar(d) { const r = { id: ++id.n, speler: d.speler, soort: d.soort, db: Math.round(d.db * 10) / 10, tijd: new Date().toISOString() }; rijen.push(r); return { id: r.id, stand: bereken() }; },
    };
  }

  /* Zorgt dat een scherm nooit scrolt: verwijdert onderaan rijen tot alles past (de eigen rij blijft). */
  function pasIn(scherm, lijst, behoud) {
    let veilig = 60;
    while (scherm.scrollHeight > scherm.clientHeight + 1 && veilig-- > 0) {
      const kids = Array.from(lijst.children).filter((li) => li !== behoud);
      if (kids.length <= 1) break;
      kids[kids.length - 1].remove();
    }
  }

  /* ---------------- rijen ---------------- */
  function uur(tijd) {
    if (!tijd) return '';
    if (tijd.indexOf('T') > -1) { const d = new Date(tijd); return isNaN(d) ? '' : d.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' }); }
    const m = /(\d{2}):(\d{2})/.exec(tijd); return m ? m[1] + ':' + m[2] : '';
  }
  function isEerste(r) { return !!(stand && stand.eerste && stand.eerste[r.soort] === r.id); }
  function rij(r, plaats, opties) {
    const o = opties || {};
    const li = document.createElement('li');
    li.className = 'rij' + (plaats === 1 ? ' goud' : '') + (o.nieuw ? ' nieuw' : '');
    const p = document.createElement('span'); p.className = 'plaats'; p.textContent = plaats;
    const w = document.createElement('span'); w.className = 'wie';
    const nm = document.createElement('span'); nm.className = 'naam-tekst'; nm.textContent = r.speler;
    w.append(nm);
    if (o.dag) {
      const meta = document.createElement('span'); meta.className = 'meta';
      const u = document.createElement('span'); u.className = 'uur'; u.textContent = uur(r.tijd);
      meta.append(u);
      if (isEerste(r)) { const t = document.createElement('span'); t.className = 'eerste ' + r.soort; t.textContent = '1ste ' + r.soort; meta.append(t); }
      w.append(meta);
    }
    const s = document.createElement('span'); s.className = 'soort ' + r.soort; s.textContent = r.soort;
    const v = document.createElement('span'); v.className = 'waarde'; v.textContent = fmt(r.db) + ' dB';
    li.append(p, w, s, v);
    if (o.id) li.dataset.id = r.id;
    return li;
  }
  function leeg(tekst) { const li = document.createElement('li'); li.className = 'rij leeg'; li.textContent = tekst; return li; }

  /* ---------------- proficiat en dagscore ---------------- */
  async function toonProficiat(db, zekerheid) {
    const waarde = Math.round(db * 10) / 10;
    $('kaart-tekst').textContent = (soort === 'scheet' && waarde >= CFG.luid) ? 'Stevig scheetje, zat precies wat sap bij!' : WOORD[soort].proficiat;
    $('kaart-db').textContent = fmt(waarde) + ' dB';
    const kaart = $('kaart'), dag = $('dag'), na = $('na'), lijst = $('dag-lijst');
    if (kaart.getAnimations) kaart.getAnimations({ subtree: true }).forEach((an) => an.cancel());
    $('plaats-tekst').hidden = true;
    kaart.style.cssText = ''; kaart.hidden = false; kaart.classList.remove('pop'); void kaart.offsetWidth; kaart.classList.add('pop');
    dag.classList.remove('zichtbaar'); na.classList.remove('zichtbaar'); lijst.innerHTML = '';
    toon('proficiat');
    confetti();
    const wacht = new Promise((r) => setTimeout(r, 2200));
    let nieuweId = null, fout = null;
    try { const res = await api.bewaar({ speler, soort, db: waarde, zekerheid }); nieuweId = res.id; stand = res.stand; }
    catch (e) { fout = e.message || 'Bewaren lukte niet.'; }
    await wacht;
    if (fout) { lijst.append(leeg(fout)); dag.classList.add('zichtbaar'); na.classList.add('zichtbaar'); return; }
    plaatsInDagscore(nieuweId);
  }

  function plaatsInDagscore(nieuweId) {
    const kaart = $('kaart'), dag = $('dag'), na = $('na'), lijst = $('dag-lijst');
    const rijen = (stand && stand.vandaag) || [];
    const idx = rijen.findIndex((r) => r.id === nieuweId);
    const tonen = rijen.slice(0, 8);
    if (idx >= 8) tonen.push(rijen[idx]);
    lijst.innerHTML = '';
    let doelRij = null;
    tonen.forEach((r) => {
      const plaats = rijen.indexOf(r) + 1;
      const li = rij(r, plaats, { nieuw: r.id === nieuweId, id: true, dag: true });
      if (r.id === nieuweId) { doelRij = li; li.style.visibility = 'hidden'; }
      lijst.append(li);
    });
    pasIn($('s-proficiat'), lijst, doelRij);
    dag.classList.add('zichtbaar');
    function toonPlaats(vanaf) {
      const pt = $('plaats-tekst'); pt.textContent = '';
      const s = document.createElement('span'), doel = idx + 1;
      pt.append(`${speler} staat `, s, ' vandaag');
      pt.hidden = false;
      let nu = Math.max(doel, vanaf || doel);
      s.textContent = nu + 'e';
      const tik = () => { if (nu > doel) { nu--; s.textContent = nu + 'e'; setTimeout(tik, 110); } };
      setTimeout(tik, 260);
    }
    const zonderAnimatie = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!doelRij || zonderAnimatie || !kaart.animate) {
      if (doelRij) doelRij.style.visibility = ''; kaart.hidden = true; toonPlaats(); na.classList.add('zichtbaar'); return;
    }
    // Overgang: de kaart schuift zonder vervorming naar haar plaats in de lijst en wordt daar de rij.
    // Ondertussen verschijnen de andere scores en schuiven de rijen eronder open.
    const alle = Array.from(lijst.children), pos = alle.indexOf(doelRij);
    const hoogte = doelRij.getBoundingClientRect().height;
    const DUUR = 1300, OPEN_START = 200;
    alle.forEach((li, i) => {
      if (li === doelRij) return;
      const onder = i > pos;
      li.animate([{ opacity: 0, transform: `translateY(${(onder ? -hoogte : 0) + 10}px)` }, { opacity: 1, transform: `translateY(${onder ? -hoogte : 0}px)` }],
        { duration: 420, delay: 120 + i * 80, easing: 'ease-out', fill: 'backwards' });
      if (onder) {
        li.animate([{ transform: `translateY(${-hoogte}px)` }, { transform: 'none' }],
          { duration: 650, delay: OPEN_START + (i - pos) * 50, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'backwards' });
      }
    });
    const a = kaart.getBoundingClientRect(), b = doelRij.getBoundingClientRect();
    const zacht = getComputedStyle(body).getPropertyValue('--kleur-zacht').trim() || '#EAF0FE';
    const sterk = getComputedStyle(kaart).backgroundColor;
    if (kaart.getAnimations) kaart.getAnimations().forEach((an) => an.cancel());
    kaart.classList.remove('pop');
    Object.assign(kaart.style, { position: 'fixed', zIndex: '20', left: a.left + 'px', top: a.top + 'px', width: a.width + 'px', height: a.height + 'px', margin: '0' });
    const inhoud = kaart.children;
    Array.from(inhoud).forEach((el) => el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: DUUR * 0.55, delay: DUUR * 0.35, easing: 'ease-in', fill: 'forwards' }));
    kaart.animate([
      { left: a.left + 'px', top: a.top + 'px', width: a.width + 'px', height: a.height + 'px', borderRadius: '20px', backgroundColor: sterk },
      { left: b.left + 'px', top: b.top + 'px', width: b.width + 'px', height: b.height + 'px', borderRadius: '12px', backgroundColor: zacht },
    ], { duration: DUUR, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'forwards' });
    doelRij.style.visibility = '';
    doelRij.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 380, delay: DUUR - 300, easing: 'ease-out', fill: 'backwards' }).finished.then(() => {
      kaart.hidden = true;
      kaart.style.cssText = '';
      toonPlaats(tonen.length);
      setTimeout(() => na.classList.add('zichtbaar'), 400);
    });
  }
  $('nog-eens').addEventListener('click', startMeter);

  /* ---------------- confetti ---------------- */
  function confetti(ox, oy, aantal, kracht) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    ox = ox == null ? innerWidth / 2 : ox; oy = oy == null ? innerHeight * 0.32 : oy; aantal = aantal || 120; kracht = kracht || 13;
    const c = $('confetti'), g = c.getContext('2d'), dpr = window.devicePixelRatio || 1;
    c.width = innerWidth * dpr; c.height = innerHeight * dpr; g.scale(dpr, dpr);
    const kleuren = ['#2563EB', '#D9480F', '#14171C', '#F5B700'];
    const stukjes = Array.from({ length: aantal }, () => ({
      x: ox, y: oy, vx: (Math.random() - 0.5) * kracht, vy: -Math.random() * kracht - 4,
      r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3, w: 6 + Math.random() * 6, h: 3 + Math.random() * 4,
      k: kleuren[Math.floor(Math.random() * kleuren.length)],
    }));
    const t0 = performance.now();
    (function teken(t) {
      g.clearRect(0, 0, innerWidth, innerHeight);
      stukjes.forEach((p) => { p.vy += 0.32; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.fillStyle = p.k; g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); g.restore(); });
      if (t - t0 < 2600) requestAnimationFrame(teken); else g.clearRect(0, 0, innerWidth, innerHeight);
    })(t0);
  }

  /* ---------------- scorebord ---------------- */
  const UITLEG = { vandaag: 'Alle metingen van vandaag, luidste eerst', boer: 'Luidste boeren ooit', scheet: 'Luidste scheten ooit', meeste: 'Wie liet er het meeste, sinds de start' };
  document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => { bordTab = t.dataset.tab; tekenBord(); }));
  document.querySelectorAll('.subtab').forEach((t) => t.addEventListener('click', () => { meesteSub = t.dataset.sub; tekenBord(); }));
  function tekenBord() {
    document.querySelectorAll('.tab').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.tab === bordTab)));
    $('bord-uitleg').textContent = UITLEG[bordTab];
    const lijst = $('bord-lijst'); lijst.innerHTML = '';
    if (!stand) { lijst.append(leeg('Scorebord laden.')); return; }
    $('subtabs').hidden = bordTab !== 'meeste';
    if (bordTab === 'meeste') {
      document.querySelectorAll('.subtab').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.sub === meesteSub)));
      const tel = (a) => meesteSub === 'totaal' ? a.boer + a.scheet : a[meesteSub];
      const lijstje = stand.aantallen.slice().sort((x, y) => tel(y) - tel(x) || (y.boer + y.scheet) - (x.boer + x.scheet));
      const hoogst = Math.max(1, ...lijstje.map(tel));
      lijstje.forEach((a, i) => {
        const li = document.createElement('li'); li.className = 'rij meeste' + (i === 0 && tel(a) > 0 ? ' goud' : '');
        const p = document.createElement('span'); p.className = 'plaats'; p.textContent = i + 1;
        const w = document.createElement('span'); w.className = 'wie'; w.textContent = a.speler;
        const d = document.createElement('span'); d.className = 'aantallen'; d.textContent = `${a.boer} boeren, ${a.scheet} scheten`;
        const v = document.createElement('span'); v.className = 'waarde'; v.textContent = tel(a);
        const balk = document.createElement('span'); balk.className = 'verdeling';
        const bb = document.createElement('i'); bb.className = 'b'; const bs = document.createElement('i'); bs.className = 's';
        const tot = a.boer + a.scheet, schaal = (meesteSub === 'totaal' ? tot : tel(a)) / hoogst;
        if (meesteSub === 'totaal') { bb.style.width = (tot ? a.boer / tot * schaal * 100 : 0) + '%'; bs.style.width = (tot ? a.scheet / tot * schaal * 100 : 0) + '%'; }
        else if (meesteSub === 'boer') { bb.style.width = schaal * 100 + '%'; bs.style.width = '0'; }
        else { bb.style.width = '0'; bs.style.width = schaal * 100 + '%'; }
        balk.append(bb, bs);
        li.append(p, w, d, v, balk); lijst.append(li);
      });
      pasIn($('s-bord'), lijst);
      return;
    }
    const rijen = bordTab === 'vandaag' ? stand.vandaag : stand.top[bordTab];
    if (!rijen.length) { lijst.append(leeg(bordTab === 'vandaag' ? 'Vandaag nog niets gemeten.' : 'Nog niets gemeten.')); return; }
    rijen.forEach((r, i) => lijst.append(rij(r, i + 1, { dag: bordTab === 'vandaag' })));
    pasIn($('s-bord'), lijst);
  }

  /* ---------------- start ---------------- */
  if (CFG.demo) { $('demo-band').hidden = false; $('demo-knoppen').hidden = false; }
  tekenNamen();
  laadStand();
  if (!CFG.demo && 'serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
