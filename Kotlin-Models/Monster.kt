package com.ltx.data

import android.content.Context
import android.net.Uri
import android.util.Log
import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.KSerializer
import kotlinx.serialization.PolymorphicSerializer
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.descriptors.SerialDescriptor
import kotlinx.serialization.descriptors.buildClassSerialDescriptor
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder
import kotlinx.serialization.json.*
import kotlinx.serialization.json.int
import java.io.BufferedReader

@Serializable
data class MonsterDataWrapper(
    val monster: List<Monster>
)

@Serializable
data class Monster(
    val name: String,
    val source: String,
    val page: Int? = 0,
    val size: List<String>? = null, // e.g. ["G"]

    // Handles "type": "beast" OR "type": { "type": "dragon", "tags": [...] }
    @Serializable(with = MonsterTypeSerializer::class)
    val type: MonsterType = MonsterType("unknown"),

    val alignment: List<MonsterAlignment>? = null,

    // AC is always a list, but items can be Ints or Objects
    val ac: List<MonsterAC>? = null,

    val hp: MonsterHP? = null,

    // Reusing your existing Speeds class from Species.kt
    @Serializable(with = SpeedsSerializer::class)
    val speed: Speeds? = null,

    // Ability Scores
    val str: Int? = 10,
    val dex: Int? = 10,
    val con: Int? = 10,
    val int: Int? = 10,
    val wis: Int? = 10,
    val cha: Int? = 10,

    val save: Map<String, String>? = null,
    val skill: Map<String, MonsterSkillValue>? = null,

    val senses: List<String>? = null,
    @Serializable(with = MonsterPassiveSerializer::class)
    val passive: String? = null,

    val immune: List<MonsterImmune>? = null, // Simplified for now
    val resist: List<MonsterResist>? = null,
    val vulnerable: List<MonsterVulnerable>? = null,
    val conditionImmune: List<MonsterConditionImmune>? = null,
    val languages: List<String>? = null,

    // Handles "cr": "1/4" OR "cr": { "cr": "21", "xpLair": ... }
    @Serializable(with = MonsterCRSerializer::class)
    val cr: MonsterCR = MonsterCR("?"),

    val spellcasting: List<MonsterSpellcasting>? = null,

    // Traits and Actions reuse your polymorphic Entry system
    val trait: List<MonsterTrait>? = null,
    val action: List<MonsterTrait>? = null,
    val legendary: List<MonsterTrait>? = null,
    val reaction: List<MonsterTrait>? = null,

    val legendaryActionsLair: Int? = null,
    val environment: List<String>? = null,
    val hasToken: Boolean? = false,
    val hasFluff: Boolean? = false

) {
    fun toEntity(): MonsterEntity {
        return MonsterEntity(
            name = this.name,
            source = this.source,
            page = this.page ?: 0,
            size = this.size,
            type = this.type,
            alignment = this.alignment?.map { if (it is MonsterAlignmentString) it.text else if (it is MonsterAlignmentObject) it.alignment?.joinToString("")?: "Other" else it.toString()},
            ac = this.ac,
            hp = this.hp,
            speed = this.speed,
            str = this.str ?: 10,
            dex = this.dex ?: 10,
            con = this.con ?: 10,
            int = this.int ?: 10,
            wis = this.wis ?: 10,
            cha = this.cha ?: 10,
            save = this.save,
            skill = this.skill.toDisplaySkillMap(),
            senses = this.senses,
            passive = this.passive ?: "?",
            immune = this.immune,
            resist = this.resist,
            conditionImmune = this.conditionImmune,
            languages = this.languages,
            cr = this.cr, spellcasting = this.spellcasting,
            trait = this.trait,
            action = this.action,
            legendary = this.legendary,
            reaction = this.reaction,
            legendaryActionsLair = this.legendaryActionsLair,
            environment = this.environment,
            hasToken = this.hasToken ?: false,
            hasFluff = this.hasFluff ?: false,
            vulnerable = this.vulnerable
        )
    }
}

// --- Helper Data Classes ---

@Serializable
data class MonsterType(
    val type: String,
    val tags: List<String>? = null
)

@Serializable(with = MonsterImmuneSerializer::class)
sealed interface MonsterImmune

@Serializable
@SerialName("string_immune")
data class MonsterImmuneString(val text: String) : MonsterImmune

@Serializable
data class MonsterImmuneObject(
    val immune: List<MonsterImmune>,
    val note: String? = null,
    val cond: Boolean? = null,
    val special: String? = null
): MonsterImmune

object MonsterImmuneSerializer : JsonTransformingSerializer<MonsterImmune>(PolymorphicSerializer(MonsterImmune::class)) {
    override fun transformDeserialize(element: JsonElement): JsonElement {
        // If the element is a plain string, wrap it in a JSON object
        // that our polymorphic deserializer can understand.
        if (element is JsonPrimitive && element.isString) {
            return buildJsonObject {
                // We don't need a "type" discriminator for StringEntry,
                // as the default case will handle it.
                put("type", "string_immune")
                put("text", element)
            }
        }
        // Otherwise, it's already an object, so return it as is.
        return element
    }
}

@Serializable(with = MonsterAlignmentSerializer::class)
sealed interface MonsterAlignment

@Serializable
@SerialName("string_align")
data class MonsterAlignmentString(val text: String) : MonsterAlignment

@Serializable
data class MonsterAlignmentObject(
    val alignment: List<String>? = null,
    val change: Int? = null
): MonsterAlignment

object MonsterAlignmentSerializer : JsonTransformingSerializer<MonsterAlignment>(PolymorphicSerializer(MonsterAlignment::class)) {
    override fun transformDeserialize(element: JsonElement): JsonElement {
        // If the element is a plain string, wrap it in a JSON object
        // that our polymorphic deserializer can understand.
        if (element is JsonPrimitive && element.isString) {
            return buildJsonObject {
                // We don't need a "type" discriminator for StringEntry,
                // as the default case will handle it.
                put("type", "string_align")
                put("text", element)
            }
        }
        // Otherwise, it's already an object, so return it as is.
        return element
    }
}

@Serializable(with = MonsterSkillValueSerializer::class)
sealed interface MonsterSkillValue

@Serializable
@SerialName("string_skill")
data class MonsterSkillValueString(val text: String) : MonsterSkillValue

@Serializable
@SerialName("list_skill")
data class MonsterSkillValueList(
    val list: List<MonsterSkillChoiceObject>? = null
): MonsterSkillValue


@Serializable
data class MonsterSkillChoiceObject(
    val oneOf: Map<String, MonsterSkillValue>? = null
)

object MonsterSkillValueSerializer : JsonTransformingSerializer<MonsterSkillValue>(PolymorphicSerializer(MonsterSkillValue::class)) {
    override fun transformDeserialize(element: JsonElement): JsonElement {
        // If the element is a plain string, wrap it in a JSON object
        // that our polymorphic deserializer can understand.
        if (element is JsonPrimitive && element.isString) {
            return buildJsonObject {
                // We don't need a "type" discriminator for StringEntry,
                // as the default case will handle it.
                put("type", "string_skill")
                put("text", element)
            }
        } else if (element is JsonArray) {
            return buildJsonObject {
                put("type", "list_skill")
                put("list", element)
            }
        }
        // Otherwise, it's already an object, so return it as is.
        return element
    }
}

fun Map<String, MonsterSkillValue>?.toDisplaySkillMap(): Map<String, String> {
    if (this.isNullOrEmpty()) return emptyMap()

    return mapValues { (_, value) ->
        when (value) {
            is MonsterSkillValueString -> {
                value.text
            }

            is MonsterSkillValueList -> {
                value.list
                    .orEmpty()
                    .flatMap { choice ->
                        choice.oneOf
                            .orEmpty()
                            .values
                            .mapNotNull { skillValue ->
                                when (skillValue) {
                                    is MonsterSkillValueString -> skillValue.text
                                    is MonsterSkillValueList -> null // nested lists ignored
                                }
                            }
                    }
                    .distinct()
                    .joinToString(" / ")
            }
        }
    }
}

@Serializable(with = MonsterConditionImmuneSerializer::class)
sealed interface MonsterConditionImmune

@Serializable
@SerialName("string_condition_immune")
data class MonsterConditionImmuneString(val text: String) : MonsterConditionImmune

@Serializable
data class MonsterConditionImmuneObject(
    val conditionImmune: List<MonsterConditionImmune>?,
    val note: String? = null,
    val cond: Boolean? = null,
    val special: String? = null
): MonsterConditionImmune

object MonsterConditionImmuneSerializer : JsonTransformingSerializer<MonsterConditionImmune>(PolymorphicSerializer(MonsterConditionImmune::class)) {
    override fun transformDeserialize(element: JsonElement): JsonElement {
// If the element is a plain string, wrap it in a JSON object
// that our polymorphic deserializer can understand.
        if (element is JsonPrimitive && element.isString) {
            return buildJsonObject {
// We don't need a "type" discriminator for StringEntry,
// as the default case will handle it.
                put("type", "string_condition_immune")
                put("text", element)
            }
        }
// Otherwise, it's already an object, so return it as is.
        return element
    }
}




@Serializable(with = MonsterResistSerializer::class)
sealed interface MonsterResist

@Serializable
@SerialName("string_resist")
data class MonsterResistString(val text: String) : MonsterResist

@Serializable
data class MonsterResistObject(
    val resist: List<MonsterResist>? = listOf(),
    val note: String? = null,
    val cond: Boolean? = null,
    val special: String? = null
): MonsterResist

object MonsterResistSerializer : JsonTransformingSerializer<MonsterResist>(PolymorphicSerializer(MonsterResist::class)) {
    override fun transformDeserialize(element: JsonElement): JsonElement {
        // If the element is a plain string, wrap it in a JSON object
        // that our polymorphic deserializer can understand.
        if (element is JsonPrimitive && element.isString) {
            return buildJsonObject {
                // We don't need a "type" discriminator for StringEntry,
                // as the default case will handle it.
                put("type", "string_resist")
                put("text", element)
            }
        }
        // Otherwise, it's already an object, so return it as is.
        return element
    }
}

@Serializable(with = MonsterVulnerableSerializer::class)
sealed interface MonsterVulnerable

@Serializable
@SerialName("string_Vulnerable")
data class MonsterVulnerableString(val text: String) : MonsterVulnerable

@Serializable
data class MonsterVulnerableObject(
    val vulnerable: List<MonsterVulnerable>? = listOf(),
    val note: String? = null,
    val cond: Boolean? = null,
    val special: String? = null
): MonsterVulnerable

object MonsterVulnerableSerializer : JsonTransformingSerializer<MonsterVulnerable>(PolymorphicSerializer(MonsterVulnerable::class)) {
    override fun transformDeserialize(element: JsonElement): JsonElement {
        // If the element is a plain string, wrap it in a JSON object
        // that our polymorphic deserializer can understand.
        if (element is JsonPrimitive && element.isString) {
            return buildJsonObject {
                // We don't need a "type" discriminator for StringEntry,
                // as the default case will handle it.
                put("type", "string_Vulnerable")
                put("text", element)
            }
        }
        // Otherwise, it's already an object, so return it as is.
        return element
    }
}


@Serializable
data class MonsterHP(
    val average: Int? = null,
    val formula: String? = null,
    val special: String? = null
)

@Serializable(with = MonsterACSerializer::class)
data class MonsterAC(
    val ac: Int,
    val from: List<String>? = null,
    val condition: String? = null,
    val braces: Boolean? = false
)

@Serializable(with = MonsterCRSerializer::class)
data class MonsterCR(
    val cr: String,
    val xp: Int? = null,
    val xpLair: Int? = null
)

@Serializable
data class MonsterTrait(
    val name: String? = null,
    // Reusing your Entry class to handle strings, lists, or objects in entries
    val entries: List<Entry>? = null
)

@Serializable
data class MonsterSpellcasting(
    val name: String,
    val type: String? = null, // "spellcasting", "innate"
    val headerEntries: List<String>? = null,
    val ability: String? = null, // "cha", "int"
    val displayAs: String? = null,

    // Lists of spell strings (e.g., "{@spell Fireball}")
    val will: List<MonsterCasting>? = null,
    // Daily is a map because keys are dynamic: "1", "1e", "3", "3e"
    val daily: Map<String, List<String>>? = null,
    // Known is for standard casting: "1" (level 1), "2" (level 2)
    val known: Map<String, List<String>>? = null
)


@Serializable(with = MonsterCastingSerializer::class)
sealed interface MonsterCasting

@Serializable
data class MonsterCastingObject(
    val entry: String? = null
): MonsterCasting

object MonsterCastingSerializer : JsonTransformingSerializer<MonsterCasting>(PolymorphicSerializer(MonsterCasting::class)) {
    override fun transformDeserialize(element: JsonElement): JsonElement {
        // If the element is a plain string, wrap it in a JSON object
        // that our polymorphic deserializer can understand.
        if (element is JsonPrimitive && element.isString) {
            return buildJsonObject {
                // We don't need a "type" discriminator for StringEntry,
                // as the default case will handle it.
                put("entry", element)
            }
        }

        // Otherwise, it's already an object, so return it as is.
        return element
    }
}

// --- Serializers for Mixed Types ---

object MonsterTypeSerializer : KSerializer<MonsterType> {
    override val descriptor: SerialDescriptor = buildClassSerialDescriptor("MonsterType")

    override fun deserialize(decoder: Decoder): MonsterType {
        val input = decoder as? JsonDecoder ?: throw IllegalStateException("This serializer can only be used with JSON")
        val element = input.decodeJsonElement()

        return if (element is JsonPrimitive && element.isString) {
            MonsterType(type = element.content)
        } else if (element is JsonObject) {
            val type: String
            val typeElement = element["type"]

            if (typeElement is JsonPrimitive && typeElement.isString) {
                type = typeElement.content
            } else if (typeElement is JsonObject && typeElement.containsKey("choose")) {
                type = typeElement["choose"]?.jsonArray?.joinToString(separator = "/") { it.jsonPrimitive.content } ?: "unknown"
            } else {
                type = "unknown"
            }
            val tagsElement = element["tags"]
            val tags = if (tagsElement is JsonArray) {
                tagsElement.map { it.jsonPrimitive.content }
            } else {
                null
            }
            MonsterType(type = type, tags = tags)
        } else {
            MonsterType("unknown")
        }
    }

    override fun serialize(encoder: Encoder, value: MonsterType) {
        val jsonEncoder = encoder as? JsonEncoder ?: error("This serializer can only be used with JSON")
        if (value.tags.isNullOrEmpty()) {
            // If there are no tags, serialize as a simple string
            jsonEncoder.encodeString(value.type)
        } else {
            // Otherwise, serialize as a full object
            jsonEncoder.encodeJsonElement(buildJsonObject {
                put("type", value.type)
                put("tags", JsonArray(value.tags.map { JsonPrimitive(it) }))
            })
        }
    }
}

object MonsterACSerializer : KSerializer<MonsterAC> {
    override val descriptor: SerialDescriptor = buildClassSerialDescriptor("MonsterAC")

    override fun deserialize(decoder: Decoder): MonsterAC {
        val input = decoder as? JsonDecoder ?: throw IllegalStateException("This serializer can only be used with JSON")
        val element = input.decodeJsonElement()

        return if (element is JsonPrimitive) {
            // Case 1: simple integer like "ac": [ 22 ]
            MonsterAC(ac = element.int)
        } else if (element is JsonObject && element.containsKey("ac")) {
            // Case 2: object like "ac": [ { "ac": 18, "from": ["plate"] } ]
            val ac = element["ac"]?.jsonPrimitive?.int ?: 10
            val fromElement = element["from"]
            val from = if (fromElement is JsonArray) fromElement.map { it.jsonPrimitive.content } else null
            val condition = element["condition"]?.jsonPrimitive?.content
            val braces = element["braces"]?.jsonPrimitive?.booleanOrNull
            MonsterAC(ac = ac, from = from, condition = condition, braces = braces)
        } else if (element is JsonObject && element.containsKey("special")) {
            val cond = element["special"]?.jsonPrimitive?.content?: "Special"
            MonsterAC(ac = 0, condition = cond)
        } else {
            MonsterAC(10)
        }
    }

    override fun serialize(encoder: Encoder, value: MonsterAC) {
        val jsonEncoder = encoder as? JsonEncoder ?: error("This serializer can only be used with JSON")
        // If it's a simple AC, just encode the number.
        if (value.from == null && value.condition == null) {
            jsonEncoder.encodeInt(value.ac)
        } else {
            // Otherwise, build the full object.
            jsonEncoder.encodeJsonElement(buildJsonObject {
                put("ac", value.ac)
                value.from?.let { put("from", JsonArray(it.map { f -> JsonPrimitive(f) })) }
                value.condition?.let { put("condition", it) }
                value.braces?.let { put("braces", it) }
            })
        }
    }
}

object MonsterCRSerializer : KSerializer<MonsterCR> {
    override val descriptor: SerialDescriptor = buildClassSerialDescriptor("MonsterCR")

    override fun deserialize(decoder: Decoder): MonsterCR {
        val input = decoder as? JsonDecoder ?: throw IllegalStateException("This serializer can only be used with JSON")
        val element = input.decodeJsonElement()

        return if (element is JsonPrimitive) {
            // Case 1: simple string "cr": "1/4"
            MonsterCR(cr = element.content)
        } else if (element is JsonObject) {
            // Case 2: object "cr": { "cr": "21", "xpLair": 41000 }
            val cr = element["cr"]?.jsonPrimitive?.content ?: "0"
            val xp = element["xp"]?.jsonPrimitive?.intOrNull
            val xpLair = element["xpLair"]?.jsonPrimitive?.intOrNull
            MonsterCR(cr = cr, xp = xp, xpLair = xpLair)
        } else {
            MonsterCR("0")
        }
    }

    override fun serialize(encoder: Encoder, value: MonsterCR) {
        val jsonEncoder = encoder as? JsonEncoder ?: error("This serializer can only be used with JSON")
        // If it's a simple CR with no XP, serialize as a string.
        if (value.xp == null && value.xpLair == null) {
            jsonEncoder.encodeString(value.cr)
        } else {
            // Otherwise, build the full object.
            jsonEncoder.encodeJsonElement(buildJsonObject {
                put("cr", value.cr)
                value.xp?.let { put("xp", it) }
                value.xpLair?.let { put("xpLair", it) }
            })
        }
    }
}

object MonsterPassiveSerializer : KSerializer<String?> {
    override val descriptor: SerialDescriptor = buildClassSerialDescriptor("MonsterPassive")

    override fun deserialize(decoder: Decoder): String? {
        val input = decoder as? JsonDecoder ?: throw IllegalStateException("This serializer can only be used with JSON")
        val element = input.decodeJsonElement()

        return when (element) {
            is JsonPrimitive -> {
                if (element.isString) element.content
                else element.intOrNull?.toString()
            }
            else -> null
        }
    }

    @OptIn(ExperimentalSerializationApi::class)
    override fun serialize(encoder: Encoder, value: String?) {
        if (value == null) {
            encoder.encodeNull()
        } else {
            // Try to encode as Int if possible, otherwise String
            val intVal = value.toIntOrNull()
            if (intVal != null) {
                encoder.encodeInt(intVal)
            } else {
                encoder.encodeString(value)
            }
        }
    }
}

// --- File Parsing Function ---

fun convertJsonToMonsters(context: Context, uri: Uri): List<Monster> {
    return try {
        val inputStream = context.contentResolver.openInputStream(uri)
        requireNotNull(inputStream) { "Could not open InputStream for the given Uri." }

        val jsonString = inputStream.bufferedReader().use(BufferedReader::readText)

        // Ensure lenientJson is available or defined in this file
        // If lenientJson is not globally available, use: val json = Json { ignoreUnknownKeys = true; isLenient = true }
        lenientJson.decodeFromString<MonsterDataWrapper>(jsonString).monster

    } catch (e: Exception) {
        println("Failed to parse monsters from Uri ($uri): ${e.message}")
        e.printStackTrace()
        emptyList()
    }
}

fun convertJsonToMonsters(jsonString: String): List<Monster> {
    return try {
        if (jsonString.isBlank()) {
            println("JSON content is empty")
            return emptyList()
        }

        lenientJson.decodeFromString<MonsterDataWrapper>(jsonString).monster

    } catch (e: Exception) {
        println("Failed to parse monsters from JSON string: ${e.message}")
        e.printStackTrace()
        emptyList()
    }
}


// --- START OF NEW FUNCTION ---
/**
 * Converts this JSON Monster object into a Room MonsterEntity.
 */


// ... (The rest of your Monster.kt file with helper classes and serializers remains unchanged)






