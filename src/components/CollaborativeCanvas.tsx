'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { CanvasStroke } from '@/types';

interface CollaborativeCanvasProps {
  selectedColor?: string;
  brushSize?: number;
  className?: string;
}

export const CollaborativeCanvas: React.FC<CollaborativeCanvasProps> = ({
  selectedColor = '#000000',
  brushSize = 3,
  className = 'border border-gray-300 rounded-lg'
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentStroke, setCurrentStroke] = useState<{ x: number; y: number }[]>([]);
  const [strokes, setStrokes] = useState<CanvasStroke[]>([]);
  const [strokeId, setStrokeId] = useState(0);

  const CANVAS_WIDTH = 1024;
  const CANVAS_HEIGHT = 576;

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    // Configure canvas drawing properties
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    console.log('Canvas initialized in offline mode to save Firebase quota');
  }, []);

  // Redraw canvas when strokes change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw all strokes
    strokes.forEach(stroke => {
      if (stroke.points.length < 2) return;

      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = brushSize;
      ctx.beginPath();

      // Move to first point
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);

      // Draw lines to subsequent points
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }

      ctx.stroke();
    });
  }, [strokes, brushSize]);

  const getCanvasPoint = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }, []);

  const startDrawing = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const point = getCanvasPoint(e);
    setIsDrawing(true);
    setCurrentStroke([point]);
  }, [getCanvasPoint]);

  const draw = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const point = getCanvasPoint(e);
    setCurrentStroke(prev => [...prev, point]);

    // Draw current stroke in real-time
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = selectedColor;
    ctx.lineWidth = brushSize;
    ctx.beginPath();

    if (currentStroke.length > 0) {
      ctx.moveTo(currentStroke[currentStroke.length - 1].x, currentStroke[currentStroke.length - 1].y);
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
    }
  }, [isDrawing, getCanvasPoint, selectedColor, brushSize, currentStroke]);

  const stopDrawing = useCallback(async () => {
    if (!isDrawing || currentStroke.length < 2) {
      setIsDrawing(false);
      setCurrentStroke([]);
      return;
    }

    // Save stroke locally (offline mode)
    const newStroke: CanvasStroke = {
      id: `local-${strokeId}`,
      userId: 'test-user',
      color: selectedColor,
      points: currentStroke,
      timestamp: new Date(),
    };

    setStrokes(prev => [...prev, newStroke]);
    setStrokeId(prev => prev + 1);
    setIsDrawing(false);
    setCurrentStroke([]);
  }, [isDrawing, currentStroke, selectedColor, strokeId]);

  // Handle touch events for mobile
  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const mouseEvent = new MouseEvent('mousedown', {
        clientX: touch.clientX,
        clientY: touch.clientY,
      });
      startDrawing(mouseEvent as any);
    }
  }, [startDrawing]);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const mouseEvent = new MouseEvent('mousemove', {
        clientX: touch.clientX,
        clientY: touch.clientY,
      });
      draw(mouseEvent as any);
    }
  }, [draw]);

  const handleTouchEnd = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    stopDrawing();
  }, [stopDrawing]);

  // Always allow drawing in test mode

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className={`w-full h-auto max-w-full cursor-crosshair ${className}`}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ touchAction: 'none' }}
      />
      
      {/* Canvas info */}
      <div className="absolute top-2 left-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
        {CANVAS_WIDTH} × {CANVAS_HEIGHT}
      </div>
      
      {/* Offline indicator */}
      <div className="absolute top-2 right-2 bg-orange-500 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
        <div className="w-2 h-2 bg-white rounded-full"></div>
        Offline Mode
      </div>
    </div>
  );
};