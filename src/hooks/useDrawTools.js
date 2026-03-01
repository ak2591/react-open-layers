export function useDrawTools(terraDrawRef, setSelectMode) {
  const activateCircleDraw = () => {
    if (!terraDrawRef.current) return;
    terraDrawRef.current.clear();
    terraDrawRef.current.setMode('circle');
    setSelectMode('circle');
  };

  const activateRectangleDraw = () => {
    if (!terraDrawRef.current) return;
    terraDrawRef.current.clear();
    terraDrawRef.current.setMode('rectangle');
    setSelectMode('rectangle');
  };

  const activateFreehandDraw = () => {
    if (!terraDrawRef.current) return;
    terraDrawRef.current.clear();
    terraDrawRef.current.setMode('freehand');
    setSelectMode('freehand');
  };

  const activatePolygonDraw = () => {
    if (!terraDrawRef.current) return;
    terraDrawRef.current.clear();
    terraDrawRef.current.setMode('polygon');
    setSelectMode('polygon');
  };

  const activateLineDraw = () => {
    if (!terraDrawRef.current) return;
    terraDrawRef.current.clear();
    terraDrawRef.current.setMode('linestring');
    setSelectMode('linestring');
  };

  const activatePointDraw = () => {
    if (!terraDrawRef.current) return;
    terraDrawRef.current.clear();
    terraDrawRef.current.setMode('point');
    setSelectMode('point');
  };

  const clearSelections = () => {
    if (terraDrawRef.current) {
      terraDrawRef.current.clear();
      terraDrawRef.current.setMode('static');
    }
    setSelectMode('none');
  };

  return {
    activateCircleDraw,
    activateRectangleDraw,
    activateFreehandDraw,
    activatePolygonDraw,
    activateLineDraw,
    activatePointDraw,
    clearSelections,
  };
}
