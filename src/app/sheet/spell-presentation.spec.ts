import { TestBed } from '@angular/core/testing';
import { SpellDetailsComponent } from './spell-details.component';
import { prepareSpellCastingTimes, prepareSpellComponents, prepareSpellDetails, prepareSpellDurations, spellDurationText } from './spell-presentation';

describe('Prepared spell details', () => {
  it('preserves casting alternatives, reaction conditions, and notes independently', () => {
    expect(prepareSpellCastingTimes([
      { number: 1, unit: 'reaction', condition: 'when you take damage', note: 'After the triggering attack' },
      { number: 2, unit: 'bonus' },
      { unit: 'special' },
    ])).toEqual([
      { durationText: '1 reaction', conditionText: 'when you take damage', noteText: 'After the triggering attack' },
      { durationText: '2 bonus actions' },
      { durationText: 'special' },
    ]);
  });

  it('distinguishes absent, boolean, descriptive, and explicitly costed materials', () => {
    expect(prepareSpellComponents({ m: false }).material).toBeUndefined();
    expect(prepareSpellComponents({ m: true }).material).toEqual({ consumption: 'unspecified' });
    expect(prepareSpellComponents({ m: 'a feather' }).material).toEqual({ descriptionText: 'a feather', consumption: 'unspecified' });
    expect(prepareSpellComponents({ m: { text: 'a gem', cost: 0, consume: false }, r: true })).toMatchObject({
      requiresRoyalty: true,
      material: { descriptionText: 'a gem', costInCopperPieces: 0, consumption: 'notConsumed' },
    });
    expect(prepareSpellComponents({ m: { text: 'a gem', consume: 'optional' } }).material?.consumption).toBe('optional');
    expect(prepareSpellComponents({ m: { text: 'a gem', consume: true } }).material?.consumption).toBe('consumed');
  });

  it('retains concentration limits, duration conditions, and permanent ending alternatives', () => {
    const durations = prepareSpellDurations([
      { type: 'timed', concentration: true, duration: { amount: 10, type: 'minute' }, condition: 'while within range' },
      { type: 'timed', duration: { amount: 1, type: 'hour', upTo: true } },
      { type: 'permanent', ends: ['dispel', 'discharge', 'the seal breaks'] },
      { type: 'instant' },
      { type: 'timed', concentration: true },
    ]);
    expect(durations.map(value => spellDurationText(value))).toEqual([
      'Concentration, Up to 10 minutes (while within range)', 'Up to 1 hour',
      'Until dispelled or discharged or the seal breaks', 'Instantaneous', 'Concentration, See spell description',
    ]);
    expect(durations[2].endingConditions).toEqual(['dispelled', 'discharged', 'the seal breaks']);
  });

  it('does not infer material consumption or costs from descriptive prose or invent missing timing', () => {
    expect(prepareSpellDetails({ components: { m: 'a pearl worth 100 gp, which is consumed' } })).toEqual({
      castingTimes: [], durations: [], hasRitualCastingOption: false,
      components: { requiresVerbal: false, requiresSomatic: false, requiresRoyalty: false,
        summaryText: 'M (a pearl worth 100 gp, which is consumed)',
        material: { descriptionText: 'a pearl worth 100 gp, which is consumed', consumption: 'unspecified' } },
    });
  });

  it('renders component text and tagged conditions without duplicating material or ritual information', () => {
    const source = {
      time: [{ number: 1, unit: 'reaction', condition: 'after an {@variantrule Unarmed Strike|XPHB}', note: 'After the attack resolves' }, { number: 1, unit: 'action' }],
      components: { v: true, m: { text: 'a {@item Diamond|XPHB} worth 1,000 gp, which the spell consumes', cost: 100000, consume: true } },
      duration: [{ type: 'timed', concentration: true, duration: { type: 'minute', amount: 10 } }],
      meta: { ritual: true },
    };
    const before = JSON.stringify(source);
    const fixture = TestBed.createComponent(SpellDetailsComponent);
    fixture.componentRef.setInput('spell', source);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    for (const expected of ['Unarmed Strike', 'After the attack resolves', 'Diamond worth 1,000 gp, which the spell consumes', 'Concentration, Up to 10 minutes']) {
      expect(text).toContain(expected);
    }
    expect(text).not.toContain('{@');
    expect(text).toContain('Material Cost: 1000 gp');
    expect(text).toContain('Consumed');
    expect(text).not.toContain('Requires a feature');
    const labels = Array.from(fixture.nativeElement.querySelectorAll('dt'), label => (label as HTMLElement).textContent);
    expect(labels).toEqual(['Casting Time', 'Components', 'Duration']);
    expect(fixture.nativeElement.querySelector('dd').textContent).toContain('or');
    expect(JSON.stringify(source)).toBe(before);
  });

  it('omits unspecified material cost and consumption instead of presenting assumed values', () => {
    const fixture = TestBed.createComponent(SpellDetailsComponent);
    fixture.componentRef.setInput('spell', { components: { m: true } });
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Components');
    expect(text).not.toContain('Material Cost');
    expect(text).not.toContain('Material Consumption');
    expect(text).not.toContain('Duration');
  });
});
