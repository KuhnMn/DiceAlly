package com.ltx.data

import android.content.Context
import android.net.Uri
import kotlinx.serialization.PolymorphicSerializer
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.JsonTransformingSerializer
import kotlinx.serialization.json.buildJsonObject
import java.io.BufferedReader


@Serializable
data class Spell(
    val name: String,
    val level: Int,
    val school: String,
    val time: List<SpellTime>,
    val range: SpellRange,
    val components: SpellComponents,
    val duration: List<SpellDuration>,
    val entries: List<Entry>, // For simple descriptions; complex ones require a custom serializer or JsonElement
    val entriesHigherLevel: List<EntriesHigherLevel>? = null, // Optional field
    val source: String,
    val damageInflict: List<String>? = null,
    val spellAttack: List<String>? = null,
    val areaTags: List<String>? = null,
    val savingThrow: List<String>? = null,
    val page: Int? = 0,
    val classes: FromClassList? = null,
    val meta: SpellMeta? = null // Optional, for things like 'ritual'


) {
    /**
     * A handy extension function to map the domain 'Spell' model
     * to the database 'SpellEntity' model.
     */
    fun toEntity(): SpellEntity {
        return SpellEntity(
            name = this.name,
            level = this.level,
            school = this.school,
            source = this.source,
            time = this.time,
            range = this.range,
            components = this.components,
            duration = this.duration,
            entries = this.entries,
            entriesHigherLevel = this.entriesHigherLevel,
            meta = this.meta,
            damageInflict = this.damageInflict,
            spellAttack = this.spellAttack,
            areaTags = this.areaTags,
            savingThrow = this.savingThrow,
            classes = classes?.fromClassList
        )
    }
}

@Serializable
data class FromClassList(
    val fromClassList: List<SpellClassInfo>? = null
)

/**
 * Defines the casting time of a spell.
 */
@Serializable
data class SpellTime(
    val number: Int,
    val unit: String
)

/**
 * Defines the spell's range.
 */
@Serializable
data class SpellRange(
    val type: String,
    val distance: Distance? = null // Can be null for ranges like "Self"
)

/**
 * Represents a distance value and its unit.
 */
@Serializable
data class Distance(
    val type: String,
    val amount: Int? = null
)

/**
 * Holds the material, somatic, and verbal components of a spell.
 * The 'm' component can be a simple boolean or a string describing the material.
 */
@Serializable
data class SpellComponents(
    val v: Boolean? = null,
    val s: Boolean? = null,
    val m: MaterialComponent? = null // Can be a description of materials
)

/**
 * Defines how long the spell lasts.
 */
@Serializable
data class SpellDuration(
    val type: String,
    val duration: DurationDetails? = null, // Not present for "instant"
    val concentration: Boolean? = false,
    val ends: List<String>? = null
)

/**
 * Contains the specific amount and unit for timed durations.
 */
@Serializable
data class DurationDetails(
    val type: String,
    val amount: Int? = null
)

/**
 * Describes how the spell behaves when cast at higher levels.
 */
@Serializable
data class EntriesHigherLevel(
    val name: String,
    val entries: List<Entry>
)

/**
 * Contains metadata about the spell, such as whether it can be cast as a ritual.
 */
@Serializable
data class SpellMeta(
    val ritual: Boolean? = null
)

@Serializable
data class SpellDataWrapper(
    val spell: List<Spell>
)


@Serializable(with = MaterialComponentSerializer::class)
sealed interface MaterialComponent

@Serializable
data class SimpleMaterial(val text: String) : MaterialComponent

@Serializable
data class DetailedMaterial(
    val text: String,
    val cost: Int? = null,
    val consume: Boolean? = null
) : MaterialComponent

// A custom serializer to handle the mixed-type (String or Object) array
object MaterialComponentSerializer : JsonTransformingSerializer<MaterialComponent>(PolymorphicSerializer(MaterialComponent::class)) {
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




/**
 * Converts a list of JSON strings into a list of Spell objects.
 *
 * @param jsonSpellList A list of strings, where each string is a JSON object representing a spell.
 * @return A list containing only the successfully parsed Spell objects. Any JSON strings that
 *         fail to parse for any reason (e.g., malformed JSON, type mismatches) are safely discarded.
 */
fun convertJsonToSpells(context: Context, uri: Uri): List<Spell> {
    return try {
        // Use the ContentResolver to open an InputStream for the given Uri
        val inputStream = context.contentResolver.openInputStream(uri)
        requireNotNull(inputStream) { "Could not open InputStream for the given Uri." }

        // Read the entire file content into a single string
        val jsonString = inputStream.bufferedReader().use(BufferedReader::readText)

        // Decode the JSON string into our wrapper class and return the list of spells
        lenientJson.decodeFromString<SpellDataWrapper>(jsonString).spell
    } catch (e: Exception) {
        // If any part of the file reading or parsing fails, print the error and return an empty list.
        println("Failed to parse spells from Uri ($uri): ${e.message}")
        e.printStackTrace()
        emptyList()
    }
}

fun convertJsonToSpells(jsonString: String): List<Spell> {
    return try {
        if (jsonString.isBlank()) {
            println("JSON content is empty")
            return emptyList()
        }

        lenientJson.decodeFromString<SpellDataWrapper>(jsonString).spell

    } catch (e: Exception) {
        println("Failed to parse feats from JSON string: ${e.message}")
        e.printStackTrace()
        emptyList()
    }
}


