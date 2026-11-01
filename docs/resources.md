# Source resources

Resources are authored under Feature Sources alongside spell slots. Each has a
stable ID, source ID, name, viewer placement (Features, Spells, or both), explicit
recovery and a mode: uses, reminder, or uses with a reminder. Dice expressions and
rules text remain display text; the app does not evaluate them.

The viewer shares the Uses tracker. Pools of one to five show checkboxes; six or
more show remaining/total with spend and restore buttons. Spell slots now use the
same counter from six slots. Reminders never show a spend control. Category colors
match features and spellcasting. Pools survive source renames; removed sources
are labelled so the user can reassign their retained resources.

Features and spells can link pools through the Resources tool beside Uses and
Notes. Each link defines an explicit positive cost. A feature offers a Use button
for each linked pool. A spell offers linked pools in Casting Resource alongside
slots and its existing uses. Pools must be linked to each spell individually,
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

The wizard has an opt-in Import class table values as resource reminders setting.
It copies only literal numeric cells, structured dice cells or explicit dice tags
at the selected class level, with stable IDs and normal wizard protection for
manual changes and removals. It never infers a pool, cost, recovery or usage rule
from prose, column names or a class/feature name. Convert an imported reminder to
Uses and Reminder and author its total and recovery when needed.
