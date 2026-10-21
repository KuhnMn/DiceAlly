import type { BrewSourceByKind } from './generated/brew-source';

type SourceSpell = BrewSourceByKind['spell'];
export type SpellClassMembership = NonNullable<NonNullable<SourceSpell['classes']>['fromClassList']>[number];
export interface SpellMemberships {
  fromClassList: SpellClassMembership[];
  fromClassListVariant: SpellClassMembership[];
  fromSubclass?: NonNullable<SourceSpell['classes']>['fromSubclass'];
}
/** Missing presentation fields are retained for historical native snapshots; new sources validate in full. */
export interface SpellDefinition {
  version: 1;
  level: number;
  school?: SourceSpell['school'];
  time?: SourceSpell['time'];
  range?: SourceSpell['range'];
  components?: SourceSpell['components'];
  duration?: SourceSpell['duration'];
  meta?: SourceSpell['meta'];
  spellAttack?: SourceSpell['spellAttack'];
  memberships: SpellMemberships;
}
