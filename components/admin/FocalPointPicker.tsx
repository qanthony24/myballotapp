import React, { useRef, useState, useCallback } from 'react';
import { PhotoFocalPoint } from '../../types';

interface FocalPointPickerProps {
  imageUrl: string;
  focalPoint: PhotoFocalPoint;
  onChange: (fp: PhotoFocalPoint) => void;
}

const FocalPointPicker: React.FC<FocalPointPickerProps> = ({
  imageUrl,
  focalPoint,
  onChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [detecting, setDetecting] = useState(false);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
      const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);
      onChange({ x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) });
    },
    [onChange],
  );

  const autoDetect = useCallback(async () => {
    if (!('FaceDetector' in window)) {
      onChange({ x: 50, y: 25 });
      return;
    }
    setDetecting(true);
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = imageUrl;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Image load failed'));
      });

      // @ts-expect-error FaceDetector is not in TS lib types
      const detector = new FaceDetector();
      const faces = await detector.detect(img);

      if (faces.length > 0) {
        const face = faces[0].boundingBox;
        const centerX = ((face.x + face.width / 2) / img.naturalWidth) * 100;
        const centerY = ((face.y + face.height / 2) / img.naturalHeight) * 100;
        onChange({
          x: Math.round(Math.max(0, Math.min(100, centerX))),
          y: Math.round(Math.max(0, Math.min(100, centerY))),
        });
      } else {
        onChange({ x: 50, y: 25 });
      }
    } catch {
      onChange({ x: 50, y: 25 });
    } finally {
      setDetecting(false);
    }
  }, [imageUrl, onChange]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-medium text-gray-600">Focal point</span>
        <button
          type="button"
          onClick={autoDetect}
          disabled={detecting}
          className="text-xs px-2 py-0.5 rounded bg-civic-blue/10 text-civic-blue hover:bg-civic-blue/20 border border-civic-blue/30 transition disabled:opacity-50"
        >
          {detecting ? 'Detecting…' : '✨ Auto-detect face'}
        </button>
        <button
          type="button"
          onClick={() => onChange({ x: 50, y: 25 })}
          className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200 transition"
        >
          Reset
        </button>
        <span className="text-xs text-gray-400 ml-auto">
          {focalPoint.x}%, {focalPoint.y}%
        </span>
      </div>

      {/* Clickable image with crosshair */}
      <div
        ref={containerRef}
        onClick={handleClick}
        className="relative cursor-crosshair border border-gray-300 rounded-lg overflow-hidden"
        style={{ maxWidth: 320 }}
      >
        <img
          src={imageUrl}
          alt="Click to set focal point"
          className="w-full block"
          crossOrigin="anonymous"
        />
        {/* Crosshair indicator */}
        <div
          className="absolute w-6 h-6 -ml-3 -mt-3 pointer-events-none"
          style={{ left: `${focalPoint.x}%`, top: `${focalPoint.y}%` }}
        >
          <div className="absolute inset-0 rounded-full border-2 border-white shadow-md" />
          <div className="absolute inset-0.5 rounded-full border-2 border-red-500" />
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-red-500 -translate-x-px" />
          <div className="absolute top-1/2 left-0 right-0 h-px bg-red-500 -translate-y-px" />
        </div>
      </div>

      {/* Preview strip */}
      <div className="flex items-end gap-3">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-civic-blue mx-auto">
            <img
              src={imageUrl}
              alt="Avatar preview"
              className="w-full h-full object-cover"
              style={{ objectPosition: `${focalPoint.x}% ${focalPoint.y}%` }}
            />
          </div>
          <span className="text-[10px] text-gray-400 mt-0.5 block">Avatar</span>
        </div>
        <div className="text-center">
          <div className="w-24 h-16 rounded-lg overflow-hidden border border-gray-300 mx-auto">
            <img
              src={imageUrl}
              alt="Card preview"
              className="w-full h-full object-cover"
              style={{ objectPosition: `${focalPoint.x}% ${focalPoint.y}%` }}
            />
          </div>
          <span className="text-[10px] text-gray-400 mt-0.5 block">Card</span>
        </div>
        <div className="text-center">
          <div className="w-8 h-8 rounded-full overflow-hidden border border-gray-300 mx-auto">
            <img
              src={imageUrl}
              alt="Small preview"
              className="w-full h-full object-cover"
              style={{ objectPosition: `${focalPoint.x}% ${focalPoint.y}%` }}
            />
          </div>
          <span className="text-[10px] text-gray-400 mt-0.5 block">Small</span>
        </div>
      </div>

      <p className="text-xs text-gray-400">
        Click on the image to set the crop focus point. The previews show how the photo will appear in different views.
      </p>
    </div>
  );
};

export default FocalPointPicker;
