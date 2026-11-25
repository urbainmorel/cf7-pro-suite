<?php
/**
 * Local Entries Ledger (with CSV export) & Non-Blocking JSON Webhook Dispatcher for Contact Form 7.
 *
 * @package CF7ProSuite
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class CF7P_Webhook_Entries {

	const CPT = 'cf7p_entry';

	/**
	 * Register hooks & admin pages.
	 */
	public static function init(): void {
		add_action( 'init', array( __CLASS__, 'register_cpt' ) );
		add_action( 'admin_menu', array( __CLASS__, 'add_admin_menu' ) );
		add_action( 'admin_post_cf7p_export_csv', array( __CLASS__, 'handle_csv_export' ) );
		add_action( 'wpcf7_mail_sent', array( __CLASS__, 'on_mail_sent' ) );
		add_filter( 'manage_' . self::CPT . '_posts_columns', array( __CLASS__, 'table_columns' ) );
		add_action( 'manage_' . self::CPT . '_posts_custom_column', array( __CLASS__, 'render_column' ), 10, 2 );
		add_action( 'add_meta_boxes', array( __CLASS__, 'add_entry_metabox' ) );
	}

	/**
	 * Register private custom post type for storing form submissions.
	 */
	public static function register_cpt(): void {
		register_post_type(
			self::CPT,
			array(
				'labels'          => array(
					'name'          => __( 'Entrées CF7 Pro', 'cf7-pro-suite' ),
					'singular_name' => __( 'Entrée CF7 Pro', 'cf7-pro-suite' ),
				),
				'public'          => false,
				'show_ui'         => true,
				'show_in_menu'    => false,
				'supports'        => array( 'title' ),
				'capability_type' => 'post',
				'map_meta_cap'    => true,
			)
		);
	}

	/**
	 * Add submenu under Contact Form 7 ("wpcf7") menu.
	 */
	public static function add_admin_menu(): void {
		add_submenu_page(
			'wpcf7',
			__( 'Entrées CF7 Pro', 'cf7-pro-suite' ),
			__( 'Entrées CF7 Pro', 'cf7-pro-suite' ),
			'manage_options',
			'edit.php?post_type=' . self::CPT
		);

		add_submenu_page(
			'wpcf7',
			__( 'Exporter CSV (CF7 Pro)', 'cf7-pro-suite' ),
			__( 'Exporter CSV', 'cf7-pro-suite' ),
			'manage_options',
			'cf7p-export',
			array( __CLASS__, 'render_export_page' )
		);
	}

	/**
	 * Save entry locally and send JSON webhook when CF7 mail succeeds.
	 *
	 * @param mixed $contact_form WPCF7_ContactForm instance.
	 */
	public static function on_mail_sent( $contact_form ): void {
		if ( ! class_exists( 'WPCF7_Submission' ) ) {
			return;
		}
		$submission = WPCF7_Submission::get_instance();
		if ( ! $submission ) {
			return;
		}

		$posted_raw = $submission->get_posted_data();
		$data       = self::clean_posted_data( is_array( $posted_raw ) ? $posted_raw : array() );
		$form_id    = is_object( $contact_form ) && method_exists( $contact_form, 'id' ) ? (int) $contact_form->id() : 0;
		$form_title = is_object( $contact_form ) && method_exists( $contact_form, 'title' ) ? (string) $contact_form->title() : 'Contact Form';
		$page_url   = (string) $submission->get_meta( 'url' );

		$disable_storage = is_object( $contact_form ) && method_exists( $contact_form, 'is_true' ) && $contact_form->is_true( 'cf7p_disable_storage' );

		if ( ! $disable_storage ) {
			$summary_name = $data['your-name'] ?? ( $data['nom'] ?? ( $data['email'] ?? ( $data['your-email'] ?? '#' . $form_id ) ) );
			$post_id      = wp_insert_post(
				array(
					'post_type'   => self::CPT,
					'post_status' => 'publish',
					'post_title'  => sprintf( '[%s] %s', $form_title, sanitize_text_field( (string) $summary_name ) ),
				)
			);

			if ( $post_id && ! is_wp_error( $post_id ) ) {
				update_post_meta( $post_id, '_cf7p_form_id', $form_id );
				update_post_meta( $post_id, '_cf7p_form_title', $form_title );
				update_post_meta( $post_id, '_cf7p_page_url', esc_url_raw( $page_url ) );
				update_post_meta( $post_id, '_cf7p_payload', wp_json_encode( $data ) );
			}
		}

		$webhook_url = ( is_object( $contact_form ) && method_exists( $contact_form, 'pref' ) )
			? trim( (string) $contact_form->pref( 'cf7p_webhook' ) )
			: '';

		if ( '' !== $webhook_url && filter_var( $webhook_url, FILTER_VALIDATE_URL ) ) {
			wp_remote_post(
				$webhook_url,
				array(
					'timeout'   => 8,
					'blocking'  => false,
					'headers'   => array( 'Content-Type' => 'application/json; charset=utf-8' ),
					'body'      => wp_json_encode(
						array(
							'event'      => 'cf7p_submission',
							'form_id'    => $form_id,
							'form_title' => $form_title,
							'page_url'   => $page_url,
							'timestamp'  => current_time( 'c' ),
							'fields'     => $data,
						)
					),
				)
			);
		}
	}

	/**
	 * Customize admin list table columns.
	 *
	 * @param array<string, string> $columns Default columns.
	 * @return array<string, string>
	 */
	public static function table_columns( array $columns ): array {
		return array(
			'cb'        => $columns['cb'],
			'title'     => __( 'Soumission', 'cf7-pro-suite' ),
			'form_name' => __( 'Formulaire', 'cf7-pro-suite' ),
			'preview'   => __( 'Données clés', 'cf7-pro-suite' ),
			'date'      => $columns['date'],
		);
	}

	/**
	 * Render custom column content.
	 *
	 * @param string $column  Column slug.
	 * @param int    $post_id Entry post ID.
	 */
	public static function render_column( string $column, int $post_id ): void {
		if ( 'form_name' === $column ) {
			echo esc_html( (string) get_post_meta( $post_id, '_cf7p_form_title', true ) );
			return;
		}
		if ( 'preview' === $column ) {
			$json = (string) get_post_meta( $post_id, '_cf7p_payload', true );
			$data = json_decode( $json, true );
			if ( is_array( $data ) ) {
				$pairs = array();
				foreach ( array_slice( $data, 0, 4, true ) as $k => $v ) {
					$val     = is_array( $v ) ? implode( ', ', $v ) : (string) $v;
					$pairs[] = '<strong>' . esc_html( $k ) . ':</strong> ' . esc_html( wp_trim_words( $val, 8 ) );
				}
				echo implode( ' &middot; ', $pairs ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
			}
		}
	}

	/**
	 * Register detail metabox on entry edit screen.
	 */
	public static function add_entry_metabox(): void {
		add_meta_box(
			'cf7p_entry_details',
			__( 'Détails complets de la soumission', 'cf7-pro-suite' ),
			array( __CLASS__, 'render_entry_metabox' ),
			self::CPT,
			'normal',
			'high'
		);
	}

	/**
	 * Render all submitted fields in a clean table.
	 *
	 * @param WP_Post $post Entry post object.
	 */
	public static function render_entry_metabox( $post ): void {
		$json     = (string) get_post_meta( $post->ID, '_cf7p_payload', true );
		$page_url = (string) get_post_meta( $post->ID, '_cf7p_page_url', true );
		$data     = json_decode( $json, true );

		echo '<p><strong>Page source :</strong> ' . esc_html( $page_url ) . '</p>';
		if ( ! is_array( $data ) ) {
			echo '<p>Aucune donnée.</p>';
			return;
		}

		echo '<table class="widefat striped"><tbody>';
		foreach ( $data as $key => $val ) {
			$display = is_array( $val ) ? implode( ', ', $val ) : (string) $val;
			echo '<tr><th style="width:220px;">' . esc_html( $key ) . '</th><td>' . nl2br( esc_html( $display ) ) . '</td></tr>';
		}
		echo '</tbody></table>';
	}

	/**
	 * Render CSV export screen.
	 */
	public static function render_export_page(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}
		$action = admin_url( 'admin-post.php' );
		echo '<div class="wrap"><h1>' . esc_html__( 'Exporter les entrées CF7 Pro (CSV)', 'cf7-pro-suite' ) . '</h1>';
		echo '<form method="post" action="' . esc_url( $action ) . '">';
		wp_nonce_field( 'cf7p_export_csv_nonce' );
		echo '<input type="hidden" name="action" value="cf7p_export_csv" />';
		submit_button( __( 'Télécharger le fichier CSV', 'cf7-pro-suite' ) );
		echo '</form></div>';
	}

	/**
	 * Stream CSV download of all stored CF7 Pro entries.
	 */
	public static function handle_csv_export(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'Accès refusé.', 'cf7-pro-suite' ) );
		}
		check_admin_referer( 'cf7p_export_csv_nonce' );

		$entries = get_posts(
			array(
				'post_type'      => self::CPT,
				'posts_per_page' => -1,
				'post_status'    => 'publish',
			)
		);

		$all_keys = array();
		$rows     = array();

		foreach ( $entries as $entry ) {
			$data = json_decode( (string) get_post_meta( $entry->ID, '_cf7p_payload', true ), true );
			if ( ! is_array( $data ) ) {
				$data = array();
			}
			foreach ( array_keys( $data ) as $k ) {
				$all_keys[ $k ] = true;
			}
			$rows[] = array(
				'date' => $entry->post_date,
				'form' => (string) get_post_meta( $entry->ID, '_cf7p_form_title', true ),
				'url'  => (string) get_post_meta( $entry->ID, '_cf7p_page_url', true ),
				'data' => $data,
			);
		}

		$field_keys = array_keys( $all_keys );
		header( 'Content-Type: text/csv; charset=utf-8' );
		header( 'Content-Disposition: attachment; filename=cf7-pro-entries-' . gmdate( 'Y-m-d' ) . '.csv' );

		$out = fopen( 'php://output', 'w' );
		if ( false === $out ) {
			exit;
		}

		fputcsv( $out, array_merge( array( 'Date', 'Formulaire', 'Page URL' ), $field_keys ) );
		foreach ( $rows as $row ) {
			$line = array( $row['date'], $row['form'], $row['url'] );
			foreach ( $field_keys as $fk ) {
				$v      = $row['data'][ $fk ] ?? '';
				$line[] = is_array( $v ) ? implode( ', ', $v ) : (string) $v;
			}
			fputcsv( $out, $line );
		}
		fclose( $out );
		exit;
	}

	/**
	 * Remove internal CF7/CF7P keys and sanitize submitted fields.
	 *
	 * @param array<string, mixed> $posted Raw posted array.
	 * @return array<string, mixed>
	 */
	private static function clean_posted_data( array $posted ): array {
		$clean = array();
		foreach ( $posted as $key => $val ) {
			if ( 0 === strpos( (string) $key, '_wpcf7' ) || '_cf7p_hidden_fields' === $key ) {
				continue;
			}
			if ( is_array( $val ) ) {
				$clean[ sanitize_key( (string) $key ) ] = array_map( 'sanitize_textarea_field', $val );
			} else {
				$clean[ sanitize_key( (string) $key ) ] = sanitize_textarea_field( (string) $val );
			}
		}
		return $clean;
	}
}
