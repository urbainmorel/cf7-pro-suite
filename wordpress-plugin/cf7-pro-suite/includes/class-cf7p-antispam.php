<?php
/**
 * 3-Layer Zero-Bloat Anti-Spam Engine for Contact Form 7:
 * 1. Native Cloudflare Turnstile (loaded strictly on form pages)
 * 2. Smart Google reCAPTCHA v3 Optimizer (blocks reCAPTCHA on non-form pages)
 * 3. Zero-JS Invisible Shield (Honeypot + HMAC Time-Trap + IP Rate-Limiting)
 *
 * @package CF7ProSuite
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class CF7P_Antispam {

	const OPTION_KEY = 'cf7p_antispam_settings';

	/**
	 * Register WordPress & CF7 hooks.
	 */
	public static function init(): void {
		add_action( 'wpcf7_init', array( __CLASS__, 'register_turnstile_tag' ) );
		add_action( 'wp_enqueue_scripts', array( __CLASS__, 'maybe_dequeue_recaptcha' ), 99 );
		add_filter( 'wpcf7_form_elements', array( __CLASS__, 'inject_antispam_and_assets' ), 20 );
		add_filter( 'wpcf7_spam', array( __CLASS__, 'verify_submission' ), 10, 2 );
		add_action( 'admin_menu', array( __CLASS__, 'add_settings_page' ) );
		add_action( 'admin_init', array( __CLASS__, 'register_settings' ) );
	}

	/**
	 * Get merged plugin anti-spam settings with defaults.
	 *
	 * @return array<string, mixed>
	 */
	public static function get_settings(): array {
		$defaults = array(
			'turnstile_site_key'    => '',
			'turnstile_secret_key'  => '',
			'turnstile_theme'       => 'auto',
			'turnstile_auto_inject' => '1',
			'optimize_recaptcha'    => '1',
			'honeypot_enabled'      => '1',
			'min_submit_seconds'    => 3,
			'rate_limit_per_min'    => 5,
		);
		$saved    = get_option( self::OPTION_KEY, array() );
		return wp_parse_args( is_array( $saved ) ? $saved : array(), $defaults );
	}

	/**
	 * Register `[cf7p_turnstile]` CF7 form tag.
	 */
	public static function register_turnstile_tag(): void {
		if ( function_exists( 'wpcf7_add_form_tag' ) ) {
			wpcf7_add_form_tag( 'cf7p_turnstile', array( __CLASS__, 'render_turnstile_tag' ) );
		}
	}

	/**
	 * Render `[cf7p_turnstile]` widget container.
	 *
	 * @return string
	 */
	public static function render_turnstile_tag(): string {
		$cfg = self::get_settings();
		if ( empty( $cfg['turnstile_site_key'] ) ) {
			return '';
		}
		$theme = in_array( $cfg['turnstile_theme'], array( 'auto', 'light', 'dark' ), true ) ? $cfg['turnstile_theme'] : 'auto';
		return sprintf(
			'<div class="cf7p-turnstile-wrap" style="margin:0.75rem 0;"><div class="cf-turnstile" data-sitekey="%s" data-theme="%s"></div></div>',
			esc_attr( (string) $cfg['turnstile_site_key'] ),
			esc_attr( $theme )
		);
	}

	/**
	 * Block CF7's heavy Google reCAPTCHA script globally until a CF7 form actually renders.
	 */
	public static function maybe_dequeue_recaptcha(): void {
		$cfg = self::get_settings();
		if ( empty( $cfg['optimize_recaptcha'] ) ) {
			return;
		}
		wp_dequeue_script( 'google-recaptcha' );
		wp_dequeue_script( 'wpcf7-recaptcha' );
	}

	/**
	 * Inject Honeypot, HMAC Time-Trap, Turnstile widget & enqueue Turnstile/reCAPTCHA strictly on form pages.
	 *
	 * @param string $html Rendered CF7 form markup.
	 * @return string
	 */
	public static function inject_antispam_and_assets( string $html ): string {
		$cfg = self::get_settings();

		// Re-enable reCAPTCHA only on pages that actually render a CF7 form.
		if ( ! empty( $cfg['optimize_recaptcha'] ) ) {
			if ( wp_script_is( 'google-recaptcha', 'registered' ) ) {
				wp_enqueue_script( 'google-recaptcha' );
			}
			if ( wp_script_is( 'wpcf7-recaptcha', 'registered' ) ) {
				wp_enqueue_script( 'wpcf7-recaptcha' );
			}
		}

		// Load Cloudflare Turnstile strictly on form pages when configured.
		if ( ! empty( $cfg['turnstile_site_key'] ) ) {
			wp_enqueue_script(
				'cf7p-turnstile',
				'https://challenges.cloudflare.com/turnstile/v0/api.js',
				array(),
				null,
				true
			);

			if ( ! empty( $cfg['turnstile_auto_inject'] ) && false === strpos( $html, 'cf-turnstile' ) ) {
				$widget = self::render_turnstile_tag();
				if ( preg_match( '/<(?:input|button)[^>]*type=["\']submit["\']/i', $html ) ) {
					$html = (string) preg_replace(
						'/(<(?:input|button)[^>]*type=["\']submit["\'])/i',
						$widget . '$1',
						$html,
						1
					);
				} else {
					$html .= $widget;
				}
			}
		}

		// Zero-JS Invisible Shield (Honeypot + HMAC Time-Trap).
		$shield = '';
		if ( ! empty( $cfg['honeypot_enabled'] ) ) {
			$shield .= '<div style="position:absolute;left:-9999px;top:-9999px;height:0;overflow:hidden;" aria-hidden="true">';
			$shield .= '<label>Leave empty <input type="text" name="_cf7p_hp_website" value="" tabindex="-1" autocomplete="off" /></label>';
			$shield .= '</div>';
		}

		if ( (int) $cfg['min_submit_seconds'] > 0 ) {
			$ts      = (string) time();
			$sig     = wp_hash( 'cf7p_ts_' . $ts );
			$shield .= '<input type="hidden" name="_cf7p_ts" value="' . esc_attr( $ts ) . '" />';
			$shield .= '<input type="hidden" name="_cf7p_sig" value="' . esc_attr( $sig ) . '" />';
		}

		return $html . $shield;
	}

	/**
	 * Server-side spam verification via Honeypot, Time-Trap, Rate-Limit, and Cloudflare Turnstile.
	 *
	 * @param bool  $spam       Current spam status.
	 * @param mixed $submission WPCF7_Submission instance.
	 * @return bool
	 */
	public static function verify_submission( bool $spam, $submission = null ): bool {
		if ( $spam ) {
			return true;
		}

		$cfg = self::get_settings();

		// 1. Honeypot check.
		if ( ! empty( $cfg['honeypot_enabled'] ) && ! empty( $_POST['_cf7p_hp_website'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Missing
			return true;
		}

		// 2. Cryptographic HMAC Time-Trap check.
		$min_sec = (int) $cfg['min_submit_seconds'];
		if ( $min_sec > 0 ) {
			$ts  = isset( $_POST['_cf7p_ts'] ) ? sanitize_text_field( wp_unslash( (string) $_POST['_cf7p_ts'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Missing
			$sig = isset( $_POST['_cf7p_sig'] ) ? sanitize_text_field( wp_unslash( (string) $_POST['_cf7p_sig'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Missing

			if ( '' === $ts || '' === $sig || ! hash_equals( wp_hash( 'cf7p_ts_' . $ts ), $sig ) ) {
				return true;
			}
			if ( ( time() - (int) $ts ) < $min_sec ) {
				return true;
			}
		}

		// 3. IP Rate-Limit check.
		$limit = (int) $cfg['rate_limit_per_min'];
		if ( $limit > 0 ) {
			$ip    = isset( $_SERVER['REMOTE_ADDR'] ) ? sanitize_text_field( wp_unslash( (string) $_SERVER['REMOTE_ADDR'] ) ) : 'unknown';
			$t_key = 'cf7p_rl_' . md5( $ip );
			$count = (int) get_transient( $t_key );
			if ( $count >= $limit ) {
				return true;
			}
			set_transient( $t_key, $count + 1, MINUTE_IN_SECONDS );
		}

		// 4. Cloudflare Turnstile verification.
		if ( ! empty( $cfg['turnstile_site_key'] ) && ! empty( $cfg['turnstile_secret_key'] ) ) {
			$token = isset( $_POST['cf-turnstile-response'] ) ? sanitize_text_field( wp_unslash( (string) $_POST['cf-turnstile-response'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Missing
			if ( '' === $token ) {
				return true;
			}

			$remote_ip = isset( $_SERVER['REMOTE_ADDR'] ) ? sanitize_text_field( wp_unslash( (string) $_SERVER['REMOTE_ADDR'] ) ) : '';
			$response  = wp_remote_post(
				'https://challenges.cloudflare.com/turnstile/v0/siteverify',
				array(
					'timeout' => 8,
					'body'    => array(
						'secret'   => (string) $cfg['turnstile_secret_key'],
						'response' => $token,
						'remoteip' => $remote_ip,
					),
				)
			);

			if ( is_wp_error( $response ) ) {
				return false; // Fail open on temporary Cloudflare network outage.
			}

			$body = json_decode( (string) wp_remote_retrieve_body( $response ), true );
			if ( empty( $body['success'] ) ) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Add Anti-Spam settings submenu under Contact Form 7.
	 */
	public static function add_settings_page(): void {
		add_submenu_page(
			'wpcf7',
			__( 'Anti-Spam CF7 Pro', 'cf7-pro-suite' ),
			__( 'Anti-Spam CF7 Pro', 'cf7-pro-suite' ),
			'manage_options',
			'cf7p-antispam',
			array( __CLASS__, 'render_settings_page' )
		);
	}

	/**
	 * Register option & sanitizer.
	 */
	public static function register_settings(): void {
		register_setting( 'cf7p_antispam_group', self::OPTION_KEY, array( __CLASS__, 'sanitize_settings' ) );
	}

	/**
	 * Sanitize Anti-Spam settings input.
	 *
	 * @param mixed $input Raw POST array.
	 * @return array<string, mixed>
	 */
	public static function sanitize_settings( $input ): array {
		$in = is_array( $input ) ? $input : array();
		return array(
			'turnstile_site_key'    => sanitize_text_field( (string) ( $in['turnstile_site_key'] ?? '' ) ),
			'turnstile_secret_key'  => sanitize_text_field( (string) ( $in['turnstile_secret_key'] ?? '' ) ),
			'turnstile_theme'       => in_array( $in['turnstile_theme'] ?? 'auto', array( 'auto', 'light', 'dark' ), true ) ? $in['turnstile_theme'] : 'auto',
			'turnstile_auto_inject' => ! empty( $in['turnstile_auto_inject'] ) ? '1' : '0',
			'optimize_recaptcha'    => ! empty( $in['optimize_recaptcha'] ) ? '1' : '0',
			'honeypot_enabled'      => ! empty( $in['honeypot_enabled'] ) ? '1' : '0',
			'min_submit_seconds'    => max( 0, min( 30, (int) ( $in['min_submit_seconds'] ?? 3 ) ) ),
			'rate_limit_per_min'    => max( 0, min( 100, (int) ( $in['rate_limit_per_min'] ?? 5 ) ) ),
		);
	}

	/**
	 * Render Anti-Spam settings page.
	 */
	public static function render_settings_page(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}
		$cfg = self::get_settings();
		$opt = self::OPTION_KEY;
		?>
		<div class="wrap">
			<h1><?php esc_html_e( 'Anti-Spam CF7 Pro (Cloudflare Turnstile & Optimiseur reCAPTCHA)', 'cf7-pro-suite' ); ?></h1>
			<form method="post" action="options.php">
				<?php settings_fields( 'cf7p_antispam_group' ); ?>
				<table class="form-table" role="presentation">
					<tr>
						<th scope="row"><?php esc_html_e( 'Cloudflare Turnstile Site Key', 'cf7-pro-suite' ); ?></th>
						<td><input type="text" class="regular-text" name="<?php echo esc_attr( $opt ); ?>[turnstile_site_key]" value="<?php echo esc_attr( (string) $cfg['turnstile_site_key'] ); ?>" placeholder="0x4AAAAAAA..." /></td>
					</tr>
					<tr>
						<th scope="row"><?php esc_html_e( 'Cloudflare Turnstile Secret Key', 'cf7-pro-suite' ); ?></th>
						<td><input type="password" class="regular-text" name="<?php echo esc_attr( $opt ); ?>[turnstile_secret_key]" value="<?php echo esc_attr( (string) $cfg['turnstile_secret_key'] ); ?>" placeholder="0x4AAAAAAA..." /></td>
					</tr>
					<tr>
						<th scope="row"><?php esc_html_e( 'Thème Turnstile', 'cf7-pro-suite' ); ?></th>
						<td>
							<select name="<?php echo esc_attr( $opt ); ?>[turnstile_theme]">
								<option value="auto" <?php selected( $cfg['turnstile_theme'], 'auto' ); ?>>Auto</option>
								<option value="light" <?php selected( $cfg['turnstile_theme'], 'light' ); ?>>Light</option>
								<option value="dark" <?php selected( $cfg['turnstile_theme'], 'dark' ); ?>>Dark</option>
							</select>
						</td>
					</tr>
					<tr>
						<th scope="row"><?php esc_html_e( 'Injection auto Turnstile', 'cf7-pro-suite' ); ?></th>
						<td><label><input type="checkbox" name="<?php echo esc_attr( $opt ); ?>[turnstile_auto_inject]" value="1" <?php checked( $cfg['turnstile_auto_inject'], '1' ); ?> /> <?php esc_html_e( 'Insérer automatiquement avant le bouton Envoyer (ou utilisez [cf7p_turnstile])', 'cf7-pro-suite' ); ?></label></td>
					</tr>
					<tr>
						<th scope="row"><?php esc_html_e( 'Optimiseur Google reCAPTCHA v3', 'cf7-pro-suite' ); ?></th>
						<td><label><input type="checkbox" name="<?php echo esc_attr( $opt ); ?>[optimize_recaptcha]" value="1" <?php checked( $cfg['optimize_recaptcha'], '1' ); ?> /> <?php esc_html_e( 'Bloquer le script reCAPTCHA sur toutes les pages sans formulaire CF7 (+PageSpeed)', 'cf7-pro-suite' ); ?></label></td>
					</tr>
					<tr>
						<th scope="row"><?php esc_html_e( 'Bouclier Honeypot invisible', 'cf7-pro-suite' ); ?></th>
						<td><label><input type="checkbox" name="<?php echo esc_attr( $opt ); ?>[honeypot_enabled]" value="1" <?php checked( $cfg['honeypot_enabled'], '1' ); ?> /> <?php esc_html_e( 'Actif (0 JS)', 'cf7-pro-suite' ); ?></label></td>
					</tr>
					<tr>
						<th scope="row"><?php esc_html_e( 'Délai minimum soumission (secondes)', 'cf7-pro-suite' ); ?></th>
						<td><input type="number" min="0" max="30" name="<?php echo esc_attr( $opt ); ?>[min_submit_seconds]" value="<?php echo esc_attr( (string) $cfg['min_submit_seconds'] ); ?>" /></td>
					</tr>
					<tr>
						<th scope="row"><?php esc_html_e( 'Limite par IP / minute', 'cf7-pro-suite' ); ?></th>
						<td><input type="number" min="0" max="100" name="<?php echo esc_attr( $opt ); ?>[rate_limit_per_min]" value="<?php echo esc_attr( (string) $cfg['rate_limit_per_min'] ); ?>" /></td>
					</tr>
				</table>
				<?php submit_button(); ?>
			</form>
		</div>
		<?php
	}
}
