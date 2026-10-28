import { ItemVehicleDefinition } from '../content/item.model';

export interface VehicleItemStatistic { label: string; value: string; }

const VEHICLE_STATISTICS = {
  vehAc: { label: 'Armor Class', suffix: '' },
  vehHp: { label: 'Hit Points', suffix: '' },
  vehDmgThresh: { label: 'Damage Threshold', suffix: '' },
  vehSpeed: { label: 'Speed', suffix: ' mph' },
  capPassenger: { label: 'Passengers', suffix: '' },
  capCargo: { label: 'Cargo Capacity', suffix: ' tons' },
  travelCost: { label: 'Passenger Fare', suffix: ' cp per passenger per mile' },
  shippingCost: { label: 'Shipping Cost', suffix: ' cp per 100 lb. per mile' },
} as const satisfies Partial<Record<keyof ItemVehicleDefinition, { label: string; suffix: string }>>;

export function vehicleItemStatistics(item: ItemVehicleDefinition | null | undefined, includeCost = false): VehicleItemStatistic[] {
  if (!item) return [];
  const rows: VehicleItemStatistic[] = [];
  for (const [key, display] of Object.entries(VEHICLE_STATISTICS)) {
    const value = item[key as keyof typeof VEHICLE_STATISTICS];
    if (typeof value !== 'number' || !Number.isFinite(value)) continue;
    const suffix = key === 'capCargo' && value === 1 ? ' ton' : display.suffix;
    rows.push({ label: display.label, value: `${value.toLocaleString('en-US')}${suffix}` });
  }
  const has = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
  if (has(item.crewMin) && has(item.crewMax)) rows.push({ label: 'Crew', value: `${item.crewMin}–${item.crewMax}` });
  else if (has(item.crew)) rows.push({ label: 'Crew', value: String(item.crew) });
  else if (has(item.crewMin)) rows.push({ label: 'Minimum Crew', value: String(item.crewMin) });
  else if (has(item.crewMax)) rows.push({ label: 'Maximum Crew', value: String(item.crewMax) });
  if (!rows.length) return [];
  if (includeCost && has(item.value)) rows.push({ label: 'Cost', value: `${(item.value / 100).toLocaleString('en-US')} gp` });
  return rows;
}
