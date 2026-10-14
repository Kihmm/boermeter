<?php
// Boermeter: haalt de nieuwste versie van GitHub op en zet ze in deze map.
// Draait enkel via de cronjob (command line). Via het web geeft dit bestand 404.
declare(strict_types=1);

if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }

const REPO = 'Kihmm/boermeter';
const TAK = 'main';

$doel = __DIR__;
$priv = dirname(__DIR__) . '/private_html';
$shaBestand = $priv . '/deploy-sha';

function haal(string $url, bool $json = false): ?string {
    $ctx = stream_context_create(['http' => [
        'timeout' => 60,
        'header' => "User-Agent: boermeter-updater\r\n" . ($json ? "Accept: application/vnd.github.sha\r\n" : ''),
    ]]);
    $data = @file_get_contents($url, false, $ctx);
    return $data === false ? null : $data;
}

function kopieer(string $van, string $naar): void {
    $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($van, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::SELF_FIRST);
    foreach ($it as $item) {
        $rel = substr($item->getPathname(), strlen($van) + 1);
        $pad = $naar . '/' . $rel;
        if ($item->isDir()) { if (!is_dir($pad)) mkdir($pad, 0755, true); }
        else { copy($item->getPathname(), $pad . '.nieuw'); rename($pad . '.nieuw', $pad); }
    }
}

function wis(string $map): void {
    if (!is_dir($map)) return;
    $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($map, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST);
    foreach ($it as $item) { $item->isDir() ? rmdir($item->getPathname()) : unlink($item->getPathname()); }
    rmdir($map);
}

$sha = trim((string)haal('https://api.github.com/repos/' . REPO . '/commits/' . TAK, true));
if (!preg_match('/^[0-9a-f]{40}$/', $sha)) { fwrite(STDERR, "Geen versie gevonden.\n"); exit(1); }
if (is_file($shaBestand) && trim((string)file_get_contents($shaBestand)) === $sha) exit(0);

$tmp = sys_get_temp_dir() . '/boermeter-' . bin2hex(random_bytes(6));
mkdir($tmp, 0700, true);
try {
    $tar = haal('https://codeload.github.com/' . REPO . '/tar.gz/' . $sha);
    if ($tar === null || strlen($tar) < 1000) throw new RuntimeException('Download mislukt.');
    file_put_contents($tmp . '/code.tar.gz', $tar);
    (new PharData($tmp . '/code.tar.gz'))->extractTo($tmp . '/uit');
    $wortel = glob($tmp . '/uit/*', GLOB_ONLYDIR)[0] ?? '';
    if (!is_file($wortel . '/index.php') || !is_file($wortel . '/updater.php')) throw new RuntimeException('Onvolledige versie.');
    kopieer($wortel, $doel);
    if (!is_dir($priv)) mkdir($priv, 0700, true);
    file_put_contents($shaBestand, $sha);
    echo "Bijgewerkt naar $sha\n";
} catch (Throwable $e) {
    fwrite(STDERR, $e->getMessage() . "\n");
    exit(1);
} finally {
    wis($tmp);
}
