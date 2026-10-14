<?php
// Web-app-manifest. De startlink bevat de sleutel, zodat het icoon op het beginscherm meteen opent.
declare(strict_types=1);
require __DIR__ . '/inc.php';

bm_headers();
if (!bm_sleutel_ok()) bm_niet_gevonden();
header('Content-Type: application/manifest+json; charset=utf-8');
header('Cache-Control: no-store');

echo json_encode([
    'name' => 'Boermeter',
    'short_name' => 'Boermeter',
    'description' => 'Wie laat de luidste boer of scheet?',
    'lang' => 'nl-BE',
    'start_url' => '/?k=' . rawurlencode(bm_config()['sleutel']),
    'scope' => '/',
    'display' => 'standalone',
    'orientation' => 'portrait',
    'background_color' => '#FFFFFF',
    'theme_color' => '#FFFFFF',
    'icons' => [
        ['src' => '/icons/icon-192.png', 'sizes' => '192x192', 'type' => 'image/png'],
        ['src' => '/icons/icon-512.png', 'sizes' => '512x512', 'type' => 'image/png'],
        ['src' => '/icons/icon-maskable-512.png', 'sizes' => '512x512', 'type' => 'image/png', 'purpose' => 'maskable'],
    ],
], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
