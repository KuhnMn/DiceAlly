import { deriveSpeciesAbilities } from './ability-rules';
import { ContentRecord } from '../content/content.model';
const base = { str: 10,dex: 14,con: 14,int: 12,wis: 10,cha: 10 };
function index(ability: unknown) {
  const record: ContentRecord = { key: 'species',kind: 'species',name: 'Test',publication: 'TEST',file: 'synthetic',data: { ability },links: [] };
  return { sourceIdentity: 'source',revisionId: 'revision',records: new Map([[record.key,record]]) };
}
describe('Species ability contributions', () => {
  it('separates base scores from generated fixed bonuses and preserves opt-out', () => {
    const content = index([{ con: 2,int: -2 }]);
    const result = deriveSpeciesAbilities(base,content,{ id: 'selection',key: 'species' },true);
    expect(result.canAccept).toBe(true); expect(result.effective.con).toBe(16); expect(result.effective.int).toBe(10);
    expect(result.base).toEqual(base); expect(result.contributions).toHaveLength(2);
    expect(deriveSpeciesAbilities(base,content,{ id: 'selection',key: 'species' },false).effective).toEqual(base);
    result.base.con = 20; expect(base.con).toBe(14);
  });
  it('requires explicit alternatives and distinct eligible allocations', () => {
    const content = index([{ con: 2 },{ choose: { from: ['str','dex','con'],count: 2,amount: 1 } }]);
    expect(deriveSpeciesAbilities(base,content,{ id: 'selection',key: 'species' },true).canAccept).toBe(false);
    const result = deriveSpeciesAbilities(base,content,{ id: 'selection',key: 'species' },true,{ optionIndex: 1,chosen: ['str','dex'] });
    expect(result.canAccept).toBe(true); expect(result.effective.str).toBe(11); expect(result.effective.dex).toBe(15);
    expect(deriveSpeciesAbilities(base,content,{ id: 'selection',key: 'species' },true,{ optionIndex: 1,chosen: ['str','str'] }).canAccept).toBe(false);
    expect(deriveSpeciesAbilities(base,content,{ id: 'selection',key: 'species' },true,{ optionIndex: 1,chosen: ['wis','cha'] }).canAccept).toBe(false);
  });
  it('supports omitted count/amount defaults, and rejects unsupported shapes or invalid scores', () => {
    const chosen = deriveSpeciesAbilities(base,index([{ choose: { from: ['wis','cha'] } }]),{ id: 'selection',key: 'species' },true,{ chosen: ['wis'] });
    expect(chosen.effective.wis).toBe(11);
    expect(deriveSpeciesAbilities(base,index([{ choose: { weighted: { from: ['str','dex'],weights: [2,1] } } }]),{ id: 'selection',key: 'species' },true).canAccept).toBe(false);
    expect(deriveSpeciesAbilities({ ...base,str: 1 },index([{ str: -4 }]),{ id: 'selection',key: 'species' },true).canAccept).toBe(false);
  });
});
