package com.ltx.data

import androidx.room.*
import kotlinx.coroutines.flow.Flow
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString


@Entity(
    tableName = "items",
    foreignKeys = [
        ForeignKey(
            entity = BaseItemEntity::class,
            parentColumns = ["id"],
            childColumns = ["baseItemId"],
            onDelete = ForeignKey.SET_NULL
        )
    ],
    indices = [Index(value = ["name", "source"], unique = true), Index(value = ["baseItemId"])]
)
@TypeConverters(ItemTypeConverters::class)
@Serializable
data class ItemEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val name: String,
    val source: String,
    val page: Int?,
    val baseItemId: Long?,
    val type: String?,
    val rarity: String?,
    val reqAttune: String?,
    val weight: Float?,
    val entries: List<Entry>?,
    // --- START OF THE FIX: Add missing fields ---
    val dmg1: String?,
    val dmgType: String?,
    val dmg2: String?,
    val value: Float?,
    val weaponCategory: String?,
    val property: List<PropertyEntry>?,
    val mastery: List<PropertyEntry>?,
    val range: String?,
    val bonusWeapon: String?,
    val bonusAc: String?,
    val ac: Int?,
    val bonusWeaponAttack: String?,
    val bonusSavingThrow: String?,
    val bonusSpellAttack: String?,
    val bonusSpellSaveDc: String?,
    val bonusSpellDamage: String?,
    val bonusWeaponDamage: String?,
    // New fields
    val scfType: String?,
    val weapon: Boolean?,
    val armor: Boolean?,
    val sword: Boolean?,
    val axe: Boolean?,
    val spear: Boolean?,
    val crossbow: Boolean?,
    val bow: Boolean?,
    val polearm: Boolean?,
    val arrow: Boolean?,
    val firearm: Boolean?,
    val bolt: Boolean?,
    val bulletFirearm: Boolean?,
    val mace: Boolean?,
    val needleBlowgun: Boolean?,
    val club: Boolean?,
    val bulletSling: Boolean?,
    val hammer: Boolean?,
    val net: Boolean?,
    val cellEnergy: Boolean?,
    val lance: Boolean?
    // --- END OF THE FIX ---
)

enum class BonusCategory {
    SPELL,
    SAVES,
    COMBAT
}


@Dao
interface ItemDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(items: List<ItemEntity>)

    @Update
    suspend fun updateItems(items: List<ItemEntity>)

    // This function will be useful for looking up a base item's ID
    @Query("SELECT id FROM base_items WHERE name = :name AND source = :source LIMIT 1")
    suspend fun findBaseItemId(name: String, source: String): Long?

    @Query("SELECT id FROM items WHERE name = :name AND source = :source LIMIT 1")
    suspend fun findItemId(name: String, source: String): Long?

    @Query("SELECT * FROM items ORDER BY name ASC")
    fun getAllItems(): Flow<List<ItemEntity>>

    @Query("SELECT * FROM items WHERE id = :id")
    fun getItemById(id: Long): Flow<ItemEntity?>

    @Query("SELECT DISTINCT source FROM items ORDER BY source ASC")
    fun getAllSources(): Flow<List<String>>

    @Query("SELECT DISTINCT rarity FROM items WHERE rarity IS NOT NULL ORDER BY rarity ASC")
    fun getAllRarities(): Flow<List<String>>

    @Query("SELECT * FROM items WHERE type LIKE 'T|%' OR type LIKE 'AT|%' OR type LIKE 'GS|%' OR type LIKE 'INS|%' OR type LIKE 'T' OR type LIKE 'AT' OR type LIKE 'GS' OR type LIKE 'INS' ORDER BY name ASC")
    fun getAllToolItems(): Flow<List<ItemEntity>>

    @Query("DELETE FROM items WHERE id = :itemId")
    suspend fun deleteItemById(itemId: Long)

    @Query("""
SELECT id FROM items
WHERE name = :name
AND source = :source
LIMIT 1
""")
    suspend fun findExistingItemId(
        name: String,
        source: String,
    ): Long?
}

class ItemTypeConverters {
    private val json = lenientJson

    @TypeConverter
    fun fromEntryList(value: List<Entry>?): String? = value?.let { json.encodeToString(it) }

    @TypeConverter
    fun toEntryList(value: String?): List<Entry>? = value?.let { json.decodeFromString(it) }

    // --- START OF THE FIX: Add converter for property/mastery lists ---
    @TypeConverter
    fun fromStringList(value: List<String>?): String? = value?.let { json.encodeToString(it) }

    @TypeConverter
    fun toStringList(value: String?): List<String>? = value?.let { json.decodeFromString(it) }
    // --- END OF THE FIX ---
    @TypeConverter
    fun fromPropertyEntryList(value: List<PropertyEntry>?): String? = value?.let { json.encodeToString(it) }

    @TypeConverter
    fun toPropertyEntryList(value: String?): List<PropertyEntry>? = value?.let { json.decodeFromString(it) }
}
