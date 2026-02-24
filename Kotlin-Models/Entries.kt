package com.ltx.data

import android.util.Log
import kotlinx.serialization.DeserializationStrategy
import kotlinx.serialization.KSerializer
import kotlinx.serialization.PolymorphicSerializer
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.descriptors.SerialDescriptor
import kotlinx.serialization.descriptors.buildClassSerialDescriptor
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonContentPolymorphicSerializer
import kotlinx.serialization.json.JsonDecoder
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonEncoder
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.JsonTransformingSerializer
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.encodeToJsonElement
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import kotlinx.serialization.modules.SerializersModule
import kotlinx.serialization.modules.polymorphic
import kotlinx.serialization.modules.subclass
import java.util.Locale.getDefault

@Serializable(with = EntrySerializer::class)
sealed interface Entry

/**
 * Represents a simple string entry.
 */
@Serializable
data class StringEntry(val text: String? = null) : Entry

/**
 * Represents a complex list entry, like the one in the "Alarm" spell.
 */
@Serializable // Tells the serializer that if type="list", use this class
@SerialName("list")
data class ListEntry(
    val style: String? = null,
    val items: List<Entry>
) : Entry

@Serializable
@SerialName("table")
data class TableEntry(
    val colLabels: List<String>,
    val rows: List<@Serializable(with = TableRowSerializer::class) TableRow>
) : Entry

@Serializable
sealed interface TableRow

@Serializable
@SerialName("simple")
data class SimpleTableRow(
    val cells: List<@Serializable(with = TableCellEntrySerializer::class) Entry>
) : TableRow

@Serializable
@SerialName("row")
data class StructuredTableRow(
    val style: String? = null,
    val row: List<Entry>
) : TableRow

@Serializable
@SerialName("cell")
data class CellTableRow(
    val width: Int? = null,
    val entry: Entry
) : TableRow

object TableRowSerializer : KSerializer<TableRow> {

    override val descriptor: SerialDescriptor =
        buildClassSerialDescriptor("TableRow")

    // ----------------------------
    // DESERIALIZATION
    // ----------------------------
    override fun deserialize(decoder: Decoder): TableRow {
        val input = decoder as? JsonDecoder
            ?: error("TableRowSerializer can only be used with JSON")

        val element = input.decodeJsonElement()

        return when (element) {

            // 1️⃣ Array-based rows
            is JsonArray -> {
                // CASE: [ { "type": "cell", ... } ]
                if (
                    element.size == 1 &&
                    element[0] is JsonObject &&
                    element[0].jsonObject["type"]?.jsonPrimitive?.content == "cell"
                ) {
                    input.json.decodeFromJsonElement(
                        CellTableRow.serializer(),
                        element[0]
                    )
                } else {
                    // CASE: simple row ["a", "b", "c"]
                    val cells = element.map {
                        input.json.decodeFromJsonElement(
                            TableCellEntrySerializer,
                            it
                        )
                    }
                    SimpleTableRow(cells)
                }
            }

            // 2️⃣ Object-based rows
            is JsonObject -> {
                when (element["type"]?.jsonPrimitive?.content) {
                    "row" -> input.json.decodeFromJsonElement(
                        StructuredTableRow.serializer(),
                        element
                    )
                    else -> error("Unknown table row object: $element")
                }
            }

            else -> error("Invalid table row format: $element")
        }
    }

    // ----------------------------
    // SERIALIZATION
    // ----------------------------
    override fun serialize(encoder: Encoder, value: TableRow) {
        val output = encoder as? JsonEncoder
            ?: error("TableRowSerializer can only be used with JSON")

        val json = when (value) {

            is SimpleTableRow -> JsonArray(
                value.cells.map {
                    output.json.encodeToJsonElement(
                        TableCellEntrySerializer,
                        it
                    )
                }
            )

            is CellTableRow -> JsonArray(
                listOf(
                    buildJsonObject {
                        put("type", JsonPrimitive("cell"))
                        value.width?.let { put("width", JsonPrimitive(it)) }
                        put(
                            "entry",
                            output.json.encodeToJsonElement(
                                TableCellEntrySerializer,
                                value.entry
                            )
                        )
                    }
                )
            )

            is StructuredTableRow -> buildJsonObject {
                put("type", JsonPrimitive("row"))
                value.style?.let { put("style", JsonPrimitive(it)) }
                put(
                    "row",
                    JsonArray(
                        value.row.map {
                            output.json.encodeToJsonElement(
                                TableCellEntrySerializer,
                                it
                            )
                        }
                    )
                )
            }
        }

        output.encodeJsonElement(json)
    }
}


@Serializable
@SerialName("refSubclassFeature")
data class RefSubclassEntry(
    val subclassFeature: String,
) : Entry

@Serializable
@SerialName("refClassFeature")
data class RefClassEntry(
    val classFeature: String,
) : Entry

@Serializable
@SerialName("refFeat")
data class RefFeatEntry(
    val feat: String,
) : Entry

@Serializable
@SerialName("refOptionalfeature")
data class RefOptionalEntry(
    val optionalfeature: String,
) : Entry

@Serializable
@SerialName("inset")
data class InsetEntry(
    val name: String,
    val entries: List<Entry>
) : Entry

@Serializable
@SerialName("abilityDC")
data class AbilityDCEntry(
    val name: String,
    val attributes: List<String>
) : Entry

@Serializable
@SerialName("abilityAttackMod")
data class AbilityAttackModEntry(
    val name: String,
    val attributes: List<String>
) : Entry

@Serializable
@SerialName("options")
data class OptionsEntry(
    val entries: List<Entry>
) : Entry

@Serializable
@SerialName("section")
data class SectionEntry(
    val entries: List<Entry>
) : Entry

@Serializable
@SerialName("entries")
data class EntriesEntry(
    val name: String? = null,
    val entries: List<Entry>,
    val data: EntryDataContent? = null
) : Entry

@Serializable
data class EntryDataContent(
    val overwrite: String
)

@Serializable
@SerialName("item")
data class ListItemEntry(
    val name: String,
    val entries: List<Entry>? = null,
    val entry: Entry? = null
): Entry

@Serializable
@SerialName("itemSpell")
data class ListItemSpellEntry(
    val name: String,
    val entries: List<Entry>? = null,
    val entry: Entry? = null
): Entry


// A custom serializer to handle the mixed-type (String or Object) array
object EntrySerializer : JsonTransformingSerializer<Entry>(PolymorphicSerializer(Entry::class)) {
    override fun transformDeserialize(element: JsonElement): JsonElement {
        // If the element is a plain string, wrap it in a JSON object
        // that our polymorphic deserializer can understand.
        if (element is JsonPrimitive && element.isString) {
            return buildJsonObject {
                // We don't need a "type" discriminator for StringEntry,
                // as the default case will handle it.
                put("text", element)
            }
        }
        // Otherwise, it's already an object, so return it as is.
        return element
    }
}

object TableCellEntrySerializer : JsonTransformingSerializer<Entry>(PolymorphicSerializer(Entry::class)) {
    override fun transformDeserialize(element: JsonElement): JsonElement {
        // Check if the element is a simple primitive (string or number).
        if (element is JsonPrimitive) {
            return buildJsonObject {
                // We don't need a "type" discriminator, as StringEntry is the default.
                // The `toString()` call safely handles both numbers and strings.
                put("text", JsonPrimitive(element.content))
            }
        }
        // Otherwise, it's already a complex object (like {"type": "entries", ...}), so return it as is.
        return element
    }
}

@Serializable(with = ListItemSerializer::class)
sealed interface ListItem

@Serializable
@SerialName("item")
data class ObjectListItem(
    val name: String,
    val entries: List<Entry>? = null,
    val entry: Entry? = null
): ListItem

@Serializable
@SerialName("list")
data class ListListItem(
    val style: String? = null,
    val items: List<ListItem>
): ListItem


@Serializable
@SerialName("itemSpell")
data class ObjectListItemSpell(
    val name: String,
    val entries: List<Entry>? = null,
    val entry: Entry? = null
): ListItem

@Serializable
data class StringListItem(val text: String) : ListItem


object ListItemSerializer : JsonTransformingSerializer<ListItem>(PolymorphicSerializer(ListItem::class)) {
    override fun transformDeserialize(element: JsonElement): JsonElement {
        // If the element is a plain string...
        if (element is JsonPrimitive && element.isString) {
            // ...wrap it into an object that our StringListItem class can deserialize.
            return buildJsonObject {
                put("text", element)
            }
        }
        // Otherwise, it's already a complex object for ItemEntry, so pass it through.
        return element
    }
}


// --- Detailed, Serializable Data Classes for Feat Properties ---

@Serializable
data class Prerequisite(
    // These fields are nullable as a prerequisite could be one of many types
    val level: RequisiteLevel? = null,
    val other: String? = null,
    val ability: List<AbilityScore>? = null,
    val feat: List<String>? = null,
    val feature: List<String>? = null,
    val race: List<RaceName>? = null,
    val campaign: List<String>? = null,
    val proficiency: List<Proficiency>? = null,
    val background: List<Background>? = null,
    val spell: List<RequisiteSpell>? = null,
    val item: List<String>? = null,
    val pact: String? = null,

    val otherSummary: OtherSummary? = null
    // You can add other prerequisite types like "race", "spellcasting", etc., here later
)

@Serializable
data class RaceName(
    val name: String
)

@Serializable
data class OtherSummary(
    val entrySummary: String
)


@Serializable
data class Proficiency(
    val armor: String? = null,
    val weapon: String? = null,
    val weaponGroup: String? = null
)

@Serializable
data class Background(
    val name: String,
    val displayEntry: String? = null
)

@Serializable
data class AbilityScore(
    val str: Int? = null,
    val dex: Int? = null,
    val con: Int? = null,
    val int: Int? = null,
    val wis: Int? = null,
    val cha: Int? = null,
)



@Serializable(with = LevelSerializer::class)
sealed interface RequisiteLevel

@Serializable
data class ObjectRequisiteLevel(
    val level: Int,
    @SerialName("class")
    val requisiteClass: RequisiteClass
): RequisiteLevel

@Serializable
@SerialName("simple")
data class SimpleRequisiteLevel(val level: Int) : RequisiteLevel

@Serializable
data class RequisiteClass(
    val name: String
)


object LevelSerializer : JsonTransformingSerializer<RequisiteLevel>(PolymorphicSerializer(RequisiteLevel::class)) {
    override fun transformDeserialize(element: JsonElement): JsonElement {
        // If the element is a plain string...
        if (element is JsonPrimitive) {
            // ...wrap it into an object that our StringListItem class can deserialize.
            return buildJsonObject {
                put("level", element.int)
                put("type", "simple")
            }
        }
        // Otherwise, it's already a complex object for ItemEntry, so pass it through.
        return element
    }
}

@Serializable(with = SpellSerializer::class)
sealed interface RequisiteSpell

@Serializable
data class ObjectRequisiteSpell(
    val choose: String,
    val entry: String,
    val entrySummary: String
): RequisiteSpell

@Serializable
@SerialName("simple")
data class SimpleRequisiteSpell(
    val spellName: String
): RequisiteSpell


// --- Custom Serializer for Level ---


object SpellSerializer : JsonTransformingSerializer<RequisiteSpell>(PolymorphicSerializer(RequisiteSpell::class)) {
    override fun transformDeserialize(element: JsonElement): JsonElement {
        // If the element is a plain string, wrap it in a JSON object
        // that our polymorphic deserializer can understand.
        if (element is JsonPrimitive && element.isString) {
            return buildJsonObject {
                // We don't need a "type" discriminator for StringEntry,
                // as the default case will handle it.
                put("spellName", element)
                put("type", "simple")
            }
        }
        // Otherwise, it's already an object, so return it as is.
        return element
    }
}


// --- File Parsing Function ---



/**
 * Formats the list of prerequisite objects into a readable string.
 */
fun List<Prerequisite>.toPrerequisiteText(): String {
    if (this.isEmpty()) return "None"

    // Join multiple prerequisites with " or "
    return this.joinToString(" or ") { prereq ->
        val parts = mutableListOf<String>()
        prereq.level?.let { levelObject -> // Renamed for clarity
            val levelString = when (levelObject) {
                // Access levelObject.level here
                is SimpleRequisiteLevel -> "Level ${levelObject.level}"
                // And access levelObject.level here
                is ObjectRequisiteLevel -> "Level ${levelObject.level} (${levelObject.requisiteClass.name})"
            }
            parts.add(levelString)
        }
        prereq.other?.let { parts.add(it) }
        prereq.ability?.let { abilities ->
            abilities.forEach { ability ->
                val abilityText = when {
                    ability.str != null -> "Strength ${ability.str}"
                    ability.dex != null -> "Dexterity ${ability.dex}"
                    ability.con != null -> "Constitution ${ability.con}"
                    ability.int != null -> "Intelligence ${ability.int}"
                    ability.wis != null -> "Wisdom ${ability.wis}"
                    ability.cha != null -> "Charisma ${ability.cha}"
                    else -> null
                }
                if (abilityText != null) parts.add(abilityText)
            }
        }
        // 3. Handle Race
        prereq.race?.let { races ->
            parts.add(races.joinToString(" or ") { it.name })
        }

        // 4. Handle Proficiency
        prereq.proficiency?.forEach { prof ->
            val profText = when {
                prof.armor != null -> "Prof.with ${prof.armor}"
                prof.weapon != null -> "Prof. with ${prof.weapon}"
                prof.weaponGroup != null -> "Prof. with ${prof.weaponGroup} weapons"
                else -> null
            }
            if (profText != null) parts.add(profText)
        }

        // 5. Handle Pact (e.g., Pact of the Blade)
        prereq.pact?.let { pacts ->
            parts.add("Pact: $pacts")
        }

        // --- START OF NEWLY ADDED LOGIC ---

        // 6. Handle Campaign
        prereq.campaign?.let { campaigns ->
            parts.add("Campaign: ${campaigns.joinToString()}")
        }

        // 7. Handle Item
        prereq.item?.let { items ->
            parts.add("Item: ${items.joinToString()}")
        }

        var spellStrings = ArrayList<String>()
        // 8. Handle Spellcasting ability
        prereq.spell?.forEach { spellObject ->
            val spellString = when (spellObject) {
                // Access levelObject.level here
                is SimpleRequisiteSpell -> spellObject.spellName
                // And access levelObject.level here
                is ObjectRequisiteSpell -> spellObject.entrySummary
            }
            spellStrings.add(spellString)
        }
        if (spellStrings.isNotEmpty()) {
            parts.add("Spell: ${spellStrings.joinToString(" or ")}")
        }

        // 9. Handle Background
        prereq.background?.let { backgrounds ->
            parts.add("Background: ${backgrounds.joinToString { it.name }}")
        }

        // 10. Handle another Feat
        prereq.feat?.let { feats ->
            parts.add("Feat: ${feats.joinToString(" or ") { 
                featString -> val splitFeat = featString.split("|")
                (splitFeat[0].replaceFirstChar { if (it.isLowerCase()) it.titlecase(getDefault()) else it.toString() } + if (splitFeat.size > 2) " (${
                    splitFeat[2].replaceFirstChar {
                        if (it.isLowerCase()) it.titlecase(
                            getDefault()
                        ) else it.toString()
                    }
                })" else "")
            }}")
        }

        // 7. Handle Item
        prereq.feature?.let { features ->
            parts.add("Feature: ${features.joinToString()}")
        }

        prereq.otherSummary?.let { summaries ->
            parts.add(summaries.entrySummary)
        }

        // 6. Handle other simple text prerequisites
        prereq.other?.let { parts.add(it) }

        // Join all the parts of a single prerequisite group with ", "
        if (parts.isEmpty()) "Special" else parts.joinToString(", ")
    }
}

val lenientJson = Json {
    ignoreUnknownKeys = true
    isLenient = true
    coerceInputValues = true
    // This part is new and crucial for polymorphism
    serializersModule = SerializersModule {

        polymorphic(Entry::class) {
            // Register the class for a complex list entry
            subclass(ListEntry.serializer())
            subclass(EntriesEntry.serializer())
            subclass(TableEntry.serializer())
            subclass(StringEntry.serializer())
            subclass(RefSubclassEntry.serializer())
            subclass(RefFeatEntry.serializer())
            subclass(RefClassEntry.serializer())
            subclass(RefOptionalEntry.serializer())
            subclass(InsetEntry.serializer())
            subclass(AbilityDCEntry.serializer())
            subclass(AbilityAttackModEntry.serializer())
            subclass(OptionsEntry.serializer())
            subclass(SectionEntry.serializer())
            subclass(ListItemEntry.serializer())
            subclass(ListItemSpellEntry.serializer())
            // Use StringEntry as the default for any object that doesn't match other subclasses
            defaultDeserializer { StringEntry.serializer() }
        }
        polymorphic(MaterialComponent::class) {
            // Register the class for a complex list entry
            subclass(DetailedMaterial.serializer())
            subclass(SimpleMaterial.serializer())
            // Use StringEntry as the default for any object that doesn't match other subclasses
            defaultDeserializer { SimpleMaterial.serializer() }
        }

        polymorphic(TableRow::class) {
            subclass(SimpleTableRow.serializer())
            subclass(CellTableRow.serializer())
            subclass(StructuredTableRow.serializer())
            defaultDeserializer { SimpleTableRow.serializer() }
        }

        polymorphic(ListItem::class) {
            // If the object has "type": "item", use ItemEntry
            subclass(ObjectListItem.serializer())
            subclass(StringListItem.serializer())
            subclass(ObjectListItemSpell.serializer())
            subclass(ListListItem.serializer())
            // For anything else (like our wrapped string), use StringListItem
            defaultDeserializer { StringListItem.serializer() }
        }

        polymorphic(RequisiteLevel::class) {
            // If the object has "type": "item", use ItemEntry
            subclass(ObjectRequisiteLevel.serializer())
            subclass(SimpleRequisiteLevel.serializer())
            // For anything else (like our wrapped string), use StringListItem
            defaultDeserializer { ObjectRequisiteLevel.serializer() }
        }

        polymorphic(RequisiteSpell::class) {
            // If the object has "type": "item", use ItemEntry
            subclass(ObjectRequisiteSpell.serializer())
            subclass(SimpleRequisiteSpell.serializer())
            // For anything else (like our wrapped string), use StringListItem
            defaultDeserializer { ObjectRequisiteSpell.serializer() }
        }

        polymorphic(MonsterImmune::class) {
            // If the object has "type": "item", use ItemEntry
            subclass(MonsterImmuneObject.serializer())
            subclass(MonsterImmuneString.serializer())
            // For anything else (like our wrapped string), use StringListItem
            defaultDeserializer { MonsterImmuneObject.serializer() }
        }

        polymorphic(MonsterConditionImmune::class) {
// If the object has "type": "item", use ItemEntry
            subclass(MonsterConditionImmuneObject.serializer())
            subclass(MonsterConditionImmuneString.serializer())
// For anything else (like our wrapped string), use StringListItem
            defaultDeserializer { MonsterConditionImmuneObject.serializer() }
        }

        polymorphic(MonsterResist::class) {
            // If the object has "type": "item", use ItemEntry
            subclass(MonsterResistObject.serializer())
            subclass(MonsterResistString.serializer())
            // For anything else (like our wrapped string), use StringListItem
            defaultDeserializer { MonsterResistObject.serializer() }
        }

        polymorphic(MonsterVulnerable::class) {
            // If the object has "type": "item", use ItemEntry
            subclass(MonsterVulnerableObject.serializer())
            subclass(MonsterVulnerableString.serializer())
            // For anything else (like our wrapped string), use StringListItem
            defaultDeserializer { MonsterVulnerableObject.serializer() }
        }

        polymorphic(MonsterAlignment::class) {
            // If the object has "type": "item", use ItemEntry
            subclass(MonsterAlignmentObject.serializer())
            subclass(MonsterAlignmentString.serializer())
            // For anything else (like our wrapped string), use StringListItem
            defaultDeserializer { MonsterAlignmentObject.serializer() }
        }

        polymorphic(MonsterSkillValue::class) {
            // If the object has "type": "item", use ItemEntry
            subclass(MonsterSkillValueList.serializer())
            subclass(MonsterSkillValueString.serializer())
            // For anything else (like our wrapped string), use StringListItem
            defaultDeserializer { MonsterSkillValueList.serializer() }
        }

        polymorphic(MonsterCasting::class) {
            // If the object has "type": "item", use ItemEntry
            subclass(MonsterCastingObject.serializer())
            // For anything else (like our wrapped string), use StringListItem
            defaultDeserializer { MonsterCastingObject.serializer() }
        }

        // For ItemReference (from RPGClass.kt)
        polymorphic(ItemReference::class) {
            subclass(ItemReferenceString.serializer())
            subclass(ItemReferenceObject.serializer())
            defaultDeserializer { ItemReferenceString.serializer() }
        }

        // For ClassTableCell (from RPGClass.kt)
        polymorphic(ClassTableCell::class) {
            subclass(StringTableCell.serializer())
            subclass(DiceTableCell.serializer())
            defaultDeserializer { StringTableCell.serializer() }
        }

        // For ClassFeatureItem (from RPGClass.kt)
        polymorphic(ClassFeatureItem::class) {
            subclass(ClassFeatureString.serializer())
            subclass(ClassFeatureObject.serializer())
            defaultDeserializer { ClassFeatureString.serializer() }
        }

        polymorphic(ProficiencyItem::class) {
            subclass(ProficiencyString.serializer())
            subclass(ProficiencyObject.serializer())
            defaultDeserializer { ProficiencyString.serializer() }
        }

    }
}