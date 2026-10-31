# Feature- und Datenaudit – 31. Oktober 2026

Untersuchter Anwendungsstand: `2e41712`, einschließlich rekursiver strukturierter Feature-Verweise und ihrer lesbaren Darstellung. Diese Änderungen wurden vor dem Audit veröffentlicht; Pages-Release `cac7e83`. Dieser Audit ändert keine Spielfunktionen.

## Grundlage und Aussagegrenzen

Geprüft wurden die eingecheckten Site-/Brew-Schemas, die daraus erzeugten Typen, Import/Adapter, Regelhelfer, tatsächlich angeschlossene Editor-/Viewer-Komponenten sowie vorhandene Testbeispiele. Der ältere [Audit](feature-audit.md) wurde gegen den aktuellen Code abgeglichen. Er ist keine Liste weiterhin offener Aufgaben.

Der direkte Abruf aktueller öffentlicher Beispieldaten scheiterte am Netzwerkzugriff; der alternative Git-Abruf wurde nicht abgeschlossen. Deshalb gibt es hier keine neue Vollkorpus-Auswertung, keine Aussage zur Häufigkeit einzelner Felder in der aktuellen Library und keinen Einblick in die lokal beim Nutzer installierten Homebrew-Dateien. Beispiele aus Tests sind gezielt konstruierte Fälle, keine Belege für identische offizielle Charakteroptionen. Regelbeispiele aus D&D erläutern einen möglichen Nutzen, keine bereits implementierte Berechnung.

Vier Ebenen müssen auseinandergehalten werden:

1. **Im Schema vorhanden:** Ein Feld oder Inhaltstyp ist beschreibbar.
2. **Importiert und erhalten:** Die App speichert diese Daten tatsächlich.
3. **Im UI lesbar:** Nutzer können die Information finden.
4. **Im Workflow nutzbar:** Eine Auswahl oder Spielhandlung verwendet sie nachvollziehbar.

Die größten Chancen liegen zwischen Ebene 3 und 4. Eine Schema-Eigenschaft allein rechtfertigt keine vollautomatische Regelwirkung. Prioritäre Zielquellen bleiben XPHB/XDMG/XMM, EFA und MPMM, ergänzend TCE/XGE. Datenabdeckung und Regeln unterscheiden sich nach Quelle und Edition.

## Was bereits vorhanden ist

Nicht erneut als neue Features einplanen:

- Responsive Viewer-/Editor-Seiten, Swipe-Navigation, Spaltenwahl und ausblendbare Viewer-Seiten.
- Compendium mit globaler Suche, Kategorie-Listen, Quellen-Vorgaben, lokalen Mehrfachfiltern, Detailansichten und Kategorie-Laden nach Bedarf.
- Klassenansichten mit Subklassen, Features nach Level, Spell Slots, Class Resources, erweiterten Spell Lists, Hit Die, Proficiencies und Multiclass-Informationen.
- Optionaler Creator/Wizard mit Vorschau, offenen Entscheidungen, Vorher/Nachher-Vergleich, manuellen Overrides und gezielten Sprüngen in den Editor.
- Strukturiert gewährte Klassen-/Subklassen-Features werden jetzt rekursiv übernommen. Exakte Quellenidentitäten, frühere Editionen, Kreisverweise und Dopplungen werden berücksichtigt.
- Spell-Details mit Komponenten/Kosten/Verbrauch, Ritual, Konzentration, Higher-Level-Text und Cast über Slots oder gültige Uses. Konzentrationswechsel wird bestätigt.
- Cantrip-Skalierung aus `scalingLevelDice` im Combat-Prefill; Effektangaben für Schadenstypen, Rettungswürfe, Conditions, Heilung und Flächenformen.
- Inventar mit Mengen, Equipped/Attuned, Eigenschaften/Masteries, Item-Zaubern, Ladungsangaben und Trackern für eindeutige numerische Ladungsmaxima.
- Hinweise auf aktive magische Item-Boni in Combat/Spells; bestimmte numerische Boni werden bereits in Berechnungen berücksichtigt.
- Companion-HP-Schnellaktionen, ausführliche Statblocks und mehrere Aktionstypen. Nicht als fehlende Statblock-Grundfunktion behandeln.
- Bastions mit Facility-Instanzen, Plan, optionalen Notes, Level/Typ/Quelle/Voraussetzungen, Orders/Space/Hirelings und Filtern. Tabellen/Charms sind im Compendium erreichbar.
- HP/Temp HP, Death Saves, Inspiration, Conditions, Rundenzähler, Konzentrationshinweise sowie Short-/Long-Rest-Vorschau und Ergebnisbericht.
- Lokale Charaktere, Account-Sync, Konfliktbehandlung, Teilen/Export, Homebrew-URL-Updates und getrennte Update-Checks.

## Vor neuen Features: semantische Korrektheit

### A. Gewährte Features und Auswahlmöglichkeiten unterscheiden

**Priorität: sehr hoch. Aufwand: mittel.**

Das Entry-Schema kennt `options.count`: Es gibt ausdrücklich an, wie viele aufgeführte Optionen als dauerhafte Charakter-Features gewählt werden dürfen. Die neue `featureEntryReferences`-Traversal findet aktuell jeden passenden `refClassFeature`/`refSubclassFeature` unterhalb von `entries`, ohne den Auswahlkontext zu unterscheiden.

Ein schema-konformer Container „Wähle 1“ mit zwei Feature-Verweisen würde deshalb beide gewähren. Das ist ein konkreter semantischer Grenzfall der aktuellen Implementierung; ob/wie häufig er in der gerade installierten Library vorkommt, wurde nicht vermessen.

Empfehlung:

- Unbedingte Verweise weiterhin automatisch gewähren.
- Dauerhafte Auswahlcontainer in echte Wizard-Entscheidungen umwandeln; Anzahl, Quelle und gespeicherte Antwort erhalten.
- Temporäre Optionen ohne permanente Auswahl nicht als dauerhaft erworbene Features behandeln.
- Beim erneuten Anwenden, Levelwechsel oder Update nur bestätigte Alternativen übernehmen.
- `isGainAtNextFeatureLevel` gesondert behandeln: Das Schema beschreibt eine optionale spätere Vergabe am nächsten Subklassen-Feature-Level, nicht einfach das auf dem Feature gespeicherte Level.

Belege: [Entry-Schema](../schemas/5etools/site/entry.json), [Klassen-Schema](../schemas/5etools/site/class/class.json), [Referenz-Traversal](../src/app/content/class-reference.ts), [Feature-Regeln](../src/app/rules/feature-rules.ts).

Nachtrag zum ursprünglichen Audit: Punkt A wurde anschließend umgesetzt.
Permanente Auswahlgruppen einschließlich Paketen und verschachtelten Entscheidungen
werden im Wizard angeboten; temporäre Optionen gewähren keine dauerhaften Features.
Verzögerte Features verlangen am nächsten expliziten Subklassen-Feature-Level eine
Hinzufügen-/Nicht-hinzufügen-Entscheidung. Antworten werden gespeichert und bei
geänderten Alternativen erneut geprüft. Die Befunde B und C bleiben separate
Vorschläge; dieser Fix erweitert keine allgemeinen Prerequisite-Handler.

### B. Voraussetzungen: erfüllt, nicht erfüllt oder nicht prüfbar

**Priorität: hoch. Aufwand: mittel.**

`checkPrerequisites` unterstützt bereits konkrete Teilmengen, unter anderem Level, Ability-Schwellen, bestimmte Zauber/Optional Features und Pacts. Andere schema-konforme Anforderungen liefern Handler-Diagnosen. Das ist eine sichere Grundlage, aber keine vollständige Prüfung aller Prerequisites.

Im UI sollten drei Ergebnisse sichtbar sein: **Erfüllt**, **Nicht erfüllt**, **Nicht automatisch prüfbar**. Ein nicht implementierter Handler darf dem Nutzer nicht als bewiesene Regelverletzung erscheinen. Zuerst Hinweise mit Herkunft und manuellem Entscheid anbieten; erst später ausgewählte zusätzliche Handler ergänzen.

### C. Datenlücken sichtbar machen

**Priorität: hoch. Aufwand: klein bis mittel.**

„Unbekannt“ ist bei Gewicht, Kosten, vorbereitbaren Zaubern, skalierenden Beschwörungen und Ressourcen etwas anderes als null. An der jeweiligen Funktion einen kurzen Hinweis zeigen. Fehlende Abhängigkeiten direkt mit Quelle und Update-/Import-Sprung versehen. Keine großflächige Warnungswand und keine ungeprüfte pauschale Meldung „Charakter unvollständig“.

## Kleine Verbesserungen mit vorhandenen Daten

Die Aufwände sind relative Größen, keine Tageszusagen. Auch kleine gespeicherte Einstellungen können Sync-/Export-Arbeit erfordern.

| Vorschlag | Grundlage und aktueller Stand | Sinnvolle erste Ausführung | Aufwand / Priorität |
| --- | --- | --- | --- |
| Bessere Spell-Filter | `damageInflict`, `savingThrow`, `conditionInflict`, `areaTags`, `miscTags`; Effekte werden schon dargestellt, sind aber nicht alle Compendium-Facetten | Mehrfachfilter für Schadenstyp, Save, verursachte Condition, Heilung und Temp HP. Tags beschreiben mögliche Effekte, keine garantierte Wirkung. | Klein–mittel / Hoch |
| Monster-/Companion-Suche nach Zweck | `type`, `cr`, Bewegungsdaten, `familiar`, `environment`, `summonedBySpell` | „Beast“, CR-Bereich, Fly/Swim, Familiar und Beschwörung. Erst filtern, keine pauschale Wildshape-Zulässigkeit behaupten. | Klein–mittel / Mittel |
| Inventar-Gewicht und Wert | Mengen und optionale `weight`/`value` werden bereits gespeichert/angezeigt | Kompakte Summenzeile: bekannte Masse, bekannter Basiswert, Anzahl unvollständiger Positionen. Münzgewicht und magische Container zunächst getrennt. | Klein–mittel / Hoch |
| Attunement-Übersicht | Status, Anzahl und Anforderungstext sind vorhanden | Direkter Filter und kompakte Anzeige aktiver/noch offener Attunements; individuelles Limit optional manuell setzen. Sonderregeln nicht mit einem universellen harten Limit blockieren. | Klein / Mittel |
| Notes- und Charakterbibliothekssuche | Titel, Texte, Namen, Level, Änderungszeiten | Suche und einfache Sortierung; offene Notizentwürfe erhalten. | Klein / Hoch |
| Quellen-/Editionshinweise | `edition`, `legacy`, `reprintedAs`, genaue Parent-IDs | Leichte Hinweise „2014“, „2024“, „ältere Subklasse auf neuer Klasse“, optionaler Versionsvergleich. Veröffentlichungsquelle allein ist kein vollständiges Regelprofil. | Klein–mittel / Hoch |
| Herkunft direkt erreichbar | `ContentReference`, Grants, Wizard-Baseline, manuelle Overrides | Beim Feature erklären: wodurch erhalten, ab welchem Level, welche Library-Version, was manuell geändert wurde. | Mittel / Hoch |
| Beschreibungsverweise anklickbar | Verweise haben qualifizierte Identitäten; Details werden schon in mehreren Screens verwendet | Namen öffnen im aktuellen Dialog die passende Beschreibung, mit Zurück-Verlauf. Expliziter Pfeil für einen Seitenwechsel. | Mittel / Mittel |
| Tabellen würfeln | Roll-/Tabellenstrukturen und darstellbare Tabellen existieren | Würfelaktion nur für eindeutig unterstützte Tabellen; Ergebniszeile hervorheben. Statische Referenztabellen bleiben statisch. | Klein–mittel / Mittel |
| Dawn-/Dusk-Erholung bedienen | Item-`charges`, `recharge`, `rechargeAmount` werden bereits erhalten und dargestellt | „Ladungen erholen“ mit manuell eingegebenem oder gewürfeltem Ergebnis, Vorschau und Deckel am Maximum. Dämmerung nicht mit jedem Long Rest gleichsetzen. | Mittel / Hoch |
| Konzentrationshinweis genauer | Schadenshinweis ist vorhanden; Item-Feld `bonusSavingThrowConcentration` ist im Schema beschreibbar | Passende DC und unterstützte bekannte Modifikatoren anzeigen, unter gewählter Regelversion; Spieler würfelt/bestätigt selbst. | Klein–mittel / Mittel |

## Creator und Levelaufstieg sinnvoll vervollständigen

### 1. Backgrounds als echte Charakteroptionen

**Nutzen: sehr hoch, besonders 2024. Aufwand: mittel bis groß.**

Das Background-Schema liefert `ability`, `feats`, `startingEquipment` und gegebenenfalls `additionalSpells` zusätzlich zu Proficiencies. Der Wizard übernimmt derzeit Background-Proficiencies und die Background-Identität. Dass Feats, Attribute, Ausrüstung und Zauber dabei nicht automatisch gewährt werden, ist im Test ausdrücklich festgehalten.

Ausbau in drei Lieferungen:

1. Zugewiesenes/auswählbares Background-Feat mit seinen eigenen Entscheidungen und stabiler Herkunft übernehmen.
2. Attributsverteilung explizit wählen; Grundwerte und angewandte Boni getrennt führen.
3. Strukturiertes Startausrüstungs-Paket oder Geldalternative wählen und bestätigen.

Beispielgrundlage: Der synthetische `Sage|TEST`-Test enthält Proficiencies, ein Feat, Attribute und Additional Spells; er belegt die aktuelle Trennung, keine offizielle Sage-Definition. Relevante Dateien: [Wizard-Tests](../src/app/editor/class-wizard.spec.ts), [Background-Schema](../schemas/5etools/site/backgrounds.json).

### 2. Feats, ASI und Epic Boons im Levelverlauf

**Nutzen: sehr hoch. Aufwand: groß.**

Vorhandene Felder: `featProgression`, Feat-`ability`, `category`, `repeatable`, `prerequisite`, `additionalSpells`, Proficiencies und optionale Folgeauswahlen. Der Creator hat Optional-Feature-Progressionen, aber daraus folgt noch keine vollständige Feat-/ASI-Logik.

Pro erreichten Slot eine Auswahl mit Begründung anzeigen. Kategorien und Wiederholbarkeit auswerten, Ability-Änderungen als getrennte Beiträge führen, Unterentscheidungen öffnen. Bei Levelsenkung oder Austausch Vorschau statt stiller Entfernung. Ein Feat mit Zauberwahl darf nicht nur als Textkarte landen.

### 3. Attribute nachvollziehbar erzeugen

**Nutzen: hoch. Aufwand: mittel, bei kompletter Migration größer.**

Standard Array und Point Buy sind sinnvolle optionale Einstiege. Entscheidend ist anschließend die Aufteilung in Grundwert, Spezies-/Background-/Feat-Beiträge und manuellen Override. Ein reservierter Species-Ability-Regelhelfer existiert; der aktuelle Charakterpfad verwendet bewusst manuelle Werte. Ihn lediglich einzuschalten würde bestehende bereits eingerechnete Boni potenziell verdoppeln.

### 4. Vorbereitung und bekannte Zauber unterstützen

**Nutzen: hoch. Aufwand: mittel bis groß.**

`cantripProgression`, `preparedSpellsProgression`, `preparedSpells`, `spellsKnownProgression` und feste zusätzliche Spells sind teilweise schon für Tabellen/Grants erschlossen. Im Editor sollte daraus eine nachvollziehbare Zählhilfe entstehen: „4 von 6 wählbaren Zaubern“, mit getrennten Listen für nicht zählende feste Grants und reine Expanded-List-Berechtigungen.

Zunächst Zähler/Hinweise; dann geführte Auswahl. Zahlen-/Tabellenwerte sind einfacher als Formeln. Unbekannte Formeln nicht per `eval` ausführen. Multiclassing, verschiedene Quellen und 2014/2024 müssen getrennt bleiben.

### 5. Weapon Masteries auswählen

**Nutzen: hoch für 2024. Aufwand: mittel.**

Mastery-Beschreibungen und Weapon-Metadaten sind schon vorhanden. `itemMasteries`/`itemMasteriesProgression` können darüber hinaus persönliche Berechtigungen und Anzahlen beschreiben. Der Unterschied ist: „Die Waffe hat Push“ versus „Dieser Charakter kann Push mit dieser Waffe einsetzen“. Auswahl und Erklärung ergänzen, statt eine allgemeine Weapon Proficiency als vollständige Mastery-Berechtigung zu behandeln.

### 6. Startausrüstung auswählen

**Nutzen: hoch für neue Charaktere. Aufwand: mittel.**

Klassen/Backgrounds können strukturierte Ausrüstungsalternativen liefern; Items haben `packContents`/`atomicPackContents`. Pakete zunächst als Vorschau auflösen: konkrete Items, Mengen, Geld und unaufgelöste Angaben. Beim Wiederholen nicht dieselbe Ausrüstung erneut erzeugen; persönliche Mengenänderungen nicht überschreiben.

## Spielhandlungen verbessern

### Gemeinsame Ressourcen und Kosten

**Empfehlung mit dem größten Nutzen während einer Sitzung. Aufwand: mittel bis groß.**

`consumes` kann benannte Ressourcen mit festem Betrag oder Betragsbereich beschreiben. Native Regeln kennen bereits Pools, Resource Bindings und bestimmte Spell Costs. Portable Uses hängen dagegen vielfach an einzelnen Einträgen. Zusätzlich werden Item-Spells derzeit als Snapshots mit lesbaren Usage Notes vorbereitet; das ist noch keine verlässliche Abbuchungsbeziehung.

Erster Schritt: Eine Aktion ausdrücklich mit einem vorhandenen Pool verknüpfen, verbleibende Anzahl und Kosten anzeigen und genau einmal verbrauchen. Bei variablen Kosten fragt die UI nach. Anschließend Item-Zauber an die Ladungen der konkreten Item-Instanz binden und denselben Cast-Dialog benutzen. Zwei identische Items müssen getrennte Ladungen behalten.

Mögliche D&D-Anwendungsfälle: Wild Shape, Channel Divinity, Focus Points, Sorcery Points und magische Stäbe. Die Daten dieser Ressourcen sind nicht überall gleich vollständig strukturiert; keine automatische Zuordnung allein aus Namen oder Prosa.

### Klassenressourcen aus bekannten Progressionen

Class Resource Tables sind schon sichtbar. Numerische Zeilen für eine bekannte Ressource könnten nach bestätigter Zuordnung einen Tracker vorschlagen. Beliebige Tabellenspalten dürfen nicht blind zu Pools werden: Slots, Schadenswürfel, Reichweiten, Obergrenzen und Wahlmöglichkeiten haben unterschiedliche Bedeutung.

### Verbrauch, Munition und Geld

„Eines benutzen“ vermindert genau eine Menge. Bei geeigneten Waffen kann anschließend ein bestätigter Munitions-Link angeboten werden. Ein Kauf-/Verkauf-Dialog verändert Items und Geld zusammen. Der Katalogwert ist ein Ausgangswert, kein garantierter Verkaufspreis. Prosa-Heilung, Sondermunition und Trefferentscheidungen bleiben getrennte Aktionen.

### Persönliche Effekte und Zustände

Conditions und Konzentration existieren bereits. Ergänzen ließen sich eigene Effekte mit Quelle, Dauer, Konzentrationsbezug und Erinnerungszeitpunkt. Exhaustion benötigt ein echtes Stufenfeld und eine zur Regelversion passende Erklärung. Der Rundenzähler kann erinnern, sollte aber Effekte ohne Kenntnis fremder Züge und Reaktionen nicht ungefragt beenden.

### Erholung führen

Short Rest kann gezielt Hit Dice, erfasste Heilung und wiederkehrende Ressourcen zusammenführen. Long Rest sollte ausgewählte 2014-/2024-Regeln nachvollziehbar anwenden. Die bestehende `android-v1`-Policy ist ein Kompatibilitätsverhalten, kein universelles Editionsprofil. Dawn/Dusk und freie Zeitereignisse getrennt modellieren.

### Begleiter, Summons und Wildshape

Monster-Schemas kennen `summonedBySpell`, `summonedBySpellLevel`, `summonedByClass`, `summonedScaleByPlayerLevel`, Typ, CR und Bewegung. Ein kleiner Assistent könnte aus einem passenden Spell/Feature eine eigene Companion-Instanz vorschlagen und bekannte Werte mit Vorschau skalieren. Statische Statblocks werden bereits angezeigt.

HP-/AC-/Attack-Formeln und das Ersetzen beziehungsweise Erhalten von Charakterwerten unterscheiden sich erheblich. Erst wenige ausdrücklich unterstützte Summon-/Companion-Profile. Wildshape ist später ein größerer eigener Workflow; keine generische Monster-CR-Skalierung behaupten.

### Bastion Turns

Facility-Orders, Space, Hirelings und Beschreibungen sind schon vorhanden. Sinnvoll wären eine gewählte erlaubte Order pro Facility, Status, nächste Fälligkeit, Notiz und ein bestätigter Abschluss. Rewards/Charms/Tabellen lassen sich als Referenzen einbinden. Automatische Produktion, Preise, Ausbau oder Hireling-Wirtschaft sind durch die vorhandenen Daten nicht vollständig geregelt.

## Quality of Life ohne zusätzliche Regelautomatisierung

| Idee | Nutzen | Aufwand / Grenze |
| --- | --- | --- |
| Favoriten und „zuletzt angesehen“ | Häufige Spells, Features und Regeln schnell öffnen | Mittel; Bibliotheksfavoriten und charakterbezogene Pins trennen, IDs statt nur Namen |
| Kleine persönliche Ressourcenübersicht | Slots/Uses nach Erholung gebündelt sehen | Mittel; abgeleitete Übersicht, keine zweite Kopie der Zähler |
| Charakter duplizieren | Neue Build-Variante oder Backup | Mittel; neue Identität, bewusste Entscheidung zu Notes und Spielzustand, kein impliziter Rest |
| Sicheres Undo der letzten Spielhandlung | Versehentlichen Slot-/Uses-/HP-Verbrauch korrigieren | Mittel–groß; nur wenn der betroffene Folgezustand noch passt, Sync-Änderungen nicht überschreiben |
| Einfacher Würfelhelfer | Check/Save/ausdrücklichen Würfelausdruck direkt benutzen | Mittel; transparente Modifikatoren, keine automatische Trefferentscheidung |
| Compendium-Vergleich | 2014/2024-Versionen oder zwei Optionen vergleichen | Mittel; mobil Feldvergleich/Wechselansicht, keine schmalen Volltextspalten |
| Charakterbezogene Update-Zusammenfassung | „Diese 3 Features dieses Charakters wurden geändert“ | Mittel; vorhandene exakte Referenzen und Previews verwenden, Beschreibung von Regel-/Auswahländerung trennen |
| Regel-/Build-Notizen an Details | Hausregeln und Absprachen dort behalten, wo sie gebraucht werden | Klein–mittel; bestehende Notes nutzen, Definitionen unverändert lassen |
| Export-/Sitzungsansicht | Kompakter druckbarer Bogen oder Zusammenfassung für den Tisch | Mittel; ausgewählte Sektionen, keine dritte persistierte Charakterstruktur |
| Bewusstes Offline-Vorbereiten | Gewählte Charaktere samt benötigten Ansichten/Referenzen lokal verfügbar machen | Groß; JS-Chunks, Auth, Bilder, Daten, Speicherquote und Aktualisierung separat betrachten |

## Größere technische Umstrukturierungen, die Erweiterungen erleichtern

### 1. Gemeinsame Semantik für Grants und Referenzen

Heute gibt es bereits qualifizierte IDs, `ContentLink.scope`, Creator- und Compendium-Helfer. Darauf aufbauen: Deskriptiver Link, feste Gewährung, Voraussetzung, permanente Auswahl und temporäre Option müssen getrennte Bedeutung haben. Gemeinsame Auswertung für Wizard, Feature-Progression, Update-Vorschau und Detailnavigation; asynchronen Cache-Zugriff von reiner Auswertung trennen.

Keine neuen synthetischen Klassen-/Subklassenkopien und kein separates Alias-Register pro Screen. Quellenidentitäten und historische Snapshots bleiben notwendig, auch wenn die Auswahl nur eine passende Option zeigt.

### 2. Einheitliche Spielaktionen statt unabhängiger Mutationen

Eine bestätigte Handlung sollte ihren aktuellen Zustand prüfen und ihre Änderungen gemeinsam speichern: etwa Item-Ladung plus Cast beziehungsweise Item-Menge plus Geld. Hierhin gehören später eng begrenztes Undo und verständliche Aktionsberichte. Vorhandene native Pool-/Action-Regeln wiederverwenden, nicht einen dritten Ressourcenmotor hinzufügen.

### 3. Regelversion ausdrücklich festlegen

Ein optionales Charakterprofil 2014/2024/Hausregeln ist belastbarer als die Regelversion aus jedem Buchcode abzuleiten. Die ausgewählte Klasse/Subklasse bleibt exakt qualifiziert. Profile können nach und nach Rest, Exhaustion, Feat-/ASI-Entscheidungen, Vorbereitung und Masteries steuern. Gemischte Quellen brauchen weiterhin manuelle Entscheidungen.

### 4. Definition, Erwerb, manueller Override und Spielzustand konsequent trennen

Die App hat bereits ein natives `CharacterDocument`, portable Viewer-Daten und Projektions-/Kompatibilitätspfade. Eine schrittweise Konsolidierung ist sinnvoll; ein kompletter Rewrite nicht.

Neue Funktionen sollten zunächst definieren: Was kommt unverändert aus der Library? Was hat der Nutzer gewählt? Was wurde ausdrücklich überschrieben? Was ist verbraucht oder vorübergehend? Genau diese Trennung schützt Notes, Uses und bestehende Charaktere bei Content-Updates. Neue Attribute-/Feat-/Ausrüstungs-Grants und gemeinsame Pools machen diese Arbeit wertvoller.

### 5. Capability-Sicht statt pauschaler Unterstützung

Intern je Datentyp/Sonderform festhalten: vollständig nutzbar, nur darstellbar, manuell zu bestätigen oder nicht unterstützt. Im UI nur die für den aktuellen Vorgang relevante Lücke zeigen. Das erleichtert Homebrew-Support und zielgerichtete Tests, ohne jede schema-konforme Datenstruktur automatisch zur ausführbaren Regel zu erklären.

## Mobile Design als gemeinsame Bedingung

- Häufige Werte als kompakte Zeile, Details erst auf Nachfrage.
- Pro Spielhandlung ein klarer primärer Button, Rest über bestehende Detailansichten.
- Zusätzliche Filter gruppieren; vorhandene zusammengefasste Filter-Chips verwenden.
- Auswahlentscheidungen im Wizard schrittweise zeigen, nicht ein Feld für jedes Schemaattribut.
- Neue Ressourcenübersichten aus vorhandenem Zustand ableiten; nicht weitere Zählerkarten unter jede Aktion hängen.
- Vergleich und Erklärungen mobil aufklappen oder umschalten, Desktop bei ausreichend Platz spaltenweise.

## Empfohlene Reihenfolge

1. **Korrektheit:** `options.count` und spätere Feature-Vergabe; unprüfbare Prerequisites von unerfüllten unterscheiden.
2. **Kleine Lieferung:** Spell-Effektfilter, Notes-/Charaktersuche, Inventar-Summen mit Vollständigkeitshinweis.
3. **Creator 2024:** Background-Feats, danach Attribute als nachvollziehbare Beiträge und Feat-/ASI-Slots. Spell-Anzahlen und Masteries anschließen.
4. **Spiel am Tisch:** gemeinsame Ressourcen/Kosten und Item-Casting, anschließend bewusste Ladungserholung und Verbrauchsgegenstände.
5. **Eigener neuer Workflow:** kleiner Bastion-Turn-Tracker oder wenige unterstützte Summon-/Companion-Profile.
6. **Parallel gezielt:** Favoriten, verständliche Herkunft und Updates; größere Offline-Vorbereitung erst mit eigener Lade-/Speicherstrategie.

Wenn nur drei größere Themen gewählt werden: **Creator mit Background/Feats/Attributen**, **gemeinsame Ressourcen und Item-Casting**, **nachvollziehbarer Levelaufstieg mit Updates**. Diese vervollständigen den vorhandenen Charakter-Workflow stärker als zusätzliche seltene Compendium-Kategorien.

## Niedrige Priorität oder anderer Produktumfang

Alter/Größe/Gewicht der Spezies, Aussprache-Audio, dekorative Fluff-Bilder und weitere Lore sind mögliche kleine Ergänzungen, aber weniger wertvoll als fehlende Charakterentscheidungen. `hasFluffImages` ist nur ein Verfügbarkeitshinweis; Bilddaten sind dadurch noch nicht offline vorhanden.

Schemas für Deities, Cults/Boons, Psionics und Recipes bedeuten nicht, dass diese Inhalte bereits regulär importiert und aufbereitet werden. Zusätzliche Kategorien brauchen einen bewussten Import-/UI-Scope. Das Recipe-Schema beschreibt unter anderem Zutaten, Portionen und Kochanweisungen; es ist keine vollständige allgemeine D&D-Crafting-Regelengine.

Ein Gruppen-Encounter-Manager, Battlemap, Kampagnenverwaltung und beliebige Prosa-Regelauswertung wären größere Produktentscheidungen. Für DiceAlly als mobilen Charakterbegleiter sind sie derzeit schwächer priorisiert.

## Weitere Code- und Schema-Anker

- [Content-Discovery](../src/app/content/content-discovery.ts), [importierte Kategorien](../src/app/content/generated/schema-registry.ts), [Compendium-Facetten](../src/app/compendium/compendium-catalog.ts).
- [Ability-Regeln](../src/app/rules/ability-rules.ts), [Voraussetzungen](../src/app/rules/prerequisites.ts), [Wizard](../src/app/editor/class-wizard-preview.ts), [manuelle Creator-Handoffs](../src/app/editor/wizard-guidance.ts).
- [Feat-Schema](../schemas/5etools/site/feats.json), [Shared-Schema](../schemas/5etools/site/util.json), [Klassen-Schema](../schemas/5etools/site/class/class.json).
- [Item-Ladungen](../src/app/content/item-charges.ts), [Ladungs-Testbeispiele](../src/app/editor/item-charges.spec.ts), [Item-Zauber](../src/app/editor/item-attached-spells.ts), [Pool-/Action-Regeln](../src/app/rules/resource-action-rules.ts).
- [Item-Schema](../schemas/5etools/site/items.json), [Spell-Schema](../schemas/5etools/site/spells/spells.json), [Monster-Schema](../schemas/5etools/site/bestiary/bestiary.json), [Bastions-Schema](../schemas/5etools/site/bastions.json).
- [Dokumentmodell](../src/app/rules/character-document.ts), [Sheet-Projektion](../src/app/editor/editor-document.ts), [Spielzustand](../src/app/stores/character.store.ts), [Erholung](../src/app/services/rest.service.ts).
