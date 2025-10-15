import React from "react";
import type { User } from "../../../../types";
import { type UserUpdateFormData } from "../../../../schemas";
import { UserForm } from "./user-form";

interface UserEditFormProps {
  user: User;
  onSubmit: (data: Partial<UserUpdateFormData>) => Promise<void>;
  isSubmitting?: boolean;
  onDirtyChange?: (isDirty: boolean) => void;
  onFormStateChange?: (formState: { isValid: boolean; isDirty: boolean }) => void;
}

export function UserEditForm({ user, onSubmit, isSubmitting, onDirtyChange, onFormStateChange }: UserEditFormProps) {
  // Map API data to form data
  const defaultValues = React.useMemo(
    () => ({
      name: user.name,
      email: user.email,
      phone: user.phone,
      cpf: user.cpf,
      pis: user.pis,
      status: user.status,
      verified: user.verified,
      birth: user.birth,
      dismissal: user.dismissal,
      positionId: user.positionId,
      performanceLevel: user.performanceLevel,
      sectorId: user.sectorId,
      managedSectorId: user.managedSectorId,
      payrollNumber: user.payrollNumber,
      // Address fields
      address: user.address,
      addressNumber: user.addressNumber,
      addressComplement: user.addressComplement,
      neighborhood: user.neighborhood,
      city: user.city,
      state: user.state,
      zipCode: user.zipCode,
      // PPE Sizes
      ppeSize: user.ppeSize ? {
        shirts: user.ppeSize.shirts,
        boots: user.ppeSize.boots,
        pants: user.ppeSize.pants,
        sleeves: user.ppeSize.sleeves,
        mask: user.ppeSize.mask,
        gloves: user.ppeSize.gloves,
        rainBoots: user.ppeSize.rainBoots,
      } : {
        shirts: null,
        boots: null,
        pants: null,
        sleeves: null,
        mask: null,
        gloves: null,
        rainBoots: null,
      },
      // Status tracking timestamps (read-only, auto-managed by backend)
      contractedAt: user.contractedAt,
      exp1StartAt: user.exp1StartAt,
      exp1EndAt: user.exp1EndAt,
      exp2StartAt: user.exp2StartAt,
      exp2EndAt: user.exp2EndAt,
      dismissedAt: user.dismissedAt,
      // Don't include password in default values
      password: undefined,
    }),
    [user],
  );

  // Track original values to determine what changed (only set once on mount)
  const originalValuesRef = React.useRef(defaultValues);

  const handleSubmit = async (data: UserUpdateFormData) => {
    // Compare with original values to find changed fields
    const changedFields: Partial<UserUpdateFormData> = {};
    const original = originalValuesRef.current;

    // Check each field for changes
    Object.keys(data).forEach((key) => {
      const typedKey = key as keyof UserUpdateFormData;

      // Skip fields that don't exist in the form data
      if (!(typedKey in data)) return;

      // Skip read-only status tracking fields (auto-managed by backend)
      if (
        typedKey === "contractedAt" ||
        typedKey === "exp1StartAt" ||
        typedKey === "exp1EndAt" ||
        typedKey === "exp2StartAt" ||
        typedKey === "exp2EndAt" ||
        typedKey === "dismissedAt"
      ) {
        return;
      }

      const newValue = data[typedKey];
      const oldValue = typedKey in original ? (original as any)[typedKey] : undefined;

      // Special handling for password - only include if provided
      if (typedKey === "password") {
        if (newValue && typeof newValue === "string" && newValue.length > 0) {
          changedFields.password = newValue;
        }
      }
      // Special handling for dates
      else if (typedKey === "birth" || typedKey === "dismissal") {
        const newDate = newValue instanceof Date ? newValue.toISOString() : newValue;
        const oldDate = oldValue instanceof Date ? oldValue.toISOString() : oldValue;
        if (newDate !== oldDate) {
          changedFields[typedKey] = newValue as any;
        }
      }
      // Deep equality check for arrays
      else if (Array.isArray(newValue) && Array.isArray(oldValue)) {
        if (JSON.stringify(newValue) !== JSON.stringify(oldValue)) {
          changedFields[typedKey] = newValue as any;
        }
      }
      // Simple equality check for other fields
      else if (newValue !== oldValue) {
        changedFields[typedKey] = newValue as any;
      }
    });

    // Only submit if there are changes
    if (Object.keys(changedFields).length > 0) {
      await onSubmit(changedFields);
    }
  };

  return (
    <UserForm
      mode="update"
      defaultValues={defaultValues}
      onSubmit={handleSubmit}
      isSubmitting={isSubmitting}
      onDirtyChange={onDirtyChange}
      onFormStateChange={onFormStateChange}
    />
  );
}
