import { describe, expect, it } from 'vitest';
import { ContentRecord, entityKey } from '../content/content.model';
import { wizardBackgroundFeats } from './wizard-background-feats';

function record(kind: 'background' | 'feat', name: string, data: ContentRecord['data'] = {}): ContentRecord {
  return { kind, key: entityKey(kind, { name, source: 'XPHB' }), name, publication: 'XPHB', file: 'test.json', links: [], data };
}
const alert = record('feat', 'Alert', { category: 'O' });
const skilled = record('feat', 'Skilled', { category: 'O' });
const general = record('feat', 'General', { category: 'G' });
const records = new Map([alert, skilled, general].map(record => [record.key, record]));

describe('Wizard background feat grants', () => {
  it('resolves qualified fixed grants regardless of catalog visibility and reports missing content', () => {
    const background = record('background', 'Guard', { feats: [{ 'alert|xphb': true, 'missing|xphb': true }] });
    const result = wizardBackgroundFeats(background, records, {}, () => false);
    expect(result.feats).toEqual([alert]);
    expect(result.warnings).toEqual([expect.stringContaining('missing|xphb')]);
  });

  it('requires an explicit alternative package and validates category choices', () => {
    const background = record('background', 'Scholar', { feats: [{ 'alert|xphb': true }, { anyFromCategory: { category: ['O'] } }] });
    const initial = wizardBackgroundFeats(background, records, {}, () => true);
    expect(initial.feats).toEqual([]);
    const answers: Record<string, string[]> = { [initial.choices[0].id]: ['1'] };
    const choice = wizardBackgroundFeats(background, records, answers, () => true).choices[1];
    expect(choice.candidates.map(candidate => candidate.value)).toEqual([alert.key, skilled.key]);
    answers[choice.id] = [general.key];
    expect(wizardBackgroundFeats(background, records, answers, () => true).feats).toEqual([]);
    answers[choice.id] = [skilled.key];
    expect(wizardBackgroundFeats(background, records, answers, () => true).feats).toEqual([skilled]);
  });

  it('enforces the count for open choices and respects catalog filters', () => {
    const background = record('background', 'Custom Grant', { feats: [{ any: 2 }] });
    const initial = wizardBackgroundFeats(background, records, {}, feat => feat !== general);
    const id = initial.choices[0].id;
    expect(initial.choices[0].candidates).toHaveLength(2);
    expect(wizardBackgroundFeats(background, records, { [id]: [alert.key] }, () => true).feats).toEqual([]);
    expect(wizardBackgroundFeats(background, records, { [id]: [alert.key, alert.key] }, () => true).feats).toEqual([]);
    expect(wizardBackgroundFeats(background, records, { [id]: [alert.key, skilled.key] }, () => true).feats).toEqual([alert, skilled]);
  });
});
