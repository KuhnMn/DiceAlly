// File: app/src/main/java/com/ltx/data/ExportedCharacterSheet.kt
package com.ltx.data

import com.ltx.dndally.compendium.list.DisplayItem
import kotlinx.serialization.Serializable

/**
 * A portable, ID-independent representation of a full character sheet for export/import.
 * It uses `name` and `source` to identify related entities instead of database IDs.
 */
@Serializable
data class ExportedCharacterSheet(
    // All fields from CharacterEntity, but with stable identifiers for relations
    val character: ExportedCharacter,
    val species: ExportedSpecies?, // Use a generic reference for species
    val spells: List<ExportedCharacterSpell>,
    val features: List<ExportedCharacterFeature>,

    // --- NEW: Export all other relations from FullCharacterSheet ---
    val inventory: List<ExportedItem>,
    val conditions: List<ConditionNames>, // Conditions are simple name/source references
    val monsters: List<ExportedCharacterMonster>, // --- MODIFIED: Use the new portable version ---
    val notes: List<CharacterNote>,           // Assuming CharacterNote can be serialized directly
    val combatActions: List<ExportedCombatAction> // Assuming CharacterCombatAction can be serialized directly
    // --- END NEW ---
)

@Serializable
data class ExportedCharacter(
    // A subset of CharacterEntity's fields. Add any others you want to export.
    val name: String,
    val level: Int,
    val description: String,
    val maxHp: Int,
    val currentHp: Int,
    val tempHp: Int,
    val armorClass: Int,
    val hasInspiration: Boolean,
    val abilityScores: CharacterAbilityScores, // This is already @Serializable and has no IDs
    val currency: CharacterCurrency,       // Also @Serializable and no IDs
    val proficiencies: CharacterProficiencies, // Also @Serializable and no IDs
    // val classLevels: List<SelectedClassDataEntity>, // Also @Serializable, uses stable IDs
    val featureSources: List<FeatureSource>,      // Also @Serializable, uses stable names
    val spellSlots: Map<String, List<CharacterSpellSlotInfo>>, // Also @Serializable
    val advantageOn: List<AdvantageOn>, // Already uses stable enums/strings
    val resistances: List<String>,      // Already a simple list of strings
    // Add other CharacterEntity fields here like portraitUri, deathSaves, etc.
    val senses: Map<String, Int>,
    val speeds: Speeds,
    val calculateAC: Boolean,
    val unarmoredDefense: AbilityScores?
)

@Serializable
data class ExportedCombatAction(
    val name: String,
    val range: String,
    val hitOrDc: String,
    val damageOrHeal: String,
    val actionType: ActionType,
    val linkedResourceType: CharacterFeatureType? = null, // "SPELL", "FEATURE", "ITEM", "MONSTER_ACTION"
    val linkedResource: ExportedReference? = null,
    val orderIndex: Int = 0
)

/**
 * A generic portable reference that uses name/source instead of an ID.
 * Can be used for Species, Conditions, etc.
 */
@Serializable
data class ExportedReference(
    val name: String,
    val source: String,
    var uses: List<FeatureUses> = emptyList()
)

@Serializable
data class ExportedSpecies(
    val name: String,
    val source: String,
    var uses: List<FeatureUses> = emptyList(),
    val entity: SpeciesEntity? = null
)

@Serializable
data class ExportedItem(
    val name: String,
    val source: String,
    var uses: List<FeatureUses> = emptyList(),
    val entity: DisplayItem? = null,
)

/**
 * A portable version of CharacterSpell that uses name/source instead of spellId.
 */
@Serializable
data class ExportedCharacterSpell(
    val name: String,
    val source: String,
    val castingSourceName: String,
    val listType: SpellListType,
    val userAdded: Boolean,
    var uses: List<FeatureUses> = emptyList(),
    val entity: SpellEntity? = null
)

@Serializable
data class ExportedCharacterMonster(
    val name: String,
    val source: String,
    val hpEnabled: Boolean? = false,
    val monsterMaxHP: Int? = 0,
    val userAdded: Boolean,
    val entity: MonsterEntity? = null
)

/**
 * A portable version of CharacterFeature that uses name/source instead of featureId.
 */
@Serializable
data class ExportedCharacterFeature(
    val name: String,
    val source: String,
    val featureSourceName: String,
    val featureType: CharacterFeatureType,
    val userAdded: Boolean,
    var uses: List<FeatureUses> = emptyList(),
    val featureEntity: FeatureEntity? = null,
    val featEntity: FeatEntity? = null,
    val optionalFeatureEntity: OptionalFeatureEntity? = null

)

/*
/**
 * A portable version of CharacterInventoryItem that uses name/source for the base item.
 */
@Serializable
data class ExportedCharacterInventoryItem(
    val itemName: String,
    val itemSource: String,
    // Add other fields from CharacterInventoryItem that don't rely on IDs
)

/**
 * --- NEW: A portable version of CharacterMonster that uses name/source for the monster. ---
 */
@Serializable
data class ExportedCharacterMonster(
    val monsterName: String,
    val monsterSource: String,
    val currentHp: Int,
    val maxHp: Int
)*/