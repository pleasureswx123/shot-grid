import React, { useRef, useState, useEffect } from 'react';
import { Pencil, Circle, ArrowRight, RotateCcw } from 'lucide-react';
import type { NoteAnnotation } from '../../types';

interface CanvasAnnotatorProps {
  width: number;
  height: number;
  onSaveAnnotation: (dataUrl: string, annotations: NoteAnnotation[]) => void;
  onClear: () => void;
  noteKind?: 'mandatory' | 'normal';
}

export const CanvasAnnotator: React.FC<CanvasAnnotatorProps> = ({
  width,
  height,
  onSaveAnnotation,
  onClear,
  noteKind = 'mandatory'
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState<'brush' | 'circle' | 'arrow'>('brush');
  const [color, setColor] = useState('#ef4444'); // default red
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [brushPoints, setBrushPoints] = useState<number[]>([]);
  const [annotations, setAnnotations] = useState<NoteAnnotation[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = width || 640;
    canvas.height = height || 360;
  }, [width, height]);

  const startDraw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setIsDrawing(true);
    setStartPos({ x, y });

    if (tool === 'brush') {
      setBrushPoints([x, y]);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
      }
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !startPos) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (tool === 'brush') {
      ctx.lineTo(x, y);
      ctx.stroke();
      setBrushPoints(previous => [...previous, x, y]);
    }
  };

  const stopDraw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !startPos) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.strokeStyle = color;
    ctx.lineWidth = 3;

    let annotation: NoteAnnotation | null = null;

    if (tool === 'circle') {
      const radius = Math.sqrt(Math.pow(x - startPos.x, 2) + Math.pow(y - startPos.y, 2));
      ctx.beginPath();
      ctx.arc(startPos.x, startPos.y, radius, 0, 2 * Math.PI);
      ctx.stroke();
      annotation = {
        id: globalThis.crypto?.randomUUID?.() || `ann_${Date.now().toString(36)}`,
        type: 'circle',
        x: startPos.x - radius,
        y: startPos.y - radius,
        width: radius * 2,
        height: radius * 2,
        color,
      };
    } else if (tool === 'arrow') {
      ctx.beginPath();
      ctx.moveTo(startPos.x, startPos.y);
      ctx.lineTo(x, y);
      ctx.stroke();

      // Arrow head
      const angle = Math.atan2(y - startPos.y, x - startPos.x);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 12 * Math.cos(angle - Math.PI / 6), y - 12 * Math.sin(angle - Math.PI / 6));
      ctx.moveTo(x, y);
      ctx.lineTo(x - 12 * Math.cos(angle + Math.PI / 6), y - 12 * Math.sin(angle + Math.PI / 6));
      ctx.stroke();
      annotation = {
        id: globalThis.crypto?.randomUUID?.() || `ann_${Date.now().toString(36)}`,
        type: 'arrow',
        points: [startPos.x, startPos.y, x, y],
        color,
      };
    } else if (tool === 'brush') {
      annotation = {
        id: globalThis.crypto?.randomUUID?.() || `ann_${Date.now().toString(36)}`,
        type: 'brush',
        points: [...brushPoints, x, y],
        color,
      };
    }

    const nextAnnotations = annotation ? [...annotations, annotation] : annotations;
    if (annotation) setAnnotations(nextAnnotations);
    setIsDrawing(false);
    setStartPos(null);

    // notify parent of drawing snapshot
    onSaveAnnotation(canvas.toDataURL(), nextAnnotations);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setAnnotations([]);
    setBrushPoints([]);
    onClear();
  };

  return (
    <div className="relative w-full h-full flex flex-col items-center">
      {/* Canvas Layer */}
      <canvas
        ref={canvasRef}
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={stopDraw}
        onMouseLeave={stopDraw}
        className="cursor-crosshair absolute inset-x-0 top-0 bottom-12 z-20 w-full touch-none"
      />

      {/* Floating Canvas Toolbar */}
      <div className={`absolute top-3 left-1/2 -translate-x-1/2 z-30 bg-slate-900/90 backdrop-blur-md rounded-full px-3 py-1.5 flex items-center space-x-3 text-xs shadow-xl select-none ${noteKind === 'mandatory' ? 'border-rose-500/70' : 'border-slate-700/80'}`}>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${noteKind === 'mandatory' ? 'bg-rose-500/20 text-rose-200' : 'bg-slate-700 text-slate-300'}`}>
          {noteKind === 'mandatory' ? '必改意见标注' : '普通意见标注'}
        </span>
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setTool('brush')}
            className={`p-1.5 rounded-full transition ${tool === 'brush' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
            title="自由画笔"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setTool('circle')}
            className={`p-1.5 rounded-full transition ${tool === 'circle' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
            title="画圈/圆框"
          >
            <Circle className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setTool('arrow')}
            className={`p-1.5 rounded-full transition ${tool === 'arrow' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
            title="绘制箭头"
          >
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="h-3 w-px bg-slate-700" />

        {/* Color pickers */}
        <div className="flex items-center space-x-1.5">
          {['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#ffffff'].map(c => (
            <button
              key={c}
              onClick={() => setColor(c)}
              style={{ backgroundColor: c }}
              className={`w-4 h-4 rounded-full border transition ${color === c ? 'ring-2 ring-indigo-400 scale-110' : 'border-slate-600'}`}
            />
          ))}
        </div>

        <div className="h-3 w-px bg-slate-700" />

        <button
          onClick={clearCanvas}
          className="p-1.5 text-slate-400 hover:text-rose-400 rounded-full transition"
          title="清除画板批注"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
