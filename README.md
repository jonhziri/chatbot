# JonFit Chatbot MVP

Deutschsprachiges Chatbot-System fuer ein Fitnessstudio mit:

- Website-Chatbot
- Admin-Dashboard
- zentralem Wissensprompt und Trainingsdaten
- Lead-Erfassung
- Chatverlaeufen
- Wix-Embed-Snippet

## Funktionen

### Website-Chatbot

- beantwortet Fragen zu Mitgliedschaften, Probetraining, Kursen, Oeffnungszeiten und Kontakt
- priorisiert Antworten aus Trainingsdaten
- nutzt danach Regeln, Wissensprompt und OpenAI
- kann anschliessend optional OpenAI zur Formulierung nutzen
- verweist bei Unsicherheit auf das Studio-Team statt Aussagen zu erfinden
- sammelt Leads ueber Name, E-Mail, Telefon und Notizen

### Admin-Bereich

- Chatverlaeufe einsehen
- Bot-Texte anpassen
- haeufige Fragen auswerten
- Leads verwalten und Status pflegen

## Stack

- Node.js
- Express
- Vanilla HTML, CSS und JavaScript
- Supabase als produktive Persistenz
- JSON-Dateien als lokaler Fallback, wenn keine Supabase-ENV gesetzt ist

## Projektstruktur

```text
.
├── data/
├── public/
│   ├── admin/
│   ├── app.js
│   ├── embed.js
│   ├── index.html
│   └── styles.css
├── src/
│   ├── knowledge.js
│   ├── supabaseClient.js
│   └── storage.js
├── supabase-schema.sql
├── package.json
├── README.md
└── server.js
```

## Starten

### Voraussetzungen

- Node.js 18 oder neuer

### Installation

```bash
npm install
npm start
```

Danach ist die App hier erreichbar:

- Website-Chatbot: `http://localhost:3000/`
- Admin-Bereich: `http://localhost:3000/admin/`

## Supabase einrichten

Fuer Vercel/Production solltest du Supabase nutzen. Ohne Supabase fallen die Daten lokal auf JSON-Dateien zurueck.

### 1. Tabellen erstellen

1. Oeffne dein Supabase-Projekt.
2. Gehe zu `SQL Editor`.
3. Kopiere den Inhalt aus `supabase-schema.sql`.
4. Fuehre das SQL aus.

Dadurch werden diese Tabellen erstellt:

- `bot_config`
- `chats`
- `leads`
- `training_entries`

### 2. ENV-Variablen setzen

Lokal in `.env`:

```bash
SUPABASE_URL="https://dein-projekt.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="dein-service-role-key"
```

Auf Vercel:

1. Projekt oeffnen
2. `Settings` -> `Environment Variables`
3. `SUPABASE_URL` setzen
4. `SUPABASE_SERVICE_ROLE_KEY` setzen
5. Danach neu deployen

Wichtig:

- `SUPABASE_SERVICE_ROLE_KEY` ist geheim.
- Der Key darf nie im Frontend, Browser, Wix-Code oder GitHub auftauchen.
- Er wird nur serverseitig in Node.js verwendet.

### 3. Was Supabase ersetzt

Supabase ersetzt in Production die lokalen Dateien:

- `data/chats.json` -> Tabelle `chats`
- `data/leads.json` -> Tabelle `leads`
- `data/training.json` -> Tabelle `training_entries`
- `data/config.json` -> Tabelle `bot_config`

Die Funktionsnamen in `src/storage.js` bleiben gleich. Das Projekt nutzt automatisch Supabase, sobald `SUPABASE_URL` und `SUPABASE_SERVICE_ROLE_KEY` vorhanden sind.

### 4. Bestehende lokale Daten migrieren

Wenn du deine aktuellen JSON-Daten in Supabase uebernehmen moechtest:

```bash
npm run migrate:supabase
```

Das Skript uebertraegt:

- Bot-Konfiguration
- Chatverlaeufe
- Leads
- Trainingseintraege

Hinweis: Das Skript ersetzt die Daten in den Supabase-Tabellen mit dem aktuellen lokalen Stand aus `data/`.

## OpenAI-Fallback aktivieren

Standardmaessig arbeitet das System zuerst mit Trainingsdaten und Regeln. Wenn danach noch keine passende Antwort vorliegt, kann optional OpenAI genutzt werden.

Dazu serverseitig eine `.env` anlegen:

```bash
cp .env.example .env
npm install
```

Dann die `.env` befuellen:

```bash
OPENAI_API_KEY="sk-proj-dein-serverseitiger-key"
OPENAI_MODEL="gpt-4.1-mini"
```

Und den Server starten:

```bash
npm start
```

Wichtig:

- `OPENAI_API_KEY` wird nur serverseitig verwendet.
- Der Key darf nie im Frontend, Browser oder Embed-Code auftauchen.
- Ohne Key bleiben Inbox, Wissensprompt, Quellen und manuelles Training im Admin nutzbar.
- Ohne Key entfallen nur die generischen OpenAI-Antworten als letzte Stufe.
- Der Key bleibt lokal auf dem Server oder in deiner Deployment-Umgebung und wird nicht veroeffentlicht.

## Wissenslogik

Reihenfolge der Antwortfindung:

1. Manuell trainierte Antworten
2. Regelbasierte Antworten fuer typische Fitnessstudio-Themen
3. OpenAI-Formulierung ueber die serverseitige Responses API mit Wissensprompt, Trainingsdaten und Quellen
4. Sichere Eskalation an Mitarbeiter bei Unsicherheit

## Training im Admin

Im Adminbereich gibt es den separaten Tab `Training`.

Dort kannst du:

- einen zentralen Wissensprompt pflegen
- externe Webseiten-Links als Wissensquellen hinterlegen
- Quellen fuer spaetere Synchronisierung vorbereiten
- Trainingseintraege durchsuchen
- nach Kategorie oder Keywords filtern
- neue Trainingseintraege manuell anlegen
- bestehende Eintraege bearbeiten
- Eintraege loeschen

Direkt aus Chatverlaeufen trainieren:

1. In der Inbox eine Bot-Nachricht rechtsklicken
2. `Trainieren` waehlen
3. Frage, bisherige Antwort, verbesserte Antwort, Kategorie und Keywords pruefen
4. Speichern

Die historische Chat-Antwort bleibt unveraendert. Der neue Trainingseintrag wird aber bei aehnlichen kuenftigen Fragen bevorzugt.

Zusatzlich ist der Bereich fuer spaetere Webquellen vorbereitet:

- Links werden validiert und strukturiert gespeichert
- je Quelle gibt es einen Status wie `not_synced` oder `pending`
- ein Platzhalter fuer spaeteres Crawling und Parsing ist bereits vorhanden

## Wix-Einbindung

### Variante 1: Custom Code in Wix

Server deployen und danach dieses Snippet in Wix einbinden:

```html
<script
  src="https://DEINE-DOMAIN.DE/embed.js"
  data-base-url="https://DEINE-DOMAIN.DE"
  defer
></script>
```

### Variante 2: Iframe-Einbindung

Wenn du lieber direkt einbettet:

```html
<iframe
  src="https://DEINE-DOMAIN.DE/"
  title="JonFit Chatbot"
  style="width:100%;max-width:420px;height:760px;border:none;border-radius:24px;"
></iframe>
```

## Wichtige MVP-Hinweise

- Lokal koennen Daten in JSON-Dateien gespeichert werden.
- Auf Vercel sollten Daten ueber Supabase gespeichert werden, weil Serverless-Dateisysteme nicht dauerhaft fuer App-Daten geeignet sind.
- Es gibt in diesem MVP noch keine Authentifizierung fuer den Admin-Bereich.
- Fuer produktiven Einsatz sollten Datenbank, Login, Rollen, Rate Limiting und DSGVO-Prozesse ergaenzt werden.

## Sinnvolle naechste Schritte

- Admin-Login mit Rollen
- Datenbank statt JSON
- CRM- oder E-Mail-Anbindung fuer Leads
- Live-Handover an Mitarbeiter
- Webhooks fuer Wix-Formulare oder Studio-Software
