import { toLonLat, fromLonLat } from 'ol/proj';
import { Polygon } from 'ol/geom';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Style, Fill, Stroke, Circle } from 'ol/style';
import { Draw } from 'ol/interaction';
import { proj4, transformCoordinates, calculateAreaInEPSG4547 } from '@/utils/coordinate';
import { createPoints, updatePoints, deletePoints, createLands, updateLands, deleteLands } from '@/services/api';
import { useVectorStore } from '@/stores/vectorStore';

export function useFeature(map, layers, updateVectorLayer, getPointModify, getLandsModify, clearHighlight) {
  const vectorStore = useVectorStore()

  // ==================== 工具函数 ====================
  function resetForms() { vectorStore.resetForms() }

  // 计算用地面积（从多种来源获取坐标）
  function calcArea() {
    let coords = null

    if (window._tempImportGeometry?.layerType === 'lands' && window._tempImportGeometry.type === 'Polygon') {
      coords = window._tempImportGeometry.coordinates
    }
    if (!coords && vectorStore.selectedFeature?.layerType === 'lands') {
      const src = layers.value.lands.layer?.getSource()
      const f = src?.getFeatures().find(f => f.get('id') === vectorStore.selectedFeature.id)
      if (f?.getGeometry()) coords = f.getGeometry().getCoordinates().map(r => r.map(c => toLonLat(c)))
    }
    if (!coords && vectorStore.drawFeature) {
      const g = vectorStore.drawFeature.getGeometry()
      if (g?.getType() === 'Polygon') coords = g.getCoordinates().map(r => r.map(c => toLonLat(c)))
    }
    if (!coords) { alert('请先绘制或选择用地'); return }
    vectorStore.updateLandsForm({ site_area: Math.round(calculateAreaInEPSG4547(coords)) })
  }

  // ==================== 绘制 ====================
  function startDrawing(layerKey) {
    resetForms()
    layerKey === 'points' ? pointDraw() : landsDraw()
  }

  function pointDraw() {
    cleanupDraw()
    vectorStore.setIsDrawing(true)
    const source = new VectorSource()
    const layer = new VectorLayer({
      source,
      style: new Style({ image: new Circle({ radius: 4, fill: new Fill({ color: 'purple' }) }) })
    })
    map.value.addLayer(layer)
    vectorStore.setDrawLayer(layer)

    const draw = new Draw({ source, type: 'Point', style: layer.getStyle() })
    draw.on('drawend', e => { vectorStore.setDrawFeature(e.feature); vectorStore.setShowPointForm(true) })
    map.value.addInteraction(draw)
    vectorStore.setDrawInteraction(draw)

    const onEsc = e => { if (e.key === 'Escape' && vectorStore.isDrawing) { cancelDraw(); document.removeEventListener('keydown', onEsc) } }
    document.addEventListener('keydown', onEsc)
    vectorStore.setDrawHandler('esc', onEsc)
  }

  function landsDraw() {
    cleanupDraw()
    vectorStore.setIsDrawing(true)
    const source = new VectorSource()
    const layer = new VectorLayer({
      source,
      style: new Style({
        fill: new Fill({ color: 'rgba(50, 0, 100, 0.3)' }),
        stroke: new Stroke({ color: 'purple', width: 1.5 })
      })
    })
    map.value.addLayer(layer)
    vectorStore.setDrawLayer(layer)

    const draw = new Draw({ source, type: 'Polygon', style: layer.getStyle() })
    draw.on('drawend', e => { vectorStore.setDrawFeature(e.feature); vectorStore.setShowLandsForm(true); removeBackspaceListener() })
    map.value.addInteraction(draw)
    vectorStore.setDrawInteraction(draw)

    const onBackspace = e => { if (e.key === 'Backspace' && vectorStore.isDrawing) { e.preventDefault(); draw?.removeLastPoint?.() } }
    const onEsc = e => { if (e.key === 'Escape' && vectorStore.isDrawing) cancelDraw() }
    document.addEventListener('keydown', onBackspace)
    document.addEventListener('keydown', onEsc)
    vectorStore.setDrawHandler('backspace', onBackspace)
    vectorStore.setDrawHandler('esc', onEsc)
  }

  function cleanupDraw() {
    if (vectorStore.drawInteraction) map.value.removeInteraction(vectorStore.drawInteraction)
  }

  function removeBackspaceListener() {
    if (vectorStore.drawHandlers.backspace) {
      document.removeEventListener('keydown', vectorStore.drawHandlers.backspace)
      vectorStore.setDrawHandler('backspace', null)
    }
  }

  function cancelDraw() {
    if (window._tempImportGeometry && window._resolveImport) {
      vectorStore.setShowLandsForm(false)
      vectorStore.setShowPointForm(false)
      const r = window._resolveImport
      delete window._tempImportGeometry
      delete window._resolveImport
      r?.()
      return
    }
    vectorStore.setShowLandsForm(false)
    vectorStore.setShowPointForm(false)
    resetForms()
    vectorStore.setDrawFeature(null)
    vectorStore.setIsDrawing(false)

    Object.entries(vectorStore.drawHandlers).forEach(([k, h]) => {
      if (h) { document.removeEventListener('keydown', h); vectorStore.setDrawHandler(k, null) }
    })
    if (vectorStore.drawInteraction) { map.value.removeInteraction(vectorStore.drawInteraction); vectorStore.setDrawInteraction(null) }
    if (vectorStore.drawLayer) { map.value.removeLayer(vectorStore.drawLayer); vectorStore.setDrawLayer(null) }
  }

  // ==================== 编辑 ====================
  function toggleEditMode(feature) {
    if (!feature) return
    const layerObj = layers.value[feature.layerType]
    if (!layerObj?.loaded) return

    if (!vectorStore.isEditing) {
      vectorStore.setIsEditing(true)
      const src = layerObj.layer.getSource()
      const f = src?.getFeatures().find(f => f.get('id') === feature.id)
      if (f) {
        vectorStore.setOriginalGeometry(f.getGeometry().clone())
        const modify = feature.layerType === 'points' ? getPointModify() : getLandsModify()
        if (modify) modify.setActive(true)
      }
    } else {
      openEditForm(feature)
    }
  }

  function exitEditMode() {
    if (clearHighlight) clearHighlight()
    if (vectorStore.originalGeometry && vectorStore.selectedFeature) {
      const src = layers.value[vectorStore.selectedFeature.layerType].layer.getSource()
      const f = src.getFeatures().find(f => f.get('id') === vectorStore.selectedFeature.id)
      if (f) f.setGeometry(vectorStore.originalGeometry.clone())
      vectorStore.setOriginalGeometry(null)
    }
    const pm = getPointModify(); if (pm) pm.setActive(false)
    const lm = getLandsModify(); if (lm) lm.setActive(false)
    vectorStore.setIsEditing(false)
  }

  function openEditForm(feature) {
    if (feature.layerType === 'points') {
      vectorStore.updatePointsForm({
        name: feature.name || '', level: feature.level || '', type: feature.type || '',
        floor_area: feature.floor_area || null, scale: feature.scale || null
      })
      vectorStore.setShowPointForm(true)
    } else {
      vectorStore.updateLandsForm({
        name: feature.name || '', type: feature.type || '', site_area: feature.site_area || null
      })
      vectorStore.setShowLandsForm(true)
    }
  }

  // ==================== 保存 ====================
  async function savePointToDatabase() {
    try {
      const form = vectorStore.pointsForm
      if (!form.name) return

      // 导入模式：从临时几何数据创建
      if (window._tempImportGeometry) {
        const { type, coordinates, layerType } = window._tempImportGeometry
        const res = await createPoints({
          name: form.name, level: form.level, type: form.type,
          floor_area: form.floor_area || 0, scale: form.scale || 0,
          geometry: { type, coordinates: type === 'Point' ? [Number(coordinates[0]), Number(coordinates[1])] : coordinates }
        })
        if (res.success) {
          const lo = layers.value[layerType]
          if (lo.loaded) { await vectorStore.loadPoints(); updateVectorLayer(layerType) }
          vectorStore.setShowPointForm(false)
          if (window._resolveImport) window._resolveImport()
        }
        return
      }

      if (vectorStore.selectedFeature?.id) {
        // 更新已有要素
        const id = vectorStore.selectedFeature.id
        const src = layers.value.points.layer?.getSource()
        const f = src?.getFeatures().find(f => f.get('id') === id)
        const geometry = f ? { type: 'Point', coordinates: toLonLat(f.getGeometry().getCoordinates()) } : vectorStore.selectedFeature.geometry
        const data = { name: form.name, level: form.level, type: form.type, floor_area: form.floor_area || 0, scale: form.scale || 0, geometry }
        const res = await updatePoints(id, data)
        if (res.success) {
          if (f) { ['name','level','type','floor_area','scale'].forEach(k => f.set(k, data[k])) }
          vectorStore.points[vectorStore.points.findIndex(p => p.id === id)] = { ...vectorStore.points.find(p => p.id === id), ...data, id }
          finishEdit()
        }
      } else {
        // 新建
        if (!vectorStore.drawFeature) return
        const res = await createPoints({
          name: form.name, level: form.level, type: form.type,
          floor_area: form.floor_area || 0, scale: form.scale || 0,
          geometry: { type: 'Point', coordinates: toLonLat(vectorStore.drawFeature.getGeometry().getCoordinates()) }
        })
        if (res.success) {
          const nf = vectorStore.drawFeature.clone()
          nf.set('id', res.data.id); nf.set('name', form.name); nf.set('level', form.level)
          nf.set('type', form.type); nf.set('floor_area', form.floor_area); nf.set('scale', form.scale); nf.set('layerType', 'points')
          layers.value.points.layer?.getSource()?.addFeature(nf)
          vectorStore.points.push(res.data)
          alert('绘制成功！'); cancelDraw()
        }
      }
    } catch (error) { alert('保存失败：' + error.message) }
  }

  async function saveLandsToDatabase() {
    try {
      const form = vectorStore.landsForm
      if (!form.name) return

      if (window._tempImportGeometry) {
        const { type, coordinates, layerType } = window._tempImportGeometry
        let fc = coordinates
        if (type === 'Polygon') fc = coordinates.map(r => r.map(p => [Number(p[0]), Number(p[1])]))
        else if (type === 'Point') fc = [Number(coordinates[0]), Number(coordinates[1])]
        const res = await createLands({ name: form.name, type: form.type, site_area: form.site_area || 0, geometry: { type, coordinates: fc } })
        if (res?.success) {
          const lo = layers.value[layerType]
          if (lo?.loaded) { await vectorStore.loadLands(); updateVectorLayer(layerType) }
          vectorStore.setShowLandsForm(false)
          delete window._tempImportGeometry
          if (window._resolveImport) window._resolveImport()
        }
        return
      }

      if (vectorStore.selectedFeature?.id) {
        const id = vectorStore.selectedFeature.id
        const src = layers.value.lands.layer?.getSource()
        const f = src?.getFeatures().find(f => f.get('id') === id)
        const geometry = f ? { type: 'Polygon', coordinates: f.getGeometry().getCoordinates().map(r => r.map(c => toLonLat(c))) } : vectorStore.selectedFeature.geometry
        const data = { name: form.name, type: form.type, site_area: form.site_area || 0, geometry }
        const res = await updateLands(id, data)
        if (res.success) {
          if (f) { ['name','type','site_area'].forEach(k => f.set(k, data[k])) }
          vectorStore.lands[vectorStore.lands.findIndex(l => l.id === id)] = { ...vectorStore.lands.find(l => l.id === id), ...data, id }
          finishEdit()
        }
      } else {
        if (!vectorStore.drawFeature) return
        const res = await createLands({
          name: form.name, type: form.type, site_area: form.site_area || 0,
          geometry: { type: 'Polygon', coordinates: vectorStore.drawFeature.getGeometry().getCoordinates().map(r => r.map(c => toLonLat(c))) }
        })
        if (res.success) {
          const nf = vectorStore.drawFeature.clone()
          nf.set('id', res.data.id); nf.set('name', form.name); nf.set('type', form.type)
          nf.set('site_area', form.site_area); nf.set('layerType', 'lands')
          layers.value.lands.layer?.getSource()?.addFeature(nf)
          vectorStore.lands.push(res.data)
          alert('绘制成功！'); cancelDraw()
        }
      }
    } catch (error) { alert('保存失败：' + error.message) }
  }

  // 编辑/保存完成后的收尾工作
  function finishEdit() {
    alert('更新成功！')
    const pm = getPointModify(); if (pm) pm.setActive(false)
    const lm = getLandsModify(); if (lm) lm.setActive(false)
    vectorStore.selectedFeature = null
    vectorStore.popupPosition = null
    vectorStore.setIsEditing(false)
    vectorStore.setOriginalGeometry(null)
    vectorStore.setShowPointForm(false)
    vectorStore.setShowLandsForm(false)
  }

  // ==================== 删除 ====================
  async function deleteFeature(featureId) {
    if (!vectorStore.selectedFeature) return
    const lt = vectorStore.selectedFeature.layerType
    if (!confirm(`确定要删除这个${lt === 'points' ? '设施' : '图形'}吗？`)) return
    try {
      lt === 'points' ? await deletePoints(featureId) : await deleteLands(featureId)
      const src = layers.value[lt]?.layer?.getSource()
      const f = src?.getFeatures().find(f => f.get('id') === featureId)
      if (f) src.removeFeature(f)
      if (lt === 'points') vectorStore.points = vectorStore.points.filter(i => i.id !== featureId)
      else vectorStore.lands = vectorStore.lands.filter(i => i.id !== featureId)
      vectorStore.closePopup()
      alert('删除成功')
    } catch {
      const src = layers.value[lt]?.layer?.getSource()
      const f = src?.getFeatures().find(f => f.get('id') === featureId)
      if (f) src.removeFeature(f)
      vectorStore.closePopup()
    }
  }

  // ==================== 导入导出 ====================
  function handleImport(layerType) {
    vectorStore.setImportLayerType(layerType)
    const input = document.createElement('input')
    input.type = 'file'; input.accept = '.geojson'
    input.onchange = e => { const file = e.target.files[0]; if (file) readGeoJSONFile(file) }
    input.click()
  }

  function readGeoJSONFile(file) {
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const geojson = JSON.parse(e.target.result)
        const lt = vectorStore.importLayerType
        const features = (geojson.features || [geojson]).filter(f => {
          const t = f.geometry?.type
          return lt === 'lands' ? (t === 'Polygon' || t === 'MultiPolygon') : (t === 'Point' || t === 'MultiPoint')
        })
        if (features.length === 0) { alert(`文件中没有有效的${lt === 'points' ? 'Point' : 'Polygon'}数据`); return }
        vectorStore.setImportFeatures(features)
        showCoordDialog()
      } catch { alert('文件解析失败，请确保是有效的 GeoJSON 文件') }
    }
    reader.readAsText(file, 'UTF-8')
  }

  // 通用坐标系选择弹窗（导入/导出共用）
  function showCoordDialog() {
    const mask = document.createElement('div')
    mask.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:9998'
    const select = document.createElement('select')
    select.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:9999;padding:10px;background:white;border:2px solid #409eff;border-radius:5px;width:300px'
    select.innerHTML = '<option value="" disabled selected hidden>请选择坐标系</option><option value="EPSG:4547">CGCS2000_3度带_114E</option><option value="EPSG:4326">WGS84_经纬度</option>'
    const btn = document.createElement('div')
    btn.style.cssText = 'position:fixed;top:calc(50% + 50px);left:50%;transform:translateX(-50%);z-index:9999;display:flex;gap:10px'
    const ok = document.createElement('button')
    ok.textContent = '确定'; ok.style.cssText = 'padding:5px 15px;background:#409eff;color:white;border:none;border-radius:3px;cursor:pointer'
    const cancel = document.createElement('button')
    cancel.textContent = '取消'; cancel.style.cssText = 'padding:5px 15px;background:#ccc;color:#333;border:none;border-radius:3px;cursor:pointer'
    btn.append(ok, cancel)
    document.body.append(mask, select, btn)
    const close = () => { [mask, select, btn].forEach(el => el.remove()) }
    ok.onclick = () => {
      const epsg = select.value
      if (!epsg) { alert('请选择坐标系'); return }
      close()
      if (epsg === 'EPSG:4547' && !proj4.defs('EPSG:4547')) {
        proj4.defs('EPSG:4547', '+proj=tmerc +lat_0=0 +lon_0=114 +k=1 +x_0=500000 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs')
      }
      importWithTransform(epsg)
    }
    cancel.onclick = () => { close(); vectorStore.setImportFeatures([]); vectorStore.setImportLayerType(null) }
  }

  async function importWithTransform(sourceEPSG) {
    const targetEPSG = 'EPSG:4326'
    let successCount = 0
    for (const feature of vectorStore.importFeatures) {
      let { type: geomType, coordinates } = feature.geometry
      if (geomType === 'MultiPolygon') { geomType = 'Polygon'; coordinates = coordinates[0] }
      if (geomType === 'MultiPoint') { geomType = 'Point'; coordinates = coordinates[0] }
      if (sourceEPSG !== targetEPSG) {
        try { coordinates = transformCoordinates(coordinates, sourceEPSG, targetEPSG, geomType) }
        catch { alert('坐标转换失败'); return }
      }
      const props = feature.properties || {}
      const lt = vectorStore.importLayerType
      if (lt === 'points') {
        vectorStore.updatePointsForm({ name: props.name || '', level: props.level || '', type: props.type || '', floor_area: props.floor_area || null, scale: props.scale || null })
      } else {
        vectorStore.updateLandsForm({ name: props.name || '', type: props.type || '', site_area: props.site_area || null })
        if (!vectorStore.landsForm.site_area && geomType === 'Polygon') {
          vectorStore.updateLandsForm({ site_area: Math.round(new Polygon(coordinates.map(r => r.map(c => fromLonLat(c)))).getArea()) })
        }
      }
      window._tempImportGeometry = { type: geomType, coordinates, layerType: lt }
      lt === 'points' ? vectorStore.setShowPointForm(true) : vectorStore.setShowLandsForm(true)
      await new Promise(r => window._resolveImport = r)
      successCount++
    }
    alert(`成功导入 ${successCount} 个要素`)
    vectorStore.setImportFeatures([]); vectorStore.setImportLayerType(null)
    delete window._tempImportGeometry; delete window._resolveImport
  }

  async function handleExport(layerType) {
    const layerObj = layers.value[layerType]
    if (!layerObj?.layer) { alert('请先加载图层数据'); return }
    const features = layerObj.layer.getSource().getFeatures()
    if (features.length === 0) { alert('没有可导出的要素'); return }
    showCoordDialog()  // 复用坐标选择弹窗
  }

  async function exportSingleFeature(feature) {
    if (!feature) return
    const layerType = feature.layerType
    const geomType = layerType === 'points' ? 'Point' : 'Polygon'
    const src = layers.value[layerType]?.layer?.getSource()
    const mapFeature = src?.getFeatures().find(f => f.get('id') === feature.id)
    if (!mapFeature) { alert('未找到要素数据'); return }

    // 坐标选择弹窗
    const mask = document.createElement('div')
    mask.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:9998'
    const select = document.createElement('select')
    select.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:9999;padding:10px;background:white;border:2px solid #409eff;border-radius:5px;width:300px'
    select.innerHTML = '<option value="" disabled selected hidden>请选择坐标系</option><option value="EPSG:4547">CGCS2000_3度带_114E</option><option value="EPSG:4326">WGS84_经纬度</option>'
    const btn = document.createElement('div')
    btn.style.cssText = 'position:fixed;top:calc(50% + 50px);left:50%;transform:translateX(-50%);z-index:9999;display:flex;gap:10px'
    const ok = document.createElement('button')
    ok.textContent = '确定'; ok.style.cssText = 'padding:5px 15px;background:#409eff;color:white;border:none;border-radius:3px;cursor:pointer'
    const cancel = document.createElement('button')
    cancel.textContent = '取消'; cancel.style.cssText = 'padding:5px 15px;background:#ccc;color:#333;border:none;border-radius:3px;cursor:pointer'
    btn.append(ok, cancel)
    document.body.append(mask, select, btn)
    const close = () => { [mask, select, btn].forEach(el => el.remove()) }

    ok.onclick = () => {
      const targetEPSG = select.value
      if (!targetEPSG) { alert('请选择坐标系'); return }
      close()
      const geometry = mapFeature.getGeometry()
      let coordinates = geomType === 'Point'
        ? toLonLat(geometry.getCoordinates())
        : geometry.getCoordinates().map(r => r.map(c => toLonLat(c)))
      if (targetEPSG === 'EPSG:4547') {
        coordinates = geomType === 'Point'
          ? proj4('EPSG:4326', 'EPSG:4547', coordinates)
          : coordinates.map(r => r.map(c => proj4('EPSG:4326', 'EPSG:4547', c)))
      }
      const properties = { name: feature.name, type: feature.type }
      if (layerType === 'points') Object.assign(properties, { level: feature.level, floor_area: feature.floor_area, scale: feature.scale })
      else properties.site_area = feature.site_area
      downloadGeoJSON([{ type: 'Feature', geometry: { type: geomType, coordinates }, properties }],
        `${layerType === 'points' ? '设施点' : '设施用地'}_${feature.name || '要素'}`)
    }
    cancel.onclick = close
  }

  // 导出 GeoJSON 文件
  function downloadGeoJSON(features, filename) {
    const geojson = { type: 'FeatureCollection', features }
    const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.download = `${filename}_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.geojson`
    a.href = url; a.click()
    URL.revokeObjectURL(url)
  }

  return {
    startDrawing, cancelDraw, toggleEditMode, exitEditMode, openEditForm,
    savePointToDatabase, saveLandsToDatabase, deleteFeature,
    handleImport, handleExport, exportSingleFeature, calcArea,
  }
}
