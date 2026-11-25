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
