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

	// --- Smart Fields (v1.2.0) ---
	const PHONE_COUNTRIES = [
		{ code: 'FR', dial: '+33', flag: '🇫🇷', tz: 'Europe/Paris' },
		{ code: 'BJ', dial: '+229', flag: '🇧🇯', tz: 'Africa/Porto-Novo' },
		{ code: 'CI', dial: '+225', flag: '🇨🇮', tz: 'Africa/Abidjan' },
		{ code: 'SN', dial: '+221', flag: '🇸🇳', tz: 'Africa/Dakar' },
		{ code: 'TG', dial: '+228', flag: '🇹🇬', tz: 'Africa/Lome' },
		{ code: 'CM', dial: '+237', flag: '🇨🇲', tz: 'Africa/Douala' },
		{ code: 'BF', dial: '+226', flag: '🇧🇫', tz: 'Africa/Ouagadougou' },
		{ code: 'ML', dial: '+223', flag: '🇲🇱', tz: 'Africa/Bamako' },
		{ code: 'GA', dial: '+241', flag: '🇬🇦', tz: 'Africa/Libreville' },
		{ code: 'CD', dial: '+243', flag: '🇨🇩', tz: 'Africa/Kinshasa' },
		{ code: 'MA', dial: '+212', flag: '🇲🇦', tz: 'Africa/Casablanca' },
		{ code: 'TN', dial: '+216', flag: '🇹🇳', tz: 'Africa/Tunis' },
		{ code: 'DZ', dial: '+213', flag: '🇩🇿', tz: 'Africa/Algiers' },
		{ code: 'BE', dial: '+32', flag: '🇧🇪', tz: 'Europe/Brussels' },
		{ code: 'CH', dial: '+41', flag: '🇨🇭', tz: 'Europe/Zurich' },
		{ code: 'CA', dial: '+1', flag: '🇨🇦', tz: 'America/Toronto' },
		{ code: 'US', dial: '+1', flag: '🇺🇸', tz: 'America/New_York' },
		{ code: 'GB', dial: '+44', flag: '🇬🇧', tz: 'Europe/London' },
		{ code: 'DE', dial: '+49', flag: '🇩🇪', tz: 'Europe/Berlin' },
		{ code: 'ES', dial: '+34', flag: '🇪🇸', tz: 'Europe/Madrid' },
		{ code: 'IT', dial: '+39', flag: '🇮🇹', tz: 'Europe/Rome' },
	];

	function detectCountryCode( fallbackCode ) {
		if ( fallbackCode ) return fallbackCode.toUpperCase();
		try {
			const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
			const match = PHONE_COUNTRIES.find( ( c ) => c.tz === tz );
			if ( match ) return match.code;
		} catch ( _ ) {}
		return 'FR';
	}

	function initSmartPhones( form ) {
		form.querySelectorAll( '.cf7p-smart-phone' ).forEach( ( box ) => {
			const telInput = box.querySelector( 'input[type="tel"], input[type="text"]' );
			if ( ! telInput || box.dataset.cf7pPhoneInit === '1' ) return;
			box.dataset.cf7pPhoneInit = '1';

			const defaultCode = detectCountryCode( box.getAttribute( 'data-cf7p-default-country' ) );
			const row = document.createElement( 'div' );
			row.className = 'cf7p-phone-row';

			const select = document.createElement( 'select' );
			select.className = 'cf7p-phone-country';
			select.setAttribute( 'aria-label', 'Indicatif pays' );
			PHONE_COUNTRIES.forEach( ( c ) => {
				const opt = document.createElement( 'option' );
				opt.value = c.dial;
				opt.textContent = `${ c.flag } ${ c.code } (${ c.dial })`;
				if ( c.code === defaultCode ) opt.selected = true;
				select.appendChild( opt );
			} );

			const localInput = document.createElement( 'input' );
			localInput.type = 'tel';
			localInput.className = 'cf7p-phone-local';
			localInput.placeholder = telInput.placeholder || '6 12 34 56 78';
			localInput.required = telInput.required;

			telInput.type = 'hidden';
			telInput.parentNode.insertBefore( row, telInput );
			row.appendChild( select );
			row.appendChild( localInput );

			const sync = () => {
				const digits = localInput.value.replace( /[^\d]/g, '' );
				const cleanLocal = digits.replace( /^0+(?=\d)/, '' );
				telInput.value = cleanLocal ? `${ select.value } ${ cleanLocal }` : '';
				telInput.dispatchEvent( new Event( 'input', { bubbles: true } ) );
			};

			select.addEventListener( 'change', sync );
			localInput.addEventListener( 'input', sync );
		} );
	}

	function initSignatures( form ) {
		form.querySelectorAll( '.cf7p-signature' ).forEach( ( box ) => {
			const target = box.querySelector( 'input[type="hidden"], input[type="text"]' );
			if ( ! target || box.dataset.cf7pSigInit === '1' ) return;
			box.dataset.cf7pSigInit = '1';

			const canvas = document.createElement( 'canvas' );
			canvas.className = 'cf7p-sig-canvas';
			canvas.width = 520;
			canvas.height = 170;

			const clearBtn = document.createElement( 'button' );
			clearBtn.type = 'button';
			clearBtn.className = 'cf7p-sig-clear';
			clearBtn.textContent = 'Effacer la signature';

			box.appendChild( canvas );
			box.appendChild( clearBtn );

			const ctx = canvas.getContext( '2d' );
			ctx.strokeStyle = getComputedStyle( box ).color || '#0f172a';
			ctx.lineWidth = 2.4;
			ctx.lineCap = 'round';
			ctx.lineJoin = 'round';

			let drawing = false;
			const getPos = ( e ) => {
				const rect = canvas.getBoundingClientRect();
				return {
					x: ( ( e.clientX - rect.left ) / rect.width ) * canvas.width,
					y: ( ( e.clientY - rect.top ) / rect.height ) * canvas.height,
				};
			};

			canvas.addEventListener( 'pointerdown', ( e ) => {
				drawing = true;
				canvas.setPointerCapture( e.pointerId );
				const p = getPos( e );
				ctx.beginPath();
				ctx.moveTo( p.x, p.y );
			} );

			canvas.addEventListener( 'pointermove', ( e ) => {
				if ( ! drawing ) return;
				const p = getPos( e );
				ctx.lineTo( p.x, p.y );
				ctx.stroke();
			} );

			const finish = () => {
				if ( ! drawing ) return;
				drawing = false;
				target.value = canvas.toDataURL( 'image/png' );
				target.dispatchEvent( new Event( 'change', { bubbles: true } ) );
			};
			canvas.addEventListener( 'pointerup', finish );
			canvas.addEventListener( 'pointercancel', finish );

			clearBtn.addEventListener( 'click', () => {
				ctx.clearRect( 0, 0, canvas.width, canvas.height );
				target.value = '';
				target.dispatchEvent( new Event( 'change', { bubbles: true } ) );
			} );
		} );
	}

	function initRatings( form ) {
		form.querySelectorAll( '.cf7p-rating' ).forEach( ( box ) => {
			const target = box.querySelector( 'input[type="hidden"], input[type="number"], input[type="text"]' );
			if ( ! target || box.dataset.cf7pRateInit === '1' ) return;
			box.dataset.cf7pRateInit = '1';

			target.style.display = 'none';
			const max = parseInt( box.getAttribute( 'data-cf7p-max' ) || '5', 10 );
			const starsWrap = document.createElement( 'div' );
			starsWrap.className = 'cf7p-stars';
			const buttons = [];

			const paint = ( val ) => {
				buttons.forEach( ( b, i ) => {
					b.classList.toggle( 'is-active', i < val );
				} );
			};

			for ( let i = 1; i <= max; i++ ) {
				const btn = document.createElement( 'button' );
				btn.type = 'button';
				btn.className = 'cf7p-star-btn';
				btn.textContent = '★';
				btn.setAttribute( 'aria-label', `${ i } / ${ max }` );
				btn.addEventListener( 'mouseenter', () => paint( i ) );
				btn.addEventListener( 'click', () => {
					target.value = String( i );
					paint( i );
					target.dispatchEvent( new Event( 'input', { bubbles: true } ) );
					target.dispatchEvent( new Event( 'change', { bubbles: true } ) );
				} );
				buttons.push( btn );
				starsWrap.appendChild( btn );
			}

			starsWrap.addEventListener( 'mouseleave', () => paint( parseInt( target.value || '0', 10 ) ) );
			box.appendChild( starsWrap );
			paint( parseInt( target.value || '0', 10 ) );
		} );
	}

	function initSmartDates( form ) {
		form.querySelectorAll( '.cf7p-smart-date' ).forEach( ( box ) => {
			const dateInput = box.querySelector( 'input[type="date"]' );
			if ( ! dateInput || box.dataset.cf7pDateInit === '1' ) return;
			box.dataset.cf7pDateInit = '1';

			if ( box.getAttribute( 'data-cf7p-min-today' ) !== 'false' ) {
				dateInput.min = new Date().toISOString().split( 'T' )[ 0 ];
			}

			const disabledDays = ( box.getAttribute( 'data-cf7p-disable-days' ) || '' )
				.split( ',' )
				.map( ( d ) => d.trim() )
				.filter( ( d ) => d !== '' )
				.map( Number );

			if ( disabledDays.length ) {
				const warn = document.createElement( 'small' );
				warn.className = 'cf7p-date-warn';
				warn.hidden = true;
				warn.textContent = 'Ce jour est fermé. Veuillez choisir une autre date.';
				box.appendChild( warn );

				dateInput.addEventListener( 'change', () => {
					if ( ! dateInput.value ) return;
					const day = new Date( dateInput.value + 'T12:00:00' ).getDay();
					if ( disabledDays.includes( day ) ) {
						dateInput.value = '';
						warn.hidden = false;
					} else {
						warn.hidden = true;
					}
				} );
			}

			const slotsAttr = box.getAttribute( 'data-cf7p-slots' );
			const slotTargetName = box.getAttribute( 'data-cf7p-slot-target' );
			if ( slotsAttr && slotTargetName ) {
				const targetInput = form.querySelector( `input[name="${ slotTargetName }"]` );
				const slotsWrap = document.createElement( 'div' );
				slotsWrap.className = 'cf7p-slots';
				slotsAttr.split( ',' ).map( ( s ) => s.trim() ).filter( Boolean ).forEach( ( slot ) => {
					const pill = document.createElement( 'button' );
					pill.type = 'button';
					pill.className = 'cf7p-slot-btn';
					pill.textContent = slot;
					pill.addEventListener( 'click', () => {
						slotsWrap.querySelectorAll( '.cf7p-slot-btn' ).forEach( ( p ) => p.classList.remove( 'is-selected' ) );
						pill.classList.add( 'is-selected' );
						if ( targetInput ) {
							targetInput.value = slot;
							targetInput.dispatchEvent( new Event( 'change', { bubbles: true } ) );
						}
					} );
					slotsWrap.appendChild( pill );
				} );
				box.appendChild( slotsWrap );
			}
		} );
	}

	function initMasks( form ) {
		form.querySelectorAll( '[data-cf7p-mask]' ).forEach( ( holder ) => {
			const mask = holder.getAttribute( 'data-cf7p-mask' );
			const input = holder.matches( 'input' ) ? holder : holder.querySelector( 'input[type="text"], input[type="tel"]' );
			if ( ! input || ! mask || input.dataset.cf7pMaskInit === '1' ) return;
			input.dataset.cf7pMaskInit = '1';

			input.addEventListener( 'input', () => {
				const raw = input.value.replace( /[^a-zA-Z0-9]/g, '' );
				let out = '';
				let ri = 0;
				for ( let mi = 0; mi < mask.length && ri < raw.length; mi++ ) {
					const m = mask[ mi ];
					const ch = raw[ ri ];
					if ( m === '9' ) {
						if ( /\d/.test( ch ) ) { out += ch; ri++; } else { ri++; mi--; }
					} else if ( m === 'A' ) {
						if ( /[a-zA-Z]/.test( ch ) ) { out += ch.toUpperCase(); ri++; } else { ri++; mi--; }
					} else if ( m === '*' ) {
						out += ch; ri++;
					} else {
						out += m;
					}
				}
				input.value = out;
			} );
		} );
	}

	function initRepeaters( form ) {
		form.querySelectorAll( '[data-cf7p-repeater]' ).forEach( ( box ) => {
			if ( box.dataset.cf7pRepInit === '1' ) return;
			box.dataset.cf7pRepInit = '1';

			const label = box.getAttribute( 'data-cf7p-repeater' ) || '+ Ajouter une ligne';
			const targetName = box.getAttribute( 'data-cf7p-target-input' );
			const rowTemplate = box.querySelector( '.cf7p-repeater-row' );
			if ( ! rowTemplate ) return;

			const rowsContainer = document.createElement( 'div' );
			rowsContainer.className = 'cf7p-repeater-rows';
			rowTemplate.parentNode.insertBefore( rowsContainer, rowTemplate );
			rowsContainer.appendChild( rowTemplate );

			const addBtn = document.createElement( 'button' );
			addBtn.type = 'button';
			addBtn.className = 'cf7p-btn cf7p-repeater-add';
			addBtn.textContent = label;
			box.appendChild( addBtn );

			const syncRepeater = () => {
				if ( ! targetName ) return;
				const target = form.querySelector( `input[name="${ targetName }"], textarea[name="${ targetName }"]` );
				if ( ! target ) return;
				const lines = Array.from( rowsContainer.querySelectorAll( '.cf7p-repeater-row' ) ).map( ( r, idx ) => {
					const vals = Array.from( r.querySelectorAll( 'input, select' ) )
						.map( ( inp ) => inp.value.trim() )
						.filter( Boolean );
					return vals.length ? `#${ idx + 1 }: ${ vals.join( ' | ' ) }` : '';
				} ).filter( Boolean );
				target.value = lines.join( '\n' );
			};

			addBtn.addEventListener( 'click', () => {
				const clone = rowTemplate.cloneNode( true );
				clone.querySelectorAll( 'input, select' ).forEach( ( inp ) => {
					inp.value = '';
					inp.removeAttribute( 'name' );
				} );
				const del = document.createElement( 'button' );
				del.type = 'button';
				del.className = 'cf7p-repeater-del';
				del.textContent = '×';
				del.addEventListener( 'click', () => {
					clone.remove();
					syncRepeater();
				} );
				clone.appendChild( del );
				rowsContainer.appendChild( clone );
			} );

			rowsContainer.addEventListener( 'input', syncRepeater );
			rowsContainer.addEventListener( 'change', syncRepeater );
		} );
	}

	function initMaxLengthCounters( form ) {
		form.querySelectorAll( '[data-cf7p-maxlength]' ).forEach( ( box ) => {
			const max = parseInt( box.getAttribute( 'data-cf7p-maxlength' ) || '0', 10 );
			const field = box.querySelector( 'textarea, input[type="text"]' );
			if ( ! field || ! max || box.dataset.cf7pMaxInit === '1' ) return;
			box.dataset.cf7pMaxInit = '1';

			field.maxLength = max;
			const counter = document.createElement( 'small' );
			counter.className = 'cf7p-char-counter';
			const sync = () => {
				counter.textContent = `${ field.value.length } / ${ max } caractères`;
			};
			box.appendChild( counter );
			field.addEventListener( 'input', sync );
			sync();
		} );
	}

	function bootForm( wrapper ) {
		const form = wrapper.querySelector( 'form.wpcf7-form' );
		if ( ! form || form.dataset.cf7pBooted === '1' ) return;
		form.dataset.cf7pBooted = '1';

		initSmartPhones( form );
		initSignatures( form );
		initRatings( form );
		initSmartDates( form );
		initMasks( form );
		initRepeaters( form );
		initMaxLengthCounters( form );
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
