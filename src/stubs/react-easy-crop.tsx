import React from 'react';
import { View } from 'react-native';

interface CropperProps {
  image: string;
  crop?: { x: number; y: number };
  zoom?: number;
  aspect?: number;
  onCropChange?: (crop: { x: number; y: number }) => void;
  onZoomChange?: (zoom: number) => void;
  onCropComplete?: (croppedArea: any, croppedAreaPixels: any) => void;
}

const Cropper: React.FC<CropperProps> = (props) => {
  return <View />;
};

export default Cropper;