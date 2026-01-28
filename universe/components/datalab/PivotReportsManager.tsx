'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { 
  Save, 
  Loader2, 
  Trash2, 
  Edit2, 
  FileText, 
  Plus,
  X,
  AlertCircle 
} from 'lucide-react'
import type { PivotReport } from '@/lib/types/pivot'
import {
  getPivotReports,
  createPivotReport,
  updatePivotReport,
  deletePivotReport,
} from '@/lib/api/pivot'

interface PivotReportsManagerProps {
  projectId: string
  versionId: string
  currentRows: string[]
  currentColumns: string[]
  currentValues: any[]
  onLoadReport: (report: PivotReport) => void
}

export function PivotReportsManager({
  projectId,
  versionId,
  currentRows,
  currentColumns,
  currentValues,
  onLoadReport,
}: PivotReportsManagerProps) {
  const [reports, setReports] = useState<PivotReport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [editingReport, setEditingReport] = useState<PivotReport | null>(null)
  const [reportName, setReportName] = useState('')
  const [reportDescription, setReportDescription] = useState('')
  const [saving, setSaving] = useState(false)

  // Загрузка списка отчетов
  useEffect(() => {
    if (!projectId || !versionId) return
    
    loadReports()
  }, [projectId, versionId])

  const loadReports = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await getPivotReports(projectId, versionId)
      setReports(data)
    } catch (err: any) {
      console.error('Ошибка загрузки отчетов:', err)
      setError(err.message || 'Не удалось загрузить отчеты')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!reportName.trim()) {
      setError('Введите название отчета')
      return
    }

    try {
      setSaving(true)
      setError(null)

      if (editingReport) {
        // Обновление существующего отчета
        await updatePivotReport(editingReport.id, {
          name: reportName,
          description: reportDescription || undefined,
          rows: currentRows,
          columns: currentColumns,
          values: currentValues,
        })
      } else {
        // Создание нового отчета
        await createPivotReport({
          name: reportName,
          description: reportDescription || undefined,
          projectId,
          versionId,
          rows: currentRows,
          columns: currentColumns,
          values: currentValues,
        })
      }

      setShowSaveDialog(false)
      setShowEditDialog(false)
      setEditingReport(null)
      setReportName('')
      setReportDescription('')
      await loadReports()
    } catch (err: any) {
      console.error('Ошибка сохранения отчета:', err)
      setError(err.message || 'Не удалось сохранить отчет')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (reportId: string) => {
    if (!confirm('Вы уверены, что хотите удалить этот отчет?')) {
      return
    }

    try {
      await deletePivotReport(reportId)
      await loadReports()
    } catch (err: any) {
      console.error('Ошибка удаления отчета:', err)
      setError(err.message || 'Не удалось удалить отчет')
    }
  }

  const handleEdit = (report: PivotReport) => {
    setEditingReport(report)
    setReportName(report.name)
    setReportDescription(report.description || '')
    setShowEditDialog(true)
  }

  const handleLoad = (report: PivotReport) => {
    onLoadReport(report)
  }

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString('ru-RU')
    } catch {
      return dateString
    }
  }

  return (
    <div className="bg-[rgba(0,0,0,0.6)] backdrop-blur-[10px] rounded-lg p-6 border border-[rgba(255,255,255,0.1)]">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Сохраненные отчеты</h2>
        <Button
          onClick={() => {
            setReportName('')
            setReportDescription('')
            setEditingReport(null)
            setShowSaveDialog(true)
          }}
          className="bg-primary-gradient text-black hover:bg-primary-gradient-hover h-9 px-3"
        >
          <Plus className="w-4 h-4 mr-2" />
          Сохранить текущий
        </Button>
      </div>

      {error && (
        <div className="mb-4 bg-red-500/10 border border-red-500/50 rounded-lg p-3 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-400" />
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
          <span className="ml-3 text-[#ccc]">Загрузка отчетов...</span>
        </div>
      ) : reports.length === 0 ? (
        <p className="text-[#999] text-sm py-4">Нет сохраненных отчетов</p>
      ) : (
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {reports.map((report) => (
            <div
              key={report.id}
              className="bg-[rgba(255,255,255,0.05)] rounded-lg p-4 border border-[rgba(255,255,255,0.1)] hover:border-primary-500/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <FileText className="w-4 h-4 text-primary-500 flex-shrink-0" />
                    <h3 className="font-medium text-white truncate">{report.name}</h3>
                  </div>
                  {report.description && (
                    <p className="text-sm text-[#999] mb-2">{report.description}</p>
                  )}
                  <div className="flex flex-wrap gap-2 text-xs text-[#999]">
                    <span>Строк: {report.rows.length}</span>
                    <span>•</span>
                    <span>Колонок: {report.columns.length}</span>
                    <span>•</span>
                    <span>Значений: {report.values.length}</span>
                  </div>
                  <p className="text-xs text-[#666] mt-2">
                    Обновлено: {formatDate(report.updatedAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    onClick={() => handleLoad(report)}
                    className="h-8 px-3 bg-transparent border border-[rgba(255,255,255,0.2)] text-white hover:bg-[rgba(255,255,255,0.1)]"
                  >
                    Загрузить
                  </Button>
                  <button
                    onClick={() => handleEdit(report)}
                    className="p-2 hover:bg-[rgba(255,255,255,0.1)] rounded-lg transition-colors"
                    title="Редактировать"
                  >
                    <Edit2 className="w-4 h-4 text-[#999]" />
                  </button>
                  <button
                    onClick={() => handleDelete(report.id)}
                    className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
                    title="Удалить"
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Диалог сохранения */}
      {(showSaveDialog || showEditDialog) && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[rgba(0,0,0,0.9)] border border-[rgba(255,255,255,0.2)] rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold">
                {editingReport ? 'Редактировать отчет' : 'Сохранить отчет'}
              </h3>
              <button
                onClick={() => {
                  setShowSaveDialog(false)
                  setShowEditDialog(false)
                  setEditingReport(null)
                  setReportName('')
                  setReportDescription('')
                }}
                className="p-2 hover:bg-[rgba(255,255,255,0.1)] rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#ccc] mb-2">
                  Название отчета *
                </label>
                <input
                  type="text"
                  value={reportName}
                  onChange={(e) => setReportName(e.target.value)}
                  placeholder="Например: Анализ по категориям"
                  className="w-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#ccc] mb-2">
                  Описание (необязательно)
                </label>
                <textarea
                  value={reportDescription}
                  onChange={(e) => setReportDescription(e.target.value)}
                  placeholder="Краткое описание отчета..."
                  rows={3}
                  className="w-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  onClick={handleSave}
                  disabled={saving || !reportName.trim()}
                  className="flex-1 bg-primary-gradient text-black hover:bg-primary-gradient-hover"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Сохранение...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Сохранить
                    </>
                  )}
                </Button>
                <Button
                  onClick={() => {
                    setShowSaveDialog(false)
                    setShowEditDialog(false)
                    setEditingReport(null)
                    setReportName('')
                    setReportDescription('')
                  }}
                  className="bg-transparent border border-[rgba(255,255,255,0.2)] text-white hover:bg-[rgba(255,255,255,0.1)]"
                  disabled={saving}
                >
                  Отмена
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

