package com.ltx.data

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey
import androidx.room.TypeConverter
import androidx.room.TypeConverters
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString

/**
 * The Room entity for storing an optional feature.
 */
@Entity(
    tableName = "optionalfeatures",
    indices  = [Index(value = ["name", "source"], unique = true)] // Name + Source is a good unique key
)
@TypeConverters(OptionalFeatureTypeConverters::class) // Apply the converters below
@Serializable
data class OptionalFeatureEntity(
    @PrimaryKey(autoGenerate = true)
    val  id: Long = 0,

    // --- Indexed Columns for Fast Searching ---
    val name: String,
    val source: String,
    val page: Int,
    val featureType: List<String>,
    val isClassFeatureVariant: Boolean?,    // --- Columns Stored as JSON Strings via TypeConverter ---
    val entries: List<Entry>,
    val prerequisite: List<Prerequisite>?,
    val consumes: Consumes?
)

/**
 * Handles the conversion of complex data types for the OptionalFeatureEntity.
 */
class OptionalFeatureTypeConverters
{
    // Assumes lenientJson is accessible (e.g., internal in the 'data' package)
    private val json = lenientJson

    @TypeConverter
    fun fromStringList(value: List<String>): String = json.encodeToString(value)

    @TypeConverter
    fun toStringList(value: String): List<String> = json.decodeFromString(value)


    @TypeConverter
    fun fromEntryList(value: List<Entry>): String = json.encodeToString(value)

    @TypeConverter
    fun toEntryList(value: String): List<Entry> = json.decodeFromString(value)

    @TypeConverter
    fun fromConsumes(value: Consumes?): String? = value?.let { json.encodeToString(it) }

    @TypeConverter
    fun toConsumes(value: String?): Consumes? = value?.let { json.decodeFromString(it) }

    @TypeConverter
    fun fromPrerequisiteList(value: List<Prerequisite>?): String? = value?.let { json.encodeToString(it) }

    @TypeConverter
    fun toPrerequisiteList(value: String?): List<Prerequisite>? = value?.let { json.decodeFromString(it) }
}


/**
 * An extension
function to map the domain 'OptionalFeature' model
 * to the database 'OptionalFeatureEntity' model.
 */
fun OptionalFeature.toEntity(): OptionalFeatureEntity {
    return OptionalFeatureEntity(
        name = this.name,
        source = this.source,
        page =
            this.page,
        featureType = this.featureType,
        isClassFeatureVariant = this.isClassFeatureVariant,
        entries = this.entries,
        prerequisite = this.prerequisite,
        consumes = this.consumes
    )
}



