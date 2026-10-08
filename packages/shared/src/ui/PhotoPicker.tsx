import React, { useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from './theme';
import { emitToast } from './toastBus';
import type { FileClient, LocalFile, UploadFileOptions } from '../resources/fileClient';

export interface PhotoPickerProps {
  label: string;
  /** Required marker (red *). */
  required?: boolean;
  /** The upload client (resources.files). */
  files: FileClient;
  /** Where to attach the uploaded photo. */
  upload: UploadFileOptions;
  /** Current stored file reference (null when none chosen). */
  value: string | null;
  /** Called with the new stored file reference after a successful upload, or null when removed. */
  onChange: (fileId: string | null) => void;
  disabled?: boolean;
}

/**
 * Inline photo capture + upload — NOT a modal/dialog. Two tappable actions (camera / gallery) and a
 * thumbnail preview once a photo is chosen; the picked image is uploaded immediately to File_Service
 * via {@link FileClient} and the returned reference is reported through {@link onChange}. Camera and
 * media permissions are requested on demand; a denial or cancel is a quiet toast, never a crash
 * (steering: fail safe, native-app UX). Reusable anywhere a photo field is needed.
 *
 * <p>`expo-image-picker` is a native module provided by the host app, imported dynamically so the
 * shared package carries no hard dependency on it (same decoupling as the secure-store adapter).</p>
 */
export function PhotoPicker({ label, required = false, files, upload, value, onChange, disabled = false }: PhotoPickerProps) {
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pickFrom = async (source: 'camera' | 'library') => {
    if (disabled || busy) return;
    try {
      // Dynamic import: the native module lives in the app, not the shared package.
      const ImagePicker = await import('expo-image-picker');

      const perm =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        emitToast({ tone: 'error', title: 'Permission needed', message: `Allow ${source === 'camera' ? 'camera' : 'photo'} access to add a photo.` });
        return;
      }

      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({ quality: 0.6, allowsEditing: true })
          : await ImagePicker.launchImageLibraryAsync({ quality: 0.6, allowsEditing: true, mediaTypes: ['images'] });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return; // cancelled — nothing to do
      }

      const asset = result.assets[0]!;
      const local: LocalFile = {
        uri: asset.uri,
        name: asset.fileName ?? `photo-${Date.now()}.jpg`,
        mimeType: asset.mimeType ?? 'image/jpeg',
      };

      setBusy(true);
      setPreviewUri(asset.uri);
      const stored = await files.upload(local, upload);
      onChange(stored.reference);
      emitToast({ tone: 'success', title: 'Photo added', message: 'The visitor photo was uploaded.' });
    } catch (err) {
      setPreviewUri(null);
      const message = err instanceof Error ? err.message : 'Could not add the photo.';
      emitToast({ tone: 'error', title: 'Photo failed', message });
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    if (disabled || busy) return;
    setPreviewUri(null);
    onChange(null);
  };

  const hasPhoto = Boolean(value) || Boolean(previewUri);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>

      <View style={styles.row}>
        {hasPhoto && previewUri ? (
          <Image source={{ uri: previewUri }} style={styles.thumb} accessibilityLabel="Selected photo preview" />
        ) : (
          <View style={[styles.thumb, styles.thumbEmpty]}>
            {busy ? <ActivityIndicator color={theme.color.primary} /> : <Ionicons name="image-outline" size={24} color={theme.color.mutedText} />}
          </View>
        )}

        <View style={styles.actions}>
          <ActionButton icon="camera-outline" label="Camera" onPress={() => pickFrom('camera')} disabled={disabled || busy} />
          <ActionButton icon="images-outline" label="Gallery" onPress={() => pickFrom('library')} disabled={disabled || busy} />
          {hasPhoto ? <ActionButton icon="trash-outline" label="Remove" tone={theme.color.danger} onPress={remove} disabled={disabled || busy} /> : null}
        </View>
      </View>
    </View>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
  disabled,
  tone = theme.color.primary,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  disabled: boolean;
  tone?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [styles.chip, pressed && !disabled ? styles.pressed : null, disabled ? styles.disabled : null]}
    >
      <Ionicons name={icon} size={16} color={tone} />
      <Text style={[styles.chipText, { color: tone }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { gap: theme.spacing.xs },
  label: { fontSize: theme.fontSize.label, color: theme.color.text, fontWeight: '600' },
  required: { color: theme.color.danger, fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  thumb: { width: 72, height: 72, borderRadius: theme.radius.md, backgroundColor: theme.color.background },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.color.border },
  actions: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: theme.minTouchTarget,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.color.border,
    backgroundColor: theme.color.surface,
  },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.5 },
  chipText: { fontSize: theme.fontSize.label, fontWeight: '700' },
});
