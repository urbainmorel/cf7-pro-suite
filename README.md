# CF7 Pro Suite + Universal AI Form Authoring Skill

**100% Free & Open-Source (`v1.2.0`)** (`GPL-2.0-or-later` + `MIT`) — Turn **Contact Form 7** into a **WPForms Pro / Typeform-killer** with **0 bytes loaded on pages without a form**, plus a Universal AI Agent Skill for generating and validating multi-step, conditional, smart-field, and calculator forms in seconds.

---

## Features (Surpassing WPForms Pro for \$0)

| Feature | How it works | Overhead on non-form pages |
| :--- | :--- | :--- |
| **Smart International Phone** | `.cf7p-smart-phone` adds country flags, dial codes, Cloudflare `HTTP_CF_IPCOUNTRY` IP detection + timezone fallback (0 external APIs) | 0 bytes |
| **Digital Signature, Star Rating & Masks** | `.cf7p-signature` (touch/mouse canvas), `.cf7p-rating`, `data-cf7p-mask`, `.cf7p-toggle`, `data-cf7p-maxlength` | 0 bytes |
| **Smart Date, Slots & Repeater** | `.cf7p-smart-date` (block closed days + time slot pills) & `data-cf7p-repeater` dynamic rows | 0 bytes |
| **Cloudflare Turnstile & Smart reCAPTCHA** | Native `[cf7p_turnstile]` (auto or manual) + blocks CF7's heavy reCAPTCHA script on non-form pages | 0 bytes |
| **Zero-JS Anti-Spam Shield** | Invisible Honeypot + Cryptographic HMAC Time-Trap + IP Rate-Limiting | 0 bytes |
| **Multi-Step Wizard** | Wrap steps in `<div data-cf7p-step="Step Name">` — auto progress bar & step validation | 0 bytes |
| **Conditional Logic** | `data-cf7p-show-if` / `data-cf7p-hide-if` + **PHP `wpcf7_validate` exemption** for hidden required fields | 0 bytes |
| **Live Quote Calculator** | Safe math parser (`data-cf7p-calc`) with `round()`, `min()`, `max()` & hidden input sync | 0 bytes |
| **Modern UI Skins & Cards** | `.cf7p-theme-glass`, `.cf7p-theme-modern`, `.cf7p-cards` (clickable radio/checkbox cards), `.cf7p-dropzone`, `.cf7p-range` | 0 bytes |
| **Conversion Actions** | Pre-filled WhatsApp redirect (`data-cf7p-whatsapp`), URL redirect, animated Success Modal | 0 bytes |
| **Dynamic Prefill** | Server-side `{{post:title}}`, `{{acf:field}}`, `{{woo:price}}`, `{{user:email}}`, `{{query:param}}`, `default:query` | 0 bytes |
| **Local Entries & CSV** | Saves every submission under **Contact > Entrées CF7 Pro** with 1-click CSV export | `wp-admin` only |
| **JSON Webhooks** | Add `cf7p_webhook: https://...` in CF7 Additional Settings for n8n, Make, Zapier, CRM | Non-blocking server POST |
| **Admin 1-Click Toolbar** | Visual helper buttons inside the CF7 editor (`assets/js/admin.js`) | `wp-admin` only |

---

## Quick Start: Install the AI Skill (Any Harness)

### Option 1: Universal CLI (`npx skills`)
Works with **Antigravity, Claude Code, Codex, OpenCode, Cursor, Windsurf**:
```bash
npx skills add urbainmorel/cf7-pro-suite
```

### Option 2: Automated Multi-Harness Installer

**Windows (PowerShell):**
```powershell
git clone https://github.com/urbainmorel/cf7-pro-suite.git
cd cf7-pro-suite
.\install.ps1
```

**macOS / Linux:**
```bash
git clone https://github.com/urbainmorel/cf7-pro-suite.git
cd cf7-pro-suite
chmod +x install.sh && ./install.sh
```

---

## Install the WordPress Plugin

1. Make sure **Contact Form 7** is installed and active on your WordPress site.
2. Download `cf7-pro-suite.zip` from [GitHub Releases](https://github.com/urbainmorel/cf7-pro-suite/releases).
3. In WordPress Admin, go to **Plugins > Add New > Upload Plugin**, upload `cf7-pro-suite.zip`, and click **Activate**.

---

## Quick Example: Multi-Step Quote Form

```html
<div class="cf7p-theme-glass">
  <div data-cf7p-step="Besoin">
    <div class="cf7p-cards">
      [radio service use_label_element default:1 "Site Vitrine (+1200€)" "E-commerce (+2800€)"]
    </div>
    <div data-cf7p-show-if="service*=E-commerce">
      [number nb_produits min:1 max:5000 "50"]
    </div>
  </div>

  <div data-cf7p-step="Devis &amp; Envoi">
    <div class="cf7p-calc-box">
      <span>Estimation :</span>
      <strong data-cf7p-calc="service + (nb_produits * 5)" data-cf7p-suffix=" €" data-cf7p-target-input="total_estime">0 €</strong>
    </div>
    [hidden total_estime]
    <label>Nom [text* nom]</label>
    <label>Email [email* email]</label>
    [submit class:cf7p-btn "Envoyer"]
  </div>
</div>
```

---

## Validate Locally

```bash
npm run validate
```

---

## Dual License (`GPL-2.0-or-later` AND `MIT`)

- **WordPress Plugin (`wordpress-plugin/`)**: Licensed under **GPL-2.0-or-later** (`LICENSE-GPL-2.0.txt`).
- **AI Skill, Schemas, Installers & Validator (`skills/`, `install.*`, `plugin.json`)**: Dual-licensed under **MIT** (`LICENSE-MIT.txt`) and **GPL-2.0-or-later**.
