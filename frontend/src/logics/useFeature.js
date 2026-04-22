// 引入相关模块
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
  function resetForms() {
    vectorStore.resetForms()
  }

  function calcArea() {
    let coordinates4326 = null

    if (window._tempImportGeometry?.layerType === 'lands') {
      const { coordinates, type } = window._tempImportGeometry
      if (type === 'Polygon') coordinates4326 = coordinates
    }

    if (!coordinates4326 && vectorStore.selectedFeature?.layerType === 'lands') {
      const source = layers.value.lands.layer?.getSource()
      const mapFeature = source?.getFeatures().find(f => f.get('id') === vectorStore.selectedFeature.id)
      if (mapFeature?.getGeometry()) {
        coordinates4326 = mapFeature.getGeometry().getCoordinates().map(ring => ring.map(coord => toLonLat(coord)))
      }
    }

    if (!coordinates4326 && vectorStore.drawFeature) {
      const geom = vectorStore.drawFeature.getGeometry()
      if (geom?.getType() === 'Polygon') {
        coordinates4326 = geom.getCoordinates().map(ring => ring.map(coord => toLonLat(coord)))
      }
    }

    if (!coordinates4326) {
      alert('请先绘制或选择用地')
      return
    }

    vectorStore.updateLandsForm({ site_area: Math.round(calculateAreaInEPSG4547(coordinates4326)) })
  }

  // ==================== 图形绘制 ====================

  // 开始绘制新要素
  function startDrawing(layerKey) {
    resetForms();
    layerKey === 'points' ? pointDraw() : landsDraw()
  }

  // 设施点绘制函数
  function pointDraw() {
    const currentInteraction = vectorStore.drawInteraction
    if (currentInteraction) map.value.removeInteraction(currentInteraction)
    vectorStore.setIsDrawing(true)

    const source = new VectorSource()
    const drawLayer = new VectorLayer({
      source,
      style: new Style({ image: new Circle({ radius: 4, fill: new Fill({ color: 'purple' }) }) })
    })
    map.value.addLayer(drawLayer)
    vectorStore.setDrawLayer(drawLayer)

    const drawInteraction = new Draw({
      source,
      type: 'Point',
      style: new Style({ image: new Circle({ radius: 4, fill: new Fill({ color: 'purple' }) }) })
    })
    drawInteraction.on('drawend', (event) => {
      vectorStore.setDrawFeature(event.feature)
      vectorStore.setShowPointForm(true)
    })
    map.value.addInteraction(drawInteraction)
    vectorStore.setDrawInteraction(drawInteraction)

    const escHandler = (e) => {
      if (e.key === 'Escape' && vectorStore.isDrawing) {
        cancelDraw();
        document.removeEventListener('keydown', escHandler)
      }
    }
    document.addEventListener('keydown', escHandler)
    vectorStore.setDrawHandler('esc', escHandler)
  }

  // 设施用地绘制函数
  function landsDraw() {
    const currentInteraction = vectorStore.drawInteraction
    if (currentInteraction) map.value.removeInteraction(currentInteraction)
    vectorStore.setIsDrawing(true)

    const source = new VectorSource()
    const drawLayer = new VectorLayer({
      source,
      style: new Style({
        fill: new Fill({ color: 'rgba(50, 0, 100, 0.3)' }),
        stroke: new Stroke({ color: 'purple', width: 1.5 })
      })
    })
    map.value.addLayer(drawLayer)
    vectorStore.setDrawLayer(drawLayer)

    const drawInteraction = new Draw({
      source,
      type: 'Polygon',
      style: new Style({
        fill: new Fill({ color: 'rgba(50, 0, 100, 0.3)' }),
        stroke: new Stroke({ color: 'purple', width: 1.5 })
      })
    })
    drawInteraction.on('drawend', (event) => {
      vectorStore.setDrawFeature(event.feature)
      vectorStore.setShowLandsForm(true)
      removeBackspaceListener()
    })
    map.value.addInteraction(drawInteraction)
    vectorStore.setDrawInteraction(drawInteraction)

    const backspaceHandler = (e) => {
      if (e.key === 'Backspace' && vectorStore.isDrawing) {
        e.preventDefault();
        drawInteraction?.removeLastPoint?.()
      }
    }
    const escHandler = (e) => {
      if (e.key === 'Escape' && vectorStore.isDrawing) cancelDraw()
    }
    document.addEventListener('keydown', backspaceHandler)
    document.addEventListener('keydown', escHandler)
    vectorStore.setDrawHandler('backspace', backspaceHandler)
    vectorStore.setDrawHandler('esc', escHandler)
  }

  // 键盘退格绘制函数
  function removeBackspaceListener() {
    const handlers = vectorStore.drawHandlers
    if (handlers.backspace) {
      document.removeEventListener('keydown', handlers.backspace)
      vectorStore.setDrawHandler('backspace', null)
    }
  }

  // 取消绘制
  function cancelDraw() {
    if (window._tempImportGeometry && window._resolveImport) {
      vectorStore.setShowLandsForm(false)
      vectorStore.setShowPointForm(false)
      const resolve = window._resolveImport
      delete window._tempImportGeometry
      delete window._resolveImport
      resolve?.()
      return
    }

    vectorStore.setShowLandsForm(false)
    vectorStore.setShowPointForm(false)
    resetForms()
    vectorStore.setDrawFeature(null)
    vectorStore.setIsDrawing(false)

    const handlers = vectorStore.drawHandlers
    Object.entries(handlers).forEach(([key, handler]) => {
      if (handler) {
        document.removeEventListener('keydown', handler)
        vectorStore.setDrawHandler(key, null)
      }
    })

    if (vectorStore.drawInteraction) {
      map.value.removeInteraction(vectorStore.drawInteraction)
      vectorStore.setDrawInteraction(null)
    }
    if (vectorStore.drawLayer) {
      map.value.removeLayer(vectorStore.drawLayer)
      vectorStore.setDrawLayer(null)
    }
  }

  // ==================== 图形编辑 ====================
  function toggleEditMode(feature) {
    if (!feature) return
    const layerObj = layers.value[feature.layerType]
    if (!layerObj?.loaded) return

    if (!vectorStore.isEditing) {
      vectorStore.setIsEditing(true)
      const source = layerObj.layer.getSource()
      const mapFeature = source?.getFeatures().find(f => f.get('id') === feature.id)
      if (mapFeature) {
        vectorStore.setOriginalGeometry(mapFeature.getGeometry().clone())
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
      const layerObj = layers.value[vectorStore.selectedFeature.layerType]
      const source = layerObj.layer.getSource()
      const mapFeature = source.getFeatures().find(f => f.get('id') === vectorStore.selectedFeature.id)
      if (mapFeature) mapFeature.setGeometry(vectorStore.originalGeometry.clone())
      vectorStore.setOriginalGeometry(null)
    }
    const pointModify = getPointModify()
    const landsModify = getLandsModify()
    if (pointModify) pointModify.setActive(false)
    if (landsModify) landsModify.setActive(false)
    vectorStore.setIsEditing(false)
  }

  function openEditForm(feature) {
    if (feature.layerType === 'points') {
      vectorStore.updatePointsForm({
        name: feature.name || '',
        level: feature.level || '',
        type: feature.type || '',
        floor_area: feature.floor_area || null,
        scale: feature.scale || null
      })
      vectorStore.setShowPointForm(true)
    } else {
      vectorStore.updateLandsForm({
        name: feature.name || '',
        type: feature.type || '',
        site_area: feature.site_area || null
      })
      vectorStore.setShowLandsForm(true)
    }
  }

  // ==================== 数据保存 ====================
  async function savePointToDatabase() {
    try {
      const form = vectorStore.pointsForm
      if (!form.name) return

      if (window._tempImportGeometry) {
        const { type, coordinates, layerType } = window._tempImportGeometry
        const response = await createPoints({
          name: form.name, level: form.level, type: form.type,
          floor_area: form.floor_area || 0, scale: form.scale || 0,
          geometry: { type, coordinates: type === 'Point' ? [Number(coordinates[0]), Number(coordinates[1])] : coordinates }
        })
        if (response.success) {
          const layerObj = layers.value[layerType]
          if (layerObj.loaded) {
            await vectorStore.loadPoints()
            updateVectorLayer(layerType)
          }
          vectorStore.setShowPointForm(false)
          if (window._resolveImport) window._resolveImport()
        }
        return
      }

      if (vectorStore.selectedFeature?.id) {
        const id = vectorStore.selectedFeature.id
        const source = layers.value.points.layer?.getSource()
        const feature = source?.getFeatures().find(f => f.get('id') === id)
        let geometry = vectorStore.selectedFeature.geometry
        if (feature) geometry = { type: 'Point', coordinates: toLonLat(feature.getGeometry().getCoordinates()) }

        const updateData = {
          name: form.name, level: form.level, type: form.type,
          floor_area: form.floor_area || 0, scale: form.scale || 0, geometry
        }
        const response = await updatePoints(id, updateData)
        if (response.success) {
          if (feature) {
            feature.setGeometry(feature.getGeometry().clone())
            feature.set('name', form.name)
            feature.set('level', form.level)
            feature.set('type', form.type)
            feature.set('floor_area', form.floor_area)
            feature.set('scale', form.scale)
          }
          const index = vectorStore.points.findIndex(p => p.id === id)
          if (index !== -1) vectorStore.points[index] = { ...vectorStore.points[index], ...updateData, id }
          vectorStore.selectedFeature = { ...vectorStore.selectedFeature, ...updateData, id }

          alert('更新成功！')

          const pointModify = getPointModify()
          if (pointModify) pointModify.setActive(false)
          vectorStore.selectedFeature = null
          vectorStore.popupPosition = null
          vectorStore.setIsEditing(false)
          vectorStore.setOriginalGeometry(null)
          vectorStore.setShowPointForm(false)
        }
      } else {
        if (!vectorStore.drawFeature) return
        const response = await createPoints({
          name: form.name, level: form.level, type: form.type,
          floor_area: form.floor_area || 0, scale: form.scale || 0,
          geometry: { type: 'Point', coordinates: toLonLat(vectorStore.drawFeature.getGeometry().getCoordinates()) }
        })
        if (response.success) {
          const newFeature = vectorStore.drawFeature.clone()
          newFeature.set('id', response.data.id)
          newFeature.set('name', form.name)
          newFeature.set('level', form.level)
          newFeature.set('type', form.type)
          newFeature.set('floor_area', form.floor_area)
          newFeature.set('scale', form.scale)
          newFeature.set('layerType', 'points')
          layers.value.points.layer?.getSource()?.addFeature(newFeature)
          vectorStore.points.push(response.data)

          alert('绘制成功！')
          cancelDraw()
        }
      }
    } catch (error) {
      alert('保存失败：' + error.message)
    }
  }

  async function saveLandsToDatabase() {
    try {
      const form = vectorStore.landsForm
      if (!form.name) return

      if (window._tempImportGeometry) {
        const { type, coordinates, layerType } = window._tempImportGeometry
        let finalCoordinates = coordinates
        if (type === 'Polygon') finalCoordinates = coordinates.map(ring => ring.map(point => [Number(point[0]), Number(point[1])]))
        else if (type === 'Point') finalCoordinates = [Number(coordinates[0]), Number(coordinates[1])]

        const response = await createLands({
          name: form.name, type: form.type, site_area: form.site_area || 0,
          geometry: { type, coordinates: finalCoordinates }
        })
        if (response?.success) {
          const layerObj = layers.value[layerType]
          if (layerObj?.loaded) {
            await vectorStore.loadLands()
            updateVectorLayer(layerType)
          }
          vectorStore.setShowLandsForm(false)
          delete window._tempImportGeometry
          if (window._resolveImport) window._resolveImport()
        }
        return
      }

      if (vectorStore.selectedFeature?.id) {
        const id = vectorStore.selectedFeature.id
        const source = layers.value.lands.layer?.getSource()
        const feature = source?.getFeatures().find(f => f.get('id') === id)
        let geometry = vectorStore.selectedFeature.geometry
        if (feature) {
          geometry = {
            type: 'Polygon',
            coordinates: feature.getGeometry().getCoordinates().map(ring => ring.map(coord => toLonLat(coord)))
          }
        }

        const updateData = { name: form.name, type: form.type, site_area: form.site_area || 0, geometry }
        const response = await updateLands(id, updateData)
        if (response.success) {
          if (feature) {
            feature.set('name', form.name)
            feature.set('type', form.type)
            feature.set('site_area', form.site_area)
          }
          const index = vectorStore.lands.findIndex(l => l.id === id)
          if (index !== -1) vectorStore.lands[index] = { ...vectorStore.lands[index], ...updateData, id }
          vectorStore.selectedFeature = { ...vectorStore.selectedFeature, ...updateData, id }

          alert('更新成功！')

          const landsModify = getLandsModify()
          if (landsModify) landsModify.setActive(false)
          vectorStore.selectedFeature = null
          vectorStore.popupPosition = null
          vectorStore.setIsEditing(false)
          vectorStore.setOriginalGeometry(null)
          vectorStore.setShowLandsForm(false)
        }
      } else {
        if (!vectorStore.drawFeature) return
        const response = await createLands({
          name: form.name, type: form.type, site_area: form.site_area || 0,
          geometry: {
            type: 'Polygon',
            coordinates: vectorStore.drawFeature.getGeometry().getCoordinates().map(ring => ring.map(coord => toLonLat(coord)))
          }
        })
        if (response.success) {
          const newFeature = vectorStore.drawFeature.clone()
          newFeature.set('id', response.data.id)
          newFeature.set('name', form.name)
          newFeature.set('type', form.type)
          newFeature.set('site_area', form.site_area)
          newFeature.set('layerType', 'lands')
          layers.value.lands.layer?.getSource()?.addFeature(newFeature)
          vectorStore.lands.push(response.data)

          alert('绘制成功！')
          cancelDraw()
        }
      }
    } catch (error) {
      alert('保存失败：' + error.message)
    }
  }

  // ==================== 删除功能 ====================
  async function deleteFeature(featureId) {
    if (!vectorStore.selectedFeature) return
    const layerType = vectorStore.selectedFeature?.layerType
    if (!confirm(`确定要删除这个${layerType === 'points' ? '设施' : '图形'}吗？`)) return

    try {
      if (layerType === 'points') await deletePoints(featureId)
      else await deleteLands(featureId)

      const source = layers.value[layerType]?.layer?.getSource()
      const feature = source?.getFeatures().find(f => f.get('id') === featureId)
      if (feature) source.removeFeature(feature)

      if (layerType === 'points') vectorStore.points = vectorStore.points.filter(item => item.id !== featureId)
      else vectorStore.lands = vectorStore.lands.filter(item => item.id !== featureId)

      vectorStore.closePopup()
      alert('删除成功')
    } catch (error) {
      const source = layers.value[layerType]?.layer?.getSource()
      const feature = source?.getFeatures().find(f => f.get('id') === featureId)
      if (feature) source.removeFeature(feature)
      vectorStore.closePopup()
    }
  }

  // ==================== 导入导出功能 ====================
  function handleImport(layerType) {
    vectorStore.setImportLayerType(layerType)
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.geojson'
    input.onchange = (e) => { const file = e.target.files[0]; if (file) readGeoJSONFile(file) }
    input.click()
  }

  function readGeoJSONFile(file) {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const geojson = JSON.parse(e.target.result)
        const layerType = vectorStore.importLayerType
        const features = geojson.features || [geojson]
        const validFeatures = features.filter(f => {
          const type = f.geometry?.type
          return layerType === 'lands' ? (type === 'Polygon' || type === 'MultiPolygon') : (type === 'Point' || type === 'MultiPoint')
        })
        if (validFeatures.length === 0) {
          alert(`文件中没有有效的${layerType === 'points' ? 'Point' : 'Polygon'}数据`)
          return
        }
        vectorStore.setImportFeatures(validFeatures)
        showCoordinateDialogForImport()
      } catch (err) {
        alert('文件解析失败，请确保是有效的 GeoJSON 文件')
      }
    }
    reader.readAsText(file, 'UTF-8')
  }

  function showCoordinateDialogForImport() {
    const mask = document.createElement('div')
    mask.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:9998;'

    const select = document.createElement('select')
    select.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:9999;padding:10px;background:white;border:2px solid #409eff;border-radius:5px;width:300px;'
    select.innerHTML = '<option value="" disabled selected hidden>请选择坐标系</option><option value="EPSG:4547">CGCS2000_3度带_114E</option><option value="EPSG:4326">WGS84_经纬度</option>'

    const btnGroup = document.createElement('div')
    btnGroup.style.cssText = 'position:fixed;top:calc(50% + 50px);left:50%;transform:translateX(-50%);z-index:9999;display:flex;gap:10px;'
    const confirmBtn = document.createElement('button')
    confirmBtn.textContent = '确定'
    confirmBtn.style.cssText = 'padding:5px 15px;background:#409eff;color:white;border:none;border-radius:3px;cursor:pointer;'
    const cancelBtn = document.createElement('button')
    cancelBtn.textContent = '取消'
    cancelBtn.style.cssText = 'padding:5px 15px;background:#ccc;color:#333;border:none;border-radius:3px;cursor:pointer;'
    btnGroup.append(confirmBtn, cancelBtn)
    document.body.append(mask, select, btnGroup)

    const close = () => [mask, select, btnGroup].forEach(el => el.remove())
    confirmBtn.onclick = () => {
      const epsg = select.value
      if (!epsg) {
        alert('请选择坐标系')
        return
      }
      close()
      if (epsg === 'EPSG:4547' && !proj4.defs('EPSG:4547')) {
        proj4.defs('EPSG:4547', '+proj=tmerc +lat_0=0 +lon_0=114 +k=1 +x_0=500000 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs')
      }
      importWithTransform(epsg)
    }
    cancelBtn.onclick = () => {
      close()
      vectorStore.setImportFeatures([])
      vectorStore.setImportLayerType(null)
    }
  }

  async function importWithTransform(sourceEPSG) {
    const targetEPSG = 'EPSG:4326'
    let successCount = 0

    for (const feature of vectorStore.importFeatures) {
      let geom = feature.geometry
      let geomType = geom.type
      let coordinates = geom.coordinates

      if (geomType === 'MultiPolygon') { geomType = 'Polygon'; coordinates = coordinates[0] }
      if (geomType === 'MultiPoint') { geomType = 'Point'; coordinates = coordinates[0] }

      if (sourceEPSG !== targetEPSG) {
        try {
          coordinates = transformCoordinates(coordinates, sourceEPSG, targetEPSG, geomType)
        } catch (err) {
          alert('坐标转换失败')
          return
        }
      }

      const props = feature.properties || {}
      const layerType = vectorStore.importLayerType

      if (layerType === 'points') {
        vectorStore.updatePointsForm({
          name: props.name || '',
          level: props.level || '',
          type: props.type || '',
          floor_area: props.floor_area || null,
          scale: props.scale || null
        })
      } else {
        vectorStore.updateLandsForm({
          name: props.name || '',
          type: props.type || '',
          site_area: props.site_area || null
        })
        if (!vectorStore.landsForm.site_area && geomType === 'Polygon') {
          const tempCoords = coordinates.map(ring => ring.map(coord => fromLonLat(coord)))
          vectorStore.updateLandsForm({ site_area: Math.round(new Polygon(tempCoords).getArea()) })
        }
      }

      window._tempImportGeometry = { type: geomType, coordinates, layerType }
      layerType === 'points' ? vectorStore.setShowPointForm(true) : vectorStore.setShowLandsForm(true)
      await new Promise(resolve => window._resolveImport = resolve)
      successCount++
    }

    alert(`成功导入 ${successCount} 个要素`)
    vectorStore.setImportFeatures([])
    vectorStore.setImportLayerType(null)
    delete window._tempImportGeometry
    delete window._resolveImport
  }

  async function handleExport(layerType) {
    const layerObj = layers.value[layerType]
    if (!layerObj?.layer) { alert('请先加载图层数据'); return }
    const features = layerObj.layer.getSource().getFeatures()
    if (features.length === 0) { alert('没有可导出的要素'); return }

    const mask = document.createElement('div')
    mask.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:9998;'

    const select = document.createElement('select')
    select.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:9999;padding:10px;background:white;border:2px solid #409eff;border-radius:5px;width:300px;'
    select.innerHTML = '<option value="" disabled selected hidden>请选择坐标系</option><option value="EPSG:4547">CGCS2000_3度带_114E</option><option value="EPSG:4326">WGS84_经纬度</option>'

    const btnGroup = document.createElement('div')
    btnGroup.style.cssText = 'position:fixed;top:calc(50% + 50px);left:50%;transform:translateX(-50%);z-index:9999;display:flex;gap:10px;'
    const confirmBtn = document.createElement('button')
    confirmBtn.textContent = '确定'
    confirmBtn.style.cssText = 'padding:5px 15px;background:#409eff;color:white;border:none;border-radius:3px;cursor:pointer;'
    const cancelBtn = document.createElement('button')
    cancelBtn.textContent = '取消'
    cancelBtn.style.cssText = 'padding:5px 15px;background:#ccc;color:#333;border:none;border-radius:3px;cursor:pointer;'
    btnGroup.append(confirmBtn, cancelBtn)
    document.body.append(mask, select, btnGroup)
    const close = () => [mask, select, btnGroup].forEach(el => el.remove())

    confirmBtn.onclick = () => {
      const targetEPSG = select.value
      if (!targetEPSG) {
        alert('请选择坐标系')
        return
      }
      close()

      const geojson = { type: 'FeatureCollection', crs: { type: 'name', properties: { name: targetEPSG } }, features: [] }
      for (const feature of features) {
        const props = feature.getProperties()
        const properties = { name: props.name, type: props.type }
        if (layerType === 'points') Object.assign(properties, { level: props.level, floor_area: props.floor_area, scale: props.scale })
        else properties.site_area = props.site_area

        let geom = feature.getGeometry()
        let coordinates = geom.getCoordinates()

        if (targetEPSG === 'EPSG:4326') {
          if (geom.getType() === 'Point') coordinates = toLonLat(coordinates)
          else if (geom.getType() === 'Polygon') coordinates = coordinates.map(ring => ring.map(coord => toLonLat(coord)))
        } else if (targetEPSG === 'EPSG:4547') {
          if (geom.getType() === 'Point') coordinates = proj4('EPSG:4326', 'EPSG:4547', toLonLat(coordinates))
          else if (geom.getType() === 'Polygon') coordinates = coordinates.map(ring => ring.map(coord => proj4('EPSG:4326', 'EPSG:4547', toLonLat(coord))))
        }

        geojson.features.push({ type: 'Feature', geometry: { type: geom.getType(), coordinates }, properties })
      }

      const dataStr = JSON.stringify(geojson, null, 2)
      const blob = new Blob([dataStr], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.download = `${layerType === 'points' ? '设施点' : '设施用地'}_导出_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.geojson`
      a.href = url
      a.click()
      URL.revokeObjectURL(url)
    }
    cancelBtn.onclick = close
  }

  // 单个要素导出函数
  async function exportSingleFeature(feature) {
    const mask = document.createElement('div')
    mask.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:9998;'

    const select = document.createElement('select')
    select.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:9999;padding:10px;background:white;border:2px solid #409eff;border-radius:5px;width:300px;'
    select.innerHTML = '<option value="" disabled selected hidden>请选择坐标系</option><option value="EPSG:4547">CGCS2000_3度带_114E</option><option value="EPSG:4326">WGS84_经纬度</option>'

    const btnGroup = document.createElement('div')
    btnGroup.style.cssText = 'position:fixed;top:calc(50% + 50px);left:50%;transform:translateX(-50%);z-index:9999;display:flex;gap:10px;'
    const confirmBtn = document.createElement('button')
    confirmBtn.textContent = '确定'
    confirmBtn.style.cssText = 'padding:5px 15px;background:#409eff;color:white;border:none;border-radius:3px;cursor:pointer;'
    const cancelBtn = document.createElement('button')
    cancelBtn.textContent = '取消'
    cancelBtn.style.cssText = 'padding:5px 15px;background:#ccc;color:#333;border:none;border-radius:3px;cursor:pointer;'
    btnGroup.appendChild(confirmBtn)
    btnGroup.appendChild(cancelBtn)

    document.body.appendChild(mask)
    document.body.appendChild(select)
    document.body.appendChild(btnGroup)

    const close = () => {
      document.body.removeChild(mask)
      document.body.removeChild(select)
      document.body.removeChild(btnGroup)
    }

    confirmBtn.onclick = () => {
      const targetEPSG = select.value
      if (!targetEPSG) {
        alert('请选择坐标系')
        return
      }
      close()

      const layerType = feature.layerType
      const geomType = layerType === 'points' ? 'Point' : 'Polygon'

      const source = layers.value[layerType]?.layer?.getSource()
      const mapFeature = source?.getFeatures().find(f => f.get('id') === feature.id)

      if (!mapFeature) {
        alert('未找到要素数据')
        return
      }

      const geometry = mapFeature.getGeometry()
      let coordinates

      if (geomType === 'Point') {
        const coords3857 = geometry.getCoordinates()
        coordinates = toLonLat(coords3857)
      } else {
        const coords3857 = geometry.getCoordinates()
        coordinates = coords3857.map(ring => ring.map(coord => toLonLat(coord)))
      }

      if (targetEPSG === 'EPSG:4547') {
        if (geomType === 'Point') {
          coordinates = proj4('EPSG:4326', 'EPSG:4547', coordinates)
        } else {
          coordinates = coordinates.map(ring => ring.map(coord => proj4('EPSG:4326', 'EPSG:4547', coord)))
        }
      }

      const properties = { name: feature.name, type: feature.type }
      if (layerType === 'points') {
        properties.level = feature.level
        properties.floor_area = feature.floor_area
        properties.scale = feature.scale
      } else {
        properties.site_area = feature.site_area
      }

      const geojson = {
        type: 'FeatureCollection',
        crs: { type: 'name', properties: { name: targetEPSG } },
        features: [{
          type: 'Feature',
          geometry: { type: geomType, coordinates },
          properties: properties
        }]
      }

      const dataStr = JSON.stringify(geojson, null, 2)
      const blob = new Blob([dataStr], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
      a.download = `${layerType === 'points' ? '设施点' : '设施用地'}_${feature.name || '要素'}_${timestamp}.geojson`
      a.href = url
      a.click()
      URL.revokeObjectURL(url)
    }

    cancelBtn.onclick = close
  }

  return {
    startDrawing,
    cancelDraw,
    toggleEditMode,
    exitEditMode,
    openEditForm,
    savePointToDatabase,
    saveLandsToDatabase,
    deleteFeature,
    handleImport,
    handleExport,
    exportSingleFeature,
    calcArea,
  }
}