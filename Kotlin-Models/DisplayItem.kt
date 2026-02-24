@Serializable
data class DisplayProperty(val name: String, val entry: Entry?)
@Serializable
data class DisplayMastery(val name: String, val entry: Entry?)

/**
 * A data class to hold the "resolved" properties of an item for display.
 */
@Serializable
data class DisplayItem(
    val item: ItemEntity,
    val baseItem: BaseItemEntity?,
    val itemType: String?,
    val properties: List<DisplayProperty>,
    val masteries: List<DisplayMastery>,
    val page: Int?,
    val ac: Int?,
    val id: Long
) {
    // Helper properties to get the final value, falling back to the base item.
    val name: String get() = item.name
    val source: String get() = item.source
    val weight: Float? get() = item.weight ?: baseItem?.weight
    val value: Float? get() = item.value ?: baseItem?.value
    val dmg1: String? get() = item.dmg1 ?: baseItem?.dmg1
    val dmg2: String? get() = item.dmg2 ?: baseItem?.dmg2
    val dmgType: String? get() = item.dmgType ?: baseItem?.dmgType
    val range: String? get() = item.range ?: baseItem?.range?: if (item.type.equals("M")) "5" else ""
    val rarity: String? get() = item.rarity
    val reqAttune: String? get() = item.reqAttune
    val weaponCategory: String? get() = item.weaponCategory ?: baseItem?.weaponCategory
    val type: String? get() = item.type ?: item.type
}