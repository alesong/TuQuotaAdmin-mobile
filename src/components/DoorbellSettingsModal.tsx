import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Switch,
  Platform,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Settings, Play, X } from 'lucide-react-native';
import { Colors } from '../constants/Colors';
import { playDoorbellSound } from '../utils/sounds';
import type { DoorbellPreferences } from '../context/DoorbellContext';

const SOUND_OPTIONS = [
  { value: 'doorbell.wav', label: 'Doorbell Clásico' },
  { value: 'doorbell_armonico.wav', label: 'Armónico' },
  { value: 'doorbell_digital.wav', label: 'Digital' },
];

interface Props {
  visible: boolean;
  onClose: () => void;
  preferences: DoorbellPreferences;
  onUpdate: (prefs: DoorbellPreferences) => Promise<void>;
}

export function DoorbellSettingsModal({ visible, onClose, preferences, onUpdate }: Props) {
  const [enabled, setEnabled] = useState(preferences.enabled);
  const [selectedSound, setSelectedSound] = useState(preferences.sound);

  useEffect(() => {
    setEnabled(preferences.enabled);
    setSelectedSound(preferences.sound);
  }, [preferences.enabled, preferences.sound]);

  const handleToggle = async (value: boolean) => {
    setEnabled(value);
    await onUpdate({ enabled: value, sound: selectedSound });
  };

  const handleSoundSelect = async (sound: string) => {
    setSelectedSound(sound);
    playDoorbellSound(sound);
    try {
      await onUpdate({ enabled, sound });
    } catch (e) {
      console.error('Error al guardar preferencia de sonido:', e);
    }
  };

  const handleClose = () => {
    setEnabled(preferences.enabled);
    setSelectedSound(preferences.sound);
    onClose();
  };

  return (
    <Modal
      key={String(visible)}
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={handleClose}>
        <View style={styles.contentContainer}>
          <TouchableOpacity activeOpacity={1} style={styles.modalView}>
            <View style={styles.header}>
              <Settings size={20} color={Colors.primary} />
              <Text style={styles.title}>Configuración de Timbre</Text>
              <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
                <X size={20} color={Colors.muted} />
              </TouchableOpacity>
            </View>

            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Timbre personalizado</Text>
              <Switch
                value={enabled}
                onValueChange={handleToggle}
                trackColor={{ false: '#e2e8f0', true: '#c7d2fe' }}
                thumbColor={enabled ? '#6366f1' : '#94a3b8'}
              />
            </View>

            {enabled && (
              <>
                <Text style={styles.sectionLabel}>Sonido del timbre</Text>
                {SOUND_OPTIONS.map(opt => {
                  const isSelected = selectedSound === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      style={[styles.soundRow, isSelected && styles.soundRowSelected]}
                      onPress={() => handleSoundSelect(opt.value)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.radio, isSelected && styles.radioSelected]}>
                        {isSelected && <View style={styles.radioDot} />}
                      </View>
                      <Text style={[styles.soundLabel, isSelected && styles.soundLabelSelected]}>
                        {opt.label}
                      </Text>
                      <TouchableOpacity
                        style={styles.previewBtn}
                        onPress={() => playDoorbellSound(opt.value)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Play size={16} color="#6366f1" />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  );
                })}
              </>
            )}

            <TouchableOpacity style={styles.doneBtn} onPress={onClose}>
              <Text style={styles.doneBtnText}>Cerrar</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  contentContainer: {
    justifyContent: 'flex-end',
  },
  modalView: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    maxHeight: SCREEN_HEIGHT * 0.7,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
    marginLeft: 8,
    flex: 1,
  },
  closeBtn: {
    padding: 4,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    marginBottom: 8,
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.text,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 12,
    marginBottom: 8,
  },
  soundRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 4,
  },
  soundRowSelected: {
    backgroundColor: '#eef2ff',
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  radioSelected: {
    borderColor: '#6366f1',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#6366f1',
  },
  soundLabel: {
    fontSize: 15,
    color: Colors.text,
    flex: 1,
  },
  soundLabelSelected: {
    fontWeight: '600',
    color: '#6366f1',
  },
  previewBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtn: {
    marginTop: 16,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#6366f1',
  },
  doneBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
});
