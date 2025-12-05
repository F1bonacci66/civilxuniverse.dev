/**
 * API клиент для работы с проектами и версиями
 */
import { apiGet, apiPost, apiPut, apiDelete } from './client'

export interface Project {
  id: string
  shortId: number
  name: string
  slug: string
  description?: string
  createdBy: string
  companyId?: string
  createdAt: string
  updatedAt: string
}

export interface ProjectVersion {
  id: string
  shortId: number
  projectId: string
  name: string
  slug: string
  description?: string
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface CreateProjectRequest {
  name: string
  slug?: string
  description?: string
}

export interface UpdateProjectRequest {
  name?: string
  slug?: string
  description?: string
}

export interface CreateProjectVersionRequest {
  name: string
  slug?: string
  description?: string
}

export interface UpdateProjectVersionRequest {
  name?: string
  slug?: string
  description?: string
}

/**
 * Получить список проектов
 */
export async function getProjects(search?: string, limit = 100, offset = 0): Promise<Project[]> {
  const params = new URLSearchParams()
  if (search) params.append('search', search)
  params.append('limit', limit.toString())
  params.append('offset', offset.toString())

  const endpoint = `/projects?${params.toString()}`
  const data = await apiGet<any[]>(endpoint, 30000)
  
  // Преобразуем snake_case в camelCase
  return data.map((project: any) => ({
    id: project.id,
    shortId: project.short_id,
    name: project.name,
    slug: project.slug,
    description: project.description,
    createdBy: project.created_by,
    companyId: project.company_id,
    createdAt: project.created_at,
    updatedAt: project.updated_at,
  }))
}

/**
 * Получить проект по ID
 */
export async function getProject(projectId: string): Promise<Project> {
  const project = await apiGet<any>(`/projects/${projectId}`, 30000)
  
  return {
    id: project.id,
    shortId: project.short_id,
    name: project.name,
    slug: project.slug,
    description: project.description,
    createdBy: project.created_by,
    companyId: project.company_id,
    createdAt: project.created_at,
    updatedAt: project.updated_at,
  }
}

/**
 * Создать проект
 */
export async function createProject(request: CreateProjectRequest): Promise<Project> {
  const project = await apiPost<any>('/projects', request, 30000)
  
  return {
    id: project.id,
    shortId: project.short_id,
    name: project.name,
    slug: project.slug,
    description: project.description,
    createdBy: project.created_by,
    companyId: project.company_id,
    createdAt: project.created_at,
    updatedAt: project.updated_at,
  }
}

/**
 * Обновить проект
 */
export async function updateProject(
  projectId: string,
  request: UpdateProjectRequest
): Promise<Project> {
  const project = await apiPut<any>(`/projects/${projectId}`, request, 30000)
  
  return {
    id: project.id,
    shortId: project.short_id,
    name: project.name,
    slug: project.slug,
    description: project.description,
    createdBy: project.created_by,
    companyId: project.company_id,
    createdAt: project.created_at,
    updatedAt: project.updated_at,
  }
}

/**
 * Удалить проект
 */
export async function deleteProject(projectId: string): Promise<void> {
  await apiDelete<void>(`/projects/${projectId}`, 30000)
}

/**
 * Получить список версий проекта
 */
export async function getProjectVersions(projectId: string): Promise<ProjectVersion[]> {
  const data = await apiGet<any[]>(`/projects/${projectId}/versions`, 30000)
  
  return data.map((version: any) => ({
    id: version.id,
    shortId: version.short_id,
    projectId: version.project_id,
    name: version.name,
    slug: version.slug,
    description: version.description,
    createdBy: version.created_by,
    createdAt: version.created_at,
    updatedAt: version.updated_at,
  }))
}

/**
 * Получить версию проекта по ID
 */
export async function getProjectVersion(
  projectId: string,
  versionId: string
): Promise<ProjectVersion> {
  const version = await apiGet<any>(`/projects/${projectId}/versions/${versionId}`, 30000)
  
  return {
    id: version.id,
    shortId: version.short_id,
    projectId: version.project_id,
    name: version.name,
    slug: version.slug,
    description: version.description,
    createdBy: version.created_by,
    createdAt: version.created_at,
    updatedAt: version.updated_at,
  }
}

/**
 * Создать версию проекта
 */
export async function createProjectVersion(
  projectId: string,
  request: CreateProjectVersionRequest
): Promise<ProjectVersion> {
  const version = await apiPost<any>(`/projects/${projectId}/versions`, request, 30000)
  
  return {
    id: version.id,
    shortId: version.short_id,
    projectId: version.project_id,
    name: version.name,
    slug: version.slug,
    description: version.description,
    createdBy: version.created_by,
    createdAt: version.created_at,
    updatedAt: version.updated_at,
  }
}

/**
 * Обновить версию проекта
 */
export async function updateProjectVersion(
  projectId: string,
  versionId: string,
  request: UpdateProjectVersionRequest
): Promise<ProjectVersion> {
  const version = await apiPut<any>(`/projects/${projectId}/versions/${versionId}`, request, 30000)
  
  return {
    id: version.id,
    shortId: version.short_id,
    projectId: version.project_id,
    name: version.name,
    slug: version.slug,
    description: version.description,
    createdBy: version.created_by,
    createdAt: version.created_at,
    updatedAt: version.updated_at,
  }
}

/**
 * Удалить версию проекта
 */
export async function deleteProjectVersion(projectId: string, versionId: string): Promise<void> {
  await apiDelete<void>(`/projects/${projectId}/versions/${versionId}`, 30000)
}

