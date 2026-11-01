# Source resources

Resources are authored under Feature (Re-)Sources alongside spell slots. Each has a
stable ID, source ID, name, viewer placement (Features, Spells, or both), explicit
recovery and a mode: uses, reminder, or uses with a reminder. Dice expressions and
rules text remain display text; the app does not evaluate them.

The viewer shares the Uses tracker. Pools of one to five show checkboxes; six or
more show remaining/total with spend and restore buttons. Spell slots now use the
same counter from six slots. Reminders never show a spend control. Category colors
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

The wizard has an opt-in Import Resources section. New free-form table columns
start unselected: a number alone does not establish a consumable resource.
Schema-defined spell-slot, spell-progression and optional-selection tables are
excluded. Other columns, including spell counts embedded in free-form tables,
are never imported automatically. Previously imported entries remain selected.
Choose the columns to track: literal nonnegative integer cells become counters;
structured dice cells and explicit numeric dice tags become reminders. A counter
can explicitly select a reminder from the same source to produce one combined
resource, keeping the counter's stable identity. Names can be authored freely.
Costs and recovery are never inferred. Mappings persist with the character.

Opening the wizard prefills each existing resource's current name and recovery
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
