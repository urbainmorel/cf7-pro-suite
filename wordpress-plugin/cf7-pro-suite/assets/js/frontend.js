( function () {
	'use strict';

	// --- Field Value Extraction ---
	function getFieldRawValues( form, name ) {
		const els = Array.from( form.querySelectorAll( `[name="${ name }"], [name="${ name }[]"]` ) );
		if ( ! els.length ) return [];

		const first = els[ 0 ];
		if ( first.type === 'checkbox' || first.type === 'radio' ) {
			return els.filter( ( el ) => el.checked ).map( ( el ) => el.value );
		}
		if ( first.tagName === 'SELECT' && first.multiple ) {
			return Array.from( first.selectedOptions ).map( ( o ) => o.value );
		}
		return [ first.value ];
	}

	function getFieldNumericValue( form, name ) {
		const container = form.querySelector( `[name="${ name }"], [name="${ name }[]"]` );
		if ( container && container.closest( '.cf7p-is-hidden' ) ) {
			return 0;
		}
		const vals = getFieldRawValues( form, name );
		if ( ! vals.length ) return 0;

		return vals.reduce( ( sum, raw ) => {
			const str = String( raw ).trim();
			if ( ! str ) return sum;
			if ( /^-?\d+(\.\d+)?$/.test( str ) ) return sum + parseFloat( str );
			const match = str.match( /(-?\d+(?:[.,]\d+)?)/ );
			return sum + ( match ? parseFloat( match[ 1 ].replace( ',', '.' ) ) : 0 );
		}, 0 );
	}

	// --- Safe Math Expression Parser (No eval / Function) ---
	function evaluateFormula( expr, form ) {
		const tokens = [];
		let i = 0;
		const s = String( expr || '' );

		while ( i < s.length ) {
			const ch = s[ i ];
			if ( /\s/.test( ch ) ) {
				i++;
				continue;
			}
			if ( /[+\-*/(),]/.test( ch ) ) {
				tokens.push( { type: 'op', val: ch } );
				i++;
				continue;
			}
			if ( /\d|\./.test( ch ) ) {
				let num = '';
				while ( i < s.length && /[\d.]/.test( s[ i ] ) ) {
					num += s[ i++ ];
				}
				tokens.push( { type: 'num', val: parseFloat( num ) || 0 } );
				continue;
			}
			if ( /[a-zA-Z_]/.test( ch ) ) {
				let id = '';
				while ( i < s.length && /[a-zA-Z0-9_-]/.test( s[ i ] ) ) {
					id += s[ i++ ];
				}
				tokens.push( { type: 'id', val: id } );
				continue;
			}
			i++;
		}

		let pos = 0;
		const peek = () => tokens[ pos ];
		const consume = () => tokens[ pos++ ];

		function parseExpr() {
			let left = parseTerm();
			while ( peek() && peek().type === 'op' && ( peek().val === '+' || peek().val === '-' ) ) {
				const op = consume().val;
				const right = parseTerm();
				left = op === '+' ? left + right : left - right;
			}
			return left;
		}

		function parseTerm() {
			let left = parseFactor();
			while ( peek() && peek().type === 'op' && ( peek().val === '*' || peek().val === '/' ) ) {
				const op = consume().val;
				const right = parseFactor();
				left = op === '*' ? left * right : right === 0 ? 0 : left / right;
			}
			return left;
		}

		function parseFactor() {
			const t = peek();
			if ( ! t ) return 0;

			if ( t.type === 'op' && t.val === '-' ) {
				consume();
				return -parseFactor();
			}
			if ( t.type === 'op' && t.val === '(' ) {
				consume();
				const v = parseExpr();
				if ( peek() && peek().val === ')' ) consume();
				return v;
			}
			if ( t.type === 'num' ) {
				consume();
				return t.val;
			}
			if ( t.type === 'id' ) {
				consume();
				if ( peek() && peek().type === 'op' && peek().val === '(' ) {
					consume();
					const args = [];
					if ( ! ( peek() && peek().val === ')' ) ) {
						args.push( parseExpr() );
						while ( peek() && peek().val === ',' ) {
							consume();
							args.push( parseExpr() );
						}
					}
					if ( peek() && peek().val === ')' ) consume();
					if ( t.val === 'round' ) return Math.round( args[ 0 ] || 0 );
					if ( t.val === 'min' ) return Math.min( ...args );
					if ( t.val === 'max' ) return Math.max( ...args );
					return args[ 0 ] || 0;
				}
				return getFieldNumericValue( form, t.val );
			}
			consume();
			return 0;
		}

		const result = parseExpr();
		return Number.isFinite( result ) ? result : 0;
	}

	// --- Conditional Logic Evaluator ---
	function evalSingleCondition( cond, form ) {
		const m = cond.trim().match( /^([a-zA-Z0-9_-]+)\s*(!=|>=|<=|\*=|=|>|<)\s*(.+)$/ );
		if ( ! m ) return true;

		const [ , fieldName, op, rawTarget ] = m;
		const target = rawTarget.trim().replace( /^["']|["']$/g, '' );
		const values = getFieldRawValues( form, fieldName );
		const joined = values.join( ', ' );

		if ( op === '=' ) return values.some( ( v ) => v.toLowerCase() === target.toLowerCase() );
		if ( op === '!=' ) return ! values.some( ( v ) => v.toLowerCase() === target.toLowerCase() );
		if ( op === '*=' ) return joined.toLowerCase().includes( target.toLowerCase() );

		const numActual = getFieldNumericValue( form, fieldName );
		const numTarget = parseFloat( target ) || 0;
		if ( op === '>' ) return numActual > numTarget;
		if ( op === '>=' ) return numActual >= numTarget;
		if ( op === '<' ) return numActual < numTarget;
		if ( op === '<=' ) return numActual <= numTarget;
		return true;
	}

	function evalConditionExpr( expr, form ) {
		const orGroups = String( expr ).split( '||' );
		return orGroups.some( ( group ) =>
			group.split( '&&' ).every( ( part ) => evalSingleCondition( part, form ) )
		);
	}

	function updateConditions( form ) {
		const hiddenNames = new Set();
		const blocks = form.querySelectorAll( '[data-cf7p-show-if], [data-cf7p-hide-if]' );

		blocks.forEach( ( block ) => {
			const showExpr = block.getAttribute( 'data-cf7p-show-if' );
			const hideExpr = block.getAttribute( 'data-cf7p-hide-if' );
			let visible = true;

			if ( showExpr ) visible = evalConditionExpr( showExpr, form );
			if ( hideExpr && evalConditionExpr( hideExpr, form ) ) visible = false;

			block.classList.toggle( 'cf7p-is-hidden', ! visible );
			block.hidden = ! visible;

			block.querySelectorAll( 'input, select, textarea' ).forEach( ( input ) => {
				if ( ! visible ) {
					if ( input.required ) {
						input.setAttribute( 'data-cf7p-was-req', '1' );
						input.required = false;
					}
					if ( input.name ) hiddenNames.add( input.name.replace( /\[\]$/, '' ) );
				} else if ( input.getAttribute( 'data-cf7p-was-req' ) === '1' ) {
					input.required = true;
				}
			} );
		} );

		const hiddenTracker = form.querySelector( 'input[name="_cf7p_hidden_fields"]' );
		if ( hiddenTracker ) {
			hiddenTracker.value = JSON.stringify( Array.from( hiddenNames ) );
		}
	}

	// --- Live Quote Calculator ---
	function updateCalculators( form ) {
		const calcs = form.querySelectorAll( '[data-cf7p-calc]' );
		if ( ! calcs.length ) return;

		const summary = {};
		calcs.forEach( ( el, idx ) => {
			const formula = el.getAttribute( 'data-cf7p-calc' );
			const prefix = el.getAttribute( 'data-cf7p-prefix' ) || '';
			const suffix = el.getAttribute( 'data-cf7p-suffix' ) || '';
			const decimals = parseInt( el.getAttribute( 'data-cf7p-decimals' ) || '0', 10 );
			const targetName = el.getAttribute( 'data-cf7p-target-input' );

			const val = evaluateFormula( formula, form );
			const formatted = prefix + val.toFixed( decimals ) + suffix;
			el.textContent = formatted;

			if ( targetName ) {
				const hiddenInput = form.querySelector( `input[name="${ targetName }"]` );
				if ( hiddenInput ) hiddenInput.value = formatted;
				summary[ targetName ] = formatted;
			} else {
				summary[ `calc_${ idx + 1 }` ] = formatted;
			}
		} );

		const summaryInput = form.querySelector( 'input[name="_cf7p_calc_summary"]' );
		if ( summaryInput ) {
			summaryInput.value = JSON.stringify( summary );
		}
	}

	// --- Multi-Step Wizard ---
	function validateStep( stepEl ) {
		const inputs = Array.from( stepEl.querySelectorAll( 'input, select, textarea' ) );
		let valid = true;

		inputs.forEach( ( input ) => {
			if ( input.closest( '.cf7p-is-hidden' ) || input.type === 'hidden' ) return;

			const wrap = input.closest( '.wpcf7-form-control-wrap' ) || input;
			const isReq =
				input.required ||
				input.classList.contains( 'wpcf7-validates-as-required' ) ||
				input.getAttribute( 'aria-required' ) === 'true';

			let fieldOk = true;
			if ( input.type === 'checkbox' || input.type === 'radio' ) {
				if ( isReq ) {
					const group = stepEl.querySelectorAll( `[name="${ input.name }"]` );
					fieldOk = Array.from( group ).some( ( g ) => g.checked );
				}
			} else if ( isReq && ! String( input.value || '' ).trim() ) {
				fieldOk = false;
			} else if ( input.type === 'email' && input.value && ! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test( input.value ) ) {
				fieldOk = false;
			}

			wrap.classList.toggle( 'cf7p-field-invalid', ! fieldOk );
			if ( ! fieldOk ) valid = false;
		} );

		return valid;
	}

	function initMultiStep( form ) {
		const steps = Array.from( form.querySelectorAll( '[data-cf7p-step]' ) );
		if ( steps.length < 2 ) return;

		form.classList.add( 'cf7p-has-steps' );
		const submitBtn = form.querySelector( '.wpcf7-submit, button[type="submit"], input[type="submit"]' );
		const submitWrap = submitBtn ? submitBtn.closest( 'p, div' ) || submitBtn : null;

		const progress = document.createElement( 'div' );
		progress.className = 'cf7p-progress';
		const bar = document.createElement( 'div' );
		bar.className = 'cf7p-progress-bar';
		const fill = document.createElement( 'div' );
		fill.className = 'cf7p-progress-fill';
		bar.appendChild( fill );

		const labels = document.createElement( 'div' );
		labels.className = 'cf7p-progress-labels';
		const pills = steps.map( ( s, idx ) => {
			const pill = document.createElement( 'span' );
			pill.className = 'cf7p-step-pill';
			pill.textContent = `${ idx + 1 }. ${ s.getAttribute( 'data-cf7p-step' ) || `Étape ${ idx + 1 }` }`;
			labels.appendChild( pill );
			return pill;
		} );

		progress.appendChild( labels );
		progress.appendChild( bar );
		steps[ 0 ].parentNode.insertBefore( progress, steps[ 0 ] );

		const nav = document.createElement( 'div' );
		nav.className = 'cf7p-step-nav';
		const prevBtn = document.createElement( 'button' );
		prevBtn.type = 'button';
		prevBtn.className = 'cf7p-btn cf7p-btn-prev';
		prevBtn.textContent = '← Précédent';

		const nextBtn = document.createElement( 'button' );
		nextBtn.type = 'button';
		nextBtn.className = 'cf7p-btn cf7p-btn-next';
		nextBtn.textContent = 'Suivant →';

		nav.appendChild( prevBtn );
		nav.appendChild( nextBtn );
		steps[ steps.length - 1 ].after( nav );

		let current = 0;

		function renderStep( idx ) {
			current = idx;
			steps.forEach( ( s, i ) => {
				s.hidden = i !== current;
				s.classList.toggle( 'cf7p-step-active', i === current );
			} );
			pills.forEach( ( p, i ) => {
				p.classList.toggle( 'is-active', i === current );
				p.classList.toggle( 'is-done', i < current );
			} );
			fill.style.width = `${ ( ( current + 1 ) / steps.length ) * 100 }%`;
			prevBtn.hidden = current === 0;
			nextBtn.hidden = current === steps.length - 1;
			if ( submitWrap ) {
				submitWrap.hidden = current !== steps.length - 1;
			}
		}

		prevBtn.addEventListener( 'click', () => {
			if ( current > 0 ) renderStep( current - 1 );
		} );

		nextBtn.addEventListener( 'click', () => {
			if ( validateStep( steps[ current ] ) && current < steps.length - 1 ) {
				renderStep( current + 1 );
			}
		} );

		renderStep( 0 );
	}

	// --- UI Enhancers: Cards, Dropzones, Range Bubbles ---
	function initUiEnhancers( form ) {
		// Radio & Checkbox Cards
		form.querySelectorAll( '.cf7p-cards input[type="radio"], .cf7p-cards input[type="checkbox"]' ).forEach( ( input ) => {
			const sync = () => {
				form.querySelectorAll( `.cf7p-cards input[name="${ input.name }"]` ).forEach( ( peer ) => {
					const item = peer.closest( '.wpcf7-list-item, label' );
					if ( item ) item.classList.toggle( 'is-checked', peer.checked );
				} );
			};
			input.addEventListener( 'change', sync );
			sync();
		} );

		// Drag & Drop File Zones
		form.querySelectorAll( '.cf7p-dropzone input[type="file"]' ).forEach( ( input ) => {
			const box = input.closest( '.cf7p-dropzone' );
			const status = document.createElement( 'span' );
			status.className = 'cf7p-dropzone-status';
			status.textContent = 'Glissez-déposez un fichier ou cliquez ici';
			box.appendChild( status );

			input.addEventListener( 'change', () => {
				if ( input.files && input.files.length ) {
					const f = input.files[ 0 ];
					status.textContent = `${ f.name } (${ Math.round( f.size / 1024 ) } Ko)`;
					box.classList.add( 'has-file' );
				} else {
					status.textContent = 'Glissez-déposez un fichier ou cliquez ici';
					box.classList.remove( 'has-file' );
				}
			} );

			box.addEventListener( 'dragover', ( e ) => {
				e.preventDefault();
				box.classList.add( 'is-dragover' );
			} );
			box.addEventListener( 'dragleave', () => box.classList.remove( 'is-dragover' ) );
			box.addEventListener( 'drop', () => box.classList.remove( 'is-dragover' ) );
		} );

		// Range Sliders with live output
		form.querySelectorAll( '.cf7p-range input[type="range"]' ).forEach( ( input ) => {
			const bubble = document.createElement( 'output' );
			bubble.className = 'cf7p-range-bubble';
			const prefix = input.closest( '.cf7p-range' ).getAttribute( 'data-cf7p-prefix' ) || '';
			const suffix = input.closest( '.cf7p-range' ).getAttribute( 'data-cf7p-suffix' ) || '';
			const sync = () => {
				bubble.textContent = prefix + input.value + suffix;
			};
			input.after( bubble );
			input.addEventListener( 'input', sync );
			sync();
		} );
	}

	// --- Conversion Actions on wpcf7mailsent ---
	function initSubmissionHandlers( wrapper, form ) {
		wrapper.addEventListener( 'wpcf7mailsent', ( event ) => {
			const dataMap = {};
			if ( event.detail && Array.isArray( event.detail.inputs ) ) {
				event.detail.inputs.forEach( ( item ) => {
					dataMap[ item.name ] = item.value;
				} );
			}

			const waContainer = form.querySelector( '[data-cf7p-whatsapp]' );
			if ( waContainer ) {
				const phone = waContainer.getAttribute( 'data-cf7p-whatsapp' ).replace( /[^\d]/g, '' );
				const tpl = waContainer.getAttribute( 'data-cf7p-whatsapp-template' ) || 'Nouvelle demande de contact';
				const text = tpl.replace( /\{([a-zA-Z0-9_-]+)\}/g, ( _, k ) => dataMap[ k ] || '' );
				if ( phone ) {
					window.open( `https://wa.me/${ phone }?text=${ encodeURIComponent( text ) }`, '_blank', 'noopener' );
				}
			}

			const redirectEl = form.querySelector( '[data-cf7p-redirect]' );
			if ( redirectEl ) {
				const url = redirectEl.getAttribute( 'data-cf7p-redirect' );
				if ( url ) {
					window.location.assign( url );
					return;
				}
			}

			const modalEl = form.querySelector( '[data-cf7p-success-modal]' );
			if ( modalEl ) {
				const msg = modalEl.getAttribute( 'data-cf7p-success-modal' ) || 'Merci ! Votre demande a bien été envoyée.';
				const overlay = document.createElement( 'div' );
				overlay.className = 'cf7p-success-overlay';
				overlay.innerHTML = `<div class="cf7p-success-card"><h3>Confirmation</h3><p></p><button type="button" class="cf7p-btn">Fermer</button></div>`;
				overlay.querySelector( 'p' ).textContent = msg;
				overlay.querySelector( 'button' ).addEventListener( 'click', () => overlay.remove() );
				document.body.appendChild( overlay );
			}
		} );
	}

	function bootForm( wrapper ) {
		const form = wrapper.querySelector( 'form.wpcf7-form' );
		if ( ! form || form.dataset.cf7pBooted === '1' ) return;
		form.dataset.cf7pBooted = '1';

		initUiEnhancers( form );
		initMultiStep( form );
		initSubmissionHandlers( wrapper, form );

		const refresh = () => {
			updateConditions( form );
			updateCalculators( form );
		};

		form.addEventListener( 'input', refresh );
		form.addEventListener( 'change', refresh );
		refresh();
	}

	function initAll() {
		document.querySelectorAll( '.wpcf7' ).forEach( bootForm );
	}

	if ( document.readyState === 'loading' ) {
		document.addEventListener( 'DOMContentLoaded', initAll );
	} else {
		initAll();
	}
} )();
