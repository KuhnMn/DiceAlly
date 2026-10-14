// Report structural rule metadata from pinned public content; save no corpus.
const commit = '8c026b807fac21862a309379a0c3228a0683198b';
const root = `https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/${commit}/data/`;
async function get(file) { const r = await fetch(root + file); if (!r.ok) throw new Error(`${file}: ${r.status}`); return r.json(); }
if (process.argv.includes('--abilities')) {
  const data = await get('races.json'); const shapes = new Map();
  for (const kind of ['race','subrace']) for (const record of data[kind] ?? []) if (record.ability) {
    const key = JSON.stringify(record.ability); shapes.set(key,(shapes.get(key) ?? 0)+1);
  }
  console.log(JSON.stringify({ commit,abilityShapeCount: shapes.size,abilityShapes: [...shapes] }));
} else if (process.argv.includes('--innate')) {
  const frequencies = new Set(); const resources = []; const casts = [];
  const classIndex = await get('class/index.json');
  const files = ['races.json','feats.json','optionalfeatures.json',...new Set(Object.values(classIndex).map(f => 'class/'+f))];
  function scan(value,resourceName) {
    if (Array.isArray(value)) return value.forEach(v => scan(v,resourceName));
    if (!value || typeof value !== 'object') return;
    for (const [key,child] of Object.entries(value)) {
      if (['will','daily','rest','restLong','resource','ritual','constant'].includes(key)) frequencies.add(key);
      if (key === 'resource' && resources.length < 8) resources.push({ resourceName,value: child });
      if (key === 'casts' && casts.length < 8) casts.push(child);
      scan(child,resourceName);
    }
  }
  for (const file of files) for (const records of Object.values(await get(file))) if (Array.isArray(records)) for (const record of records) {
    for (const block of record.additionalSpells ?? []) scan(block.innate,block.resourceName);
  }
  console.log(JSON.stringify({ commit,frequencies: [...frequencies],resources,casts }));
} else if (process.argv.includes('--proficiencies')) {
  const groups = {};
  const add = (field,value) => { if (value !== undefined) { const json = JSON.stringify(value); const group = groups[field] ??= new Map(); group.set(json,(group.get(json) ?? 0)+1); } };
  const races = await get('races.json');
  for (const kind of ['race','subrace']) for (const record of races[kind] ?? []) for (const field of ['skillProficiencies','languageProficiencies','toolProficiencies','armorProficiencies','weaponProficiencies']) add(field,record[field]);
  const classes = await get('class/index.json');
  for (const file of new Set(Object.values(classes))) for (const record of (await get('class/'+file)).class ?? []) {
    for (const field of ['armor','weapons','tools','skills']) { add('starting.'+field,record.startingProficiencies?.[field]); add('multiclass.'+field,record.multiclassing?.proficienciesGained?.[field]); }
  }
  console.log(JSON.stringify({ commit,groups: Object.fromEntries(Object.entries(groups).map(([field,group]) => [field,[...group]])) }));
} else {
const optionals = (await get('optionalfeatures.json')).optionalfeature;
const prerequisiteFields = {};
for (const optional of optionals) for (const block of optional.prerequisite ?? []) for (const field of Object.keys(block)) prerequisiteFields[field] = (prerequisiteFields[field] ?? 0) + 1;
const shapes = {};
for (const optional of optionals) for (const block of optional.prerequisite ?? []) for (const [field,value] of Object.entries(block)) (shapes[field] ??= []).length < 2 && shapes[field].push(value);
const index = await get('class/index.json'); const progressions = [];
for (const file of new Set(Object.values(index))) {
  const data = await get('class/' + file);
  for (const kind of ['class','subclass']) for (const record of data[kind] ?? []) if (record.optionalfeatureProgression) {
    progressions.push({ kind,name: record.name,progression: record.optionalfeatureProgression });
  }
}
console.log(JSON.stringify({ commit,prerequisiteFields,shapes,progressions: progressions.slice(0,8),progressionCount: progressions.length }));
}
