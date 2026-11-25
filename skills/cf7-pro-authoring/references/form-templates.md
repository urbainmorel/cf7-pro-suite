# CF7 Pro Suite — Validated Form Templates

## 1. Interactive Service Booking & WhatsApp Lead Form

```html
<div class="cf7p-theme-modern">
  <p>Choisissez votre prestation</p>
  <div class="cf7p-cards">
    [radio prestation use_label_element default:1 "Audit SEO (+350€)" "Refonte Complète (+1800€)" "Maintenance Mensuelle (+190€)"]
  </div>

  <div data-cf7p-show-if="prestation*=Refonte">
    <label>URL de votre site actuel [url* site_actuel placeholder "https://monsite.com"]</label>
  </div>

  <label>Date souhaitée [date* date_rdv]</label>
  <label>Nom complet [text* nom placeholder "Votre nom"]</label>
  <label>Téléphone WhatsApp [tel* telephone placeholder "+33 6 00 00 00 00"]</label>
  <label>Email [email* email placeholder "vous@entreprise.com"]</label>

  [hidden page_source "{{post:title}} ({{post:url}})"]
  [hidden utm_source "{{query:utm_source|Direct}}"]

  <div class="cf7p-calc-box">
    <span>Tarif indicatif :</span>
    <strong data-cf7p-calc="prestation" data-cf7p-suffix=" €" data-cf7p-target-input="tarif_estime">0 €</strong>
  </div>
  [hidden tarif_estime]

  [submit class:cf7p-btn "Confirmer la réservation"]

  <div data-cf7p-whatsapp="33600000000" data-cf7p-whatsapp-template="Bonjour, je suis {nom}. Je souhaite réserver : {prestation} pour le {date_rdv}. Tarif : {tarif_estime}."></div>
</div>
```

## 2. Multi-Step B2B Loan / Real Estate Qualifier

```html
<div class="cf7p-theme-glass">
  <div data-cf7p-step="Profil">
    <p>Vous êtes</p>
    <div class="cf7p-cards">
      [radio statut use_label_element default:1 "Particulier" "Entreprise"]
    </div>

    <div data-cf7p-show-if="statut=Entreprise">
      <label>Raison sociale [text* societe placeholder "Acme SAS"]</label>
      <label>Numéro SIRET [text* siret placeholder "123 456 789 00012"]</label>
    </div>
  </div>

  <div data-cf7p-step="Montant &amp; Durée">
    <p>Montant souhaité</p>
    <div class="cf7p-range" data-cf7p-suffix=" €">
      [range montant min:5000 max:250000 step:5000 "50000"]
    </div>

    <p>Durée (mois)</p>
    <div class="cf7p-range" data-cf7p-suffix=" mois">
      [range duree min:12 max:84 step:6 "36"]
    </div>

    <div class="cf7p-calc-box">
      <span>Mensualité estimée :</span>
      <strong data-cf7p-calc="round(montant / duree)" data-cf7p-suffix=" €/mois" data-cf7p-target-input="mensualite">0 €/mois</strong>
    </div>
    [hidden mensualite]
  </div>

  <div data-cf7p-step="Justificatifs &amp; Envoi">
    <label>Email professionnel [email* email]</label>
    <div class="cf7p-dropzone">
      [file piece_identite limit:5mb filetypes:pdf|png|jpg]
    </div>
    [submit class:cf7p-btn "Envoyer mon dossier"]
  </div>
</div>
```

## 3. Smart Contract & Appointment Form (Smart Phone + Date/Time Slots + Star Rating + Digital Signature + Repeater)

```html
<div class="cf7p-theme-glass">
  <div data-cf7p-step="Rendez-vous &amp; Contact">
    <label>Nom complet [text* nom placeholder "Morel Urbain"]</label>

    <p>Téléphone WhatsApp (Indicatif auto-détecté)</p>
    <div class="cf7p-smart-phone">
      [tel* telephone placeholder "6 12 34 56 78"]
    </div>

    <p>Date &amp; Créneau souhaités (Fermé le dimanche)</p>
    <div class="cf7p-smart-date" data-cf7p-disable-days="0" data-cf7p-slots="09:00,11:00,14:30,16:30" data-cf7p-slot-target="heure_rdv">
      [date* date_rdv]
      [hidden heure_rdv]
    </div>
  </div>

  <div data-cf7p-step="Participants &amp; Avis">
    <p>Participants supplémentaires</p>
    <div data-cf7p-repeater="+ Ajouter un participant" data-cf7p-target-input="participants">
      <div class="cf7p-repeater-row">
        <input type="text" placeholder="Nom du participant" />
        <input type="text" placeholder="Fonction" />
      </div>
    </div>
    [hidden participants]

    <p>Note de satisfaction</p>
    <div class="cf7p-rating" data-cf7p-max="5">
      [hidden note_client]
    </div>

    <div data-cf7p-show-if="note_client<=3">
      <div data-cf7p-maxlength="250">
        <label>Comment améliorer notre service ? [textarea amelioration]</label>
      </div>
    </div>
  </div>

  <div data-cf7p-step="Signature &amp; Validation">
    <p>Signature électronique du demandeur</p>
    <div class="cf7p-signature">
      [hidden signature_client]
    </div>

    <div class="cf7p-toggle">
      [checkbox accord_rgpd use_label_element "J'accepte les conditions de traitement"]
    </div>

    [submit class:cf7p-btn "Signer et Confirmer"]
  </div>
</div>
```
