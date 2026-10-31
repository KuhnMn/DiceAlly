import 'fake-indexeddb/auto';
import { Component, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { AbilityScoresEditorComponent } from './ability-scores-editor.component';
import { AbilityScoresEditorModel } from './ability-scores-editor-model';
import { AbilityBonusEditorComponent } from './ability-bonus-editor.component';
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
  }
}

describe('Ability bonuses in editor, viewer and saved characters', () => {
  it('keeps manual UI unchanged, edits base values separately, and hides all bonus controls when switched off', async () => {
    const fixture = TestBed.createComponent(AbilityTestHost); await fixture.whenStable();
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
    const selects = background.nativeElement.querySelectorAll('select') as NodeListOf<HTMLSelectElement>;
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

  it('disables and re-enables a source through Bonus Type and preserves overrides while disabled', async () => {
    const fixture = TestBed.createComponent(AbilityTestHost), host = fixture.componentInstance;
    host.editor.setAutomatic(true);
    const sourceId = featureBonusSourceId(host.sheet.features![0]);
    host.sheet.abilityBonuses!.choices[sourceId] = { disabled: true };
    applyAbilityBonuses(host.sheet);
    await fixture.whenStable();
    const feature = fixture.debugElement.queryAll(By.directive(AbilityBonusEditorComponent)).find(entry =>
      entry.componentInstance.sourceId() === sourceId)!;
    const root = feature.nativeElement as HTMLElement;
    const bonusType = () => root.querySelector<HTMLSelectElement>('details select')!;
    const selectType = async (value: string) => {
      bonusType().value = value;
      bonusType().dispatchEvent(new Event('change'));
      await fixture.whenStable();
    };
    expect(bonusType().value).toBe('none');
    expect(host.sheet.character!.abilityScores!.strength).toBe(10);
    await selectType('content');
    expect(host.sheet.character!.abilityScores!.strength).toBe(12);
    await selectType('fixed');
    const strength = root.querySelector<HTMLInputElement>('[aria-label="Fixed ability bonuses"] input')!;
    strength.value = '3'; strength.dispatchEvent(new Event('input')); await fixture.whenStable();
    expect(host.sheet.character!.abilityScores!.strength).toBe(13);
    const custom = structuredClone(host.sheet.abilityBonuses!.custom[sourceId]);
    await selectType('none');
    expect(host.sheet.character!.abilityScores!.strength).toBe(10);
    expect(host.sheet.abilityBonuses!.custom[sourceId]).toEqual(custom);
    expect(root.querySelector('[aria-label="Fixed ability bonuses"]')).toBeNull();
    await selectType('content');
    expect(host.sheet.abilityBonuses!.choices[sourceId].disabled).toBe(false);
    expect(host.sheet.character!.abilityScores!.strength).toBe(12);
    fixture.destroy();
  });

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
