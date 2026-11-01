import {
  Contrast,
  FlipHorizontal2,
  Layers,
  Move,
  RotateCw,
  RotateCcw,
  Search,
  Sliders,
  Tag,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DicomModality, StudyFileRecord } from '../../shared/types';
import {
  getModalityPixelValue,
  parseDicomBytes,
  type ParsedDicomVolume,
  renderDicomFrameToRgba,
} from '../../shared/dicom/dicmParser';

interface DicomWorkstationProps {
  studyId: string;
  patientName: string;
  patientIdentifier: string;
  modality: DicomModality;
  studyDate: string;
  files: StudyFileRecord[];
}

interface WindowPreset {
  label: string;
  wc: number;
  ww: number;
}

const CT_PRESETS: WindowPreset[] = [
  { label: 'Pulmón', wc: -600, ww: 1500 },
  { label: 'Mediastino / Blando', wc: 50, ww: 350 },
  { label: 'Hueso', wc: 300, ww: 1500 },
  { label: 'Cerebro', wc: 40, ww: 80 },
];

export function DicomWorkstation({
  studyId,
  patientName,
  patientIdentifier,
  modality,
  studyDate,
  files,
}: DicomWorkstationProps) {
  const [sliceIndex, setSliceIndex] = useState(0);
  const [volumesCache, setVolumesCache] = useState<Record<string, ParsedDicomVolume>>({});
  const [loadingSlice, setLoadingSlice] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [windowCenter, setWindowCenter] = useState<number | undefined>(undefined);
  const [windowWidth, setWindowWidth] = useState<number | undefined>(undefined);
  const [invert, setInvert] = useState(false);
  const [zoom, setZoom] = useState(1.35);
  const [rotationDeg, setRotationDeg] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragTool, setDragTool] = useState<'wl' | 'pan'>('wl');
  const [showTags, setShowTags] = useState(false);
  const [tagFilter, setTagFilter] = useState('');

  const [cursorProbe, setCursorProbe] = useState<{
    x: number;
    y: number;
    value: number | null;
  } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragStartRef = useRef<{
    clientX: number;
    clientY: number;
    startWc: number;
    startWw: number;
    startPanX: number;
    startPanY: number;
  } | null>(null);

  const activeFile = files[sliceIndex] ?? files[0];
  const activeVolume = activeFile ? volumesCache[activeFile.id] : undefined;

  // Fetch and parse active DICOM slice binary
  useEffect(() => {
    if (!activeFile) return;
    if (volumesCache[activeFile.id]) return;

    let cancelled = false;
    setLoadingSlice(true);
    setLoadError(null);

    fetch(
      `/api/studies/${encodeURIComponent(studyId)}/files/${encodeURIComponent(activeFile.id)}/download?inline=1`,
      { credentials: 'include' }
    )
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`No se pudo cargar el objeto DICOM (${res.status})`);
        }
        const buf = await res.arrayBuffer();
        return parseDicomBytes(new Uint8Array(buf));
      })
      .then((parsed) => {
        if (cancelled) return;
        setVolumesCache((prev) => ({ ...prev, [activeFile.id]: parsed }));
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : 'Error al decodificar píxeles DICOM.');
      })
      .finally(() => {
        if (!cancelled) setLoadingSlice(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeFile, studyId, volumesCache]);

  const renderedSlice = useMemo(() => {
    if (!activeVolume) return null;
    try {
      return renderDicomFrameToRgba(activeVolume, {
        windowCenter,
        windowWidth,
        invert,
        frameIndex: 0,
      });
    } catch {
      return null;
    }
  }, [activeVolume, windowCenter, windowWidth, invert]);

  // Draw offscreen ImageData onto interactive viewport canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !renderedSlice) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const offscreen = document.createElement('canvas');
    offscreen.width = renderedSlice.width;
    offscreen.height = renderedSlice.height;
    const offCtx = offscreen.getContext('2d');
    if (!offCtx) return;

    const imgData = new ImageData(
      new Uint8ClampedArray(renderedSlice.rgba),
      renderedSlice.width,
      renderedSlice.height
    );
    offCtx.putImageData(imgData, 0, 0);

    ctx.save();
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.translate(canvas.width / 2 + pan.x, canvas.height / 2 + pan.y);
    ctx.rotate((rotationDeg * Math.PI) / 180);
    ctx.scale(zoom, zoom);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(offscreen, -renderedSlice.width / 2, -renderedSlice.height / 2);
    ctx.restore();
  }, [renderedSlice, zoom, pan, rotationDeg]);

  const handleResetView = useCallback(() => {
    setWindowCenter(undefined);
    setWindowWidth(undefined);
    setInvert(false);
    setZoom(1.35);
    setRotationDeg(0);
    setPan({ x: 0, y: 0 });
  }, []);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!renderedSlice) return;
    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      startWc: windowCenter ?? renderedSlice.appliedWindowCenter,
      startWw: windowWidth ?? renderedSlice.appliedWindowWidth,
      startPanX: pan.x,
      startPanY: pan.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (canvas && activeVolume && renderedSlice) {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const cx = (e.clientX - rect.left) * scaleX - (canvas.width / 2 + pan.x);
      const cy = (e.clientY - rect.top) * scaleY - (canvas.height / 2 + pan.y);

      const rad = (-rotationDeg * Math.PI) / 180;
      const rx = (cx * Math.cos(rad) - cy * Math.sin(rad)) / zoom;
      const ry = (cx * Math.sin(rad) + cy * Math.cos(rad)) / zoom;

      const imgX = Math.floor(rx + renderedSlice.width / 2);
      const imgY = Math.floor(ry + renderedSlice.height / 2);

      if (
        imgX >= 0 &&
        imgY >= 0 &&
        imgX < renderedSlice.width &&
        imgY < renderedSlice.height
      ) {
        const val = getModalityPixelValue(activeVolume, imgX, imgY, 0);
        setCursorProbe({ x: imgX, y: imgY, value: val });
      } else {
        setCursorProbe(null);
      }
    }

    if (!dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.clientX;
    const dy = e.clientY - dragStartRef.current.clientY;

    if (dragTool === 'wl') {
      const sensitivity = modality === 'CT' ? 3 : 4;
      setWindowWidth(Math.max(5, Math.round(dragStartRef.current.startWw + dx * sensitivity)));
      setWindowCenter(Math.round(dragStartRef.current.startWc - dy * sensitivity));
    } else {
      setPan({
        x: dragStartRef.current.startPanX + dx,
        y: dragStartRef.current.startPanY + dy,
      });
    }
  };

  const handleMouseUp = () => {
    dragStartRef.current = null;
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    if (files.length <= 1) return;
    e.preventDefault();
    setSliceIndex((prev) => {
      if (e.deltaY > 0) return Math.min(files.length - 1, prev + 1);
      return Math.max(0, prev - 1);
    });
  };

  const filteredTags = useMemo(() => {
    const tags = activeVolume?.metadata.tags ?? activeFile?.tags ?? [];
    const q = tagFilter.trim().toLowerCase();
    if (!q) return tags;
    return tags.filter(
      (t) =>
        t.tag.toLowerCase().includes(q) ||
        t.name.toLowerCase().includes(q) ||
        t.value.toLowerCase().includes(q)
    );
  }, [activeVolume, activeFile, tagFilter]);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 text-slate-100 shadow-xl">
      {/* Workstation Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-900 px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setDragTool('wl')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
              dragTool === 'wl'
                ? 'bg-teal-600 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
            title="Arrastre con el ratón para ajustar Centro y Ancho de Ventana"
          >
            <Contrast className="h-3.5 w-3.5" />
            Ventana (W/L)
          </button>

          <button
            type="button"
            onClick={() => setDragTool('pan')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
              dragTool === 'pan'
                ? 'bg-teal-600 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
            title="Arrastre con el ratón para desplazar la imagen"
          >
            <Move className="h-3.5 w-3.5" />
            Mover
          </button>

          <div className="mx-1 h-4 w-px bg-slate-700" />

          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(4, Number((z + 0.25).toFixed(2))))}
            className="rounded-lg bg-slate-800 p-1.5 text-slate-300 hover:bg-slate-700"
            title="Acercar"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.5, Number((z - 0.25).toFixed(2))))}
            className="rounded-lg bg-slate-800 p-1.5 text-slate-300 hover:bg-slate-700"
            title="Alejar"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setInvert((v) => !v)}
            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
              invert ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
            title="Invertir polaridad monocromática"
          >
            <FlipHorizontal2 className="h-3.5 w-3.5" />
            Negativo
          </button>
          <button
            type="button"
            onClick={() => setRotationDeg((r) => (r + 90) % 360)}
            className="rounded-lg bg-slate-800 p-1.5 text-slate-300 hover:bg-slate-700"
            title="Rotar 90 grados"
          >
            <RotateCw className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleResetView}
            className="inline-flex items-center gap-1 rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Restablecer
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {modality === 'CT' &&
            CT_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  setWindowCenter(preset.wc);
                  setWindowWidth(preset.ww);
                }}
                className="rounded-md border border-slate-700 bg-slate-800/90 px-2 py-1 text-[11px] font-medium text-teal-300 hover:border-teal-500 hover:bg-slate-800"
              >
                {preset.label}
              </button>
            ))}

          <button
            type="button"
            onClick={() => setShowTags((s) => !s)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
              showTags
                ? 'bg-indigo-600 text-white'
                : 'border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700'
            }`}
          >
            <Tag className="h-3.5 w-3.5" />
            Etiquetas DICOM ({filteredTags.length})
          </button>
        </div>
      </div>

      {/* Viewport + Optional Tag Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-12">
        <div className={showTags ? 'lg:col-span-7' : 'lg:col-span-12'}>
          <div className="relative flex min-h-[430px] items-center justify-center bg-slate-950 select-none">
            <canvas
              ref={canvasRef}
              width={540}
              height={440}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={() => {
                handleMouseUp();
                setCursorProbe(null);
              }}
              onWheel={handleWheel}
              className={`max-h-[460px] w-full object-contain ${
                dragTool === 'wl' ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'
              }`}
            />

            {/* Radiological Corner Overlays */}
            <div className="pointer-events-none absolute top-3 left-3 space-y-0.5 text-[11px] font-mono text-teal-300/90 drop-shadow">
              <div className="font-semibold text-white">{patientName}</div>
              <div>ID: {patientIdentifier}</div>
              <div>
                Modalidad: {modality} | Fecha: {studyDate}
              </div>
            </div>

            <div className="pointer-events-none absolute top-3 right-3 text-right text-[11px] font-mono text-slate-300 drop-shadow">
              {activeVolume && (
                <>
                  <div>
                    Matriz: {activeVolume.metadata.columns} x {activeVolume.metadata.rows} px
                  </div>
                  <div>
                    Profundidad: {activeVolume.metadata.bitsStored}-bit (
                    {activeVolume.metadata.pixelRepresentation === 1 ? 'Signed HU' : 'Unsigned'})
                  </div>
                </>
              )}
              <div className="text-teal-300">
                Corte: {sliceIndex + 1} / {Math.max(1, files.length)}
              </div>
            </div>

            {renderedSlice && (
              <div className="pointer-events-none absolute bottom-3 left-3 space-y-0.5 text-[11px] font-mono text-amber-300/95">
                <div>
                  WC: {renderedSlice.appliedWindowCenter} | WW: {renderedSlice.appliedWindowWidth}
                </div>
                <div className="text-slate-400">
                  Zoom: {Math.round(zoom * 100)}% | Rot: {rotationDeg}°
                </div>
              </div>
            )}

            <div className="pointer-events-none absolute bottom-3 right-3 text-right text-[11px] font-mono text-emerald-300">
              {cursorProbe && cursorProbe.value !== null ? (
                <div>
                  X:{cursorProbe.x} Y:{cursorProbe.y} |{' '}
                  {modality === 'CT'
                    ? `${Math.round(cursorProbe.value)} HU`
                    : `Señal: ${Math.round(cursorProbe.value)}`}
                </div>
              ) : (
                <div className="text-slate-500">Pase el cursor para medir intensidad/HU</div>
              )}
            </div>

            {loadingSlice && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-950/75 text-sm font-medium text-teal-300">
                Decodificando matriz de píxeles DICOM...
              </div>
            )}

            {loadError && !loadingSlice && (
              <div className="absolute inset-x-6 rounded-xl border border-amber-700/60 bg-slate-900/95 p-4 text-center text-xs text-amber-200">
                {loadError} Puede descargar el archivo .dcm original sin pérdida en el panel lateral
                para abrirlo en su estación PACS externa.
              </div>
            )}
          </div>

          {/* Bottom Controls: Slice Scrubber & Fine Window Sliders */}
          <div className="space-y-2.5 border-t border-slate-800 bg-slate-900/90 px-4 py-3 text-xs">
            {files.length > 1 && (
              <div className="flex items-center gap-3">
                <span className="inline-flex min-w-[115px] items-center gap-1.5 font-semibold text-teal-300">
                  <Layers className="h-3.5 w-3.5" />
                  Corte {sliceIndex + 1} de {files.length}
                </span>
                <input
                  type="range"
                  min={0}
                  max={files.length - 1}
                  value={sliceIndex}
                  onChange={(e) => setSliceIndex(Number(e.target.value))}
                  className="h-1.5 flex-1 accent-teal-500"
                />
              </div>
            )}

            {renderedSlice && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex items-center gap-2">
                  <Sliders className="h-3.5 w-3.5 text-slate-400" />
                  <span className="w-24 text-slate-300">
                    Centro ({renderedSlice.appliedWindowCenter}):
                  </span>
                  <input
                    type="range"
                    min={renderedSlice.minModalityValue}
                    max={renderedSlice.maxModalityValue}
                    value={windowCenter ?? renderedSlice.appliedWindowCenter}
                    onChange={(e) => setWindowCenter(Number(e.target.value))}
                    className="h-1.5 flex-1 accent-amber-400"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Contrast className="h-3.5 w-3.5 text-slate-400" />
                  <span className="w-24 text-slate-300">
                    Ancho ({renderedSlice.appliedWindowWidth}):
                  </span>
                  <input
                    type="range"
                    min={10}
                    max={Math.max(
                      200,
                      (renderedSlice.maxModalityValue - renderedSlice.minModalityValue) * 2
                    )}
                    value={windowWidth ?? renderedSlice.appliedWindowWidth}
                    onChange={(e) => setWindowWidth(Number(e.target.value))}
                    className="h-1.5 flex-1 accent-amber-400"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* DICOM Header Tag Inspector */}
        {showTags && (
          <div className="flex max-h-[530px] flex-col border-t border-slate-800 bg-slate-900 lg:col-span-5 lg:border-t-0 lg:border-l">
            <div className="border-b border-slate-800 p-3">
              <div className="mb-2 text-xs font-bold tracking-wide text-slate-200 uppercase">
                Inspector de Cabecera DICOM (NEMA PS3.6)
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute top-2.5 left-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  value={tagFilter}
                  onChange={(e) => setTagFilter(e.target.value)}
                  placeholder="Filtrar por etiqueta (0010,0010), VR o nombre..."
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 py-1.5 pr-3 pl-8 text-xs text-slate-100 placeholder-slate-500 focus:border-teal-500 focus:outline-none"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-left text-[11px]">
                <thead className="sticky top-0 bg-slate-800 text-slate-300">
                  <tr>
                    <th className="px-2.5 py-1.5 font-semibold">Tag</th>
                    <th className="px-1.5 py-1.5 font-semibold">VR</th>
                    <th className="px-2.5 py-1.5 font-semibold">Atributo / Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {filteredTags.map((t) => (
                    <tr key={`${t.tag}-${t.name}`} className="hover:bg-slate-800/50">
                      <td className="px-2.5 py-1.5 font-mono whitespace-nowrap text-teal-400">
                        {t.tag}
                      </td>
                      <td className="px-1.5 py-1.5 font-mono text-amber-300">{t.vr}</td>
                      <td className="px-2.5 py-1.5">
                        <div className="font-medium text-slate-200">{t.name}</div>
                        <div className="break-all font-mono text-slate-400">{t.value}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
