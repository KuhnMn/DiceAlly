import { Monster, MonsterCasting, MonsterSpellcasting } from '../models/character.model';
import { sizeName } from '../size-names';

/** Shared read-only stat-block formatting; health and play mutations stay in the sheet component. */
export class MonsterPresentation {
  formatArmorClass(value: unknown): string {
    if (typeof value === 'number' || typeof value === 'string') return String(value);
    if (!value || typeof value !== 'object') return '';
    const ac = value as { ac?: number; special?: string; condition?: string; from?: string[] };
    if (ac.special) return ac.special;
    return [ac.ac == null ? '' : String(ac.ac), ac.from?.length ? `(${ac.from.join(', ')})` : '', ac.condition]
      .filter(Boolean).join(' ');
  }
  formatDefense(value: unknown): string {
    if (typeof value === 'string') return value;
    if (!value || typeof value !== 'object') return '';
    const data = value as Record<string, unknown>;
    if (typeof data['text'] === 'string') return data['text'];
    const nested = ['immune', 'resist', 'vulnerable', 'conditionImmune'].flatMap(field =>
      Array.isArray(data[field]) ? data[field] as unknown[] : []);
    return [data['preNote'], nested.map(entry => this.formatDefense(entry)).join(', '), data['note']]
      .filter(value => typeof value === 'string' && value).join(' ');
  }
  hasAbilityScores(monster: Monster): boolean {
    const e = monster.entity;
    return !!(e && (e.str || e.dex || e.con || e.int || e.wis || e.cha));
  }

  getModifier(score: number | undefined): string {
    if (score == null) return '+0';
    const mod = Math.floor((score - 10) / 2);
    return mod >= 0 ? `+${mod}` : `${mod}`;
  }

  isNumber(value: unknown): value is number {
    return typeof value === 'number';
  }

  hasAcProperty(value: unknown): value is { ac: number; condition?: string } {
    return typeof value === 'object' && value !== null && 'ac' in value;
  }

  getEntryText(entry: unknown): string {
    if (typeof entry === 'string') {
      return entry;
    }
    if (typeof entry === 'object' && entry !== null && 'text' in entry) {
      return String((entry as { text: unknown }).text);
    }
    return '';
  }

  private isMonsterSpellcasting(value: unknown): value is MonsterSpellcasting {
    return typeof value === 'object' && value !== null && 'name' in value;
  }

  getMonsterSpellcastingBlocks(
    spellcasting: Array<MonsterSpellcasting | unknown> | null | undefined
  ): MonsterSpellcasting[] {
    if (!spellcasting || spellcasting.length === 0) return [];
    return spellcasting.filter((item) => this.isMonsterSpellcasting(item)) as MonsterSpellcasting[];
  }

  hasSpellList(list: MonsterCasting[] | undefined): boolean {
    return Array.isArray(list) && list.length > 0;
  }

  hasSpellMap(map: Record<string, string[]> | undefined): boolean {
    return !!map && Object.keys(map).length > 0;
  }

  formatSpellAbility(ability: string): string {
    const map: Record<string, string> = {
      str: 'Strength',
      dex: 'Dexterity',
      con: 'Constitution',
      int: 'Intelligence',
      wis: 'Wisdom',
      cha: 'Charisma',
    };
    const key = ability.toLowerCase();
    return map[key] ?? ability;
  }

  formatSpellList(list: MonsterCasting[] | undefined): string {
    if (!list) return '';
    const textList = list
      .map((casting) => (typeof casting === 'string' ? casting : casting.entry ?? ''))
      .map((text) => text.trim())
      .filter((text) => text.length > 0);
    return this.formatSpellArray(textList);
  }

  formatSpellArray(list: string[] | undefined): string {
    if (!list || list.length === 0) return '';
    return list.map((text) => this.formatSpellText(text)).join(', ');
  }

  getSortedSpellKeys(map: Record<string, string[]> | undefined): string[] {
    if (!map) return [];
    return Object.keys(map).sort((a, b) => this.dailyKeySort(a) - this.dailyKeySort(b));
  }

  formatSpeeds(speeds: Record<string, number> | undefined): string {
    if (!speeds) return '—';
    const orderedKeys: Array<keyof typeof speeds> = ['walk', 'climb', 'swim', 'fly', 'burrow'];
    const parts = orderedKeys
      .map((key) => {
        const value = speeds[key];
        if (typeof value !== 'number') return null;
        const keyText = String(key);
        const label = keyText === 'walk' ? 'Walk' : keyText.charAt(0).toUpperCase() + keyText.slice(1);
        return `${label} ${value} ft.`;
      })
      .filter((part): part is string => Boolean(part));
    return parts.length ? parts.join(', ') : '—';
  }

  formatDailyLabel(key: string): string {
    const isEach = key.endsWith('e');
    const value = isEach ? key.slice(0, -1) : key;
    const count = Number(value);
    const base = Number.isFinite(count) ? `${count}/day` : `${value}/day`;
    return isEach ? `${base} each` : base;
  }

  formatKnownLabel(level: string): string {
    const levelInt = Number(level);
    if (!Number.isFinite(levelInt)) return `Level ${level}`;
    if (levelInt === 0) return 'Cantrips';
    if (levelInt === 1) return '1st level';
    if (levelInt === 2) return '2nd level';
    if (levelInt === 3) return '3rd level';
    if (levelInt >= 4 && levelInt <= 9) return `${levelInt}th level`;
    return `Level ${level}`;
  }

  formatSpellText(text: string): string {
    return text
      .replace(/\{@spell\s([^|}]+)(?:\|[^}]+)?\}/g, '$1')
      .replace(/\{@skill\s([^|}]+)(?:\|[^}]+)?\}/g, '$1')
      .replace(/\{@action\s([^|}]+)(?:\|[^}]+)?\}/g, '$1')
      .replace(/\{@condition\s([^|}]+)(?:\|[^}]+)?\}/g, '$1')
      .replace(/\{@damage\s([^}]+)\}/g, '$1')
      .replace(/\{@dice\s([^}]+)\}/g, '$1')
      .replace(/\{@dc\s([^}]+)\}/g, 'DC $1')
      .replace(/\{@hit\s([^}]+)\}/g, '+$1')
      .replace(/\{@variantrule\s([^|}]+)(?:\|[^}]+)?\}/g, '$1')
      .replace(/\{@book\s([^|}]+)(?:\|[^}]+)?\}/g, '$1')
      .replace(/\{@i\s([^}]+)\}/g, '$1')
      .replace(/\{@b\s([^}]+)\}/g, '$1')
      .replace(/\{@recharge\s([^}]+)\}/g, 'Recharge $1')
      .replace(/\{@actSave\s([^}]+)\}/g, '$1 save')
      .replace(/\{@actSaveFail\s([^}]+)\}/g, 'On fail: $1')
      .replace(/\{@actSaveSuccess\s([^}]+)\}/g, 'On success: $1')
      .replace(/\{@actSaveSuccessOrFail\s([^}]+)\}/g, '$1');
  }

  private dailyKeySort(key: string): number {
    const numeric = Number(key.replace(/e$/, ''));
    return Number.isFinite(numeric) ? numeric : Number.MAX_SAFE_INTEGER;
  }

  readonly getSizeText = sizeName;

  getInitiative(monster: Monster): string {
    if (!monster.entity) return '+0';
    
    // Base initiative is DEX modifier
    const dexMod = Math.floor(((monster.entity.dex ?? 10) - 10) / 2);
    let initiative = dexMod;
    
    // Add initiative bonus if it exists
    if (monster.entity.initiative?.bonus) {
      initiative += monster.entity.initiative.bonus;
    }
    
    // Add proficiency bonus if it exists
    if (monster.entity.initiative?.proficiency && monster.entity.cr) {
      const crValue = typeof monster.entity.cr === 'string' ? monster.entity.cr : monster.entity.cr.cr;
      const profBonus = this.getProficiencyBonusFromCR(crValue);
      initiative += monster.entity.initiative.proficiency * profBonus;
    }
    
    let result = initiative >= 0 ? `+${initiative}` : `${initiative}`;
    
    // Append advantage mode if it exists
    if (monster.entity.initiative?.advantageMode === 'advantage') {
      result += ' (Adv.)';
    }
    
    return result;
  }

  getProficiencyBonusFromCR(cr: string | number): number {
    let crValue: number;
    
    if (typeof cr === 'number') {
      crValue = cr;
    } else {
      // Parse string CR (e.g., "1/4", "1/2", "5", "10")
      if (cr.includes('/')) {
        const [numerator, denominator] = cr.split('/').map(Number);
        crValue = numerator / denominator;
      } else if (cr.includes('?')) {
        crValue = 0;
      } else {
        crValue = Number(cr);
      }
    }
    
    // Calculate proficiency bonus: floor((CR + 7) / 4)
    return 1 + (Math.ceil((Math.max(1, crValue)) / 4));
  }

  Object = Object;
}
