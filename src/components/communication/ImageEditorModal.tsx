import React, { useState, useRef, useEffect } from 'react';
import {
  X, Pencil, Circle, Square, ArrowRight, Type, RotateCw, Sun, Contrast,
  Sliders, Undo, Trash2, Check, Download, Sparkles, Move
} from 'lucide-react';

interface ImageEditorModalProps {
  imageUrl: string;
  imageName?: string;
  onClose: () => void;
  onSave: (editedDataUrl: string) => void;
}

type DrawTool = 'brush' | 'circle' | 'rect' | 'arrow' | 'text';

interface Shape {
  id: string;
  type: DrawTool;
  color: string;
  lineWidth: number;
  points?: { x: number; y: number }[];
  startX?: number;
  startY?: number;
  endX?: number;
  endY?: number;
  text?: string;
}

export const ImageEditorModal: React.FC<ImageEditorModalProps> = ({
  imageUrl,
  imageName = '图片编辑',
  onClose,
  onSave
}) => {
  const [activeTool, setActiveTool] = useState<DrawTool>('brush');
  const [selectedColor, setSelectedColor] = useState<string>('#ef4444'); // default red
  const [lineWidth, setLineWidth] = useState<number>(4);
  const [textInput, setTextInput] = useState<string>('');
  const [textPosition, setTextPosition] = useState<{ x: number; y: number } | null>(null);

  // Filters & Adjustments
  const [brightness, setBrightness] = useState<number>(100);
  const [contrast, setContrast] = useState<number>(100);
  const [rotation, setRotation] = useState<number>(0);
  const [filterMode, setFilterMode] = useState<'normal' | 'grayscale' | 'contrast_boost' | 'cyan_vfx'>('normal');

  const [shapes, setShapes] = useState<Shape[]>([]);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [currentShape, setCurrentShape] = useState<Shape | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [imageLoaded, setImageLoaded] = useState<boolean>(false);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number }>({ width: 800, height: 600 });

  const colors = [
    { name: '警告红', value: '#ef4444' },
    { name: '标注黄', value: '#eab308' },
    { name: '核准绿', value: '#22c55e' },
    { name: '科技蓝', value: '#3b82f6' },
    { name: '霓虹青', value: '#06b6d4' },
    { name: '纯白', value: '#ffffff' }
  ];

  // Load image
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageUrl;
    img.onload = () => {
      imageRef.current = img;
      // Fit image into bounding box while preserving aspect ratio
      const maxW = 900;
      const maxH = 550;
      let w = img.width;
      let h = img.height;

      if (w > maxW) {
        h = Math.round((h * maxW) / w);
        w = maxW;
      }
      if (h > maxH) {
        w = Math.round((w * maxH) / h);
        h = maxH;
      }

      setImageDimensions({ width: w, height: h });
      setImageLoaded(true);
    };
  }, [imageUrl]);

  // Redraw canvas whenever shapes, filters, or image changes
  useEffect(() => {
    if (!imageLoaded || !canvasRef.current || !imageRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = imageDimensions.width;
    canvas.height = imageDimensions.height;

    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Save context state for rotation & filter transformations
    ctx.save();

    // Rotation transform around center
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.translate(-canvas.width / 2, -canvas.height / 2);

    // Apply Filter settings
    let filterString = `brightness(${brightness}%) contrast(${contrast}%)`;
    if (filterMode === 'grayscale') filterString += ' grayscale(100%)';
    if (filterMode === 'contrast_boost') filterString += ' contrast(150%) saturate(130%)';
    if (filterMode === 'cyan_vfx') filterString += ' hue-rotate(180deg) contrast(120%)';

    ctx.filter = filterString;

    // Draw base image
    ctx.drawImage(imageRef.current, 0, 0, canvas.width, canvas.height);

    // Restore context for drawing overlay shapes without CSS filters
    ctx.restore();

    // Draw all confirmed shapes
    shapes.forEach(shape => drawShapeOnCanvas(ctx, shape));

    // Draw current shape in progress
    if (currentShape) {
      drawShapeOnCanvas(ctx, currentShape);
    }
  }, [imageLoaded, imageDimensions, shapes, currentShape, brightness, contrast, rotation, filterMode]);

  const drawShapeOnCanvas = (ctx: CanvasRenderingContext2D, shape: Shape) => {
    ctx.save();
    ctx.strokeStyle = shape.color;
    ctx.fillStyle = shape.color;
    ctx.lineWidth = shape.lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (shape.type === 'brush' && shape.points && shape.points.length > 0) {
      ctx.beginPath();
      ctx.moveTo(shape.points[0].x, shape.points[0].y);
      for (let i = 1; i < shape.points.length; i++) {
        ctx.lineTo(shape.points[i].x, shape.points[i].y);
      }
      ctx.stroke();
    } else if (shape.type === 'rect' && shape.startX !== undefined && shape.startY !== undefined && shape.endX !== undefined && shape.endY !== undefined) {
      const x = Math.min(shape.startX, shape.endX);
      const y = Math.min(shape.startY, shape.endY);
      const w = Math.abs(shape.endX - shape.startX);
      const h = Math.abs(shape.endY - shape.startY);
      ctx.strokeRect(x, y, w, h);
    } else if (shape.type === 'circle' && shape.startX !== undefined && shape.startY !== undefined && shape.endX !== undefined && shape.endY !== undefined) {
      const radius = Math.sqrt(Math.pow(shape.endX - shape.startX, 2) + Math.pow(shape.endY - shape.startY, 2));
      ctx.beginPath();
      ctx.arc(shape.startX, shape.startY, radius, 0, 2 * Math.PI);
      ctx.stroke();
    } else if (shape.type === 'arrow' && shape.startX !== undefined && shape.startY !== undefined && shape.endX !== undefined && shape.endY !== undefined) {
      const headlen = 12;
      const dx = shape.endX - shape.startX;
      const dy = shape.endY - shape.startY;
      const angle = Math.atan2(dy, dx);

      ctx.beginPath();
      ctx.moveTo(shape.startX, shape.startY);
      ctx.lineTo(shape.endX, shape.endY);
      ctx.stroke();

      // Arrow head
      ctx.beginPath();
      ctx.moveTo(shape.endX, shape.endY);
      ctx.lineTo(shape.endX - headlen * Math.cos(angle - Math.PI / 6), shape.endY - headlen * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(shape.endX - headlen * Math.cos(angle + Math.PI / 6), shape.endY - headlen * Math.sin(angle + Math.PI / 6));
      ctx.closePath();
      ctx.fill();
    } else if (shape.type === 'text' && shape.startX !== undefined && shape.startY !== undefined && shape.text) {
      ctx.font = 'bold 16px sans-serif';
      ctx.fillStyle = shape.color;
      // Draw background tag box for text
      const textMetrics = ctx.measureText(shape.text);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(shape.startX - 6, shape.startY - 20, textMetrics.width + 12, 26);
      ctx.strokeStyle = shape.color;
      ctx.lineWidth = 1;
      ctx.strokeRect(shape.startX - 6, shape.startY - 20, textMetrics.width + 12, 26);

      ctx.fillStyle = shape.color;
      ctx.fillText(shape.text, shape.startX, shape.startY);
    }

    ctx.restore();
  };

  const getCanvasPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getCanvasPos(e);

    if (activeTool === 'text') {
      setTextPosition(pos);
      return;
    }

    setIsDrawing(true);
    if (activeTool === 'brush') {
      setCurrentShape({
        id: `s_${Date.now()}`,
        type: 'brush',
        color: selectedColor,
        lineWidth,
        points: [pos]
      });
    } else {
      setCurrentShape({
        id: `s_${Date.now()}`,
        type: activeTool,
        color: selectedColor,
        lineWidth,
        startX: pos.x,
        startY: pos.y,
        endX: pos.x,
        endY: pos.y
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !currentShape) return;
    const pos = getCanvasPos(e);

    if (currentShape.type === 'brush' && currentShape.points) {
      setCurrentShape({
        ...currentShape,
        points: [...currentShape.points, pos]
      });
    } else {
      setCurrentShape({
        ...currentShape,
        endX: pos.x,
        endY: pos.y
      });
    }
  };

  const handleMouseUp = () => {
    if (isDrawing && currentShape) {
      setShapes(prev => [...prev, currentShape]);
      setCurrentShape(null);
      setIsDrawing(false);
    }
  };

  const handleAddText = () => {
    if (!textInput.trim() || !textPosition) return;
    const newShape: Shape = {
      id: `s_${Date.now()}`,
      type: 'text',
      color: selectedColor,
      lineWidth: 2,
      startX: textPosition.x,
      startY: textPosition.y,
      text: textInput.trim()
    };
    setShapes(prev => [...prev, newShape]);
    setTextInput('');
    setTextPosition(null);
  };

  const handleUndo = () => {
    setShapes(prev => prev.slice(0, prev.length - 1));
  };

  const handleClearAll = () => {
    setShapes([]);
    setBrightness(100);
    setContrast(100);
    setRotation(0);
    setFilterMode('normal');
  };

  const handleSaveAndPost = () => {
    if (!canvasRef.current) return;
    const dataUrl = canvasRef.current.toDataURL('image/png');
    onSave(dataUrl);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-5xl h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Pencil className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                图片标注与画面编辑
                <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-normal">
                  {imageName}
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                可进行自由画笔、框选、方向箭头标示、文字意见以及调光/色彩滤镜处理
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleUndo}
              disabled={shapes.length === 0}
              className="flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 transition"
              title="撤销上一步"
            >
              <Undo className="w-3.5 h-3.5" />
              <span>撤销</span>
            </button>
            <button
              onClick={handleClearAll}
              className="flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs bg-slate-800 hover:bg-red-500/20 hover:text-red-300 text-slate-400 transition"
              title="重置全部更改"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>重置</span>
            </button>
            <div className="h-4 w-px bg-slate-800 mx-1" />
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toolbar Bar */}
        <div className="px-5 py-2.5 bg-slate-950/60 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Draw Tool Group */}
          <div className="flex items-center space-x-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => setActiveTool('brush')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md transition ${
                activeTool === 'brush' ? 'bg-indigo-600 text-white font-medium shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>画笔</span>
            </button>
            <button
              onClick={() => setActiveTool('rect')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md transition ${
                activeTool === 'rect' ? 'bg-indigo-600 text-white font-medium shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Square className="w-3.5 h-3.5" />
              <span>矩形框</span>
            </button>
            <button
              onClick={() => setActiveTool('circle')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md transition ${
                activeTool === 'circle' ? 'bg-indigo-600 text-white font-medium shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Circle className="w-3.5 h-3.5" />
              <span>圆圈</span>
            </button>
            <button
              onClick={() => setActiveTool('arrow')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md transition ${
                activeTool === 'arrow' ? 'bg-indigo-600 text-white font-medium shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ArrowRight className="w-3.5 h-3.5" />
              <span>箭头</span>
            </button>
            <button
              onClick={() => setActiveTool('text')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md transition ${
                activeTool === 'text' ? 'bg-indigo-600 text-white font-medium shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Type className="w-3.5 h-3.5" />
              <span>添加批注文字</span>
            </button>
          </div>

          {/* Color & Stroke */}
          <div className="flex items-center space-x-3">
            <span className="text-slate-500 font-medium">线条色彩:</span>
            <div className="flex items-center space-x-1.5">
              {colors.map(c => (
                <button
                  key={c.value}
                  onClick={() => setSelectedColor(c.value)}
                  style={{ backgroundColor: c.value }}
                  className={`w-5 h-5 rounded-full border border-slate-700 transition transform ${
                    selectedColor === c.value ? 'scale-125 ring-2 ring-indigo-400 ring-offset-2 ring-offset-slate-900' : 'hover:scale-110'
                  }`}
                  title={c.name}
                />
              ))}
            </div>

            <div className="h-4 w-px bg-slate-800 mx-1" />

            <div className="flex items-center space-x-2">
              <span className="text-slate-500">线宽:</span>
              <input
                type="range"
                min="2"
                max="12"
                value={lineWidth}
                onChange={e => setLineWidth(Number(e.target.value))}
                className="w-20 accent-indigo-500"
              />
              <span className="text-slate-400 font-mono w-4">{lineWidth}px</span>
            </div>
          </div>

          {/* Image Filters */}
          <div className="flex items-center space-x-2 bg-slate-900 px-3 py-1 rounded-lg border border-slate-800">
            <div className="flex items-center space-x-1 text-slate-400">
              <Sun className="w-3.5 h-3.5 text-amber-400" />
              <span>亮度</span>
              <input
                type="range"
                min="50"
                max="150"
                value={brightness}
                onChange={e => setBrightness(Number(e.target.value))}
                className="w-16 accent-amber-500"
              />
            </div>
            <div className="flex items-center space-x-1 text-slate-400 ml-2">
              <Contrast className="w-3.5 h-3.5 text-sky-400" />
              <span>对比度</span>
              <input
                type="range"
                min="50"
                max="150"
                value={contrast}
                onChange={e => setContrast(Number(e.target.value))}
                className="w-16 accent-sky-500"
              />
            </div>
            <button
              onClick={() => setRotation(r => (r + 90) % 360)}
              className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 ml-1"
              title="旋转 90 度"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Canvas Workspace */}
        <div className="flex-1 bg-slate-950/90 flex items-center justify-center p-4 relative overflow-hidden select-none">
          {!imageLoaded ? (
            <div className="flex flex-col items-center space-y-2 text-slate-400">
              <Sparkles className="w-8 h-8 text-indigo-400 animate-spin" />
              <p className="text-xs">正在载入图像材质...</p>
            </div>
          ) : (
            <div
              className="relative shadow-2xl rounded-lg border border-slate-800 overflow-hidden bg-black/40"
              style={{ width: imageDimensions.width, height: imageDimensions.height }}
            >
              <canvas
                ref={canvasRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                className="cursor-crosshair block"
              />

              {/* Text Input Overlay */}
              {textPosition && (
                <div
                  className="absolute z-20 flex items-center bg-slate-900 border border-indigo-500/80 p-1.5 rounded-lg shadow-xl"
                  style={{ left: textPosition.x, top: textPosition.y }}
                >
                  <input
                    type="text"
                    value={textInput}
                    onChange={e => setTextInput(e.target.value)}
                    placeholder="输入标注文字..."
                    className="bg-slate-950 border border-slate-800 px-2.5 py-1 text-xs rounded text-white focus:outline-none focus:border-indigo-400 w-48"
                    autoFocus
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleAddText();
                    }}
                  />
                  <button
                    onClick={handleAddText}
                    className="ml-1.5 px-2.5 py-1 bg-indigo-600 text-white text-xs rounded font-medium hover:bg-indigo-500"
                  >
                    确定
                  </button>
                  <button
                    onClick={() => setTextPosition(null)}
                    className="ml-1 p-1 text-slate-400 hover:text-slate-200"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-900 flex items-center justify-between">
          <div className="text-xs text-slate-400 flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>标注修改后可直接保存并发送回部门沟通频道</span>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
            >
              取消
            </button>
            <button
              onClick={handleSaveAndPost}
              className="flex items-center space-x-2 px-5 py-2 rounded-lg text-xs font-semibold bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-lg shadow-indigo-600/30 hover:brightness-110 active:scale-95 transition"
            >
              <Check className="w-4 h-4" />
              <span>保存编辑并发布至频道</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
