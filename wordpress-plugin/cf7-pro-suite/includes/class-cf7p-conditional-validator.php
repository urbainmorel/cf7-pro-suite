<?php
/**
 * Exempts conditionally hidden CF7 required fields from server-side validation.
 *
 * @package CF7ProSuite
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class CF7P_Conditional_Validator {

	/**
	 * Cached list of hidden field names for the current submission.
	 *
	 * @var array<string>|null
	 */
	private static $hidden_fields = null;

	/**
	 * Hook into all standard CF7 required field validators before CF7 runs them (priority 5).
	 */
	public static function init(): void {
		$types = array(
			'text*',
			'email*',
			'url*',
			'tel*',
			'number*',
			'range*',
			'date*',
			'textarea*',
			'select*',
			'checkbox*',
			'file*',
			'acceptance',
		);

		foreach ( $types as $type ) {
			add_filter( 'wpcf7_validate_' . $type, array( __CLASS__, 'skip_if_hidden' ), 5, 2 );
		}
	}

	/**
	 * Strip required constraint temporarily when the field lives inside a hidden conditional branch.
	 *
	 * @param mixed $result WPCF7_Validation instance.
	 * @param mixed $tag    WPCF7_FormTag instance.
	 * @return mixed
	 */
	public static function skip_if_hidden( $result, $tag ) {
		if ( ! is_object( $tag ) || empty( $tag->name ) ) {
			return $result;
		}

		$hidden = self::get_hidden_fields();
		if ( in_array( (string) $tag->name, $hidden, true ) ) {
			$tag->type = rtrim( (string) $tag->type, '*' );
		}

		return $result;
	}

	/**
	 * Parse hidden field names submitted by frontend.js.
	 *
	 * @return array<string>
	 */
	private static function get_hidden_fields(): array {
		if ( null !== self::$hidden_fields ) {
			return self::$hidden_fields;
		}

		self::$hidden_fields = array();
		if ( empty( $_POST['_cf7p_hidden_fields'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Missing
			return self::$hidden_fields;
		}

		$raw     = sanitize_text_field( wp_unslash( (string) $_POST['_cf7p_hidden_fields'] ) ); // phpcs:ignore WordPress.Security.NonceVerification.Missing
		$decoded = json_decode( $raw, true );
		if ( is_array( $decoded ) ) {
			self::$hidden_fields = array_values(
				array_filter(
					array_map( 'sanitize_key', $decoded )
				)
			);
		}

		return self::$hidden_fields;
	}
}
