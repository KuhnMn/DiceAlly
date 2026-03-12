import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-datenschutz',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="legal-page" aria-labelledby="datenschutz-title">
      <h1 id="datenschutz-title">Datenschutzhinweise</h1>

      <section class="legal-card" aria-label="Lokale Speicherung">
        <h2>1. Lokale Speicherung im Browser</h2>
        <p>
          AllySheetViewer speichert Charakterdaten lokal im Browser (Local Storage),
          damit deine Daten auf deinem Geraet verfuegbar bleiben.
        </p>
      </section>

      <section class="legal-card" aria-label="Teilen und Importieren">
        <h2>2. Teilen und Importieren per Link</h2>
        <p>
          Wenn du die Teilen-Funktion verwendest, werden die von dir ausgewaehlten Daten
          an tmpfiles.org hochgeladen und beim Import ueber den konfigurierten Cloudflare Worker geladen.
          Dabei koennen technisch notwendige Verbindungsdaten (z. B. IP-Adresse, Zeitstempel) verarbeitet werden.
        </p>
      </section>

      <section class="legal-card" aria-label="Hosting und Logs">
        <h2>3. Hosting und technische Protokolle</h2>
        <p>
          Die Website wird ueber GitHub Pages ausgeliefert. Bei der Auslieferung koennen
          serverseitige Zugriffsdaten in technischen Logs verarbeitet werden.
        </p>
      </section>

      <section class="legal-card" aria-label="Kontakt">
        <h2>4. Kontakt</h2>
        <p>Bei Fragen zum Datenschutz: @example.de</p>
      </section>

      <p><a routerLink="/">Zurueck zur Startseite</a></p>
    </main>
  `,
  styles: `
    .legal-page {
      max-width: 900px;
      margin: 2rem auto;
      padding: 1rem;
    }

    .legal-page h1 {
      font-size: 1.8rem;
      margin: 0 0 1rem;
    }

    .legal-card {
      background: var(--md-sys-color-surface-container-low);
      border: 1px solid var(--md-sys-color-outline-variant);
      border-radius: 0.75rem;
      padding: 1rem;
      margin: 0 0 1rem;
    }

    .legal-card h2 {
      font-size: 1.1rem;
      margin: 0 0 0.6rem;
    }
  `,
})
export class DatenschutzComponent {}
