<?php
/**
 * Server-side Dynamic Prefill for Contact Form 7 (`{{post:*}}`, `{{acf:*}}`, `{{woo:*}}`, `{{user:*}}`, `{{query:*}}`).
 *
 * @package CF7ProSuite
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class CF7P_Dynamic_Prefill {

	/**
	 * Register WordPress / CF7 hooks.
	 */
	public static function init(): void {
		add_filter( 'wpcf7_form_elements', array( __CLASS__, 'resolve_tokens' ), 15 );
		add_filter( 'wpcf7_form_tag', array( __CLASS__, 'prefill_tag_from_query' ), 10, 2 );
	}

	/**
	 * Resolve `{{namespace:key|fallback}}` tokens inside CF7 form markup.
	 *
	 * @param string $html Rendered CF7 form HTML.
	 * @return string
	 */
	public static function resolve_tokens( string $html ): string {
		if ( false === strpos( $html, '{{' ) ) {
			return $html;
		}

		return (string) preg_replace_callback(
			'/\{\{([a-zA-Z0-9_]+):([a-zA-Z0-9_\/-]+)(?:\|([^}]*))?\}\}/',
			static function ( array $matches ): string {
				$ns       = strtolower( $matches[1] );
				$key      = $matches[2];
				$fallback = isset( $matches[3] ) ? $matches[3] : '';
				$val      = self::resolve_token( $ns, $key );
				$output   = ( '' !== $val && null !== $val ) ? (string) $val : $fallback;
				return esc_attr( $output );
			},
			$html
		);
	}

	/**
	 * Allow URL query parameters to prefill matching CF7 field names when `default:query` is present.
	 *
	 * @param array<string, mixed> $tag     CF7 form tag array.
	 * @param bool                 $unused  Unused flag.
	 * @return array<string, mixed>
	 */
	public static function prefill_tag_from_query( array $tag, bool $unused = false ): array {
		if ( empty( $tag['name'] ) || empty( $tag['options'] ) || ! is_array( $tag['options'] ) ) {
			return $tag;
		}

		if ( ! in_array( 'default:query', $tag['options'], true ) ) {
			return $tag;
		}

		$name = (string) $tag['name'];
		if ( isset( $_GET[ $name ] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			$tag['values'] = array( sanitize_text_field( wp_unslash( (string) $_GET[ $name ] ) ) ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		}

		return $tag;
	}

	/**
	 * Resolve a single dynamic token.
	 *
	 * @param string $ns  Namespace.
	 * @param string $key Key.
	 * @return string
	 */
	private static function resolve_token( string $ns, string $key ): string {
		$post_id = get_the_ID();

		switch ( $ns ) {
			case 'post':
				if ( ! $post_id ) {
					return '';
				}
				if ( 'title' === $key ) {
					return wp_strip_all_tags( (string) get_the_title( $post_id ) );
				}
				if ( 'url' === $key ) {
					return (string) get_permalink( $post_id );
				}
				if ( 'id' === $key ) {
					return (string) $post_id;
				}
				return '';

			case 'meta':
			case 'acf':
				if ( ! $post_id ) {
					return '';
				}
				if ( function_exists( 'get_field' ) ) {
					$acf = get_field( $key, $post_id );
					if ( is_scalar( $acf ) && '' !== (string) $acf ) {
						return (string) $acf;
					}
				}
				$meta = get_post_meta( $post_id, $key, true );
				return is_scalar( $meta ) ? (string) $meta : '';

			case 'woo':
				if ( ! $post_id || ! function_exists( 'wc_get_product' ) ) {
					return '';
				}
				$product = wc_get_product( $post_id );
				if ( ! $product ) {
					return '';
				}
				if ( 'price' === $key ) {
					return wp_strip_all_tags( html_entity_decode( wc_price( (float) $product->get_price() ), ENT_QUOTES, 'UTF-8' ) );
				}
				if ( 'sku' === $key ) {
					return (string) $product->get_sku();
				}
				return '';

			case 'user':
				if ( ! is_user_logged_in() ) {
					return '';
				}
				$user = wp_get_current_user();
				if ( 'email' === $key ) {
					return (string) $user->user_email;
				}
				if ( 'display_name' === $key ) {
					return (string) $user->display_name;
				}
				if ( 'first_name' === $key ) {
					return (string) $user->first_name;
				}
				if ( 'last_name' === $key ) {
					return (string) $user->last_name;
				}
				return '';

			case 'query':
				return isset( $_GET[ $key ] ) ? sanitize_text_field( wp_unslash( (string) $_GET[ $key ] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended

			case 'date':
				return (string) wp_date( $key );

			case 'site':
				if ( 'name' === $key ) {
					return (string) get_bloginfo( 'name' );
				}
				if ( 'url' === $key ) {
					return (string) home_url( '/' );
				}
				return '';
		}

		return '';
	}
}
