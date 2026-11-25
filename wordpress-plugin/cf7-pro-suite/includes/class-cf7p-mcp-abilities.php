<?php
/**
 * WordPress Abilities API & REST API integration for CF7 Pro Suite.
 * Exposes 100% of Contact Form 7 & CF7 Pro Suite management to WordPress MCP Adapter (`WordPress/mcp-adapter`).
 *
 * @package CF7ProSuite
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class CF7P_MCP_Abilities {

	const CATEGORY       = 'cf7-pro-suite';
	const REST_NAMESPACE = 'cf7p/v1';

	/**
	 * Register WordPress Abilities API & REST API hooks.
	 */
	public static function init(): void {
		add_action( 'wp_abilities_api_categories_init', array( __CLASS__, 'register_category' ) );
		add_action( 'wp_abilities_api_init', array( __CLASS__, 'register_abilities' ) );
		add_action( 'rest_api_init', array( __CLASS__, 'register_rest_routes' ) );
	}

	/**
	 * Register CF7 Pro Suite ability category.
	 */
	public static function register_category(): void {
		if ( ! function_exists( 'wp_register_ability_category' ) ) {
			return;
		}
		wp_register_ability_category(
			self::CATEGORY,
			array(
				'label'       => __( 'CF7 Pro Suite', 'cf7-pro-suite' ),
				'description' => __( 'Create and manage Contact Form 7 Pro forms, entries, webhooks, and Cloudflare Turnstile anti-spam settings.', 'cf7-pro-suite' ),
			)
		);
	}

	/**
	 * Check permission for reading/managing CF7 forms.
	 */
	public static function can_read_forms(): bool {
		return current_user_can( 'manage_options' ) || current_user_can( 'wpcf7_read_contact_forms' );
	}

	/**
	 * Check permission for creating/editing CF7 forms.
	 */
	public static function can_edit_forms(): bool {
		return current_user_can( 'manage_options' ) || current_user_can( 'wpcf7_edit_contact_forms' );
	}

	/**
	 * Register 7 MCP-public abilities for WordPress MCP Adapter.
	 */
	public static function register_abilities(): void {
		if ( ! function_exists( 'wp_register_ability' ) ) {
			return;
		}

		wp_register_ability(
			'cf7p/list-forms',
			array(
				'label'               => __( 'List Contact Form 7 Forms', 'cf7-pro-suite' ),
				'description'         => __( 'Lists all Contact Form 7 forms with ID, title, shortcode, and configured cf7p_webhook URL.', 'cf7-pro-suite' ),
				'category'            => self::CATEGORY,
				'input_schema'        => array( 'type' => 'object', 'properties' => (object) array() ),
				'execute_callback'    => array( __CLASS__, 'ability_list_forms' ),
				'permission_callback' => array( __CLASS__, 'can_read_forms' ),
				'meta'                => array(
					'show_in_rest' => true,
					'mcp'          => array( 'public' => true, 'type' => 'tool' ),
					'annotations'  => array( 'readonly' => true, 'destructive' => false, 'idempotent' => true ),
				),
			)
		);

		wp_register_ability(
			'cf7p/get-form',
			array(
				'label'               => __( 'Get Contact Form 7 Form Details', 'cf7-pro-suite' ),
				'description'         => __( 'Reads a Contact Form 7 form template, mail settings, messages, and additional_settings by form ID.', 'cf7-pro-suite' ),
				'category'            => self::CATEGORY,
				'input_schema'        => array(
					'type'       => 'object',
					'required'   => array( 'id' ),
					'properties' => array( 'id' => array( 'type' => 'integer' ) ),
				),
				'execute_callback'    => array( __CLASS__, 'ability_get_form' ),
				'permission_callback' => array( __CLASS__, 'can_read_forms' ),
				'meta'                => array(
					'show_in_rest' => true,
					'mcp'          => array( 'public' => true, 'type' => 'tool' ),
					'annotations'  => array( 'readonly' => true, 'destructive' => false, 'idempotent' => true ),
				),
			)
		);

		wp_register_ability(
			'cf7p/upsert-form',
			array(
				'label'               => __( 'Create or Update Contact Form 7 Pro Form', 'cf7-pro-suite' ),
				'description'         => __( 'Creates or updates a Contact Form 7 form with CF7 Pro Suite HTML markup, mail configuration, additional_settings, and optional webhook_url.', 'cf7-pro-suite' ),
				'category'            => self::CATEGORY,
				'input_schema'        => array(
					'type'       => 'object',
					'required'   => array( 'title', 'form' ),
					'properties' => array(
						'id'                  => array( 'type' => 'integer' ),
						'title'               => array( 'type' => 'string' ),
						'form'                => array( 'type' => 'string' ),
						'mail'                => array( 'type' => 'object' ),
						'additional_settings' => array( 'type' => 'string' ),
						'webhook_url'         => array( 'type' => 'string' ),
					),
				),
				'execute_callback'    => array( __CLASS__, 'ability_upsert_form' ),
				'permission_callback' => array( __CLASS__, 'can_edit_forms' ),
				'meta'                => array(
					'show_in_rest' => true,
					'mcp'          => array( 'public' => true, 'type' => 'tool' ),
					'annotations'  => array( 'readonly' => false, 'destructive' => false, 'idempotent' => true ),
				),
			)
		);

		wp_register_ability(
			'cf7p/delete-form',
			array(
				'label'               => __( 'Delete Contact Form 7 Form', 'cf7-pro-suite' ),
				'description'         => __( 'Deletes a Contact Form 7 form by ID.', 'cf7-pro-suite' ),
				'category'            => self::CATEGORY,
				'input_schema'        => array(
					'type'       => 'object',
					'required'   => array( 'id' ),
					'properties' => array( 'id' => array( 'type' => 'integer' ) ),
				),
				'execute_callback'    => array( __CLASS__, 'ability_delete_form' ),
				'permission_callback' => static function (): bool {
					return current_user_can( 'manage_options' ) || current_user_can( 'wpcf7_delete_contact_forms' );
				},
				'meta'                => array(
					'show_in_rest' => true,
					'mcp'          => array( 'public' => true, 'type' => 'tool' ),
					'annotations'  => array( 'readonly' => false, 'destructive' => true, 'idempotent' => true ),
				),
			)
		);

		wp_register_ability(
			'cf7p/list-entries',
			array(
				'label'               => __( 'List CF7 Pro Stored Entries', 'cf7-pro-suite' ),
				'description'         => __( 'Lists submitted form entries stored in Entrees CF7 Pro with parsed field payloads.', 'cf7-pro-suite' ),
				'category'            => self::CATEGORY,
				'input_schema'        => array(
					'type'       => 'object',
					'properties' => array(
						'limit'   => array( 'type' => 'integer', 'default' => 25 ),
						'form_id' => array( 'type' => 'integer' ),
						'search'  => array( 'type' => 'string' ),
					),
				),
				'execute_callback'    => array( __CLASS__, 'ability_list_entries' ),
				'permission_callback' => static function (): bool {
					return current_user_can( 'manage_options' );
				},
				'meta'                => array(
					'show_in_rest' => true,
					'mcp'          => array( 'public' => true, 'type' => 'tool' ),
					'annotations'  => array( 'readonly' => true, 'destructive' => false, 'idempotent' => true ),
				),
			)
		);

		wp_register_ability(
			'cf7p/get-antispam-settings',
			array(
				'label'               => __( 'Get CF7 Pro Anti-Spam Settings', 'cf7-pro-suite' ),
				'description'         => __( 'Reads Cloudflare Turnstile, Smart reCAPTCHA Optimizer, Honeypot, Time-Trap, and IP Rate-Limit settings (secret key redacted).', 'cf7-pro-suite' ),
				'category'            => self::CATEGORY,
				'input_schema'        => array( 'type' => 'object', 'properties' => (object) array() ),
				'execute_callback'    => array( __CLASS__, 'ability_get_antispam' ),
				'permission_callback' => static function (): bool {
					return current_user_can( 'manage_options' );
				},
				'meta'                => array(
					'show_in_rest' => true,
					'mcp'          => array( 'public' => true, 'type' => 'tool' ),
					'annotations'  => array( 'readonly' => true, 'destructive' => false, 'idempotent' => true ),
				),
			)
		);

		wp_register_ability(
			'cf7p/update-antispam-settings',
			array(
				'label'               => __( 'Update CF7 Pro Anti-Spam Settings', 'cf7-pro-suite' ),
				'description'         => __( 'Updates Cloudflare Turnstile keys/theme, reCAPTCHA optimization, honeypot, minimum submit seconds, and IP rate limit.', 'cf7-pro-suite' ),
				'category'            => self::CATEGORY,
				'input_schema'        => array(
					'type'       => 'object',
					'properties' => array(
						'turnstile_site_key'    => array( 'type' => 'string' ),
						'turnstile_secret_key'  => array( 'type' => 'string' ),
						'turnstile_theme'       => array( 'type' => 'string', 'enum' => array( 'auto', 'light', 'dark' ) ),
						'turnstile_auto_inject' => array( 'type' => 'boolean' ),
						'optimize_recaptcha'    => array( 'type' => 'boolean' ),
						'honeypot_enabled'      => array( 'type' => 'boolean' ),
						'min_submit_seconds'    => array( 'type' => 'integer' ),
						'rate_limit_per_min'    => array( 'type' => 'integer' ),
					),
				),
				'execute_callback'    => array( __CLASS__, 'ability_update_antispam' ),
				'permission_callback' => static function (): bool {
					return current_user_can( 'manage_options' );
				},
				'meta'                => array(
					'show_in_rest' => true,
					'mcp'          => array( 'public' => true, 'type' => 'tool' ),
					'annotations'  => array( 'readonly' => false, 'destructive' => false, 'idempotent' => true ),
				),
			)
		);
	}

	/**
	 * Mirror abilities on standard WordPress REST API (`/wp-json/cf7p/v1/*`).
	 */
	public static function register_rest_routes(): void {
		register_rest_route(
			self::REST_NAMESPACE,
			'/forms',
			array(
				array(
					'methods'             => 'GET',
					'callback'            => static fn() => rest_ensure_response( self::ability_list_forms() ),
					'permission_callback' => array( __CLASS__, 'can_read_forms' ),
				),
				array(
					'methods'             => 'POST',
					'callback'            => static function ( WP_REST_Request $req ) {
						$res = self::ability_upsert_form( $req->get_json_params() ?: $req->get_params() );
						return is_wp_error( $res ) ? $res : rest_ensure_response( $res );
					},
					'permission_callback' => array( __CLASS__, 'can_edit_forms' ),
				),
			)
		);

		register_rest_route(
			self::REST_NAMESPACE,
			'/forms/(?P<id>\d+)',
			array(
				array(
					'methods'             => 'GET',
					'callback'            => static function ( WP_REST_Request $req ) {
						$res = self::ability_get_form( array( 'id' => (int) $req['id'] ) );
						return is_wp_error( $res ) ? $res : rest_ensure_response( $res );
					},
					'permission_callback' => array( __CLASS__, 'can_read_forms' ),
				),
				array(
					'methods'             => 'DELETE',
					'callback'            => static function ( WP_REST_Request $req ) {
						$res = self::ability_delete_form( array( 'id' => (int) $req['id'] ) );
						return is_wp_error( $res ) ? $res : rest_ensure_response( $res );
					},
					'permission_callback' => static fn(): bool => current_user_can( 'manage_options' ) || current_user_can( 'wpcf7_delete_contact_forms' ),
				),
			)
		);

		register_rest_route(
			self::REST_NAMESPACE,
			'/entries',
			array(
				'methods'             => 'GET',
				'callback'            => static fn( WP_REST_Request $req ) => rest_ensure_response( self::ability_list_entries( $req->get_params() ) ),
				'permission_callback' => static fn(): bool => current_user_can( 'manage_options' ),
			)
		);

		register_rest_route(
			self::REST_NAMESPACE,
			'/antispam',
			array(
				array(
					'methods'             => 'GET',
					'callback'            => static fn() => rest_ensure_response( self::ability_get_antispam() ),
					'permission_callback' => static fn(): bool => current_user_can( 'manage_options' ),
				),
				array(
					'methods'             => 'POST',
					'callback'            => static fn( WP_REST_Request $req ) => rest_ensure_response( self::ability_update_antispam( $req->get_json_params() ?: $req->get_params() ) ),
					'permission_callback' => static fn(): bool => current_user_can( 'manage_options' ),
				),
			)
		);
	}

	/**
	 * List all CF7 forms.
	 *
	 * @return array<int, array<string, mixed>>
	 */
	public static function ability_list_forms(): array {
		$posts = get_posts(
			array(
				'post_type'      => 'wpcf7_contact_form',
				'posts_per_page' => -1,
				'post_status'    => 'any',
			)
		);

		$out = array();
		foreach ( $posts as $post ) {
			$settings = (string) get_post_meta( $post->ID, '_additional_settings', true );
			$webhook  = '';
			if ( preg_match( '/^cf7p_webhook:\s*(.+)$/m', $settings, $m ) ) {
				$webhook = trim( $m[1] );
			}
			$out[] = array(
				'id'        => $post->ID,
				'title'     => $post->post_title,
				'shortcode' => sprintf( '[contact-form-7 id="%d" title="%s"]', $post->ID, esc_attr( $post->post_title ) ),
				'webhook'   => $webhook,
				'modified'  => $post->post_modified,
			);
		}
		return $out;
	}

	/**
	 * Get full CF7 form details.
	 *
	 * @param array<string, mixed> $input Input parameters.
	 * @return array<string, mixed>|WP_Error
	 */
	public static function ability_get_form( array $input ) {
		$id   = (int) ( $input['id'] ?? 0 );
		$post = get_post( $id );
		if ( ! $post || 'wpcf7_contact_form' !== $post->post_type ) {
			return new WP_Error( 'cf7p_form_not_found', __( 'Contact Form 7 form not found.', 'cf7-pro-suite' ), array( 'status' => 404 ) );
		}

		return array(
			'id'                  => $post->ID,
			'title'               => $post->post_title,
			'shortcode'           => sprintf( '[contact-form-7 id="%d" title="%s"]', $post->ID, esc_attr( $post->post_title ) ),
			'form'                => (string) get_post_meta( $post->ID, '_form', true ),
			'mail'                => get_post_meta( $post->ID, '_mail', true ),
			'mail_2'              => get_post_meta( $post->ID, '_mail_2', true ),
			'messages'            => get_post_meta( $post->ID, '_messages', true ),
			'additional_settings' => (string) get_post_meta( $post->ID, '_additional_settings', true ),
		);
	}

	/**
	 * Create or update a Contact Form 7 form.
	 *
	 * @param array<string, mixed> $input Input parameters.
	 * @return array<string, mixed>|WP_Error
	 */
	public static function ability_upsert_form( array $input ) {
		$id    = ! empty( $input['id'] ) ? (int) $input['id'] : 0;
		$title = sanitize_text_field( (string) ( $input['title'] ?? 'Nouveau Formulaire Pro' ) );
		$form  = (string) ( $input['form'] ?? '' );

		if ( '' === trim( $form ) ) {
			return new WP_Error( 'cf7p_empty_form', __( 'Form markup is required.', 'cf7-pro-suite' ), array( 'status' => 400 ) );
		}

		$additional = isset( $input['additional_settings'] )
			? (string) $input['additional_settings']
			: ( $id ? (string) get_post_meta( $id, '_additional_settings', true ) : '' );

		if ( ! empty( $input['webhook_url'] ) ) {
			$webhook    = esc_url_raw( (string) $input['webhook_url'] );
			$additional = (string) preg_replace( '/^cf7p_webhook:.*(?:\r?\n)?/m', '', $additional );
			$additional = trim( $additional . "\ncf7p_webhook: " . $webhook );
		}

		if ( class_exists( 'WPCF7_ContactForm' ) ) {
			$cf = $id ? WPCF7_ContactForm::get_instance( $id ) : WPCF7_ContactForm::get_template();
			if ( ! $cf ) {
				return new WP_Error( 'cf7p_form_not_found', __( 'Contact Form 7 form not found.', 'cf7-pro-suite' ), array( 'status' => 404 ) );
			}
			$props = $cf->get_properties();
			$props['form'] = $form;
			if ( ! empty( $input['mail'] ) && is_array( $input['mail'] ) ) {
				$props['mail'] = array_merge( is_array( $props['mail'] ?? null ) ? $props['mail'] : array(), $input['mail'] );
			}
			$props['additional_settings'] = $additional;
			$cf->set_properties( $props );
			$saved_id = $cf->save();
			if ( $saved_id && '' !== $title ) {
				wp_update_post( array( 'ID' => $saved_id, 'post_title' => $title ) );
			}
		} else {
			$postarr = array(
				'post_type'   => 'wpcf7_contact_form',
				'post_title'  => $title,
				'post_status' => 'publish',
			);
			if ( $id > 0 ) {
				$postarr['ID'] = $id;
				$saved_id      = wp_update_post( $postarr, true );
			} else {
				$saved_id = wp_insert_post( $postarr, true );
			}
			if ( is_wp_error( $saved_id ) ) {
				return $saved_id;
			}
			update_post_meta( (int) $saved_id, '_form', $form );
			update_post_meta( (int) $saved_id, '_additional_settings', $additional );
			if ( ! empty( $input['mail'] ) && is_array( $input['mail'] ) ) {
				update_post_meta( (int) $saved_id, '_mail', $input['mail'] );
			}
		}

		return array(
			'id'        => (int) $saved_id,
			'title'     => $title,
			'shortcode' => sprintf( '[contact-form-7 id="%d" title="%s"]', (int) $saved_id, esc_attr( $title ) ),
		);
	}

	/**
	 * Delete a CF7 form.
	 *
	 * @param array<string, mixed> $input Input parameters.
	 * @return array<string, mixed>|WP_Error
	 */
	public static function ability_delete_form( array $input ) {
		$id   = (int) ( $input['id'] ?? 0 );
		$post = get_post( $id );
		if ( ! $post || 'wpcf7_contact_form' !== $post->post_type ) {
			return new WP_Error( 'cf7p_form_not_found', __( 'Contact Form 7 form not found.', 'cf7-pro-suite' ), array( 'status' => 404 ) );
		}
		wp_delete_post( $id, true );
		return array( 'id' => $id, 'deleted' => true );
	}

	/**
	 * List stored CF7 Pro entries.
	 *
	 * @param array<string, mixed> $input Filter parameters.
	 * @return array<int, array<string, mixed>>
	 */
	public static function ability_list_entries( array $input = array() ): array {
		$limit   = max( 1, min( 100, (int) ( $input['limit'] ?? 25 ) ) );
		$form_id = ! empty( $input['form_id'] ) ? (int) $input['form_id'] : 0;
		$args    = array(
			'post_type'      => CF7P_Webhook_Entries::CPT,
			'posts_per_page' => $limit,
			'post_status'    => 'publish',
		);

		if ( ! empty( $input['search'] ) ) {
			$args['s'] = sanitize_text_field( (string) $input['search'] );
		}
		if ( $form_id > 0 ) {
			$args['meta_query'] = array(
				array(
					'key'   => '_cf7p_form_id',
					'value' => $form_id,
				),
			);
		}

		$posts = get_posts( $args );
		$out   = array();
		foreach ( $posts as $post ) {
			$out[] = array(
				'entry_id'   => $post->ID,
				'title'      => $post->post_title,
				'date'       => $post->post_date,
				'form_id'    => (int) get_post_meta( $post->ID, '_cf7p_form_id', true ),
				'form_title' => (string) get_post_meta( $post->ID, '_cf7p_form_title', true ),
				'page_url'   => (string) get_post_meta( $post->ID, '_cf7p_page_url', true ),
				'fields'     => json_decode( (string) get_post_meta( $post->ID, '_cf7p_payload', true ), true ),
			);
		}
		return $out;
	}

	/**
	 * Return Anti-Spam settings with secret key redacted.
	 *
	 * @return array<string, mixed>
	 */
	public static function ability_get_antispam(): array {
		$cfg                               = CF7P_Antispam::get_settings();
		$cfg['turnstile_secret_configured'] = ! empty( $cfg['turnstile_secret_key'] );
		unset( $cfg['turnstile_secret_key'] );
		return $cfg;
	}

	/**
	 * Merge and save Anti-Spam settings.
	 *
	 * @param array<string, mixed> $input Input parameters.
	 * @return array<string, mixed>
	 */
	public static function ability_update_antispam( array $input ): array {
		$current = CF7P_Antispam::get_settings();
		$merged  = array_merge( $current, $input );
		$clean   = CF7P_Antispam::sanitize_settings( $merged );
		update_option( CF7P_Antispam::OPTION_KEY, $clean );
		return self::ability_get_antispam();
	}
}
