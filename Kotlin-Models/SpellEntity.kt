package com.ltx.data

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey
import androidx.room.TypeConverter
import androidx.room.TypeConverters
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString

/**
 * The main Room entity for storing a spell.
 * We will store complex, nested data as JSON strings using TypeConverters.
 */
@Entity(tableName = "spells", indices = [Index(value = ["name", "source"], unique = true)])
@TypeConverters(SpellTypeConverters::class) // Apply our converters to this table
@Serializable
data class SpellEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,

    // --- Indexed Columns for Fast Searching ---
    val name: String,
    val level: Int,
    val school: String,
    val source: String,
    val classes: List<SpellClassInfo>? = null,

    // --- Columns Stored as JSON Strings via TypeConverter ---
    val time: List<SpellTime>,
    val range: SpellRange,
    val components: SpellComponents,
    val duration: List<SpellDuration>,
    val entries: List<Entry>,
    val entriesHigherLevel: List<EntriesHigherLevel>?,
    val meta: SpellMeta?,

    // Simple lists can also be converted
    val damageInflict: List<String>?,
    val spellAttack: List<String>?,
    val areaTags: List<String>?,
    val savingThrow: List<String>?
)

/**
 * This class handles the conversion of our complex custom data classes
 * into a JSON string for storage in a single database column, and back.
 */
class SpellTypeConverters {
    // Use the same lenientJson parser we created for the initial file parsing.
    private val json = lenientJson

    @TypeConverter
    fun fromSpellTimeList(value: List<SpellTime>): String = json.encodeToString(value)
    @TypeConverter
    fun toSpellTimeList(value: String): List<SpellTime> = json.decodeFromString(value)

    @TypeConverter
    fun fromRange(value: SpellRange): String = json.encodeToString(value)
    @TypeConverter
    fun toRange(value: String): SpellRange = json.decodeFromString(value)

    @TypeConverter
    fun fromComponents(value: SpellComponents): String = json.encodeToString(value)
    @TypeConverter
    fun toComponents(value: String): SpellComponents = json.decodeFromString(value)

    @TypeConverter
    fun fromDurationList(value: List<SpellDuration>): String = json.encodeToString(value)
    @TypeConverter
    fun toDurationList(value: String): List<SpellDuration> = json.decodeFromString(value)

    @TypeConverter
    fun fromEntryList(value: List<Entry>): String = json.encodeToString(value)
    @TypeConverter
    fun toEntryList(value: String): List<Entry> = json.decodeFromString(value)

    @TypeConverter
    fun fromEntriesHigherLevel(value: List<EntriesHigherLevel>?): String? = value?.let { json.encodeToString(it) }
    @TypeConverter
    fun toEntriesHigherLevel(value: String?): List<EntriesHigherLevel>? = value?.let { json.decodeFromString(it) }

    @TypeConverter
    fun fromMeta(value: SpellMeta?): String? = value?.let { json.encodeToString(it) }
    @TypeConverter
    fun toMeta(value: String?): SpellMeta? = value?.let { json.decodeFromString(it) }

    // Converters for simple string lists
    @TypeConverter
    fun fromStringList(value: List<String>?): String? = value?.let { json.encodeToString(it) }
    @TypeConverter
    fun toStringList(value: String?): List<String>? = value?.let { json.decodeFromString(it) }

    @TypeConverter
    fun fromClassInfoList(value: List<SpellClassInfo>?): String? {
        return value?.let { json.encodeToString(it) }
    }

    @TypeConverter
    fun toClassInfoList(value: String?): List<SpellClassInfo>? {
        return value?.let { json.decodeFromString(it) }
    }
}

/**
 * A helper function to convert the school initial (e.g., "A") to its full name.
 */
fun String.toSchoolName(): String {
    return when (this.uppercase()) {
        "A" -> "Abjuration"
        "C" -> "Conjuration"
        "D" -> "Divination"
        "E" -> "Enchantment"
        "V" -> "Evocation"
        "I" -> "Illusion"
        "N" -> "Necromancy"
        "T" -> "Transmutation"
        else -> "Unknown"
    }
}