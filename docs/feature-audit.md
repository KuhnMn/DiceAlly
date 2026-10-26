# Feature-Audit DiceAlly

Stand: 26. Oktober 2026. Grundlage ist der aktuelle Quellcode einschließlich der veröffentlichten Compendium-Ladeoptimierung. Dies ist ein Funktions- und Daten-Audit, kein neuer Lauf von UI- oder Regressionstests. Ältere Roadmaps wurden gegen den Code abgeglichen; sie enthalten inzwischen bereits umgesetzte Vorschläge.

## Produktumfang

DiceAlly ist ein Charakter-Editor, ein spielbarer Charakterbogen und eine durchsuchbare lokale Regelbibliothek mit Account-Synchronisation. Sinnvolle Erweiterungen unterstützen die Vorbereitung und das Spielen des eigenen Charakters. Ein Virtual Tabletop, eine vollständige Regelautomatisierung oder eine allgemeine Kampagnenverwaltung wären deutlich größere Produktentscheidungen.

Vorhandene Daten bedeuten nicht automatisch vorhandene Regeln: Ein Damage-Tag beschreibt beispielsweise eine Schadensart, aber keine vollständige, situationsabhängige Schadensberechnung. Fehlende Werte sollten als unbekannt erscheinen. Insbesondere bei XPHB/XDMG/XMM, EFA, MPMM sowie ergänzend TCE/XGE müssen Ausgabe, Quellenidentität und optionale Felder erhalten bleiben.

## Vorhandene Funktionen und passende Weiterentwicklung

| Bereich | Im aktuellen Code vorhanden | Passende Erweiterung |
| --- | --- | --- |
| Charakterbibliothek | Lokale Charaktere, Erstellen, Öffnen, Bearbeiten, Löschen, Export, JSON-/Code-Import; kompakte mobile Liste | Suche und Sortierung; später bewusstes Duplizieren mit neuer Identität und einer Auswahl, ob Spielzustand mitkopiert wird |
| Editor | Stammdaten, Attribute, Fertigkeiten/Rettungswürfe, weitere Proficiencies und Quellen, Spezies/Background/Klassen, Features, Spells/Slots, Ausrüstung, Companions, Actions, Bastions, Notizen und sichtbare Viewer-Seiten | Unverbindliche Einrichtungshinweise und direkte Sprünge zu offenen Feldern; Entwürfe weiterhin speicherbar |
| Klassen und Level | Optionaler Class Wizard, Klassen-/Subclass-Auswahl, Vorschauen, unterstützte Feature-/Spell-/Proficiency-Auswahlen und Ressourcen; manuelle Werte bleiben möglich | Änderungen vor dem Anwenden stärker als „Neu / Geändert / Entfällt“ darstellen; offene Entscheidungen gezielt auffindbar machen |
| Viewer | Eigene Seiten für Sheet, Combat, Features, Spells, Inventory, Companions, Bastions und Notes; responsive Ansichten, Swipe-Navigation, wählbare Spalten und ausgeblendete Seiten | Bestehende Seiten durch kleine Favoriten-/Schnellzugriffe verbessern; kein zusätzlicher vollständiger Dashboard-Screen nötig |
| Combat | Grundaktionen, verlinkte und eigene Aktionen, Gruppierung nach Aktionstyp, Details, explizite Navigation, Aktualisierungsvorschau im Editor und Rundenzähler | Filter „Begrenzt nutzbar / Noch verfügbar“ und explizite Verknüpfung einer Aktion mit einem vorhandenen Uses-Pool |
| Zauber | Suche/Filter, Listen und Prepared-Zustand, Details, Casting Sources, Uses und Slot-Pools; Cast-Button mit Zaubergrad und Slotverbrauch; Cantrips ohne Verbrauch | Bestehenden Cast-Dialog um unterstützte freie Nutzungen oder explizit gebundene Ressourcen erweitern; Materialkosten und Konzentration sichtbarer machen |
| HP, Conditions und Erholung | HP-/Temp-HP-Zustand, Maximalwert-Overrides, Death Saves, Hit Dice, Conditions mit Beschreibungsreferenzen, manuelle Konzentration mit Schadenserinnerung; Short-/Long-Rest-Vorschau und Bericht | Exhaustion mit manuell gesetztem Level; einfacher Schaden-/Heilungsablauf; kurzfristiges Rückgängigmachen ausgewählter eigener Änderungen |
| Features und Uses | Typ-/Quell-/Level-bezogene Filter, Detailtexte, Uses mit Erholungsbedingungen, Notizen und Combat-Bezüge | Herkunft der Instanz und gemeinsam verwendete Ressourcen deutlicher zeigen; verbleibende Uses als optionaler Filter |
| Inventory | Katalog und eigene Items, Mengen, Equipped-/Attuned-Zustand, Münzen, Notizen/Uses, Eigenschaften und Masteries; angehängte Zauber werden bereits aufgelöst | Gewichts- und Wertübersicht, fehlende Werte kennzeichnen; „Eines verbrauchen“ und explizite Geldänderungen; Item-Zauber später an bestätigte Ladungskosten binden |
| Companions und Objekte | Hinzufügen aus Content, Statblocks, Suche/Filter, optionale eigene HP/Temp HP, Overrides, Notes/Uses | Häufige Aktionen beim Companion anheften; manuelle Damage-/Heal-Bedienung; Zustände und Recharge-Erinnerungen als eigene Instanzdaten |
| Bastions | Facility-Instanzen, Beschreibungen, Level/Typ/Quelle/Voraussetzungen, optionale Notes und externer Plan-Link; verwandte Tabellen/Charms im Compendium | Strukturierte Übersicht zu Orders, Platz und Hirelings; anschließend kleine, manuell gesteuerte Bastion-Turn-Liste |
| Notes | Gruppierte Notizen, Bearbeiten, Vorschau und Schutz unfertiger Entwürfe | Suche in Titel und Text; anschließend Anheften und Querverweise zu vorhandenen Inhalten |
| Compendium | Kategorien, Suche, Mehrfachfilter, globale Quellen-Vorgaben und lokale Anpassungen, Detail-/Related-Ansichten; eigener Klassen-/Subclass-Screen mit Level-Features, Ressourcen, Slots, Spell Lists, allgemeinen Infos/Proficiencies und Multiclass-Infos | Favoriten, zuletzt angesehen, einfache Vergleiche und lesende Herkunfts-/Editionshinweise; keine zweite Charakter-Erstellungslogik |
| Content und Speicherung | Schema-basierter Import, Kopien/Materialisierung/Verknüpfungen, Homebrew, Diagnose/Warnungen, versionierte lokale Bibliotheken, Definition-Snapshots und Aktualisierungsvorschauen | Diagnosen nach Nutzerrelevanz gruppieren; Änderungen an konkreten Charakter-Inhalten erklären; vorhandene Vorschauen gezielter zugänglich machen |
| Account und Auslieferung | Zugriffskontrolle, Account-Sync mit expliziter Konfliktbehandlung, Teilen von Kopien, Lazy Loading mit Retry und Erhalt älterer Release-Assets | Verständliche Hinweise zur lokalen Verfügbarkeit und zu ausstehenden Änderungen; optional kleinere Offline-Pakete für ausgewählte Content-Bereiche |

„Lokal nutzbar“ ist keine Zusicherung, dass jede Route nach einem erstmaligen Start ohne Netz verfügbar ist: Authentifizierung, noch nicht geladene JS-Module und externe Bild-URLs sind getrennte Abhängigkeiten.

## Priorisierte Erweiterungen mit vorhandenen Daten

Umgesetzt am 26. Oktober 2026: Punkte **1, 5, 6 und 9** in folgendem Umfang:

- **1 – Cast mit Uses:** Der Cast-Dialog bietet neben Slots alle gültigen Uses des konkreten Zaubers an, auch bei Cantrips. Eine bestätigte Anwendung verbraucht genau eine ausgewählte Nutzung; freie Nutzungen bleiben auf dem Basisgrad. Item-Ladungen oder gemeinsame Ressourcen werden nicht automatisch zugeordnet.
- **5 – Bastions:** Orders, Space und Hirelings erscheinen als strukturierte Angaben. Alternative Raumgrößen und davon abhängige Personalangaben bleiben Alternativen; fehlende Werte werden als nicht angegeben markiert. Editor und Viewer teilen Typ-/Level-/Order-Filter, das Compendium hat ebenfalls einen Orders-Filter. Tags und Detaildialoge folgen den vorhandenen responsiven Komponenten.
- **6 – Konzentration:** Auch Cantrips bieten das Setzen des Konzentrationstrackers an. Bei aktiviertem Tracking erfordert eine bestehende Konzentration vor dem Verbrauch eine Bestätigung; Abbrechen verbraucht weder Slot noch Uses. Bei ausgeschaltetem Tracking erscheint keine Konzentrationsabfrage und der Tracker bleibt unverändert.
- **9 – Komponenten und Upcasting:** Komponenten-Badges, Materialbeschreibung, explizite Kosten und Verbrauch sind getrennt lesbar. Der gewählte Slotgrad hebt den unveränderten Higher-Level-Text hervor. Es werden keine Schadensmittelwerte oder aus Prosa geratenen Formeln berechnet. Ritual-Zauber bieten die Ressource „Ritual - Free“ am Basisgrad ohne Slot- oder Uses-Verbrauch; Vorbereitungs- und Konzentrationsabfragen bleiben erhalten.

Die Aufwände sind relative Größen, keine Zusage in Tagen. „Klein“ bedeutet überwiegend abgeleitete Darstellung; „Mittel“ umfasst zusätzliche Interaktionen oder neue gespeicherte Felder. Neue gespeicherte Zustände müssen lokale Speicherung, Export/Import, Synchronisation und ältere Charaktere berücksichtigen.

| Priorität | Vorschlag | Bereits vorhandene Grundlage | Neues Verhalten / Grenze | Aufwand |
| --- | --- | --- | --- | --- |
| 1 | Cast um freie Nutzungen erweitern | Spell-Uses, Recovery, innere Spell Grants, Slot-Pools; native Regeln kennen bestimmte Ressourcenbindungen und Kosten | Nutzer wählt ausdrücklich Slot oder unterstützte freie Nutzung. Keine doppelte Abbuchung, keine automatische Ressourcenwahl. Item-Ladungen als eigener späterer Schritt. Cantrip-Verhalten erhalten. | Mittel |
| 2 | Combat-Ressourcen sichtbar verbinden | Verlinkte Aktionen, stabile Instanz-IDs, Uses und Pools | Verbleibende Nutzungen direkt zeigen und gezielt abbuchen. Zuordnung bestätigen; Kosten niemals aus beliebigem Beschreibungstext erraten. Neue Links brauchen stabile Identitäten. | Mittel |
| 3 | Kleine Inventory-Zusammenfassung | Mengen sowie optionale Gewichts-/Wertfelder, Equipped und Attuned | Gewicht bekannter Items aufsummieren und unvollständige Angaben ausweisen; Stapelwerte nur mit geklärter Einheit. Keine automatische Encumbrance-Regel oder Währungsumrechnung. | Klein–Mittel |
| 4 | Notes- und Bibliothekssuche | Vorhandene Namen, Titel, Text und Änderungszeiten | Lokale Such-/Sortieransicht, die einen offenen Entwurf nicht verändert. Keine neuen Spielregeln oder Content-Abhängigkeiten. | Klein |
| 5 | Bastion-Informationen strukturieren | Facility-Schema enthält optionale `orders`, `space` und `hirelings` neben Level/Typ/Voraussetzungen | Kompakte Felder und zusätzliche Orders-Filter; unbekannte oder alternative Angaben lesbar erhalten. Ein Schema-Order liefert noch keinen automatischen Produktionsablauf. | Klein–Mittel |
| 6 | Konzentration beim Zaubern anbieten | Concentration-Metadaten und bestehender manueller Tracker | Nach bestätigtem Cast optional „Konzentration darauf setzen“; bestehende Konzentration ausdrücklich ersetzen lassen. Kein automatischer Abbruch bei einem bloßen Detailaufruf. | Klein–Mittel |
| 7 | Verbrauchsgegenstand benutzen | Item-Menge und frei bearbeitbare Uses | „Eines verbrauchen“ vermindert genau eine Menge; Heilung/Schaden bleiben eigenständige Entscheidungen. Keine Wirkung aus Prosa ableiten. | Klein–Mittel |
| 8 | Herkunft von Werten und Einträgen erklären | ContentReferences, Klassen-/Grant-Owners, Definition-Snapshots, Origins und manuelle Overrides | Zunächst wenige häufige Werte/Einträge erklären: Herkunft, manueller Anteil, Override. Für ältere Importe fehlende Herkunft offen kennzeichnen. | Mittel |
| 9 | Komponenten und Upcasting besser präsentieren | Material-/Kosten-/Consume-Felder, Dauer, Ritual-/Concentration-Metadaten und Higher-Level-Einträge | Kompakte Hinweise und Hervorhebung des Higher-Level-Texts beim gewählten Grad. Formeln nur dann auswerten, wenn eine unterstützte eindeutige Struktur vorliegt. Ritual-Regeln editionsbezogen darstellen. | Klein–Mittel |
| 10 | Einrichtungs- und Level-Vorschau verbessern | Wizard-Auswahlen, Warnungen, Vorher/Nachher-Zustände und bestehende Preview-Pfade | Offene Entscheidungen verlinken und fehlende Essentials unverbindlich nennen. Keine allgemeine Behauptung, ein Charakter sei regelkonform. | Mittel |

## Neue Funktionen, die zum Umfang passen

Diese Funktionen brauchen zusätzliches UI oder eigenen Zustand; die Content-Daten allein liefern sie nicht.

1. **Favoriten im Compendium und im Charakterbogen.** Wenige angeheftete Spells, Features oder Regeln reduzieren Suchwege. Bibliotheksfavoriten und Charakterfavoriten getrennt halten; Identität an Quelle und Content-Key binden. Aufwand: mittel.
2. **Kleiner Bastion-Turn-Tracker.** Pro Facility eine ausgewählte erlaubte Order, manuell gesetzter Status, Notiz und expliziter Abschluss. Ein Turn wird vom Nutzer weitergeschaltet. Keine Wirtschaftssimulation oder automatische Erzeugung von Items/Gold. Aufwand: mittel.
3. **Persönlicher Ressourcenbereich.** Bereits konfigurierte Slots und Uses an einer Stelle sehen, nach Erholung gruppiert. Erst rein abgeleitet; später optional Pins. Kein zusätzlicher Ressourcentyp nötig, wenn vorhandene Pools reichen. Aufwand: mittel.
4. **Charakter duplizieren.** Neue ID und bewusste Auswahl „aktuellen Spielzustand übernehmen“ oder „bestimmte Werte zurücksetzen“. Nicht ungefragt einen Long Rest ausführen und dadurch unterschiedliche Recovery-Regeln vermischen. Aufwand: mittel.
5. **Kleine persönliche Effektliste.** Name, Quelle, freiwillig gesetzte Dauer/Runden und Konzentrationsbezug. Rundenzähler kann auf Wunsch Erinnerungen liefern; Ende und Änderungen bleiben bestätigt. Kein Encounter Manager. Aufwand: mittel.
6. **Eng begrenztes Undo im Spiel.** Beispielsweise den letzten Slot-Verbrauch oder eine HP-Änderung rückgängig machen. Nur bei unverändertem Folgezustand; keine komplette Charakterkopie über zwischenzeitliche oder synchronisierte Änderungen schreiben. Aufwand: mittel bis groß.
7. **Einfacher Würfelhelfer.** D20-Checks oder explizite Würfelausdrücke aus Aktionen/Einträgen auf Wunsch würfeln, mit nachvollziehbaren Modifikatoren. Ergebnis ist eine Anzeige, keine automatische Treffer-/Schadensentscheidung. Aufwand: mittel.
8. **Vergleich zweier Compendium-Einträge.** Insbesondere Spells, Feats und Klassen/Subclasses. Mobile eher Feld-für-Feld oder umschaltbar statt zwei schmaler Volltexte. Unterschiedliche Editionen kennzeichnen; keine automatische Austausch-Empfehlung. Aufwand: mittel.

## Empfohlene Reihenfolge

- **Kleine erste Lieferung:** Notes-/Bibliothekssuche und Inventory-Zusammenfassung. Sichtbarer Nutzen ohne große Regel- oder Datenmigration.
- **Danach eine Spielhandlung vollständig verbessern:** Cast mit freien Nutzungen und optionalem Konzentrationswechsel. Vorhandenen Cast- und Tracker-Pfad erweitern.
- **Dann Combat-Ressourcen:** Eindeutige Zuordnung, sichtbare Kosten und genau ein bestätigter Verbrauch.
- **Danach Bastions:** Zuerst strukturierte Daten; einen Turn-Tracker erst nach Erprobung dieser Übersicht.
- Favoriten sind eine gute unabhängige Erweiterung, sobald Suche und vorhandene Details zufriedenstellend sind.

Nicht gleichzeitig neue Workflows für Casting, Combat, Inventory und Bastions einführen: Bei Ressourcen und Synchronisation ist jede Aktion einzeln zu prüfen.

## Bewusst außerhalb dieses Vorschlags

- Vollständige Regelauswertung beliebiger Feature-/Spell-Texte und automatische Treffer-/Schadensauflösung.
- Automatisch angewandte Conditions, beliebige Bonus-Stacking-Regeln oder vollständige Charakter-Legalitätsprüfung.
- Battlemap, Initiative-/Encounter-Verwaltung für eine ganze Gruppe, DM-Werkzeuge oder Kampagnen-Wiki.
- Allgemeiner Crafting-/Handels-/Bastion-Wirtschaftssimulator.
- Großer Ersatz des bestehenden Editors oder ein zweites Charakterdatenformat.

## Code-Anker

- [Editor-Struktur](../src/app/editor/README.md), [Dokumentmodell](../src/app/rules/character-document.ts), [Wizard-Vorschau](../src/app/editor/class-wizard-preview.ts).
- [Aktueller Cast-Dialog](../src/app/sheet/spell-cast-control.component.ts), [Ressourcen- und Action-Regeln](../src/app/rules/resource-action-rules.ts), [Konzentration](../src/app/services/concentration.service.ts).
- [Item-Zauber sind bereits implementiert](../src/app/editor/item-attached-spells.ts), [Inventory](../src/app/sheet/equipment-page.component.ts), [Notizen](../src/app/sheet/notes-page.component.ts).
- [Compendium-Kategorien und Filter](../src/app/compendium/compendium-catalog.ts), [Klassen-Ressourcen](../src/app/compendium/class-resources.ts), [Bastion-Zustand](../src/app/models/bastion.ts).
- [Vollständige generierte Quelltypen](../src/app/content/generated/site-source.d.ts), [Erholungsregeln](../src/app/rules/session-rules.ts), [Sync-Konflikte](../src/app/characters/sync/character-sync-engine.ts).
