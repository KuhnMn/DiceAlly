import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { mapContent } from './content-adapter';
import { ContentReferenceIndex, linkContent } from './content-linker';
import { validateCoreDocument, validateHomebrewDocument } from './content-schema';
import { homebrewDocumentFixture } from './content-fixtures.testing';
import { facilityReferences } from './facility-references';
import { FacilityDetailsComponent } from '../sheet/facility-details.component';
import { BastionDefinition } from './bastion.model';

const facility: BastionDefinition = { version: 1, name: 'Ancient Altar', source: 'RHW', facilityType: 'special', level: 9, entries: [
  'You gain a {@reward Blasphemous Charm|RHW|Charm}.',
  'Roll on the {@book Bastion Hauntings table|RHW|3|Bastion Hauntings}.',
  'Read {@book chapter 3|RHW|3} and {@table Mounts and Vehicles; Mounts and Other Animals|XPHB|Mounts and Other Animals}.',
] };
const reward = { name: 'Blasphemous Charm', source: 'RHW', type: 'Charm', seeAlsoFacility: ['ancient altar|rhw'], entries: ['A magical charm.'] };

describe('Bastion reward and table references', () => {
  beforeAll(async () => {
    await validateCoreDocument({ reward: [reward] }, 'rewards.json');
    await validateHomebrewDocument(homebrewDocumentFixture({ reward: [reward] }), 'rewards-brew.json');
  }, 30000);
  it('imports schema-validated rewards and generated table groups with full contents and exact reference links in both directions', async () => {
    const rewards = { reward: [reward] };
    await validateCoreDocument(rewards, 'rewards.json');
    await validateHomebrewDocument(homebrewDocumentFixture(rewards), 'rewards-brew.json');
    const grouped = { table: [{ name: 'Ordinary', source: 'RHW', rows: [['Retained']] }], tableGroup: [{ name: 'Haunted Bastions', source: 'RHW', tables: [{ caption: 'Bastion Hauntings', colLabels: ['Effect'], rows: [['A ghost appears.']] }] }] };
    await validateCoreDocument(grouped, 'generated/gendata-tables.json');
    const before = structuredClone(grouped);
    const rows = [...mapContent(rewards, 'rewards.json').records, ...mapContent({ facility: [facility] }, 'bastions.json').records, ...mapContent(grouped, 'generated/gendata-tables.json').records];
    const index = new ContentReferenceIndex(); rows.forEach(row => index.add(row));
    const altar = rows.find(row => row.kind === 'facility')!, charm = rows.find(row => row.kind === 'reward')!, table = rows.find(row => row.name === 'Haunted Bastions')!;
    expect(table.kind).toBe('table'); expect(table.data['tables']).toEqual(grouped.tableGroup[0].tables); expect(grouped).toEqual(before);
    expect(linkContent(altar, index).links).toEqual(expect.arrayContaining([
      expect.objectContaining({ role: 'entry-reward', target: charm.key, status: 'resolved' }),
      expect.objectContaining({ role: 'entry-table', target: table.key, status: 'resolved' }),
    ]));
    expect(linkContent(charm, index).links).toContainEqual(expect.objectContaining({ role: 'related-facility', target: altar.key, status: 'resolved' }));
    expect(linkContent(altar, index).links.some(link => link.reference?.startsWith('chapter 3'))).toBe(false);
  });

  it('offers exact Compendium searches for referenced charms and tables without replacing the character tab', () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    expect(facilityReferences(facility)).toEqual([
      { category: 'reward', name: 'Blasphemous Charm', source: 'RHW' },
      { category: 'table', name: 'Bastion Hauntings', source: 'RHW' },
      { category: 'table', name: 'Mounts and Vehicles; Mounts and Other Animals', source: 'XPHB' },
    ]);
    const fixture = TestBed.createComponent(FacilityDetailsComponent);
    fixture.componentRef.setInput('facility', { editorId: 'altar', name: facility.name, source: facility.source, entity: facility }); fixture.detectChanges();
    const links = fixture.nativeElement.querySelectorAll('nav a') as NodeListOf<HTMLAnchorElement>;
    expect(links.length).toBe(3); expect(links[0].href).toContain('/compendium/reward?q=Blasphemous%20Charm&source=RHW'); expect(links[0].target).toBe('_blank');
  });
});
