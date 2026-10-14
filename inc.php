<?php
// Gedeelde code voor index.php, api.php en manifest.php.
declare(strict_types=1);

if (basename($_SERVER['SCRIPT_FILENAME'] ?? '') === 'inc.php') { http_response_code(404); exit; }

function bm_config_pad(): string {
    return getenv('BOERMETER_CONFIG') ?: __DIR__ . '/../private_html/config.php';
}

function bm_config(): array {
    static $c = null;
    if ($c === null) {
        $pad = bm_config_pad();
        if (!is_file($pad)) { bm_niet_gevonden(); }
        $c = require $pad;
        date_default_timezone_set($c['tijdzone'] ?? 'Europe/Brussels');
    }
    return $c;
}

function bm_headers(): void {
    header('X-Robots-Tag: noindex, nofollow, noarchive');
    header('Referrer-Policy: no-referrer');
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    header('Permissions-Policy: microphone=(self), camera=(), geolocation=()');
}

function bm_sleutel_ok(): bool {
    $c = bm_config();
    $echt = (string)($c['sleutel'] ?? '');
    if (strlen($echt) < 16 || str_starts_with($echt, 'VERVANG')) return false;
    $kandidaten = [$_GET['k'] ?? null, $_COOKIE['bm'] ?? null, $_SERVER['HTTP_X_BOERMETER'] ?? null];
    foreach ($kandidaten as $k) {
        if (is_string($k) && $k !== '' && hash_equals($echt, $k)) return true;
    }
    return false;
}

function bm_onthoud(): void {
    $k = bm_config()['sleutel'];
    setcookie('bm', $k, [
        'expires' => time() + 60 * 60 * 24 * 400, 'path' => '/',
        'secure' => (($_SERVER['HTTPS'] ?? '') !== '' && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https'),
        'httponly' => true, 'samesite' => 'Lax',
    ]);
}

function bm_niet_gevonden(): never {
    http_response_code(404);
    header('Content-Type: text/plain; charset=utf-8');
    echo "Niet gevonden.";
    exit;
}

function bm_db(): PDO {
    static $pdo = null;
    if ($pdo) return $pdo;
    $c = bm_config();
    $pdo = new PDO($c['db_dsn'], $c['db_user'] ?? null, $c['db_pass'] ?? null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    $sqlite = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite';
    $pdo->exec($sqlite
        ? 'CREATE TABLE IF NOT EXISTS bm_metingen (id INTEGER PRIMARY KEY AUTOINCREMENT, speler TEXT NOT NULL, soort TEXT NOT NULL, db REAL NOT NULL, zekerheid REAL NOT NULL DEFAULT 0, aangemaakt TEXT NOT NULL)'
        : 'CREATE TABLE IF NOT EXISTS bm_metingen (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, speler VARCHAR(40) NOT NULL, soort VARCHAR(10) NOT NULL, db DECIMAL(4,1) NOT NULL, zekerheid DECIMAL(4,3) NOT NULL DEFAULT 0, aangemaakt DATETIME NOT NULL, INDEX (aangemaakt), INDEX (soort, db)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
    return $pdo;
}
