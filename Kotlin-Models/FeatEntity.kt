package com.ltx.data

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey
import androidx.room.TypeConverter
import androidx.room.TypeConverters
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString

/**
 * The Room entity for storing a feat.
 */
@Entity(tableName = "feats",
    indices = [Index(value = ["name", "source"], unique = true)] // A feat's name is its unique identifier
)
@TypeConverters(FeatTypeConverters::class) // Apply the converters below
@Serializable
data class FeatEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,

    // --- Indexed Columns for Fast Searching ---
    val name: String,
    val source: String,
    val page: Int?,
    val category: String?,
    val repeatable: Boolean?,

    // --- Columns Stored as JSON Strings via TypeConverter ---
    val entries: List<Entry>,
    val prerequisite: List<Prerequisite>?,
    val ability: List<Ability>?
)

/**
 * Handles the conversion of complex data types for the FeatEntity.
 */
class FeatTypeConverters {
    // Assumes lenientJson is accessible (e.g., internal in the 'data' package)
    private val json = lenientJson

    @TypeConverter
    fun fromEntryList(value: List<Entry>): String = json.encodeToString(value)

    @TypeConverter
    fun toEntryList(value: String): List<Entry> = json.decodeFromString(value)

    @TypeConverter
    fun fromAbilityList(value: List<Ability>): String = json.encodeToString(value)

    @TypeConverter
    fun toAbilityList(value: String): List<Ability> = json.decodeFromString(value)

    @TypeConverter
    fun fromPrerequisiteList(value: List<Prerequisite>?): String? = value?.let { json.encodeToString(it) }

    @TypeConverter
    fun toPrerequisiteList(value: String?): List<Prerequisite>? = value?.let { json.decodeFromString(it) }
}

/**
 * An extension function to map the domain 'Feat' model
 * to the database 'FeatEntity' model.
 */
fun Feat.toEntity(): FeatEntity {
    return FeatEntity(
        name = this.name,
        source = this.source,
        page = this.page,
        category = this.category,
        repeatable = this.repeatable,
        entries = this.entries,
        prerequisite = this.prerequisite,
        ability = this.ability
    )
}