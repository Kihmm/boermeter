<?php
// Boermeter API: stand ophalen en een meting bewaren.
declare(strict_types=1);
require __DIR__ . '/inc.php';

bm_headers();
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function antwoord(array $data, int $code = 200): never {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

if (!bm_sleutel_ok()) antwoord(['fout' => 'Geen toegang.'], 403);

$c = bm_config();
$spelers = $c['spelers'];

function stand(array $spelers): array {
    $db = bm_db();
    $vandaag = date('Y-m-d 00:00:00');
    $rij = fn($r) => ['id' => (int)$r['id'], 'speler' => $r['speler'], 'soort' => $r['soort'], 'db' => round((float)$r['db'], 1), 'tijd' => $r['aangemaakt']];

    $q = $db->prepare('SELECT id, speler, soort, db, aangemaakt FROM bm_metingen WHERE aangemaakt >= ? ORDER BY db DESC, id ASC LIMIT 50');
    $q->execute([$vandaag]);
    $dag = array_map($rij, $q->fetchAll());

    $top = [];
    foreach (['boer', 'scheet'] as $s) {
        $q = $db->prepare('SELECT id, speler, soort, db, aangemaakt FROM bm_metingen WHERE soort = ? ORDER BY db DESC, id ASC LIMIT 10');
        $q->execute([$s]);
        $top[$s] = array_map($rij, $q->fetchAll());
    }

    $tel = [];
    foreach ($spelers as $p) $tel[$p] = ['speler' => $p, 'boer' => 0, 'scheet' => 0];
    foreach ($db->query('SELECT speler, soort, COUNT(*) AS n FROM bm_metingen GROUP BY speler, soort') as $r) {
        if (isset($tel[$r['speler']][$r['soort']])) $tel[$r['speler']][$r['soort']] = (int)$r['n'];
    }
    $tel = array_values($tel);
    usort($tel, fn($a, $b) => ($b['boer'] + $b['scheet']) <=> ($a['boer'] + $a['scheet']));

    return ['vandaag' => $dag, 'top' => $top, 'aantallen' => $tel];
}

$actie = $_GET['a'] ?? '';

try {
    if ($actie === 'stand' && $_SERVER['REQUEST_METHOD'] === 'GET') {
        antwoord(stand($spelers));
    }

    if ($actie === 'bewaar' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        $in = json_decode(file_get_contents('php://input') ?: '', true);
        if (!is_array($in)) antwoord(['fout' => 'Ongeldige gegevens.'], 400);
        $speler = (string)($in['speler'] ?? '');
        $soort = (string)($in['soort'] ?? '');
        $dbw = (float)($in['db'] ?? 0);
        $zek = max(0.0, min(1.0, (float)($in['zekerheid'] ?? 0)));
        if (!in_array($speler, $spelers, true)) antwoord(['fout' => 'Onbekende naam.'], 400);
        if (!in_array($soort, ['boer', 'scheet'], true)) antwoord(['fout' => 'Kies boer of scheet.'], 400);
        if ($dbw < 30 || $dbw > 140) antwoord(['fout' => 'Onmogelijke meting.'], 400);

        $pdo = bm_db();
        // Hooguit één meting per 3 seconden per persoon.
        $q = $pdo->prepare('SELECT COUNT(*) FROM bm_metingen WHERE speler = ? AND aangemaakt >= ?');
        $q->execute([$speler, date('Y-m-d H:i:s', time() - 3)]);
        if ((int)$q->fetchColumn() > 0) antwoord(['fout' => 'Even wachten.'], 429);

        $q = $pdo->prepare('INSERT INTO bm_metingen (speler, soort, db, zekerheid, aangemaakt) VALUES (?, ?, ?, ?, ?)');
        $q->execute([$speler, $soort, round($dbw, 1), round($zek, 3), date('Y-m-d H:i:s')]);
        $id = (int)$pdo->lastInsertId();
        antwoord(['id' => $id, 'stand' => stand($spelers)]);
    }

    antwoord(['fout' => 'Onbekende vraag.'], 404);
} catch (Throwable $e) {
    error_log('Boermeter: ' . $e->getMessage());
    antwoord(['fout' => 'Er liep iets mis op de server.'], 500);
}
