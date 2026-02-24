package com.ltx.data

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey
import androidx.room.TypeConverter
import androidx.room.TypeConverters
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString

/**
 * The Room entity for storing a class or subclass feature.
 */
@Entity(
    tableName = "features",
    indices = [Index(value = ["name", "className", "source", "subclassShortName", "subclassSource", "level"], unique = true)] // Composite unique index
)
@TypeConverters(FeatureTypeConverters::class) // Apply our feature-specific converters
@Serializable
data class FeatureEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,

    // --- Indexed Columns for Fast Searching ---
    val name: String,
    val level: Int,
    val source: String,
    val className: String,
    val classSource: String,
    val page: Int?, // Nullable for class features

    val subclassShortName: String = "",
    val subclassSource: String = "",

    // --- Column Stored as JSON String via TypeConverter ---
    val entries: List<Entry>
)

/**
 * Handles the conversion of complex data types for the FeatureEntity.
 */
class FeatureTypeConverters {
    private val json = lenientJson // Assumes lenientJson is accessible (e.g., internal in the data package)

    @TypeConverter
    fun fromEntryList(value: List<Entry>): String = json.encodeToString(value)

    @TypeConverter
    fun toEntryList(value: String): List<Entry> = json.decodeFromString(value)
}

