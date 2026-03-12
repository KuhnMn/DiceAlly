import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-impressum',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="legal-page" aria-labelledby="impressum-title">
      <h1 id="impressum-title">Impressum</h1>
      <p>Angaben gemaess Paragraph 5 DDG</p>

      <section class="legal-card" aria-label="Verantwortliche Person">
        <h2>Verantwortlich fuer den Inhalt</h2>
        <p>Max Mustermann</p>
        <p>Adresse</p>
        <p>PLZ Ort</p>
        <p>E-Mail: @example.de</p>
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
export class ImpressumComponent {}
