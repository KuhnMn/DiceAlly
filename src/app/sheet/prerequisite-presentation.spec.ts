import { preparePrerequisites } from './prerequisite-presentation';

describe('Prerequisite reference display', () => {
  it('supports XPHB numeric levels and factors common requirements across alternatives', () => {
    expect(preparePrerequisites([{ level: 4, ability: [{ cha: 13 }] }]).detailText).toBe('Level 4+ AND Charisma 13+');
    expect(preparePrerequisites([{ level: 4, ability: [{ str: 13 }] }, { level: 4, ability: [{ dex: 13 }] }]).detailText)
      .toBe('Level 4+ AND (Strength 13+ OR Dexterity 13+)');
  });

  it('keeps nested ability and proficiency alternatives distinct from cumulative requirements', () => {
    expect(preparePrerequisites([{ ability: [{ str: 13, dex: 13 }, { wis: 15 }], proficiency: [{ armor: 'medium' }, { weaponGroup: 'martial' }] }]).detailText)
      .toBe('((Strength 13+ AND Dexterity 13+) OR Wisdom 15+) AND (Medium Armor Training OR Martial Weapon Proficiency)');
  });

  it('renders XPHB invocation requirements and EFA feat references without raw UIDs', () => {
    expect(preparePrerequisites([{ level: { level: 12, class: { name: 'Warlock' } }, optionalfeature: ['thirsting blade|xphb'] }]).detailText)
      .toBe('Warlock Level 12+ AND Optional Feature: Thirsting Blade');
    expect(preparePrerequisites([{ level: 4, feat: ['aberrant dragonmark|efa'], campaign: ['Eberron'] }]).detailText)
      .toBe('Level 4+ AND Feat: Aberrant Dragonmark AND Campaign: Eberron');
    expect(preparePrerequisites([{ exclusiveFeatCategory: ['D'] }]).detailText).toBe('No other Dragonmark feat');
  });

  it('honors full and short authored explanations and keeps annotations separate', () => {
    const result = preparePrerequisites([{ spell: [{ choose: 'level=0|class=Warlock', entry: 'a Warlock Cantrip That Deals Damage', entrySummary: 'Damaging Warlock Cantrip' }],
      otherSummary: { entry: 'When gaining the Level 2 Paladin Fighting Style feature', entrySummary: 'Special' }, note: 'Ask your DM.' }]);
    expect(result.detailText).toBe('a Warlock Cantrip That Deals Damage AND When gaining the Level 2 Paladin Fighting Style feature');
    expect(result.summaryText).toBe('Damaging Warlock Cantrip AND Special');
    expect(result.notes).toEqual(['Ask your DM.']);
  });

  it('renders Bastion focus, expertise and membership requirements with cumulative and alternative semantics', () => {
    expect(preparePrerequisites([{ spellcastingFocus: ['arcane', 'tool'] }]).detailText)
      .toBe('Ability to use an Arcane Focus as a Spellcasting Focus OR Ability to use a Tool as a Spellcasting Focus');
    expect(preparePrerequisites([{ spellcastingFocus: true }]).detailText).toBe('Ability to use a Spellcasting Focus');
    expect(preparePrerequisites([{ spellcastingFocus: ['artisansTool'] }]).detailText).toContain('Artisan’s Tools');
    expect(preparePrerequisites([{ expertise: [{ skill: true }] }]).detailText).toBe('Expertise in a skill');
    expect(preparePrerequisites([{ membership: ['Horizon Weavers'], spellcastingFocus: ['arcane', 'holy'] }]).detailText)
      .toBe('Member of: Horizon Weavers AND (Ability to use an Arcane Focus as a Spellcasting Focus OR Ability to use a Holy Symbol as a Spellcasting Focus)');
  });

  it('keeps historical spell/level representations readable and leaves unconstrained options empty', () => {
    expect(preparePrerequisites([{ level: { type: 'simple', level: 4 }, spell: [{ type: 'simple', spellName: 'hex' }] }]).detailText).toBe('Level 4+ AND Hex spell');
    expect(preparePrerequisites([]).expression).toBeNull();
    expect(preparePrerequisites([{ other: 'A specific campaign event' }]).detailText).toBe('A specific campaign event');
    expect(preparePrerequisites([{ level: 19, spellcasting2020: true }]).detailText).toBe('Level 19+ AND (Spellcasting feature OR Pact Magic feature)');
  });
});
