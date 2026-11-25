( function () {
	'use strict';

	function insertAtCursor( textarea, snippet ) {
		const start = textarea.selectionStart || 0;
		const end = textarea.selectionEnd || 0;
		const val = textarea.value;
		textarea.value = val.slice( 0, start ) + snippet + val.slice( end );
		textarea.selectionStart = textarea.selectionEnd = start + snippet.length;
		textarea.focus();
	}

	function initToolbar() {
		const textarea = document.getElementById( 'wpcf7-form' );
		if ( ! textarea || document.getElementById( 'cf7p-admin-toolbar' ) ) return;

		const bar = document.createElement( 'div' );
		bar.id = 'cf7p-admin-toolbar';
		bar.style.cssText =
			'display:flex;flex-wrap:wrap;gap:6px;margin:8px 0;padding:8px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:6px;';

		const snippets = [
			{
				label: '+ Étape Multi-Step',
				code: '\n<div data-cf7p-step="Nom de l\'étape">\n  \n</div>\n',
			},
			{
				label: '+ Condition (Show If)',
				code: '\n<div data-cf7p-show-if="champ=Valeur">\n  \n</div>\n',
			},
			{
				label: '+ Calculateur Devis',
				code: '\n<div class="cf7p-calc-box">\n  <span>Total estimé :</span>\n  <strong data-cf7p-calc="quantite * 150" data-cf7p-suffix=" €" data-cf7p-target-input="total_estime">0 €</strong>\n</div>\n[hidden total_estime]\n',
			},
			{
				label: '+ Cartes Radio',
				code: '\n<div class="cf7p-cards">\n  [radio choix use_label_element default:1 "Option A" "Option B"]\n</div>\n',
			},
			{
				label: '+ Zone Drag & Drop',
				code: '\n<div class="cf7p-dropzone">\n  [file fichier limit:5mb filetypes:pdf|png|jpg]\n</div>\n',
			},
			{
				label: '+ WhatsApp après envoi',
				code: '\n<div data-cf7p-whatsapp="33600000000" data-cf7p-whatsapp-template="Bonjour, je suis {nom} ({email})."></div>\n',
			},
			{
				label: '+ Cloudflare Turnstile',
				code: '\n[cf7p_turnstile]\n',
			},
			{
				label: '+ Téléphone Intelligent',
				code: '\n<div class="cf7p-smart-phone" data-cf7p-default-country="FR">\n  [tel* telephone]\n</div>\n',
			},
			{
				label: '+ Signature Tactile',
				code: '\n<div class="cf7p-signature">\n  [hidden signature_client]\n</div>\n',
			},
			{
				label: '+ Notation Étoiles',
				code: '\n<div class="cf7p-rating" data-cf7p-max="5">\n  [hidden note_client]\n</div>\n',
			},
			{
				label: '+ Date & Créneaux RDV',
				code: '\n<div class="cf7p-smart-date" data-cf7p-disable-days="0" data-cf7p-slots="09:00,11:00,14:30,16:30" data-cf7p-slot-target="heure_rdv">\n  [date* date_rdv]\n  [hidden heure_rdv]\n</div>\n',
			},
			{
				label: '+ Masque Saisie',
				code: '\n<div data-cf7p-mask="999 999 999 99999">\n  [text siret placeholder "123 456 789 00012"]\n</div>\n',
			},
			{
				label: '+ Répéteur Dynamique',
				code: '\n<div data-cf7p-repeater="+ Ajouter une ligne" data-cf7p-target-input="lignes_details">\n  <div class="cf7p-repeater-row">\n    <input type="text" placeholder="Nom" />\n    <input type="text" placeholder="Rôle" />\n  </div>\n</div>\n[hidden lignes_details]\n',
			},
			{
				label: '+ Switch Toggle',
				code: '\n<div class="cf7p-toggle">\n  [checkbox option_vip use_label_element "Activer le suivi VIP"]\n</div>\n',
			},
		];

		snippets.forEach( ( item ) => {
			const btn = document.createElement( 'button' );
			btn.type = 'button';
			btn.className = 'button button-secondary';
			btn.textContent = item.label;
			btn.addEventListener( 'click', () => insertAtCursor( textarea, item.code ) );
			bar.appendChild( btn );
		} );

		textarea.parentNode.insertBefore( bar, textarea );
	}

	if ( document.readyState === 'loading' ) {
		document.addEventListener( 'DOMContentLoaded', initToolbar );
	} else {
		initToolbar();
	}
} )();
