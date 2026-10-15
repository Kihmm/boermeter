<?php
// Boermeter: opent enkel met de geheime link (?k=...) of de bewaarde cookie.
declare(strict_types=1);
require __DIR__ . '/inc.php';

bm_headers();
if (!bm_sleutel_ok()) bm_niet_gevonden();
bm_onthoud();

$c = bm_config();
$v = '15';
$sleutel = rawurlencode($c['sleutel']);
header("Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src 'self'; worker-src 'self'; manifest-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
header('Cache-Control: no-store');
$h = fn($s) => htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8');
?><!doctype html>
<html lang="nl-BE">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex,nofollow">
<meta name="theme-color" content="#FFFFFF">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="Boermeter">
<title>Boermeter</title>
<link rel="manifest" href="manifest.php?k=<?= $sleutel ?>">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<link rel="icon" href="icons/icon-192.png">
<link rel="stylesheet" href="app.css?v=<?= $v ?>">
</head>
<body data-spelers="<?= $h(json_encode($c['spelers'], JSON_UNESCAPED_UNICODE)) ?>" data-offset="<?= $h($c['db_offset'] ?? 100) ?>" data-drempel="<?= $h($c['drempel'] ?? 0.2) ?>" data-luid="<?= $h($c['luide_scheet'] ?? 85) ?>">
<!-- APP-START -->
<main id="app">
  <section id="s-naam" class="scherm actief" aria-label="Kies je naam">
    <header class="top"><h1 class="logo"><i aria-hidden="true"></i>Boermeter</h1><button class="link" type="button" data-naar="bord">Scorebord</button></header>
    <p class="demo-band" id="demo-band" hidden>Voorbeeld met verzonnen scores. De echte app meet live met de microfoon van je gsm.</p>
    <h2 class="vraag">Wie ben jij?</h2>
    <div class="namen" id="namen"></div>
  </section>

  <section id="s-soort" class="scherm" aria-label="Kies boer of scheet">
    <header class="top"><button class="terug" type="button" data-naar="naam">Andere naam</button></header>
    <h2 class="vraag">Hoi <span id="soort-naam"></span>.<br>Wat ga je doen?</h2>
    <div class="keuze">
      <button class="kies boer" type="button" data-soort="boer"><img class="kies-tekening" src="img/boer.svg?v=13" alt=""><span class="kies-woord">Boer</span><span class="kies-sub">Langs boven</span></button>
      <button class="kies scheet" type="button" data-soort="scheet"><img class="kies-tekening" src="img/scheet.svg?v=13" alt=""><span class="kies-woord">Scheet</span><span class="kies-sub">Langs onder</span></button>
    </div>
  </section>

  <section id="s-meter" class="scherm" aria-label="Meter">
    <header class="top"><button class="terug" type="button" id="meter-stop">Stop</button><span class="tag" id="meter-tag"></span></header>
    <div class="meter-wrap" id="meter-wrap">
      <svg viewBox="0 0 300 300" aria-hidden="true">
        <circle class="ring-spoor" cx="150" cy="150" r="128" fill="none" stroke="#EEF0F3" stroke-width="16" stroke-linecap="round" stroke-dasharray="603.2 804.2" transform="rotate(135 150 150)"/>
        <circle class="ring-waarde" id="ring-waarde" cx="150" cy="150" r="128" fill="none" stroke="currentColor" stroke-width="16" stroke-linecap="round" stroke-dasharray="603.2 804.2" stroke-dashoffset="603.2" transform="rotate(135 150 150)"/>
        <circle id="ring-piek" cx="150" cy="150" r="5" fill="#14171C" opacity="0"/>
        <text x="62" y="262" fill="#6A7079" font-size="13" text-anchor="middle">40</text>
        <text x="238" y="262" fill="#6A7079" font-size="13" text-anchor="middle">120</text>
      </svg>
      <div class="meter-num" aria-live="off"><span id="meter-db">--</span><span class="eenheid">dB</span></div>
    </div>
    <p class="meter-tekst" id="meter-tekst" aria-live="polite">Oren worden opgewarmd.</p>
    <p class="meter-hulp" id="meter-hulp">Hou je gsm op een armlengte. Enkel echte boeren en scheten tellen.</p>
    <div class="demo-knoppen" id="demo-knoppen" hidden>
      <button class="knop klein" type="button" id="demo-ja">Test: echte boer</button>
      <button class="knop klein" type="button" id="demo-nee">Test: praten</button>
    </div>
  </section>

  <section id="s-proficiat" class="scherm" aria-label="Resultaat">
    <div class="proficiat-top"><p class="plaats-tekst" id="plaats-tekst" hidden></p><div class="kaart" id="kaart"><span class="kaart-tekst" id="kaart-tekst"></span><span class="kaart-db" id="kaart-db"></span></div></div>
    <div class="dag" id="dag"><h3>Dagscore</h3><ol class="lijst" id="dag-lijst"></ol></div>
    <div class="na" id="na"><button class="knop hoofd" type="button" id="nog-eens">Nog eens</button><button class="knop" type="button" data-naar="bord">Scorebord</button></div>
  </section>

  <section id="s-bord" class="scherm" aria-label="Scorebord">
    <header class="top"><button class="terug" type="button" data-naar="terug">Terug</button><h2 class="titel">Scorebord</h2></header>
    <div class="tabs" role="tablist">
      <button class="tab" role="tab" type="button" data-tab="vandaag" aria-selected="true">Vandaag</button>
      <button class="tab" role="tab" type="button" data-tab="boer" aria-selected="false">Boeren</button>
      <button class="tab" role="tab" type="button" data-tab="scheet" aria-selected="false">Scheten</button>
      <button class="tab" role="tab" type="button" data-tab="meeste" aria-selected="false">Meeste</button>
    </div>
    <div class="subtabs" id="subtabs" role="tablist" hidden>
      <button class="subtab" role="tab" type="button" data-sub="totaal" aria-selected="true">Samen</button>
      <button class="subtab boer" role="tab" type="button" data-sub="boer" aria-selected="false">Boeren</button>
      <button class="subtab scheet" role="tab" type="button" data-sub="scheet" aria-selected="false">Scheten</button>
    </div>
    <p class="sectie-titel" id="bord-uitleg"></p>
    <ol class="lijst" id="bord-lijst"></ol>
  </section>
</main>
<canvas id="confetti" aria-hidden="true"></canvas>
<!-- APP-EINDE -->
<script src="vendor/tf.min.js?v=<?= $v ?>"></script>
<script src="app.js?v=<?= $v ?>"></script>
</body>
</html>
