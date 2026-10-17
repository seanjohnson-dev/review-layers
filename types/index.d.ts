export type ReviewLayersFinding = {
  n: number
  file: string
  line: number | null
  severity: 'important' | 'nit' | 'pre-existing'
  lens: 'correctness' | 'edges' | 'security'
  cls: string
  title: string
  why: string
  fix: string
  instances: string[]
  votes: number
  of: number
  status: 'open' | 'resolved' | 'repeat' | 'dropped'
  fp: string
}

export type ReviewLayersLayer = {
  name: string
  state: 'pass' | 'fail' | 'skip' | 'wait' | 'run'
  note: string
}

export type ReviewLayersEvidence = {
  cmd: string
  ok: boolean
  ms: number
  tail: string
}

export type ReviewLayersView = {
  root: string
  status: 'idle' | 'running' | 'green' | 'amber' | 'red' | 'stale'
  line: string
  step: string
  tier: 'low' | 'medium' | 'high' | null
  round: number
  tokens: number
  needsApproval: boolean
  approved: boolean
  layers: ReviewLayersLayer[]
  findings: ReviewLayersFinding[]
  evidence: ReviewLayersEvidence[]
}

declare module 'claude-code' {
  interface PluginState {
    'review-layers': { view: ReviewLayersView | null }
  }
}
