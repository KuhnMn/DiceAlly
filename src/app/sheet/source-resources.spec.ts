import { TestBed } from '@angular/core/testing';
import { SourceResourcesComponent } from './source-resources.component';
import { CharacterStore } from '../stores/character.store';
import { emptyBasicCharacter } from '../editor/basic-info';

describe('Resource pool display',()=>{
  it('groups resource cards by source and keeps one header count, right-side spending and a separate note row',()=>{
    const sheet=emptyBasicCharacter();
    sheet.character!.featureSources=[{editorId:'rogue',name:'Rogue'},{editorId:'soulknife',name:'Soulknife'}];
    sheet.resources=[
      {id:'psi',sourceId:'soulknife',name:'Psionic Energy Dice',mode:'both',note:'D6\nA reminder',total:5,used:1,recovery:'LONG_REST',features:true,spells:true},
      {id:'small',sourceId:'soulknife',name:'Small Pool',mode:'counter',note:'',total:4,used:0,recovery:'SHORT_REST',features:true,spells:true},
      {id:'sneak',sourceId:'rogue',name:'Sneak Attack',mode:'note',note:'3d6',total:0,used:0,recovery:'NONE',features:true,spells:false},
    ];
    const store=TestBed.inject(CharacterStore);store.setCharacter(sheet);
    const fixture=TestBed.createComponent(SourceResourcesComponent);
    fixture.componentRef.setInput('sheet',sheet);fixture.componentRef.setInput('page','features');fixture.detectChanges();
    const cards=[...fixture.nativeElement.querySelectorAll('app-feature-uses')] as HTMLElement[];
    expect(fixture.componentInstance.groups.map(group=>group.sourceId)).toEqual(['soulknife','rogue']);
    expect(cards).toHaveLength(3);
    const card=cards[0], count=card.querySelector('output')!;
    expect(card.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);
    expect(card.querySelectorAll('output')).toHaveLength(1);expect(count.textContent).toContain('4 / 5');
    const note=card.querySelector('[aria-label="Psionic Energy Dice notes"]')!;
    expect(note.textContent).toContain('D6\nA reminder');
    expect(note.querySelector('button')).toBeNull();expect(note.querySelector('output')).toBeNull();
    const buttons=[...card.querySelectorAll('button')];
    expect(buttons.every(button => button.classList.contains('bg-blue-container'))).toBe(true);
    expect(cards[1].querySelector('input')!.classList.contains('accent-blue')).toBe(true);
    buttons[1].click();fixture.detectChanges();
    expect(store.characterData()!.resources![0].used).toBe(2);expect(count.textContent).toContain('3 / 5');
    buttons[0].click();fixture.detectChanges();expect(store.characterData()!.resources![0].used).toBe(1);
    expect(cards[1].querySelectorAll('input[type="checkbox"]')).toHaveLength(4);
    expect(cards[2].querySelector('output')).toBeNull();expect(cards[2].querySelector('button')).toBeNull();
    expect(cards[2].textContent).toContain('3d6');
    fixture.componentRef.setInput('page','spells');fixture.detectChanges();
    const spellCards = fixture.nativeElement.querySelectorAll('app-feature-uses');
    expect(spellCards[0].querySelector('button').classList.contains('bg-purple-container')).toBe(true);
    expect(spellCards[1].querySelector('input').classList.contains('accent-purple')).toBe(true);
    expect(spellCards[0].querySelector('output').textContent).toContain('4 / 5');
    fixture.destroy();
  });
});
