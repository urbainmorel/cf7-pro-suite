<?php
/**
 * Plugin Name:       CF7 Pro Suite — Multi-Step, Conditional, Calculator & Webhooks
 * Plugin URI:        https://github.com/urbainmorel/cf7-pro-suite
 * Description:       Supercharges Contact Form 7 with multi-step wizards, conditional logic (client + server validation), live quote calculators, clickable UI cards, drag-and-drop uploads, WhatsApp/URL redirects, dynamic prefill, local entries ledger, and JSON webhooks — with 0 bytes loaded on pages without a form.
 * Version:           1.3.0
 * Requires at least: 6.2
 * Requires PHP:      7.4
 * Author:            Morel Urbain
 * Author URI:        https://github.com/urbainmorel
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       cf7-pro-suite
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'CF7P_VERSION', '1.3.0' );
define( 'CF7P_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'CF7P_PLUGIN_URL', plugin_dir_url( __FILE__ ) );

require_once CF7P_PLUGIN_DIR . 'includes/class-cf7p-dynamic-prefill.php';
require_once CF7P_PLUGIN_DIR . 'includes/class-cf7p-conditional-validator.php';
require_once CF7P_PLUGIN_DIR . 'includes/class-cf7p-webhook-entries.php';
require_once CF7P_PLUGIN_DIR . 'includes/class-cf7p-antispam.php';
require_once CF7P_PLUGIN_DIR . 'includes/class-cf7p-mcp-abilities.php';

CF7P_Dynamic_Prefill::init();
CF7P_Conditional_Validator::init();
CF7P_Webhook_Entries::init();
CF7P_Antispam::init();
CF7P_MCP_Abilities::init();

/**
 * Register frontend assets without enqueueing globally (0 bytes on pages without CF7).
 */
add_action( 'wp_enqueue_scripts', static function () {
	wp_register_style(
		'cf7p-frontend',
		CF7P_PLUGIN_URL . 'assets/css/frontend.css',
		array(),
		CF7P_VERSION
	);

	wp_register_script(
		'cf7p-frontend',
		CF7P_PLUGIN_URL . 'assets/js/frontend.js',
		array(),
		CF7P_VERSION,
		true
	);
} );

/**
 * Enqueue frontend assets strictly when a Contact Form 7 form is rendered on the page.
 */
add_filter( 'wpcf7_form_elements', static function ( string $html ): string {
	wp_enqueue_style( 'cf7p-frontend' );
	wp_enqueue_script( 'cf7p-frontend' );

	if ( ! empty( $_SERVER['HTTP_CF_IPCOUNTRY'] ) ) {
		$country = strtoupper( sanitize_text_field( wp_unslash( (string) $_SERVER['HTTP_CF_IPCOUNTRY'] ) ) );
		if ( preg_match( '/^[A-Z]{2}$/', $country ) && 'XX' !== $country && 'T1' !== $country ) {
			wp_add_inline_script(
				'cf7p-frontend',
				'window.cf7pGeoCountry = ' . wp_json_encode( $country ) . ';',
				'before'
			);
		}
	}

	return $html;
}, 5 );

/**
 * Inject hidden tracking fields for conditional validation and calculator summaries.
 */
add_filter( 'wpcf7_form_hidden_fields', static function ( array $fields ): array {
	$fields['_cf7p_hidden_fields'] = '';
	$fields['_cf7p_calc_summary']  = '';
	return $fields;
} );

/**
 * Enqueue 1-click Pro helper toolbar on Contact Form 7 admin editor screens.
 */
add_action( 'admin_enqueue_scripts', static function ( string $hook ) {
	if ( false === strpos( $hook, 'wpcf7' ) ) {
		return;
	}
	wp_enqueue_script(
		'cf7p-admin',
		CF7P_PLUGIN_URL . 'assets/js/admin.js',
		array(),
		CF7P_VERSION,
		true
	);
} );
