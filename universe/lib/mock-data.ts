export interface Project {
  id: string
  shortId?: number
  name: string
  description?: string
  createdAt: string
  versions: Version[]
}

export interface Version {
  id: string
  shortId?: number
  name: string
  projectId: string
  description?: string
  createdAt: string
  author: string
  models: Model[]
}

export interface Model {
  id: string
  name: string
  projectId: string
  versionId: string
  description?: string
  rowCount: number
  columnCount: number
  createdAt: string
  status: 'processing' | 'ready' | 'error'
}

export interface UniverseApp {
  id: string
  name: string
  displayName: string
  description: string
  status: 'active' | 'coming' | 'beta'
  icon?: string
  path: string
}

export const universeApps: UniverseApp[] = [
  {
    id: 'datalab',
    name: 'DataLab',
    displayName: 'DataLab',
    description: 'Анализ и визуализация данных',
    status: 'active',
    path: '/app/datalab',
  },
  {
    id: 'viewer',
    name: '3D Viewer',
    displayName: '3D Viewer',
    description: '3D визуализация BIM-моделей',
    status: 'active',
    path: '/app/viewer',
  },
]

export const mockProjects: Project[] = [
  {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Жилой комплекс "Парк Авеню"',
    description: 'Многоэтажный жилой комплекс в центре города',
    createdAt: '2024-01-15',
    versions: [
      {
        id: '550e8400-e29b-41d4-a716-446655440001',
        name: 'Версия 1.0',
        projectId: '550e8400-e29b-41d4-a716-446655440000',
        description: 'Первоначальная версия проекта',
        createdAt: '2024-01-16',
        author: 'Иван Петров',
        models: [
          {
            id: '550e8400-e29b-41d4-a716-446655440010',
            name: 'Корпус А',
            projectId: '550e8400-e29b-41d4-a716-446655440000',
            versionId: '550e8400-e29b-41d4-a716-446655440001',
            rowCount: 12500,
            columnCount: 45,
            createdAt: '2024-01-16',
            status: 'ready',
          },
          {
            id: '550e8400-e29b-41d4-a716-446655440011',
            name: 'Корпус Б',
            projectId: '550e8400-e29b-41d4-a716-446655440000',
            versionId: '550e8400-e29b-41d4-a716-446655440001',
            rowCount: 11800,
            columnCount: 45,
            createdAt: '2024-01-17',
            status: 'ready',
          },
        ],
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440002',
        name: 'Версия 2.0',
        projectId: '550e8400-e29b-41d4-a716-446655440000',
        description: 'Обновление с добавлением инфраструктуры',
        createdAt: '2024-01-20',
        author: 'Иван Петров',
        models: [
          {
            id: '550e8400-e29b-41d4-a716-446655440020',
            name: 'Корпус А',
            projectId: '550e8400-e29b-41d4-a716-446655440000',
            versionId: '550e8400-e29b-41d4-a716-446655440002',
            rowCount: 12800,
            columnCount: 45,
            createdAt: '2024-01-20',
            status: 'ready',
          },
          {
            id: '550e8400-e29b-41d4-a716-446655440021',
            name: 'Корпус Б',
            projectId: '550e8400-e29b-41d4-a716-446655440000',
            versionId: '550e8400-e29b-41d4-a716-446655440002',
            rowCount: 12000,
            columnCount: 45,
            createdAt: '2024-01-20',
            status: 'ready',
          },
          {
            id: '550e8400-e29b-41d4-a716-446655440022',
            name: 'Инфраструктура',
            projectId: '550e8400-e29b-41d4-a716-446655440000',
            versionId: '550e8400-e29b-41d4-a716-446655440002',
            rowCount: 5600,
            columnCount: 38,
            createdAt: '2024-01-18',
            status: 'processing',
          },
        ],
      },
    ],
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440100',
    name: 'Офисный центр "Бизнес-Тауэр"',
    description: 'Современный офисный комплекс класса А',
    createdAt: '2024-02-01',
    versions: [
      {
        id: '550e8400-e29b-41d4-a716-446655440101',
        name: 'Версия 1.0',
        projectId: '550e8400-e29b-41d4-a716-446655440100',
        description: 'Начальная версия офисного центра',
        createdAt: '2024-02-02',
        author: 'Мария Сидорова',
        models: [
          {
            id: '550e8400-e29b-41d4-a716-446655440110',
            name: 'Основное здание',
            projectId: '550e8400-e29b-41d4-a716-446655440100',
            versionId: '550e8400-e29b-41d4-a716-446655440101',
            rowCount: 15200,
            columnCount: 52,
            createdAt: '2024-02-02',
            status: 'ready',
          },
        ],
      },
    ],
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440200',
    name: 'Торговый центр "МегаМолл"',
    description: 'Крупный торгово-развлекательный комплекс',
    createdAt: '2024-02-10',
    versions: [
      {
        id: '550e8400-e29b-41d4-a716-446655440201',
        name: 'Версия 1.0',
        projectId: '550e8400-e29b-41d4-a716-446655440200',
        description: 'Первая версия торгового центра',
        createdAt: '2024-02-11',
        author: 'Алексей Иванов',
        models: [
          {
            id: '550e8400-e29b-41d4-a716-446655440210',
            name: 'Главный корпус',
            projectId: '550e8400-e29b-41d4-a716-446655440200',
            versionId: '550e8400-e29b-41d4-a716-446655440201',
            rowCount: 9800,
            columnCount: 42,
            createdAt: '2024-02-11',
            status: 'ready',
          },
          {
            id: '550e8400-e29b-41d4-a716-446655440211',
            name: 'Парковка',
            projectId: '550e8400-e29b-41d4-a716-446655440200',
            versionId: '550e8400-e29b-41d4-a716-446655440201',
            rowCount: 3200,
            columnCount: 28,
            createdAt: '2024-02-12',
            status: 'error',
          },
        ],
      },
    ],
  },
]

export const mockTableData = [
  {
    id: '1',
    'Тип элемента': 'Стена',
    'Категория': 'Стены',
    'Материал': 'Бетон B25',
    'Объём': 125.5,
    'Площадь': 245.8,
    'Уровень': '1 этаж',
    'Марка': 'Ст-001',
    'Примечание': '',
  },
  {
    id: '2',
    'Тип элемента': 'Перекрытие',
    'Категория': 'Перекрытия',
    'Материал': 'Ж/Б плита',
    'Объём': 320.2,
    'Площадь': 640.4,
    'Уровень': '1 этаж',
    'Марка': 'Пл-001',
    'Примечание': 'Монолитное',
  },
  {
    id: '3',
    'Тип элемента': 'Колонна',
    'Категория': 'Колонны',
    'Материал': 'Бетон B30',
    'Объём': 15.8,
    'Площадь': 42.6,
    'Уровень': '1 этаж',
    'Марка': 'К-001',
    'Примечание': '',
  },
]

