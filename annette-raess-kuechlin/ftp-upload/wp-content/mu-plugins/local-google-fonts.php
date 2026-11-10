<?php
/**
 * Plugin Name: Lokale Google Fonts
 * Description: Ersetzt den Google Fonts Link im Frontend durch lokal gehostete Dateien unter /wp-content/uploads/lokale-fonts/.
 * Version: 1.0
 */
if (!defined('ABSPATH')) { exit; }

add_action('template_redirect', function () {
  if (is_admin()) { return; }
  ob_start(function ($html) {
    $css_file = WP_CONTENT_DIR . '/uploads/lokale-fonts/fonts.css';
    if (!file_exists($css_file)) { return $html; }
    $local = '<link rel="stylesheet" id="lokale-fonts-css" href="' . esc_url(content_url('uploads/lokale-fonts/fonts.css') . '?v=' . filemtime($css_file)) . '" />';
    $done = false;
    $html = preg_replace_callback(
      '#<link[^>]+href=["\'][^"\']*fonts\.googleapis\.com/css[^"\']*["\'][^>]*>#i',
      function ($m) use ($local, &$done) {
        if (!preg_match('/Instrument/i', $m[0])) { return $m[0]; }
        if ($done) { return ''; }
        $done = true;
        return $local;
      },
      $html
    );
    if ($done) {
      $html = preg_replace('#<link[^>]+(?:preconnect|dns-prefetch)[^>]+fonts\.g(?:oogleapis|static)\.com[^>]*>\s*#i', '', $html);
    }
    return $html;
  });
}, 0);
