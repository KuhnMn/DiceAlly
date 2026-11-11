import 'fake-indexeddb/auto';
import { Component, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { AbilityScoresEditorComponent } from './ability-scores-editor.component';
import { AbilityScoresEditorModel } from './ability-scores-editor-model';
import { AbilityBonusEditorComponent } from './ability-bonus-editor.component';
import { EntryAnnotationsComponent } from './entry-annotations.component';
import { abilityScoreFormula } from '../models/ability-score-bonuses';
import { AbilityBonusSummaryComponent } from '../sheet/ability-bonus-summary.component';
import { CharacterHelpersService } from '../sheet/character-helpers.service';
import { emptyBasicCharacter } from './basic-info';
import { applyAbilityBonuses, setAbilityBonusesEnabled, backgroundBonusSourceId, featureBonusSourceId } from '../models/ability-score-bonuses';
import { IndexedDbCharacterRepository } from '../characters/indexeddb-character-repository';
import { encodeCloudCharacter, decodeCloudCharacter } from '../characters/sync/character-cloud';
import { refreshCharacterDescriptions } from './refresh-character-content';
import { mapContent } from '../content/content-adapter';
import { createFeatureEntry } from './feature-selection';
import { ADAPTER_VERSION, DEFAULT_CONTENT_SOURCE, ImportRevision, sourceIdentity } from '../content/content.model';

@Component({
  imports: [FormsModule, AbilityScoresEditorComponent, AbilityBonusSummaryComponent],
  template: '<form><app-editor-ability-scores [model]="editor" /></form><app-ability-bonus-summary [sheet]="sheet" />',
})
class AbilityTestHost {
  readonly sheet = emptyBasicCharacter();
  readonly editor = new AbilityScoresEditorModel({ sheet: () => this.sheet, changed: () => applyAbilityBonuses(this.sheet), reportError: () => {} }, inject(CharacterHelpersService));
  constructor() {
    this.sheet.features = [{ editorId: 'feat', name: 'Strong feat', featureType: 'FEAT',
      featEntity: { name: 'Strong feat', source: 'TEST', entries: [], ability: [{ str: 2 }] } }];
    this.sheet.background = { name: 'Background', entity: { ability: [{ choose: { weighted: { from: ['wis', 'int', 'cha'], weights: [2, 1] } } }] } };
    applyAbilityBonuses(this.sheet);
  }
}

@Component({
  imports: [EntryAnnotationsComponent, AbilityBonusEditorComponent],
  template: `<app-entry-annotations-editor [entry]="sheet.features![0]" [showBonus]="true">
    <app-ability-bonus-editor annotation-bonus [inlineConfiguration]="true" [sheet]="sheet" sourceId="feature:feat" [showSource]="false" (edited)="update()" />
  </app-entry-annotations-editor>`,
})
class BonusToolsHost {
  readonly sheet = emptyBasicCharacter();
  constructor() {
    this.sheet.features = [{ editorId: 'feat', name: 'Choice feat', featureType: 'FEAT',
      featEntity: { name: 'Choice feat', source: 'TEST', entries: [], ability: [{ choose: { from: ['str', 'dex'], amount: 1 } }] } }];
  }
  update() { applyAbilityBonuses(this.sheet); }
}

describe('Ability bonuses in editor, viewer and saved characters', () => {
  it('keeps manual UI unchanged, edits base values separately, and hides all bonus controls when switched off', async () => {
    const fixture = TestBed.createComponent(AbilityTestHost);
    fixture.componentInstance.editor.setAutomatic(false);
    await fixture.whenStable();
    const host = fixture.componentInstance, root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('[aria-label="Ability bonus sources"]')).toBeNull();
    expect(root.querySelector('[aria-label="Applied ability bonuses"]')).toBeNull();
    const modeButtons = [...root.querySelectorAll<HTMLButtonElement>('[aria-label="Use Feature Stat Bonuses"] button')];
    const automatic = modeButtons.find(button => button.textContent?.trim() === 'Yes')!;
    automatic.click(); await fixture.whenStable();
    expect(host.sheet.character!.abilityScores!.strength).toBe(12);
    const strength = root.querySelector<HTMLInputElement>('#ability-strength')!;
    expect(strength.value).toBe('10');
    strength.value = '14'; strength.dispatchEvent(new Event('input')); await fixture.whenStable();
    expect(host.sheet.abilityBonuses!.base.strength).toBe(14);
    expect(host.sheet.character!.abilityScores!.strength).toBe(16);
    expect(root.textContent).toContain('Total 16');
    expect(root.querySelector('[aria-label="Applied ability bonuses"]')?.textContent).toContain('Strong feat');
    modeButtons.find(button => button.textContent?.trim() === 'No')!.click();
    await fixture.whenStable();
    expect(strength.value).toBe('14'); expect(host.sheet.character!.abilityScores!.strength).toBe(14);
    expect(root.querySelector('[aria-label="Ability bonus sources"]')).toBeNull();
    expect(root.querySelector('[aria-label="Applied ability bonuses"]')).toBeNull();
    fixture.destroy();
  });

  it('configures weighted choices through the controls and shows the confirmed allocation on the sheet', async () => {
    const fixture = TestBed.createComponent(AbilityTestHost), host = fixture.componentInstance;
    host.editor.setAutomatic(true); await fixture.whenStable();
    const background = fixture.debugElement.queryAll(By.directive(AbilityBonusEditorComponent)).find(entry =>
      entry.componentInstance.sourceId() === backgroundBonusSourceId(host.sheet.background!))!;
    const selects = background.nativeElement.querySelectorAll('[aria-label="Ability allocation"] select') as NodeListOf<HTMLSelectElement>;
    expect(background.nativeElement.querySelector('.bonus-maximum')).toBeNull();
    selects[0].value = 'wis'; selects[0].dispatchEvent(new Event('change')); await fixture.whenStable();
    expect(host.sheet.character!.abilityScores!.wisdom).toBe(10);
    expect(selects[1].querySelector<HTMLOptionElement>('option[value="wis"]')!.disabled).toBe(true);
    selects[1].value = 'int'; selects[1].dispatchEvent(new Event('change')); await fixture.whenStable();
    expect(host.sheet.character!.abilityScores).toMatchObject({ wisdom: 12, intelligence: 11 });
    const summary = fixture.nativeElement.querySelector('[aria-label="Applied ability bonuses"]') as HTMLElement;
    expect(summary.textContent).toContain('+2 WIS'); expect(summary.textContent).toContain('+1 INT');
    host.editor.setAutomatic(false); host.editor.setAutomatic(true); await fixture.whenStable();
    expect(host.sheet.abilityBonuses!.choices[backgroundBonusSourceId(host.sheet.background!)].chosen).toEqual(['wis', 'int']);
    expect(host.sheet.character!.abilityScores!.wisdom).toBe(12);
    fixture.destroy();
  });

  it('removes a bonus source and its authored values through No bonus, and restores it only from its owner', async () => {
    const fixture = TestBed.createComponent(AbilityTestHost), host = fixture.componentInstance;
    const sourceId = featureBonusSourceId(host.sheet.features![0]);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const row = () => root.querySelector<HTMLDetailsElement>('[aria-label="Strong feat stat bonuses"]');
    expect(row()!.open).toBe(false);
    row()!.open = true;
    expect(row()!.querySelector('app-ability-bonus-editor details')).toBeNull();
    const type = row()!.querySelector<HTMLSelectElement>('select')!;
    type.value = 'fixed'; type.dispatchEvent(new Event('change')); await fixture.whenStable();
    const strength = row()!.querySelector<HTMLInputElement>('[aria-label="Fixed ability bonuses"] input')!;
    strength.value = '3'; strength.dispatchEvent(new Event('input')); await fixture.whenStable();
    expect(host.sheet.character!.abilityScores!.strength).toBe(13);
    type.value = 'none'; type.dispatchEvent(new Event('change')); await fixture.whenStable();
    expect(host.sheet.character!.abilityScores!.strength).toBe(10);
    expect(row()).toBeNull();
    expect(host.sheet.abilityBonuses!.custom[sourceId]).toBeUndefined();
    expect(host.sheet.abilityBonuses!.choices[sourceId]).toEqual({ disabled: true });
    expect(host.editor.bonusResult.sources.some(result => result.source.id === sourceId)).toBe(false);
    const restored = JSON.parse(JSON.stringify(host.sheet));
    applyAbilityBonuses(restored);
    expect(restored.character.abilityScores.strength).toBe(10);
    // The feature's own editor remains available when its Ability Scores row is gone.
    const owner = TestBed.createComponent(AbilityBonusEditorComponent);
    owner.componentRef.setInput('sheet', host.sheet);
    owner.componentRef.setInput('sourceId', sourceId);
    owner.componentRef.setInput('inlineConfiguration', true);
    owner.componentInstance.edited.subscribe(() => {
      applyAbilityBonuses(host.sheet);
      // Two independent fixtures share the document; refresh the other view on edits.
      fixture.detectChanges();
    });
    await owner.whenStable();
    const ownerType = owner.nativeElement.querySelector('select') as HTMLSelectElement;
    expect(ownerType.value).toBe('none');
    ownerType.value = 'content'; ownerType.dispatchEvent(new Event('change')); await owner.whenStable();
    fixture.changeDetectorRef.markForCheck(); await fixture.whenStable();
    expect(host.sheet.character!.abilityScores!.strength).toBe(12);
    expect(row()).not.toBeNull();
    expect(host.sheet.abilityBonuses!.custom[sourceId]).toBeUndefined();
    owner.destroy(); fixture.destroy();
  });

  it('opens stat bonuses from the entry tools and closes them when Notes opens', async () => {
    const fixture = TestBed.createComponent(BonusToolsHost); await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const panel = root.querySelector<HTMLElement>('[aria-label="Stat bonuses editor"]')!;
    expect(panel.hidden).toBe(true);
    const buttons = [...root.querySelectorAll<HTMLButtonElement>('[aria-label="Entry tools"] button')];
    buttons.find(button => button.textContent!.includes('Stat Bonuses'))!.click(); await fixture.whenStable();
    expect(panel.hidden).toBe(false);
    expect(panel.querySelector('details')).toBeNull();
    expect(panel.querySelector('select')?.closest('label')?.textContent).toContain('Bonus Type');
    const select = panel.querySelector<HTMLSelectElement>('[aria-label="Ability allocation"] select')!;
    select.value = 'str'; select.dispatchEvent(new Event('change')); await fixture.whenStable();
    expect(abilityScoreFormula(fixture.componentInstance.sheet, 'strength')).toContain('+ 1 Choice feat');
    expect(panel.textContent).not.toContain('Choose 1 distinct ability');
    buttons.find(button => button.textContent!.includes('Notes'))!.click(); await fixture.whenStable();
    expect(panel.hidden).toBe(true);
    fixture.destroy();
  });

  it('defaults new characters to automatic and offers one configuration route for a custom background', async () => {
    const sheet = emptyBasicCharacter();
    expect(sheet.abilityBonuses!.enabled).toBe(true);
    expect(sheet.abilityBonuses!.base).toEqual(sheet.character!.abilityScores);
    expect(sheet.abilityBonuses!.base).not.toBe(sheet.character!.abilityScores);
    sheet.background = { name: 'Custom background' };
    const fixture = TestBed.createComponent(AbilityBonusEditorComponent);
    fixture.componentRef.setInput('sheet', sheet);
    fixture.componentRef.setInput('sourceId', backgroundBonusSourceId(sheet.background));
    fixture.componentInstance.edited.subscribe(() => applyAbilityBonuses(sheet));
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const type = root.querySelector<HTMLSelectElement>('details select')!;
    expect(type.value).toBe('none');
    expect(type.querySelector('option[value="content"]')).toBeNull();
    expect(root.textContent).not.toContain('Add Stat Bonus');
    expect([...type.options].map(option => option.value)).toEqual(['none', 'three', 'two-one']);
    type.value = 'two-one'; type.dispatchEvent(new Event('change')); await fixture.whenStable();
    expect(root.querySelector('[aria-label="Ability allocation"]')).not.toBeNull();
    type.value = 'none'; type.dispatchEvent(new Event('change')); await fixture.whenStable();
    expect(root.querySelector('[aria-label="Ability allocation"]')).toBeNull();
    expect(root.querySelector('p[role="status"]')).toBeNull();
    const id = backgroundBonusSourceId(sheet.background);
    expect(sheet.abilityBonuses!.custom[id]).toBeUndefined();
    expect(sheet.abilityBonuses!.choices[id]).toBeUndefined();
    fixture.destroy();
  });

  for (const preset of ['one', 'two', 'fixed', 'three', 'two-one']) {
    it(`edits and retains the maximum for the ${preset} manual bonus`, async () => {
      const sheet = emptyBasicCharacter();
      const isBackground = preset === 'three' || preset === 'two-one';
      sheet.background = { name: 'Custom background' };
      sheet.features = [{ editorId: 'custom', name: 'Custom feature' }];
      sheet.abilityBonuses!.base.strength = 20;
      const sourceId = isBackground ? backgroundBonusSourceId(sheet.background) : featureBonusSourceId(sheet.features[0]);
      const fixture = TestBed.createComponent(AbilityBonusEditorComponent);
      fixture.componentRef.setInput('sheet', sheet);
      fixture.componentRef.setInput('sourceId', sourceId);
      fixture.componentRef.setInput('inlineConfiguration', true);
      fixture.componentInstance.edited.subscribe(() => applyAbilityBonuses(fixture.componentInstance.sheet()));
      await fixture.whenStable();
      const root = fixture.nativeElement as HTMLElement;
      const type = root.querySelector<HTMLSelectElement>('.bonus-config-field select')!;
      type.value = preset; type.dispatchEvent(new Event('change')); await fixture.whenStable();
      if (preset === 'fixed') {
        const strength = root.querySelector<HTMLInputElement>('[aria-label="Fixed ability bonuses"] input')!;
        strength.value = '2'; strength.dispatchEvent(new Event('input')); await fixture.whenStable();
      } else {
        const choices = root.querySelectorAll<HTMLSelectElement>('[aria-label="Ability allocation"] select');
        for (const [index, choice] of [...choices].entries()) {
          choice.value = ['str', 'dex', 'con'][index]; choice.dispatchEvent(new Event('change')); await fixture.whenStable();
        }
      }
      expect(sheet.character!.abilityScores!.strength).toBe(20);
      const maximum = root.querySelector<HTMLInputElement>('.bonus-maximum input')!;
      maximum.value = '24'; maximum.dispatchEvent(new Event('input')); await fixture.whenStable();
      const expected = preset === 'two' || preset === 'three' ? 21 : 22;
      expect(sheet.character!.abilityScores!.strength).toBe(expected);
      for (const invalid of ['0', '31', '22.5']) {
        maximum.value = invalid; maximum.dispatchEvent(new Event('input')); await fixture.whenStable();
        expect(sheet.abilityBonuses!.custom[sourceId][0].maximum).toBe(24);
        expect(sheet.character!.abilityScores!.strength).toBe(expected);
      }
      fixture.destroy();
      const restored = structuredClone(sheet);
      const reloaded = TestBed.createComponent(AbilityBonusEditorComponent);
      reloaded.componentRef.setInput('sheet', restored);
      reloaded.componentRef.setInput('sourceId', sourceId);
      reloaded.componentRef.setInput('inlineConfiguration', true);
      reloaded.componentInstance.edited.subscribe(() => applyAbilityBonuses(restored));
      await reloaded.whenStable();
      const restoredMaximum = reloaded.nativeElement.querySelector('.bonus-maximum input') as HTMLInputElement;
      expect(restoredMaximum.value).toBe('24');
      expect(reloaded.componentInstance.preset).toBe(preset);
      restoredMaximum.value = '21'; restoredMaximum.dispatchEvent(new Event('input')); await reloaded.whenStable();
      expect(restored.character!.abilityScores!.strength).toBe(21);
      reloaded.destroy();
    });
  }

  for (const allocation of [
    { preset: 'three', abilities: ['str', 'dex', 'con'], expected: { strength: 11, dexterity: 11, constitution: 11 } },
    { preset: 'two-one', abilities: ['str', 'dex'], expected: { strength: 12, dexterity: 11, constitution: 10 } },
  ]) {
    it(`configures and reloads the ${allocation.preset} custom background allocation`, async () => {
      const sheet = emptyBasicCharacter(); sheet.background = { name: 'Custom background' };
      const sourceId = backgroundBonusSourceId(sheet.background);
      const fixture = TestBed.createComponent(AbilityBonusEditorComponent);
      fixture.componentRef.setInput('sheet', sheet); fixture.componentRef.setInput('sourceId', sourceId);
      fixture.componentInstance.edited.subscribe(() => applyAbilityBonuses(sheet));
      await fixture.whenStable();
      const root = fixture.nativeElement as HTMLElement;
      const type = root.querySelector<HTMLSelectElement>('details select')!;
      type.value = allocation.preset; type.dispatchEvent(new Event('change')); await fixture.whenStable();
      const choices = root.querySelectorAll<HTMLSelectElement>('[aria-label="Ability allocation"] select');
      expect(choices.length).toBe(allocation.abilities.length);
      for (const [index, ability] of allocation.abilities.entries()) {
        choices[index].value = ability; choices[index].dispatchEvent(new Event('change')); await fixture.whenStable();
        if (index === 0) expect(choices[1].querySelector<HTMLOptionElement>('option[value="str"]')!.disabled).toBe(true);
      }
      expect(sheet.character!.abilityScores).toMatchObject(allocation.expected);
      // Reload saved data to check that weighted allocations retain the correct editor type.
      fixture.componentRef.setInput('sheet', structuredClone(sheet)); await fixture.whenStable();
      expect(type.value).toBe(allocation.preset);
      expect(fixture.componentInstance.selection.chosen).toEqual(allocation.abilities);
      fixture.destroy();
    });
  }

  it('persists choices through local/cloud serialization and recalculates refreshed definitions without replacing bases', async () => {
    const source = DEFAULT_CONTENT_SOURCE;
    const revision: ImportRevision = { id: 'ability-revision', namespace: 'development-local', source, sourceIdentity: sourceIdentity(source),
      commit: 'a'.repeat(40), adapterVersion: ADAPTER_VERSION, status: 'ready', createdAt: new Date().toISOString(), files: [], diagnostics: [], metrics: { bytes: 0, records: 1, elapsedMs: 0, mappedBytes: 0 } };
    const record = mapContent({ feat: [{ name: 'Choice feat', source: 'TEST', entries: [], ability: [{ choose: { from: ['int', 'wis'], amount: 1 } }] }] }, 'feats.json').records[0];
    const sheet = emptyBasicCharacter(); sheet.character!.name = 'Ability test';
    const feature = createFeatureEntry(record, revision); sheet.features = [feature];
    setAbilityBonusesEnabled(sheet, true);
    sheet.abilityBonuses!.choices[featureBonusSourceId(feature)] = { chosen: ['int'] };
    applyAbilityBonuses(sheet); feature.notes = [{ tag: 'Keep', notes: ['Personal note'] }];
    const repository = new IndexedDbCharacterRepository(`ability-bonuses-${crypto.randomUUID()}`);
    await repository.save(sheet, 0);
    const saved = (await repository.get(sheet.character!.characterUuid!))!;
    const cloud = await encodeCloudCharacter(saved, 1), restored = await decodeCloudCharacter(saved.id, cloud);
    expect(restored.sheet.abilityBonuses).toEqual(sheet.abilityBonuses);
    expect(restored.sheet.character!.abilityScores!.intelligence).toBe(11);
    record.data['ability'] = [{ choose: { from: ['int', 'wis'], amount: 2 } }];
    const refreshed = await refreshCharacterDescriptions(restored.sheet, { get: async () => record }, { ...revision, id: 'new-ability-revision' });
    expect(refreshed.sheet.character!.abilityScores!.intelligence).toBe(12);
    expect(refreshed.sheet.abilityBonuses!.base.intelligence).toBe(10);
    expect(refreshed.sheet.abilityBonuses!.choices).toEqual(sheet.abilityBonuses!.choices);
    expect(refreshed.sheet.features![0].notes).toEqual(feature.notes);
    expect(refreshed.sheet.features![0].editorId).toBe(feature.editorId);
  });
});
