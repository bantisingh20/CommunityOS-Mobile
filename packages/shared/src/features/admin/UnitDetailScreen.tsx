import React from 'react';
import { FormScreen } from '../../ui/FormScreen';
import { UnitDetailView } from '../shared/UnitDetailView';
import type { Unit } from '../../models/community';
import type { ResourceClients } from '../../resources';

export interface UnitDetailScreenProps {
  resources: ResourceClients;
  unitId: string;
  initialUnit?: Unit;
  onBack?: () => void;
}

/**
 * Admin unit detail: the unit's attributes, registered vehicles/pets (Req 19.5) and ownership +
 * tenancy history (Req 16.4), rendered via the shared {@link UnitDetailView} inside the modern
 * {@link FormScreen} scaffold (safe-area header + back).
 */
export function UnitDetailScreen({ resources, unitId, initialUnit, onBack }: UnitDetailScreenProps) {
  const title = initialUnit ? `Unit ${initialUnit.unitNumber}` : 'Unit';
  return (
    <FormScreen title={title} subtitle="Unit details" {...(onBack ? { onBack } : {})}>
      <UnitDetailView
        resources={resources}
        unitId={unitId}
        {...(initialUnit ? { initialUnit } : {})}
        showHistory
      />
    </FormScreen>
  );
}
