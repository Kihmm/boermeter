<?php
// Boermeter: eerste start. Maakt de instellingen buiten public_html aan (geheime sleutel + SQLite-database)
// en toont de geheime link één keer. Zodra de instellingen bestaan, geeft deze pagina 404.
declare(strict_types=1);
require __DIR__ . '/inc.php';

bm_headers();
header('Cache-Control: no-store');
$pad = bm_config_pad();
if (is_file($pad)) bm_niet_gevonden();

$fouten = [];
if (!extension_loaded('pdo_sqlite')) $fouten[] = 'De PHP-uitbreiding pdo_sqlite ontbreekt op de server.';
$map = dirname($pad);
if (!is_dir($map) && !@mkdir($map, 0700, true)) $fouten[] = 'De map voor de instellingen kan niet aangemaakt worden.';
if (is_dir($map) && !is_writable($map)) $fouten[] = 'De map voor de instellingen is niet schrijfbaar.';

$link = null;
$namen = array_values(array_filter(array_map('trim', explode(',', (string)($_POST['namen'] ?? ''))), fn($n) => $n !== '' && mb_strlen($n) <= 30));
$namen = array_slice(array_unique($namen), 0, 20);
$verstuurd = ($_SERVER['REQUEST_METHOD'] ?? '') === 'POST';
if ($verstuurd && count($namen) < 2) $fouten[] = 'Vul minstens twee namen in, gescheiden door komma\'s.';
if (!$fouten && $verstuurd) {
    $sleutel = bin2hex(random_bytes(16));
    $config = [
        'sleutel' => $sleutel,
        'db_dsn' => 'sqlite:' . $map . '/boermeter.sqlite',
        'db_user' => null,
        'db_pass' => null,
        'spelers' => $namen,
        'tijdzone' => 'Europe/Brussels',
        'db_offset' => 100,
        'drempel' => 0.20,
        'luide_scheet' => 85,
    ];
    $inhoud = "<?php\n// Aangemaakt door setup.php op " . date('Y-m-d H:i') . ". Staat buiten public_html.\nreturn " . var_export($config, true) . ";\n";
    $tmp = $pad . '.tmp';
    if (@file_put_contents($tmp, $inhoud, LOCK_EX) === false || !@rename($tmp, $pad)) {
        $fouten[] = 'De instellingen konden niet weggeschreven worden.';
    } else {
        @chmod($pad, 0600);
        try { bm_db(); } catch (Throwable $e) { $fouten[] = 'De database kon niet aangemaakt worden.'; @unlink($pad); }
        $host = $_SERVER['HTTP_HOST'] ?? 'boer.zimmerbenelux.com';
        if (!$fouten) $link = 'https://' . $host . '/?k=' . $sleutel;
    }
}
$h = fn($s) => htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8');
?><!doctype html>
<html lang="nl-BE"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Boermeter installeren</title>
<style>body{font-family:system-ui,sans-serif;max-width:560px;margin:40px auto;padding:0 20px;color:#14171C;line-height:1.5}code,.link{display:block;background:#F4F5F7;border-radius:10px;padding:12px;word-break:break-all;font-size:15px}h1{font-size:1.6rem}.fout{color:#C2410C}</style></head>
<body>
<?php if ($link): ?>
<h1>De Boermeter is klaar</h1>
<p>Dit is de geheime link. Hij wordt maar één keer getoond. Kopieer hem nu en bewaar hem goed.</p>
<p class="link"><?= $h($link) ?></p>
<p>Open de link op je gsm (iPhone: Safari, Android: Chrome) en kies <b>Zet op beginscherm</b>. Stuur dezelfde link naar de andere deelnemers.</p>
<?php else: ?>
<h1>Boermeter installeren</h1>
<?php foreach ($fouten as $f): ?><p class="fout"><?= $h($f) ?></p><?php endforeach; ?>
<form method="post">
<p><label for="namen">Wie doet er mee? Namen gescheiden door komma's.</label></p>
<p><input id="namen" name="namen" required style="width:100%;font-size:16px;padding:10px;border:1px solid #ccc;border-radius:10px" value="<?= $h($_POST['namen'] ?? '') ?>"></p>
<p><button type="submit" style="font-size:16px;padding:12px 18px;border:0;border-radius:12px;background:#14171C;color:#fff">Installeren</button></p>
</form>
<?php endif; ?>
</body></html>
