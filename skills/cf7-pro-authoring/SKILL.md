---
name: cf7-pro-authoring
description: >
  Use when creating, styling, or validating WordPress Contact Form 7 forms enhanced with
  CF7 Pro Suite (multi-step wizards, conditional logic with server-side validation,
  live quote/price calculators, clickable radio/checkbox cards, drag-and-drop uploads,
  WhatsApp/URL redirects, dynamic prefill tokens, and JSON webhooks).
---

# Contact Form 7 Pro Authoring Skill

Generate production-ready Contact Form 7 (`CF7`) markup enhanced with **CF7 Pro Suite (`cf7p`)** attributes — surpassing WPForms Pro while staying 100% free, lightweight, and open-source.

---

## 1. Contact Form 7 Tag Grammar

Every CF7 form combines standard HTML with CF7 form tags:

```text
[type name option1 option2 "value1" "value2"]
```

- **Required fields** append `*` to the tag type: `[text* full_name]`, `[email* client_email]`, `[tel* phone]`, `[select* service "..."]`.
- **Single-input tags** with no choices: `[text* nom placeholder "Jean Dupont"]`, `[email* email]`, `[tel phone]`, `[number pages min:1 max:100 "5"]`, `[range budget min:500 max:10000 step:500 "2000"]`, `[textarea* message]`, `[hidden total_estime]`.
- **Choice tags** (`radio`, `checkbox`, `select`):
  - Always add `use_label_element` on `radio` and `checkbox` for accessibility and `.cf7p-cards` styling:
    `[radio type_projet use_label_element default:1 "Site Vitrine (+1200€)" "E-commerce (+2800€)"]`
- **Submit button**: Every form MUST end with a `[submit ...]` tag outside or inside the final step:
  `[submit class:cf7p-btn "Envoyer ma demande"]`

---

## 2. CF7 Pro Suite (`data-cf7p-*` & `.cf7p-*`) Reference

### A. Modern Theme Wrappers (wrap the entire form)
- `.cf7p-theme-modern` — Clean rounded inputs, focus ring, responsive spacing
- `.cf7p-theme-glass` — Dark Glassmorphism container (`backdrop-filter: blur(18px)`)

### B. Multi-Step Wizard (`data-cf7p-step`)
Wrap each step inside `<div data-cf7p-step="Titre de l'étape">...</div>`.
The runtime automatically builds the animated progress bar, step pills, `← Précédent` / `Suivant →` buttons, and validates required fields before allowing navigation to the next step.

### C. Conditional Logic (`data-cf7p-show-if` / `data-cf7p-hide-if`)
- Operators: `=`, `!=`, `*=`, `>`, `>=`, `<`, `<=`, combined with `&&` (AND) or `||` (OR).
- Example: `<div data-cf7p-show-if="type_client=Entreprise && budget>=2000">...</div>`
- **Server-side safe**: Required fields (`[text* siret]`) inside a hidden conditional branch are automatically exempted from PHP validation on submission.

### D. Live Quote & Price Calculator (`data-cf7p-calc`)
- Place `<strong data-cf7p-calc="formula" data-cf7p-suffix=" €" data-cf7p-target-input="hidden_field_name">0 €</strong>` anywhere in the form.
- Supported operations: `+`, `-`, `*`, `/`, `()`, `round(x)`, `min(a,b)`, `max(a,b)`, plus any CF7 field name. Numeric values inside radio/checkbox labels (e.g., `"SEO (+450€)"`) are extracted automatically!
- Always pair `data-cf7p-target-input="total_estime"` with `[hidden total_estime]` so the calculated amount is included in emails, CSV exports, and webhooks.

### E. Interactive Controls & Post-Submission Actions
- `.cf7p-cards` around `[radio ...]` or `[checkbox ...]` -> turns options into clickable glowing UI cards.
- `.cf7p-dropzone` around `[file ...]` -> Drag & Drop upload box with filename/size display.
- `.cf7p-range` around `[range ...]` (with optional `data-cf7p-suffix=" €"`) -> live numeric pill next to the slider.
- `<div data-cf7p-whatsapp="33600000000" data-cf7p-whatsapp-template="Bonjour, je suis {nom}. Devis : {total_estime}"></div>` -> opens pre-filled WhatsApp message after successful submission.
- `<div data-cf7p-redirect="https://example.com/merci"></div>` -> redirects after `wpcf7mailsent`.
- `<div data-cf7p-success-modal="Merci ! Votre devis est en route."></div>` -> animated confirmation modal.

### F. Dynamic Prefill Tokens, Anti-Spam & Webhooks
- Inline tokens inside CF7 form HTML: `{{post:title}}`, `{{post:url}}`, `{{acf:field}}`, `{{woo:price}}`, `{{user:email}}`, `{{user:first_name}}`, `{{query:utm_source|Direct}}`, `{{date:Y}}`.
- URL prefill on a tag: `[text* source default:query]` reads `?source=...` from the URL.
- **Anti-Spam (`CF7P_Antispam`)**:
  - **Cloudflare Turnstile**: Configure keys under **Contact > Anti-Spam CF7 Pro** (loaded strictly on pages with a form). Automatically injected before `[submit]`, or place `[cf7p_turnstile]` explicitly at a custom position.
  - **Smart reCAPTCHA Optimizer**: Blocks CF7's Google reCAPTCHA script on all pages without forms.
  - **Zero-JS Invisible Shield**: Honeypot + cryptographic HMAC time-trap + IP rate-limiting active by default.
- **JSON Webhook (n8n, Make, Zapier, CRM)**: In the Contact Form 7 **Additional Settings** tab, add:
  ```text
  cf7p_webhook: https://hook.eu1.make.com/your-webhook-id
  ```

---

## 3. Validated Example: Multi-Step Quote Calculator Form

```html
<div class="cf7p-theme-glass">
  <div data-cf7p-step="Projet">
    <p>Type de projet</p>
    <div class="cf7p-cards">
      [radio type_projet use_label_element default:1 "Site Vitrine (+1200€)" "E-commerce (+2800€)" "Application Web (+4500€)"]
    </div>

    <p>Nombre de pages</p>
    <div class="cf7p-range" data-cf7p-suffix=" pages">
      [range nb_pages min:1 max:30 step:1 "5"]
    </div>

    <div data-cf7p-show-if="type_projet*=E-commerce">
      <p>Nombre de produits initiaux</p>
      [number nb_produits min:1 max:5000 "50"]
    </div>
  </div>

  <div data-cf7p-step="Options &amp; Estimation">
    <div class="cf7p-cards">
      [checkbox options use_label_element "Pack SEO (+450€)" "Design 3D (+600€)"]
    </div>

    <div class="cf7p-calc-box">
      <span>Estimation indicative :</span>
      <strong data-cf7p-calc="type_projet + (nb_pages * 120) + options" data-cf7p-suffix=" €" data-cf7p-target-input="total_estime">0 €</strong>
    </div>
    [hidden total_estime]
  </div>

  <div data-cf7p-step="Coordonnées">
    <label>Nom complet [text* nom placeholder "Morel Urbain"]</label>
    <label>Email [email* email placeholder "vous@exemple.com"]</label>
    <div class="cf7p-dropzone">
      [file cahier_charges limit:5mb filetypes:pdf|doc|docx]
    </div>
    [submit class:cf7p-btn "Recevoir mon devis"]
  </div>

  <div data-cf7p-success-modal="Merci ! Votre estimation a bien été enregistrée."></div>
</div>
```

---

## 4. Validation

Always validate generated CF7 markup before delivery:

```bash
node scripts/validate-cf7.js --file my-form.html
```
