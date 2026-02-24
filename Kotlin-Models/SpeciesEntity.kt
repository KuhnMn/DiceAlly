package com.ltx.data

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey
import androidx.room.TypeConverter
import androidx.room.TypeConverters
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString

/**
 * The Room entity for storing a species (race), updated to match the latest data model.
 */
@Entity(
    tableName = "species",
    indices = [Index(value = ["name", "source"], unique = true)] // A name-source pair is a robust unique key
)
@TypeConverters(SpeciesTypeConverters::class) // Apply the converters below
@Serializable
data class SpeciesEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,

    // --- Indexed Columns for Fast Searching ---
    val name: String,
    val source: String,
    val page: Int?, // Made nullable
    val darkvision: Int?,
    // --- Columns Stored as JSON Strings via TypeConverter ---
    val entries: List<Entry>?, // Made nullable
    val size: List<String>?,    // Made nullable
    val speed: Speeds?,        // Made nullable
    val creatureTypes: List<String>?, // Made nullable
    val creatureTypeTags: List<String>?,
    val sizeEntry: ObjectListItem?,
    val resist: List<Resistance>?
)

/**
 * Handles the conversion of complex data types for the SpeciesEntity.
 */
class SpeciesTypeConverters {
    // Assumes lenientJson is accessible (e.g., internal in the 'data' package)
    private val json = lenientJson

    // --- Converter for the Speeds object ---
    @TypeConverter
    fun fromSpeeds(value: Speeds?): String? = value?.let { json.encodeToString(value) }

    @TypeConverter
    fun toSpeeds(value: String?): Speeds? = value?.let { json.decodeFromString(value) }

    // --- Other converters ---
    @TypeConverter
    fun fromStringList(value: List<String>?): String? = value?.let { json.encodeToString(value) }

    @TypeConverter
    fun toStringList(value: String?): List<String>? = value?.let { json.decodeFromString(value) }

    @TypeConverter
    fun fromEntryList(value: List<Entry>?): String? = value?.let { json.encodeToString(value)}

    @TypeConverter
    fun toEntryList(value: String?): List<Entry>? = value?.let { json.decodeFromString(value) }

    @TypeConverter
    fun fromObjectListItem(value: ObjectListItem?): String? = value?.let { json.encodeToString(value) }

    @TypeConverter
    fun toObjectListItem(value: String?): ObjectListItem? = value?.let { json.decodeFromString(value) }

    // --- New Converters for Resistance ---
    @TypeConverter
    fun fromResistanceList(value: List<Resistance>?): String? {
        return value?.let { json.encodeToString(it) }
    }

    @TypeConverter
    fun toResistanceList(value: String?): List<Resistance>? {
        return value?.let { json.decodeFromString(it) }
    }
}

/**
 * An extension function to map the domain 'Species' model to the database 'SpeciesEntity' model.
 */
fun Species.toEntity(): SpeciesEntity {
    return SpeciesEntity(
        name = this.name,
        source = this.source,
        page = this.page,
        darkvision = this.darkvision,
        entries = this.entries,
        size = this.size,
        speed = this.speed,
        creatureTypes = this.creatureTypes,
        creatureTypeTags = this.creatureTypeTags,
        sizeEntry = this.sizeEntry,
        resist = this.resist
    )
}