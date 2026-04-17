// biome-ignore-all assist/source/organizeImports: ANT-ONLY import markers must not be reordered
import { Box, Text, useTheme, Dialog, useInput } from '@anthropic/ink'
import * as React from 'react'
import { useState, useEffect } from 'react'
import { useKeybinding } from '../../keybindings/useKeybinding.js'
import figures from 'figures'
import {
  getInitialSettings,
  updateSettingsForSource,
} from '../../utils/settings/settings.js'
import { logError } from '../../utils/log.js'
import type { LocalJSXCommandContext } from '../../commands.js'
import { Select } from '../CustomSelect/index.js'

// 支持的模型提供商类型
type ModelProvider = 'anthropic' | 'openai' | 'gemini' | 'grok' | 'custom'

// 模型配置接口
interface ModelConfig {
  provider: ModelProvider
  apiKey: string
  baseUrl?: string
  model: string
  name: string // 配置名称，用于标识
}

// 预设模型列表
const PRESET_MODELS: Record<ModelProvider, Array<{ id: string; name: string }>> = {
  anthropic: [
    { id: 'claude-opus-4-6', name: 'Claude Opus 4.6' },
    { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4' },
    { id: 'claude-haiku-4-20250514', name: 'Claude Haiku 4' },
  ],
  openai: [
    { id: 'gpt-5', name: 'GPT-5' },
    { id: 'gpt-4o', name: 'GPT-4o' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
  ],
  gemini: [
    { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
  ],
  grok: [
    { id: 'grok-3', name: 'Grok 3' },
    { id: 'grok-2', name: 'Grok 2' },
  ],
  custom: [],
}

// 提供商显示名称
const PROVIDER_NAMES: Record<ModelProvider, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  gemini: 'Google Gemini',
  grok: 'xAI Grok',
  custom: '自定义 API',
}

// 环境变量名称映射
const ENV_VAR_NAMES: Record<ModelProvider, { key: string; baseUrl?: string; model?: string }> = {
  anthropic: { key: 'ANTHROPIC_API_KEY' },
  openai: { key: 'OPENAI_API_KEY', baseUrl: 'OPENAI_BASE_URL', model: 'OPENAI_MODEL' },
  gemini: { key: 'GEMINI_API_KEY', baseUrl: 'GEMINI_BASE_URL' },
  grok: { key: 'GROK_API_KEY', baseUrl: 'GROK_BASE_URL', model: 'GROK_MODEL' },
  custom: { key: 'CUSTOM_API_KEY', baseUrl: 'CUSTOM_BASE_URL', model: 'CUSTOM_MODEL' },
}

type ViewMode = 'list' | 'add' | 'edit' | 'delete-confirm'

interface Props {
  context: LocalJSXCommandContext
  onClose: (
    result?: string,
    options?: { display?: 'system' | 'output' | 'user-input' },
  ) => void
  contentHeight: number
}

export function ModelConfig({
  context,
  onClose,
  contentHeight,
}: Props): React.ReactNode {
  const theme = useTheme()
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [configs, setConfigs] = useState<ModelConfig[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [activeConfig, setActiveConfig] = useState<string | null>(null)

  // 表单状态
  const [formProvider, setFormProvider] = useState<ModelProvider>('anthropic')
  const [formName, setFormName] = useState('')
  const [formApiKey, setFormApiKey] = useState('')
  const [formBaseUrl, setFormBaseUrl] = useState('')
  const [formModel, setFormModel] = useState('')
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null)

  // 输入模式状态
  const [inputMode, setInputMode] = useState<'name' | 'apiKey' | 'baseUrl' | 'model' | null>(null)

  // 加载配置
  useEffect(() => {
    loadConfigs()
  }, [])

  const loadConfigs = () => {
    const settings = getInitialSettings()

    // 从 settings 中加载已保存的模型配置
    const modelConfigs = settings.modelConfigs as ModelConfig[] | undefined
    if (modelConfigs && Array.isArray(modelConfigs)) {
      setConfigs(modelConfigs)
    } else {
      // 如果没有保存的配置，尝试从现有配置迁移
      const modelType = settings.modelType as ModelProvider | undefined
      const model = settings.model as string | undefined

      if (modelType && model) {
        const defaultConfig: ModelConfig = {
          provider: modelType,
          apiKey: '',
          model,
          name: '默认配置',
        }
        setConfigs([defaultConfig])
      } else {
        setConfigs([])
      }
    }

    // 获取当前激活的配置
    setActiveConfig((settings.activeModelConfig as string) || null)
  }

  const saveConfigs = async (newConfigs: ModelConfig[], newActive?: string) => {
    try {
      const settings = getInitialSettings()
      const updatedSettings: Record<string, unknown> = {
        ...settings,
        modelConfigs: newConfigs,
        activeModelConfig: newActive ?? activeConfig,
      }

      // 如果有激活的配置，同时更新 modelType 和 model
      const active = newActive ?? activeConfig
      if (active) {
        const config = newConfigs.find(c => c.name === active)
        if (config) {
          updatedSettings.modelType = config.provider
          updatedSettings.model = config.model
        }
      }

      const result = await updateSettingsForSource('userSettings', updatedSettings)
      if (result.error) {
        throw result.error
      }

      setConfigs(newConfigs)
      if (newActive) setActiveConfig(newActive)
    } catch (error) {
      logError('Failed to save model config:', error)
    }
  }

  const handleAddConfig = () => {
    setFormProvider('anthropic')
    setFormName('')
    setFormApiKey('')
    setFormBaseUrl('')
    setFormModel('')
    setEditingIndex(null)
    setViewMode('add')
    setInputMode('name')
  }

  const handleEditConfig = (index: number) => {
    const config = configs[index]
    setFormProvider(config.provider)
    setFormName(config.name)
    setFormApiKey(config.apiKey)
    setFormBaseUrl(config.baseUrl || '')
    setFormModel(config.model)
    setEditingIndex(index)
    setViewMode('edit')
    setInputMode('name')
  }

  const handleDeleteConfig = (index: number) => {
    setDeleteIndex(index)
    setViewMode('delete-confirm')
  }

  const confirmDelete = async () => {
    if (deleteIndex === null) return

    const newConfigs = configs.filter((_, i) => i !== deleteIndex)
    const deletedConfig = configs[deleteIndex]

    // 如果删除的是当前激活的配置，清除激活状态
    let newActive = activeConfig
    if (activeConfig === deletedConfig.name) {
      newActive = newConfigs.length > 0 ? newConfigs[0].name : null
    }

    await saveConfigs(newConfigs, newActive || undefined)
    setSelectedIndex(Math.min(selectedIndex, newConfigs.length - 1))
    setViewMode('list')
    setDeleteIndex(null)
  }

  const handleActivateConfig = async (index: number) => {
    const configName = configs[index].name
    await saveConfigs(configs, configName)
  }

  const handleSaveForm = async () => {
    if (!formName.trim()) {
      return // 需要名称
    }

    const newConfig: ModelConfig = {
      provider: formProvider,
      apiKey: formApiKey,
      baseUrl: formBaseUrl || undefined,
      model: formModel,
      name: formName.trim(),
    }

    let newConfigs: ModelConfig[]
    if (editingIndex !== null) {
      // 编辑模式
      const oldName = configs[editingIndex].name
      newConfigs = configs.map((c, i) => (i === editingIndex ? newConfig : c))

      // 如果编辑的是当前激活的配置，更新激活状态
      let newActive = activeConfig
      if (activeConfig === oldName && oldName !== newConfig.name) {
        newActive = newConfig.name
      }
      await saveConfigs(newConfigs, newActive || undefined)
    } else {
      // 添加模式
      newConfigs = [...configs, newConfig]
      // 第一个配置自动激活
      const newActive = activeConfig || newConfig.name
      await saveConfigs(newConfigs, newActive)
    }

    setViewMode('list')
    setInputMode(null)
  }

  const handleCancelForm = () => {
    setViewMode('list')
    setInputMode(null)
  }

  // 键盘快捷键 - 列表模式
  useKeybinding('navigate:up', () => {
    if (viewMode === 'list' && configs.length > 0) {
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : configs.length - 1))
    }
  })

  useKeybinding('navigate:down', () => {
    if (viewMode === 'list' && configs.length > 0) {
      setSelectedIndex(prev => (prev < configs.length - 1 ? prev + 1 : 0))
    }
  })

  // 字母快捷键
  useInput((input, key) => {
    if (viewMode === 'list' && !key.ctrl && !key.meta) {
      if (input === 'a') {
        handleAddConfig()
      } else if (input === 'e' && configs.length > 0) {
        handleEditConfig(selectedIndex)
      } else if (input === 'd' && configs.length > 0) {
        handleDeleteConfig(selectedIndex)
      } else if (key.return && configs.length > 0) {
        handleActivateConfig(selectedIndex)
      }
    }
  })

  useKeybinding('confirm:no', () => {
    if (viewMode === 'list') {
      onClose('Model config closed', { display: 'system' })
    } else if (viewMode === 'delete-confirm') {
      setViewMode('list')
      setDeleteIndex(null)
    } else {
      handleCancelForm()
    }
  })

  // 渲染配置列表
  const renderConfigList = () => (
    <Box flexDirection="column" height={contentHeight - 4}>
      <Box marginBottom={1}>
        <Text color={theme.secondaryText}>
          按 <Text color={theme.accent}>↑↓</Text> 选择，
          <Text color={theme.accent}>Enter</Text> 激活，
          <Text color={theme.accent}>a</Text> 添加，
          <Text color={theme.accent}>e</Text> 编辑，
          <Text color={theme.accent}>d</Text> 删除，
          <Text color={theme.accent}>Esc</Text> 返回
        </Text>
      </Box>

      {configs.length === 0 ? (
        <Box flexDirection="column" alignItems="center" marginY={2}>
          <Text color={theme.secondaryText}>暂无模型配置</Text>
          <Text color={theme.accent}>按 a 添加新配置</Text>
        </Box>
      ) : (
        <Box flexDirection="column">
          {configs.map((config, index) => (
            <Box
              key={config.name}
              flexDirection="row"
              paddingX={1}
              backgroundColor={
                index === selectedIndex ? theme.accent : undefined
              }
            >
              <Text>
                {activeConfig === config.name ? (
                  <Text color={theme.success}>{figures.tick} </Text>
                ) : (
                  '  '
                )}
                <Text
                  color={
                    index === selectedIndex
                      ? theme.inverseText
                      : theme.text
                  }
                >
                  {config.name}
                </Text>
                <Text
                  color={
                    index === selectedIndex
                      ? theme.inverseSecondaryText
                      : theme.secondaryText
                  }
                >
                  {' '}
                  ({PROVIDER_NAMES[config.provider]} - {config.model})
                </Text>
              </Text>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  )

  // 渲染添加/编辑表单
  const renderForm = () => {
    const presetModels = PRESET_MODELS[formProvider]
    const envVars = ENV_VAR_NAMES[formProvider]

    return (
      <Dialog
        title={editingIndex !== null ? '编辑模型配置' : '添加模型配置'}
        color="permission"
        onCancel={handleCancelForm}
      >
        <Box flexDirection="column" gap={1}>
          {/* 配置名称 */}
          <Box flexDirection="column">
            <Text color={theme.secondaryText}>配置名称</Text>
            {inputMode === 'name' ? (
              <TextInput
                value={formName}
                onChange={setFormName}
                onSubmit={() => setInputMode(null)}
                onCancel={() => setInputMode(null)}
                placeholder="例如：公司账号、个人账号"
              />
            ) : (
              <Select
                options={[
                  { label: formName || '<未设置>', value: 'edit' },
                ]}
                value="edit"
                onChange={() => setInputMode('name')}
              />
            )}
          </Box>

          {/* 提供商选择 */}
          <Box flexDirection="column">
            <Text color={theme.secondaryText}>API 提供商</Text>
            <Select
              options={Object.entries(PROVIDER_NAMES).map(([value, label]) => ({
                value,
                label,
              }))}
              value={formProvider}
              onChange={value => {
                setFormProvider(value as ModelProvider)
                setFormModel('')
              }}
            />
          </Box>

          {/* API Key */}
          <Box flexDirection="column">
            <Text color={theme.secondaryText}>
              API Key (对应环境变量: {envVars.key})
            </Text>
            {inputMode === 'apiKey' ? (
              <TextInput
                value={formApiKey}
                onChange={setFormApiKey}
                onSubmit={() => setInputMode(null)}
                onCancel={() => setInputMode(null)}
                placeholder="sk-..."
                mask
              />
            ) : (
              <Select
                options={[
                  { label: formApiKey ? '••••••••' : '<未设置>', value: 'edit' },
                ]}
                value="edit"
                onChange={() => setInputMode('apiKey')}
              />
            )}
          </Box>

          {/* 自定义 Base URL (可选) */}
          {(formProvider === 'openai' ||
            formProvider === 'gemini' ||
            formProvider === 'grok' ||
            formProvider === 'custom') && (
            <Box flexDirection="column">
              <Text color={theme.secondaryText}>
                API 地址 (可选，对应环境变量: {envVars.baseUrl || 'N/A'})
              </Text>
              {inputMode === 'baseUrl' ? (
                <TextInput
                  value={formBaseUrl}
                  onChange={setFormBaseUrl}
                  onSubmit={() => setInputMode(null)}
                  onCancel={() => setInputMode(null)}
                  placeholder="https://api.example.com/v1"
                />
              ) : (
                <Select
                  options={[
                    { label: formBaseUrl || '<使用默认值>', value: 'edit' },
                  ]}
                  value="edit"
                  onChange={() => setInputMode('baseUrl')}
                />
              )}
            </Box>
          )}

          {/* 模型选择 */}
          <Box flexDirection="column">
            <Text color={theme.secondaryText}>
              模型
              {envVars.model ? ` (对应环境变量: ${envVars.model})` : ''}
            </Text>
            {inputMode === 'model' ? (
              <TextInput
                value={formModel}
                onChange={setFormModel}
                onSubmit={() => setInputMode(null)}
                onCancel={() => setInputMode(null)}
                placeholder="模型 ID，例如：gpt-4o"
              />
            ) : (
              <Select
                options={[
                  ...(presetModels.length > 0
                    ? presetModels.map(m => ({ value: m.id, label: m.name }))
                    : []),
                  { value: 'custom', label: '自定义模型...' },
                ]}
                value={formModel || 'custom'}
                onChange={value => {
                  if (value === 'custom') {
                    setInputMode('model')
                  } else {
                    setFormModel(value)
                  }
                }}
              />
            )}
          </Box>
        </Box>

        <Box marginTop={2} flexDirection="row" gap={2}>
          <Select
            options={[
              { label: '保存', value: 'save' },
              { label: '取消', value: 'cancel' },
            ]}
            value="save"
            onChange={value => {
              if (value === 'save') {
                handleSaveForm()
              } else {
                handleCancelForm()
              }
            }}
          />
        </Box>
      </Dialog>
    )
  }

  // 渲染删除确认对话框
  const renderDeleteConfirm = () => {
    const config = deleteIndex !== null ? configs[deleteIndex] : null
    return (
      <Dialog
        title="确认删除"
        color="warning"
        onCancel={() => {
          setViewMode('list')
          setDeleteIndex(null)
        }}
      >
        <Text>确定要删除配置 &quot;{config?.name}&quot; 吗？</Text>
        <Select
          options={[
            { label: '删除', value: 'delete' },
            { label: '取消', value: 'cancel' },
          ]}
          value="cancel"
          onChange={value => {
            if (value === 'delete') {
              confirmDelete()
            } else {
              setViewMode('list')
              setDeleteIndex(null)
            }
          }}
        />
      </Dialog>
    )
  }

  // 简单的文本输入组件
  function TextInput({
    value,
    onChange,
    onSubmit,
    onCancel,
    placeholder,
    mask,
  }: {
    value: string
    onChange: (value: string) => void
    onSubmit: () => void
    onCancel: () => void
    placeholder?: string
    mask?: boolean
  }) {
    const [localValue, setLocalValue] = useState(value)

    useInput((input, key) => {
      if (key.return) {
        onChange(localValue)
        onSubmit()
      } else if (key.escape) {
        onCancel()
      } else if (key.backspace || key.delete) {
        setLocalValue(prev => prev.slice(0, -1))
      } else if (input && !key.ctrl && !key.meta) {
        setLocalValue(prev => prev + input)
      }
    })

    return (
      <Box>
        <Text color={theme.accent}>
          {mask ? '•'.repeat(localValue.length) : localValue}
          {localValue === '' && placeholder && (
            <Text color={theme.secondaryText}>{placeholder}</Text>
          )}
          <Text color={theme.accent}>|</Text>
        </Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text color={theme.text} bold>
          模型配置管理
        </Text>
      </Box>

      {viewMode === 'list' && renderConfigList()}
      {viewMode === 'add' && renderForm()}
      {viewMode === 'edit' && renderForm()}
      {viewMode === 'delete-confirm' && renderDeleteConfirm()}
    </Box>
  )
}
