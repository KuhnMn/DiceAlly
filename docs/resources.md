# Resources & Reminders

Resources are authored under Feature (Re-)Sources alongside spell slots. Each has a
stable ID, source ID, name, viewer placement (Features, Spells, or both), explicit
recovery and a mode: uses, reminder, or uses with a reminder. Dice expressions and
rules text remain display text; the app does not evaluate them.

The viewer shares the Uses tracker. Pools of one to five show checkboxes; six or
more show remaining/total with spend and restore buttons. Spell slots now use the
same counter from six slots. Spell slots and resources share the same source-grouped
card layout, with one remaining/total count in the header and counter buttons
aligned right below it. Restoring is on the left and spending is on the right,
including Uses and hit dice. Resource notes have their own separated row.
Reminders never show a spend control. Category colors
match features and spellcasting. Pools survive source renames; removed sources
are labelled so the user can reassign their retained resources. New resources
start with their source's Features/Spellcasting selection; choosing another
source resets that initial placement to the new source. Existing resource
placement overrides are retained by the wizard. The editor uses the same blue
and purple category controls as feature sources.

Features and spells can link pools through the Resources tool beside Uses and
Notes. Each link defines an explicit positive cost. A feature shows its linked pool
and available balance beside one Use button, or a pool selector when several
resources are linked. Spending uses only the selected pool and its configured
cost. A spell offers linked pools in Casting Resource alongside slots and its
existing uses. Pools must be linked to each spell individually,
with a separate cost for that spell. Legacy source-wide casting settings are ignored.
Resource casts use the spell's base level; slot upcasting remains unchanged.
Each selection spends one chosen pool, never both a resource and a spell slot.
Spending resolves the latest pool, refuses invalid or insufficient costs and
commits atomically after existing preparation/concentration confirmations.

Recovery is manual by default. Short/long-rest and one-use recovery are explicit
choices; rests report restored resources and do not change reminder text. Pools,
used counts and links persist through local saves, cloud synchronization, portable
exports, native sheet projection and description refresh. Resource deletion
cleans its links; missing external links remain visible as missing resources and
cannot be spent.

The editor and wizard distinguish Resource, Resource with Reminder, and Reminder.
Resources track spendable uses; reminders only display a value or text. The editor's
Entry Type field uses these same names, with separate resource and reminder fields.

The wizard has an opt-in Import Resources & Reminders section. New free-form table columns
start unselected: a number alone does not establish a consumable resource.
Schema-defined spell-slot, fixed-spell-by-rank and optional-selection tables are
excluded. Mixed source tables also exclude explicit spell-slot counts, slot levels,
spell levels/ranks and spells learned or gained per level. Spellcasting count
progressions are offered as reminders. Explicit spell-count
headings (Cantrips, Cantrips Known, Spells Known, Known Spells, Prepared Spells,
Spells Prepared) also become reminders in source tables.
Matching ignores case and surrounding whitespace after source tags are removed;
partial keywords and matching numbers alone do not change other columns' types.
No columns are imported automatically. Previously imported entries remain selected.
Choose the columns to track: other literal nonnegative integer cells become resources;
structured dice cells and explicit numeric dice tags become reminders. A counter
can explicitly select a reminder from the same source to produce one combined
resource with reminder, keeping the counter's stable identity. Names can be authored freely.
Costs and recovery are never inferred. Mappings persist with the character.

For any remaining numeric column, Entry Type can switch between Resource and
Reminder, including before the column is selected. The chosen type persists in
the wizard mapping through saves, exports, reopening and level changes. Dice
expressions remain reminders and can be attached to a resource. Attachment choices
use the chosen types: a column converted to a resource cannot serve as an attached
reminder, and a column converted to a reminder no longer consumes an attachment.
Names, recovery and attachment drafts are retained when changing types.

Opening the wizard prefills each existing resource's current name, numeric entry type and recovery
from the editor, once per column. Later preview rebuilds preserve wizard drafts.
When combining two columns, a custom counter name wins; otherwise a custom
reminder name is carried over. An explicitly combined, unused reminder is removed
even when it was renamed. A reminder converted into an active tracker, or still
referenced by a feature or spell, remains separate to preserve that play state.

Selected resources are authoritative when applying the wizard: their table
values, mode, name and chosen recovery replace saved definitions. Selected deleted
resources are recreated. Spent counts, viewer placement, source assignments and
feature/spell links are retained for existing counters. Deselected resources are
not recreated; obsolete pools remain when edited, spent or still referenced.
