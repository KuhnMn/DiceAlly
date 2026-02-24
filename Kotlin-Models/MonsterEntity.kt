package com.ltx.data

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey
import androidx.room.TypeConverter
import androidx.room.TypeConverters
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString

@Entity(tableName = "monsters", indices = [Index(value = ["name", "source"], unique = true)])
@TypeConverters(MonsterTypeConverters::class)
@Serializable
data class MonsterEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val name: String,
    val source: String,
    val page: Int,
    val size: List<String>?,
    val type: MonsterType,
    val alignment: List<String>?,
    val ac: List<MonsterAC>?,
    val hp: MonsterHP?,
    val speed: Speeds?,
    val str: Int,
    val dex: Int,
    val con: Int,
    val int: Int,
    val wis: Int,
    val cha: Int,
    val save: Map<String, String>?,
    val skill: Map<String, String>?,
    val senses: List<String>?,
    val passive: String,
    val immune: List<MonsterImmune>?,
    val resist: List<MonsterResist>?,
    val vulnerable: List<MonsterVulnerable>?,
    val conditionImmune: List<MonsterConditionImmune>?,
    val languages: List<String>?,
    val cr: MonsterCR,
    val spellcasting: List<MonsterSpellcasting>?,
    val trait: List<MonsterTrait>?,
    val action: List<MonsterTrait>?,
    val legendary: List<MonsterTrait>?,
    val reaction: List<MonsterTrait>?,
    val legendaryActionsLair: Int?,
    val environment: List<String>?,
    val hasToken: Boolean,
    val hasFluff: Boolean
)

class MonsterTypeConverters {
    private val json = lenientJson
    fun fromStringList(value: List<String>?): String = json.encodeToString(value)
    @TypeConverter
    fun toStringList(value: String): List<String>? = json.decodeFromString(value)

    @TypeConverter
    fun fromStringMap(value: Map<String, String>?): String = json.encodeToString(value)
    @TypeConverter
    fun toStringMap(value: String): Map<String, String>? = json.decodeFromString(value)

    @TypeConverter
    fun fromMonsterType(value: MonsterType): String = json.encodeToString(value)
    @TypeConverter
    fun toMonsterType(value: String): MonsterType = json.decodeFromString(value)

    @TypeConverter
    fun fromACList(value: List<MonsterAC>?): String = json.encodeToString(value)
    @TypeConverter
    fun toACList(value: String): List<MonsterAC>? = json.decodeFromString(value)

    @TypeConverter
    fun fromHP(value: MonsterHP?): String = json.encodeToString(value)
    @TypeConverter
    fun toHP(value: String): MonsterHP? = json.decodeFromString(value)

    @TypeConverter
    fun fromSpeeds(value: Speeds?): String = json.encodeToString(value)
    @TypeConverter    fun toSpeeds(value: String): Speeds? = json.decodeFromString(value)

    @TypeConverter
    fun fromCR(value: MonsterCR): String = json.encodeToString(value)
    @TypeConverter
    fun toCR(value: String): MonsterCR = json.decodeFromString(value)

    @TypeConverter
    fun fromSpellcastingList(value: List<MonsterSpellcasting>?): String = json.encodeToString(value)
    @TypeConverter
    fun toSpellcastingList(value: String): List<MonsterSpellcasting>? = json.decodeFromString(value)

    @TypeConverter
    fun fromTraitList(value: List<MonsterTrait>?): String = json.encodeToString(value)
    @TypeConverter
    fun toTraitList(value: String): List<MonsterTrait>? = json.decodeFromString(value)

    // Converters for Polymorphic Lists
    @TypeConverter
    fun fromImmuneList(value: List<MonsterImmune>?): String = json.encodeToString(value)
    @TypeConverter
    fun toImmuneList(value: String): List<MonsterImmune>? = json.decodeFromString(value)

    @TypeConverter
    fun fromResistList(value: List<MonsterResist>?): String = json.encodeToString(value)
    @TypeConverter
    fun toResistList(value: String): List<MonsterResist>? = json.decodeFromString(value)

    @TypeConverter
    fun fromVulnerableList(value: List<MonsterVulnerable>?): String = json.encodeToString(value)
    @TypeConverter
    fun toVulnerableList(value: String): List<MonsterVulnerable>? = json.decodeFromString(value)

    @TypeConverter
    fun fromConditionImmuneList(value: List<MonsterConditionImmune>?): String = json.encodeToString(value)
    @TypeConverter
    fun toConditionImmuneList(value: String): List<MonsterConditionImmune>? = json.decodeFromString(value)
}










